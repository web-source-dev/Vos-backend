const nodemailer = require('nodemailer');

// Email transport configuration
let transporter;
  // Production configuration (using SMTP)
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

/**
 * Send email to inspector with inspection link
 * @param {Object} inspectionData - The inspection data
 * @param {Object} customerData - The customer data
 * @param {Object} vehicleData - The vehicle data
 * @param {String} baseUrl - The base URL for the application
 * @returns {Promise} - Promise resolving to the email info
 */
async function sendInspectionEmail(inspectionData, customerData, vehicleData, baseUrl) {
  const inspectionUrl = `${baseUrl}/inspector/${inspectionData.accessToken}`;
  
  const formattedDate = new Date(inspectionData.scheduledDate).toLocaleDateString();
  
  const mailOptions = {
    from: process.env.EMAIL_FROM || '"VOS System" <no-reply@vossystem.com>',
    to: inspectionData.inspector.email,
    subject: `Vehicle Inspection Request - ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3b82f6;">Vehicle Inspection Request</h2>
        <p>Hello ${inspectionData.inspector.firstName} ${inspectionData.inspector.lastName},</p>
        <p>You have been assigned to inspect the following vehicle:</p>
        
        <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Customer:</strong> ${customerData.firstName} ${customerData.lastName}</p>
          <p><strong>Vehicle:</strong> ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}</p>
          <p><strong>VIN:</strong> ${vehicleData.vin || 'Not provided'}</p>
          <p><strong>Scheduled Date:</strong> ${formattedDate}</p>
          <p><strong>Time Slot:</strong> ${inspectionData.scheduledTime}</p>
        </div>
        
        <p>Please click the link below to access the inspection form:</p>
        
        <p style="margin: 20px 0;">
          <a href="${inspectionUrl}" style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Start Vehicle Inspection
          </a>
        </p>
        
        <p style="color: #6b7280; font-size: 14px;">Note: This link is unique to you and does not require login. Please do not share this link with others.</p>
        
        <p>Thank you for your assistance.</p>
        <p>VOS System Team</p>
      </div>
    `
  };

  try {
    // For development, create a test account if needed
    if (process.env.NODE_ENV !== 'production' && 
        (!transporter.options.auth.user || transporter.options.auth.user === 'ethereal.user@ethereal.email')) {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    }

    const info = await transporter.sendMail(mailOptions);
    
    // In development, log the Ethereal URL to view the email
    if (process.env.NODE_ENV !== 'production') {
      console.log('Inspection Email URL: %s', nodemailer.getTestMessageUrl(info));
    }
    
    return info;
  } catch (error) {
    console.error('Error sending inspection email:', error);
    throw error;
  }
};

/**
 * Send email to estimator with quote preparation link
 * @param {Object} quoteData - The quote data
 * @param {Object} inspectionData - The inspection data
 * @param {Object} customerData - The customer data
 * @param {Object} vehicleData - The vehicle data
 * @param {String} baseUrl - The base URL for the application
 * @returns {Promise} - Promise resolving to the email info
 */
async function sendEstimatorEmail(quoteData, inspectionData, customerData, vehicleData, baseUrl) {
  const quoteUrl = `${baseUrl}/estimator/${quoteData.accessToken}`;
  
  const mailOptions = {
    from: process.env.EMAIL_FROM || '"VOS System" <no-reply@vossystem.com>',
    to: quoteData.estimator.email,
    subject: `Quote Preparation Request - ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3b82f6;">Quote Preparation Request</h2>
        <p>Hello ${quoteData.estimator.firstName} ${quoteData.estimator.lastName},</p>
        <p>You have been assigned to prepare a quote for the following vehicle:</p>
        
        <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Customer:</strong> ${customerData.firstName} ${customerData.lastName}</p>
          <p><strong>Vehicle:</strong> ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}</p>
          <p><strong>VIN:</strong> ${vehicleData.vin || 'Not provided'}</p>
          <p><strong>Overall Inspection Rating:</strong> ${inspectionData.overallRating || 'Not yet rated'}/5</p>
          <p><strong>Estimated Value:</strong> $${quoteData.estimatedValue?.toLocaleString() || 'To be determined'}</p>
        </div>
        
        <p>Please click the link below to access the complete workflow (Quote Preparation → Offer Decision → Paperwork → Completion):</p>
        
        <p style="margin: 20px 0;">
          <a href="${quoteUrl}" style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Start Complete Workflow
          </a>
        </p>
        
        <p style="color: #6b7280; font-size: 14px;">Note: This link is unique to you and does not require login. Please do not share this link with others.</p>
        
        <p>You will be able to complete all remaining steps in the process:</p>
        <ul style="color: #6b7280; font-size: 14px;">
          <li>Quote Preparation</li>
          <li>Offer Decision</li>
          <li>Paperwork & Payment</li>
          <li>Case Completion</li>
        </ul>
        
        <p>Thank you for your assistance.</p>
        <p>VOS System Team</p>
      </div>
    `
  };

  try {
    // For development, create a test account if needed
    if (process.env.NODE_ENV !== 'production' && 
        (!transporter.options.auth.user || transporter.options.auth.user === 'ethereal.user@ethereal.email')) {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    }

    const info = await transporter.sendMail(mailOptions);
    
    // In development, log the Ethereal URL to view the email
    if (process.env.NODE_ENV !== 'production') {
      console.log('Estimator Email URL: %s', nodemailer.getTestMessageUrl(info));
    }
    
    return info;
  } catch (error) {
    console.error('Error sending estimator email:', error);
    throw error;
  }
};

