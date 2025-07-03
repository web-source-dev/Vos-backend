const PDFDocument = require('pdfkit');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const moment = require('moment');
const { PDFDocument: PDFLib } = require('pdf-lib');
const axios = require('axios');


/**
 * Generate a PDF Bill of Sale using the template and data
 * @param {Object} caseData - The case data containing customer, vehicle and transaction info
 * @returns {Promise<Object>} - Promise resolving to the PDF file path and name
 */
function generateBillOfSalePDF(caseData) {
  try {
    // Create upload directory if it doesn't exist
    const pdfDir = path.join(__dirname, '../../uploads/pdfs');
    fsp.mkdir(pdfDir, { recursive: true });

    // Create a unique filename
    const fileName = `bill-of-sale-${caseData._id}-${Date.now()}.pdf`;
    const filePath = path.join(pdfDir, fileName);

    // Get the required data
    const customer = caseData.customer || {};
    const vehicle = caseData.vehicle || {};
    const transaction = caseData.transaction || {};
    const billOfSale = transaction.billOfSale || {};

    // Create a new PDF document
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: {
        top: 50,
        bottom: 50,
        left: 50,
        right: 50
      }
    });

    // Pipe the PDF into a file
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Add content to the PDF
    addBillOfSaleContent(doc, customer, vehicle, billOfSale);

    // Finalize the PDF and end the stream
    doc.end();

    // Wait for the stream to finish
    return new Promise((resolve, reject) => {
      stream.on('finish', () => {
        resolve({
          filePath,
          fileName
        });
      });
      stream.on('error', reject);
    });
  } catch (error) {
    console.error('Error generating Bill of Sale PDF:', error);
    throw error;
  }
};

/**
 * Generate a signed PDF Bill of Sale
 * @param {Object} caseData - The case data
 * @param {String} signatureData - Base64 encoded signature
 * @param {Date} signedAt - When the document was signed
 * @returns {Promise<Object>} - Promise resolving to the PDF file path and name
 */
function generateSignedBillOfSalePDF(caseData, signatureData, signedAt) {
  try {
    // Create upload directory if it doesn't exist
    const pdfDir = path.join(__dirname, '../../uploads/pdfs');
    fsp.mkdir(pdfDir, { recursive: true });

    // Create a unique filename
    const fileName = `signed-bill-of-sale-${caseData._id}-${Date.now()}.pdf`;
    const filePath = path.join(pdfDir, fileName);

    // Get the required data
    const customer = caseData.customer || {};
    const vehicle = caseData.vehicle || {};
    const transaction = caseData.transaction || {};
    const billOfSale = transaction.billOfSale || {};

    // Create a new PDF document
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: {
        top: 50,
        bottom: 50,
        left: 50,
        right: 50
      }
    });

    // Pipe the PDF into a file
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Add content to the PDF
    addBillOfSaleContent(doc, customer, vehicle, billOfSale);

    // Add signature image
    if (signatureData) {
      try {
        // Remove data URL prefix if present
        const imgData = signatureData.includes('data:image') 
          ? signatureData.split(',')[1] 
          : signatureData;

        doc.moveDown(2);
        doc.fontSize(12).text('Seller\'s Signature:', {continued: false});
        doc.image(Buffer.from(imgData, 'base64'), {
          fit: [200, 100],
          align: 'left'
        });
        
        // Add signature date
        const formattedDate = moment(signedAt).format('MMMM D, YYYY [at] h:mm A');
        doc.moveDown(0.5);
        doc.fontSize(10).text(`Signed on: ${formattedDate}`);
      } catch (err) {
        console.error('Error adding signature to PDF:', err);
        doc.fontSize(12).text('Error rendering signature', {color: 'red'});
      }
    }

    // Add "SIGNED" watermark
    doc.save();
    doc.fontSize(60);
    doc.fillColor('rgba(220, 53, 69, 0.3)');
    doc.rotate(45, {origin: [300, 400]});
    doc.text('SIGNED', 150, 400);
    doc.restore();

    // Finalize the PDF and end the stream
    doc.end();

    // Wait for the stream to finish
    return new Promise((resolve, reject) => {
      stream.on('finish', () => {
        resolve({
          filePath,
          fileName
        });
      });
      stream.on('error', reject);
    });
  } catch (error) {
    console.error('Error generating signed Bill of Sale PDF:', error);
    throw error;
  }
};

