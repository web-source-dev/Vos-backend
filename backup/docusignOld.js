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
      doc.text(`Sale Price: $${(transaction.billOfSale.salePrice || 0).toLocaleString()}`);
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
 * Generate Quote Summary PDF with comprehensive vehicle and offer information
 * @param {Object} caseData - The case data containing all information
 * @returns {Promise<Object>} - Promise resolving to the PDF file path and name
 */
function generateQuoteSummaryPDF(caseData) {
  try {
    // Create upload directory if it doesn't exist
    const pdfDir = path.join(__dirname, '../../uploads/pdfs');
    fsp.mkdir(pdfDir, { recursive: true });

    // Create a unique filename
    const fileName = `quote-summary-${caseData._id}-${Date.now()}.pdf`;
    const filePath = path.join(pdfDir, fileName);

    // Get the required data
    const customer = caseData.customer || {};
    const vehicle = caseData.vehicle || {};
    const inspection = caseData.inspection || {};
    const quote = caseData.quote || {};

    // Create a new PDF document
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: {
        top: 40,
        bottom: 40,
        left: 40,
        right: 40
      }
    });

    // Pipe the PDF into a file
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // ===== HEADER =====
    doc.fontSize(24).text('VOS - VEHICLE OFFER SUMMARY', {align: 'center', color: '#1e40af'});
    doc.moveDown(0.3);
    doc.moveDown(1);

    // ===== VEHICLE IDENTIFICATION =====
    addSectionHeader(doc, 'VEHICLE IDENTIFICATION');
    doc.moveDown(0.3);
    
    // Vehicle info in a table format
    const vehicleInfo = [
      ['Year', vehicle.year || 'N/A'],
      ['Make', vehicle.make || 'N/A'],
      ['Model', vehicle.model || 'N/A'],
      ['VIN', vehicle.vin || 'Not provided'],
      ['Mileage', vehicle.currentMileage || 'N/A'],
      ['Color', vehicle.color || 'N/A'],
      ['Title Status', vehicle.titleStatus || 'Not specified']
    ];
    
    addInfoTable(doc, vehicleInfo);
    doc.moveDown(0.5);

    // ===== CUSTOMER INFORMATION =====
    addSectionHeader(doc, 'CUSTOMER INFORMATION');
    doc.moveDown(0.3);
    
    const customerInfo = [
      ['Full Name', `${customer.firstName || ''} ${customer.lastName || ''}`],
      ['Primary Phone', customer.cellPhone || 'Not provided'],
      ['Secondary Phone', customer.homePhone || 'Not provided'],
      ['Primary Email', customer.email1 || 'Not provided'],
      ['Secondary Email', customer.email2 || 'Not provided'],
      ['Source', getSourceLabel(customer.source) || 'Not specified'],
      ['How They Heard', customer.hearAboutVOS || 'Not specified']
    ];
    
    addInfoTable(doc, customerInfo);
    doc.moveDown(0.5);

    // ===== MARKET VALUE ANALYSIS =====
    addSectionHeader(doc, 'MARKET VALUE ANALYSIS');
    doc.moveDown(0.3);
    
    if (vehicle.estimatedValue) {
      const marketValue = vehicle.estimatedValue;
      const offerAmount = quote.offerAmount || 0;
      const difference = marketValue - offerAmount;
      const percentage = marketValue > 0 ? ((difference / marketValue) * 100) : 0;
      
      const marketInfo = [
        ['MarketCheck Value', `$${marketValue.toLocaleString()}`],
        ['VOS Offer', `$${offerAmount.toLocaleString()}`],
        ['Difference', `$${difference.toLocaleString()} (${percentage.toFixed(1)}%)`]
      ];
      
      addInfoTable(doc, marketInfo);
      
      // Market position indicator
      doc.moveDown(0.3);
      if (percentage > 15) {
        doc.fontSize(10).text('✓ Market Position: Significantly below market value', {color: 'green'});
      } else if (percentage > 5) {
        doc.fontSize(10).text('✓ Market Position: Below market value', {color: 'blue'});
      } else if (percentage > -5) {
        doc.fontSize(10).text('✓ Market Position: At market value', {color: 'black'});
      } else {
        doc.fontSize(10).text('⚠ Market Position: Above market value', {color: 'red'});
      }
    } else {
      doc.fontSize(10).text('MarketCheck Estimated Value: Not available', {color: '#6b7280'});
    }
    doc.moveDown(0.5);

    // ===== INSPECTION OVERVIEW =====
    addSectionHeader(doc, 'INSPECTION OVERVIEW');
    doc.moveDown(0.3);
    
    const inspectionInfo = [
      ['Overall Rating', `${inspection.overallRating || 'N/A'}/5`],
      ['Inspector', `${inspection.inspector?.firstName || ''} ${inspection.inspector?.lastName || ''}`],
      ['Inspection Date', inspection.completedAt ? moment(inspection.completedAt).format('MMMM D, YYYY') : 'Not completed'],
      ['Total Sections', inspection.sections ? inspection.sections.length : 0],
      ['Overall Score', `${inspection.overallScore || 'N/A'}/${inspection.maxPossibleScore || 'N/A'}`]
    ];
    
    addInfoTable(doc, inspectionInfo);
    doc.moveDown(0.5);

    // ===== DETAILED SECTION ANALYSIS =====
    if (inspection.sections && inspection.sections.length > 0) {
      addSectionHeader(doc, 'DETAILED SECTION ANALYSIS');
      doc.moveDown(0.3);
      
      inspection.sections.forEach((section, index) => {
        // Section header
        doc.fontSize(11).text(`${index + 1}. ${section.name.toUpperCase()}`, {color: '#1e40af'});
        doc.moveDown(0.2);
        
        // Section details
        const sectionInfo = [
          ['Rating', `${section.rating || 'N/A'}/5`],
          ['Score', `${section.score || 'N/A'}/${section.maxScore || 'N/A'}`],
          ['Status', section.completed ? 'COMPLETED' : 'INCOMPLETE']
        ];
        
        addInfoTable(doc, sectionInfo);
        
        // Section description if available
        if (section.description) {
          doc.fontSize(9).text(`Description: ${section.description}`, {color: '#6b7280'});
          doc.moveDown(0.2);
        }
        
        // Questions analysis
        if (section.questions && section.questions.length > 0) {
          let completedQuestions = 0;
          let criticalIssues = 0;
          let failedQuestions = [];
          
          section.questions.forEach(question => {
            if (question.answer) completedQuestions++;
            if (question.answer && typeof question.answer === 'string' && 
                (question.answer.toLowerCase().includes('no') || 
                 question.answer.toLowerCase().includes('fail') ||
                 question.answer.toLowerCase().includes('issue') ||
                 question.answer.toLowerCase().includes('problem'))) {
              criticalIssues++;
              failedQuestions.push(question);
            }
          });
          
          const questionInfo = [
            ['Questions Answered', `${completedQuestions}/${section.questions.length}`],
            ['Critical Issues', criticalIssues]
          ];
          
          addInfoTable(doc, questionInfo);
          
          // Show failed questions
          if (failedQuestions.length > 0) {
            doc.fontSize(9).text('Issues Found:', {color: 'red'});
            failedQuestions.slice(0, 3).forEach((question, qIndex) => {
              doc.fontSize(8).text(`• ${question.question}: ${question.answer}`, {indent: 10, color: 'red'});
            });
            if (failedQuestions.length > 3) {
              doc.fontSize(8).text(`... and ${failedQuestions.length - 3} more issues`, {indent: 10, color: '#6b7280'});
            }
            doc.moveDown(0.2);
          }
        }
        
        doc.moveDown(0.3);
      });
    }

    // ===== OBD2 DIAGNOSTIC SUMMARY =====
    if (quote.obd2Scan && quote.obd2Scan.extractedCodes && quote.obd2Scan.extractedCodes.length > 0) {
      addSectionHeader(doc, 'OBD2 DIAGNOSTIC SUMMARY');
      doc.moveDown(0.3);
      
      const obd2Info = [
        ['Total Codes Found', quote.obd2Scan.extractedCodes.length],
        ['Critical Codes', quote.obd2Scan.criticalCodes ? quote.obd2Scan.criticalCodes.length : 0],
        ['Unknown Codes', quote.obd2Scan.extractedCodes.length - (quote.obd2Scan.criticalCodes ? quote.obd2Scan.criticalCodes.length : 0)]
      ];
      
      addInfoTable(doc, obd2Info);
      
      // Critical codes summary
      if (quote.obd2Scan.criticalCodes && quote.obd2Scan.criticalCodes.length > 0) {
        doc.moveDown(0.3);
        doc.fontSize(10).text('CRITICAL CODES:', {color: 'red'});
        quote.obd2Scan.criticalCodes.slice(0, 3).forEach((code, index) => {
          doc.fontSize(9).text(`• ${code.code}: ${code.description}`, {indent: 10});
        });
        if (quote.obd2Scan.criticalCodes.length > 3) {
          doc.fontSize(9).text(`... and ${quote.obd2Scan.criticalCodes.length - 3} more`, {indent: 10, color: '#6b7280'});
        }
      }
      doc.moveDown(0.5);
    }

    // ===== SAFETY ASSESSMENT =====
    if (inspection.safetyIssues && inspection.safetyIssues.length > 0) {
      addSectionHeader(doc, 'SAFETY ASSESSMENT');
      doc.moveDown(0.3);
      
      const severityCounts = {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      };
      
      inspection.safetyIssues.forEach(issue => {
        severityCounts[issue.severity]++;
      });
      
      const safetyInfo = [
        ['Critical Issues', severityCounts.critical],
        ['High Priority', severityCounts.high],
        ['Medium Priority', severityCounts.medium],
        ['Low Priority', severityCounts.low]
      ];
      
      addInfoTable(doc, safetyInfo);
      
      if (severityCounts.critical > 0) {
        doc.moveDown(0.3);
        doc.fontSize(10).text('⚠️  CRITICAL SAFETY ISSUES DETECTED', {color: 'red'});
      }
      doc.moveDown(0.5);
    }

    // ===== MAINTENANCE ANALYSIS =====
    if (inspection.maintenanceItems && inspection.maintenanceItems.length > 0) {
      addSectionHeader(doc, 'MAINTENANCE ANALYSIS');
      doc.moveDown(0.3);
      
      const priorityCounts = {
        high: 0,
        medium: 0,
        low: 0
      };
      
      inspection.maintenanceItems.forEach(item => {
        priorityCounts[item.priority]++;
      });
      
      const maintenanceInfo = [
        ['High Priority', priorityCounts.high],
        ['Medium Priority', priorityCounts.medium],
        ['Low Priority', priorityCounts.low]
      ];
      
      addInfoTable(doc, maintenanceInfo);
      doc.moveDown(0.5);
    }

    // ===== RISK ASSESSMENT =====
    addSectionHeader(doc, 'RISK ASSESSMENT');
    doc.moveDown(0.3);
    
    let riskScore = 0;
    let riskFactors = [];
    
    // Calculate risk score
    if (inspection.overallRating) {
      if (inspection.overallRating < 3) {
        riskScore += 3;
        riskFactors.push('Low overall inspection rating');
      } else if (inspection.overallRating < 4) {
        riskScore += 2;
        riskFactors.push('Below average inspection rating');
      }
    }
    
    if (quote.obd2Scan && quote.obd2Scan.criticalCodes && quote.obd2Scan.criticalCodes.length > 0) {
      riskScore += quote.obd2Scan.criticalCodes.length;
      riskFactors.push(`${quote.obd2Scan.criticalCodes.length} critical OBD2 codes`);
    }
    
    if (inspection.safetyIssues && inspection.safetyIssues.length > 0) {
      const criticalSafety = inspection.safetyIssues.filter(issue => issue.severity === 'critical').length;
      riskScore += criticalSafety * 2;
      if (criticalSafety > 0) {
        riskFactors.push(`${criticalSafety} critical safety issues`);
      }
    }
    
    if (vehicle.titleStatus && vehicle.titleStatus !== 'clean') {
      riskScore += 2;
      riskFactors.push('Non-clean title status');
    }
    
    if (vehicle.loanStatus === 'still-has-loan' && vehicle.loanAmount && vehicle.loanAmount > 0) {
      riskScore += 1;
      riskFactors.push('Outstanding loan balance');
    }

    const riskInfo = [
      ['Risk Score', `${riskScore}/10`],
      ['Risk Level', getRiskLevel(riskScore)]
    ];
    
    addInfoTable(doc, riskInfo);
    
    if (riskFactors.length > 0) {
      doc.moveDown(0.3);
      doc.fontSize(10).text('Risk Factors:');
      riskFactors.slice(0, 3).forEach(factor => {
        doc.fontSize(9).text(`• ${factor}`, {indent: 10});
      });
      if (riskFactors.length > 3) {
        doc.fontSize(9).text(`... and ${riskFactors.length - 3} more`, {indent: 10, color: '#6b7280'});
      }
    }
    doc.moveDown(0.5);

    // ===== PROFESSIONAL RECOMMENDATIONS =====
    if (inspection.recommendations && inspection.recommendations.length > 0) {
      addSectionHeader(doc, 'PROFESSIONAL RECOMMENDATIONS');
      doc.moveDown(0.3);
      
      inspection.recommendations.slice(0, 5).forEach((recommendation, index) => {
        doc.fontSize(10).text(`${index + 1}. ${recommendation}`);
        doc.moveDown(0.2);
      });
      
      if (inspection.recommendations.length > 5) {
        doc.fontSize(9).text(`... and ${inspection.recommendations.length - 5} more recommendations`, {color: '#6b7280'});
      }
      doc.moveDown(0.5);
    }

    // ===== VEHICLE DOCUMENTATION =====
    addSectionHeader(doc, 'VEHICLE DOCUMENTATION');
    doc.moveDown(0.3);
    
    const documentationInfo = [
      ['Title Status', vehicle.titleStatus || 'Not specified'],
      ['Title in Possession', vehicle.hasTitleInPossession ? 'Yes' : 'No'],
      ['Title in Owner\'s Name', vehicle.titleInOwnName ? 'Yes' : 'No'],
      ['Loan Status', vehicle.loanStatus || 'Not specified'],
      ['Outstanding Loan', vehicle.loanAmount ? `$${vehicle.loanAmount.toLocaleString()}` : 'None'],
      ['Second Set of Keys', vehicle.secondSetOfKeys ? 'Yes' : 'No']
    ];
    
    addInfoTable(doc, documentationInfo);
    
    if (vehicle.knownDefects) {
      doc.moveDown(0.3);
      doc.fontSize(10).text('Known Defects:');
      doc.fontSize(9).text(vehicle.knownDefects, {indent: 10});
    }
    doc.moveDown(0.5);
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
    console.error('Error generating Quote Summary PDF:', error);
    throw error;
  }
}

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
  const salePrice = billOfSale.salePrice || 0;
  doc.text(`Purchase Price: $${salePrice.toLocaleString()} Dollars (USD)`, {indent: 10});
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

