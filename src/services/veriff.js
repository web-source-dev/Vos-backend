const crypto = require('crypto');
const axios = require('axios');
const emailService = require('./email');

class VeriffService {
  constructor() {
    this.apiKey = process.env.VERIFF_API_KEY;
    this.apiSecret = process.env.VERIFF_API_SECRET;
    this.baseUrl = 'https://stationapi.veriff.com';
    
    if (!this.apiKey || !this.apiSecret) {
      console.error('Veriff API credentials not configured. Please set VERIFF_API_KEY and VERIFF_API_SECRET environment variables.');
    }
  }

  // Generate HMAC signature for Veriff API requests
  generateSignature(payload) {
    const payloadString = JSON.stringify(payload);
    return crypto.createHmac('sha256', this.apiSecret).update(payloadString).digest('hex');
  }

  // Create a verification session
  async createSession(customerData, caseId) {
    try {
      if (!this.apiKey || !this.apiSecret) {
        throw new Error('Veriff API credentials not configured');
      }

      const payload = {
        verification: {
          callback: `${process.env.BASE_URL || 'http://localhost:5000'}/api/veriff/webhook`,
          person: {
            givenName: customerData.firstName,
            lastName: customerData.lastName,
            email: customerData.email1
          },
          document: {
            type: 'DRIVERS_LICENSE'
          },
          vendorData: caseId // Store case ID for webhook processing
        }
      };

      const signature = this.generateSignature(payload);

      const response = await axios.post(`${this.baseUrl}/v1/sessions`, payload, {
        headers: {
          'X-AUTH-CLIENT': this.apiKey,
          'X-HMAC-SIGNATURE': signature,
          'Content-Type': 'application/json'
        }
      });

      // Send verification email to customer
      try {
        await emailService.sendVeriffVerificationEmail(
          customerData,
          response.data.verification.url,
          process.env.BASE_URL || 'http://localhost:5000'
        );
        console.log('Veriff verification email sent to customer');
      } catch (emailError) {
        console.error('Error sending Veriff verification email:', emailError);
        // Don't fail the session creation if email fails
      }

      return {
        success: true,
        data: {
          sessionId: response.data.verification.id,
          verificationUrl: response.data.verification.url,
          sessionData: response.data
        }
      };
    } catch (error) {
      console.error('Error creating Veriff session:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  // Get session decision
  async getSessionDecision(sessionId) {
    try {
      if (!this.apiKey || !this.apiSecret) {
        throw new Error('Veriff API credentials not configured');
      }

      const payload = '';
      const signature = this.generateSignature(payload);

      const response = await axios.get(`${this.baseUrl}/v1/sessions/${sessionId}/decision`, {
        headers: {
          'X-AUTH-CLIENT': this.apiKey,
          'X-HMAC-SIGNATURE': signature,
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error getting Veriff session decision:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  // Verify webhook signature
  verifyWebhookSignature(payload, signature) {
    const expectedSignature = crypto.createHmac('sha256', this.apiSecret).update(JSON.stringify(payload)).digest('hex');
    return expectedSignature === signature;
  }

  // Process webhook data
  processWebhookData(webhookData) {
    try {
      const { verification, status } = webhookData;
      
      return {
        success: true,
        data: {
          sessionId: verification.id,
          status: status,
          decision: webhookData.verification?.decision,
          person: webhookData.verification?.person,
          document: webhookData.verification?.document,
          vendorData: webhookData.verification?.vendorData // This will be our case ID
        }
      };
    } catch (error) {
      console.error('Error processing webhook data:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new VeriffService(); 