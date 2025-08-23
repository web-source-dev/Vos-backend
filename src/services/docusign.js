const axios = require('axios');
const { generateQuoteSummaryPDF, generateBillOfSalePDF, generateCasePDF } = require('./pdf');
const { uploadToCloudinary } = require('../config/cloudinary');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

class DocuSignService {
  constructor() {
    this.webhookUrl = "https://hooks.zapier.com/hooks/catch/24284026/utevk68/";
    this.docusignWebhookUrl = "https://hooks.zapier.com/hooks/catch/24284026/utevk68/";
  }

  /**
   * Generate complete PDF package and send to DocuSign via Zapier
   * @param {Object} caseData - Complete case data with all related documents
   * @returns {Promise<Object>} - Promise resolving to DocuSign envelope information
   */
  async generateAndSendToDocuSign(caseData) {
    try {
      console.log('=== DOCUSIGN INTEGRATION START ===');
      console.log('Case ID:', caseData._id);
      console.log('Customer:', caseData.customer?.firstName, caseData.customer?.lastName);

      // Generate all required PDFs
      const pdfPackage = await this.generatePDFPackage(caseData);
      
      // Prepare DocuSign envelope data
      const envelopeData = await this.prepareDocuSignEnvelope(caseData, pdfPackage);
      
      // Send to Zapier for DocuSign processing
      const result = await this.sendToDocuSignViaZapier(envelopeData);
      
      console.log('=== DOCUSIGN INTEGRATION SUCCESS ===');
      return result;
      
    } catch (error) {
      console.error('=== DOCUSIGN INTEGRATION ERROR ===');
      console.error('Error in DocuSign integration:', error);
      throw error;
    }
  }

  /**
   * Generate complete PDF package with all required documents
   * @param {Object} caseData - Complete case data
   * @returns {Promise<Object>} - Promise resolving to PDF package information
   */
  async generatePDFPackage(caseData) {
    console.log('Generating PDF package...');
    
    const pdfPackage = {
      quoteSummary: null,
      inspectionReport: null,
      billOfSale: null,
      combinedPackage: null
    };

    try {
      // 1. Generate Quote Summary PDF
      if (caseData.quote) {
        console.log('Generating Quote Summary PDF...');
        const quoteSummaryResult = await generateQuoteSummaryPDF(caseData);
        pdfPackage.quoteSummary = {
          filePath: quoteSummaryResult.filePath,
          fileName: quoteSummaryResult.fileName
        };
      }

      // 2. Generate Bill of Sale PDF
      console.log('Generating Bill of Sale PDF...');
      const billOfSaleResult = await generateBillOfSalePDF(caseData);
      pdfPackage.billOfSale = {
        filePath: billOfSaleResult.filePath,
        fileName: billOfSaleResult.fileName
      };

      // 3. Generate Inspection Report (if available)
      if (caseData.inspection && caseData.inspection.completed) {
        console.log('Generating Inspection Report PDF...');
        const inspectionResult = await generateCasePDF(caseData);
        pdfPackage.inspectionReport = {
          filePath: inspectionResult.filePath,
          fileName: inspectionResult.fileName
        };
      }

      // 4. Create combined PDF package
      console.log('Creating combined PDF package...');
      const combinedPackage = await this.createCombinedPDFPackage(caseData, pdfPackage);
      pdfPackage.combinedPackage = combinedPackage;

      console.log('PDF package generated successfully');
      return pdfPackage;

    } catch (error) {
      console.error('Error generating PDF package:', error);
      throw error;
    }
  }

  /**
   * Create a combined PDF package with all documents
   * @param {Object} caseData - Case data
   * @param {Object} pdfPackage - Individual PDF files
   * @returns {Promise<Object>} - Combined PDF package info
   */
  async createCombinedPDFPackage(caseData, pdfPackage) {
    try {
      const { PDFDocument } = require('pdf-lib');
      
      // Create a new PDF document
      const mergedPdf = await PDFDocument.create();
      
      // Add documents in order
      const documents = [];
      
      // 1. Quote Summary (if available)
      if (pdfPackage.quoteSummary) {
        const quotePdfBytes = await fs.readFile(pdfPackage.quoteSummary.filePath);
        const quotePdf = await PDFDocument.load(quotePdfBytes);
        documents.push(quotePdf);
      }
      
      // 2. Inspection Report (if available)
      if (pdfPackage.inspectionReport) {
        const inspectionPdfBytes = await fs.readFile(pdfPackage.inspectionReport.filePath);
        const inspectionPdf = await PDFDocument.load(inspectionPdfBytes);
        documents.push(inspectionPdf);
      }
      
      // 3. Bill of Sale (always included)
      const billOfSalePdfBytes = await fs.readFile(pdfPackage.billOfSale.filePath);
      const billOfSalePdf = await PDFDocument.load(billOfSalePdfBytes);
      documents.push(billOfSalePdf);
      
      // Merge all documents
      for (const pdf of documents) {
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        pages.forEach((page) => mergedPdf.addPage(page));
      }
      
      // Save combined PDF
      const mergedPdfBytes = await mergedPdf.save();
      const combinedFileName = `docusign-package-${caseData._id}-${Date.now()}.pdf`;
      const combinedFilePath = path.join(__dirname, '../../uploads/pdfs', combinedFileName);
      
      await fs.writeFile(combinedFilePath, mergedPdfBytes);
      
      return {
        filePath: combinedFilePath,
        fileName: combinedFileName
      };
      
    } catch (error) {
      console.error('Error creating combined PDF package:', error);
      throw error;
    }
  }

