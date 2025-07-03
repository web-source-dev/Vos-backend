const Case = require('../models/Case');
const SigningSession = require('../models/SigningSession');
const pdfService = require('../services/pdf');
const emailService = require('../services/email');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const { createCanvas, loadImage } = require('canvas');
const PDFDocument = require('pdf-lib').PDFDocument;
const { Transaction } = require('../models/Transaction');

// Create a new signing request
exports.createSigningRequest = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { recipientEmail, recipientName, documentType } = req.body;

    // Validate request
    if (!recipientEmail || !recipientName || !documentType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Find the case
    const caseData = await Case.findById(caseId)
      .populate('customer')
      .populate('vehicle')
      .populate('transaction');

    if (!caseData) {
      return res.status(404).json({
        success: false,
        error: 'Case not found'
      });
    }

    // Generate the document to be signed (Bill of Sale)
    let documentPath;
    
    if (documentType === 'bill-of-sale') {
      const pdfResult = await pdfService.generateBillOfSalePDF(caseData);
      documentPath = pdfResult.filePath;
      console.log('Generated Bill of Sale PDF:', documentPath);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Unsupported document type'
      });
    }

    // Create signing session
    const signingSession = await SigningSession.create({
      caseId: caseId,
      documentType,
      recipient: {
        name: recipientName,
        email: recipientEmail
      },
      documentUrl: documentPath,
      status: 'pending',
      createdBy: req.user.id
    });

    // Generate signing URL
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const signUrl = `${baseUrl}/sign/bill-of-sale/${signingSession.token}`;

    // Send email with signing link
    await emailService.sendDocumentForSigningEmail(
      recipientEmail,
      recipientName,
      caseData.vehicle,
      signUrl,
      documentType,
      signingSession.expiresAt
    );

    // Update signing session
    signingSession.status = 'sent';
    signingSession.emailSentAt = new Date();
    await signingSession.save();

    res.status(200).json({
      success: true,
      data: {
        signUrl,
        expiresAt: signingSession.expiresAt
      }
    });
  } catch (error) {
    console.error('Error creating signing request:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get signing session data for the signing page
exports.getSigningSession = async (req, res) => {
  try {
    const { token } = req.params;

    const signingSession = await SigningSession.findOne({ token })
      .populate({
        path: 'caseId',
        populate: [
          { path: 'customer' },
          { path: 'vehicle' },
          { path: 'transaction' }
        ]
      });

    if (!signingSession) {
      return res.status(404).json({
        success: false,
        error: 'Invalid or expired signing session'
      });
    }

    // Check if expired
    if (new Date() > new Date(signingSession.expiresAt)) {
      signingSession.status = 'expired';
      await signingSession.save();
      
      return res.status(400).json({
        success: false,
        error: 'This signing link has expired'
      });
    }

    // Mark as viewed if not already
    if (signingSession.status === 'sent') {
      signingSession.status = 'viewed';
      signingSession.viewedAt = new Date();
      await signingSession.save();
    }

    // Prepare document URL for frontend
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    let documentUrl;

    if (signingSession.documentUrl) {
      const documentFileName = path.basename(signingSession.documentUrl);
      documentUrl = `${baseUrl}/uploads/pdfs/${documentFileName}`;
      console.log('Document URL prepared:', documentUrl);
    }

    res.status(200).json({
      success: true,
      data: {
        session: {
          id: signingSession._id,
          token: signingSession.token,
          status: signingSession.status,
          documentType: signingSession.documentType,
          expiresAt: signingSession.expiresAt,
          createdAt: signingSession.createdAt
        },
        recipient: {
          name: signingSession.recipient.name,
          email: signingSession.recipient.email
        },
        case: {
          id: signingSession.caseId._id,
          customer: {
            firstName: signingSession.caseId.customer.firstName,
            lastName: signingSession.caseId.customer.lastName
          },
          vehicle: {
            year: signingSession.caseId.vehicle.year,
            make: signingSession.caseId.vehicle.make,
            model: signingSession.caseId.vehicle.model,
            vin: signingSession.caseId.vehicle.vin
          }
        },
        documentUrl
      }
    });
  } catch (error) {
    console.error('Error getting signing session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Submit a signed document
exports.submitSignedDocument = async (req, res) => {
  try {
    const { token } = req.params;
    const { signature, signedAt, position, signerType } = req.body;

    if (!signature) {
      return res.status(400).json({
        success: false,
        error: 'Signature is required',
      });
    }

    // Find the signing session
    const signingSession = await SigningSession.findOne({ token }).populate({
      path: 'caseId',
      populate: {
        path: 'transaction',
      },
    });

    if (!signingSession) {
      return res.status(404).json({
        success: false,
        error: 'Signing session not found',
      });
    }

    // Check if already signed
    if (signingSession.status === 'signed') {
      return res.status(400).json({
        success: false,
        error: 'Document already signed',
      });
    }

    try {
      // Process the signature and generate the signed PDF
      let signedDocumentPath;

      // If position data is provided, add signature directly to PDF
      if (position) {
        // Use a modified approach to embed signature directly into PDF
        // Prepare the data similar to what addSignatureToPdf expects
        const caseId = signingSession.caseId._id.toString();
        const pdfService = require('../services/pdf');
        
        // Get source PDF path (bill of sale)
        let sourcePdfPath = await pdfService.generateBillOfSalePDF(caseId, true); // true for path only
        if (typeof sourcePdfPath === 'object' && sourcePdfPath.filePath) {
          sourcePdfPath = sourcePdfPath.filePath;
        }
        if (typeof sourcePdfPath !== 'string') {
          console.error('Invalid PDF path:', sourcePdfPath);
          return res.status(500).json({ success: false, error: 'Internal error: Invalid PDF path' });
        }
        if (!fs.existsSync(sourcePdfPath)) {
          console.error('PDF file does not exist:', sourcePdfPath);
          return res.status(404).json({ success: false, error: 'PDF file not found' });
        }
        
        // Output file details
        const outputPdfName = `signed-bill-of-sale-${caseId}-${Date.now()}.pdf`;
        const outputDir = path.join(__dirname, '../../uploads/pdfs');
        const outputPath = path.join(outputDir, outputPdfName);

        // Ensure output directory exists
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        // Extract signature image data
        const signatureData64 = signature.split(',')[1];
        const signatureBuffer = Buffer.from(signatureData64, 'base64');
        const signatureImagePath = path.join(outputDir, `signature-${Date.now()}.png`);
        
        // Save signature image temporarily
        fs.writeFileSync(signatureImagePath, signatureBuffer);

        // Read the PDF file
        const pdfBuffer = fs.readFileSync(sourcePdfPath);
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        
        // Get the target page
        const pages = pdfDoc.getPages();
        const pageIndex = position.page >= 0 && position.page < pages.length ? position.page : 0;
        const page = pages[pageIndex];
        
        // Load signature image - Make sure we're passing a string path
        const signatureImgBuffer = fs.readFileSync(signatureImagePath);
        const signatureImg = await pdfDoc.embedPng(signatureImgBuffer);
        
        // Calculate signature size and position
        const { width: pageWidth, height: pageHeight } = page.getSize();
        const signatureWidth = 200; // You can adjust this based on your needs
        const signatureHeight = 100; // You can adjust this based on your needs
        
        // Calculate the actual position on the page using relative coordinates
        const signatureX = position.x * pageWidth;
        const signatureY = position.y * pageHeight;

        // Add signature to PDF
        page.drawImage(signatureImg, {
          x: signatureX,
          y: signatureY,
          width: signatureWidth,
          height: signatureHeight,
        });
        
        // Save the modified PDF
        const modifiedPdfBuffer = await pdfDoc.save();
        fs.writeFileSync(outputPath, modifiedPdfBuffer);
        
        // Clean up temporary signature image
        fs.unlinkSync(signatureImagePath);

        // Set the document path for further processing
        signedDocumentPath = `/uploads/pdfs/${outputPdfName}`;
      } else {
        // Legacy path - generate signed PDF with the old method
        const pdfService = require('../services/pdf');
        signedDocumentPath = await pdfService.generateSignedBillOfSale(
          signingSession.caseId._id,
          signature
        );
      }

      // Update session status
      signingSession.status = 'signed';
      signingSession.signedAt = signedAt || new Date();
      signingSession.signature = signature;
      await signingSession.save();

      // Update case transaction with the signed document path
      await updateTransactionWithSignedDocument(
        signingSession.caseId._id,
        signedDocumentPath
      );

      // Send the response
      return res.status(200).json({
        success: true,
        data: {
          status: 'signed',
          signedDocumentUrl: signedDocumentPath,
          signedAt: signingSession.signedAt,
        },
      });
    } catch (error) {
      console.error('Error processing signature:', error);
      return res.status(500).json({
        success: false,
        error: 'Error processing signature',
      });
    }
  } catch (error) {
    console.error('Error submitting signed document:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
};

// Get the status of a signing session
exports.getSigningStatus = async (req, res) => {
  try {
    const { token } = req.params;

    const signingSession = await SigningSession.findOne({ token }).select('status signedDocumentUrl signature');

    if (!signingSession) {
      return res.status(404).json({
        success: false,
        error: 'Invalid or expired signing session'
      });
    }

    // Prepare document URL if signed
    let signedDocumentUrl;
    if (signingSession.status === 'signed' && signingSession.signedDocumentUrl) {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const documentFileName = path.basename(signingSession.signedDocumentUrl);
      signedDocumentUrl = `${baseUrl}/uploads/pdfs/${documentFileName}`;
    }

    res.status(200).json({
      success: true,
      data: {
        status: signingSession.status,
        signedDocumentUrl,
        signedAt: signingSession.signature?.signedAt
      }
    });
  } catch (error) {
    console.error('Error getting signing status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Helper function to update transaction with signed document
async function updateTransactionWithSignedDocument(caseId, signedDocumentPath) {
  try {
    const caseData = await Case.findById(caseId);
    
    if (!caseData || !caseData.transaction) {
      console.log('No transaction found for case:', caseId);
      return;
    }

    // Get just the filename instead of the full path
    const fileName = path.basename(signedDocumentPath);
    console.log('Updating transaction with signed document:', fileName);

    // Update transaction documents
    const Transaction = require('../models/Transaction');
    await Transaction.findByIdAndUpdate(
      caseData.transaction,
      {
        'documents.signedBillOfSale': signedDocumentPath
      }
    );

    console.log('Transaction updated with signed document');
  } catch (error) {
    console.error('Error updating transaction with signed document:', error);
  }
}

// Get signing status by case ID
exports.getSigningStatusByCaseId = async (req, res) => {
  try {
    const { caseId } = req.params;
    
    // Get the most recent signing session for this case
    const session = await SigningSession.findOne({ caseId })
      .sort({ createdAt: -1 })
      .select('status signedDocumentUrl signature');
    
    if (!session) {
      return res.status(200).json({
        success: true,
        data: { status: 'none' }
      });
    }
    
    // If there's a signed document, prepare the URL
    let signedDocumentUrl;
    if (session.status === 'signed' && session.signedDocumentUrl) {
      const documentFileName = path.basename(session.signedDocumentUrl);
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      signedDocumentUrl = `${baseUrl}/uploads/pdfs/${documentFileName}`;
    }
    
    res.status(200).json({
      success: true,
      data: {
        status: session.status,
        signedDocumentUrl,
        signedAt: session.signature?.signedAt
      }
    });
  } catch (error) {
    console.error('Error checking signing status by case ID:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Add a signature directly to a PDF document
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
exports.addSignatureToPdf = async (req, res) => {
  try {
    const caseId = req.params.id;
    const signatureData = req.body;

    // Validate input
    if (!caseId) {
      return res.status(400).json({
        success: false,
        error: 'Case ID is required'
      });
    }

    if (!signatureData || !signatureData.signatureImage) {
      return res.status(400).json({
        success: false,
        error: 'Signature data is required'
      });
    }

    const position = signatureData.signaturePosition || { x: 0.5, y: 0.8, page: 0 };
    const signerType = signatureData.signerType || 'seller';
    const useCustomerSignedDocument = signatureData.useCustomerSignedDocument || false;

    // Find case
    const caseDoc = await Case.findById(caseId).populate('transaction');
    if (!caseDoc) {
      return res.status(404).json({
        success: false,
        error: 'Case not found'
      });
    }

    // Get transaction or create one if it doesn't exist
    let transaction = caseDoc.transaction;
    if (!transaction) {
      transaction = new Transaction({
        case: caseDoc._id,
        status: 'pending',
      });
      await transaction.save();
      caseDoc.transaction = transaction._id;
      await caseDoc.save();
    }

    // Get the source PDF (Bill of Sale)
    let sourcePdfPath;
    let outputPdfName;

    // Determine source PDF based on the request and available documents
    if (signerType === 'seller' && useCustomerSignedDocument && 
        transaction.documents && transaction.documents.signedBillOfSale) {
      // If seller is signing and we want to use the customer-signed document
      console.log('Using customer-signed document for seller signature');
      sourcePdfPath = path.join(__dirname, '../../', transaction.documents.signedBillOfSale);
      outputPdfName = `dual-signed-bill-of-sale-${caseId}-${Date.now()}.pdf`;
    } else if (signerType === 'customer' && transaction.documents && transaction.documents.signedBillOfSale) {
      // If customer is signing and we already have a seller-signed document, use that as source
      sourcePdfPath = path.join(__dirname, '../../', transaction.documents.signedBillOfSale);
      outputPdfName = `fully-signed-bill-of-sale-${caseId}-${Date.now()}.pdf`;
    } else {
      // Otherwise, generate a new bill of sale PDF
      const pdfService = require('../services/pdf');
      sourcePdfPath = await pdfService.generateBillOfSalePDF(caseId, true); // true for path only
      // Defensive: If the result is an object, extract filePath
      if (typeof sourcePdfPath === 'object' && sourcePdfPath.filePath) {
        sourcePdfPath = sourcePdfPath.filePath;
      }
      outputPdfName = `signed-bill-of-sale-${caseId}-${Date.now()}.pdf`;
    }
    
    // Defensive: Ensure sourcePdfPath is a string
    if (typeof sourcePdfPath !== 'string') {
      console.error('Invalid PDF path:', sourcePdfPath);
      return res.status(500).json({ success: false, error: 'Internal error: Invalid PDF path' });
    }
    if (!fs.existsSync(sourcePdfPath)) {
      console.error('PDF file does not exist:', sourcePdfPath);
      return res.status(404).json({ success: false, error: 'PDF file not found' });
    }

    // Create output path
    const outputDir = path.join(__dirname, '../../uploads/pdfs');
    const outputPath = path.join(outputDir, outputPdfName);

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Extract signature image data
    const signatureData64 = signatureData.signatureImage.split(',')[1];
    const signatureBuffer = Buffer.from(signatureData64, 'base64');
    const signatureImagePath = path.join(outputDir, `signature-${Date.now()}.png`);
    
    // Save signature image temporarily
    fs.writeFileSync(signatureImagePath, signatureBuffer);

    // Read the PDF file
    const pdfBuffer = fs.readFileSync(sourcePdfPath);
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    
    // Get the target page
    const pages = pdfDoc.getPages();
    const pageIndex = position.page >= 0 && position.page < pages.length ? position.page : 0;
    const page = pages[pageIndex];
    
    // Load signature image - Make sure we're passing a string path
    const signatureImgBuffer = fs.readFileSync(signatureImagePath);
    const signatureImg = await pdfDoc.embedPng(signatureImgBuffer);
    
    // Calculate signature size and position
    const { width: pageWidth, height: pageHeight } = page.getSize();
    const signatureWidth = 200; // You can adjust this based on your needs
    const signatureHeight = 100; // You can adjust this based on your needs
    
    // Calculate the actual position on the page using relative coordinates
    const signatureX = position.x * pageWidth;
    const signatureY = position.y * pageHeight;

    // Add signature to PDF
    page.drawImage(signatureImg, {
      x: signatureX,
      y: signatureY,
      width: signatureWidth,
      height: signatureHeight,
    });
    
    // Save the modified PDF
    const modifiedPdfBuffer = await pdfDoc.save();
    fs.writeFileSync(outputPath, modifiedPdfBuffer);
    
    // Clean up temporary signature image
    fs.unlinkSync(signatureImagePath);

    // Update transaction with the signed document path
    const documentPath = `/uploads/pdfs/${outputPdfName}`;
    
    // Update transaction data based on signer type and signing scenario
    if (signerType === 'customer') {
      transaction.documents = {
        ...transaction.documents,
        signedBillOfSale: documentPath,
        customerSignedAt: new Date()
      };
    } else if (signerType === 'seller' && useCustomerSignedDocument) {
      // This is a dual-signed document (customer signed first, then seller)
      transaction.documents = {
        ...transaction.documents,
        signedBillOfSale: documentPath,
        dualSignedBillOfSale: true,
        sellerSignedAt: new Date()
      };
    } else {
      // Default to seller signature only
      transaction.documents = {
        ...transaction.documents,
        signedBillOfSale: documentPath,
        sellerSignedAt: new Date()
      };
    }
    
    await transaction.save();

    // Return success response
    return res.status(200).json({
      success: true,
      data: {
        documentUrl: documentPath
      }
    });
  } catch (error) {
    console.error('Error adding signature to PDF:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to add signature to PDF'
    });
  }
}; 