/**
 * Send confirmation email to customer
 * @param {Object} customerData - The customer data
 * @param {Object} vehicleData - The vehicle data
 * @param {Object} transactionData - The transaction data
 * @param {String} pdfUrl - The URL to the case file PDF
 * @param {String} baseUrl - The base URL for the application
 * @returns {Promise} - Promise resolving to the email info
 */
async function sendCustomerConfirmationEmail(customerData, vehicleData, transactionData, pdfUrl, baseUrl) {
  // Add null checks and default values
  const customer = customerData || {};
  const vehicle = vehicleData || {};
  const transaction = transactionData || {};
  const billOfSale = transaction.billOfSale || {};

  const mailOptions = {
    from: process.env.EMAIL_FROM || '"VOS System" <no-reply@vossystem.com>',
    to: customer.email1 || customer.email || 'customer@example.com',
    subject: `Vehicle Purchase Confirmation - ${vehicle.year || 'Unknown'} ${vehicle.make || 'Unknown'} ${vehicle.model || 'Unknown'}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3b82f6;">Vehicle Purchase Confirmation</h2>
        <p>Hello ${customer.firstName || 'Valued Customer'},</p>
        <p>Thank you for selling your vehicle to VOS. Your transaction has been completed successfully!</p>
        
        <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Vehicle:</strong> ${vehicle.year || 'Unknown'} ${vehicle.make || 'Unknown'} ${vehicle.model || 'Unknown'}</p>
          <p><strong>VIN:</strong> ${vehicle.vin || 'Not provided'}</p>
          <p><strong>Sale Amount:</strong> ${billOfSale.salePrice ? `$${billOfSale.salePrice.toLocaleString()}` : 'Amount to be determined'}</p>
          <p><strong>Sale Date:</strong> ${billOfSale.saleDate ? new Date(billOfSale.saleDate).toLocaleDateString() : 'Date to be determined'}</p>
          <p><strong>Payment Method:</strong> ${billOfSale.paymentMethod || 'To be determined'}</p>
        </div>
        
        <p>Please click the link below to download a copy of your case file:</p>
        
        <p style="margin: 20px 0;">
          <a href="${pdfUrl}" style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Download Case File
          </a>
        </p>
        
        <p>We appreciate your business and would love to hear about your experience. Please take a moment to leave us a review.</p>
        
        <div style="margin: 20px 0;">
          <a href="${baseUrl}/review/google" style="background: #ea4335; color: white; padding: 8px 15px; text-decoration: none; border-radius: 5px; margin-right: 10px;">
            Google Review
          </a>
          <a href="${baseUrl}/review/facebook" style="background: #3b5998; color: white; padding: 8px 15px; text-decoration: none; border-radius: 5px; margin-right: 10px;">
            Facebook Review
          </a>
          <a href="${baseUrl}/review/yelp" style="background: #d32323; color: white; padding: 8px 15px; text-decoration: none; border-radius: 5px;">
            Yelp Review
          </a>
        </div>
        
        <p>If you have any questions regarding your transaction, please don't hesitate to contact us.</p>
        <p>Thank you for choosing VOS!</p>
        <p>The VOS Team</p>
      </div>
    `
  };

  try {
    // For development, create a test account if needed
    if (process.env.NODE_ENV !== 'production' && 
        (!transporter.options.auth.user || transporter.options.auth.user === 'ethereal.user@ethereal.email')) {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    }

    const info = await transporter.sendMail(mailOptions);
    
    // In development, log the Ethereal URL to view the email
    if (process.env.NODE_ENV !== 'production') {
      console.log('Customer Confirmation Email URL: %s', nodemailer.getTestMessageUrl(info));
    }
    
    return info;
  } catch (error) {
    console.error('Error sending customer confirmation email:', error);
    throw error;
  }
};