  /**
   * Prepare DocuSign envelope data with auto-populated fields
   * @param {Object} caseData - Case data
   * @param {Object} pdfPackage - PDF package information
   * @returns {Promise<Object>} - DocuSign envelope data
   */
  async prepareDocuSignEnvelope(caseData, pdfPackage) {
    const customer = caseData.customer || {};
    const vehicle = caseData.vehicle || {};
    const transaction = caseData.transaction || {};
    const billOfSale = transaction.billOfSale || {};
    const quote = caseData.quote || {};

    // Read the combined PDF file
    const pdfBuffer = fsSync.readFileSync(pdfPackage.combinedPackage.filePath);

    // Upload PDF to Cloudinary
    console.log('Uploading PDF to Cloudinary...');
    const uploadOptions = {
      folder: `vos-docusign/${caseData._id}`,
      public_id: `docusign-package-${caseData._id}-${Date.now()}`,
      resource_type: 'raw',
      format: 'pdf'
    };

    const cloudinaryResult = await uploadToCloudinary(pdfBuffer, uploadOptions);
    console.log('PDF uploaded to Cloudinary:', cloudinaryResult.secure_url);

    const envelopeData = {
      action: 'send_to_docusign',
      case_id: caseData._id.toString(),
      envelope_subject: `VOS Vehicle Sale Documents - ${customer.firstName} ${customer.lastName}`,
      envelope_message: `Please review and sign the attached vehicle sale documents for your ${vehicle.year} ${vehicle.make} ${vehicle.model}.`,
      
      // Document information
      document: {
        fileName: pdfPackage.combinedPackage.fileName,
        fileUrl: cloudinaryResult.secure_url,
        fileType: 'pdf',
        cloudinaryPublicId: cloudinaryResult.public_id
      },
      
      // Recipient information
      recipients: {
        signer: {
          name: `${customer.firstName} ${customer.lastName}`,
          email: customer.email1,
          phone: customer.cellPhone,
          routingOrder: 1,
          recipientType: 'signer'
        }
      },
      
      // Auto-populate fields mapping
      customFields: {
        // Customer Information
        'customer_first_name': customer.firstName || '',
        'customer_last_name': customer.lastName || '',
        'customer_email': customer.email1 || '',
        'customer_phone': customer.cellPhone || '',
        'customer_address': billOfSale.sellerAddress || '',
        'customer_city': billOfSale.sellerCity || '',
        'customer_state': billOfSale.sellerState || '',
        'customer_zip': billOfSale.sellerZip || '',
        'customer_dl_number': billOfSale.sellerDLNumber || '',
        'customer_dl_state': billOfSale.sellerDLState || '',
        
        // Vehicle Information
        'vehicle_year': vehicle.year || '',
        'vehicle_make': vehicle.make || '',
        'vehicle_model': vehicle.model || '',
        'vehicle_vin': vehicle.vin || '',
        'vehicle_color': vehicle.color || '',
        'vehicle_mileage': vehicle.currentMileage || '',
        'vehicle_license_plate': vehicle.licensePlate || '',
        'vehicle_license_state': vehicle.licenseState || '',
        'vehicle_title_number': vehicle.titleNumber || '',
        'vehicle_title_status': vehicle.titleStatus || 'clean',
        
        // Transaction Information
        'sale_price': (quote.offerAmount || 0).toString(),
        'sale_date': billOfSale.saleDate || new Date().toISOString().split('T')[0],
        'sale_time': billOfSale.saleTime || '',
        'payment_method': billOfSale.paymentMethod || 'ACH Transfer',
        'odometer_reading': billOfSale.odometerReading || vehicle.currentMileage || '',
        'odometer_accurate': billOfSale.odometerAccurate ? 'Yes' : 'No',
        'known_defects': billOfSale.knownDefects || vehicle.knownDefects || 'None',
        
        // Bank/Loan Information
        'bank_name': transaction.bankDetails?.bankName || '',
        'loan_number': transaction.bankDetails?.loanNumber || '',
        'payoff_amount': (transaction.bankDetails?.payoffAmount || 0).toString(),
        'preferred_payment_method': transaction.preferredPaymentMethod || 'Wire',
        
        // VOS Information
        'vos_buyer_name': 'VOS - Vehicle Offer Service',
        'vos_buyer_address': billOfSale.buyerAddress || '123 Business Ave',
        'vos_buyer_city': billOfSale.buyerCity || 'Business City',
        'vos_buyer_state': billOfSale.buyerState || 'BC',
        'vos_buyer_zip': billOfSale.buyerZip || '12345',
        'vos_business_license': billOfSale.buyerBusinessLicense || 'VOS-12345-AB',
        
        // Case Information
        'case_id': caseData._id.toString(),
        'quote_id': quote._id?.toString() || '',
        'inspection_id': caseData.inspection?._id?.toString() || '',
        'transaction_id': transaction._id?.toString() || ''
      },
      
      // DocuSign envelope settings
      envelope_settings: {
        enableWetSign: false,
        allowRecipientRecursion: false,
        allowMarkup: false,
        useDisclosure: false,
        disableResponsiveDocument: false,
        enableLog: true,
        allowComments: false,
        allowViewHistory: true,
        envelopeIdStamping: true,
        authoritativeCopy: false,
        notification: {
          useAccountDefaults: true,
          reminder: {
            reminderEnabled: true,
            reminderDelay: 2,
            reminderFrequency: 2
          },
          expiration: {
            expirationEnabled: true,
            expirationDays: 30,
            expirationWarnDays: 5
          }
        }
      },
      
      // Metadata for tracking
      metadata: {
        case_id: caseData._id.toString(),
        customer_name: `${customer.firstName} ${customer.lastName}`,
        vehicle_info: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        created_at: new Date().toISOString(),
        source: 'vos_backend'
      }
    };

    console.log('DocuSign envelope data prepared');
    return envelopeData;
  }

