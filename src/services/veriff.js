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
        verification: {}
      };

      console.log('Creating Veriff session with data:', {
        customerName: `${customerData.firstName} ${customerData.lastName}`,
        caseId: caseId,
        callback: sessionData.verification.callback
      });

      console.log('Full session data being sent:', JSON.stringify(sessionData, null, 2));

      const response = await axios.post(`${this.baseURL}/v1/sessions`, sessionData, {
        headers: {
          'Content-Type': 'application/json',
          'x-auth-client': this.apiKey,
          'x-hmac-signature': this.generateSignature(sessionData)
        }
      });

      console.log('Veriff session created successfully:', {
        sessionId: response.data.verification.id,
        status: response.data.verification.status,
        sessionToken: response.data.verification.sessionToken
      });

      return {
        success: true,
        sessionId: response.data.verification.id,
        status: response.data.verification.status,
        url: response.data.verification.url,
        sessionToken: response.data.verification.sessionToken
      };

    } catch (error) {
      console.error('Error creating Veriff session:', error.response?.data || error.message);
      console.error('Error status:', error.response?.status);
      console.error('Error headers:', error.response?.headers);
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

      // Convert imageType to proper context value
      const context = imageType === 'front' ? 'document-front' : 'document-back';
      
      // Create base64 data URL
      const base64Content = imageBuffer.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64Content}`;

      const mediaData = {
        image: {
          context: context,
          content: dataUrl,
          timestamp: new Date().toISOString()
        }
      };

      console.log(`Uploading ${context} image to Veriff session ${sessionId}`);
      console.log(`Image size: ${imageBuffer.length} bytes, MIME type: ${mimeType}`);

      const response = await axios.post(`${this.baseURL}/v1/sessions/${sessionId}/media`, mediaData, {
        headers: {
          'Content-Type': 'application/json',
          'x-auth-client': this.apiKey,
          'x-hmac-signature': this.generateSignature(mediaData)
        }
      });

      console.log(`${context} image uploaded successfully to session ${sessionId}`);

      return {
        success: true,
        mediaId: response.data.id,
        status: response.data.status
      };

    } catch (error) {
      console.error(`Error uploading ${imageType} image to Veriff:`, error.response?.data || error.message);
      console.error('Error status:', error.response?.status);
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
        verification: {
          status: 'submitted'
        }
      };

      console.log(`Submitting Veriff session ${sessionId} for verification`);
      console.log('Submit data:', JSON.stringify(submitData, null, 2));

      const response = await axios.patch(`${this.baseURL}/v1/sessions/${sessionId}`, submitData, {
        headers: {
          'Content-Type': 'application/json',
          'x-auth-client': this.apiKey,
          'x-hmac-signature': this.generateSignature(submitData)
        }
      });

      console.log(`Session ${sessionId} submitted successfully for verification`);
      console.log('Response:', JSON.stringify(response.data, null, 2));

      return {
        success: true,
        status: response.data.verification.status,
        verificationId: response.data.verification.id
      };

    } catch (error) {
      console.error('Error submitting Veriff session:', error.response?.data || error.message);
      console.error('Error status:', error.response?.status);
      throw new Error(`Failed to submit session: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Generate signature for Veriff API requests
   * @param {Object|string} payload - Request payload or session ID for GET requests
   * @returns {string} Generated signature
   */
  generateSignature(payload) {
    const crypto = require('crypto');
    
    let payloadString;
    if (typeof payload === 'string') {
      // For GET requests, use the session ID directly
      payloadString = payload;
    } else {
      // For POST/PATCH requests, stringify the object
      payloadString = JSON.stringify(payload);
    }
    
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