/**
 * Send email to customer with quote update
 * @param {Object} quoteData - The quote data
 * @param {Object} customerData - The customer data
 * @param {Object} vehicleData - The vehicle data
 * @param {String} baseUrl - The base URL for the application
 * @returns {Promise} - Promise resolving to the email info
 */
async function sendQuoteUpdateEmail(quoteData, customerData, vehicleData, baseUrl) {
  const mailOptions = {
    from: process.env.EMAIL_FROM || '"VOS System" <no-reply@vossystem.com>',
    to: customerData.email1,
    subject: `Vehicle Quote Update - ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3b82f6;">Vehicle Quote Update</h2>
        <p>Hello ${customerData.firstName},</p>
        <p>We have an update regarding the quote for your vehicle:</p>
        
        <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Vehicle:</strong> ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}</p>
          <p><strong>VIN:</strong> ${vehicleData.vin || 'Not provided'}</p>
          <p><strong>Offer Amount:</strong> $${quoteData.offerAmount.toLocaleString()}</p>
          <p><strong>Valid Until:</strong> ${new Date(quoteData.expiryDate).toLocaleDateString()}</p>
          ${quoteData.notes ? `<p><strong>Additional Notes:</strong> ${quoteData.notes}</p>` : ''}
        </div>
        
        <p>Please contact us to discuss this offer or to schedule the next steps.</p>
        
        <p>Thank you for choosing VOS!</p>
        <p>The VOS Team</p>
      </div>
    `
  };

  return await sendEmail(mailOptions);
};

/**
 * Send email to customer about negotiation status
 * @param {Object} quoteData - The quote data
 * @param {Object} customerData - The customer data
 * @param {Object} vehicleData - The vehicle data
 * @param {String} baseUrl - The base URL for the application
 * @returns {Promise} - Promise resolving to the email info
 */
async function sendNegotiationUpdateEmail(quoteData, customerData, vehicleData, baseUrl) {
  const mailOptions = {
    from: process.env.EMAIL_FROM || '"VOS System" <no-reply@vossystem.com>',
    to: customerData.email1,
    subject: `Quote Negotiation Update - ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3b82f6;">Quote Negotiation Update</h2>
        <p>Hello ${customerData.firstName},</p>
        
        <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Vehicle:</strong> ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}</p>
          <p><strong>Original Offer:</strong> $${quoteData.offerAmount.toLocaleString()}</p>
          ${quoteData.offerDecision?.counterOffer ? 
            `<p><strong>Your Counter Offer:</strong> $${quoteData.offerDecision.counterOffer.toLocaleString()}</p>` : ''}
          ${quoteData.offerDecision?.finalAmount ? 
            `<p><strong>Final Agreed Amount:</strong> $${quoteData.offerDecision.finalAmount.toLocaleString()}</p>` : ''}
          ${quoteData.offerDecision?.customerNotes ? 
            `<p><strong>Your Notes:</strong> ${quoteData.offerDecision.customerNotes}</p>` : ''}
        </div>
        
        <p>Current Status: <strong>${quoteData.status}</strong></p>
        
        <p>Please contact us to discuss this further or to proceed with the transaction.</p>
        
        <p>Thank you for your interest in VOS!</p>
        <p>The VOS Team</p>
      </div>
    `
  };

  return await sendEmail(mailOptions);
};

/**
 * Send email notification when inspection is completed
 * @param {Object} inspectionData - The inspection data
 * @param {Object} customerData - The customer data
 * @param {Object} vehicleData - The vehicle data
 * @param {String} baseUrl - The base URL for the application
 * @returns {Promise} - Promise resolving to the email info
 */
