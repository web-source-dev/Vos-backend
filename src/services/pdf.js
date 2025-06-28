const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Generate a comprehensive PDF case file with all the collected data
 * @param {Object} caseData - Complete case data with customer, vehicle, inspection, quote, and transaction
 * @returns {Promise<String>} - Path to the generated PDF file
 */
exports.generateCasePDF = async (caseData) => {
  return new Promise((resolve, reject) => {
    try {
      // Validate caseData
      if (!caseData) {
        throw new Error('Case data is required');
      }

      // Create PDF document with better margins and formatting
      const doc = new PDFDocument({ 
        margin: 30,
        size: 'A4',
        bufferPages: true, // Enable page buffering
        info: {
          Title: `VOS Case File - ${caseData._id || caseData.id || 'Unknown'}`,
          Author: 'Vehicle Offer Service',
          Subject: 'Complete Vehicle Purchase Case File',
          Keywords: 'vehicle, purchase, inspection, quote, transaction',
          CreationDate: new Date()
        }
      });
      
      // Set up file paths
      const uploadDir = path.join(__dirname, '../../uploads/pdfs');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      const fileName = `VOS_Case_${caseData._id || caseData.id || 'unknown'}_${Date.now()}.pdf`;
      const filePath = path.join(uploadDir, fileName);
      
      // Pipe PDF to writable stream
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Add header with logo and title
      addHeader(doc, caseData);
      
      // Add table of contents
      addTableOfContents(doc);
      
      // Add case overview
      addCaseOverview(doc, caseData);
      
      // Add customer information section
      addCustomerSection(doc, caseData);
      
      // Add vehicle information section
      addVehicleSection(doc, caseData);
      
      // Add inspection details section
      addInspectionSection(doc, caseData);
      
      // Add quote information section
      addQuoteSection(doc, caseData);
      
      // Add transaction details section
      addTransactionSection(doc, caseData);
      
      // Add documents section
      addDocumentsSection(doc, caseData);
      
      // Add timeline and activity log
      addTimelineSection(doc, caseData);
      
      // Finalize PDF before adding footer
      doc.end();
      
      // Handle stream completion
      stream.on('finish', () => {
        resolve({
          filePath,
          fileName
        });
      });
      
      // Handle stream errors
      stream.on('error', (error) => {
        reject(error);
      });
      
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Generate Bill of Sale PDF based on the VOS template
 * @param {Object} caseData - Complete case data with customer, vehicle, quote, and transaction
 * @returns {Promise<Object>} - Path to the generated PDF file
 */
exports.generateBillOfSalePDF = async (caseData) => {
  return new Promise((resolve, reject) => {
    try {
      // Validate caseData
      if (!caseData) {
        throw new Error('Case data is required');
      }

      // Create PDF document
      const doc = new PDFDocument({ 
        margin: 30, // Reduced from 40 to 30
        size: 'A4',
        bufferPages: true,
        info: {
          Title: `VOS Bill of Sale - ${caseData._id || caseData.id || 'Unknown'}`,
          Author: 'Vehicle Offer Service',
          Subject: 'Bill of Sale',
          Keywords: 'bill of sale, vehicle, transaction',
          CreationDate: new Date()
        }
      });
      
      // Set up file paths
      const uploadDir = path.join(__dirname, '../../uploads/pdfs');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      const fileName = `VOS_BillOfSale_${caseData._id || caseData.id || 'unknown'}_${Date.now()}.pdf`;
      const filePath = path.join(uploadDir, fileName);
      
      // Pipe PDF to writable stream
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Add Bill of Sale content
      addBillOfSaleContent(doc, caseData);
      
      // Finalize PDF
      doc.end();
      
      // Handle stream completion
      stream.on('finish', () => {
        resolve({
          filePath,
          fileName
        });
      });
      
      // Handle stream errors
      stream.on('error', (error) => {
        reject(error);
      });
      
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Generate HTML version of Bill of Sale for better PDF formatting
 */
function generateBillOfSaleHTML(caseData) {
  const customer = caseData.customer;
  const vehicle = caseData.vehicle;
  const quote = caseData.quote;
  const transaction = caseData.transaction;
  
  const currentDate = new Date().toISOString().split('T')[0];
  
  // Extract data
  const sellerName = transaction?.billOfSale?.sellerName || `${customer?.firstName || ''} ${customer?.lastName || ''}`.trim();
  const sellerAddress = transaction?.billOfSale?.sellerAddress || 'N/A';
  const sellerCity = transaction?.billOfSale?.sellerCity || 'N/A';
  const sellerState = transaction?.billOfSale?.sellerState || 'N/A';
  const sellerZip = transaction?.billOfSale?.sellerZip || 'N/A';
  const sellerDLNumber = transaction?.billOfSale?.sellerDLNumber || 'N/A';
  const sellerDLState = transaction?.billOfSale?.sellerDLState || 'N/A';
  const sellerPhone = transaction?.billOfSale?.sellerPhone || customer?.cellPhone || 'N/A';
  const sellerEmail = transaction?.billOfSale?.sellerEmail || customer?.email1 || 'N/A';
  
  const buyerName = transaction?.billOfSale?.buyerName || 'VOS (VIN On Spot)';
  const buyerAddress = transaction?.billOfSale?.buyerAddress || '123 Business Avenue';
  const buyerCity = transaction?.billOfSale?.buyerCity || 'Business City';
  const buyerState = transaction?.billOfSale?.buyerState || 'BC';
  const buyerZip = transaction?.billOfSale?.buyerZip || '12345';
  
  const vehicleYear = transaction?.billOfSale?.vehicleYear || vehicle?.year || 'N/A';
  const vehicleMake = transaction?.billOfSale?.vehicleMake || vehicle?.make || 'N/A';
  const vehicleModel = transaction?.billOfSale?.vehicleModel || vehicle?.model || 'N/A';
  const vehicleVIN = transaction?.billOfSale?.vehicleVIN || vehicle?.vin || 'N/A';
  const vehicleMileage = transaction?.billOfSale?.vehicleMileage || transaction?.billOfSale?.odometerReading || vehicle?.currentMileage || 'N/A';
  const vehicleLicensePlate = transaction?.billOfSale?.vehicleLicensePlate || vehicle?.licensePlate || 'N/A';
  const vehicleTitleStatus = transaction?.billOfSale?.vehicleTitleStatus || vehicle?.titleStatus || 'Clean';
  const knownDefects = transaction?.billOfSale?.knownDefects || vehicle?.knownDefects || 'None known';
  
  const salePrice = transaction?.billOfSale?.salePrice || quote?.offerAmount || 0;
  const paymentMethod = transaction?.billOfSale?.paymentMethod || 'ACH Transfer';
  const paymentDate = transaction?.billOfSale?.paymentDate || currentDate;
  
  const basePrice = salePrice;
  const adjustmentAmount = transaction?.billOfSale?.adjustmentAmount || 0;
  const loanPayoffAmount = transaction?.billOfSale?.loanPayoffAmount || vehicle?.loanAmount || 0;
  const totalPrice = basePrice - adjustmentAmount - loanPayoffAmount;
  
  const buyerRepName = transaction?.billOfSale?.buyerRepName || 'Agent Smith';
  const buyerRepTitle = transaction?.billOfSale?.buyerRepTitle || 'Authorized Representative';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vehicle Bill of Sale</title>
    <style>
        @page {
            size: A4;
            margin: 0.5in;
        }
        
        body {
            font-family: 'Times New Roman', serif;
            font-size: 11pt;
            line-height: 1.3;
            margin: 0;
            padding: 0;
            color: #000;
        }
        
        .header {
            text-align: center;
            margin-bottom: 20px;
        }
        
        .title {
            font-size: 18pt;
            font-weight: bold;
            margin-bottom: 10px;
        }
        
        .section {
            margin-bottom: 15px;
        }
        
        .section-title {
            font-size: 12pt;
            font-weight: bold;
            margin-bottom: 8px;
        }
        
        .field {
            margin-bottom: 6px;
        }
        
        .field-label {
            font-weight: bold;
            display: inline-block;
            width: 200px;
        }
        
        .field-value {
            display: inline-block;
        }
        
        .checkbox-list {
            margin: 8px 0;
        }
        
        .checkbox-item {
            margin-bottom: 4px;
        }
        
        .checkbox {
            display: inline-block;
            width: 12px;
            height: 12px;
            border: 1px solid #000;
            margin-right: 8px;
        }
        
        .signature-section {
            margin-top: 20px;
        }
        
        .signature-line {
            border-bottom: 1px solid #000;
            width: 200px;
            height: 20px;
            display: inline-block;
            margin-right: 20px;
        }
        
        .date-line {
            border-bottom: 1px solid #000;
            width: 100px;
            height: 20px;
            display: inline-block;
        }
        
        .footer {
            text-align: center;
            font-size: 8pt;
            color: #666;
            margin-top: 20px;
        }
        
        .page-break {
            page-break-before: always;
        }
        
        .itemization {
            margin: 10px 0;
        }
        
        .itemization-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 4px;
        }
        
        .itemization-label {
            flex: 1;
        }
        
        .itemization-value {
            text-align: right;
            width: 120px;
        }
        
        .total-row {
            font-weight: bold;
            border-top: 1px solid #000;
            padding-top: 4px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">VEHICLE BILL OF SALE</div>
    </div>
    
    <p>This Bill of Sale is made and entered into on [Date:${currentDate}], by and between the following parties:</p>
    
    <div class="section">
        <div class="section-title">1. Seller Information</div>
        <div class="field">
            <span class="field-label">Full Legal Name(s):</span>
            <span class="field-value">${sellerName}</span>
        </div>
        <div class="field">
            <span class="field-label">Address:</span>
            <span class="field-value">${sellerAddress}</span>
        </div>
        <div class="field">
            <span class="field-label"></span>
            <span class="field-value">${sellerCity}, ${sellerState}, ${sellerZip}</span>
        </div>
        <div class="field">
            <span class="field-label">Driver's License/ID Number:</span>
            <span class="field-value">${sellerDLNumber}</span>
        </div>
        <div class="field">
            <span class="field-label">Issuing State:</span>
            <span class="field-value">${sellerDLState}</span>
        </div>
        <div class="field">
            <span class="field-label">Contact Phone Number:</span>
            <span class="field-value">${sellerPhone}</span>
        </div>
        <div class="field">
            <span class="field-label">Email Address:</span>
            <span class="field-value">${sellerEmail}</span>
        </div>
    </div>
    
    <div class="section">
        <div class="section-title">2. Buyer Information</div>
        <div class="field">
            <span class="field-label">Buyer Name:</span>
            <span class="field-value">${buyerName}</span>
        </div>
        <div class="field">
            <span class="field-label">Address:</span>
            <span class="field-value">${buyerAddress}</span>
        </div>
        <div class="field">
            <span class="field-label"></span>
            <span class="field-value">${buyerCity}, ${buyerState}, ${buyerZip}</span>
        </div>
    </div>
    
    <div class="section">
        <div class="section-title">3. Vehicle Information</div>
        <p>The Seller hereby sells, transfers, and conveys to the Buyer the following vehicle:</p>
        <div class="field">
            <span class="field-label">Year:</span>
            <span class="field-value">${vehicleYear}</span>
        </div>
        <div class="field">
            <span class="field-label">Make:</span>
            <span class="field-value">${vehicleMake}</span>
        </div>
        <div class="field">
            <span class="field-label">Model:</span>
            <span class="field-value">${vehicleModel}</span>
        </div>
        <div class="field">
            <span class="field-label">VIN (Vehicle Identification Number):</span>
            <span class="field-value">${vehicleVIN}</span>
        </div>
        <div class="field">
            <span class="field-label">Odometer Reading:</span>
            <span class="field-value">${vehicleMileage} (Indicate if "Actual" or "Not Actual" mileage)</span>
        </div>
        <div class="field">
            <span class="field-label">License Plate Number (if applicable):</span>
            <span class="field-value">${vehicleLicensePlate}</span>
        </div>
        <div class="field">
            <span class="field-label">Title Status (as represented by Seller):</span>
            <span class="field-value">${vehicleTitleStatus}</span>
        </div>
        <div class="field">
            <span class="field-label">Any known significant defects or issues (as disclosed by Seller):</span>
            <span class="field-value">${knownDefects}</span>
        </div>
    </div>
    
    <div class="section">
        <div class="section-title">4. Sale Terms and Payment</div>
        <div class="field">
            <span class="field-label">Purchase Price:</span>
            <span class="field-value">$${salePrice.toLocaleString()} Dollars (USD)</span>
        </div>
        <div class="field">
            <span class="field-label">Payment Method:</span>
            <span class="field-value">${paymentMethod}</span>
        </div>
        <div class="field">
            <span class="field-label">Payment Date:</span>
            <span class="field-value">${paymentDate}</span>
        </div>
        <p>The Seller acknowledges receipt of the full purchase price from the Buyer.</p>
    </div>
    
    <div class="section">
        <div class="section-title">5. Exchange of Ownership and Possession</div>
        <p>The Seller agrees to transfer ownership and possession of the above-described vehicle to the Buyer in exchange for the agreed-upon consideration, which can be in one of the following forms (please check applicable):</p>
        <div class="checkbox-list">
            <div class="checkbox-item">
                <span class="checkbox"></span>Cash Payment: The full purchase price will be paid to the Seller in cash.
            </div>
            <div class="checkbox-item">
                <span class="checkbox"></span>Check: A check for the full purchase price will be issued to the Seller.
            </div>
            <div class="checkbox-item">
                <span class="checkbox"></span>Wire Transfer/ACH: The full purchase price will be transferred electronically to the Seller's designated bank account.
            </div>
            <div class="checkbox-item">
                <span class="checkbox"></span>Trade: The vehicle is exchanged for another vehicle or goods of agreed-upon value.
            </div>
            <div class="checkbox-item">
                <span class="checkbox"></span>Gift: The vehicle is transferred as a gift, with no monetary exchange.
            </div>
            <div class="checkbox-item">
                <span class="checkbox"></span>Other: [Specify other form of exchange, if applicable]
            </div>
        </div>
    </div>
    
    <div class="section">
        <div class="section-title">6. Itemization of Purchase</div>
        <div class="itemization">
            <div class="itemization-row">
                <span class="itemization-label">Base Vehicle Price:</span>
                <span class="itemization-value">$${basePrice.toLocaleString()}</span>
            </div>
            <div class="itemization-row">
                <span class="itemization-label">Less: Repairs/Reconditioning Adjustment:</span>
                <span class="itemization-value">-$${adjustmentAmount.toLocaleString()}</span>
            </div>
            <div class="itemization-row">
                <span class="itemization-label">Less: Outstanding Loan Payoff (if applicable):</span>
                <span class="itemization-value">-$${loanPayoffAmount.toLocaleString()}</span>
            </div>
            <div class="itemization-row total-row">
                <span class="itemization-label">Total Purchase Price:</span>
                <span class="itemization-value">$${totalPrice.toLocaleString()}</span>
            </div>
        </div>
    </div>
    
    <div class="section">
        <div class="section-title">7. Taxes</div>
        <p>All municipal, county, and state taxes in relation to the sale of the Vehicle, including sales taxes, shall be paid by (please check one):</p>
        <div class="checkbox-list">
            <div class="checkbox-item">
                <span class="checkbox"></span>Buyer: And are not included as part of the exchange price.
            </div>
            <div class="checkbox-item">
                <span class="checkbox"></span>Seller: And are included as part of the exchange price.
            </div>
        </div>
    </div>
    
    <div class="section">
        <div class="section-title">8. Seller's Representations and Warranties</div>
        <p>The Seller hereby certifies that:</p>
        <ul>
            <li>The Seller is the legal owner of the vehicle and has the full right and authority to sell and transfer it.</li>
            <li>The vehicle is free from all liens, encumbrances, and claims, except as explicitly disclosed to the Buyer (e.g., outstanding loan as detailed in intake).</li>
            <li>The information provided in this Bill of Sale is true and accurate to the best of the Seller's knowledge.</li>
        </ul>
    </div>
    
    <div class="section">
        <div class="section-title">9. Transfer of Ownership and Condition</div>
        <p>The Seller agrees to transfer full ownership of the above-described vehicle to VOS upon receipt of the full purchase price and completion of all required documentation, including the vehicle title.</p>
        <p>The vehicle is sold in "AS-IS, WHERE-IS" condition, unless otherwise specified in a separate written agreement. The Buyer acknowledges that they have had the opportunity to inspect the vehicle (via VOS's inspection process).</p>
    </div>
    
    <div class="section">
        <div class="section-title">10. Acknowledgment of Title Transfer Requirement</div>
        <p>The Seller understands and acknowledges that the official transfer of vehicle ownership to VOS is contingent upon the Seller providing a valid, clear, and transferable vehicle title within 48 hours of accepting VOS's offer. Failure to provide the title within this timeframe may result in the voiding of the current offer and potentially require a new inspection and renegotiation of the purchase price.</p>
    </div>
    
    <div class="section signature-section">
        <div class="section-title">11. Signatures</div>
        <p>By signing below, the parties agree to all terms and conditions set forth in this Bill of Sale. This document authorizes the Buyer's and Seller's signatures below.</p>
        
        <div style="margin-top: 20px;">
            <div style="font-weight: bold; margin-bottom: 10px;">SELLER(S):</div>
            <div style="margin-bottom: 15px;">
                <div>Signature</div>
                <div class="signature-line"></div>
                <div style="margin-top: 8px;">[${sellerName}]</div>
                <div style="margin-top: 8px;">Date: <span class="date-line"></span></div>
            </div>
            
            <div style="margin-bottom: 15px;">
                <div>Signature (If applicable, for co-owner)</div>
                <div class="signature-line"></div>
                <div style="margin-top: 8px;">[Seller's Printed Name]</div>
                <div style="margin-top: 8px;">Date: <span class="date-line"></span></div>
            </div>
        </div>
        
        <div style="margin-top: 20px;">
            <div style="font-weight: bold; margin-bottom: 10px;">FOR VOS (BUYER):</div>
            <div style="margin-bottom: 15px;">
                <div>Authorized Signature</div>
                <div class="signature-line"></div>
                <div style="margin-top: 8px;">[${buyerRepName} - ${buyerRepTitle}]</div>
                <div style="margin-top: 8px;">Date: <span class="date-line"></span></div>
            </div>
        </div>
    </div>
    
    <div class="footer">
        Generated by Vehicle Offer Service - Document ID: ${caseData._id || caseData.id || 'Unknown'}
    </div>
</body>
</html>`;

  return html;
}

/**
 * Add header with logo and title
 */
function addHeader(doc, caseData) {
  // Add company logo placeholder (you can replace with actual logo)
  doc.rect(40, 30, 50, 50).stroke(); // Reduced size and position
  doc.fontSize(10).text('VOS LOGO', 45, 55, { align: 'center' }); // Smaller font and adjusted position
  
  // Add title
  doc.fontSize(24).fillColor('#1e40af').text('Vehicle Offer Service', 110, 35); // Reduced font size and position
  doc.fontSize(16).fillColor('#374151').text('Complete Case File', 110, 60); // Reduced font size and position
  
  // Add case ID and date
  doc.fontSize(10).fillColor('#6b7280').text(`Case ID: ${caseData._id || caseData.id || 'Unknown'}`, 110, 80); // Reduced font size and position
  doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, 110, 95); // Reduced font size and position
  
  // Add horizontal line
  doc.moveTo(40, 110).lineTo(doc.page.width - 40, 110).stroke(); // Moved up
  doc.moveDown(1); // Reduced spacing
}

/**
 * Add table of contents
 */
function addTableOfContents(doc) {
  addSectionHeader(doc, 'Table of Contents', 130); // Reduced starting position
  
  const tocItems = [
    '1. Case Overview',
    '2. Customer Information',
    '3. Vehicle Details',
    '4. Inspection Report',
    '5. Quote & Pricing',
    '6. Transaction Details',
    '7. Documents & Attachments',
    '8. Timeline & Activity Log'
  ];
  
  tocItems.forEach((item, index) => {
    doc.fontSize(11).text(item, 60, 160 + (index * 16)); // Reduced font size and spacing
  });
  
  doc.moveDown(2); // Reduced spacing
}

/**
 * Add case overview section
 */
function addCaseOverview(doc, caseData) {
  addSectionHeader(doc, '1. Case Overview', doc.y + 10); // Reduced spacing
  
  const overviewData = [
    { label: 'Case ID', value: caseData._id || caseData.id || 'Unknown' },
    { label: 'Status', value: caseData.status || 'Unknown' },
    { label: 'Current Stage', value: `${caseData.currentStage || 1}/7` },
    { label: 'Priority', value: caseData.priority || 'Medium' },
    { label: 'Created Date', value: caseData.createdAt ? new Date(caseData.createdAt).toLocaleDateString() : 'Unknown' },
    { label: 'Last Activity', value: caseData.lastActivity?.timestamp ? new Date(caseData.lastActivity.timestamp).toLocaleDateString() : 'Unknown' }
  ];
  
  addInfoTable(doc, overviewData);
  
  // Add stage statuses
  if (caseData.stageStatuses) {
    doc.moveDown(0.5); // Reduced spacing
    doc.fontSize(13).fillColor('#374151').text('Stage Progress:', { underline: true }); // Reduced font size
    
    const stages = [
      '1. Customer Intake',
      '2. Inspection Scheduling',
      '3. Vehicle Inspection',
      '4. Quote Preparation',
      '5. Offer Decision',
      '6. Paperwork & Payment',
      '7. Case Completion'
    ];
    
    stages.forEach((stage, index) => {
      const stageNum = index + 1;
      const status = caseData.stageStatuses[stageNum] || 'pending';
      const statusColor = status === 'complete' ? '#059669' : status === 'active' ? '#3b82f6' : '#6b7280';
      
      doc.fontSize(9).fillColor('#374151').text(stage, 60, doc.y + 3); // Reduced font size and spacing
      doc.fontSize(9).fillColor(statusColor).text(`[${status.toUpperCase()}]`, 250, doc.y - 7); // Reduced font size and spacing
    });
  }
  
  doc.moveDown(1.5); // Reduced spacing
}

/**
 * Add customer information section
 */
function addCustomerSection(doc, caseData) {
  addSectionHeader(doc, '2. Customer Information', doc.y + 10); // Reduced spacing
  
  if (caseData.customer && typeof caseData.customer === 'object') {
    const customer = caseData.customer;
    
    // Personal Information
    doc.fontSize(13).fillColor('#374151').text('Personal Information:', { underline: true }); // Reduced font size
    const personalInfo = [
      { label: 'Full Name', value: `${customer.firstName || 'N/A'} ${customer.middleInitial || ''} ${customer.lastName || 'N/A'}`.trim() },
      { label: 'Cell Phone', value: customer.cellPhone || 'N/A' },
      { label: 'Home Phone', value: customer.homePhone || 'N/A' },
      { label: 'Primary Email', value: customer.email1 || 'N/A' },
      { label: 'Secondary Email', value: customer.email2 || 'N/A' },
      { label: 'Tertiary Email', value: customer.email3 || 'N/A' }
    ];
    addInfoTable(doc, personalInfo);
    
    // Marketing Information
    doc.moveDown(0.5); // Reduced spacing
    doc.fontSize(13).fillColor('#374151').text('Marketing Information:', { underline: true }); // Reduced font size
    const marketingInfo = [
      { label: 'How did you hear about VOS?', value: customer.hearAboutVOS || 'N/A' },
      { label: 'Received Other Quote?', value: customer.receivedOtherQuote ? 'Yes' : 'No' },
      { label: 'Other Quote Offerer', value: customer.otherQuoteOfferer || 'N/A' },
      { label: 'Other Quote Amount', value: customer.otherQuoteAmount ? `$${customer.otherQuoteAmount.toLocaleString()}` : 'N/A' }
    ];
    addInfoTable(doc, marketingInfo);
    
    // Agent Information
    if (customer.agent) {
      doc.moveDown(0.5); // Reduced spacing
      doc.fontSize(13).fillColor('#374151').text('Assigned Agent:', { underline: true }); // Reduced font size
      doc.fontSize(11).text(`Agent ID: ${customer.agent}`, 60, doc.y + 3); // Reduced font size and spacing
    }
    
    doc.fontSize(11).text(`Store Location: ${customer.storeLocation || 'N/A'}`, 60, doc.y + 15); // Reduced font size and spacing
    doc.fontSize(11).text(`Customer Created: ${customer.createdAt ? new Date(customer.createdAt).toLocaleDateString() : 'Unknown'}`, 60, doc.y + 28); // Reduced font size and spacing
  } else {
    doc.fontSize(11).fillColor('#ef4444').text('Customer information not available', 60, doc.y + 3); // Reduced font size and spacing
  }
  
  doc.moveDown(1.5); // Reduced spacing
}

/**
 * Add vehicle information section
 */
function addVehicleSection(doc, caseData) {
  addSectionHeader(doc, '3. Vehicle Details', doc.y + 10); // Reduced spacing
  
  if (caseData.vehicle && typeof caseData.vehicle === 'object') {
    const vehicle = caseData.vehicle;
    
    // Basic Vehicle Information
    doc.fontSize(13).fillColor('#374151').text('Basic Information:', { underline: true }); // Reduced font size
    const basicInfo = [
      { label: 'Year', value: vehicle.year || 'N/A' },
      { label: 'Make', value: vehicle.make || 'N/A' },
      { label: 'Model', value: vehicle.model || 'N/A' },
      { label: 'Color', value: vehicle.color || 'N/A' },
      { label: 'Body Style', value: vehicle.bodyStyle || 'N/A' },
      { label: 'VIN', value: vehicle.vin || 'N/A' },
      { label: 'Current Mileage', value: vehicle.currentMileage || 'N/A' }
    ];
    addInfoTable(doc, basicInfo);
    
    // Registration Information
    doc.moveDown(0.5); // Reduced spacing
    doc.fontSize(13).fillColor('#374151').text('Registration Information:', { underline: true }); // Reduced font size
    const regInfo = [
      { label: 'License Plate', value: vehicle.licensePlate || 'N/A' },
      { label: 'License State', value: vehicle.licenseState || 'N/A' },
      { label: 'Title Number', value: vehicle.titleNumber || 'N/A' },
      { label: 'Title Status', value: vehicle.titleStatus || 'N/A' }
    ];
    addInfoTable(doc, regInfo);
    
    // Financial Information
    doc.moveDown(0.5); // Reduced spacing
    doc.fontSize(13).fillColor('#374151').text('Financial Information:', { underline: true }); // Reduced font size
    const financialInfo = [
      { label: 'Loan Status', value: vehicle.loanStatus || 'N/A' },
      { label: 'Loan Amount', value: vehicle.loanAmount ? `$${vehicle.loanAmount.toLocaleString()}` : 'N/A' },
      { label: 'Second Set of Keys', value: vehicle.secondSetOfKeys ? 'Yes' : 'No' }
    ];
    addInfoTable(doc, financialInfo);
    
    // Condition Information
    doc.moveDown(0.5); // Reduced spacing
    doc.fontSize(13).fillColor('#374151').text('Condition Information:', { underline: true }); // Reduced font size
    doc.fontSize(11).text('Known Defects:', 60, doc.y + 3); // Reduced font size and spacing
    doc.fontSize(10).fillColor('#6b7280').text(vehicle.knownDefects || 'None reported', 60, doc.y + 15, { width: 450 }); // Reduced font size and spacing
    
    doc.fontSize(11).text(`Vehicle Created: ${vehicle.createdAt ? new Date(vehicle.createdAt).toLocaleDateString() : 'Unknown'}`, 60, doc.y + 30); // Reduced font size and spacing
  } else {
    doc.fontSize(11).fillColor('#ef4444').text('Vehicle information not available', 60, doc.y + 3); // Reduced font size and spacing
  }
  
  doc.moveDown(1.5); // Reduced spacing
}

/**
 * Add inspection details section
 */
function addInspectionSection(doc, caseData) {
  addSectionHeader(doc, '4. Inspection Report', doc.y + 20);
  
  if (caseData.inspection && typeof caseData.inspection === 'object') {
    const inspection = caseData.inspection;
    
    // Inspector Information
    doc.fontSize(14).fillColor('#374151').text('Inspector Information:', { underline: true });
    if (inspection.inspector && typeof inspection.inspector === 'object') {
      const inspector = inspection.inspector;
      const inspectorInfo = [
        { label: 'Inspector Name', value: `${inspector.firstName || 'N/A'} ${inspector.lastName || 'N/A'}` },
        { label: 'Email', value: inspector.email || 'N/A' },
        { label: 'Phone', value: inspector.phone || 'N/A' }
      ];
      addInfoTable(doc, inspectorInfo);
    } else {
      doc.fontSize(12).fillColor('#ef4444').text('Inspector information not available', 60, doc.y + 5);
    }
    
    // Scheduling Information
    doc.moveDown(1);
    doc.fontSize(14).fillColor('#374151').text('Scheduling Information:', { underline: true });
    const scheduleInfo = [
      { label: 'Scheduled Date', value: inspection.scheduledDate ? new Date(inspection.scheduledDate).toLocaleDateString() : 'N/A' },
      { label: 'Scheduled Time', value: inspection.scheduledTime || 'N/A' },
      { label: 'Status', value: inspection.status || 'N/A' },
      { label: 'Access Token', value: inspection.accessToken || 'N/A' }
    ];
    addInfoTable(doc, scheduleInfo);
    
    // Inspection Results
    doc.moveDown(1);
    doc.fontSize(14).fillColor('#374151').text('Inspection Results:', { underline: true });
    const resultsInfo = [
      { label: 'Overall Rating', value: inspection.overallRating ? `${inspection.overallRating}/5` : 'N/A' },
      { label: 'Completed', value: inspection.completed ? 'Yes' : 'No' },
      { label: 'Completed At', value: inspection.completedAt ? new Date(inspection.completedAt).toLocaleDateString() : 'N/A' },
      { label: 'Email Sent', value: inspection.emailSent ? 'Yes' : 'No' }
    ];
    addInfoTable(doc, resultsInfo);
    
    // Detailed Sections
    if (inspection.sections && Array.isArray(inspection.sections) && inspection.sections.length > 0) {
      doc.moveDown(1);
      doc.fontSize(14).fillColor('#374151').text('Detailed Section Ratings:', { underline: true });
      
      inspection.sections.forEach((section, index) => {
        if (section && typeof section === 'object') {
          doc.moveDown(0.5);
          doc.fontSize(12).fillColor('#1e40af').text(`${index + 1}. ${section.name || 'Unknown Section'}`, 60, doc.y + 5);
          doc.fontSize(11).text(`Rating: ${section.rating || 'N/A'}/5`, 80, doc.y + 20);
          
          if (section.photos && Array.isArray(section.photos) && section.photos.length > 0) {
            doc.fontSize(10).fillColor('#059669').text(`Photos: ${section.photos.length} image(s)`, 80, doc.y + 35);
          }
        }
      });
    }
    
    doc.fontSize(12).text(`Inspection Created: ${inspection.createdAt ? new Date(inspection.createdAt).toLocaleDateString() : 'Unknown'}`, 60, doc.y + 20);
  } else {
    doc.fontSize(12).fillColor('#ef4444').text('Inspection information not available', 60, doc.y + 5);
  }
  
  doc.moveDown(2);
}

/**
 * Add quote information section
 */
function addQuoteSection(doc, caseData) {
  addSectionHeader(doc, '5. Quote & Pricing', doc.y + 20);
  
  if (caseData.quote && typeof caseData.quote === 'object') {
    const quote = caseData.quote;
    
    // Estimator Information
    doc.fontSize(14).fillColor('#374151').text('Estimator Information:', { underline: true });
    if (quote.estimator && typeof quote.estimator === 'object') {
      const estimator = quote.estimator;
      const estimatorInfo = [
        { label: 'Estimator Name', value: `${estimator.firstName || 'N/A'} ${estimator.lastName || 'N/A'}` },
        { label: 'Email', value: estimator.email || 'N/A' },
        { label: 'Phone', value: estimator.phone || 'N/A' }
      ];
      addInfoTable(doc, estimatorInfo);
    } else {
      doc.fontSize(12).fillColor('#ef4444').text('Estimator information not available', 60, doc.y + 5);
    }
    
    // Quote Details
    doc.moveDown(1);
    doc.fontSize(14).fillColor('#374151').text('Quote Details:', { underline: true });
    const quoteInfo = [
      { label: 'Offer Amount', value: quote.offerAmount ? `$${quote.offerAmount.toLocaleString()}` : 'N/A' },
      { label: 'Estimated Value', value: quote.estimatedValue ? `$${quote.estimatedValue.toLocaleString()}` : 'N/A' },
      { label: 'Expiry Date', value: quote.expiryDate ? new Date(quote.expiryDate).toLocaleDateString() : 'N/A' },
      { label: 'Status', value: quote.status || 'N/A' },
      { label: 'Access Token', value: quote.accessToken || 'N/A' },
      { label: 'Title Reminder', value: quote.titleReminder ? 'Yes' : 'No' },
      { label: 'Email Sent', value: quote.emailSent ? 'Yes' : 'No' }
    ];
    addInfoTable(doc, quoteInfo);
    
    // Notes
    if (quote.notes) {
      doc.moveDown(1);
      doc.fontSize(14).fillColor('#374151').text('Additional Notes:', { underline: true });
      doc.fontSize(11).fillColor('#6b7280').text(quote.notes, 60, doc.y + 5, { width: 450 });
    }
    
    // Offer Decision
    if (quote.offerDecision && typeof quote.offerDecision === 'object') {
      doc.moveDown(1);
      doc.fontSize(14).fillColor('#374151').text('Offer Decision:', { underline: true });
      const decisionInfo = [
        { label: 'Decision', value: quote.offerDecision.decision || 'N/A' },
        { label: 'Counter Offer', value: quote.offerDecision.counterOffer ? `$${quote.offerDecision.counterOffer.toLocaleString()}` : 'N/A' },
        { label: 'Final Amount', value: quote.offerDecision.finalAmount ? `$${quote.offerDecision.finalAmount.toLocaleString()}` : 'N/A' },
        { label: 'Decision Date', value: quote.offerDecision.decisionDate ? new Date(quote.offerDecision.decisionDate).toLocaleDateString() : 'N/A' },
        { label: 'Reason', value: quote.offerDecision.reason || 'N/A' }
      ];
      addInfoTable(doc, decisionInfo);
      
      if (quote.offerDecision.customerNotes) {
        doc.moveDown(0.5);
        doc.fontSize(12).text('Customer Notes:', 60, doc.y + 5);
        doc.fontSize(11).fillColor('#6b7280').text(quote.offerDecision.customerNotes, 60, doc.y + 20, { width: 450 });
      }
    }
    
    doc.fontSize(12).text(`Quote Generated: ${quote.generatedAt ? new Date(quote.generatedAt).toLocaleDateString() : 'Unknown'}`, 60, doc.y + 20);
  } else {
    doc.fontSize(12).fillColor('#ef4444').text('Quote information not available', 60, doc.y + 5);
  }
  
  doc.moveDown(2);
}

/**
 * Add transaction details section
 */
function addTransactionSection(doc, caseData) {
  addSectionHeader(doc, '6. Transaction Details', doc.y + 20);
  
  if (caseData.transaction && typeof caseData.transaction === 'object') {
    const transaction = caseData.transaction;
    
    // Bill of Sale Information
    doc.fontSize(14).fillColor('#374151').text('Bill of Sale Information:', { underline: true });
    
    if (transaction.billOfSale && typeof transaction.billOfSale === 'object') {
      const billOfSale = transaction.billOfSale;
      
      // Seller Information
      doc.fontSize(12).fillColor('#1e40af').text('Seller Information:', 60, doc.y + 5);
      const sellerInfo = [
        { label: 'Seller Name', value: billOfSale.sellerName || 'N/A' },
        { label: 'Seller Address', value: billOfSale.sellerAddress || 'N/A' },
        { label: 'Seller City', value: billOfSale.sellerCity || 'N/A' },
        { label: 'Seller State', value: billOfSale.sellerState || 'N/A' },
        { label: 'Seller Zip', value: billOfSale.sellerZip || 'N/A' },
        { label: 'Seller Phone', value: billOfSale.sellerPhone || 'N/A' },
        { label: 'Seller Email', value: billOfSale.sellerEmail || 'N/A' },
        { label: 'Seller DL Number', value: billOfSale.sellerDLNumber || 'N/A' },
        { label: 'Seller DL State', value: billOfSale.sellerDLState || 'N/A' }
      ];
      addInfoTable(doc, sellerInfo);
      
      // Buyer Information
      doc.moveDown(1);
      doc.fontSize(12).fillColor('#1e40af').text('Buyer Information:', 60, doc.y + 5);
      const buyerInfo = [
        { label: 'Buyer Name', value: billOfSale.buyerName || 'N/A' },
        { label: 'Buyer Address', value: billOfSale.buyerAddress || 'N/A' },
        { label: 'Buyer City', value: billOfSale.buyerCity || 'N/A' },
        { label: 'Buyer State', value: billOfSale.buyerState || 'N/A' },
        { label: 'Buyer Zip', value: billOfSale.buyerZip || 'N/A' },
        { label: 'Business License', value: billOfSale.buyerBusinessLicense || 'N/A' },
        { label: 'Buyer Rep Name', value: billOfSale.buyerRepName || 'N/A' }
      ];
      addInfoTable(doc, buyerInfo);
      
      // Sale Information
      doc.moveDown(1);
      doc.fontSize(12).fillColor('#1e40af').text('Sale Information:', 60, doc.y + 5);
      const saleInfo = [
        { label: 'Sale Date', value: billOfSale.saleDate ? new Date(billOfSale.saleDate).toLocaleDateString() : 'N/A' },
        { label: 'Sale Time', value: billOfSale.saleTime || 'N/A' },
        { label: 'Sale Price', value: billOfSale.salePrice ? `$${billOfSale.salePrice.toLocaleString()}` : 'N/A' },
        { label: 'Payment Method', value: billOfSale.paymentMethod || 'N/A' },
        { label: 'Odometer Reading', value: billOfSale.odometerReading || 'N/A' },
        { label: 'Odometer Accurate', value: billOfSale.odometerAccurate ? 'Yes' : 'No' },
        { label: 'Known Defects', value: billOfSale.knownDefects || 'N/A' },
        { label: 'As-Is Acknowledgment', value: billOfSale.asIsAcknowledgment ? 'Yes' : 'No' }
      ];
      addInfoTable(doc, saleInfo);
      
      // Notary Information
      if (billOfSale.notaryRequired) {
        doc.moveDown(1);
        doc.fontSize(12).fillColor('#1e40af').text('Notary Information:', 60, doc.y + 5);
        const notaryInfo = [
          { label: 'Notary Name', value: billOfSale.notaryName || 'N/A' },
          { label: 'Commission Expiry', value: billOfSale.notaryCommissionExpiry ? new Date(billOfSale.notaryCommissionExpiry).toLocaleDateString() : 'N/A' },
          { label: 'Witness Name', value: billOfSale.witnessName || 'N/A' },
          { label: 'Witness Phone', value: billOfSale.witnessPhone || 'N/A' }
        ];
        addInfoTable(doc, notaryInfo);
      }
    }
    
    // Bank Details
    if (transaction.bankDetails && typeof transaction.bankDetails === 'object') {
      doc.moveDown(1);
      doc.fontSize(14).fillColor('#374151').text('Bank Details:', { underline: true });
      const bankInfo = [
        { label: 'Account Holder', value: transaction.bankDetails.accountHolderName || 'N/A' },
        { label: 'Routing Number', value: transaction.bankDetails.routingNumber || 'N/A' },
        { label: 'Account Number', value: transaction.bankDetails.accountNumber ? '***' + transaction.bankDetails.accountNumber.slice(-4) : 'N/A' },
        { label: 'Account Type', value: transaction.bankDetails.accountType || 'N/A' },
        { label: 'Bank Name', value: transaction.bankDetails.bankName || 'N/A' },
        { label: 'Bank Phone', value: transaction.bankDetails.bankPhone || 'N/A' },
        { label: 'Account Opened', value: transaction.bankDetails.accountOpenedDate ? new Date(transaction.bankDetails.accountOpenedDate).toLocaleDateString() : 'N/A' },
        { label: 'Electronic Consent', value: transaction.bankDetails.electronicConsentAgreed ? 'Yes' : 'No' }
      ];
      addInfoTable(doc, bankInfo);
    }
    
    // Tax Information
    if (transaction.taxInfo && typeof transaction.taxInfo === 'object') {
      doc.moveDown(1);
      doc.fontSize(14).fillColor('#374151').text('Tax Information:', { underline: true });
      const taxInfo = [
        { label: 'SSN', value: transaction.taxInfo.ssn ? '***-**-' + transaction.taxInfo.ssn.slice(-4) : 'N/A' },
        { label: 'Tax ID', value: transaction.taxInfo.taxId || 'N/A' },
        { label: 'Reported Income', value: transaction.taxInfo.reportedIncome ? 'Yes' : 'No' },
        { label: 'Form 1099 Agreed', value: transaction.taxInfo.form1099Agreed ? 'Yes' : 'No' }
      ];
      addInfoTable(doc, taxInfo);
    }
    
    // Payment Status
    doc.moveDown(1);
    doc.fontSize(14).fillColor('#374151').text('Payment Status:', { underline: true });
    const statusInfo = [
      { label: 'Payment Status', value: transaction.paymentStatus || 'N/A' },
      { label: 'PDF Generated', value: transaction.pdfGenerated ? 'Yes' : 'No' },
      { label: 'PDF Path', value: transaction.pdfPath || 'N/A' },
      { label: 'Submitted At', value: transaction.submittedAt ? new Date(transaction.submittedAt).toLocaleDateString() : 'N/A' },
      { label: 'Completed At', value: transaction.completedAt ? new Date(transaction.completedAt).toLocaleDateString() : 'N/A' }
    ];
    addInfoTable(doc, statusInfo);
    
    doc.fontSize(12).text(`Transaction Created: ${transaction.createdAt ? new Date(transaction.createdAt).toLocaleDateString() : 'Unknown'}`, 60, doc.y + 20);
  } else {
    doc.fontSize(12).fillColor('#ef4444').text('Transaction information not available', 60, doc.y + 5);
  }
  
  doc.moveDown(2);
}

/**
 * Add documents section
 */
function addDocumentsSection(doc, caseData) {
  addSectionHeader(doc, '7. Documents & Attachments', doc.y + 20);
  
  // Case Documents
  if (caseData.documents) {
    doc.fontSize(14).fillColor('#374151').text('Case Documents:', { underline: true });
    const caseDocs = [
      { label: 'Driver License Front', value: caseData.documents.driverLicenseFront?.path || 'Not uploaded' },
      { label: 'Driver License Rear', value: caseData.documents.driverLicenseRear?.path || 'Not uploaded' },
      { label: 'Vehicle Title', value: caseData.documents.vehicleTitle?.path || 'Not uploaded' }
    ];
    addInfoTable(doc, caseDocs);
  }
  
  // Transaction Documents
  if (caseData.transaction?.documents) {
    doc.moveDown(1);
    doc.fontSize(14).fillColor('#374151').text('Transaction Documents:', { underline: true });
    const transDocs = [
      { label: 'ID Rescan', value: caseData.transaction.documents.idRescan || 'Not uploaded' },
      { label: 'Signed Bill of Sale', value: caseData.transaction.documents.signedBillOfSale || 'Not uploaded' },
      { label: 'Title Photo', value: caseData.transaction.documents.titlePhoto || 'Not uploaded' },
      { label: 'Insurance Declaration', value: caseData.transaction.documents.insuranceDeclaration || 'Not uploaded' },
      { label: 'Seller Signature', value: caseData.transaction.documents.sellerSignature || 'Not uploaded' }
    ];
    addInfoTable(doc, transDocs);
    
    if (caseData.transaction.documents.additionalDocuments && caseData.transaction.documents.additionalDocuments.length > 0) {
      doc.moveDown(0.5);
      doc.fontSize(12).text('Additional Documents:', 60, doc.y + 5);
      caseData.transaction.documents.additionalDocuments.forEach((docPath, index) => {
        doc.fontSize(10).fillColor('#6b7280').text(`${index + 1}. ${docPath}`, 80, doc.y + 5);
      });
    }
  }
  
  // Inspection Photos
  if (caseData.inspection?.sections) {
    doc.moveDown(1);
    doc.fontSize(14).fillColor('#374151').text('Inspection Photos:', { underline: true });
    
    caseData.inspection.sections.forEach((section, index) => {
      if (section?.photos && Array.isArray(section.photos) && section.photos.length > 0) {
        doc.fontSize(12).text(`${section.name || `Section ${index + 1}`}:`, 60, doc.y + 5);
        section.photos.forEach((photo, photoIndex) => {
          doc.fontSize(10).fillColor('#6b7280').text(`  Photo ${photoIndex + 1}: ${photo.path}`, 80, doc.y + 5);
        });
      }
    });
  }
  
  doc.moveDown(2);
}

/**
 * Add timeline section
 */
function addTimelineSection(doc, caseData) {
  addSectionHeader(doc, '8. Timeline & Activity Log', doc.y + 20);
  
  const timeline = [];
  
  // Add creation dates
  if (caseData.createdAt) {
    timeline.push({
      date: new Date(caseData.createdAt),
      event: 'Case Created',
      description: 'Initial case setup completed'
    });
  }
  
  if (caseData.customer?.createdAt) {
    timeline.push({
      date: new Date(caseData.customer.createdAt),
      event: 'Customer Added',
      description: 'Customer information recorded'
    });
  }
  
  if (caseData.vehicle?.createdAt) {
    timeline.push({
      date: new Date(caseData.vehicle.createdAt),
      event: 'Vehicle Added',
      description: 'Vehicle information recorded'
    });
  }
  
  if (caseData.inspection?.createdAt) {
    timeline.push({
      date: new Date(caseData.inspection.createdAt),
      event: 'Inspection Scheduled',
      description: 'Vehicle inspection scheduled'
    });
  }
  
  if (caseData.inspection?.completedAt) {
    timeline.push({
      date: new Date(caseData.inspection.completedAt),
      event: 'Inspection Completed',
      description: 'Vehicle inspection completed'
    });
  }
  
  if (caseData.quote?.generatedAt) {
    timeline.push({
      date: new Date(caseData.quote.generatedAt),
      event: 'Quote Generated',
      description: 'Initial quote prepared'
    });
  }
  
  if (caseData.quote?.offerDecision?.decisionDate) {
    timeline.push({
      date: new Date(caseData.quote.offerDecision.decisionDate),
      event: 'Offer Decision Made',
      description: `Customer ${caseData.quote.offerDecision.decision} the offer`
    });
  }
  
  if (caseData.transaction?.submittedAt) {
    timeline.push({
      date: new Date(caseData.transaction.submittedAt),
      event: 'Transaction Submitted',
      description: 'Transaction paperwork submitted'
    });
  }
  
  if (caseData.transaction?.completedAt) {
    timeline.push({
      date: new Date(caseData.transaction.completedAt),
      event: 'Transaction Completed',
      description: 'Transaction finalized'
    });
  }
  
  if (caseData.lastActivity?.timestamp) {
    timeline.push({
      date: new Date(caseData.lastActivity.timestamp),
      event: 'Last Activity',
      description: caseData.lastActivity.description || 'Case updated'
    });
  }
  
  // Sort timeline by date
  timeline.sort((a, b) => a.date - b.date);
  
  // Display timeline
  timeline.forEach((item, index) => {
    doc.fontSize(12).fillColor('#1e40af').text(`${index + 1}. ${item.event}`, 60, doc.y + 5);
    doc.fontSize(10).fillColor('#6b7280').text(`   Date: ${item.date.toLocaleDateString()} ${item.date.toLocaleTimeString()}`, 80, doc.y + 5);
    doc.fontSize(10).text(`   ${item.description}`, 80, doc.y + 20);
    doc.moveDown(0.5);
  });
  
  if (timeline.length === 0) {
    doc.fontSize(12).fillColor('#6b7280').text('No timeline events available', 60, doc.y + 5);
  }
  
  doc.moveDown(2);
}

/**
 * Add footer
 */
function addFooter(doc) {
  // Get the total number of pages
  const pageCount = doc.bufferedPageRange().count;
  
  // Only add footer if we have pages
  if (pageCount > 0) {
    // Get the range of buffered pages
    const range = doc.bufferedPageRange();
    
    // Add footer to each page in the buffer
    for (let i = range.start; i <= range.end; i++) {
      doc.switchToPage(i);
      
      // Add page number
      doc.fontSize(10).fillColor('#6b7280').text(
        `Page ${i + 1} of ${pageCount}`,
        doc.page.width / 2 - 30,
        doc.page.height - 50,
        { align: 'center' }
      );
      
      // Add footer line
      doc.moveTo(40, doc.page.height - 60)
         .lineTo(doc.page.width - 40, doc.page.height - 60)
         .stroke();
      
      // Add footer text
      doc.fontSize(8).fillColor('#6b7280').text(
        'This document serves as the official record of the vehicle purchase transaction between the customer and VOS.',
        doc.page.width / 2,
        doc.page.height - 40,
        { align: 'center', width: doc.page.width - 80 }
      );
      
      doc.fontSize(8).fillColor('#6b7280').text(
        `Generated on: ${new Date().toLocaleString()} | VOS Case File System`,
        doc.page.width / 2,
        doc.page.height - 25,
        { align: 'center' }
      );
    }
  }
}

/**
 * Helper function to add section headers
 */
function addSectionHeader(doc, title, y) {
  doc.y = y;
  doc.fontSize(16).fillColor('#1e40af').text(title, { underline: true });
  doc.fillColor('#000000').moveDown(0.3);
}

/**
 * Helper function to add info tables
 */
function addInfoTable(doc, data) {
  const startY = doc.y;
  const labelWidth = 150;
  const valueWidth = 300;
  const rowHeight = 16; // Reduced from 20 to 16
  
  data.forEach((item, index) => {
    const y = startY + (index * rowHeight);
    
    // Add label
    doc.fontSize(10).fillColor('#374151').text(item.label + ':', 60, y); // Reduced font size from 11 to 10
    
    // Add value
    doc.fontSize(10).fillColor('#000000').text(item.value, 60 + labelWidth, y, { width: valueWidth }); // Reduced font size from 11 to 10
  });
  
  doc.y = startY + (data.length * rowHeight) + 8; // Reduced spacing from 10 to 8
}

/**
 * Add Bill of Sale content to PDF
 */
function addBillOfSaleContent(doc, caseData) {
  const customer = caseData.customer;
  const vehicle = caseData.vehicle;
  const quote = caseData.quote;
  const transaction = caseData.transaction;
  
  // Set margins and starting position
  const margin = 40;
  const pageWidth = doc.page.width - (margin * 2);
  let y = 30;
  
  // Title - Large, bold, centered
  doc.fontSize(16).font('Helvetica-Bold').fillColor('#000000').text('VEHICLE BILL OF SALE', pageWidth / 2, y, { align: 'center' });
  y += 15;
  
  // Opening paragraph
  const currentDate = new Date().toISOString().split('T')[0];
  doc.fontSize(9).font('Helvetica').fillColor('#000000').text(`This Bill of Sale is made and entered into on [Date:${currentDate}], by and between the following parties:`, margin, y, { width: pageWidth });
  y += 10;
  
  // 1. Seller Information
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000').text('1. Seller Information', margin, y);
  y += 8;
  
  const sellerName = transaction?.billOfSale?.sellerName || `${customer?.firstName || ''} ${customer?.lastName || ''}`.trim();
  const sellerAddress = transaction?.billOfSale?.sellerAddress || 'N/A';
  const sellerCity = transaction?.billOfSale?.sellerCity || 'N/A';
  const sellerState = transaction?.billOfSale?.sellerState || 'N/A';
  const sellerZip = transaction?.billOfSale?.sellerZip || 'N/A';
  const sellerDLNumber = transaction?.billOfSale?.sellerDLNumber || 'N/A';
  const sellerDLState = transaction?.billOfSale?.sellerDLState || 'N/A';
  const sellerPhone = transaction?.billOfSale?.sellerPhone || customer?.cellPhone || 'N/A';
  const sellerEmail = transaction?.billOfSale?.sellerEmail || customer?.email1 || 'N/A';
  
  const sellerFields = [
    { label: 'Full Legal Name(s):', value: sellerName },
    { label: 'Address:', value: sellerAddress },
    { label: '', value: `${sellerCity}, ${sellerState}, ${sellerZip}` },
    { label: 'Driver\'s License/ID Number:', value: sellerDLNumber },
    { label: 'Issuing State:', value: sellerDLState },
    { label: 'Contact Phone Number:', value: sellerPhone },
    { label: 'Email Address:', value: sellerEmail }
  ];
  
  sellerFields.forEach(item => {
    if (item.label) {
      doc.fontSize(9).font('Helvetica').fillColor('#000000').text(item.label, margin, y);
      y += 8;
    }
    doc.fontSize(9).font('Helvetica').text(item.value, margin + 20, y);
    y += 8;
  });
  
  y += 6;
  
  // 2. Buyer Information
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000').text('2. Buyer Information', margin, y);
  y += 8;
  
  const buyerName = transaction?.billOfSale?.buyerName || 'VOS (VIN On Spot)';
  const buyerAddress = transaction?.billOfSale?.buyerAddress || '123 Business Avenue';
  const buyerCity = transaction?.billOfSale?.buyerCity || 'Business City';
  const buyerState = transaction?.billOfSale?.buyerState || 'BC';
  const buyerZip = transaction?.billOfSale?.buyerZip || '12345';
  
  doc.fontSize(9).font('Helvetica').fillColor('#000000').text('Buyer Name:', margin, y);
  doc.fontSize(9).font('Helvetica').text(buyerName, margin + 20, y);
  y += 8;
  doc.fontSize(9).font('Helvetica').fillColor('#000000').text('Address:', margin, y);
  y += 8;
  doc.fontSize(9).font('Helvetica').text(buyerAddress, margin + 20, y);
  y += 8;
  doc.fontSize(9).font('Helvetica').text(`${buyerCity}, ${buyerState}, ${buyerZip}`, margin + 20, y);
  y += 10;
  
  // 3. Vehicle Information
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000').text('3. Vehicle Information', margin, y);
  y += 8;
  
  doc.fontSize(9).font('Helvetica').fillColor('#000000').text('The Seller hereby sells, transfers, and conveys to the Buyer the following vehicle:', margin, y, { width: pageWidth });
  y += 8;
  
  const vehicleYear = transaction?.billOfSale?.vehicleYear || vehicle?.year || 'N/A';
  const vehicleMake = transaction?.billOfSale?.vehicleMake || vehicle?.make || 'N/A';
  const vehicleModel = transaction?.billOfSale?.vehicleModel || vehicle?.model || 'N/A';
  const vehicleVIN = transaction?.billOfSale?.vehicleVIN || vehicle?.vin || 'N/A';
  const vehicleMileage = transaction?.billOfSale?.vehicleMileage || transaction?.billOfSale?.odometerReading || vehicle?.currentMileage || 'N/A';
  const vehicleLicensePlate = transaction?.billOfSale?.vehicleLicensePlate || vehicle?.licensePlate || 'N/A';
  const vehicleTitleStatus = transaction?.billOfSale?.vehicleTitleStatus || vehicle?.titleStatus || 'Clean';
  const knownDefects = transaction?.billOfSale?.knownDefects || vehicle?.knownDefects || 'None known';
  
  const vehicleFields = [
    { label: 'Year:', value: vehicleYear },
    { label: 'Make:', value: vehicleMake },
    { label: 'Model:', value: vehicleModel },
    { label: 'VIN (Vehicle Identification Number):', value: vehicleVIN },
    { label: 'Odometer Reading:', value: `${vehicleMileage} (Indicate if "Actual" or "Not Actual" mileage)` },
    { label: 'License Plate Number (if applicable):', value: vehicleLicensePlate },
    { label: 'Title Status (as represented by Seller):', value: vehicleTitleStatus },
    { label: 'Any known significant defects or issues (as disclosed by Seller):', value: knownDefects }
  ];
  
  vehicleFields.forEach(item => {
    doc.fontSize(9).font('Helvetica').fillColor('#000000').text(item.label, margin, y);
    y += 8;
    doc.fontSize(9).font('Helvetica').text(item.value, margin + 20, y);
    y += 8;
  });
  
  y += 6;
  
  // 4. Sale Terms and Payment
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000').text('4. Sale Terms and Payment', margin, y);
  y += 8;
  
  const salePrice = transaction?.billOfSale?.salePrice || quote?.offerAmount || 0;
  const paymentMethod = transaction?.billOfSale?.paymentMethod || 'ACH Transfer';
  const paymentDate = transaction?.billOfSale?.paymentDate || currentDate;
  
  doc.fontSize(9).font('Helvetica').fillColor('#000000').text('Purchase Price:', margin, y);
  doc.fontSize(9).font('Helvetica').text(`$${salePrice.toLocaleString()} Dollars (USD)`, margin + 200, y);
  y += 8;
  doc.fontSize(9).font('Helvetica').fillColor('#000000').text('Payment Method:', margin, y);
  doc.fontSize(9).font('Helvetica').text(paymentMethod, margin + 200, y);
  y += 8;
  doc.fontSize(9).font('Helvetica').fillColor('#000000').text('Payment Date:', margin, y);
  doc.fontSize(9).font('Helvetica').text(paymentDate, margin + 200, y);
  y += 8;
  doc.fontSize(9).font('Helvetica').fillColor('#000000').text('The Seller acknowledges receipt of the full purchase price from the Buyer.', margin, y, { width: pageWidth });
  y += 10;
  
  // 5. Exchange of Ownership and Possession
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000').text('5. Exchange of Ownership and Possession', margin, y);
  y += 8;
  
  doc.fontSize(9).font('Helvetica').fillColor('#000000').text('The Seller agrees to transfer ownership and possession of the above-described vehicle to the Buyer in exchange for the agreed-upon consideration, which can be in one of the following forms (please check applicable):', margin, y, { width: pageWidth });
  y += 8;
  
  const paymentTypes = [
    'Cash Payment: The full purchase price will be paid to the Seller in cash.',
    'Check: A check for the full purchase price will be issued to the Seller.',
    'Wire Transfer/ACH: The full purchase price will be transferred electronically to the Seller\'s designated bank account.',
    'Trade: The vehicle is exchanged for another vehicle or goods of agreed-upon value.',
    'Gift: The vehicle is transferred as a gift, with no monetary exchange.',
    'Other: [Specify other form of exchange, if applicable]'
  ];
  
  paymentTypes.forEach((type, index) => {
    // Draw checkbox
    doc.rect(margin, y - 2, 6, 6).stroke();
    doc.fontSize(9).font('Helvetica').text(type, margin + 12, y);
    y += 8;
  });
  
  y += 6;
  
  // 6. Itemization of Purchase
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000').text('6. Itemization of Purchase', margin, y);
  y += 8;
  
  const basePrice = salePrice;
  const adjustmentAmount = transaction?.billOfSale?.adjustmentAmount || 0;
  const loanPayoffAmount = transaction?.billOfSale?.loanPayoffAmount || vehicle?.loanAmount || 0;
  const totalPrice = basePrice - adjustmentAmount - loanPayoffAmount;
  
  doc.fontSize(9).font('Helvetica').fillColor('#000000').text('Base Vehicle Price:', margin, y);
  doc.fontSize(9).font('Helvetica').text(`$${basePrice.toLocaleString()}`, margin + 200, y);
  y += 8;
  doc.fontSize(9).font('Helvetica').fillColor('#000000').text('Less: Repairs/Reconditioning Adjustment:', margin, y);
  doc.fontSize(9).font('Helvetica').text(`-$${adjustmentAmount.toLocaleString()}`, margin + 200, y);
  y += 8;
  doc.fontSize(9).font('Helvetica').fillColor('#000000').text('Less: Outstanding Loan Payoff (if applicable):', margin, y);
  doc.fontSize(9).font('Helvetica').text(`-$${loanPayoffAmount.toLocaleString()}`, margin + 200, y);
  y += 8;
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000').text('Total Purchase Price:', margin, y);
  doc.fontSize(9).font('Helvetica-Bold').text(`$${totalPrice.toLocaleString()}`, margin + 200, y);
  y += 10;
  
  // 7. Taxes
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000').text('7. Taxes', margin, y);
  y += 8;
  
  doc.fontSize(9).font('Helvetica').fillColor('#000000').text('All municipal, county, and state taxes in relation to the sale of the Vehicle, including sales taxes, shall be paid by (please check one):', margin, y, { width: pageWidth });
  y += 8;
  
  const taxOptions = [
    'Buyer: And are not included as part of the exchange price.',
    'Seller: And are included as part of the exchange price.'
  ];
  
  taxOptions.forEach((option, index) => {
    doc.rect(margin, y - 2, 6, 6).stroke();
    doc.fontSize(9).font('Helvetica').text(option, margin + 12, y);
    y += 8;
  });
  
  y += 6;
  
  // 8. Seller's Representations and Warranties
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000').text('8. Seller\'s Representations and Warranties', margin, y);
  y += 8;
  
  doc.fontSize(9).font('Helvetica').fillColor('#000000').text('The Seller hereby certifies that:', margin, y);
  y += 8;
  
  const warranties = [
    'The Seller is the legal owner of the vehicle and has the full right and authority to sell and transfer it.',
    'The vehicle is free from all liens, encumbrances, and claims, except as explicitly disclosed to the Buyer (e.g., outstanding loan as detailed in intake).',
    'The information provided in this Bill of Sale is true and accurate to the best of the Seller\'s knowledge.'
  ];
  
  warranties.forEach(warranty => {
    doc.fontSize(9).font('Helvetica').text(`• ${warranty}`, margin, y, { width: pageWidth });
    y += 8;
  });
  
  y += 6;
  
  // 9. Transfer of Ownership and Condition
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000').text('9. Transfer of Ownership and Condition', margin, y);
  y += 8;
  
  const transferText = [
    'The Seller agrees to transfer full ownership of the above-described vehicle to VOS upon receipt of the full purchase price and completion of all required documentation, including the vehicle title.',
    'The vehicle is sold in "AS-IS, WHERE-IS" condition, unless otherwise specified in a separate written agreement. The Buyer acknowledges that they have had the opportunity to inspect the vehicle (via VOS\'s inspection process).'
  ];
  
  transferText.forEach(text => {
    doc.fontSize(9).font('Helvetica').fillColor('#000000').text(text, margin, y, { width: pageWidth });
    y += 8;
  });
  
  y += 6;
  
  // 10. Acknowledgment of Title Transfer Requirement
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000').text('10. Acknowledgment of Title Transfer Requirement', margin, y);
  y += 8;
  
  const titleText = 'The Seller understands and acknowledges that the official transfer of vehicle ownership to VOS is contingent upon the Seller providing a valid, clear, and transferable vehicle title within 48 hours of accepting VOS\'s offer. Failure to provide the title within this timeframe may result in the voiding of the current offer and potentially require a new inspection and renegotiation of the purchase price.';
  
  doc.fontSize(9).font('Helvetica').fillColor('#000000').text(titleText, margin, y, { width: pageWidth });
  y += 15;
  
  // 11. Signatures
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000').text('11. Signatures', margin, y);
  y += 8;
  
  doc.fontSize(9).font('Helvetica').fillColor('#000000').text('By signing below, the parties agree to all terms and conditions set forth in this Bill of Sale. This document authorizes the Buyer\'s and Seller\'s signatures below.', margin, y, { width: pageWidth });
  y += 10;
  
  // Seller signature section
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000').text('SELLER(S):', margin, y);
  y += 8;
  
  doc.fontSize(9).font('Helvetica').fillColor('#000000').text('Signature', margin, y);
  doc.moveTo(margin, y + 6).lineTo(margin + 200, y + 6).stroke();
  y += 15;
  doc.fontSize(9).font('Helvetica').fillColor('#000000').text(`[${sellerName}]`, margin, y);
  y += 8;
  doc.fontSize(9).font('Helvetica').fillColor('#000000').text('Date:', margin, y);
  doc.moveTo(margin + 40, y - 3).lineTo(margin + 120, y - 3).stroke();
  y += 12;
  
  // Co-owner signature (if applicable)
  doc.fontSize(9).font('Helvetica').fillColor('#000000').text('Signature (If applicable, for co-owner)', margin, y);
  doc.moveTo(margin, y + 6).lineTo(margin + 200, y + 6).stroke();
  y += 15;
  doc.fontSize(9).font('Helvetica').fillColor('#000000').text('[Seller\'s Printed Name]', margin, y);
  y += 8;
  doc.fontSize(9).font('Helvetica').fillColor('#000000').text('Date:', margin, y);
  doc.moveTo(margin + 40, y - 3).lineTo(margin + 120, y - 3).stroke();
  y += 15;
  
  // VOS signature section
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000').text('FOR VOS (BUYER):', margin, y);
  y += 8;
  
  const buyerRepName = transaction?.billOfSale?.buyerRepName || 'Agent Smith';
  const buyerRepTitle = transaction?.billOfSale?.buyerRepTitle || 'Authorized Representative';
  
  doc.fontSize(9).font('Helvetica').fillColor('#000000').text('Authorized Signature', margin, y);
  doc.moveTo(margin, y + 6).lineTo(margin + 200, y + 6).stroke();
  y += 15;
  doc.fontSize(9).font('Helvetica').fillColor('#000000').text(`[${buyerRepName} - ${buyerRepTitle}]`, margin, y);
  y += 8;
  doc.fontSize(9).font('Helvetica').fillColor('#000000').text('Date:', margin, y);
  doc.moveTo(margin + 40, y - 3).lineTo(margin + 120, y - 3).stroke();
  y += 12;

  // Footer
  y += 8;
  doc.fontSize(7).font('Helvetica').fillColor('#666666').text('Generated by Vehicle Offer Service - Document ID: ' + (caseData._id || caseData.id || 'Unknown'), margin, y, { width: pageWidth, align: 'center' });
}