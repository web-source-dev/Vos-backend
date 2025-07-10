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
    
    // Add customer source information to the table data
    const customerTableData = [
      ['Source', getSourceLabel(customer.source) || 'Not specified'],
    ];
    
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
  doc.moveDown(1.5);

  // Date
  const saleDate = billOfSale.saleDate ? moment(billOfSale.saleDate).format('YYYY-MM-DD') : moment().format('YYYY-MM-DD');
  doc.fontSize(12).text(`This Bill of Sale is made and entered into on ${saleDate}, by and between the following parties:`);
  doc.moveDown(1.5);

  // 1. Seller Information
  doc.fontSize(16).text('1. Seller Information', {underline: true});
  doc.moveDown(0.5);
  doc.fontSize(12);
  doc.text(`Full Legal Name(s):`);
  doc.text(`${billOfSale.sellerName || customer.firstName + ' ' + customer.lastName || 'Not Provided'}`, {indent: 10});
  doc.moveDown(0.8);
  
  doc.text(`Address:`);
  doc.text(`${billOfSale.sellerAddress || 'Not Provided'}`, {indent: 10});
  doc.text(`${billOfSale.sellerCity || 'Not Provided'}, ${billOfSale.sellerState || 'Not Provided'}, ${billOfSale.sellerZip || 'Not Provided'}`, {indent: 10});
  doc.moveDown(0.8);
  
  doc.text(`Driver's License/ID Number:`);
  doc.text(`${billOfSale.sellerDLNumber || 'Not Provided'}`, {indent: 10});
  doc.moveDown(0.8);
  
  doc.text(`Issuing State: ${billOfSale.sellerDLState || 'Not Provided'}`);
  doc.moveDown(0.8);
  
  doc.text(`Contact Phone Number:`);
  doc.text(`${billOfSale.sellerPhone || customer.cellPhone || 'Not Provided'}`, {indent: 10});
  doc.moveDown(0.8);
  
  doc.text(`Email Address:`);
  doc.text(`${billOfSale.sellerEmail || customer.email1 || 'Not Provided'}`, {indent: 10});
  doc.moveDown(1.5);

  // 2. Buyer Information
  doc.fontSize(16).text('2. Buyer Information', {underline: true});
  doc.moveDown(0.5);
  doc.fontSize(12);
  doc.text(`Buyer Name: VOS (VIN On Spot)`);
  doc.text(`Agent Name: ${billOfSale.agentName || 'Not Specified'}`, {indent: 10});
  doc.moveDown(0.8);
  
  doc.text(`Address:`);
  doc.text(`${billOfSale.buyerAddress || '123 Business Ave'}`, {indent: 10});
  doc.text(`${billOfSale.buyerCity || 'Business City'}, ${billOfSale.buyerState || 'BC'}, ${billOfSale.buyerZip || '12345'}`, {indent: 10});
  doc.moveDown(1.5);

  // 3. Vehicle Information
  doc.fontSize(16).text('3. Vehicle Information', {underline: true});
  doc.moveDown(0.5);
  doc.fontSize(12);
  doc.text(`The Seller hereby sells, transfers, and conveys to the Buyer the following vehicle:`);
  doc.moveDown(0.8);
  
  doc.text(`Year: ${billOfSale.vehicleYear || vehicle.year || 'Not Provided'}`, {indent: 10});
  doc.text(`Make: ${billOfSale.vehicleMake || vehicle.make || 'Not Provided'}`, {indent: 10});
  doc.text(`Model: ${billOfSale.vehicleModel || vehicle.model || 'Not Provided'}`, {indent: 10});
  doc.text(`VIN (Vehicle Identification Number): ${billOfSale.vehicleVIN || vehicle.vin || 'Not Provided'}`, {indent: 10});
  doc.text(`Odometer Reading: ${billOfSale.odometerReading || vehicle.currentMileage || 'Not Provided'} ${billOfSale.odometerAccurate ? '(Actual mileage)' : '(Not Actual mileage)'}`, {indent: 10});
  doc.text(`License Plate Number: ${billOfSale.vehicleLicensePlate || vehicle.licensePlate || 'Not Provided'}`, {indent: 10});
  doc.text(`Title Status (as represented by Seller): ${billOfSale.titleStatus || vehicle.titleStatus || 'Clean'}`, {indent: 10});
  doc.moveDown(0.8);
  
  doc.text(`Any known significant defects or issues (as disclosed by Seller):`);
  doc.text(billOfSale.knownDefects || vehicle.knownDefects || 'None known', {indent: 10});
  doc.moveDown(1.5);

  // 4. Sale Terms and Payment
  doc.fontSize(16).text('4. Sale Terms and Payment', {underline: true});
  doc.moveDown(0.5);
  doc.fontSize(12);
  doc.text(`Purchase Price: $${(billOfSale.salePrice || 0).toLocaleString()} Dollars (USD)`, {indent: 10});
  doc.text(`Payment Method: ${billOfSale.paymentMethod || 'Not Specified'}`, {indent: 10});
  doc.text(`Payment Date: ${saleDate}`, {indent: 10});
  doc.moveDown(0.5);
  doc.text(`The Seller acknowledges receipt of the full purchase price from the Buyer.`);
  doc.moveDown(1.5);

  // 5. Exchange of Ownership and Possession
  doc.fontSize(16).text('5. Exchange of Ownership and Possession', {underline: true});
  doc.moveDown(0.5);
  doc.fontSize(12);
  doc.text(`The Seller agrees to transfer ownership and possession of the above-described vehicle to the Buyer in exchange for the agreed-upon consideration, which can be in one of the following forms (please check applicable):`);
  doc.moveDown(0.8);

  // Payment type checkboxes
  const paymentMethod = billOfSale.paymentMethod ? billOfSale.paymentMethod.toLowerCase() : '';
  doc.text(`${paymentMethod === 'cash' ? '☑' : '☐'} Cash Payment: The full purchase price will be paid to the Seller in cash.`, {indent: 10});
  doc.text(`${paymentMethod === 'check' ? '☑' : '☐'} Check: A check for the full purchase price will be issued to the Seller.`, {indent: 10});
  doc.text(`${(paymentMethod === 'wire transfer' || paymentMethod === 'ach' || paymentMethod === 'wire' || paymentMethod === 'bank transfer') ? '☑' : '☐'} Wire Transfer/ACH: The full purchase price will be transferred electronically to the Seller's designated bank account.`, {indent: 10});
  doc.text(`${paymentMethod === 'trade' ? '☑' : '☐'} Trade: The vehicle is exchanged for another vehicle or goods of agreed-upon value.`, {indent: 10});
  doc.text(`${paymentMethod === 'gift' ? '☑' : '☐'} Gift: The vehicle is transferred as a gift, with no monetary exchange.`, {indent: 10});
  doc.text(`${['cash', 'check', 'wire transfer', 'ach', 'wire', 'bank transfer', 'trade', 'gift'].includes(paymentMethod) ? '☐' : '☑'} Other: ${['cash', 'check', 'wire transfer', 'ach', 'wire', 'bank transfer', 'trade', 'gift'].includes(paymentMethod) ? '' : billOfSale.paymentMethod || ''}`, {indent: 10});
  doc.moveDown(1.5);

  // 6. Itemization of Purchase
  doc.fontSize(16).text('6. Itemization of Purchase', {underline: true});
  doc.moveDown(0.5);
  doc.fontSize(12);
  const basePrice = billOfSale.baseVehiclePrice || billOfSale.salePrice || 0;
  const adjustment = billOfSale.repairsAdjustment || 0;
  const loanPayoff = billOfSale.loanPayoff || 0;
  const totalPrice = basePrice - adjustment - loanPayoff;
  
  doc.text(`Base Vehicle Price: $${basePrice.toLocaleString()}`, {indent: 10});
  doc.text(`Less: Repairs/Reconditioning Adjustment: -$${adjustment.toLocaleString()}`, {indent: 10});
  doc.text(`Less: Outstanding Loan Payoff (if applicable): -$${loanPayoff.toLocaleString()}`, {indent: 10});
  doc.text(`Total Purchase Price: $${totalPrice.toLocaleString()}`, {indent: 10, continued: false});
  doc.moveDown(1.5);

  // 7. Taxes
  doc.fontSize(16).text('7. Taxes', {underline: true});
  doc.moveDown(0.5);
  doc.fontSize(12);
  doc.text(`All municipal, county, and state taxes in relation to the sale of the Vehicle, including sales taxes, shall be paid by (please check one):`);
  doc.moveDown(0.8);
  
  const taxesPaidBy = billOfSale.taxesPaidBy || 'buyer'; // Default to buyer
  doc.text(`${taxesPaidBy.toLowerCase() === 'buyer' ? '☑' : '☐'} Buyer: And are not included as part of the exchange price.`, {indent: 10});
  doc.text(`${taxesPaidBy.toLowerCase() === 'seller' ? '☑' : '☐'} Seller: And are included as part of the exchange price.`, {indent: 10});
  doc.moveDown(1.5);

  // 8. Seller's Representations and Warranties
  doc.fontSize(16).text('8. Seller\'s Representations and Warranties', {underline: true});
  doc.moveDown(0.5);
  doc.fontSize(12);
  doc.text(`The Seller hereby certifies that:`);
  doc.moveDown(0.5);
  
  doc.text(`• The Seller is the legal owner of the vehicle and has the full right and authority to sell and transfer it.`, {indent: 10});
  doc.text(`• The vehicle is free from all liens, encumbrances, and claims, except as explicitly disclosed to the Buyer (e.g., outstanding loan as detailed in intake).`, {indent: 10});
  doc.text(`• The information provided in this Bill of Sale is true and accurate to the best of the Seller's knowledge.`, {indent: 10});
  doc.moveDown(1.5);

  // 9. Transfer of Ownership and Condition
  doc.fontSize(16).text('9. Transfer of Ownership and Condition', {underline: true});
  doc.moveDown(0.5);
  doc.fontSize(12);
  doc.text(`The Seller agrees to transfer full ownership of the above-described vehicle to VOS upon receipt of the full purchase price and completion of all required documentation, including the vehicle title.`, {continued: false});
  doc.moveDown(0.8);
  
  doc.text(`The vehicle is sold in "AS-IS, WHERE-IS" condition, unless otherwise specified in a separate written agreement. The Buyer acknowledges that they have had the opportunity to inspect the vehicle (via VOS's inspection process).`, {continued: false});
  doc.moveDown(1.5);

  // 10. Acknowledgment of Title Transfer Requirement
  doc.fontSize(16).text('10. Acknowledgment of Title Transfer Requirement', {underline: true});
  doc.moveDown(0.5);
  doc.fontSize(12);
  doc.text(`The Seller understands and acknowledges that the official transfer of vehicle ownership to VOS is contingent upon the Seller providing a valid, clear, and transferable vehicle title within 48 hours of accepting VOS's offer. Failure to provide the title within this timeframe may result in the voiding of the current offer and potentially require a new inspection and renegotiation of the purchase price.`);
  doc.moveDown(1.5);

  // 11. Signatures
  doc.fontSize(16).text('11. Signatures', {underline: true});
  doc.moveDown(0.5);
  doc.fontSize(12);
  doc.text(`By signing below, the parties agree to all terms and conditions set forth in this Bill of Sale. This document authorizes the Buyer's and Seller's signatures below.`);
  doc.moveDown(1.5);
  
  // Signature section with lines
  doc.text(`SELLER(S):`);
  doc.moveDown();
  
  // First signature with underline
  doc.text(`Signature: `, {continued: true});
  doc.text(`_______________________________`, {underline: true});
  doc.moveDown(0.5);
  doc.text(`${billOfSale.sellerName || customer.firstName + ' ' + customer.lastName || '[Seller\'s Printed Name]'}`);
  doc.moveDown(0.5);
  doc.text(`Date: `, {continued: true});
  doc.text(`____________________`, {underline: true});
  doc.moveDown(1.5);
  
  // Co-owner signature with underline
  doc.text(`Signature (If applicable, for co-owner): `, {continued: true});
  doc.text(`_______________________________`, {underline: true});
  doc.moveDown(0.5);
  doc.text(`[Co-Seller's Printed Name]`);
  doc.moveDown(0.5);
  doc.text(`Date: `, {continued: true});
  doc.text(`____________________`, {underline: true});
  doc.moveDown(1.5);
  
  // Buyer signature section
  doc.text(`FOR VOS (BUYER):`);
  doc.moveDown();
  
  // VOS representative signature with underline
  doc.text(`Authorized Signature: `, {continued: true});
  doc.text(`_______________________________`, {underline: true});
  doc.moveDown(0.5);
  doc.text(`${billOfSale.agentName || '[Printed Name and Title of VOS Representative]'}`);
  doc.moveDown(0.5);
  doc.text(`Date: `, {continued: true});
  doc.text(`____________________`, {underline: true});
  doc.moveDown();
}

/**
 * Helper function to convert source code to human-readable label
 * @param {String} sourceKey - The source key from the customer object
 * @returns {String} - The human-readable label for the source
 */
function getSourceLabel(sourceKey) {
  if (!sourceKey) return null;
  
  const sources = {
    "contact_form": "Contact Us Form Submission",
    "walk_in": "Walk-In",
    "phone": "Phone",
    "online": "Online",
    "on_the_road": "On the Road",
    "social_media": "Social Media",
    "other": "Other"
  };
  
  return sources[sourceKey] || sourceKey;
}


module.exports = {
  generateBillOfSalePDF,
  generateSignedBillOfSalePDF,
  generateCasePDF,
};