async function sendInspectionCompletedEmail(inspectionData, customerData, vehicleData, baseUrl) {
  const mailOptions = {
    from: process.env.EMAIL_FROM || '"VOS System" <no-reply@vossystem.com>',
    to: customerData.email1,
    subject: `Vehicle Inspection Completed - ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3b82f6;">Vehicle Inspection Complete</h2>
        <p>Hello ${customerData.firstName},</p>
        <p>The inspection of your vehicle has been completed. Here are the details:</p>
        
        <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Vehicle:</strong> ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}</p>
          <p><strong>VIN:</strong> ${vehicleData.vin || 'Not provided'}</p>
          <p><strong>Inspector:</strong> ${inspectionData.inspector.firstName} ${inspectionData.inspector.lastName}</p>
          <p><strong>Overall Rating:</strong> ${inspectionData.overallRating}/5</p>
          <p><strong>Completed On:</strong> ${new Date(inspectionData.completedAt).toLocaleDateString()}</p>
        </div>
        
        <div style="margin: 20px 0;">
          <h3 style="color: #4b5563;">Inspection Summary</h3>
          ${inspectionData.sections.map(section => `
            <div style="margin: 10px 0; padding: 10px; border: 1px solid #e5e7eb; border-radius: 5px;">
              <p style="margin: 0;"><strong>${section.name}:</strong> ${section.rating}/5</p>
              ${section.notes ? `<p style="margin: 5px 0; color: #6b7280;">${section.notes}</p>` : ''}
              ${section.photos?.length ? `<p style="margin: 5px 0; color: #6b7280;">${section.photos.length} photos taken</p>` : ''}
            </div>
          `).join('')}
        </div>
        
        <p>Our team will review the inspection results and prepare a quote for your vehicle. You will receive another email once the quote is ready.</p>
        
        <p>Thank you for choosing VOS!</p>
        <p>The VOS Team</p>
      </div>
    `
  };

  try {
    // For development, create a test account if needed
    if (process.env.NODE_ENV !== 'production' && 
        (!transporter.options.auth.user || transporter.options.auth.user === 'ethereal.user@ethereal.email')) {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    }

    const info = await transporter.sendMail(mailOptions);
    
    // In development, log the Ethereal URL to view the email
    if (process.env.NODE_ENV !== 'production') {
      console.log('Inspection Completion Email URL: %s', nodemailer.getTestMessageUrl(info));
    }
    
    return info;
  } catch (error) {
    console.error('Error sending inspection completion email:', error);
    throw error;
  }
};

/**
 * Helper function to handle email sending with development/production logic
 * @param {Object} mailOptions - The email options
 * @returns {Promise} - Promise resolving to the email info
 */
