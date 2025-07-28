const nodemailer = require('nodemailer');
const User = require('../models/User');

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
 * Get all admin users from the database
 * @returns {Promise<Array>} Array of admin user objects
 */
async function getAllAdminUsers() {
  try {
    const adminUsers = await User.find({ role: 'admin' }).select('email firstName lastName');
    return adminUsers;
  } catch (error) {
    console.error('Error fetching admin users:', error);
    // Fallback to environment variable if database query fails
    const fallbackEmail = process.env.ADMIN_EMAIL || 'admin@vossystem.com';
    return [{ email: fallbackEmail, firstName: 'Admin', lastName: 'User' }];
  }
}

/**
 * Send email to multiple recipients
 * @param {Object} mailOptions - The email options
 * @param {Array} recipients - Array of recipient objects with email property
 * @returns {Promise} - Promise resolving to the email info
 */
async function sendEmailToMultipleRecipients(mailOptions, recipients) {
  try {
    const emailAddresses = recipients.map(recipient => recipient.email).filter(email => email);
    
    if (emailAddresses.length === 0) {
      console.warn('No valid email addresses found for admin notification');
      return null;
    }

    const multiRecipientMailOptions = {
      ...mailOptions,
      to: emailAddresses.join(', ')
    };

    const info = await transporter.sendMail(multiRecipientMailOptions);

    
    return info;
  } catch (error) {
    console.error('Error sending email to multiple recipients:', error);
    throw error;
  }
}

/**
 * Send email to inspector with inspection link
 * @param {Object} inspectionData - The inspection data
 * @param {Object} customerData - The customer data
 * @param {Object} vehicleData - The vehicle data
 * @param {String} baseUrl - The base URL for the application
 * @returns {Promise} - Promise resolving to the email info
 */