/**
 * Generate complete case PDF with all documents
 * @param {Object} caseData - The case data containing all information
 * @returns {Promise<Object>} - Promise resolving to the PDF file path and name
 */
function generateCasePDF(caseData) {
  try {
    // Create upload directory if it doesn't exist
    const pdfDir = path.join(__dirname, '../../uploads/pdfs');
    fsp.mkdir(pdfDir, { recursive: true });

    // Create a unique filename
    const fileName = `case-${caseData._id}-${Date.now()}.pdf`;
    const filePath = path.join(pdfDir, fileName);

    // Get the required data
    const customer = caseData.customer || {};
    const vehicle = caseData.vehicle || {};
    const inspection = caseData.inspection || {};
    const quote = caseData.quote || {};
    const transaction = caseData.transaction || {};

    // Create a new PDF document
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: {
        top: 50,
        bottom: 50,
        left: 50,
        right: 50
      }
    });

    // Pipe the PDF into a file
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Add case overview
    doc.fontSize(20).text('Vehicle Offer Service - Case Summary', {align: 'center'});
    doc.moveDown();
    doc.fontSize(12).text(`Case ID: ${caseData._id}`);
    doc.text(`Created: ${moment(caseData.createdAt).format('MMMM D, YYYY')}`);
    doc.text(`Status: ${caseData.status}`);
    doc.moveDown();
    
    // Add customer section
    doc.fontSize(16).text('Customer Information', {underline: true});
    doc.fontSize(12).text(`Name: ${customer.firstName || ''} ${customer.lastName || ''}`);
    doc.text(`Phone: ${customer.cellPhone || ''}`);
    doc.text(`Email: ${customer.email1 || ''}`);
    doc.moveDown();
    
    // Add vehicle section
    doc.fontSize(16).text('Vehicle Information', {underline: true});
    doc.fontSize(12).text(`Year: ${vehicle.year || ''}`);
    doc.text(`Make: ${vehicle.make || ''}`);
    doc.text(`Model: ${vehicle.model || ''}`);
    doc.text(`VIN: ${vehicle.vin || ''}`);
    doc.text(`Mileage: ${vehicle.currentMileage || ''}`);
    doc.text(`Color: ${vehicle.color || ''}`);
    doc.moveDown();
    
    // Add transaction details
    if (transaction && transaction.billOfSale) {
      doc.fontSize(16).text('Transaction Details', {underline: true});
      doc.fontSize(12).text(`Sale Price: $${(transaction.billOfSale.salePrice || 0).toLocaleString()}`);
      doc.text(`Sale Date: ${transaction.billOfSale.saleDate ? moment(transaction.billOfSale.saleDate).format('MMMM D, YYYY') : 'Not completed'}`);
      doc.text(`Payment Method: ${transaction.billOfSale.paymentMethod || 'Not specified'}`);
      doc.moveDown();
    }
    
    // Add bill of sale
    doc.addPage();
    addBillOfSaleContent(doc, customer, vehicle, transaction.billOfSale || {});
    
    // Add inspection summary if available
    if (inspection && inspection.sections && inspection.sections.length > 0) {
      doc.addPage();
      doc.fontSize(18).text('Vehicle Inspection Summary', {align: 'center'});
      doc.moveDown();
      doc.fontSize(12).text(`Overall Rating: ${inspection.overallRating || 'N/A'}/5`);
      doc.text(`Completed on: ${inspection.completedAt ? moment(inspection.completedAt).format('MMMM D, YYYY') : 'Not completed'}`);
      doc.moveDown();
      
      inspection.sections.forEach(section => {
        doc.fontSize(14).text(section.name);
        doc.fontSize(12).text(`Rating: ${section.rating || 'N/A'}/5`);
        doc.moveDown(0.5);
      });
    }
    
    // Finalize the PDF and end the stream
    doc.end();

    // Wait for the stream to finish
    return new Promise((resolve, reject) => {
      stream.on('finish', () => {
        resolve({
          filePath,
          fileName
        });
      });
      stream.on('error', reject);
    });
  } catch (error) {
    console.error('Error generating Case PDF:', error);
    throw error;
  }
};

