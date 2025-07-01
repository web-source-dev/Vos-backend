const axios = require('axios');
const crypto = require('crypto');
const VeriffSession = require('../models/VeriffSession');
const User = require('../models/User');

// Veriff API configuration
const VERIFF_API_URL = process.env.VERIFF_API_URL || 'https://stationapi.veriff.com';
const VERIFF_PUBLIC_KEY = process.env.VERIFF_PUBLIC_KEY;
const VERIFF_PRIVATE_KEY = process.env.VERIFF_PRIVATE_KEY;

// Helper function to create Veriff signature
const createVeriffSignature = (payload, timestamp = null, isWebhook = false) => {
  let dataToSign;
  if (isWebhook && timestamp) {
    dataToSign = `${timestamp}.${typeof payload === 'string' ? payload : JSON.stringify(payload)}`;
  } else if (timestamp) {
    // For API requests, include timestamp in signature
    dataToSign = `${timestamp}.${typeof payload === 'string' ? payload : JSON.stringify(payload)}`;
  } else {
    dataToSign = typeof payload === 'string' ? payload : JSON.stringify(payload);
  }
  return crypto
    .createHmac('sha256', VERIFF_PRIVATE_KEY)
    .update(dataToSign)
    .digest('hex');
};

// Helper to remove null/undefined fields recursively
function removeNulls(obj) {
  if (Array.isArray(obj)) {
    return obj.map(removeNulls);
  } else if (obj && typeof obj === 'object') {
    return Object.entries(obj)
      .filter(([_, v]) => v !== null && v !== undefined)
      .reduce((acc, [k, v]) => {
        acc[k] = removeNulls(v);
        return acc;
      }, {});
  }
  return obj;
}

// @desc    Create Veriff session
// @route   POST /api/veriff/session
// @access  Private
exports.createSession = async (req, res) => {
  try {
    const { person, document } = req.body;
    // Log the received payload for debugging
    console.log('Received payload from frontend:', JSON.stringify(req.body));

    // Validate required fields
    if (!person || !person.givenName || !person.lastName || !person.email) {
      return res.status(400).json({
        success: false,
        error: 'Person information is required (givenName, lastName, email)'
      });
    }

    if (!VERIFF_PUBLIC_KEY || !VERIFF_PRIVATE_KEY) {
      return res.status(500).json({
        success: false,
        error: 'Veriff API keys not configured'
      });
    }

    // Prepare session payload for API request
    let sessionPayload = {
      person: {
        givenName: person.givenName,
        lastName: person.lastName,
        email: person.email,
        phoneNumber: person.phoneNumber || null,
        idNumber: person.idNumber || null,
      },
      document: document || {
        type: 'DRIVERS_LICENSE',
        country: 'US'
      },
      vendorData: req.user.id, // Store user ID for reference
      callback: `${process.env.API_BASE_URL || 'http://localhost:5000'}/api/veriff/result`,
      timestamp: Math.floor(Date.now() / 1000)
    };
    // Remove null/undefined fields
    const cleanPayload = removeNulls(sessionPayload);

    // Prepare the exact JSON string for signature
    const bodyString = JSON.stringify(cleanPayload);
    // Log for debugging
    console.log('Veriff payload (minified):', bodyString);
    const timestamp = Math.floor(Date.now() / 1000);
    console.log('Veriff timestamp:', timestamp);

    // Create signature for session creation (sign the exact string)
    const signature = createVeriffSignature(bodyString, timestamp);
    console.log('Veriff signature:', signature);

    // Make request to Veriff API with the object (not string)
    const response = await axios.post(`${VERIFF_API_URL}/v1/sessions`, cleanPayload, {
      headers: {
        'Content-Type': 'application/json',
        'X-AUTH-CLIENT': VERIFF_PUBLIC_KEY,
        'X-SIGNATURE': signature,
        'X-TIMESTAMP': timestamp
      }
    });

    // Store session in database
    const sessionData = {
      sessionId: response.data.verification.id,
      userId: req.user.id,
      status: 'created',
      url: response.data.verification.url,
      person: {
        givenName: person.givenName,
        lastName: person.lastName,
        email: person.email,
        phoneNumber: person.phoneNumber || null,
        idNumber: person.idNumber || null
      },
      document: document || {
        type: 'DRIVERS_LICENSE',
        country: 'US'
      }
    };

    await VeriffSession.create(sessionData);
    console.log('Veriff session saved to database:', sessionData);

    res.status(200).json({
      success: true,
      data: {
        id: response.data.verification.id,
        url: response.data.verification.url,
        status: 'created'
      }
    });

  } catch (error) {
    console.error('Error creating Veriff session:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to create verification session'
    });
  }
};

// @desc    Handle Veriff webhook result
// @route   POST /api/veriff/result
// @access  Public (webhook)
exports.handleResult = async (req, res) => {
  try {
    const { verification } = req.body;
    // Log the received webhook payload and headers
    console.log('Received webhook payload:', JSON.stringify(req.body));
    console.log('Webhook headers:', req.headers);
    if (!verification) {
      return res.status(400).json({
        success: false,
        error: 'Verification data is required'
      });
    }

    // Verify webhook signature (recommended for production)
    const signature = req.headers['x-signature'] || req.headers['x-hmac-signature'];
    const timestamp = req.headers['x-timestamp'];
    if (signature && timestamp) {
      const expectedSignature = createVeriffSignature(req.body, timestamp, true);
      if (signature !== expectedSignature) {
        console.error('Invalid webhook signature');
        return res.status(401).json({
          success: false,
          error: 'Invalid signature'
        });
      }
    }

    const sessionId = verification.id;
    const status = verification.status;
    const person = verification.person;
    const document = verification.document;

    // Update session in database
    const session = await VeriffSession.findOne({ sessionId });
    if (session) {
      session.status = status;
      session.verificationData = {
        person,
        document,
        verification: verification
      };
      if (status === 'approved' || status === 'declined') {
        session.completedAt = new Date();
      }
      await session.save();
      console.log('Veriff session updated in database:', sessionId, status);
    }

    // Update user verification status if approved
    if (status === 'approved') {
      const session = await VeriffSession.findOne({ sessionId }).populate('userId');
      if (session && session.userId) {
        await User.findByIdAndUpdate(session.userId, {
          isVerified: true,
          verifiedAt: new Date()
        });
        console.log('User verification status updated for session:', sessionId);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Webhook processed successfully'
    });

  } catch (error) {
    console.error('Error processing Veriff webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process webhook'
    });
  }
};

// @desc    Get session status
// @route   GET /api/veriff/session/:sessionId
// @access  Private
exports.getSessionStatus = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const timestamp = Math.floor(Date.now() / 1000);

    if (!VERIFF_PUBLIC_KEY || !VERIFF_PRIVATE_KEY) {
      return res.status(500).json({
        success: false,
        error: 'Veriff API keys not configured'
      });
    }

    // Create signature for GET request
    const signature = createVeriffSignature({}, timestamp);

    // Get session from Veriff API
    const response = await axios.get(`${VERIFF_API_URL}/v1/sessions/${sessionId}`, {
      headers: {
        'X-AUTH-CLIENT': VERIFF_PUBLIC_KEY,
        'X-SIGNATURE': signature,
        'X-TIMESTAMP': timestamp
      }
    });

    res.status(200).json({
      success: true,
      data: {
        sessionId: response.data.verification.id,
        status: response.data.verification.status,
        person: response.data.verification.person,
        document: response.data.verification.document
      }
    });

  } catch (error) {
    console.error('Error getting session status:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get session status'
    });
  }
}; 