async function sendInspectionEmail(inspectionData, customerData, vehicleData, baseUrl) {
  const inspectionUrl = `${baseUrl}/inspection/${inspectionData.accessToken}`;
  
  const formattedDate = new Date(inspectionData.scheduledDate).toLocaleDateString();
  const formattedDueDate = inspectionData.dueByDate ? new Date(inspectionData.dueByDate).toLocaleDateString() : 'Not specified';
  const formattedDueTime = inspectionData.dueByTime || 'Not specified';
  
  const mailOptions = {
    from: process.env.EMAIL_FROM || '"VIN On Spot" <no-reply@vossystem.com>',
    to: inspectionData.inspector.email,
    subject: `VIN On Spot: Vehicle Inspection Request - ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3b82f6;">VIN On Spot: Vehicle Inspection Request</h2>
        <p>Hello ${inspectionData.inspector.firstName} ${inspectionData.inspector.lastName},</p>
        <p>You have been assigned to inspect the following vehicle:</p>
        
        <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #1e293b; margin-top: 0;">Customer Information</h3>
          <p><strong>Customer:</strong> ${customerData.firstName} ${customerData.middleInitial || ''} ${customerData.lastName}</p>
          <p><strong>Phone:</strong> ${customerData.cellPhone}</p>
          <p><strong>Email:</strong> ${customerData.email1}</p>
        </div>
        
        <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #1e293b; margin-top: 0;">Vehicle Information</h3>
          <p><strong>Vehicle:</strong> ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}</p>
          <p><strong>VIN:</strong> ${vehicleData.vin || 'Not provided'}</p>
          <p><strong>Mileage:</strong> ${vehicleData.currentMileage}</p>
          ${vehicleData.color ? `<p><strong>Color:</strong> ${vehicleData.color}</p>` : ''}
          ${vehicleData.bodyStyle ? `<p><strong>Body Style:</strong> ${vehicleData.bodyStyle}</p>` : ''}
        </div>
        
        <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #1e293b; margin-top: 0;">Inspection Schedule</h3>
          <p><strong>Scheduled Date:</strong> ${formattedDate}</p>
          <p><strong>Time Slot:</strong> ${inspectionData.scheduledTime}</p>
          <p><strong>Due Date:</strong> ${formattedDueDate}</p>
          <p><strong>Due Time:</strong> ${formattedDueTime}</p>
        </div>
        
        ${inspectionData.notesForInspector ? `
          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <h3 style="color: #92400e; margin-top: 0;">Note</h3>
            <p style="margin: 0; color: #92400e;">${inspectionData.notesForInspector}</p>
          </div>
        ` : ''}
        
        <div style="background: #dbeafe; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
          <h3 style="color: #1e40af; margin-top: 0;">Next Steps</h3>
          <p style="margin-bottom: 10px;">Please complete the inspection by the due date and time specified above.</p>
          <p style="margin-bottom: 15px;">Click the button below to access the inspection form:</p>
          
          <a href="${inspectionUrl}" style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Start Vehicle Inspection
          </a>
        </div>
        <p>Thank you for your assistance.</p>
        <p>VIN on Spot</p>
      </div>
    `
  };

  try {
 
    const info = await transporter.sendMail(mailOptions);
    
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
    from: process.env.EMAIL_FROM || '"VIN On Spot" <no-reply@vossystem.com>',
    to: quoteData.estimator.email,
    subject: `VIN On Spot: Quote Preparation Request - ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3b82f6;">VIN On Spot: Quote Preparation Request</h2>
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
        <p>You will be able to complete all remaining steps in the process:</p>
        <ul style="color: #6b7280; font-size: 14px;">
          <li>Quote Preparation</li>
          <li>Offer Decision</li>
          <li>Paperwork & Payment</li>
          <li>Case Completion</li>
        </ul>
        
        <p>Thank you for your assistance.</p>
        <p>VIN on Spot</p>
      </div>
    `
  };

  try {
    

    const info = await transporter.sendMail(mailOptions);
    
 
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
    from: process.env.EMAIL_FROM || '"VIN On Spot" <no-reply@vossystem.com>',
    to: customer.email1 || customer.email || 'customer@example.com',
    subject: `VIN On Spot: Vehicle Purchase Confirmation - ${vehicle.year || 'Unknown'} ${vehicle.make || 'Unknown'} ${vehicle.model || 'Unknown'}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3b82f6;">VIN On Spot: Vehicle Purchase Confirmation</h2>
        <p>Hello ${customer.firstName || 'Valued Customer'},</p>
        <p>Thank you for selling your vehicle to VOS. Your transaction has been completed successfully!</p>
        
        <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Vehicle:</strong> ${vehicle.year || 'Unknown'} ${vehicle.make || 'Unknown'} ${vehicle.model || 'Unknown'}</p>
          <p><strong>VIN:</strong> ${vehicle.vin || 'Not provided'}</p>
          <p><strong>Sale Amount:</strong> ${billOfSale.salePrice ? `$${billOfSale.salePrice.toLocaleString()}` : (transaction.quote?.offerAmount ? `$${transaction.quote.offerAmount.toLocaleString()}` : 'Amount to be determined')}</p>
          <p><strong>Sale Date:</strong> ${billOfSale.saleDate ? new Date(billOfSale.saleDate).toLocaleDateString() : 'Date to be determined'}</p>
          <p><strong>Payment Method:</strong> ${billOfSale.paymentMethod || 'To be determined'}</p>
        </div>
        
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
 

    const info = await transporter.sendMail(mailOptions);
    
  
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
    from: process.env.EMAIL_FROM || '"VIN On Spot" <no-reply@vossystem.com>',
    to: customerData.email1,
    subject: `VIN On Spot: Vehicle Quote Update - ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3b82f6;">VIN On Spot: Vehicle Quote Update</h2>
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
    from: process.env.EMAIL_FROM || '"VIN On Spot" <no-reply@vossystem.com>',
    to: customerData.email1,
    subject: `VIN On Spot: Quote Negotiation Update - ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3b82f6;">VIN On Spot: Quote Negotiation Update</h2>
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
    from: process.env.EMAIL_FROM || '"VIN On Spot" <no-reply@vossystem.com>',
    to: customerData.email1,
    subject: `VIN On Spot: Vehicle Inspection Completed - ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3b82f6;">VIN On Spot: Vehicle Inspection Complete</h2>
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


    const info = await transporter.sendMail(mailOptions);
    
  
    return info;
  } catch (error) {
    console.error('Error sending inspection completion email:', error);
    throw error;
  }
};

/**
 * Helper function to handle email sending with 
 * @param {Object} mailOptions - The email options
 * @returns {Promise} - Promise resolving to the email info
 */