  /**
   * Send envelope data to Zapier for DocuSign processing
   * @param {Object} envelopeData - Prepared envelope data
   * @returns {Promise<Object>} - DocuSign envelope result
   */
  async sendToDocuSignViaZapier(envelopeData) {
    console.log('Sending to DocuSign via Zapier...');
    console.log('Webhook URL:', this.docusignWebhookUrl);
    
    if (!this.docusignWebhookUrl) {
      console.warn('DocuSign webhook URL not configured. Skipping DocuSign integration.');
      return {
        success: false,
        error: 'DocuSign webhook URL not configured'
      };
    }

    try {
      const response = await axios.post(this.docusignWebhookUrl, envelopeData, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 second timeout for DocuSign processing
      });

      console.log('DocuSign webhook response:', {
        status: response.status,
        data: response.data
      });

      return {
        success: true,
        envelopeId: response.data.envelopeId,
        status: response.data.status,
        recipientViewUrl: response.data.recipientViewUrl,
        data: {
          ...response.data,
          documentUrl: envelopeData.document.fileUrl,
          cloudinaryPublicId: envelopeData.document.cloudinaryPublicId
        }
      };

    } catch (error) {
      console.error('Error sending to DocuSign via Zapier:', error);
      
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      
      // Don't throw error - we don't want to fail the paperwork process if DocuSign is down
      return {
        success: false,
        error: error.message,
        envelopeData: envelopeData // Return the prepared data for manual processing
      };
    }
  }

  /**
   * Handle DocuSign webhook callback from Zapier
   * @param {Object} webhookData - Webhook data from DocuSign
   * @returns {Promise<Object>} - Processing result
   */
  async handleDocuSignWebhook(webhookData) {
    console.log('=== DOCUSIGN WEBHOOK RECEIVED ===');
    console.log('Webhook data:', webhookData);

    try {
      const {
        event,
        envelopeId,
        caseId,
        status,
        signedDocuments,
        completedAt
      } = webhookData;

      // Update case with DocuSign information
      const Case = require('../models/Case');
      const Transaction = require('../models/Transaction');

      const caseData = await Case.findById(caseId);
      if (!caseData) {
        throw new Error(`Case not found: ${caseId}`);
      }

      // Update transaction with DocuSign data
      if (caseData.transaction) {
        await Transaction.findByIdAndUpdate(caseData.transaction, {
          $set: {
            'docusign.envelopeId': envelopeId,
            'docusign.status': status,
            'docusign.completedAt': completedAt,
            'docusign.signedDocuments': signedDocuments,
            'docusign.event': event
          }
        });
      }

      // Update case status based on DocuSign event
      let caseStatus = caseData.status;
      if (event === 'completed') {
        caseStatus = 'completed';
      } else if (event === 'declined') {
        caseStatus = 'cancelled';
      }

      await Case.findByIdAndUpdate(caseId, {
        $set: {
          status: caseStatus,
          'lastActivity': {
            description: `DocuSign envelope ${event}: ${envelopeId}`,
            timestamp: new Date()
          }
        }
      });

      console.log('Case updated successfully with DocuSign data');
      
      return {
        success: true,
        caseId,
        envelopeId,
        status,
        event
      };

    } catch (error) {
      console.error('Error handling DocuSign webhook:', error);
      throw error;
    }
  }
}

module.exports = new DocuSignService();