/**
 * Helper function to add Bill of Sale content to a PDF document
 * @param {PDFDocument} doc - The PDFKit document instance
 * @param {Object} customer - Customer data
 * @param {Object} vehicle - Vehicle data
 * @param {Object} billOfSale - Bill of Sale data
 */
function addBillOfSaleContent(doc, customer, vehicle, billOfSale) {
  // Header
  doc.fontSize(20).text('VEHICLE BILL OF SALE', {align: 'center'});
  doc.moveDown();

  // Date and Transaction ID
  const currentDate = moment().format('MMMM D, YYYY');
  doc.fontSize(12).text(`Date: ${billOfSale.saleDate ? moment(billOfSale.saleDate).format('MMMM D, YYYY') : currentDate}`, {align: 'right'});
  doc.fontSize(12).text(`Transaction ID: ${billOfSale._id || 'Not Assigned'}`, {align: 'right'});
  doc.moveDown();

  // Seller Information
  doc.fontSize(16).text('SELLER INFORMATION', {underline: true});
  doc.fontSize(12);
  doc.text(`Name: ${billOfSale.sellerName || customer.firstName + ' ' + customer.lastName || 'Not Provided'}`);
  doc.text(`Address: ${billOfSale.sellerAddress || 'Not Provided'}`);
  doc.text(`City: ${billOfSale.sellerCity || 'Not Provided'}`);
  doc.text(`State: ${billOfSale.sellerState || 'Not Provided'}`);
  doc.text(`ZIP: ${billOfSale.sellerZip || 'Not Provided'}`);
  doc.text(`Phone: ${billOfSale.sellerPhone || customer.cellPhone || 'Not Provided'}`);
  doc.text(`Email: ${billOfSale.sellerEmail || customer.email1 || 'Not Provided'}`);
  doc.text(`Driver's License #: ${billOfSale.sellerDLNumber || 'Not Provided'}`);
  doc.text(`Driver's License State: ${billOfSale.sellerDLState || 'Not Provided'}`);
  doc.moveDown();

  // Buyer Information
  doc.fontSize(16).text('BUYER INFORMATION', {underline: true});
  doc.fontSize(12);
  doc.text(`Name: ${billOfSale.buyerName || 'VOS - Vehicle Offer Service'}`);
  doc.text(`Address: ${billOfSale.buyerAddress || '123 Business Ave'}`);
  doc.text(`City: ${billOfSale.buyerCity || 'Business City'}`);
  doc.text(`State: ${billOfSale.buyerState || 'BC'}`);
  doc.text(`ZIP: ${billOfSale.buyerZip || '12345'}`);
  doc.text(`Business License: ${billOfSale.buyerBusinessLicense || 'VOS-12345-AB'}`);
  doc.moveDown();

  // Vehicle Information
  doc.fontSize(16).text('VEHICLE INFORMATION', {underline: true});
  doc.fontSize(12);
  doc.text(`Year: ${billOfSale.vehicleYear || vehicle.year || 'Not Provided'}`);
  doc.text(`Make: ${billOfSale.vehicleMake || vehicle.make || 'Not Provided'}`);
  doc.text(`Model: ${billOfSale.vehicleModel || vehicle.model || 'Not Provided'}`);
  doc.text(`VIN: ${billOfSale.vehicleVIN || vehicle.vin || 'Not Provided'}`);
  doc.text(`Color: ${billOfSale.vehicleColor || vehicle.color || 'Not Provided'}`);
  doc.text(`Body Style: ${billOfSale.vehicleBodyStyle || vehicle.bodyStyle || 'Not Provided'}`);
  doc.text(`License Plate: ${billOfSale.vehicleLicensePlate || vehicle.licensePlate || 'Not Provided'}`);
  doc.text(`License State: ${billOfSale.vehicleLicenseState || vehicle.licenseState || 'Not Provided'}`);
  doc.text(`Title Number: ${billOfSale.vehicleTitleNumber || vehicle.titleNumber || 'Not Provided'}`);
  doc.text(`Current Odometer: ${billOfSale.odometerReading || vehicle.currentMileage || 'Not Provided'} miles`);
  doc.moveDown();

  // Sale Information
  doc.fontSize(16).text('SALE INFORMATION', {underline: true});
  doc.fontSize(12);
  doc.text(`Sale Price: $${(billOfSale.salePrice || 0).toLocaleString()}`);
  doc.text(`Payment Method: ${billOfSale.paymentMethod || 'Not Specified'}`);
  doc.moveDown();

  // Title & Odometer Disclosure
  doc.fontSize(16).text('TITLE & ODOMETER DISCLOSURE', {underline: true});
  doc.fontSize(12);
  doc.text(`Title Status: ${billOfSale.titleStatus || vehicle.titleStatus || 'Clean'}`);
  doc.text(`Odometer Reading: ${billOfSale.odometerReading || vehicle.currentMileage || 'Not Provided'} miles`);
  doc.text(`Odometer Accuracy: ${billOfSale.odometerAccurate ? 'Actual Mileage' : 'Not Actual Mileage - Odometer Discrepancy'}`);
  doc.moveDown();

  // Known Defects
  doc.fontSize(16).text('KNOWN DEFECTS', {underline: true});
  doc.fontSize(12);
  doc.text(billOfSale.knownDefects || vehicle.knownDefects || 'No defects disclosed');
  doc.moveDown();

  // Seller Certification
  doc.fontSize(16).text('SELLER CERTIFICATION', {underline: true});
  doc.fontSize(12);
  doc.text('I, the undersigned seller, certify that:');
  doc.text('1. I am the legal owner of the vehicle described above');
  doc.text('2. The vehicle is free of all liens and encumbrances');
  doc.text('3. All information provided is true and accurate to the best of my knowledge');
  doc.text('4. I understand this vehicle is being sold "AS IS" with no warranties or guarantees');
  doc.moveDown(2);

  // Signature lines
  doc.fontSize(12).text('Seller Signature: ________________________________', {align: 'left'});
  doc.moveDown();
  doc.text('Date: ________________________________', {align: 'left'});
  doc.moveDown(2);

  // Buyer Signature
  doc.fontSize(12).text('Buyer Signature: ________________________________', {align: 'left'});
  doc.moveDown();
  doc.text('Date: ________________________________', {align: 'left'});

  // If notary required
  if (billOfSale.notaryRequired) {
    doc.moveDown(2);
    doc.fontSize(16).text('NOTARY ACKNOWLEDGMENT', {underline: true});
    doc.fontSize(12);
    doc.text('State of _________________');
    doc.text('County of _________________');
    doc.moveDown();
    doc.text('On this ______ day of ____________, 20____, before me, ________________________,');
    doc.text('a Notary Public, personally appeared ________________________, known to me');
    doc.text('(or satisfactorily proven) to be the person whose name is subscribed to the within instrument,');
    doc.text('and acknowledged that he/she executed the same for the purposes therein contained.');
    doc.moveDown(2);
    doc.text('Notary Public Signature: ________________________________');
    doc.moveDown();
    doc.text('My Commission Expires: ________________________________');
  }

  // Legal footer
  doc.moveDown(2);
  doc.fontSize(10).text('This document represents a legal transfer of vehicle ownership. Both parties should retain a copy for their records.', {align: 'center'});
}


module.exports = {
  generateBillOfSalePDF,
  generateSignedBillOfSalePDF,
  generateCasePDF,
};
