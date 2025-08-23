const axios = require('axios');

class VeriffService {
  constructor() {
    this.baseURL = 'https://stationapi.veriff.com';
    this.apiKey = process.env.VERIFF_API_KEY;
    this.apiSecret = process.env.VERIFF_API_SECRET;
    
    if (!this.apiKey || !this.apiSecret) {
      console.warn('Veriff API credentials not configured. Set VERIFF_API_KEY and VERIFF_API_SECRET environment variables.');
    }
  }

  /**
   * Create a new Veriff session
   * @param {Object} customerData - Customer information
   * @param {string} customerData.firstName - Customer first name
   * @param {string} customerData.lastName - Customer last name
   * @param {string} customerData.email - Customer email
   * @param {string} customerData.phone - Customer phone number
   * @param {string} caseId - VOS case ID for reference
   * @returns {Promise<Object>} Session creation response
   */
  async createSession(customerData, caseId) {
    try {
      if (!this.apiKey || !this.apiSecret) {
        throw new Error('Veriff API credentials not configured');
      }

      const sessionData = {
        verification: {
          callback: process.env.VERIFF_WEBHOOK_URL || `${process.env.NEXT_PUBLIC_API_URL}/api/veriff/webhook`,
          document: {
            type: 'DRIVERS_LICENSE'
          },
          person: {
            givenName: customerData.firstName,
            lastName: customerData.lastName,
            email: customerData.email,
            phoneNumber: customerData.phone || ''
          }
        },
        timestamp: new Date().toISOString(),
        reference: caseId // Use VOS case ID as reference
      };

      console.log('Creating Veriff session with data:', {
        customerName: `${customerData.firstName} ${customerData.lastName}`,
        caseId: caseId,
        callback: sessionData.verification.callback
      });

      const response = await axios.post(`${this.baseURL}/sessions`, sessionData, {
        headers: {
          'Content-Type': 'application/json',
          'X-AUTH-CLIENT': this.apiKey,
          'X-SIGNATURE': this.generateSignature(sessionData)
        }
      });

      console.log('Veriff session created successfully:', {
        sessionId: response.data.verification.id,
        status: response.data.verification.status
      });

      return {
        success: true,
        sessionId: response.data.verification.id,
        status: response.data.verification.status,
        url: response.data.verification.url
      };

    } catch (error) {
      console.error('Error creating Veriff session:', error.response?.data || error.message);
      throw new Error(`Failed to create Veriff session: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Upload media (driver's license images) to Veriff session
   * @param {string} sessionId - Veriff session ID
   * @param {Buffer} imageBuffer - Image buffer data
   * @param {string} imageType - 'front' or 'back'
   * @param {string} mimeType - Image MIME type
   * @returns {Promise<Object>} Upload response
   */
  async uploadMedia(sessionId, imageBuffer, imageType, mimeType) {
    try {
      if (!this.apiKey || !this.apiSecret) {
        throw new Error('Veriff API credentials not configured');
      }

      const mediaData = {
        image: imageBuffer.toString('base64'),
        imageType: imageType,
        timestamp: new Date().toISOString()
      };

      console.log(`Uploading ${imageType} image to Veriff session ${sessionId}`);

      const response = await axios.post(`${this.baseURL}/sessions/${sessionId}/media`, mediaData, {
        headers: {
          'Content-Type': 'application/json',
          'X-AUTH-CLIENT': this.apiKey,
          'X-SIGNATURE': this.generateSignature(mediaData)
        }
      });

      console.log(`${imageType} image uploaded successfully to session ${sessionId}`);

      return {
        success: true,
        mediaId: response.data.id,
        status: response.data.status
      };

    } catch (error) {
      console.error(`Error uploading ${imageType} image to Veriff:`, error.response?.data || error.message);
      throw new Error(`Failed to upload ${imageType} image: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Submit session for verification
   * @param {string} sessionId - Veriff session ID
   * @returns {Promise<Object>} Submission response
   */
  async submitSession(sessionId) {
    try {
      if (!this.apiKey || !this.apiSecret) {
        throw new Error('Veriff API credentials not configured');
      }

      const submitData = {
        status: 'submitted',
        timestamp: new Date().toISOString()
      };

      console.log(`Submitting Veriff session ${sessionId} for verification`);

      const response = await axios.patch(`${this.baseURL}/sessions/${sessionId}`, submitData, {
        headers: {
          'Content-Type': 'application/json',
          'X-AUTH-CLIENT': this.apiKey,
          'X-SIGNATURE': this.generateSignature(submitData)
        }
      });

      console.log(`Session ${sessionId} submitted successfully for verification`);

      return {
        success: true,
        status: response.data.verification.status,
        verificationId: response.data.verification.id
      };

    } catch (error) {
      console.error('Error submitting Veriff session:', error.response?.data || error.message);
      throw new Error(`Failed to submit session: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get session status
   * @param {string} sessionId - Veriff session ID
   * @returns {Promise<Object>} Session status
   */
  async getSessionStatus(sessionId) {
    try {
      if (!this.apiKey || !this.apiSecret) {
        throw new Error('Veriff API credentials not configured');
      }

      const response = await axios.get(`${this.baseURL}/sessions/${sessionId}`, {
        headers: {
          'X-AUTH-CLIENT': this.apiKey,
          'X-SIGNATURE': this.generateSignature({})
        }
      });

      return {
        success: true,
        status: response.data.verification.status,
        verificationId: response.data.verification.id,
        document: response.data.verification.document,
        person: response.data.verification.person
      };

    } catch (error) {
      console.error('Error getting Veriff session status:', error.response?.data || error.message);
      throw new Error(`Failed to get session status: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Generate signature for Veriff API requests
   * @param {Object} payload - Request payload
   * @returns {string} Generated signature
   */
  generateSignature(payload) {
    const crypto = require('crypto');
    const payloadString = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', this.apiSecret)
      .update(payloadString)
      .digest('hex');
    
    return signature;
  }

  /**
   * Complete driver's license verification process
   * @param {Object} customerData - Customer information
   * @param {string} caseId - VOS case ID
   * @param {Buffer} frontImageBuffer - Front image buffer
   * @param {Buffer} backImageBuffer - Back image buffer
   * @param {string} frontMimeType - Front image MIME type
   * @param {string} backMimeType - Back image MIME type
   * @returns {Promise<Object>} Complete verification process result
   */
  async completeDriverLicenseVerification(customerData, caseId, frontImageBuffer, backImageBuffer, frontMimeType, backMimeType) {
    try {
      console.log('Starting complete driver license verification process for case:', caseId);

      // Step 1: Create session
      const sessionResult = await this.createSession(customerData, caseId);
      if (!sessionResult.success) {
        throw new Error('Failed to create Veriff session');
      }

      const sessionId = sessionResult.sessionId;
      console.log('Veriff session created:', sessionId);

      // Step 2: Upload front image
      const frontUploadResult = await this.uploadMedia(sessionId, frontImageBuffer, 'front', frontMimeType);
      if (!frontUploadResult.success) {
        throw new Error('Failed to upload front image');
      }

      console.log('Front image uploaded successfully');

      // Step 3: Upload back image
      const backUploadResult = await this.uploadMedia(sessionId, backImageBuffer, 'back', backMimeType);
      if (!backUploadResult.success) {
        throw new Error('Failed to upload back image');
      }

      console.log('Back image uploaded successfully');

      // Step 4: Submit session
      const submitResult = await this.submitSession(sessionId);
      if (!submitResult.success) {
        throw new Error('Failed to submit session');
      }

      console.log('Session submitted successfully for verification');

      return {
        success: true,
        sessionId: sessionId,
        status: submitResult.status,
        verificationId: submitResult.verificationId,
        message: 'Driver license verification submitted successfully'
      };

    } catch (error) {
      console.error('Error in complete driver license verification:', error);
      throw error;
    }
  }
}

module.exports = new VeriffService();