async function sendEmail(mailOptions) {
  try {
    

    const info = await transporter.sendMail(mailOptions);
    
  
    
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

// Send quote email to customer
async function sendQuoteEmail(customer, vehicle, quote, baseUrl) {
  try {
    const offerAmount = quote.offerAmount ? quote.offerAmount.toLocaleString() : 'N/A';
    const expiryDate = quote.expiryDate ? new Date(quote.expiryDate).toLocaleDateString() : 'N/A';
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || '"VIN On Spot" <no-reply@vossystem.com>',
      to: customer.email1,
      subject: `VIN On Spot: Vehicle Offer - ${vehicle.year} ${vehicle.make} ${vehicle.model}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3b82f6;">VIN On Spot: Your Vehicle Offer</h2>
          <p>Dear ${customer.firstName} ${customer.lastName},</p>
          <p>We're pleased to present you with an offer for your ${vehicle.year} ${vehicle.make} ${vehicle.model}.</p>
          
          <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #059669; margin-top: 0;">Offer Amount: $${offerAmount}</h3>
            <p><strong>Valid Until:</strong> ${expiryDate}</p>
            ${quote.notes ? `<p><strong>Additional Notes:</strong> ${quote.notes}</p>` : ''}
          </div>
          
          <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #1e293b; margin-top: 0;">Vehicle Information</h3>
            <p><strong>Vehicle:</strong> ${vehicle.year} ${vehicle.make} ${vehicle.model}</p>
            <p><strong>Mileage:</strong> ${vehicle.currentMileage}</p>
            ${vehicle.vin ? `<p><strong>VIN:</strong> ${vehicle.vin}</p>` : ''}
            ${vehicle.color ? `<p><strong>Color:</strong> ${vehicle.color}</p>` : ''}
          </div>
          
          <div style="background: #dbeafe; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
            <h3 style="color: #1e40af; margin-top: 0;">Next Steps</h3>
            <p style="margin-bottom: 10px;">To accept or decline this offer, please:</p>
            <ul style="color: #1e40af; margin: 10px 0; padding-left: 20px;">
              <li>Contact us directly at (555) 123-4567</li>
              <li>Reply to this email with your decision</li>
              <li>Visit our office to discuss the offer</li>
            </ul>
          </div>
          
          <p>Thank you for choosing VOS!</p>
          <p>Best regards,<br>The VOS Team</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px;">
            <p>This offer is valid until ${expiryDate}. Please contact us before this date to proceed.</p>
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);

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
async function sendDecisionEmail(customer, vehicle, quote, baseUrl) {
  try {
    const offerAmount = quote.offerAmount ? quote.offerAmount.toLocaleString() : 'N/A';
    const decision = quote.offerDecision?.decision || 'pending';
    
    let subject, heading, message, statusColor;
    
    if (decision === 'accepted') {
      subject = 'VIN On Spot: Your Offer Acceptance Confirmation';
      heading = 'VIN On Spot: Offer Acceptance Confirmed';
      statusColor = '#059669';
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
      subject = 'VIN On Spot: Your Offer Decision Confirmation';
      heading = 'VIN On Spot: Offer Decline Confirmed';
      statusColor = '#dc2626';
      message = `
        <p>We confirm that you've declined our offer of $${offerAmount} for your ${vehicle.year} ${vehicle.make} ${vehicle.model}.</p>
        <p>We appreciate your consideration and would be happy to assist you in the future if you change your mind.</p>
      `;
    } else {
      subject = 'VIN On Spot: Your Offer Status Update';
      heading = 'VIN On Spot: Offer Status Update';
      statusColor = '#f59e0b';
      message = `
        <p>This email confirms the current status of our offer of $${offerAmount} for your ${vehicle.year} ${vehicle.make} ${vehicle.model}.</p>
        <p>If you have any questions or would like to discuss the offer further, please don't hesitate to contact us.</p>
      `;
    }
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || '"VIN On Spot" <no-reply@vossystem.com>',
      to: customer.email1,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3b82f6;">${heading}</h2>
          <p>Dear ${customer.firstName} ${customer.lastName},</p>
          
          <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #1e293b; margin-top: 0;">Vehicle Information</h3>
            <p><strong>Vehicle:</strong> ${vehicle.year} ${vehicle.make} ${vehicle.model}</p>
            <p><strong>Mileage:</strong> ${vehicle.currentMileage}</p>
            ${vehicle.vin ? `<p><strong>VIN:</strong> ${vehicle.vin}</p>` : ''}
            <p><strong>Offer Amount:</strong> $${offerAmount}</p>
            <p><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: bold;">${decision.toUpperCase()}</span></p>
          </div>
          
          <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
            ${message}
          </div>
          
          ${decision === 'accepted' ? `
            <div style="background: #dbeafe; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
              <h3 style="color: #1e40af; margin-top: 0;">What Happens Next?</h3>
              <p style="margin-bottom: 10px;">Our team will be in touch with you shortly to:</p>
              <ul style="color: #1e40af; margin: 10px 0; padding-left: 20px;">
                <li>Schedule the final paperwork and payment</li>
                <li>Coordinate vehicle pickup</li>
                <li>Process your payment</li>
                <li>Complete the title transfer</li>
              </ul>
            </div>
          ` : ''}
          
          <p>Thank you for choosing VOS!</p>
          <p>Best regards,<br>The VOS Team</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px;">
            <p>If you have any questions, please contact us at (555) 123-4567 or reply to this email.</p>
          </div>
        </div>
      `
    };

    return {
      success: true,
      message: `Decision email sent to ${customer.email1}`
    };
  } catch (error) {
    console.error('Error sending decision email:', error);
    throw error;
  }
};

// Send customer intake notification to all admins
async function sendCustomerIntakeNotification(customer, vehicle, caseData, baseUrl) {
  try {
    const adminUsers = await getAllAdminUsers();
    
    const subject = `VIN On Spot: New Customer Intake: ${customer.firstName} ${customer.lastName}`;
    
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
          VIN On Spot: New Customer Intake Submission
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
This customer intake has been automatically created in the system.
Please assign an agent and proceed with the inspection scheduling.

View in Admin Dashboard: ${baseUrl}/admin/customers

Note: This customer intake was submitted through the public form and requires agent assignment.
    `;
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || '"VIN On Spot" <no-reply@vossystem.com>',
      subject: subject,
      text: textContent,
      html: htmlContent
    };
    
    await sendEmailToMultipleRecipients(mailOptions, adminUsers);
    console.log(`Customer intake notification email sent to ${adminUsers.length} admin(s)`);
    
  } catch (error) {
    console.error('Error sending customer intake notification email:', error);
    throw error;
  }
}

/**
 * Send customer intake form email
 * @param {String} customerEmail - Customer's email address
 * @param {String} customerName - Customer's name
 * @param {String} formUrl - URL to the customer intake form
 * @returns {Promise} - Promise resolving to the email info
 */
const sendCustomerFormEmail = async (customerEmail, customerName, formUrl) => {
  const mailOptions = {
      from: process.env.EMAIL_FROM || '"VIN On Spot" <no-reply@vossystem.com>',
    to: customerEmail,
    subject: 'VIN On Spot: Complete Your Vehicle Information',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3b82f6;">VIN On Spot: Complete Your Vehicle Information</h2>
        <p>Hello ${customerName},</p>
        <p>Thank you for your interest in selling your vehicle to VOS. To help us provide you with the best possible offer, we need some additional information about your vehicle.</p>
        
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #1e293b; margin-top: 0;">What you'll need to provide:</h3>
          <ul style="color: #4b5563; line-height: 1.6;">
            <li>Vehicle details (year, make, model, mileage)</li>
            <li>VIN number (if available)</li>
            <li>Vehicle condition and known issues</li>
            <li>Title and loan information</li>
            <li>Contact information</li>
          </ul>
        </div>
        
        <p>Please click the button below to access our secure online form:</p>
        
        <p style="margin: 30px 0;">
          <a href="${formUrl}" style="background: #3b82f6; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
            Complete Vehicle Form
          </a>
        </p>
        
        <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
          <strong>Important:</strong> This form should take about 5-10 minutes to complete. You can save your progress and return later if needed.
        </p>
        
        <div style="background: #dbeafe; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
          <p style="margin: 0; color: #1e40af; font-size: 14px;">
            <strong>Need help?</strong> If you have any questions or need assistance completing the form, please don't hesitate to contact us at (555) 123-4567 or reply to this email.
          </p>
        </div>
        
        <p>We look forward to helping you get the best value for your vehicle!</p>
        <p>Best regards,<br>The VOS Team</p>
      </div>
    `
  };

  try {

    const info = await transporter.sendMail(mailOptions);
    
    return info;
  } catch (error) {
    console.error('Error sending customer form email:', error);
    throw error;
  }
};

/**
 * Send customer creation confirmation email
 * @param {Object} customerData - The customer data
 * @param {Object} vehicleData - The vehicle data (optional)
 * @param {String} baseUrl - The base URL for the application
 * @returns {Promise} - Promise resolving to the email info
 */
async function sendCustomerCreationEmail(customerData, vehicleData, baseUrl) {
  const mailOptions = {
    from: process.env.EMAIL_FROM || '"VIN On Spot" <no-reply@vossystem.com>',
    to: customerData.email1 || customerData.email,
    subject: `VIN On Spot: Vehicle Intake Confirmation`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3b82f6;">VIN On Spot: Vehicle Intake Recorded</h2>
        <p>Hello ${customerData.firstName} ${customerData.lastName},</p>

        <p>Thank you for visiting our store! One of our agents has successfully completed the intake process for you and your vehicle.</p>

        <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #1e293b; margin-top: 0;">Your Details</h3>
          <p><strong>Name:</strong> ${customerData.firstName} ${customerData.middleInitial || ''} ${customerData.lastName}</p>
          <p><strong>Phone:</strong> ${customerData.cellPhone}</p>
          <p><strong>Email:</strong> ${customerData.email1 || customerData.email}</p>
          ${customerData.storeLocation ? `<p><strong>Store Location:</strong> ${customerData.storeLocation}</p>` : ''}
          ${vehicleData ? `
            <h4 style="color: #1e293b; margin-top: 15px;">Vehicle Details</h4>
            <p><strong>Vehicle:</strong> ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}</p>
            <p><strong>Mileage:</strong> ${vehicleData.currentMileage}</p>
            ${vehicleData.vin ? `<p><strong>VIN:</strong> ${vehicleData.vin}</p>` : ''}
          ` : ''}
        </div>

        <div style="background: #dbeafe; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
          <h3 style="color: #1e40af; margin-top: 0;">What Happens Next?</h3>
          <p>Our team will now:</p>
          <ul style="color: #1e40af; margin: 10px 0; padding-left: 20px;">
            <li>Review your vehicle's details</li>
            <li>Schedule a full inspection (if not already done)</li>
            <li>Provide you with a competitive purchase offer</li>
          </ul>
        </div>

        <p>If any information above is incorrect or needs updating, feel free to reply to this email or contact us directly at your nearest VOS store.</p>

        <p>We appreciate your time and look forward to helping you get the best value for your vehicle.</p>

        <p>Best regards,<br>The VOS Team</p>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px;">
          <p>This email confirms that your vehicle intake information has been recorded at a VOS location.</p>
          <p>If you did not visit our store or believe this is a mistake, please contact us immediately.</p>
        </div>
      </div>
    `
  };


  try {
    

    const info = await transporter.sendMail(mailOptions);
    
  
    return info;
  } catch (error) {
    console.error('Error sending customer creation email:', error);
    throw error;
  }
};

/**
 * Send admin notification about new customer creation
 * @param {Object} customerData - The customer data
 * @param {Object} vehicleData - The vehicle data (optional)
 * @param {Object} agentData - The agent data (optional)
 * @param {String} baseUrl - The base URL for the application
 * @returns {Promise} - Promise resolving to the email info
 */
async function sendAdminCustomerCreationNotification(customerData, vehicleData, agentData, baseUrl) {
  const adminUsers = await getAllAdminUsers();
  
  const mailOptions = {
    from: process.env.EMAIL_FROM || '"VIN On Spot" <no-reply@vossystem.com>',
    subject: `VIN On Spot: New Customer Created: ${customerData.firstName} ${customerData.lastName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">
          VIN On Spot: New Customer Intake Recorded
        </h2>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #1e293b; margin-top: 0;">Customer Information</h3>
          <p><strong>Name:</strong> ${customerData.firstName} ${customerData.middleInitial || ''} ${customerData.lastName}</p>
          <p><strong>Phone:</strong> ${customerData.cellPhone}</p>
          <p><strong>Email:</strong> ${customerData.email1 || customerData.email}</p>
          ${customerData.homePhone ? `<p><strong>Home Phone:</strong> ${customerData.homePhone}</p>` : ''}
          ${customerData.email2 ? `<p><strong>Secondary Email:</strong> ${customerData.email2}</p>` : ''}
          ${customerData.hearAboutVOS ? `<p><strong>Heard about VOS:</strong> ${customerData.hearAboutVOS}</p>` : ''}
          ${customerData.source ? `<p><strong>Source:</strong> ${customerData.source}</p>` : ''}
          ${customerData.receivedOtherQuote ? `<p><strong>Other Quote:</strong> ${customerData.otherQuoteOfferer} - $${customerData.otherQuoteAmount}</p>` : ''}
          ${customerData.notes ? `<p><strong>Notes:</strong> ${customerData.notes}</p>` : ''}
          ${customerData.storeLocation ? `<p><strong>Store Location:</strong> ${customerData.storeLocation}</p>` : ''}
        </div>
        
        ${vehicleData ? `
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1e293b; margin-top: 0;">Vehicle Information</h3>
            <p><strong>Vehicle:</strong> ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}</p>
            <p><strong>Mileage:</strong> ${vehicleData.currentMileage}</p>
            ${vehicleData.vin ? `<p><strong>VIN:</strong> ${vehicleData.vin}</p>` : ''}
            ${vehicleData.color ? `<p><strong>Color:</strong> ${vehicleData.color}</p>` : ''}
            ${vehicleData.bodyStyle ? `<p><strong>Body Style:</strong> ${vehicleData.bodyStyle}</p>` : ''}
            <p><strong>Title Status:</strong> ${vehicleData.titleStatus}</p>
            <p><strong>Loan Status:</strong> ${vehicleData.loanStatus}</p>
            ${vehicleData.loanStatus === 'still-has-loan' && vehicleData.loanAmount ? `<p><strong>Loan Amount:</strong> $${vehicleData.loanAmount}</p>` : ''}
            ${vehicleData.secondSetOfKeys ? '<p><strong>Second Set of Keys:</strong> Yes</p>' : ''}
            ${vehicleData.knownDefects ? `<p><strong>Known Defects:</strong> ${vehicleData.knownDefects}</p>` : ''}
          </div>
        ` : ''}
        
        ${agentData ? `
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1e293b; margin-top: 0;">Agent</h3>
            <p><strong>Agent:</strong> ${agentData.firstName} ${agentData.lastName}</p>
            <p><strong>Email:</strong> ${agentData.email}</p>
            ${agentData.location ? `<p><strong>Location:</strong> ${agentData.location}</p>` : ''}
          </div>
        ` : ''}
        
        <div style="background-color: #dbeafe; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
          <h3 style="color: #1e40af; margin-top: 0;">Next Steps</h3>
          <p style="margin-bottom: 10px;">A new customer account has been created in the system.</p>
          ${!agentData ? '<p style="margin-bottom: 15px; color: #dc2626;"><strong>Action Required:</strong> Please assign an agent to this customer.</p>' : ''}
          
          <a href="${baseUrl}/admin/customers" 
             style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            View in Admin Dashboard
          </a>
        </div>
      </div>
    `
  };

  try {
    const info = await sendEmailToMultipleRecipients(mailOptions, adminUsers);
    
    return info;
  } catch (error) {
    console.error('Error sending admin customer creation notification email:', error);
    throw error;
  }
};

/**
 * Send admin notification about completed inspection
 * @param {Object} inspectionData - The inspection data
 * @param {Object} customerData - The customer data
 * @param {Object} vehicleData - The vehicle data
 * @param {String} baseUrl - The base URL for the application
 * @returns {Promise} - Promise resolving to the email info
 */
async function sendAdminInspectionCompletedNotification(inspectionData, customerData, vehicleData, baseUrl) {
  const adminUsers = await getAllAdminUsers();
  
  const mailOptions = {
    from: process.env.EMAIL_FROM || '"VIN On Spot" <no-reply@vossystem.com>',
    subject: `VIN On Spot: Inspection Completed: ${customerData.firstName} ${customerData.lastName} - ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">
          VIN On Spot: Vehicle Inspection Completed
        </h2>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #1e293b; margin-top: 0;">Customer Information</h3>
          <p><strong>Name:</strong> ${customerData.firstName} ${customerData.middleInitial || ''} ${customerData.lastName}</p>
          <p><strong>Phone:</strong> ${customerData.cellPhone}</p>
          <p><strong>Email:</strong> ${customerData.email1}</p>
        </div>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #1e293b; margin-top: 0;">Vehicle Information</h3>
          <p><strong>Vehicle:</strong> ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}</p>
          <p><strong>VIN:</strong> ${vehicleData.vin || 'Not provided'}</p>
          <p><strong>Mileage:</strong> ${vehicleData.currentMileage}</p>
        </div>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #1e293b; margin-top: 0;">Inspection Details</h3>
          <p><strong>Inspector:</strong> ${inspectionData.inspector.firstName} ${inspectionData.inspector.lastName}</p>
          <p><strong>Overall Rating:</strong> ${inspectionData.overallRating}/5</p>
          <p><strong>Overall Score:</strong> ${inspectionData.overallScore}/${inspectionData.maxPossibleScore}</p>
          <p><strong>Completed On:</strong> ${new Date(inspectionData.completedAt).toLocaleDateString()}</p>
          <p><strong>Status:</strong> <span style="color: #059669; font-weight: bold;">Completed</span></p>
        </div>
        
        <div style="margin: 20px 0;">
          <h3 style="color: #4b5563;">Inspection Summary</h3>
          ${inspectionData.sections.map(section => `
            <div style="margin: 10px 0; padding: 10px; border: 1px solid #e5e7eb; border-radius: 5px;">
              <p style="margin: 0;"><strong>${section.name}:</strong> ${section.rating}/5 (Score: ${section.score}/${section.maxScore})</p>
              ${section.notes ? `<p style="margin: 5px 0; color: #6b7280;">${section.notes}</p>` : ''}
              ${section.photos?.length ? `<p style="margin: 5px 0; color: #6b7280;">${section.photos.length} photos taken</p>` : ''}
            </div>
          `).join('')}
        </div>
        
        ${inspectionData.inspectionNotes ? `
          <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <h4 style="color: #92400e; margin-top: 0;">Inspector Notes</h4>
            <p style="margin: 0; color: #92400e;">${inspectionData.inspectionNotes}</p>
          </div>
        ` : ''}
        
        
        <div style="background-color: #dbeafe; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
          <h3 style="color: #1e40af; margin-top: 0;">Next Steps</h3>
          <p style="margin-bottom: 10px;">The inspection has been completed successfully. The case is now ready for quote preparation.</p>
          
          <a href="${baseUrl}/admin/customers" 
             style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            View in Admin Dashboard
          </a>
        </div>
        
        <div style="background-color: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #22c55e;">
          <p style="margin: 0; color: #166534;"><strong>Note:</strong> The customer has been automatically notified about the completed inspection.</p>
        </div>
      </div>
    `
  };

  try {
    const info = await sendEmailToMultipleRecipients(mailOptions, adminUsers);
    
    return info;
  } catch (error) {
    console.error('Error sending admin inspection completion notification email:', error);
    throw error;
  }
};

/**
 * Send estimator notification about completed inspection
 * @param {Object} inspectionData - The inspection data
 * @param {Object} customerData - The customer data
 * @param {Object} vehicleData - The vehicle data
 * @param {Object} estimatorData - The estimator data
 * @param {String} baseUrl - The base URL for the application
 * @returns {Promise} - Promise resolving to the email info
 */
async function sendEstimatorInspectionCompletedNotification(inspectionData, customerData, vehicleData, estimatorData, baseUrl) {
  const mailOptions = {
    from: process.env.EMAIL_FROM || '"VIN On Spot" <no-reply@vossystem.com>',
    to: estimatorData.email,
    subject: `VIN On Spot: Inspection Completed - Ready for Quote: ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3b82f6;">VIN On Spot: Inspection Completed - Ready for Quote</h2>
        <p>Hello ${estimatorData.firstName} ${estimatorData.lastName},</p>
        <p>The vehicle inspection has been completed and is now ready for quote preparation.</p>
        
        <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #1e293b; margin-top: 0;">Customer Information</h3>
          <p><strong>Name:</strong> ${customerData.firstName} ${customerData.middleInitial || ''} ${customerData.lastName}</p>
          <p><strong>Phone:</strong> ${customerData.cellPhone}</p>
          <p><strong>Email:</strong> ${customerData.email1}</p>
        </div>
        
        <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #1e293b; margin-top: 0;">Vehicle Information</h3>
          <p><strong>Vehicle:</strong> ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}</p>
          <p><strong>VIN:</strong> ${vehicleData.vin || 'Not provided'}</p>
          <p><strong>Mileage:</strong> ${vehicleData.currentMileage}</p>
        </div>
        
        <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #1e293b; margin-top: 0;">Inspection Results</h3>
          <p><strong>Inspector:</strong> ${inspectionData.inspector.firstName} ${inspectionData.inspector.lastName}</p>
          <p><strong>Overall Rating:</strong> ${inspectionData.overallRating}/5</p>
          <p><strong>Overall Score:</strong> ${inspectionData.overallScore}/${inspectionData.maxPossibleScore}</p>
          <p><strong>Completed On:</strong> ${new Date(inspectionData.completedAt).toLocaleDateString()}</p>
        </div>
        
        <div style="margin: 20px 0;">
          <h3 style="color: #4b5563;">Inspection Summary</h3>
          ${inspectionData.sections.map(section => `
            <div style="margin: 10px 0; padding: 10px; border: 1px solid #e5e7eb; border-radius: 5px;">
              <p style="margin: 0;"><strong>${section.name}:</strong> ${section.rating}/5 (Score: ${section.score}/${section.maxScore})</p>
              ${section.notes ? `<p style="margin: 5px 0; color: #6b7280;">${section.notes}</p>` : ''}
              ${section.photos?.length ? `<p style="margin: 5px 0; color: #6b7280;">${section.photos.length} photos taken</p>` : ''}
            </div>
          `).join('')}
        </div>
        
        ${inspectionData.inspectionNotes ? `
          <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <h4 style="color: #92400e; margin-top: 0;">Inspector Notes</h4>
            <p style="margin: 0; color: #92400e;">${inspectionData.inspectionNotes}</p>
          </div>
        ` : ''}
        
        <div style="background: #dbeafe; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
          <h3 style="color: #1e40af; margin-top: 0;">Next Steps</h3>
          <p style="margin-bottom: 10px;">The inspection is complete and ready for quote preparation. Please:</p>
          <ul style="color: #1e40af; margin: 10px 0; padding-left: 20px;">
            <li>Review the inspection results and photos</li>
            <li>Prepare a competitive quote based on the vehicle condition</li>
            <li>Contact the customer to discuss the offer</li>
            <li>Complete the quote preparation workflow</li>
          </ul>
        </div>
        
        <p style="margin: 20px 0;">
          <a href="${baseUrl}/estimator" style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Go to Dashboard
          </a>
        </p>
        
        <p>Thank you for your assistance.</p>
        <p>VIN on Spot</p>
      </div>
    `
  };

  try {
 
    const info = await transporter.sendMail(mailOptions);

    return info;
  } catch (error) {
    console.error('Error sending estimator inspection completion notification email:', error);
    throw error;
  }
};

/**
 * Send estimator assignment notification email
 * @param {Object} estimatorData - The estimator data
 * @param {Object} customerData - The customer data
 * @param {Object} vehicleData - The vehicle data
 * @param {Object} caseData - The case data
 * @param {String} baseUrl - The base URL for the application
 * @returns {Promise} - Promise resolving to the email info
 */
async function sendEstimatorAssignmentEmail(estimatorData, customerData, vehicleData, caseData, baseUrl) {
  const mailOptions = {
    from: process.env.EMAIL_FROM || '"VIN On Spot" <no-reply@vossystem.com>',
    to: estimatorData.email,
    subject: `VIN On Spot: New Customer Assignment - ${customerData.firstName} ${customerData.lastName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3b82f6;">VIN On Spot: New Customer Assignment</h2>
        <p>Hello ${estimatorData.firstName} ${estimatorData.lastName},</p>
        <p>You have been assigned to a new customer case. Here are the details:</p>
        
        <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #1e293b; margin-top: 0;">Customer Information</h3>
          <p><strong>Name:</strong> ${customerData.firstName} ${customerData.middleInitial || ''} ${customerData.lastName}</p>
          <p><strong>Phone:</strong> ${customerData.cellPhone}</p>
          <p><strong>Email:</strong> ${customerData.email1}</p>
          ${customerData.homePhone ? `<p><strong>Home Phone:</strong> ${customerData.homePhone}</p>` : ''}
          ${customerData.email2 ? `<p><strong>Secondary Email:</strong> ${customerData.email2}</p>` : ''}
          ${customerData.hearAboutVOS ? `<p><strong>Heard about VOS:</strong> ${customerData.hearAboutVOS}</p>` : ''}
          ${customerData.source ? `<p><strong>Source:</strong> ${customerData.source}</p>` : ''}
          ${customerData.receivedOtherQuote ? `<p><strong>Other Quote:</strong> ${customerData.otherQuoteOfferer} - $${customerData.otherQuoteAmount}</p>` : ''}
          ${customerData.notes ? `<p><strong>Notes:</strong> ${customerData.notes}</p>` : ''}
        </div>
        
        <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #1e293b; margin-top: 0;">Vehicle Information</h3>
          <p><strong>Vehicle:</strong> ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}</p>
          <p><strong>Mileage:</strong> ${vehicleData.currentMileage}</p>
          ${vehicleData.vin ? `<p><strong>VIN:</strong> ${vehicleData.vin}</p>` : ''}
          ${vehicleData.color ? `<p><strong>Color:</strong> ${vehicleData.color}</p>` : ''}
          ${vehicleData.bodyStyle ? `<p><strong>Body Style:</strong> ${vehicleData.bodyStyle}</p>` : ''}
          <p><strong>Title Status:</strong> ${vehicleData.titleStatus}</p>
          <p><strong>Loan Status:</strong> ${vehicleData.loanStatus}</p>
          ${vehicleData.loanStatus === 'still-has-loan' && vehicleData.loanAmount ? `<p><strong>Loan Amount:</strong> $${vehicleData.loanAmount}</p>` : ''}
          ${vehicleData.secondSetOfKeys ? '<p><strong>Second Set of Keys:</strong> Yes</p>' : ''}
          ${vehicleData.knownDefects ? `<p><strong>Known Defects:</strong> ${vehicleData.knownDefects}</p>` : ''}
        </div>
        
        <div style="background: #dbeafe; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
          <h3 style="color: #1e40af; margin-top: 0;">Next Steps</h3>
          <p style="margin-bottom: 10px;">As the assigned estimator for this case, you will be responsible for:</p>
          <ul style="color: #1e40af; margin: 10px 0; padding-left: 20px;">
            <li>Reviewing the vehicle inspection results (once completed)</li>
            <li>Preparing a competitive quote based on market conditions</li>
            <li>Presenting the offer to the customer</li>
            <li>Handling negotiations and finalizing the deal</li>
            <li>Completing all necessary paperwork</li>
          </ul>
        </div>
        
        ${caseData.inspection ? `
          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <p style="margin: 0; color: #92400e;">
              <strong>Note:</strong> An inspection has already been scheduled for this vehicle. You will receive another notification once the inspection is completed.
            </p>
          </div>
        ` : `
          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <p style="margin: 0; color: #92400e;">
              <strong>Note:</strong> An inspection needs to be scheduled for this vehicle. Please coordinate with the inspection team.
            </p>
          </div>
        `}
        
        <p style="margin: 20px 0;">
          <a href="${baseUrl}/estimator" style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Access Estimator Dashboard
          </a>
        </p>
      
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px;">
          <p>This email confirms your assignment to this customer case.</p>
          <p>If you have any questions, please contact your supervisor.</p>
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error('Error sending estimator assignment email:', error);
    throw error;
  }
};

module.exports = {
  sendCustomerIntakeNotification,
  sendInspectionEmail,
  sendEstimatorEmail,
  sendCustomerConfirmationEmail,
  sendQuoteUpdateEmail,
  sendNegotiationUpdateEmail,
  sendInspectionCompletedEmail,
  sendCustomerFormEmail,
  sendQuoteEmail,
  sendDecisionEmail,
  sendCustomerCreationEmail,
  sendAdminCustomerCreationNotification,
  sendAdminInspectionCompletedNotification,
  sendEstimatorInspectionCompletedNotification,
  sendEstimatorAssignmentEmail
}; 