async function sendEmail(mailOptions) {
  try {
    // For development, create a test account if needed
    if (process.env.NODE_ENV !== 'production' && 
        (!transporter.options.auth.user || transporter.options.auth.user === 'ethereal.user@ethereal.email')) {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    }

    const info = await transporter.sendMail(mailOptions);
    
    // In development, log the Ethereal URL to view the email
    if (process.env.NODE_ENV !== 'production') {
      console.log('Email URL: %s', nodemailer.getTestMessageUrl(info));
    }
    
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

// Send quote email to customer
exports.sendQuoteEmail = async (customer, vehicle, quote, baseUrl) => {
  try {
    const offerAmount = quote.offerAmount ? quote.offerAmount.toLocaleString() : 'N/A';
    const expiryDate = quote.expiryDate ? new Date(quote.expiryDate).toLocaleDateString() : 'N/A';
    
    const emailContent = `
      <h2>Your Vehicle Offer</h2>
      <p>Dear ${customer.firstName} ${customer.lastName},</p>
      <p>We're pleased to present you with an offer for your ${vehicle.year} ${vehicle.make} ${vehicle.model}.</p>
      
      <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 5px;">
        <h3 style="color: #2d8a2d; margin-top: 0;">Offer Amount: $${offerAmount}</h3>
        <p>This offer is valid until: ${expiryDate}</p>
      </div>
      
      <p>To accept or decline this offer, please visit our website or contact us directly.</p>
      
      <p>Thank you for choosing our service.</p>
      <p>Best regards,<br>The VOS Team</p>
    `;
    
    // Send the email (implementation depends on your email provider)
    // This is a placeholder for the actual email sending logic
    console.log(`Sending quote email to ${customer.email1} for vehicle ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
    
    return {
      success: true,
      message: `Quote email sent to ${customer.email1}`
    };
  } catch (error) {
    console.error('Error sending quote email:', error);
    throw error;
  }
};

// Send decision confirmation email
exports.sendDecisionEmail = async (customer, vehicle, quote, baseUrl) => {
  try {
    const offerAmount = quote.offerAmount ? quote.offerAmount.toLocaleString() : 'N/A';
    const decision = quote.offerDecision?.decision || 'pending';
    
    let subject, heading, message;
    
    if (decision === 'accepted') {
      subject = 'Your Offer Acceptance Confirmation';
      heading = 'Offer Acceptance Confirmed';
      message = `
        <p>We're pleased to confirm that you've accepted our offer of $${offerAmount} for your ${vehicle.year} ${vehicle.make} ${vehicle.model}.</p>
        <p>Next steps:</p>
        <ol>
          <li>Please prepare your vehicle title and other documentation</li>
          <li>Our team will contact you shortly to schedule the final paperwork</li>
          <li>Payment will be processed once all documentation is complete</li>
        </ol>
      `;
    } else if (decision === 'declined') {
      subject = 'Your Offer Decision Confirmation';
      heading = 'Offer Decline Confirmed';
      message = `
        <p>We confirm that you've declined our offer of $${offerAmount} for your ${vehicle.year} ${vehicle.make} ${vehicle.model}.</p>
        <p>We appreciate your consideration and would be happy to assist you in the future if you change your mind.</p>
      `;
    } else {
      subject = 'Your Offer Status Update';
      heading = 'Offer Status Update';
      message = `
        <p>This email confirms the current status of our offer of $${offerAmount} for your ${vehicle.year} ${vehicle.make} ${vehicle.model}.</p>
        <p>If you have any questions or would like to discuss the offer further, please don't hesitate to contact us.</p>
      `;
    }
    
    const emailContent = `
      <h2>${heading}</h2>
      <p>Dear ${customer.firstName} ${customer.lastName},</p>
      ${message}
      <p>Thank you for choosing our service.</p>
      <p>Best regards,<br>The VOS Team</p>
    `;
    
    // Send the email (implementation depends on your email provider)
    // This is a placeholder for the actual email sending logic
    console.log(`Sending decision email to ${customer.email1} for vehicle ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
    
    return {
      success: true,
      message: `Decision email sent to ${customer.email1}`
    };
  } catch (error) {
    console.error('Error sending decision email:', error);
    throw error;
  }
};

/**
 * Send email to customer with document for signing
 * @param {String} recipientEmail - Customer's email
 * @param {String} recipientName - Customer's name
 * @param {Object} vehicleData - Vehicle data
 * @param {String} signingUrl - URL for signing the document
 * @param {String} documentType - Type of document to sign
 * @param {Date} expiresAt - When the signing link expires
 * @returns {Promise} - Promise resolving to the email info
 */    
exports.sendDocumentForSigningEmail = async (
  recipientEmail,
  recipientName,
  vehicleData,
  signingUrl,
  documentType,
  expiresAt
) => {
  // Format document type for display
  const formattedDocumentType = documentType
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // Format expiry date
  const expiryDate = new Date(expiresAt).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const mailOptions = {
    from: process.env.EMAIL_FROM || '"VOS System" <no-reply@vossystem.com>',
    to: recipientEmail,
    subject: `Please sign your ${formattedDocumentType} - ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3b82f6;">Document Ready for Signature</h2>
        <p>Hello ${recipientName},</p>
        <p>Your ${formattedDocumentType} for the following vehicle is ready for your signature:</p>
        
        <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Vehicle:</strong> ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}</p>
          <p><strong>VIN:</strong> ${vehicleData.vin || 'Not provided'}</p>
          <p><strong>Document:</strong> ${formattedDocumentType}</p>
          <p><strong>Expires:</strong> ${expiryDate}</p>
        </div>
        
        <p>Please click the button below to review and sign your document:</p>
        
        <p style="margin: 20px 0;">
          <a href="${signingUrl}" style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Sign Document
          </a>
        </p>
        
        <p style="color: #6b7280; font-size: 14px;">
          This link will expire on ${expiryDate}. If you need assistance, please contact us directly.
        </p>
        
        <p>Thank you for choosing VOS!</p>
        <p>The VOS Team</p>
      </div>
    `
  };

  try {
    // For development, create a test account if needed
    if (process.env.NODE_ENV !== 'production' && 
        (!transporter.options.auth.user || transporter.options.auth.user === 'ethereal.user@ethereal.email')) {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    }

    const info = await transporter.sendMail(mailOptions);
    
    // In development, log the Ethereal URL to view the email
    if (process.env.NODE_ENV !== 'production') {
      console.log('Document Signing Email URL: %s', nodemailer.getTestMessageUrl(info));
    }
    
    return info;
  } catch (error) {
    console.error('Error sending document signing email:', error);
    throw error;
  }
};

/**
 * Send email confirming document has been signed
 * @param {String} recipientEmail - Customer's email
 * @param {String} recipientName - Customer's name
 * @param {Object} vehicleData - Vehicle data
 * @param {String} signedDocumentUrl - URL to download the signed document
 * @param {String} documentType - Type of document that was signed
 * @returns {Promise} - Promise resolving to the email info
 */
exports.sendSigningCompletionEmail = async (
  recipientEmail,
  recipientName,
  vehicleData,
  signedDocumentUrl,
  documentType
) => {
  // Format document type for display
  const formattedDocumentType = documentType
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const mailOptions = {
    from: process.env.EMAIL_FROM || '"VOS System" <no-reply@vossystem.com>',
    to: recipientEmail,
    subject: `${formattedDocumentType} Signed Successfully - ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3b82f6;">Document Signed Successfully</h2>
        <p>Hello ${recipientName},</p>
        <p>Thank you for signing the ${formattedDocumentType} for your vehicle:</p>
        
        <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Vehicle:</strong> ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}</p>
          <p><strong>VIN:</strong> ${vehicleData.vin || 'Not provided'}</p>
          <p><strong>Document:</strong> ${formattedDocumentType}</p>
          <p><strong>Signed Date:</strong> ${new Date().toLocaleDateString()}</p>
        </div>
        
        <p>You can download a copy of your signed document by clicking the button below:</p>
        
        <p style="margin: 20px 0;">
          <a href="${signedDocumentUrl}" style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Download Signed Document
          </a>
        </p>
        
        <p>If you have any questions about this document or the next steps in the process, please don't hesitate to contact us.</p>
        
        <p>Thank you for choosing VOS!</p>
        <p>The VOS Team</p>
      </div>
    `
  };

  try {
    // For development, create a test account if needed
    if (process.env.NODE_ENV !== 'production' && 
        (!transporter.options.auth.user || transporter.options.auth.user === 'ethereal.user@ethereal.email')) {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    }

    const info = await transporter.sendMail(mailOptions);
    
    // In development, log the Ethereal URL to view the email
    if (process.env.NODE_ENV !== 'production') {
      console.log('Signing Completion Email URL: %s', nodemailer.getTestMessageUrl(info));
    }
    
    return info;
  } catch (error) {
    console.error('Error sending signing completion email:', error);
    throw error;
  }
}; 

// Send customer intake notification to admin
async function sendCustomerIntakeNotification(customer, vehicle, caseData, baseUrl) {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@vos.com';
    
    const subject = `New Customer Intake: ${customer.firstName} ${customer.lastName}`;
    
    // Add the source information to the email context
    function getSourceLabel(sourceKey) {
      if (!sourceKey) return 'Not specified';
      
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
    
    // Add source to the email template
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">
          New Customer Intake Submission
        </h2>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #1e293b; margin-top: 0;">Customer Information</h3>
          <p><strong>Name:</strong> ${customer.firstName} ${customer.middleInitial} ${customer.lastName}</p>
          <p><strong>Phone:</strong> ${customer.cellPhone}</p>
          <p><strong>Email:</strong> ${customer.email1}</p>
          <p><strong>Source:</strong> ${getSourceLabel(customer.source)}</p>
          ${customer.homePhone ? `<p><strong>Home Phone:</strong> ${customer.homePhone}</p>` : ''}
          ${customer.email2 ? `<p><strong>Secondary Email:</strong> ${customer.email2}</p>` : ''}
          ${customer.hearAboutVOS ? `<p><strong>Heard about VOS:</strong> ${customer.hearAboutVOS}</p>` : ''}
          ${customer.receivedOtherQuote ? `<p><strong>Other Quote:</strong> ${customer.otherQuoteOfferer} - $${customer.otherQuoteAmount}</p>` : ''}
          ${customer.notes ? `<p><strong>Notes:</strong> ${customer.notes}</p>` : ''}
        </div>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #1e293b; margin-top: 0;">Vehicle Information</h3>
          <p><strong>Vehicle:</strong> ${vehicle.year} ${vehicle.make} ${vehicle.model}</p>
          <p><strong>Mileage:</strong> ${vehicle.currentMileage}</p>
          ${vehicle.vin ? `<p><strong>VIN:</strong> ${vehicle.vin}</p>` : ''}
          ${vehicle.color ? `<p><strong>Color:</strong> ${vehicle.color}</p>` : ''}
          ${vehicle.bodyStyle ? `<p><strong>Body Style:</strong> ${vehicle.bodyStyle}</p>` : ''}
          <p><strong>Title Status:</strong> ${vehicle.titleStatus}</p>
          <p><strong>Loan Status:</strong> ${vehicle.loanStatus}</p>
          ${vehicle.loanStatus === 'still-has-loan' && vehicle.loanAmount ? `<p><strong>Loan Amount:</strong> $${vehicle.loanAmount}</p>` : ''}
          ${vehicle.secondSetOfKeys ? '<p><strong>Second Set of Keys:</strong> Yes</p>' : ''}
          ${vehicle.knownDefects ? `<p><strong>Known Defects:</strong> ${vehicle.knownDefects}</p>` : ''}
        </div>
        
        <div style="background-color: #dbeafe; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
          <h3 style="color: #1e40af; margin-top: 0;">Next Steps</h3>
          <p style="margin-bottom: 10px;"><strong>Case ID:</strong> ${caseData._id}</p>
          <p style="margin-bottom: 10px;">This customer intake has been automatically created in the system.</p>
          <p style="margin-bottom: 15px;">Please assign an agent and proceed with the inspection scheduling.</p>
          
          <a href="${baseUrl}/admin/customers" 
             style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            View in Admin Dashboard
          </a>
        </div>
        
        <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
          <p style="margin: 0; color: #92400e;"><strong>Note:</strong> This customer intake was submitted through the public form and requires agent assignment.</p>
        </div>
      </div>
    `;
    
    const textContent = `
New Customer Intake Submission

Customer Information:
Name: ${customer.firstName} ${customer.middleInitial} ${customer.lastName}
Phone: ${customer.cellPhone}
Email: ${customer.email1}
Source: ${getSourceLabel(customer.source)}
${customer.homePhone ? `Home Phone: ${customer.homePhone}` : ''}
${customer.email2 ? `Secondary Email: ${customer.email2}` : ''}
${customer.hearAboutVOS ? `Heard about VOS: ${customer.hearAboutVOS}` : ''}
${customer.receivedOtherQuote ? `Other Quote: ${customer.otherQuoteOfferer} - $${customer.otherQuoteAmount}` : ''}
${customer.notes ? `Notes: ${customer.notes}` : ''}

Vehicle Information:
Vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model}
Mileage: ${vehicle.currentMileage}
${vehicle.vin ? `VIN: ${vehicle.vin}` : ''}
${vehicle.color ? `Color: ${vehicle.color}` : ''}
${vehicle.bodyStyle ? `Body Style: ${vehicle.bodyStyle}` : ''}
Title Status: ${vehicle.titleStatus}
Loan Status: ${vehicle.loanStatus}
${vehicle.loanStatus === 'still-has-loan' && vehicle.loanAmount ? `Loan Amount: $${vehicle.loanAmount}` : ''}
${vehicle.secondSetOfKeys ? 'Second Set of Keys: Yes' : ''}
${vehicle.knownDefects ? `Known Defects: ${vehicle.knownDefects}` : ''}

Next Steps:
Case ID: ${caseData._id}
This customer intake has been automatically created in the system.
Please assign an agent and proceed with the inspection scheduling.

View in Admin Dashboard: ${baseUrl}/admin/customers

Note: This customer intake was submitted through the public form and requires agent assignment.
    `;
    
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: adminEmail,
      subject: subject,
      text: textContent,
      html: htmlContent
    };
    
    await sendEmail(mailOptions);
    console.log('Customer intake notification email sent to admin');
    
  } catch (error) {
    console.error('Error sending customer intake notification email:', error);
    throw error;
  }
}

module.exports = {
  sendCustomerIntakeNotification,
  sendInspectionEmail,
  sendEstimatorEmail,
  sendCustomerConfirmationEmail,
  sendQuoteUpdateEmail,
  sendNegotiationUpdateEmail,
  sendInspectionCompletedEmail
}; 