/**
 * Helper function to add a section header with consistent styling
 * @param {PDFDocument} doc - The PDFKit document instance
 * @param {String} title - The section title
 */
function addSectionHeader(doc, title) {
  doc.fontSize(12).text(title, {color: '#1e40af'});
  // Add a simple line below the text instead of underline
  const currentY = doc.y;
  doc.moveDown(0.1);
  doc.moveTo(doc.x, doc.y);
  doc.lineTo(doc.x + 200, doc.y);
  doc.stroke();
  doc.moveDown(0.2);
}

/**
 * Helper function to add an information table with consistent formatting
 * @param {PDFDocument} doc - The PDFKit document instance
 * @param {Array} data - Array of [label, value] pairs
 */
function addInfoTable(doc, data) {
  data.forEach(([label, value]) => {
    // Draw label and value on the same line
    doc.fontSize(9);
    doc.text(label + ':', {continued: true, color: '#374151'});
    doc.text(' ' + (value || 'N/A'), {color: '#111827'});
    doc.moveDown(0.2);
  });
  
  doc.moveDown(0.3);
}

/**
 * Helper function to get risk level based on score
 * @param {Number} score - The risk score
 * @returns {String} - The risk level with color
 */
function getRiskLevel(score) {
  if (score >= 7) {
    return 'HIGH RISK';
  } else if (score >= 4) {
    return 'MEDIUM RISK';
  } else {
    return 'LOW RISK';
  }
}

