const axios = require('axios');
const { uploadToCloudinary } = require('../config/cloudinary');
const fs = require('fs').promises;
const path = require('path');

class WebhookService {
  constructor() {
    this.webhookUrl = "https://hooks.zapier.com/hooks/catch/24284026/uhbw6uw/";
  }

  /**
   * Send PDF package to webhook with case details
   * @param {Object} caseData - The case data containing all information
   * @param {Object} buyer - The buyer information (estimator/agent handling the case)
   * @param {string} pdfFilePath - Path to the generated PDF file
   * @returns {Promise<Object>} - Promise resolving to webhook response
   */
  async sendPDFPackageToWebhook(caseData, buyer, pdfFilePath) {
    console.log('=== WEBHOOK PDF PACKAGE START ===');
    console.log('Webhook URL:', this.webhookUrl);
    console.log('Case ID:', caseData._id);
    console.log('Buyer:', buyer);
    console.log('PDF File Path:', pdfFilePath);

    if (!this.webhookUrl) {
      console.warn('Webhook URL not configured. Skipping PDF package webhook.');
      return null;
    }

    try {
      // Upload PDF to Cloudinary
      console.log('Uploading PDF to Cloudinary...');
      const pdfBuffer = await fs.readFile(pdfFilePath);
      const cloudinaryResult = await uploadToCloudinary(pdfBuffer, {
        resource_type: 'raw',
        folder: 'vos-pdf-packages',
        public_id: `case-${caseData._id}-package-${Date.now()}`,
        format: 'pdf'
      });

      console.log('PDF uploaded to Cloudinary:', cloudinaryResult.secure_url);

      // Build webhook data
      const webhookData = this.buildPDFPackageWebhookData(caseData, buyer, cloudinaryResult.secure_url);

      console.log('=== WEBHOOK DATA ===');
      console.log('Full webhook data being sent:');
      console.log(JSON.stringify(webhookData, null, 2));

      // Send webhook
      console.log('=== WEBHOOK REQUEST ===');
      console.log('URL:', this.webhookUrl);
      console.log('Method: POST');
      console.log('Headers:', {
        'Content-Type': 'application/json',
      });

      const response = await axios.post(this.webhookUrl, webhookData, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 15000, // 15 second timeout for larger payloads
      });

      console.log('=== WEBHOOK RESPONSE ===');
      console.log('Status:', response.status);
      console.log('Status Text:', response.statusText);
      console.log('Response Data:', JSON.stringify(response.data, null, 2));
      console.log('=== WEBHOOK SUCCESS ===');

      return {
        success: true,
        webhookResponse: response.data,
        pdfUrl: cloudinaryResult.secure_url,
        publicId: cloudinaryResult.public_id
      };

    } catch (error) {
      console.log('=== WEBHOOK ERROR ===');
      console.error('Error sending PDF package webhook:');
      console.error('Error Message:', error.message);
      console.error('Error Code:', error.code);
      console.error('Error Stack:', error.stack);
      
      if (error.response) {
        console.error('Response Status:', error.response.status);
        console.error('Response Status Text:', error.response.statusText);
        console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
      } else if (error.request) {
        console.error('Request was made but no response received');
        console.error('Request:', error.request);
      } else {
        console.error('Error setting up request:', error.message);
      }
      
      console.error('Case ID:', caseData._id);
      console.log('=== WEBHOOK ERROR END ===');
      
      // Don't throw error - we don't want to fail the process if webhook is down
      return {
        success: false,
        error: error.message,
        pdfUrl: null
      };
    }
  }

  /**
   * Build webhook data for PDF package
   * @param {Object} caseData - The case data
   * @param {Object} buyer - The buyer information
   * @param {string} pdfUrl - The Cloudinary URL of the PDF
   * @returns {Object} - The webhook data structure
   */
  buildPDFPackageWebhookData(caseData, buyer, pdfUrl) {
    const customer = caseData.customer || {};
    const vehicle = caseData.vehicle || {};
    const quote = caseData.quote || {};
    const transaction = caseData.transaction || {};
    const inspection = caseData.inspection || {};

    return {
      action: 'pdf_package_sent',
      case_id: caseData._id.toString(),
      case_status: caseData.status,
      case_created_at: caseData.createdAt,
      
      // Buyer information (estimator/agent handling the case)
      buyer: {
        first_name: buyer.firstName || '',
        last_name: buyer.lastName || '',
        email: buyer.email || '',
        user_id: buyer.id || buyer._id || null,
        role: buyer.role || ''
      },
      
      // Seller information (customer selling the car)
      seller: {
        first_name: customer.firstName || '',
        last_name: customer.lastName || '',
        email: customer.email1 || '',
        phone: customer.cellPhone || '',
        user_id: customer.customerId || null
      },
      
      // Vehicle information
      vehicle: {
        year: vehicle.year || '',
        make: vehicle.make || '',
        model: vehicle.model || '',
        vin: vehicle.vin || '',
        color: vehicle.color || '',
        mileage: vehicle.currentMileage || '',
        estimated_value: vehicle.estimatedValue || null
      },
      
      // Transaction details
      transaction: {
        sale_price: transaction.billOfSale?.salePrice || quote.offerAmount || null,
        sale_date: transaction.billOfSale?.saleDate || null,
        payment_method: transaction.billOfSale?.paymentMethod || transaction.preferredPaymentMethod || '',
        title_status: vehicle.titleStatus || transaction.billOfSale?.titleStatus || ''
      },
      
      // Inspection summary
      inspection: {
        overall_rating: inspection.overallRating || null,
        overall_score: inspection.overallScore || null,
        inspector_name: inspection.inspector ? `${inspection.inspector.firstName || ''} ${inspection.inspector.lastName || ''}`.trim() : '',
        completed_at: inspection.completedAt || null,
        sections_count: inspection.sections ? inspection.sections.length : 0
      },
      
      // Quote summary
      quote: {
        offer_amount: quote.offerAmount || null,
        estimated_value: quote.estimatedValue || vehicle.estimatedValue || null,
        status: quote.status || '',
        decision: quote.offerDecision?.decision || 'pending',
        generated_at: quote.generatedAt || null
      },
      
      // PDF package information
      pdf_package: {
        url: pdfUrl,
        generated_at: new Date().toISOString(),
        contains: [
          'Quote Summary',
          'Inspection Report', 
          'Bill of Sale'
        ],
        file_size: null, // Could be added if needed
        expires_at: null // Could be added if needed
      },
      
      // Metadata
      metadata: {
        sent_at: new Date().toISOString(),
        package_type: 'complete_case_documentation',
        version: '1.0'
      }
    };
  }
}

module.exports = new WebhookService();