/**
 * Generate a complete PDF package containing Quote Summary, Inspection Report, and Bill of Sale
 * @param {Object} caseData - The case data containing all information
 * @returns {Promise<Object>} - Promise resolving to the PDF file path and name
 */
async function generateCompletePDFPackage(caseData) {
  try {
    // Create upload directory if it doesn't exist
    const pdfDir = path.join(__dirname, '../../uploads/pdfs');
    fsp.mkdir(pdfDir, { recursive: true });

    // Create a unique filename
    const fileName = `complete-package-${caseData._id}-${Date.now()}.pdf`;
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
        top: 40,
        bottom: 40,
        left: 40,
        right: 40
      }
    });

    // Pipe the PDF into a file
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // ===== COVER PAGE =====
    doc.fontSize(24).text('VOS - COMPLETE CASE PACKAGE', {align: 'center', color: '#1e40af'});
    doc.moveDown(0.5);
    doc.fontSize(20).text('QUOTE SUMMARY', {align: 'center', color: '#1e40af'});
    doc.moveDown(1);

    // Vehicle identification
    addSectionHeader(doc, 'VEHICLE IDENTIFICATION');
    doc.moveDown(0.3);
    
    const vehicleInfo = [
      ['Year', vehicle.year || 'N/A'],
      ['Make', vehicle.make || 'N/A'],
      ['Model', vehicle.model || 'N/A'],
      ['VIN', vehicle.vin || 'Not provided'],
      ['Mileage', vehicle.currentMileage || 'N/A'],
      ['Color', vehicle.color || 'N/A'],
      ['Title Status', vehicle.titleStatus || 'Not specified']
    ];
    
    addInfoTable(doc, vehicleInfo);
    doc.moveDown(0.5);

    // Customer information
    addSectionHeader(doc, 'CUSTOMER INFORMATION');
    doc.moveDown(0.3);
    
    const customerInfo = [
      ['Full Name', `${customer.firstName || ''} ${customer.lastName || ''}`],
      ['Primary Phone', customer.cellPhone || 'Not provided'],
      ['Primary Email', customer.email1 || 'Not provided'],
      ['Source', getSourceLabel(customer.source) || 'Not specified']
    ];
    
    addInfoTable(doc, customerInfo);
    doc.moveDown(0.5);

    // Market value analysis
    addSectionHeader(doc, 'MARKET VALUE ANALYSIS');
    doc.moveDown(0.3);
    
    if (vehicle.estimatedValue) {
      const marketValue = vehicle.estimatedValue;
      const offerAmount = quote.offerAmount || 0;
      const difference = marketValue - offerAmount;
      const percentage = marketValue > 0 ? ((difference / marketValue) * 100) : 0;
      
      const marketInfo = [
        ['MarketCheck Value', `$${marketValue.toLocaleString()}`],
        ['VOS Offer', `$${offerAmount.toLocaleString()}`],
        ['Difference', `$${difference.toLocaleString()} (${percentage.toFixed(1)}%)`]
      ];
      
      addInfoTable(doc, marketInfo);
    } else {
      doc.fontSize(10).text('MarketCheck Estimated Value: Not available', {color: '#6b7280'});
    }
    doc.moveDown(0.5);

    // ===== INSPECTION REPORT SECTION =====
    doc.addPage();
    doc.fontSize(20).text('INSPECTION REPORT', {align: 'center', color: '#1e40af'});
    doc.moveDown(1);

    // Inspection overview
    addSectionHeader(doc, 'INSPECTION OVERVIEW');
    doc.moveDown(0.3);
    
    const inspectionInfo = [
      ['Overall Rating', `${inspection.overallRating || 'N/A'}/5`],
      ['Inspector', `${inspection.inspector?.firstName || ''} ${inspection.inspector?.lastName || ''}`],
      ['Inspection Date', inspection.completedAt ? moment(inspection.completedAt).format('MMMM D, YYYY') : 'Not completed'],
      ['Total Sections', inspection.sections ? inspection.sections.length : 0],
      ['Overall Score', `${inspection.overallScore || 'N/A'}/${inspection.maxPossibleScore || 'N/A'}`]
    ];
    
    addInfoTable(doc, inspectionInfo);
    doc.moveDown(0.5);

    // Detailed section analysis
    if (inspection.sections && inspection.sections.length > 0) {
      addSectionHeader(doc, 'DETAILED SECTION ANALYSIS');
      doc.moveDown(0.3);
      
      inspection.sections.forEach((section, index) => {
        doc.fontSize(11).text(`${index + 1}. ${section.name.toUpperCase()}`, {color: '#1e40af'});
        doc.moveDown(0.2);
        
        const sectionInfo = [
          ['Rating', `${section.rating || 'N/A'}/5`],
          ['Score', `${section.score || 'N/A'}/${section.maxScore || 'N/A'}`],
          ['Status', section.completed ? 'COMPLETED' : 'INCOMPLETE']
        ];
        
        addInfoTable(doc, sectionInfo);
        
        if (section.description) {
          doc.fontSize(9).text(`Description: ${section.description}`, {color: '#6b7280'});
          doc.moveDown(0.2);
        }
        
        doc.moveDown(0.3);
      });
    }

    // OBD2 diagnostic summary
    if (quote.obd2Scan && quote.obd2Scan.extractedCodes && quote.obd2Scan.extractedCodes.length > 0) {
      addSectionHeader(doc, 'OBD2 DIAGNOSTIC SUMMARY');
      doc.moveDown(0.3);
      
      const obd2Info = [
        ['Total Codes Found', quote.obd2Scan.extractedCodes.length],
        ['Critical Codes', quote.obd2Scan.criticalCodes ? quote.obd2Scan.criticalCodes.length : 0]
      ];
      
      addInfoTable(doc, obd2Info);
      doc.moveDown(0.5);
    }

    // Safety assessment
    if (inspection.safetyIssues && inspection.safetyIssues.length > 0) {
      addSectionHeader(doc, 'SAFETY ASSESSMENT');
      doc.moveDown(0.3);
      
      const severityCounts = {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      };
      
      inspection.safetyIssues.forEach(issue => {
        severityCounts[issue.severity]++;
      });
      
      const safetyInfo = [
        ['Critical Issues', severityCounts.critical],
        ['High Priority', severityCounts.high],
        ['Medium Priority', severityCounts.medium],
        ['Low Priority', severityCounts.low]
      ];
      
      addInfoTable(doc, safetyInfo);
      doc.moveDown(0.5);
    }

    // Professional recommendations
    if (inspection.recommendations && inspection.recommendations.length > 0) {
      addSectionHeader(doc, 'PROFESSIONAL RECOMMENDATIONS');
      doc.moveDown(0.3);
      
      inspection.recommendations.slice(0, 5).forEach((recommendation, index) => {
        doc.fontSize(10).text(`${index + 1}. ${recommendation}`);
        doc.moveDown(0.2);
      });
      
      if (inspection.recommendations.length > 5) {
        doc.fontSize(9).text(`... and ${inspection.recommendations.length - 5} more recommendations`, {color: '#6b7280'});
      }
      doc.moveDown(0.5);
    }

    // ===== BILL OF SALE SECTION =====
    doc.addPage();
    doc.fontSize(20).text('BILL OF SALE', {align: 'center', color: '#1e40af'});
    doc.moveDown(1);

    // Add the complete bill of sale content
    addBillOfSaleContent(doc, customer, vehicle, transaction.billOfSale || {});

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
    console.error('Error generating Complete PDF Package:', error);
    throw error;
  }
}

module.exports = {
  generateBillOfSalePDF,
  generateCasePDF,
  generateQuoteSummaryPDF,
  generateCompletePDFPackage,
};