const Case = require('../models/Case');
const Customer = require('../models/Customer');
const Vehicle = require('../models/Vehicle');
const Inspection = require('../models/Inspection');
const Quote = require('../models/Quote');
const Transaction = require('../models/Transaction');
const TimeTracking = require('../models/TimeTracking');
const emailService = require('../services/email');
const pdfService = require('../services/pdf');
const User = require('../models/User');
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');

// Handle document upload
exports.uploadDocument = async (req, res) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files were uploaded.'
      });
    }

    const file = req.files.file;
    const uploadDir = path.join(__dirname, '../../uploads');

    // Ensure uploads directory exists
    await fs.mkdir(uploadDir, { recursive: true });

    // Generate unique filename
    const uniqueFilename = `${Date.now()}-${file.name}`;
    const filePath = path.join(uploadDir, uniqueFilename);

    // Move file to uploads directory
    await file.mv(filePath);

    res.status(200).json({
      success: true,
      data: {
        filename: uniqueFilename,
        path: `/uploads/${uniqueFilename}`,
        originalName: file.name,
        size: file.size,
        mimetype: file.mimetype
      }
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Error uploading file'
    });
  }
};

// Upload bill of sale document and save to transaction
exports.uploadBillOfSaleDocument = async (req, res) => {
  try {
    const { caseId } = req.params;
    
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files were uploaded.'
      });
    }

    const file = req.files.file;
    const uploadDir = path.join(__dirname, '../../uploads');

    // Ensure uploads directory exists
    await fs.mkdir(uploadDir, { recursive: true });

    // Generate unique filename
    const uniqueFilename = `${Date.now()}-${file.name}`;
    const filePath = path.join(uploadDir, uniqueFilename);

    // Move file to uploads directory
    await file.mv(filePath);

    const documentPath = `/uploads/${uniqueFilename}`;

    // Find the case
    const caseData = await Case.findById(caseId);
    if (!caseData) {
      return res.status(404).json({
        success: false,
        error: 'Case not found'
      });
    }

    // Update or create transaction with the document
    let transaction;
    if (caseData.transaction) {
      // Update existing transaction
      transaction = await Transaction.findByIdAndUpdate(
        caseData.transaction,
        {
          $set: {
            'documents.signedBillOfSale': documentPath
          }
        },
        { new: true }
      );
    } else {
      // Create new transaction
      transaction = await Transaction.create({
        vehicle: caseData.vehicle,
        customer: caseData.customer,
        quote: caseData.quote,
        documents: {
          signedBillOfSale: documentPath
        },
        createdBy: req.user.id
      });

      // Update case with transaction reference
      await Case.findByIdAndUpdate(caseId, {
        transaction: transaction._id
      });
    }

    if (!transaction) {
      return res.status(500).json({
        success: false,
        error: 'Failed to save document to transaction'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        path: documentPath,
        filename: uniqueFilename,
        originalName: file.name,
        transaction: transaction
      }
    });
  } catch (error) {
    console.error('Bill of sale upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Error uploading bill of sale document'
    });
  }
};

// Get current user
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        location: user.location
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get inspections assigned to the current inspector
exports.getInspectorInspections = async (req, res) => {
  try {
    // Get inspector's information
    if (!req.user || req.user.role !== 'inspector') {
      return res.status(403).json({
        success: false,
        error: 'Only inspectors can access this endpoint'
      });
    }

    // Find inspections where inspector's email matches the current user's email
    const inspections = await Inspection.find({
      'inspector.email': req.user.email,
      'status': { $ne: 'completed' }, // Only get non-completed inspections
      'completed': { $ne: true }
    })
    .populate('vehicle')
    .populate('customer')
    .sort('-scheduledDate');

    res.status(200).json({
      success: true,
      data: inspections
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get all cases with populated data
exports.getCases = async (req, res) => {
  try {
    const cases = await Case.find()
      .populate('customer')
      .populate('vehicle')
      .populate('inspection')
      .populate('quote')
      .populate('transaction')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      data: cases
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get cases assigned to a specific estimator
exports.getEstimatorCases = async (req, res) => {
  try {
    const { email } = req.user; // Get the logged-in user's email
    
    // Find cases where the quote's estimator email matches the logged-in user's email
    const cases = await Case.find()
      .populate('customer')
      .populate('vehicle')
      .populate('inspection')
      .populate('quote')
      .populate('transaction')
      .sort('-createdAt');

    // Filter cases where the estimator email matches
    const estimatorCases = cases.filter(caseData => {
      return caseData.quote && caseData.quote.estimator && caseData.quote.estimator.email === email;
    });

    res.status(200).json({
      success: true,
      data: estimatorCases
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get a single case by ID
exports.getCase = async (req, res) => {
  try {
    const caseData = await Case.findById(req.params.caseId)
      .populate('customer')
      .populate('vehicle')
      .populate('inspection')
      .populate('quote')
      .populate('transaction');

    if (!caseData) {
      return res.status(404).json({
        success: false,
        error: 'Case not found'
      });
    }

    res.status(200).json({
      success: true,
      data: caseData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Create a new case with customer and vehicle information
exports.createCase = async (req, res) => {
  try {
    const { customer: customerData, vehicle: vehicleData, documents, agentInfo } = req.body;

    // Create customer record
    const customer = await Customer.create({
      ...customerData,
      agent: req.user.id,
      storeLocation: agentInfo.storeLocation
    });

    // Create vehicle record
    const vehicle = await Vehicle.create({
      ...vehicleData,
      customer: customer._id
    });

    // Create case record
    const newCase = await Case.create({
      customer: customer._id,
      vehicle: vehicle._id,
      currentStage: 2,
      status: 'new',
      createdBy: req.user.id,
      documents: {
        driverLicenseFront: documents.driverLicenseFront,
        driverLicenseRear: documents.driverLicenseRear,
        vehicleTitle: documents.vehicleTitle
      },
      stageStatuses: {
        1: 'complete',
        2: 'active',
        3: 'pending',
        4: 'pending',
        5: 'pending',
        6: 'pending',
      }
    });

    // Populate the references for the response
    const populatedCase = await Case.findById(newCase._id)
      .populate('customer')
      .populate('vehicle');

    // Send email notifications
    try {
      // Send customer creation confirmation email
      await emailService.sendCustomerCreationEmail(
        customer,
        vehicle,
        process.env.FRONTEND_URL
      );

      // Send admin notification
      await emailService.sendAdminCustomerCreationNotification(
        customer,
        vehicle,
        req.user, // Agent data
        process.env.FRONTEND_URL
      );
    } catch (emailError) {
      console.error('Error sending customer creation emails:', emailError);
      // Don't fail the request if email fails
    }

    res.status(201).json({
      success: true,
      data: populatedCase
    });
  } catch (error) {
    console.error('Create case error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Update an existing case with customer and vehicle information
exports.updateCase = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { customer: customerData, vehicle: vehicleData, documents, agentInfo } = req.body;

    // Find the existing case
    const existingCase = await Case.findById(caseId)
      .populate('customer')
      .populate('vehicle');

    if (!existingCase) {
      return res.status(404).json({
        success: false,
        error: 'Case not found'
      });
    }

    // Update customer record
    const customerId = typeof existingCase.customer === 'string' ? existingCase.customer : existingCase.customer._id;
    const updatedCustomer = await Customer.findByIdAndUpdate(
      customerId,
      {
        ...customerData,
        agent: req.user.id,
        storeLocation: agentInfo.storeLocation
      },
      { new: true }
    );

    // Update vehicle record
    const vehicleId = typeof existingCase.vehicle === 'string' ? existingCase.vehicle : existingCase.vehicle._id;
    const updatedVehicle = await Vehicle.findByIdAndUpdate(
      vehicleId,
      {
        ...vehicleData,
        customer: updatedCustomer._id
      },
      { new: true }
    );

    // Update case record
    const updatedCase = await Case.findByIdAndUpdate(
      caseId,
      {
        documents: typeof documents === 'string' ? documents : {
          driverLicenseFront: documents?.driverLicenseFront || '',
          driverLicenseRear: documents?.driverLicenseRear || '',
          vehicleTitle: documents?.vehicleTitle || ''
        }
      },
      { new: true }
    ).populate('customer')
     .populate('vehicle');

    res.status(200).json({
      success: true,
      data: updatedCase
    });
  } catch (error) {
    console.error('Update case error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Delete a case and all related data
exports.deleteCase = async (req, res) => {
  try {
    const { caseId } = req.params;
    // Find the case and populate all references
    const caseData = await Case.findById(caseId)
      .populate('customer')
      .populate('vehicle')
      .populate('inspection')
      .populate('quote')
      .populate('transaction');

    if (!caseData) {
      return res.status(404).json({ success: false, error: 'Case not found' });
    }

    // Delete TimeTracking
    await TimeTracking.deleteOne({ caseId: caseData._id });

    // Delete Quote (and any OBD2 scan data inside it)
    if (caseData.quote) {
      await Quote.findByIdAndDelete(caseData.quote._id || caseData.quote);
    }

    // Delete Inspection
    if (caseData.inspection) {
      await Inspection.findByIdAndDelete(caseData.inspection._id || caseData.inspection);
    }

    // Delete Transaction
    if (caseData.transaction) {
      await Transaction.findByIdAndDelete(caseData.transaction._id || caseData.transaction);
    }

    // Delete Vehicle
    if (caseData.vehicle) {
      await Vehicle.findByIdAndDelete(caseData.vehicle._id || caseData.vehicle);
    }

    // Delete Customer
    if (caseData.customer) {
      await Customer.findByIdAndDelete(caseData.customer._id || caseData.customer);
    }

    // Finally, delete the Case itself
    await Case.findByIdAndDelete(caseId);

    res.status(200).json({ success: true, message: 'Case and all related data deleted successfully.' });
  } catch (error) {
    console.error('Error deleting case and related data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Schedule inspection and assign inspector
exports.scheduleInspection = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { inspector, scheduledDate, scheduledTime, notesForInspector, dueByDate, dueByTime } = req.body;

    const caseData = await Case.findById(caseId)
      .populate('customer')
      .populate('vehicle');

    if (!caseData) {
      return res.status(404).json({
        success: false,
        error: 'Case not found'
      });
    }

    // Create inspection record
    const inspection = await Inspection.create({
      caseId: caseId,
      vehicle: caseData.vehicle._id,
      customer: caseData.customer._id,
      inspector,
      scheduledDate,
      scheduledTime,
      dueByDate,
      dueByTime,
      notesForInspector,
      status: 'scheduled',
      createdBy: req.user.id
    });

    // Update case with inspection reference
    await Case.findByIdAndUpdate(caseId, {
      inspection: inspection._id,
      currentStage: 3,
      'stageStatuses.2': 'complete',
      'stageStatuses.3': 'active',
      status: 'scheduled'
    });

    // Send email to inspector
    await emailService.sendInspectionEmail(
      inspection,
      caseData.customer,
      caseData.vehicle,
      process.env.FRONTEND_URL
    );

    res.status(200).json({
      success: true,
      data: inspection
    });
  } catch (error) {
    console.error('Schedule inspection error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get inspection by token
exports.getInspectionByToken = async (req, res) => {
  try {
    const { token } = req.params;

    console.log('Retrieving inspection with token:', token);

    const inspection = await Inspection.findOne({ accessToken: token })
      .populate('vehicle')
      .populate('customer');

    if (!inspection) {
      return res.status(404).json({
        success: false,
        error: 'Invalid or expired inspection token'
      });
    }

    // Get caseId from inspection if available, otherwise fetch from case
    let caseId = inspection.caseId;
    if (!caseId) {
      const caseDoc = await Case.findOne({ inspection: inspection._id });
      caseId = caseDoc ? caseDoc._id : null;
    }

    // Inspector info
    let inspectorId = null;
    let inspectorName = null;
    if (inspection.inspector && inspection.inspector.firstName && inspection.inspector.lastName) {
      inspectorName = `${inspection.inspector.firstName} ${inspection.inspector.lastName}`;
    }
    // Look up inspectorId by email if available
    if (inspection.inspector && inspection.inspector.email) {
      const inspectorUser = await User.findOne({ email: inspection.inspector.email });
      if (inspectorUser) {
        inspectorId = inspectorUser._id;
      }
    }

    console.log('inspectorId', inspection.inspector);

    res.status(200).json({
      success: true,
      data: {
        ...inspection.toObject(),
        caseId,
        inspectorId: inspectorId, // You can enhance this if you want to look up the User by email
        inspectorName
      }
    });
  } catch (error) {
    console.error('Error retrieving inspection:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Submit inspection results
exports.submitInspection = async (req, res) => {
  try {
    const { token } = req.params;
    const inspectionData = req.body;

    // Validate inspection data
    if (!inspectionData.sections || !Array.isArray(inspectionData.sections)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid inspection data format'
      });
    }

    // Validate sections have required fields
    for (const section of inspectionData.sections) {
      if (!section.id || !section.name) {
        return res.status(400).json({
          success: false,
          error: 'Invalid section data - missing id or name'
        });
      }
    }

    // Find and update the inspection with comprehensive data
    const inspection = await Inspection.findOneAndUpdate(
      { accessToken: token },
      {
        sections: inspectionData.sections.map(section => {
          console.log(`Processing section: ${section.name}`, {
            questionsCount: section.questions?.length || 0,
          });
          
          return {
            id: section.id,
            name: section.name,
            description: section.description || '',
            icon: section.icon || '',
            questions: Array.isArray(section.questions) ? section.questions.map(q => ({
              id: q.id || '',
              question: q.question || '',
              type: q.type || 'text',
              options: Array.isArray(q.options) ? q.options : [],
              required: q.required || false,
              answer: q.answer,
              notes: q.notes || '',
              photos: Array.isArray(q.photos) ? q.photos : [],
              subQuestions: Array.isArray(q.subQuestions) ? q.subQuestions.map(sq => ({
                id: sq.id || '',
                question: sq.question || '',
                type: sq.type || 'text',
                options: Array.isArray(sq.options) ? sq.options : [],
                answer: sq.answer,
                notes: sq.notes || '',
                photos: Array.isArray(sq.photos) ? sq.photos : []
              })) : []
            })) : [],
            rating: section.rating || 0,
            photos: Array.isArray(section.photos) ? section.photos : [],
            score: section.score || 0,
            maxScore: section.maxScore || 0,
            completed: section.completed || false,
          };
        }),
        overallRating: inspectionData.overallRating || 0,
        overallScore: inspectionData.overallScore || 0,
        maxPossibleScore: inspectionData.maxPossibleScore || 0,
        status: 'completed',
        completed: true,
        completedAt: new Date(),
        inspectionNotes: inspectionData.inspectionNotes || '',
        recommendations: Array.isArray(inspectionData.recommendations) ? inspectionData.recommendations : [],
        vinVerification: inspectionData.vinVerification || null,
      },
      { new: true }
    ).populate('vehicle').populate('customer');

    if (!inspection) {
      return res.status(404).json({
        success: false,
        error: 'Invalid or expired inspection token'
      });
    }

    // Update case status
    const caseData = await Case.findOneAndUpdate(
      { inspection: inspection._id },
      {
        currentStage: 4,
        'stageStatuses.3': 'complete',
        'stageStatuses.4': 'active',
        status: 'quote-ready'
      },
      { new: true }
    ).populate('customer').populate('vehicle');

    // Send email notifications about completed inspection
    if (caseData) {
      try {
        // Send customer notification (existing)
        await emailService.sendInspectionCompletedEmail(
          inspection,
          caseData.customer,
          caseData.vehicle,
          process.env.FRONTEND_URL
        );

        // Send admin notification
        await emailService.sendAdminInspectionCompletedNotification(
          inspection,
          caseData.customer,
          caseData.vehicle,
          process.env.FRONTEND_URL
        );

        // Send estimator notification if an estimator is assigned
        if (caseData.estimatorId) {
          const estimator = await User.findById(caseData.estimatorId);
          if (estimator) {
            await emailService.sendEstimatorInspectionCompletedNotification(
              inspection,
              caseData.customer,
              caseData.vehicle,
              estimator,
              process.env.FRONTEND_URL
            );
          }
        }
      } catch (emailError) {
        console.error('Error sending inspection completion emails:', emailError);
      }
    }

    res.status(200).json({
      success: true,
      data: inspection
    });
  } catch (error) {
    console.error('Error submitting inspection:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Save pending inspection data
exports.savePendingInspection = async (req, res) => {
  try {
    const { token } = req.params;
    const inspectionData = req.body;

    // Validate inspection data
    if (!inspectionData.sections || !Array.isArray(inspectionData.sections)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid inspection data format'
      });
    }

    // Validate sections have required fields
    for (const section of inspectionData.sections) {
      if (!section.id || !section.name) {
        return res.status(400).json({
          success: false,
          error: 'Invalid section data - missing id or name'
        });
      }
    }

    // Find and update the inspection with pending data
    const inspection = await Inspection.findOneAndUpdate(
      { accessToken: token },
      {
        sections: inspectionData.sections.map(section => {
          console.log(`Processing pending section: ${section.name}`, {
            questionsCount: section.questions?.length || 0,
          });
          
          return {
            id: section.id,
            name: section.name,
            description: section.description || '',
            icon: section.icon || '',
            questions: Array.isArray(section.questions) ? section.questions.map(q => ({
              id: q.id || '',
              question: q.question || '',
              type: q.type || 'text',
              options: Array.isArray(q.options) ? q.options : [],
              required: q.required || false,
              answer: q.answer,
              notes: q.notes || '',
              photos: Array.isArray(q.photos) ? q.photos : [],
              subQuestions: Array.isArray(q.subQuestions) ? q.subQuestions.map(sq => ({
                id: sq.id || '',
                question: sq.question || '',
                type: sq.type || 'text',
                options: Array.isArray(sq.options) ? sq.options : [],
                answer: sq.answer,
                notes: sq.notes || '',
                photos: Array.isArray(sq.photos) ? sq.photos : []
              })) : []
            })) : [],
            rating: section.rating || 0,
            photos: Array.isArray(section.photos) ? section.photos : [],
            score: section.score || 0,
            maxScore: section.maxScore || 0,
            completed: section.completed || false,
          };
        }),
        overallRating: inspectionData.overallRating || 0,
        overallScore: inspectionData.overallScore || 0,
        maxPossibleScore: inspectionData.maxPossibleScore || 0,
        status: 'in-progress',
        completed: false,
        completedAt: null,
        inspectionNotes: inspectionData.inspectionNotes || '',
        recommendations: Array.isArray(inspectionData.recommendations) ? inspectionData.recommendations : [],
        vinVerification: inspectionData.vinVerification || null,
      },
      { new: true }
    ).populate('vehicle').populate('customer');

    if (!inspection) {
      return res.status(404).json({
        success: false,
        error: 'Invalid or expired inspection token'
      });
    }

    res.status(200).json({
      success: true,
      data: inspection
    });
  } catch (error) {
    console.error('Error saving pending inspection:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};


// Assign estimator during inspection scheduling
exports.assignEstimatorDuringInspection = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { estimator } = req.body;

    const caseData = await Case.findById(caseId)
      .populate('customer')
      .populate('vehicle')
      .populate('inspection');

    if (!caseData) {
      return res.status(404).json({
        success: false,
        error: 'Case not found'
      });
    }

    // Find estimator user by email
    const estimatorUser = await User.findOne({ email: estimator.email });

    // Check if quote already exists
    let quote = await Quote.findOne({ caseId: caseId });
    
    if (quote) {
      // Update existing quote with new estimator
      quote = await Quote.findByIdAndUpdate(quote._id, {
        estimator,
        updatedAt: new Date()
      }, { new: true });
    } else {
      // Create new quote record
      quote = await Quote.create({
        caseId: caseId,
        vehicle: caseData.vehicle._id,
        customer: caseData.customer._id,
        inspection: caseData.inspection._id,
        estimator,
        status: 'draft',
        createdBy: req.user.id
      });
    }

    // Update case with quote reference and estimatorId if not already set
    if (!caseData.quote) {
      await Case.findByIdAndUpdate(caseId, {
        quote: quote._id,
        estimatorId: estimatorUser ? estimatorUser._id : null
      });
    } else {
      // Always update estimatorId if estimator is changed
      await Case.findByIdAndUpdate(caseId, {
        estimatorId: estimatorUser ? estimatorUser._id : null
      });
    }

    // Populate the quote with related data for the response
    const populatedQuote = await Quote.findById(quote._id)
      .populate('caseId')
      .populate('vehicle')
      .populate('customer')
      .populate('inspection');

    // Send email notifications to estimator
    try {
      // Send estimator assignment notification
      await emailService.sendEstimatorAssignmentEmail(
        estimatorUser,
        caseData.customer,
        caseData.vehicle,
        caseData,
        process.env.FRONTEND_URL
      );
    } catch (emailError) {
      console.error('Error sending estimator assignment emails:', emailError);
      // Don't fail the request if email fails
    }

    res.status(200).json({
      success: true,
      data: populatedQuote
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get quote by token
exports.getQuoteByToken = async (req, res) => {
  try {
    const { id } = req.params;

    const quote = await Quote.findOne({ accessToken: id })
      .populate('caseId')
      .populate('vehicle')
      .populate('customer')
      .populate('inspection');

    if (!quote) {
      return res.status(404).json({
        success: false,
        error: 'Invalid or expired quote token'
      });
    }

    res.status(200).json({
      success: true,
      data: quote
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Submit quote
exports.submitQuote = async (req, res) => {
  try {
    const { id } = req.params;
    const quoteData = req.body;

    // First check if quote exists and if it has already been decided
    const existingQuote = await Quote.findOne({ accessToken: id });
    if (existingQuote) {
      const isQuoteDecided = existingQuote.offerDecision?.decision === 'accepted' || 
                            existingQuote.offerDecision?.decision === 'declined' ||
                            existingQuote.status === 'accepted' || 
                            existingQuote.status === 'declined';
      
      if (isQuoteDecided) {
        return res.status(400).json({
          success: false,
          error: `Quote has already been ${existingQuote.offerDecision?.decision || existingQuote.status}. Cannot modify a quote that has been decided.`
        });
      }
    }

    const quote = await Quote.findOneAndUpdate(
      { accessToken: id },
      {
        ...quoteData,
        status: 'ready'
      },
      { new: true }
    ).populate('caseId')
     .populate('vehicle')
     .populate('customer')
     .populate('inspection');

    if (!quote) {
      return res.status(404).json({
        success: false,
        error: 'Invalid or expired quote token'
      });
    }

    // Create or update transaction with sale price from quote
    if (quote.offerAmount) {
      let transaction = await Transaction.findOne({ quote: quote._id });
      
      if (transaction) {
        // Update existing transaction
        transaction = await Transaction.findByIdAndUpdate(
          transaction._id,
          {
            'billOfSale.salePrice': quote.offerAmount
          },
          { new: true }
        );
      } else {
        // Create new transaction with sale price
        transaction = await Transaction.create({
          vehicle: quote.vehicle._id,
          customer: quote.customer._id,
          quote: quote._id,
          billOfSale: {
            salePrice: quote.offerAmount
          }
        });
      }
      
      // Update case with transaction reference if not already set
      const caseData = await Case.findOne({ quote: quote._id });
      if (caseData && !caseData.transaction) {
        await Case.findByIdAndUpdate(
          caseData._id,
          { transaction: transaction._id }
        );
      }
    }

    // Send quote email to customer automatically
    try {
      const emailResult = await emailService.sendQuoteEmail(
        quote.customer,
        quote.vehicle,
        quote,
        process.env.FRONTEND_URL
      );
      console.log('Quote email sent successfully:', emailResult.message);
      
      // Update quote to mark email as sent
      await Quote.findByIdAndUpdate(quote._id, { emailSent: true });
    } catch (emailError) {
      console.error('Error sending quote email:', emailError);
      // Don't fail the quote submission if email fails
    }

    res.status(200).json({
      success: true,
      data: quote
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Update offer decision
exports.updateOfferDecision = async (req, res) => {
  try {
    const { id } = req.params;
    const { offerDecision } = req.body;

    const quote = await Quote.findOneAndUpdate(
      { accessToken: id },
      {
        offerDecision: {
          ...offerDecision,
          decisionDate: new Date()
        }
      },
      { new: true }
    ).populate('caseId')
     .populate('vehicle')
     .populate('customer')
     .populate('inspection');

    if (!quote) {
      return res.status(404).json({
        success: false,
        error: 'Invalid or expired quote token'
      });
    }

    if (offerDecision.decision === 'accepted') {
      caseUpdate.currentStage = 4;
    } else if (offerDecision.decision === 'declined') {
      caseUpdate.status = 'quote-declined';
    }

    await Case.findOneAndUpdate(
      { quote: quote._id },
      caseUpdate
    );

    res.status(200).json({
      success: true,
      data: quote
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Update paperwork
exports.updatePaperwork = async (req, res) => {
  try {
    const { id } = req.params;
    const { paperwork } = req.body;

    const quote = await Quote.findOneAndUpdate(
      { accessToken: id },
      {
        paperwork: {
          ...paperwork,
          submittedAt: new Date()
        }
      },
      { new: true }
    ).populate('caseId')
     .populate('vehicle')
     .populate('customer')
     .populate('inspection');

    if (!quote) {
      return res.status(404).json({
        success: false,
        error: 'Invalid or expired quote token'
      });
    }

    // Update case status
    await Case.findOneAndUpdate(
      { quote: quote._id },
      {
        currentStage: 6,
        'stageStatuses.5': 'complete',
        'stageStatuses.6': 'active'
      }
    );

    res.status(200).json({
      success: true,
      data: quote
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Update case stage
exports.updateCaseStage = async (req, res) => {
  try {
    const { id } = req.params;
    const { currentStage, stageStatuses } = req.body;

    const quote = await Quote.findOne({ accessToken: id });
    if (!quote) {
      return res.status(404).json({
        success: false,
        error: 'Invalid or expired quote token'
      });
    }

    const caseUpdate = { currentStage };
    if (stageStatuses) {
      caseUpdate.stageStatuses = stageStatuses;
    }

    const updatedCase = await Case.findOneAndUpdate(
      { quote: quote._id },
      caseUpdate,
      { new: true }
    ).populate('customer')
     .populate('vehicle')
     .populate('inspection')
     .populate('quote')
     .populate('transaction');

    res.status(200).json({
      success: true,
      data: updatedCase
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Update case stage by case ID
exports.updateCaseStageByCaseId = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { currentStage, stageStatuses } = req.body;

    const caseUpdate = { currentStage };
    if (stageStatuses) {
      caseUpdate.stageStatuses = stageStatuses;
    }

    const updatedCase = await Case.findByIdAndUpdate(
      caseId,
      caseUpdate,
      { new: true }
    ).populate('customer')
     .populate('vehicle')
     .populate('inspection')
     .populate('quote')
     .populate('transaction');
    
    if (!updatedCase) {
      return res.status(404).json({
        success: false,
        error: 'Case not found'
      });
    }

    res.status(200).json({
      success: true,
      data: updatedCase
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Complete case and generate PDF
exports.completeCase = async (req, res) => {
  try {
    const { caseId } = req.params;

    const caseData = await Case.findById(caseId)
      .populate('customer')
      .populate('vehicle')
      .populate('inspection')
      .populate('quote')
      .populate('transaction');

    if (!caseData) {
      return res.status(404).json({
        success: false,
        error: 'Case not found'
      });
    }

    // Generate case file PDF
    const pdfResult = await pdfService.generateCasePDF(caseData);

    // Update case with PDF path and completion status
    const updatedCase = await Case.findByIdAndUpdate(
      caseId,
      {
        pdfCaseFile: pdfResult.filePath,
        currentStage: 6,
        'stageStatuses.6': 'complete',
        status: 'completed',
        thankYouSent: true
      },
      { new: true }
    );

    // Send thank you email with PDF
    await emailService.sendCustomerConfirmationEmail(
      caseData.customer,
      caseData.vehicle,
      caseData.transaction,
      `${process.env.NEXT_PUBLIC_API_URL}/uploads/pdfs/${pdfResult.fileName}`,
      process.env.FRONTEND_URL
    );

    res.status(200).json({
      success: true,
      data: {
        case: updatedCase,
        pdfUrl: `${process.env.NEXT_PUBLIC_API_URL}/uploads/pdfs/${pdfResult.fileName}`
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Generate case file PDF
exports.generateCaseFile = async (req, res) => {
  try {
    const { caseId } = req.params;

    const caseData = await Case.findById(caseId)
      .populate('customer')
      .populate('vehicle')
      .populate('inspection')
      .populate('quote')
      .populate('transaction');

    if (!caseData) {
      return res.status(404).json({
        success: false,
        error: 'Case not found'
      });
    }

    // Generate case file PDF
    const pdfResult = await pdfService.generateCasePDF(caseData);

    // Set appropriate headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="case-${caseId}.pdf"`);

    // Send the PDF file
    res.sendFile(pdfResult.filePath);
  } catch (error) {
    console.error('Generate case file error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Update case status
exports.updateCaseStatus = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { status } = req.body;

    const updatedCase = await Case.findByIdAndUpdate(
      caseId,
      { status },
      { new: true }
    ).populate('customer')
     .populate('vehicle')
     .populate('inspection')
     .populate('quote')
     .populate('transaction');

    if (!updatedCase) {
      return res.status(404).json({
        success: false,
        error: 'Case not found'
      });
    }

    res.status(200).json({
      success: true,
      data: updatedCase
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Complete case with token (for estimators)
exports.completeCaseWithToken = async (req, res) => {
  try {
    const { id } = req.params;

    const quote = await Quote.findOne({ accessToken: id })
      .populate({
        path: 'caseId',
        populate: [
          { path: 'customer' },
          { path: 'vehicle' },
          { path: 'inspection' },
          { path: 'transaction' }
        ]
      });

    if (!quote) {
      return res.status(404).json({
        success: false,
        error: 'Invalid or expired quote token'
      });
    }

    const caseData = quote.caseId;
    
    // Debug logging
    console.log('Quote data:', JSON.stringify(quote, null, 2));
    console.log('Case data:', JSON.stringify(caseData, null, 2));

    // Ensure we have the quote data in the case for PDF generation
    const caseWithQuote = {
      ...caseData.toObject(),
      quote: quote.toObject()
    };

    // Generate case file PDF
    const pdfResult = await pdfService.generateCasePDF(caseWithQuote);

    // Update case with PDF path and completion status only - don't automatically advance stages
    // The frontend will call updateCaseStageByCaseId separately to manage stage status
    const updatedCase = await Case.findByIdAndUpdate(
      caseData._id,
      {
        pdfCaseFile: pdfResult.filePath,
        status: 'completed',
        thankYouSent: true
      },
      { new: true }
    ).populate('customer')
     .populate('vehicle')
     .populate('inspection')
     .populate('quote')
     .populate('transaction');

    // Send thank you email with PDF
    await emailService.sendCustomerConfirmationEmail(
      caseData.customer,
      caseData.vehicle,
      caseData.transaction,
      `${process.env.NEXT_PUBLIC_API_URL}/uploads/pdfs/${pdfResult.fileName}`,
      process.env.FRONTEND_URL
    );

    res.status(200).json({
      success: true,
      data: {
        case: updatedCase,
        pdfUrl: `${process.env.NEXT_PUBLIC_API_URL}/uploads/pdfs/${pdfResult.fileName}`
      }
    });
  } catch (error) {
    console.error('Complete case with token error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Generate case file PDF with token (for estimators)
exports.generateCaseFileWithToken = async (req, res) => {
  try {
    const { id } = req.params;

    const quote = await Quote.findOne({ accessToken: id })
      .populate({
        path: 'caseId',
        populate: [
          { path: 'customer' },
          { path: 'vehicle' },
          { path: 'inspection' },
          { path: 'transaction' }
        ]
      });

    if (!quote) {
      return res.status(404).json({
        success: false,
        error: 'Invalid or expired quote token'
      });
    }

    const caseData = quote.caseId;
    
    // Debug logging
    console.log('Generate PDF - Quote data:', JSON.stringify(quote, null, 2));
    console.log('Generate PDF - Case data:', JSON.stringify(caseData, null, 2));

    // Ensure we have the quote data in the case for PDF generation
    const caseWithQuote = {
      ...caseData.toObject(),
      quote: quote.toObject()
    };

    // Generate case file PDF
    const pdfResult = await pdfService.generateCasePDF(caseWithQuote);

    // Set appropriate headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="case-${caseData._id}.pdf"`);

    // Send the PDF file
    res.sendFile(pdfResult.filePath);
  } catch (error) {
    console.error('Generate case file with token error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get users by role
exports.getUsersByRole = async (req, res) => {
  try {
    const { role } = req.query;

    if (!role) {
      return res.status(400).json({
        success: false,
        error: 'Role parameter is required'
      });
    }

    const validRoles = ['admin', 'agent', 'estimator', 'inspector'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role. Must be one of: admin, agent, estimator, inspector'
      });
    }

    const users = await User.find({ role }).select('firstName lastName email location role createdAt');

    res.status(200).json({
      success: true,
      data: users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Create new user (admin only)
exports.createUser = async (req, res) => {
  try {
    const { email, password, firstName, lastName, role, location } = req.body;

    // Validate required fields
    if (!email || !password || !firstName || !lastName || !role) {
      return res.status(400).json({
        success: false,
        error: 'Email, password, firstName, lastName, and role are required'
      });
    }

    // Validate role
    const validRoles = ['admin', 'agent', 'estimator', 'inspector'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role. Must be one of: admin, agent, estimator, inspector'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Email already in use'
      });
    }

    // Create user
    const user = await User.create({
      email,
      password,
      firstName,
      lastName,
      role,
      location
    });

    // Return user data without password
    const userData = {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      location: user.location,
      createdAt: user.createdAt
    };

    res.status(201).json({
      success: true,
      data: userData
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Update user (admin only)
exports.updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { firstName, lastName, email, role, location } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !role) {
      return res.status(400).json({
        success: false,
        error: 'FirstName, lastName, email, and role are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid email address'
      });
    }

    // Validate role
    const validRoles = ['admin', 'agent', 'estimator', 'inspector'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role. Must be one of: admin, agent, estimator, inspector'
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check if email is already taken by another user
    const existingUser = await User.findOne({ email, _id: { $ne: userId } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Email is already taken by another user'
      });
    }

    // Prevent admin from changing their own role to non-admin
    if (user._id.toString() === req.user.id && role !== 'admin') {
      return res.status(400).json({
        success: false,
        error: 'Cannot change your own role from admin'
      });
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        firstName,
        lastName,
        email,
        role,
        location
      },
      { new: true }
    ).select('-password');

    res.status(200).json({
      success: true,
      data: updatedUser
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Delete user (admin only)
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Prevent admin from deleting themselves
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete your own account'
      });
    }

    // Delete user
    await User.findByIdAndDelete(userId);

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get all users (admin only)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('firstName lastName email location role createdAt');

    res.status(200).json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Error fetching all users:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Update quote by case ID (for authenticated estimators)
exports.updateQuoteByCaseId = async (req, res) => {
  try {
    const { caseId } = req.params;
    const quoteData = req.body;

    // Find the case
    const caseData = await Case.findById(caseId)
      .populate('customer')
      .populate('vehicle')
      .populate('inspection');
    
    if (!caseData) {
      return res.status(404).json({
        success: false,
        error: 'Case not found'
      });
    }

    let quote;
    
    // Check if quote already exists
    if (caseData.quote) {
      // Check if quote has already been decided (accepted or declined)
      const existingQuote = await Quote.findById(caseData.quote._id);
      if (existingQuote) {
        const isQuoteDecided = existingQuote.offerDecision?.decision === 'accepted' || 
                              existingQuote.offerDecision?.decision === 'declined' ||
                              existingQuote.status === 'accepted' || 
                              existingQuote.status === 'declined';
        
        if (isQuoteDecided) {
          return res.status(400).json({
            success: false,
            error: `Quote has already been ${existingQuote.offerDecision?.decision || existingQuote.status}. Cannot modify a quote that has been decided.`
          });
        }
      }
      
      // Update existing quote
      quote = await Quote.findByIdAndUpdate(
        caseData.quote._id,
        {
          ...quoteData,
          status: 'ready'
        },
        { new: true }
      ).populate('caseId')
       .populate('vehicle')
       .populate('customer')
       .populate('inspection');
    } else {
      // Create new quote if none exists
      quote = await Quote.create({
        caseId: caseId,
        vehicle: caseData.vehicle._id,
        customer: caseData.customer._id,
        inspection: caseData.inspection?._id,
        estimator: {
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          email: req.user.email
        },
        ...quoteData,
        status: 'ready',
        createdBy: req.user.id
      });

      // Populate the quote with related data
      quote = await Quote.findById(quote._id)
        .populate('caseId')
        .populate('vehicle')
        .populate('customer')
        .populate('inspection');

      // Update case with quote reference
      await Case.findByIdAndUpdate(
        caseId,
        {
          quote: quote._id,
          currentStage: 4,
          'stageStatuses.3': 'complete',
          'stageStatuses.4': 'active',
          status: 'quote-ready'
        }
      );
    }

    if (!quote) {
      return res.status(404).json({
        success: false,
        error: 'Failed to create or update quote'
      });
    }

    // Create or update transaction with sale price from quote
    if (quote.offerAmount) {
      let transaction = await Transaction.findOne({ quote: quote._id });
      
      if (transaction) {
        // Update existing transaction
        transaction = await Transaction.findByIdAndUpdate(
          transaction._id,
          {
            'billOfSale.salePrice': quote.offerAmount
          },
          { new: true }
        );
      } else {
        // Create new transaction with sale price
        transaction = await Transaction.create({
          vehicle: caseData.vehicle._id,
          customer: caseData.customer._id,
          quote: quote._id,
          billOfSale: {
            salePrice: quote.offerAmount
          },
          createdBy: req.user.id
        });
      }
      
      // Update case with transaction reference if not already set
      if (!caseData.transaction) {
        await Case.findByIdAndUpdate(
          caseId,
          { transaction: transaction._id }
        );
      }
    }

    // Send quote email to customer automatically
    try {
      const emailResult = await emailService.sendQuoteEmail(
        quote.customer,
        quote.vehicle,
        quote,
        process.env.FRONTEND_URL
      );
      console.log('Quote email sent successfully:', emailResult.message);
      
      // Update quote to mark email as sent
      await Quote.findByIdAndUpdate(quote._id, { emailSent: true });
    } catch (emailError) {
      console.error('Error sending quote email:', emailError);
      // Don't fail the quote submission if email fails
    }

    res.status(200).json({
      success: true,
      data: quote
    });
  } catch (error) {
    console.error('Error updating quote by case ID:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Update offer decision by case ID (for authenticated estimators)
exports.updateOfferDecisionByCaseId = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { offerDecision } = req.body;

    console.log('updateOfferDecisionByCaseId called with caseId:', caseId);
    console.log('offerDecision:', offerDecision);
    console.log('User:', req.user ? { id: req.user.id, role: req.user.role } : 'No user');

    // Find the case and its quote
    const caseData = await Case.findById(caseId).populate('quote');
    
    if (!caseData) {
      console.log('Case not found for ID:', caseId);
      return res.status(404).json({
        success: false,
        error: 'Case not found'
      });
    }

    if (!caseData.quote) {
      console.log('No quote found for case:', caseId);
      return res.status(404).json({
        success: false,
        error: 'No quote found for this case'
      });
    }

    console.log('Case and quote found successfully');

    // Update the quote with offer decision
    const updatedQuote = await Quote.findByIdAndUpdate(
      caseData.quote._id,
      {
        offerDecision: {
          ...offerDecision,
          decisionDate: new Date()
        }
      },
      { new: true }
    ).populate('caseId')
     .populate('vehicle')
     .populate('customer')
     .populate('inspection');

    if (!updatedQuote) {
      console.log('Quote update failed');
      return res.status(404).json({
        success: false,
        error: 'Quote not found'
      });
    }

    console.log('Quote updated successfully');

    // Update case status and stage based on decision
    if (offerDecision.decision === 'declined') {
      await Case.findByIdAndUpdate(
        caseId,
        { 
          status: 'quote-declined',
          currentStage: 6, // Move to completion stage
          'stageStatuses.4': 'complete', // Mark offer decision as complete
          'stageStatuses.6': 'active' // Mark completion as active
        }
      );
      console.log('Case marked as quote-declined and moved to completion stage');
    } else if (offerDecision.decision === 'accepted') {
      await Case.findByIdAndUpdate(
        caseId,
        { 
          status: 'negotiating',
          currentStage: 4, // Move to paperwork stage
          'stageStatuses.4': 'active', // Mark offer decision as complete
        }
      );
      console.log('Case marked as negotiating and moved to paperwork stage');
    }

    console.log('Offer decision updated successfully');

    res.status(200).json({
      success: true,
      data: updatedQuote
    });
  } catch (error) {
    console.error('Error updating offer decision by case ID:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Complete case by case ID (for authenticated estimators)
exports.completeCaseByCaseId = async (req, res) => {
  try {
    const { caseId } = req.params;

    console.log('completeCaseByCaseId called with caseId:', caseId);

    const caseData = await Case.findById(caseId)
      .populate('customer')
      .populate('vehicle')
      .populate('inspection')
      .populate('quote')
      .populate('transaction');

    if (!caseData) {
      return res.status(404).json({
        success: false,
        error: 'Case not found'
      });
    }

    // Check if this is a declined offer case
    const isDeclinedOffer = caseData.status === 'quote-declined' || 
                           (caseData.quote && caseData.quote.offerDecision && 
                            caseData.quote.offerDecision.decision === 'declined');

    // Generate case file PDF
    const pdfResult = await pdfService.generateCasePDF(caseData);

    // Update case with PDF path and completion status
    const updateData = {
      pdfCaseFile: pdfResult.filePath,
      thankYouSent: true
    };

    // Set appropriate status based on whether it's a declined offer
    if (isDeclinedOffer) {
      updateData.status = 'cancelled'; // Mark as cancelled for declined offers
    } else {
      updateData.status = 'completed'; // Mark as completed for successful transactions
    }

    const updatedCase = await Case.findByIdAndUpdate(
      caseId,
      updateData,
      { new: true }
    );

    // Send appropriate email based on case type
    if (isDeclinedOffer) {
      // For declined offers, send a different type of email or skip email
      console.log('Skipping confirmation email for declined offer case');
    } else {
      // Send thank you email with PDF for completed transactions
      await emailService.sendCustomerConfirmationEmail(
        caseData.customer,
        caseData.vehicle,
        caseData.transaction,
        `${process.env.NEXT_PUBLIC_API_URL}/uploads/pdfs/${pdfResult.fileName}`,
        process.env.FRONTEND_URL
      );
    }

    console.log('Case completed successfully by case ID');

    res.status(200).json({
      success: true,
      data: {
        case: updatedCase,
        pdfUrl: `${process.env.NEXT_PUBLIC_API_URL}/uploads/pdfs/${pdfResult.fileName}`
      }
    });
  } catch (error) {
    console.error('Error completing case by case ID:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Save paperwork data by case ID (for authenticated estimators)
exports.savePaperworkByCaseId = async (req, res) => {
  try {
    const { caseId } = req.params;
    const paperworkData = req.body;

    console.log('=== savePaperworkByCaseId START ===');
    console.log('caseId:', caseId);
    console.log('User:', req.user.id, req.user.role);
    console.log('paperworkData:', JSON.stringify(paperworkData, null, 2));

    // Validate caseId format
    if (!caseId || caseId.length !== 24) {
      console.log('Invalid case ID format:', caseId);
      return res.status(400).json({
        success: false,
        error: 'Invalid case ID format'
      });
    }

    // Find the case
    const caseData = await Case.findById(caseId)
      .populate('customer')
      .populate('vehicle')
      .populate('quote');
    
    console.log('Case lookup result:', caseData ? 'Found' : 'Not found');
    
    if (!caseData) {
      console.log('Case not found for ID:', caseId);
      return res.status(404).json({
        success: false,
        error: 'Case not found'
      });
    }

    console.log('Case data found:', {
      id: caseData._id,
      customer: caseData.customer ? caseData.customer._id : null,
      vehicle: caseData.vehicle ? caseData.vehicle._id : null,
      quote: caseData.quote ? caseData.quote._id : null
    });

    // Validate that we have vehicle data
    if (!caseData.vehicle) {
      console.log('No vehicle found in case');
      return res.status(400).json({
        success: false,
        error: 'No vehicle found in case'
      });
    }

    // Get vehicle ID (handle both populated and unpopulated cases)
    const vehicleId = caseData.vehicle._id || caseData.vehicle;
    console.log('Vehicle ID:', vehicleId);

    // Update vehicle information in the vehicle database first
    const vehicleUpdateData = {
      year: paperworkData.billOfSale?.vehicleYear || caseData.vehicle?.year,
      make: paperworkData.billOfSale?.vehicleMake || caseData.vehicle?.make,
      model: paperworkData.billOfSale?.vehicleModel || caseData.vehicle?.model,
      vin: paperworkData.billOfSale?.vehicleVIN || caseData.vehicle?.vin,
      currentMileage: paperworkData.billOfSale?.vehicleMileage || caseData.vehicle?.currentMileage,
      color: paperworkData.billOfSale?.vehicleColor || caseData.vehicle?.color,
      bodyStyle: paperworkData.billOfSale?.vehicleBodyStyle || caseData.vehicle?.bodyStyle,
      licensePlate: paperworkData.billOfSale?.vehicleLicensePlate || caseData.vehicle?.licensePlate,
      licenseState: paperworkData.billOfSale?.vehicleLicenseState || caseData.vehicle?.licenseState,
      titleNumber: paperworkData.billOfSale?.vehicleTitleNumber || caseData.vehicle?.titleNumber,
      titleStatus: paperworkData.billOfSale?.titleStatus || caseData.vehicle?.titleStatus,
      knownDefects: paperworkData.billOfSale?.knownDefects || caseData.vehicle?.knownDefects,
    };

    console.log('Vehicle update data:', vehicleUpdateData);

    // Update the vehicle record
    const updatedVehicle = await Vehicle.findByIdAndUpdate(
      vehicleId,
      vehicleUpdateData,
      { new: true }
    );

    if (!updatedVehicle) {
      console.log('Failed to update vehicle');
      return res.status(500).json({
        success: false,
        error: 'Failed to update vehicle'
      });
    }

    console.log('Vehicle updated successfully:', updatedVehicle._id);

    // Get customer ID (handle both populated and unpopulated cases)
    const customerId = caseData.customer._id || caseData.customer;
    const quoteId = caseData.quote?._id || caseData.quote;

    // Create or update transaction record with paperwork data
    let transaction;
    
    if (caseData.transaction) {
      console.log('Updating existing transaction:', caseData.transaction);
      // Try to update existing transaction
      transaction = await Transaction.findByIdAndUpdate(
        caseData.transaction,
        {
          billOfSale: {
            sellerName: paperworkData.billOfSale?.sellerName || '',
            sellerAddress: paperworkData.billOfSale?.sellerAddress || '',
            sellerCity: paperworkData.billOfSale?.sellerCity || '',
            sellerState: paperworkData.billOfSale?.sellerState || '',
            sellerZip: paperworkData.billOfSale?.sellerZip || '',
            sellerPhone: paperworkData.billOfSale?.sellerPhone || '',
            sellerEmail: paperworkData.billOfSale?.sellerEmail || '',
            sellerDLNumber: paperworkData.billOfSale?.sellerDLNumber || '',
            sellerDLState: paperworkData.billOfSale?.sellerDLState || '',
            vehicleVIN: updatedVehicle.vin || paperworkData.billOfSale?.vehicleVIN || '',
            vehicleYear: updatedVehicle.year || paperworkData.billOfSale?.vehicleYear || '',
            vehicleMake: updatedVehicle.make || paperworkData.billOfSale?.vehicleMake || '',
            vehicleModel: updatedVehicle.model || paperworkData.billOfSale?.vehicleModel || '',
            vehicleColor: updatedVehicle.color || paperworkData.billOfSale?.vehicleColor || '',
            vehicleBodyStyle: updatedVehicle.bodyStyle || paperworkData.billOfSale?.vehicleBodyStyle || '',
            vehicleLicensePlate: updatedVehicle.licensePlate || paperworkData.billOfSale?.vehicleLicensePlate || '',
            vehicleLicenseState: updatedVehicle.licenseState || paperworkData.billOfSale?.vehicleLicenseState || '',
            vehicleTitleNumber: updatedVehicle.titleNumber || paperworkData.billOfSale?.vehicleTitleNumber || '',
            vehicleMileage: updatedVehicle.currentMileage || paperworkData.billOfSale?.vehicleMileage || '',
            saleDate: paperworkData.billOfSale?.saleDate || new Date().toISOString().split("T")[0],
            saleTime: paperworkData.billOfSale?.saleTime || new Date().toTimeString().split(" ")[0].slice(0, 5),
            salePrice: caseData.quote?.offerAmount || paperworkData.billOfSale?.salePrice || 0,
            preferredPaymentMethod: paperworkData.preferredPaymentMethod || 'Wire',
            odometerReading: paperworkData.billOfSale?.odometerReading || '',
            odometerAccurate: paperworkData.billOfSale?.odometerAccurate || true,
            titleStatus: updatedVehicle.titleStatus || paperworkData.billOfSale?.titleStatus || 'clean',
            knownDefects: updatedVehicle.knownDefects || paperworkData.billOfSale?.knownDefects || '',
            asIsAcknowledgment: paperworkData.billOfSale?.asIsAcknowledgment || false,
            notaryRequired: paperworkData.billOfSale?.notaryRequired || false,
            notaryName: paperworkData.billOfSale?.notaryName || '',
            notaryCommissionExpiry: paperworkData.billOfSale?.notaryCommissionExpiry || '',
            witnessName: paperworkData.billOfSale?.witnessName || '',
            witnessPhone: paperworkData.billOfSale?.witnessPhone || '',
          },
          bankDetails: {
            bankName: paperworkData.bankDetails?.bankName || '',
            loanNumber: paperworkData.bankDetails?.loanNumber || '',
            payoffAmount: paperworkData.bankDetails?.payoffAmount || 0
          },
          payoffStatus: paperworkData.payoffStatus || 'not_required',
          payoffNotes: paperworkData.payoffNotes || '',
          preferredPaymentMethod: paperworkData.preferredPaymentMethod || 'Wire',
          paymentStatus: paperworkData.status || 'pending',
          submittedAt: paperworkData.submittedAt || new Date(),
          completedAt: paperworkData.status === 'completed' ? new Date() : null
        },
        { new: true }
      );
      
      // If transaction update failed (transaction doesn't exist), create a new one
      if (!transaction) {
        console.log('Transaction not found, creating new transaction');
        transaction = await Transaction.create({
          vehicle: vehicleId,
          customer: customerId,
          quote: quoteId,
          billOfSale: {
            sellerName: paperworkData.billOfSale?.sellerName || '',
            sellerAddress: paperworkData.billOfSale?.sellerAddress || '',
            sellerCity: paperworkData.billOfSale?.sellerCity || '',
            sellerState: paperworkData.billOfSale?.sellerState || '',
            sellerZip: paperworkData.billOfSale?.sellerZip || '',
            sellerPhone: paperworkData.billOfSale?.sellerPhone || '',
            sellerEmail: paperworkData.billOfSale?.sellerEmail || '',
            sellerDLNumber: paperworkData.billOfSale?.sellerDLNumber || '',
            sellerDLState: paperworkData.billOfSale?.sellerDLState || '',
            vehicleVIN: updatedVehicle.vin || paperworkData.billOfSale?.vehicleVIN || '',
            vehicleYear: updatedVehicle.year || paperworkData.billOfSale?.vehicleYear || '',
            vehicleMake: updatedVehicle.make || paperworkData.billOfSale?.vehicleMake || '',
            vehicleModel: updatedVehicle.model || paperworkData.billOfSale?.vehicleModel || '',
            vehicleColor: updatedVehicle.color || paperworkData.billOfSale?.vehicleColor || '',
            vehicleBodyStyle: updatedVehicle.bodyStyle || paperworkData.billOfSale?.vehicleBodyStyle || '',
            vehicleLicensePlate: updatedVehicle.licensePlate || paperworkData.billOfSale?.vehicleLicensePlate || '',
            vehicleLicenseState: updatedVehicle.licenseState || paperworkData.billOfSale?.vehicleLicenseState || '',
            vehicleTitleNumber: updatedVehicle.titleNumber || paperworkData.billOfSale?.vehicleTitleNumber || '',
            vehicleMileage: updatedVehicle.currentMileage || paperworkData.billOfSale?.vehicleMileage || '',
            saleDate: paperworkData.billOfSale?.saleDate || new Date().toISOString().split("T")[0],
            saleTime: paperworkData.billOfSale?.saleTime || new Date().toTimeString().split(" ")[0].slice(0, 5),
            salePrice: caseData.quote?.offerAmount || paperworkData.billOfSale?.salePrice || 0,
            preferredPaymentMethod: paperworkData.preferredPaymentMethod || 'Wire',
            odometerReading: paperworkData.billOfSale?.odometerReading || '',
            odometerAccurate: paperworkData.billOfSale?.odometerAccurate || true,
            titleStatus: updatedVehicle.titleStatus || paperworkData.billOfSale?.titleStatus || 'clean',
            knownDefects: updatedVehicle.knownDefects || paperworkData.billOfSale?.knownDefects || '',
            asIsAcknowledgment: paperworkData.billOfSale?.asIsAcknowledgment || false,
            notaryRequired: paperworkData.billOfSale?.notaryRequired || false,
            notaryName: paperworkData.billOfSale?.notaryName || '',
            notaryCommissionExpiry: paperworkData.billOfSale?.notaryCommissionExpiry || '',
            witnessName: paperworkData.billOfSale?.witnessName || '',
            witnessPhone: paperworkData.billOfSale?.witnessPhone || '',
          },
          bankDetails: {
            bankName: paperworkData.bankDetails?.bankName || '',
            loanNumber: paperworkData.bankDetails?.loanNumber || '',
            payoffAmount: paperworkData.bankDetails?.payoffAmount || 0
          },
          payoffStatus: paperworkData.payoffStatus || 'not_required',
          payoffNotes: paperworkData.payoffNotes || '',
          preferredPaymentMethod: paperworkData.preferredPaymentMethod || 'Wire',
          paymentStatus: paperworkData.status || 'pending',
          submittedAt: paperworkData.submittedAt || new Date(),
          completedAt: paperworkData.status === 'completed' ? new Date() : null,
          createdBy: req.user.id
        });
      }
    } else {
      console.log('Creating new transaction');
      // Create new transaction
      transaction = await Transaction.create({
        vehicle: vehicleId,
        customer: customerId,
        quote: quoteId,
        billOfSale: {
          sellerName: paperworkData.billOfSale?.sellerName || '',
          sellerAddress: paperworkData.billOfSale?.sellerAddress || '',
          sellerCity: paperworkData.billOfSale?.sellerCity || '',
          sellerState: paperworkData.billOfSale?.sellerState || '',
          sellerZip: paperworkData.billOfSale?.sellerZip || '',
          sellerPhone: paperworkData.billOfSale?.sellerPhone || '',
          sellerEmail: paperworkData.billOfSale?.sellerEmail || '',
          sellerDLNumber: paperworkData.billOfSale?.sellerDLNumber || '',
          sellerDLState: paperworkData.billOfSale?.sellerDLState || '',
          vehicleVIN: updatedVehicle.vin || paperworkData.billOfSale?.vehicleVIN || '',
          vehicleYear: updatedVehicle.year || paperworkData.billOfSale?.vehicleYear || '',
          vehicleMake: updatedVehicle.make || paperworkData.billOfSale?.vehicleMake || '',
          vehicleModel: updatedVehicle.model || paperworkData.billOfSale?.vehicleModel || '',
          vehicleColor: updatedVehicle.color || paperworkData.billOfSale?.vehicleColor || '',
          vehicleBodyStyle: updatedVehicle.bodyStyle || paperworkData.billOfSale?.vehicleBodyStyle || '',
          vehicleLicensePlate: updatedVehicle.licensePlate || paperworkData.billOfSale?.vehicleLicensePlate || '',
          vehicleLicenseState: updatedVehicle.licenseState || paperworkData.billOfSale?.vehicleLicenseState || '',
          vehicleTitleNumber: updatedVehicle.titleNumber || paperworkData.billOfSale?.vehicleTitleNumber || '',
          vehicleMileage: updatedVehicle.currentMileage || paperworkData.billOfSale?.vehicleMileage || '',
          saleDate: paperworkData.billOfSale?.saleDate || new Date().toISOString().split("T")[0],
          saleTime: paperworkData.billOfSale?.saleTime || new Date().toTimeString().split(" ")[0].slice(0, 5),
          salePrice: caseData.quote?.offerAmount || paperworkData.billOfSale?.salePrice || 0,
          preferredPaymentMethod: paperworkData.preferredPaymentMethod || 'Wire',
          odometerReading: paperworkData.billOfSale?.odometerReading || '',
          odometerAccurate: paperworkData.billOfSale?.odometerAccurate || true,
          titleStatus: updatedVehicle.titleStatus || paperworkData.billOfSale?.titleStatus || 'clean',
          knownDefects: updatedVehicle.knownDefects || paperworkData.billOfSale?.knownDefects || '',
          asIsAcknowledgment: paperworkData.billOfSale?.asIsAcknowledgment || false,
          notaryRequired: paperworkData.billOfSale?.notaryRequired || false,
          notaryName: paperworkData.billOfSale?.notaryName || '',
          notaryCommissionExpiry: paperworkData.billOfSale?.notaryCommissionExpiry || '',
                      witnessName: paperworkData.billOfSale?.witnessName || '',
            witnessPhone: paperworkData.billOfSale?.witnessPhone || '',
          },
          bankDetails: {
            bankName: paperworkData.bankDetails?.bankName || '',
            loanNumber: paperworkData.bankDetails?.loanNumber || '',
            payoffAmount: paperworkData.bankDetails?.payoffAmount || 0
          },
          payoffStatus: paperworkData.payoffStatus || 'not_required',
          payoffNotes: paperworkData.payoffNotes || '',
          preferredPaymentMethod: paperworkData.preferredPaymentMethod || 'Wire',
          paymentStatus: paperworkData.status || 'pending',
          submittedAt: paperworkData.submittedAt || new Date(),
          completedAt: paperworkData.status === 'completed' ? new Date() : null,
          createdBy: req.user.id
        });
      }

    if (!transaction) {
      console.log('Failed to create/update transaction');
      return res.status(500).json({
        success: false,
        error: 'Failed to create/update transaction'
      });
    }

    console.log('Transaction created/updated successfully:', transaction._id);

    // Update case with transaction reference only - don't automatically advance stages
    // The frontend will call updateCaseStageByCaseId separately to manage stage status
    const updatedCase = await Case.findByIdAndUpdate(
      caseId,
      {
        transaction: transaction._id,
      },
      { new: true }
    ).populate('customer')
     .populate('vehicle')
     .populate('quote')
     .populate('transaction');

    if (!updatedCase) {
      console.log('Failed to update case');
      return res.status(500).json({
        success: false,
        error: 'Failed to update case'
      });
    }

    console.log('Case updated successfully');

    console.log('=== savePaperworkByCaseId SUCCESS ===');

    res.status(200).json({
      success: true,
      data: {
        case: updatedCase,
        transaction: transaction
      }
    });
  } catch (error) {
    console.error('=== savePaperworkByCaseId ERROR ===');
    console.error('Error saving paperwork by case ID:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Generate Bill of Sale PDF
exports.generateBillOfSalePDF = async (req, res) => {
  try {
    const { caseId } = req.params;

    const caseData = await Case.findById(caseId)
      .populate('customer')
      .populate('vehicle')
      .populate('quote')
      .populate('transaction');

    if (!caseData) {
      return res.status(404).json({
        success: false,
        error: 'Case not found'
      });
    }

    // Generate Bill of Sale PDF
    const pdfResult = await pdfService.generateBillOfSalePDF(caseData);

    // Set appropriate headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="bill-of-sale-${caseId}.pdf"`);

    // Send the PDF file
    res.sendFile(pdfResult.filePath);
  } catch (error) {
    console.error('Generate Bill of Sale PDF error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Generate Quote Summary PDF
exports.generateQuoteSummary = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { quoteData } = req.body; // Get quote data from request body

    const caseData = await Case.findById(caseId)
      .populate('customer')
      .populate('vehicle')
      .populate('inspection')
      .populate('quote')
      .populate('transaction');

    if (!caseData) {
      return res.status(404).json({
        success: false,
        error: 'Case not found'
      });
    }

    // If quote data is provided, merge it with the case data
    if (quoteData) {
      // Ensure proper type conversion for numeric fields
      const processedQuoteData = {
        ...quoteData,
        offerAmount: quoteData.offerAmount !== undefined ? Number(quoteData.offerAmount) : undefined,
        estimatedValue: quoteData.estimatedValue !== undefined ? Number(quoteData.estimatedValue) : undefined
      };
      caseData.quote = {
        ...caseData.quote,
        ...processedQuoteData
      };
    }

    // Generate Quote Summary PDF
    const pdfResult = await pdfService.generateQuoteSummaryPDF(caseData);

    // Set appropriate headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="quote-summary-${caseId}.pdf"`);

    // Send the PDF file
    res.sendFile(pdfResult.filePath);
  } catch (error) {
    console.error('Generate Quote Summary PDF error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Send customer email
exports.sendCustomerEmail = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { emailType } = req.body;

    if (!emailType || !['quote', 'decision', 'thank-you', 'declined-followup'].includes(emailType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email type. Must be one of: quote, decision, thank-you, declined-followup'
      });
    }

    const caseData = await Case.findById(caseId)
      .populate('customer')
      .populate('vehicle')
      .populate('inspection')
      .populate('quote')
      .populate('transaction');

    if (!caseData) {
      return res.status(404).json({
        success: false,
        error: 'Case not found'
      });
    }

    // Send appropriate email based on type
    let emailResult;
    switch (emailType) {
      case 'quote':
        // Send quote email to customer
        emailResult = await emailService.sendQuoteEmail(
          caseData.customer,
          caseData.vehicle,
          caseData.quote,
          process.env.FRONTEND_URL
        );
        break;
      case 'decision':
        // Send decision confirmation email
        emailResult = await emailService.sendDecisionEmail(
          caseData.customer,
          caseData.vehicle,
          caseData.quote,
          process.env.FRONTEND_URL
        );
        break;
      case 'thank-you':
        // Send thank you email
        emailResult = await emailService.sendCustomerConfirmationEmail(
          caseData.customer,
          caseData.vehicle,
          caseData.transaction,
          caseData.pdfCaseFile ? `${process.env.NEXT_PUBLIC_API_URL}/uploads/pdfs/${path.basename(caseData.pdfCaseFile)}` : null,
          process.env.FRONTEND_URL
        );
        break;
      case 'declined-followup':
        // Send declined offer follow-up email
        emailResult = await emailService.sendDeclinedOfferFollowupEmail(
          caseData.customer,
          caseData.vehicle,
          caseData.quote,
          process.env.FRONTEND_URL
        );
        break;
    }

    res.status(200).json({
      success: true,
      data: {
        message: `${emailType} email sent successfully to ${caseData.customer.email1}`,
        emailType
      }
    });
  } catch (error) {
    console.error(`Error sending ${req.body.emailType} email:`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send email'
    });
  }
};

// Save completion data by case ID (for authenticated users)
exports.saveCompletionData = async (req, res) => {
  try {
    const { caseId } = req.params;
    const completionData = req.body;

    console.log('saveCompletionData called with caseId:', caseId);
    console.log('Completion data:', completionData);

    // Find the case
    const caseData = await Case.findById(caseId)
      .populate('customer')
      .populate('vehicle')
      .populate('quote')
      .populate('transaction');
    
    if (!caseData) {
      return res.status(404).json({
        success: false,
        error: 'Case not found'
      });
    }

    // Update case with completion data
    const updatedCase = await Case.findByIdAndUpdate(
      caseId,
      {
        completion: {
          thankYouSent: completionData.thankYouSent || false,
          sentAt: completionData.sentAt || new Date(),
          leaveBehinds: {
            vehicleLeft: completionData.leaveBehinds?.vehicleLeft || false,
            keysHandedOver: completionData.leaveBehinds?.keysHandedOver || false,
            documentsReceived: completionData.leaveBehinds?.documentsReceived || false
          },
          pdfGenerated: completionData.pdfGenerated || false,
          completedAt: completionData.completedAt || new Date(),
          titleConfirmation: completionData.titleConfirmation || false
        },
        status: 'completed',
        currentStage: 6,
        'stageStatuses.6': 'complete'
      },
      { new: true }
    ).populate('customer')
     .populate('vehicle')
     .populate('quote')
     .populate('transaction');

    console.log('Completion data saved successfully');

    res.status(200).json({
      success: true,
      data: updatedCase
    });
  } catch (error) {
    console.error('Error saving completion data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get detailed analytics for reports
exports.getAnalytics = async (req, res) => {
  try {
    const { timeRange = '30d' } = req.query;
    
    const now = new Date();
    let startDate;
    
    switch (timeRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(0); // All time
    }

    // Get cases with populated data
    const cases = await Case.find({
      createdAt: { $gte: startDate }
    })
    .populate('customer')
    .populate('vehicle')
    .populate('inspection')
    .populate('quote')
    .populate('transaction')
    .populate('createdBy', 'firstName lastName email')
    .sort({ createdAt: -1 });

    // Calculate analytics
    const analytics = {
      totalCases: cases.length,
      totalRevenue: 0,
      avgCaseValue: 0,
      completionRate: 0,
      avgProcessingTime: 0,
      avgInspectionRating: 0,
      casesByStatus: {},
      casesByStage: {},
      revenueByMonth: {},
      casesByDay: {},
      topVehicles: {},
      agentPerformance: {},
      decisionBreakdown: {},
      stageProgression: Array.from({ length: 7 }, (_, i) => ({ stage: i + 1, count: 0, avgTime: 0 }))
    };

    cases.forEach(caseData => {
      // Calculate revenue - only for completed cases, exclude declined/closed cases
      let revenue = 0;
      if (caseData.status === 'completed') {
        revenue = caseData.quote?.offerDecision?.finalAmount || 
                  caseData.quote?.offerAmount || 
                  caseData.transaction?.billOfSale?.salePrice || 0;
      }
      analytics.totalRevenue += revenue;

      // Cases by status - combine declined offers and closed cases
      if (caseData.status === "quote-declined" || caseData.status === "cancelled") {
        analytics.casesByStatus["quote-declined"] = (analytics.casesByStatus["quote-declined"] || 0) + 1;
      } else {
        analytics.casesByStatus[caseData.status] = (analytics.casesByStatus[caseData.status] || 0) + 1;
      }

      // Cases by stage
      analytics.casesByStage[`Stage ${caseData.currentStage}`] = (analytics.casesByStage[`Stage ${caseData.currentStage}`] || 0) + 1;

      // Revenue by month - only for completed cases
      if (caseData.status === 'completed') {
        const month = new Date(caseData.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        if (!analytics.revenueByMonth[month]) {
          analytics.revenueByMonth[month] = { revenue: 0, cases: 0 };
        }
        analytics.revenueByMonth[month].revenue += revenue;
        analytics.revenueByMonth[month].cases += 1;
      }

      // Cases by day - only for completed cases
      if (caseData.status === 'completed') {
        const day = new Date(caseData.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (!analytics.casesByDay[day]) {
          analytics.casesByDay[day] = { cases: 0, revenue: 0 };
        }
        analytics.casesByDay[day].cases += 1;
        analytics.casesByDay[day].revenue += revenue;
      }

      // Top vehicles - only for completed cases
      if (caseData.status === 'completed' && caseData.vehicle?.make && caseData.vehicle?.model) {
        const vehicleKey = `${caseData.vehicle.make} ${caseData.vehicle.model}`;
        if (!analytics.topVehicles[vehicleKey]) {
          analytics.topVehicles[vehicleKey] = { count: 0, totalValue: 0 };
        }
        analytics.topVehicles[vehicleKey].count += 1;
        analytics.topVehicles[vehicleKey].totalValue += revenue;
      }

      // Agent performance - only for completed cases
      if (caseData.status === 'completed' && caseData.createdBy) {
        const agentId = caseData.createdBy._id || caseData.createdBy;
        const agentName = caseData.createdBy.firstName && caseData.createdBy.lastName 
          ? `${caseData.createdBy.firstName} ${caseData.createdBy.lastName}`
          : `Agent ${agentId.toString().slice(-4)}`;
        
        if (!analytics.agentPerformance[agentId]) {
          analytics.agentPerformance[agentId] = { 
            agentName, 
            cases: 0, 
            revenue: 0, 
            ratings: [] 
          };
        }
        analytics.agentPerformance[agentId].cases += 1;
        analytics.agentPerformance[agentId].revenue += revenue;
        
        if (caseData.inspection?.overallRating) {
          analytics.agentPerformance[agentId].ratings.push(caseData.inspection.overallRating);
        }
      }

      // Decision breakdown - handle declined offers properly
      let decision = caseData.quote?.offerDecision?.decision || 'pending';
      if (caseData.status === "quote-declined" || caseData.status === "cancelled") {
        decision = 'declined';
      }
      analytics.decisionBreakdown[decision] = (analytics.decisionBreakdown[decision] || 0) + 1;

      // Stage progression
      const stageIndex = caseData.currentStage - 1;
      if (stageIndex >= 0 && stageIndex < analytics.stageProgression.length) {
        analytics.stageProgression[stageIndex].count += 1;
      }
    });

    // Calculate averages and percentages
    const completedCasesCount = analytics.casesByStatus.completed || 0;
    analytics.avgCaseValue = completedCasesCount > 0 ? analytics.totalRevenue / completedCasesCount : 0;
    // Calculate completion rate excluding declined/closed cases
    const totalActiveCases = analytics.totalCases - (analytics.casesByStatus["quote-declined"] || 0);
    analytics.completionRate = totalActiveCases > 0 ? 
      (analytics.casesByStatus.completed || 0) / totalActiveCases * 100 : 0;

    // Calculate average inspection rating
    const allRatings = cases
      .filter(c => c.inspection?.overallRating)
      .map(c => c.inspection.overallRating);
    analytics.avgInspectionRating = allRatings.length > 0 ? 
      allRatings.reduce((sum, rating) => sum + rating, 0) / allRatings.length : 0;

    // Calculate average processing time for completed cases
    const completedCases = cases.filter(c => c.status === 'completed');
    const processingTimes = completedCases.map(c => {
      const created = new Date(c.createdAt);
      const completed = new Date(c.updatedAt || c.createdAt);
      return (completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24); // days
    });
    analytics.avgProcessingTime = processingTimes.length > 0 ? 
      processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length : 0;

    // Convert objects to arrays for easier frontend consumption
    analytics.revenueByMonth = Object.entries(analytics.revenueByMonth).map(([month, data]) => ({
      month,
      revenue: data.revenue,
      cases: data.cases
    }));

    analytics.casesByDay = Object.entries(analytics.casesByDay).map(([date, data]) => ({
      date,
      cases: data.cases,
      revenue: data.revenue
    }));

    analytics.topVehicles = Object.entries(analytics.topVehicles)
      .map(([vehicle, data]) => {
        const [make, ...modelParts] = vehicle.split(' ');
        return {
          make,
          model: modelParts.join(' '),
          count: data.count,
          avgValue: data.totalValue / data.count
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    analytics.agentPerformance = Object.values(analytics.agentPerformance)
      .map(agent => ({
        ...agent,
        avgRating: agent.ratings.length > 0 ? 
          agent.ratings.reduce((sum, rating) => sum + rating, 0) / agent.ratings.length : 0
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    analytics.decisionBreakdown = Object.entries(analytics.decisionBreakdown).map(([decision, count]) => {
      let displayName = decision.charAt(0).toUpperCase() + decision.slice(1);
      if (decision === 'declined') {
        displayName = 'Offer Declined / Closed';
      } else if (decision === 'accepted') {
        displayName = 'Offer Accepted';
      } else if (decision === 'negotiating') {
        displayName = 'Under Negotiation';
      } else if (decision === 'pending') {
        displayName = 'Pending Decision';
      }
      return {
        decision: displayName,
        count,
        percentage: (count / analytics.totalCases) * 100
      };
    });

    res.status(200).json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Customer intake form submission
exports.customerIntake = async (req, res) => {
  try {
    const { customer: customerData, vehicle: vehicleData } = req.body;

    console.log('Customer intake submission received:', {
      customer: customerData.firstName + ' ' + customerData.lastName,
      vehicle: vehicleData.year + ' ' + vehicleData.make + ' ' + vehicleData.model
    });

    // Create customer record (without agent assignment)
    const customer = await Customer.create({
      ...customerData,
      agent: null, // No agent assigned yet
      storeLocation: '' // Will be assigned by agent later
    });

    // Create vehicle record
    const vehicle = await Vehicle.create({
      ...vehicleData,
      customer: customer._id
    });

    // Create case record with initial stage
    const newCase = await Case.create({
      customer: customer._id,
      vehicle: vehicle._id,
      currentStage: 2,
      status: 'new',
      createdBy: null, // No user assigned yet
      documents: {
        driverLicenseFront: '',
        driverLicenseRear: '',
        vehicleTitle: ''
      },
      stageStatuses: {
        1: 'complete',
        2: 'active',
        3: 'pending',
        4: 'pending',
        5: 'pending',
        6: 'pending',
      }
    });

    // Populate the references for the response
    const populatedCase = await Case.findById(newCase._id)
      .populate('customer')
      .populate('vehicle');

    // Send email notifications
    try {
      // Send customer creation confirmation email
      await emailService.sendCustomerCreationEmail(
        customer,
        vehicle,
        process.env.FRONTEND_URL
      );

      // Send admin notification
      await emailService.sendCustomerIntakeNotification(
        customer,
        vehicle,
        populatedCase,
        process.env.FRONTEND_URL
      );
    } catch (emailError) {
      console.error('Error sending customer creation emails:', emailError);
      // Don't fail the request if email fails
    }

    console.log('Customer intake case created successfully:', populatedCase._id);

    res.status(201).json({
      success: true,
      data: {
        caseId: populatedCase._id,
        customerId: customer._id,
        vehicleId: vehicle._id,
        message: 'Customer intake submitted successfully'
      }
    });
  } catch (error) {
    console.error('Customer intake error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Save custom vehicle make and model
exports.saveCustomVehicle = async (req, res) => {
  try {
    const { make, model } = req.body;

    if (!make || !model) {
      return res.status(400).json({
        success: false,
        error: 'Make and model are required'
      });
    }

    // Store in a simple JSON file or database collection
    // For now, we'll use a simple approach with a JSON file
    const fs = require('fs').promises;
    const path = require('path');
    const customVehiclesPath = path.join(__dirname, '../data/custom-vehicles.json');

    let customVehicles = { makes: [], models: {} };
    try {
      // Read existing custom vehicles
      const existingData = await fs.readFile(customVehiclesPath, 'utf8');
      customVehicles = JSON.parse(existingData);
    } catch (error) {
      // File doesn't exist, use empty structure
    }

    // Add the new make if it doesn't exist
    if (!customVehicles.makes.includes(make)) {
      customVehicles.makes.push(make);
    }

    // Add the new model if it doesn't exist for this make
    if (!customVehicles.models[make]) {
      customVehicles.models[make] = [];
    }

    if (!customVehicles.models[make].includes(model)) {
      customVehicles.models[make].push(model);
    }

    // Ensure directory exists
    const dir = path.dirname(customVehiclesPath);
    await fs.mkdir(dir, { recursive: true });

    // Write back to file
    await fs.writeFile(customVehiclesPath, JSON.stringify(customVehicles, null, 2));

    res.status(200).json({
      success: true,
      data: { make, model },
      message: 'Custom vehicle saved successfully'
    });
  } catch (error) {
    console.error('Error saving custom vehicle:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get all vehicle makes and models (including custom ones)
exports.getVehicleMakesAndModels = async (req, res) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    const customVehiclesPath = path.join(__dirname, '../data/custom-vehicles.json');

    // Default vehicle makes and models
    const defaultMakes = [
      'Acura', 'Alfa Romeo', 'Aston Martin', 'Audi', 'Bentley', 'BMW', 'Buick', 'Cadillac',
      'Chevrolet', 'Chrysler', 'Citroen', 'Dodge', 'Ferrari', 'Fiat', 'Ford', 'Genesis',
      'GMC', 'Honda', 'Hyundai', 'Infiniti', 'Jaguar', 'Jeep', 'Kia', 'Lamborghini',
      'Land Rover', 'Lexus', 'Lincoln', 'Lotus', 'Maserati', 'Mazda', 'McLaren', 'Mercedes-Benz',
      'MINI', 'Mitsubishi', 'Nissan', 'Oldsmobile', 'Peugeot', 'Pontiac', 'Porsche', 'Ram',
      'Renault', 'Rolls-Royce', 'Saab', 'Saturn', 'Scion', 'Subaru', 'Suzuki', 'Tesla',
      'Toyota', 'Volkswagen', 'Volvo'
    ];

    const defaultModels = {
      'Acura': ['CL', 'ILX', 'Integra', 'Legend', 'MDX', 'NSX', 'RDX', 'RL', 'RSX', 'TL', 'TLX', 'TSX', 'ZDX'],
      'Alfa Romeo': ['4C', 'Giulia', 'Giulietta', 'Stelvio', 'Tonale'],
      'Aston Martin': ['DB11', 'DB12', 'DBS', 'Vantage', 'Virage'],
      'Audi': ['A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'Q3', 'Q4', 'Q5', 'Q7', 'Q8', 'RS', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'TT'],
      'Bentley': ['Bentayga', 'Continental', 'Flying Spur', 'Mulsanne'],
      'BMW': ['1 Series', '2 Series', '3 Series', '4 Series', '5 Series', '6 Series', '7 Series', '8 Series', 'i3', 'i4', 'i7', 'i8', 'M2', 'M3', 'M4', 'M5', 'M8', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'Z4'],
      'Buick': ['Cascada', 'Enclave', 'Encore', 'Envision', 'LaCrosse', 'Regal', 'Rendezvous', 'Terraza'],
      'Cadillac': ['ATS', 'CT4', 'CT5', 'CT6', 'CTS', 'DTS', 'Escalade', 'SRX', 'STS', 'XLR', 'XT4', 'XT5', 'XT6'],
      'Chevrolet': ['Aveo', 'Blazer', 'Camaro', 'Caprice', 'Captiva', 'Cavalier', 'Cobalt', 'Colorado', 'Corvette', 'Cruze', 'Equinox', 'Express', 'HHR', 'Impala', 'Malibu', 'Monte Carlo', 'Prizm', 'S10', 'Silverado', 'Sonic', 'Spark', 'Suburban', 'Tahoe', 'Tracker', 'TrailBlazer', 'Traverse', 'Trax', 'Uplander', 'Venture'],
      'Chrysler': ['200', '300', '300M', 'Aspen', 'Cirrus', 'Concorde', 'Crossfire', 'Grand Voyager', 'LHS', 'New Yorker', 'Pacifica', 'PT Cruiser', 'Sebring', 'Town & Country', 'Voyager'],
      'Citroen': ['C3', 'C4', 'C5'],
      'Dodge': ['Avenger', 'Caliber', 'Caravan', 'Challenger', 'Charger', 'Dart', 'Durango', 'Grand Caravan', 'Intrepid', 'Journey', 'Magnum', 'Neon', 'Nitro', 'Ram', 'Shadow', 'Spirit', 'Stealth', 'Stratus', 'Viper'],
      'Ferrari': ['296', '488', '812', 'California', 'F8', 'FF', 'F12', 'GTC4Lusso', 'LaFerrari', 'Portofino', 'Roma', 'SF90'],
      'Fiat': ['500', '500L', '500X', '124 Spider'],
      'Ford': ['Bronco', 'Bronco Sport', 'C-Max', 'Contour', 'Crown Victoria', 'EcoSport', 'Edge', 'Escape', 'Expedition', 'Explorer', 'F-150', 'F-250', 'F-350', 'F-450', 'F-550', 'Fiesta', 'Five Hundred', 'Flex', 'Focus', 'Fusion', 'Galaxy', 'GT', 'Ka', 'Kuga', 'Maverick', 'Mondeo', 'Mustang', 'Puma', 'Ranger', 'S-Max', 'Taurus', 'Thunderbird', 'Transit', 'Windstar'],
      'Genesis': ['G70', 'G80', 'G90', 'GV60', 'GV70', 'GV80'],
      'GMC': ['Acadia', 'Canyon', 'Envoy', 'Hummer H1', 'Hummer H2', 'Hummer H3', 'Jimmy', 'Safari', 'Savana', 'Sierra', 'Sonoma', 'Terrain', 'Yukon'],
      'Honda': ['Accord', 'Civic', 'Clarity', 'CR-V', 'CR-Z', 'Element', 'Fit', 'HR-V', 'Insight', 'Odyssey', 'Passport', 'Pilot', 'Prelude', 'Ridgeline', 'S2000'],
      'Hyundai': ['Accent', 'Azera', 'Elantra', 'Entourage', 'Equus', 'Genesis', 'Ioniq', 'Kona', 'Nexo', 'Palisade', 'Santa Cruz', 'Santa Fe', 'Sonata', 'Tiburon', 'Tucson', 'Veloster', 'Venue', 'Veracruz', 'XG'],
      'Infiniti': ['EX', 'FX', 'G', 'I', 'J', 'JX', 'M', 'Q30', 'Q40', 'Q50', 'Q60', 'Q70', 'QX30', 'QX50', 'QX55', 'QX60', 'QX70', 'QX80'],
      'Jaguar': ['E-Pace', 'F-Pace', 'F-Type', 'I-Pace', 'S-Type', 'X-Type', 'XE', 'XF', 'XJ', 'XK'],
      'Jeep': ['Cherokee', 'Compass', 'Gladiator', 'Grand Cherokee', 'Liberty', 'Patriot', 'Renegade', 'Wrangler'],
      'Kia': ['Amanti', 'Borrego', 'Cadenza', 'Carens', 'Ceed', 'Cerato', 'Forte', 'K5', 'K900', 'Magentis', 'Mohave', 'Niro', 'Optima', 'Picanto', 'ProCeed', 'Rio', 'Sedana', 'Seltos', 'Sorento', 'Soul', 'Spectra', 'Sportage', 'Stinger', 'Telluride'],
      'Lamborghini': ['Aventador', 'Countach', 'Diablo', 'Gallardo', 'Huracan', 'Murcielago', 'Reventon', 'Urus', 'Veneno'],
      'Land Rover': ['Defender', 'Discovery', 'Discovery Sport', 'Evoque', 'Freelander', 'LR2', 'LR3', 'LR4', 'Range Rover', 'Range Rover Sport', 'Range Rover Velar'],
      'Lexus': ['CT', 'ES', 'GS', 'HS', 'IS', 'LC', 'LFA', 'LS', 'LX', 'NX', 'RC', 'RX', 'SC', 'UX'],
      'Lincoln': ['Aviator', 'Blackwood', 'Continental', 'Corsair', 'LS', 'Mark LT', 'Mark VIII', 'MKC', 'MKS', 'MKT', 'MKX', 'MKZ', 'Navigator', 'Town Car', 'Zephyr'],
      'Lotus': ['Elise', 'Europa', 'Evora', 'Exige'],
      'Maserati': ['Ghibli', 'GranTurismo', 'Levante', 'MC20', 'Quattroporte'],
      'Mazda': ['2', '3', '5', '6', 'CX-3', 'CX-30', 'CX-5', 'CX-7', 'CX-9', 'MX-30', 'MX-5', 'MX-6', 'Protege', 'RX-7', 'RX-8', 'Tribute'],
      'McLaren': ['540C', '570S', '600LT', '650S', '675LT', '720S', '750S', '765LT', 'Artura', 'F1', 'GT', 'P1', 'Senna'],
      'Mercedes-Benz': ['A-Class', 'B-Class', 'C-Class', 'CLA', 'CLS', 'E-Class', 'G-Class', 'GLA', 'GLB', 'GLC', 'GLE', 'GLK', 'GLS', 'M-Class', 'R-Class', 'S-Class', 'SL', 'SLC', 'SLK', 'SLS', 'Sprinter', 'V-Class'],
      'MINI': ['Clubman', 'Countryman', 'Coupe', 'Hardtop', 'Paceman', 'Roadster'],
      'Mitsubishi': ['3000GT', 'Diamante', 'Eclipse', 'Endeavor', 'Galant', 'i-MiEV', 'Lancer', 'Mirage', 'Montero', 'Outlander', 'Pajero', 'Raider'],
      'Nissan': ['350Z', '370Z', 'Altima', 'Armada', 'Frontier', 'GT-R', 'Juke', 'Leaf', 'Maxima', 'Murano', 'NV', 'Pathfinder', 'Quest', 'Rogue', 'Sentra', 'Titan', 'Versa', 'Xterra'],
      'Oldsmobile': ['Alero', 'Aurora', 'Bravada', 'Cutlass', 'Intrigue', 'Silhouette'],
      'Peugeot': ['2008', '3008', '5008', '508'],
      'Pontiac': ['Aztek', 'Bonneville', 'Firebird', 'G3', 'G5', 'G6', 'G8', 'Grand Am', 'Grand Prix', 'GTO', 'Montana', 'Solstice', 'Sunfire', 'Torrent', 'Vibe'],
      'Porsche': ['911', '918', '924', '928', '944', '968', 'Boxster', 'Cayenne', 'Cayman', 'Macan', 'Panamera', 'Taycan'],
      'Ram': ['1500', '2500', '3500', 'ProMaster', 'ProMaster City'],
      'Renault': ['Clio', 'Megane', 'Zoe'],
      'Rolls-Royce': ['Cullinan', 'Dawn', 'Ghost', 'Phantom', 'Wraith'],
      'Saab': ['9-3', '9-5', '9-7X'],
      'Saturn': ['Aura', 'Ion', 'Outlook', 'Relay', 'Sky', 'Vue'],
      'Scion': ['FR-S', 'iA', 'iM', 'iQ', 'tC', 'xA', 'xB', 'xD'],
      'Subaru': ['Ascent', 'BRZ', 'Crosstrek', 'Forester', 'Impreza', 'Legacy', 'Outback', 'SVX', 'Tribeca', 'WRX', 'XV'],
      'Suzuki': ['Aerio', 'Equator', 'Forenza', 'Grand Vitara', 'Kizashi', 'Reno', 'SX4', 'Verona', 'XL-7'],
      'Tesla': ['Model 3', 'Model S', 'Model X', 'Model Y', 'Roadster'],
      'Toyota': ['4Runner', '86', 'Avalon', 'Camry', 'Celica', 'Corolla', 'Cressida', 'Echo', 'FJ Cruiser', 'Highlander', 'Land Cruiser', 'Matrix', 'MR2', 'Paseo', 'Previa', 'Prius', 'Prius C', 'Prius V', 'RAV4', 'Sequoia', 'Sienna', 'Solara', 'Supra', 'Tacoma', 'Tercel', 'Tundra', 'Venza', 'Yaris'],
      'Volkswagen': ['Arteon', 'Atlas', 'Beetle', 'CC', 'Eos', 'Golf', 'GTI', 'Jetta', 'Passat', 'Phaeton', 'Polo', 'Routan', 'Scirocco', 'Tiguan', 'Touareg', 'Touran'],
      'Volvo': ['C30', 'C70', 'S40', 'S60', 'S70', 'S80', 'S90', 'V40', 'V50', 'V60', 'V70', 'V90', 'XC40', 'XC60', 'XC70', 'XC90']
    };

    // Try to read custom vehicles
    let customVehicles = { makes: [], models: {} };
    try {
      const customData = await fs.readFile(customVehiclesPath, 'utf8');
      customVehicles = JSON.parse(customData);
    } catch (error) {
      // File doesn't exist, use empty structure
    }

    // Combine default and custom makes
    const allMakes = [...new Set([...defaultMakes, ...customVehicles.makes])].sort();

    // Combine default and custom models
    const allModels = { ...defaultModels };
    Object.keys(customVehicles.models).forEach(make => {
      if (!allModels[make]) {
        allModels[make] = [];
      }
      allModels[make] = [...new Set([...allModels[make], ...customVehicles.models[make]])].sort();
    });

    res.status(200).json({
      success: true,
      data: {
        makes: allMakes,
        models: allModels
      }
    });
  } catch (error) {
    console.error('Error getting vehicle makes and models:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Send customer intake form email
exports.sendCustomerFormEmail = async (req, res) => {
  try {
    const { customerEmail, customerName } = req.body;

    if (!customerEmail || !customerName) {
      return res.status(400).json({
        success: false,
        error: 'Customer email and name are required'
      });
    }

    // Generate a unique form URL (you could add a token for tracking)
    const formUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/customer-intake`;
    
    // Send email with form link
    try {
      await emailService.sendCustomerFormEmail(customerEmail, customerName, formUrl);
      
      res.status(200).json({
        success: true,
        data: {
          emailSent: true,
          formUrl: formUrl,
          message: 'Customer form email sent successfully'
        }
      });
    } catch (emailError) {
      console.error('Error sending customer form email:', emailError);
      res.status(500).json({
        success: false,
        error: 'Failed to send email'
      });
    }
  } catch (error) {
    console.error('Send customer form email error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get time tracking for a specific case
exports.getTimeTrackingByCaseId = async (req, res) => {
  try {
    const { caseId } = req.params;
    const timeTracking = await TimeTracking.findOne({ caseId });
    if (!timeTracking) {
      return res.status(404).json({ success: false, error: 'No time tracking found for this case' });
    }
    res.status(200).json({ success: true, data: timeTracking });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get analytics for all cases' time tracking
exports.getTimeTrackingAnalytics = async (req, res) => {
  try {
    const all = await TimeTracking.find({});
    if (!all.length) return res.status(200).json({ success: true, data: { stageAverages: {}, totalCases: 0 } });
    const stageNames = Object.keys(all[0].stageTimes || {});
    const stageTotals = {};
    const stageCounts = {};
    stageNames.forEach(stage => { stageTotals[stage] = 0; stageCounts[stage] = 0; });
    all.forEach(tt => {
      stageNames.forEach(stage => {
        const t = tt.stageTimes[stage];
        if (t && t.totalTime) {
          stageTotals[stage] += t.totalTime;
          stageCounts[stage] += 1;
        }
      });
    });
    const stageAverages = {};
    stageNames.forEach(stage => {
      stageAverages[stage] = stageCounts[stage] ? stageTotals[stage] / stageCounts[stage] : 0;
    });
    res.status(200).json({ success: true, data: { stageAverages, totalCases: all.length } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Confirm payoff for a transaction
exports.confirmPayoff = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { payoffStatus, payoffNotes } = req.body;

    console.log('=== confirmPayoff START ===');
    console.log('caseId:', caseId);
    console.log('User:', req.user.id, req.user.role);
    console.log('payoffStatus:', payoffStatus);
    console.log('payoffNotes:', payoffNotes);

    // Validate caseId format
    if (!caseId || caseId.length !== 24) {
      console.log('Invalid case ID format:', caseId);
      return res.status(400).json({
        success: false,
        error: 'Invalid case ID format'
      });
    }

    // Find the case
    const caseData = await Case.findById(caseId)
      .populate('customer')
      .populate('vehicle')
      .populate('quote')
      .populate('transaction');
    
    if (!caseData) {
      console.log('Case not found for ID:', caseId);
      return res.status(404).json({
        success: false,
        error: 'Case not found'
      });
    }

    if (!caseData.transaction) {
      console.log('No transaction found for case:', caseId);
      return res.status(404).json({
        success: false,
        error: 'No transaction found for this case'
      });
    }

    // Update transaction with payoff confirmation
    const updateData = {
      payoffStatus: payoffStatus,
      payoffNotes: payoffNotes || '',
      payoffConfirmedBy: req.user.id
    };

    // Set timestamps based on status
    if (payoffStatus === 'confirmed') {
      updateData.payoffConfirmedAt = new Date();
    } else if (payoffStatus === 'completed') {
      updateData.payoffCompletedAt = new Date();
      // If not already confirmed, set confirmed timestamp too
      if (!caseData.transaction.payoffConfirmedAt) {
        updateData.payoffConfirmedAt = new Date();
      }
    }

    const updatedTransaction = await Transaction.findByIdAndUpdate(
      caseData.transaction._id,
      updateData,
      { new: true }
    );

    if (!updatedTransaction) {
      console.log('Failed to update transaction');
      return res.status(500).json({
        success: false,
        error: 'Failed to update transaction'
      });
    }

    console.log('Transaction updated successfully:', updatedTransaction._id);

    // Update case with updated transaction
    const updatedCase = await Case.findByIdAndUpdate(
      caseId,
      {
        transaction: updatedTransaction._id
      },
      { new: true }
    ).populate('customer')
     .populate('vehicle')
     .populate('quote')
     .populate('transaction');

    console.log('=== confirmPayoff SUCCESS ===');

    res.status(200).json({
      success: true,
      data: {
        case: updatedCase,
        transaction: updatedTransaction
      }
    });
  } catch (error) {
    console.error('=== confirmPayoff ERROR ===');
    console.error('Error confirming payoff:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get comprehensive user analytics
exports.getUserAnalytics = async (req, res) => {
  try {
    const { userId } = req.params;
    const { timeRange = '30d' } = req.query;

    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Calculate date range
    const now = new Date();
    const timeRangeMap = {
      '7d': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      '30d': new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      '90d': new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
      '1y': new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
    };
    const startDate = timeRangeMap[timeRange] || timeRangeMap['30d'];

    let analytics = {
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        location: user.location,
        createdAt: user.createdAt
      },
      overview: {
        totalCases: 0,
        completedCases: 0,
        activeCases: 0,
        totalRevenue: 0,
        averageCaseValue: 0,
        completionRate: 0,
        averageProcessingTime: 0
      },
      timeTracking: {
        totalTimeSpent: 0,
        averageTimePerCase: 0,
        timeByStage: {},
        recentActivity: []
      },
      performance: {
        casesThisMonth: 0,
        casesLastMonth: 0,
        revenueThisMonth: 0,
        revenueLastMonth: 0,
        topPerformingMonths: []
      },
      vehicles: {
        totalVehicles: 0,
        lowestValue: null,
        highestValue: null,
        averageValue: 0,
        valueDistribution: {}
      },
      roleSpecific: {}
    };

    // Get cases based on user role
    let userCases = [];
    
    if (user.role === 'agent') {
      // Agent cases - cases they created
      userCases = await Case.find({ 
        createdBy: user._id,
        createdAt: { $gte: startDate }
      }).populate('customer vehicle quote transaction');
    } else if (user.role === 'estimator') {
      // Estimator cases - cases they were assigned to via estimatorId
      userCases = await Case.find({
        estimatorId: user._id,
        createdAt: { $gte: startDate }
      }).populate('customer vehicle quote transaction');
    } else if (user.role === 'inspector') {
      // Inspector cases - inspections they performed
      const inspections = await Inspection.find({
        'inspector.email': user.email,
        createdAt: { $gte: startDate }
      });
      const caseIds = inspections.map(inspection => inspection.caseId);
      userCases = await Case.find({
        _id: { $in: caseIds }
      }).populate('customer vehicle quote transaction inspection');
    }

    // Calculate overview metrics
    analytics.overview.totalCases = userCases.length;
    analytics.overview.completedCases = userCases.filter(case_ => case_.status === 'completed').length;
    analytics.overview.activeCases = userCases.filter(case_ => case_.status !== 'completed' && case_.status !== 'cancelled').length;
    
    // Calculate revenue and values
    const completedCases = userCases.filter(case_ => case_.status === 'completed');
    analytics.overview.totalRevenue = completedCases.reduce((sum, case_) => {
      // Check if transaction exists and has billOfSale with salePrice
      if (case_.transaction && case_.transaction.billOfSale && case_.transaction.billOfSale.salePrice) {
        return sum + case_.transaction.billOfSale.salePrice;
      }
      return sum;
    }, 0);
    
    analytics.overview.averageCaseValue = completedCases.length > 0 
      ? analytics.overview.totalRevenue / completedCases.length 
      : 0;
    
    analytics.overview.completionRate = userCases.length > 0 
      ? (analytics.overview.completedCases / userCases.length) * 100 
      : 0;

    // Calculate average processing time per case
    const processingTimes = userCases.map(case_ => {
      const created = new Date(case_.createdAt);
      const completed = case_.status === 'completed' 
        ? new Date(case_.completion?.completedAt || case_.updatedAt)
        : new Date(case_.updatedAt);
      const timeDiff = completed.getTime() - created.getTime();
      return timeDiff > 0 ? timeDiff / (1000 * 60 * 60 * 24) : 0; // days
    }).filter(time => !isNaN(time) && time > 0);
    
    analytics.overview.averageProcessingTime = processingTimes.length > 0 
      ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length 
      : 0;

    // Get time tracking data
    const timeTrackingData = await TimeTracking.find({
      caseId: { $in: userCases.map(case_ => case_._id) }
    });

    // Calculate time tracking metrics
    analytics.timeTracking.totalTimeSpent = timeTrackingData.reduce((sum, tracking) => {
      return sum + (tracking.totalTime || 0);
    }, 0);

    analytics.timeTracking.averageTimePerCase = userCases.length > 0 
      ? analytics.timeTracking.totalTimeSpent / userCases.length 
      : 0;

    // Group time by stage
    const timeByStage = {};
    timeTrackingData.forEach(tracking => {
      if (tracking.stageTimes) {
        Object.keys(tracking.stageTimes).forEach(stage => {
          if (!timeByStage[stage]) timeByStage[stage] = 0;
          // Access the totalTime property of each stage
          const stageTime = tracking.stageTimes[stage]?.totalTime || 0;
          timeByStage[stage] += stageTime;
        });
      }
    });
    analytics.timeTracking.timeByStage = timeByStage;

    // Get recent activity (last 10 cases)
    analytics.timeTracking.recentActivity = userCases
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 10)
      .map(case_ => ({
        caseId: case_._id,
        status: case_.status,
        lastActivity: case_.lastActivity || null,
        updatedAt: case_.updatedAt || case_.createdAt,
        customer: case_.customer ? {
          name: `${case_.customer.firstName} ${case_.customer.lastName}`,
          id: case_.customer._id
        } : null,
        vehicle: case_.vehicle ? {
          year: case_.vehicle.year,
          make: case_.vehicle.make,
          model: case_.vehicle.model,
          id: case_.vehicle._id
        } : null
      }));

    // Calculate monthly performance
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    
    analytics.performance.casesThisMonth = userCases.filter(case_ => 
      new Date(case_.createdAt) >= thisMonth
    ).length;
    
    analytics.performance.casesLastMonth = userCases.filter(case_ => 
      new Date(case_.createdAt) >= lastMonth && new Date(case_.createdAt) < thisMonth
    ).length;

    // Calculate monthly revenue
    analytics.performance.revenueThisMonth = completedCases
      .filter(case_ => new Date(case_.completion?.completedAt || case_.updatedAt) >= thisMonth)
      .reduce((sum, case_) => {
        if (case_.transaction && case_.transaction.billOfSale && case_.transaction.billOfSale.salePrice) {
          return sum + case_.transaction.billOfSale.salePrice;
        }
        return sum;
      }, 0);
    
    analytics.performance.revenueLastMonth = completedCases
      .filter(case_ => {
        const completedDate = new Date(case_.completion?.completedAt || case_.updatedAt);
        return completedDate >= lastMonth && completedDate < thisMonth;
      })
      .reduce((sum, case_) => {
        if (case_.transaction && case_.transaction.billOfSale && case_.transaction.billOfSale.salePrice) {
          return sum + case_.transaction.billOfSale.salePrice;
        }
        return sum;
      }, 0);

    // Calculate vehicle statistics
    const vehicles = userCases.map(case_ => case_.vehicle).filter(Boolean);
    analytics.vehicles.totalVehicles = vehicles.length;
    
    if (vehicles.length > 0) {
      // For estimators, prioritize actual sale prices, then quote amounts, then estimated values
      const values = userCases.map(case_ => {
        // First try to get the actual sale price from transaction
        if (case_.transaction && case_.transaction.billOfSale && case_.transaction.billOfSale.salePrice) {
          return case_.transaction.billOfSale.salePrice;
        }
        // Then try to get the quote amount
        if (case_.quote && case_.quote.offerAmount) {
          return case_.quote.offerAmount;
        }
        // Finally fall back to vehicle estimated value
        if (case_.vehicle && case_.vehicle.estimatedValue) {
          return case_.vehicle.estimatedValue;
        }
        return 0;
      }).filter(value => value > 0);
      
      if (values.length > 0) {
        analytics.vehicles.lowestValue = Math.min(...values);
        analytics.vehicles.highestValue = Math.max(...values);
        analytics.vehicles.averageValue = values.reduce((sum, value) => sum + value, 0) / values.length;
      }
    }

    // Role-specific analytics
    if (user.role === 'agent') {
      analytics.roleSpecific = {
        customersCreated: userCases.length,
        averageCustomerValue: analytics.overview.averageCaseValue,
        conversionRate: analytics.overview.completionRate,
        topCustomers: userCases
          .filter(case_ => case_.customer)
          .map(case_ => ({
            customerId: case_.customer._id,
            customerName: `${case_.customer.firstName} ${case_.customer.lastName}`,
            caseValue: case_.transaction?.billOfSale?.salePrice || 0,
            status: case_.status
          }))
          .sort((a, b) => b.caseValue - a.caseValue)
          .slice(0, 5)
      };
    } else if (user.role === 'estimator') {
      // Calculate quote statistics for estimators
      const quotes = userCases.filter(case_ => case_.quote).map(case_ => case_.quote);
      const acceptedQuotes = quotes.filter(quote => 
        quote.offerDecision && quote.offerDecision.decision === 'accepted'
      );
      const declinedQuotes = quotes.filter(quote => 
        quote.offerDecision && quote.offerDecision.decision === 'declined'
      );
      const negotiatingQuotes = quotes.filter(quote => 
        quote.offerDecision && quote.offerDecision.decision === 'negotiating'
      );
      const pendingQuotes = quotes.filter(quote => 
        !quote.offerDecision || quote.offerDecision.decision === 'pending'
      );
      
      const totalQuoteValue = quotes.reduce((sum, quote) => sum + (quote.offerAmount || 0), 0);
      const acceptedQuoteValue = acceptedQuotes.reduce((sum, quote) => sum + (quote.offerAmount || 0), 0);
      const averageQuoteAmount = quotes.length > 0 ? totalQuoteValue / quotes.length : 0;
      const quoteAcceptanceRate = quotes.length > 0 ? (acceptedQuotes.length / quotes.length) * 100 : 0;
      
      analytics.roleSpecific = {
        customersCreated: userCases.length,
        averageCustomerValue: analytics.overview.averageCaseValue,
        conversionRate: analytics.overview.completionRate,
        totalQuotes: quotes.length,
        acceptedQuotes: acceptedQuotes.length,
        declinedQuotes: declinedQuotes.length,
        negotiatingQuotes: negotiatingQuotes.length,
        pendingQuotes: pendingQuotes.length,
        totalQuoteValue: totalQuoteValue,
        acceptedQuoteValue: acceptedQuoteValue,
        averageQuoteAmount: averageQuoteAmount,
        quoteAcceptanceRate: quoteAcceptanceRate,
        topCustomers: userCases
          .filter(case_ => case_.customer)
          .map(case_ => ({
            customerId: case_.customer._id,
            customerName: `${case_.customer.firstName} ${case_.customer.lastName}`,
            caseValue: case_.transaction?.billOfSale?.salePrice || case_.quote?.offerAmount || 0,
            status: case_.status,
            quoteAmount: case_.quote?.offerAmount || 0,
            quoteStatus: case_.quote?.offerDecision?.decision || 'pending'
          }))
          .sort((a, b) => b.caseValue - a.caseValue)
          .slice(0, 5)
      };
    } else if (user.role === 'inspector') {
      // Get all inspections for this inspector
      const inspections = await Inspection.find({
        'inspector.email': user.email,
        createdAt: { $gte: startDate }
      }).populate('customer vehicle');
      
      // Get cases that have these inspections
      const inspectionIds = inspections.map(inspection => inspection._id);
      const cases = await Case.find({
        inspection: { $in: inspectionIds }
      }).populate('customer vehicle');
      
      // Calculate inspection statistics
      const completedInspections = inspections.filter(inspection => inspection.status === 'completed');
      const pendingInspections = inspections.filter(inspection => inspection.status === 'scheduled');
      const inProgressInspections = inspections.filter(inspection => inspection.status === 'in-progress');
      
      // Calculate monthly performance
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      
      const inspectionsThisMonth = inspections.filter(inspection => 
        new Date(inspection.createdAt) >= thisMonth
      );
      const inspectionsLastMonth = inspections.filter(inspection => 
        new Date(inspection.createdAt) >= lastMonth && new Date(inspection.createdAt) < thisMonth
      );
      
      const completedThisMonth = completedInspections.filter(inspection => 
        new Date(inspection.completedAt || inspection.updatedAt) >= thisMonth
      );
      const completedLastMonth = completedInspections.filter(inspection => {
        const completedDate = new Date(inspection.completedAt || inspection.updatedAt);
        return completedDate >= lastMonth && completedDate < thisMonth;
      });
      
      // Calculate average scores
      const averageScoreThisMonth = completedThisMonth.length > 0 
        ? completedThisMonth.reduce((sum, inspection) => sum + (inspection.overallScore || 0), 0) / completedThisMonth.length 
        : 0;
      const averageScoreLastMonth = completedLastMonth.length > 0 
        ? completedLastMonth.reduce((sum, inspection) => sum + (inspection.overallScore || 0), 0) / completedLastMonth.length 
        : 0;
      
      // Get time tracking for cases
      const caseIds = cases.map(case_ => case_._id);
      const inspectionTimeTracking = await TimeTracking.find({
        caseId: { $in: caseIds }
      });
      
      // Calculate average inspection time
      const totalInspectionTime = inspectionTimeTracking.reduce((sum, tracking) => {
        return sum + (tracking.totalTime || 0);
      }, 0);
      
      const averageInspectionTime = completedInspections.length > 0 
        ? totalInspectionTime / completedInspections.length 
        : 0;
      
      // Update overview for inspector
      analytics.overview = {
        totalCases: cases.length,
        completedCases: completedInspections.length,
        activeCases: pendingInspections.length + inProgressInspections.length,
        totalRevenue: 0, // Inspectors don't generate revenue
        averageCaseValue: 0,
        completionRate: inspections.length > 0 ? (completedInspections.length / inspections.length) * 100 : 0,
        averageProcessingTime: averageInspectionTime / (1000 * 60 * 60 * 24), // Convert to days
        averageInspectionScore: completedInspections.length > 0 
          ? completedInspections.reduce((sum, inspection) => sum + (inspection.overallScore || 0), 0) / completedInspections.length 
          : 0,
        totalInspections: inspections.length,
        completedInspections: completedInspections.length,
        pendingInspections: pendingInspections.length,
        inProgressInspections: inProgressInspections.length,
        averageInspectionTime: averageInspectionTime
      };
      
      // Update performance for inspector
      analytics.performance = {
        casesThisMonth: inspectionsThisMonth.length,
        casesLastMonth: inspectionsLastMonth.length,
        revenueThisMonth: 0,
        revenueLastMonth: 0,
        inspectionsThisMonth: inspectionsThisMonth.length,
        inspectionsLastMonth: inspectionsLastMonth.length,
        completedThisMonth: completedThisMonth.length,
        completedLastMonth: completedLastMonth.length,
        averageScoreThisMonth: averageScoreThisMonth,
        averageScoreLastMonth: averageScoreLastMonth
      };
      
      // Update vehicles for inspector - use case vehicles for better data
      const caseVehicles = cases.map(case_ => case_.vehicle).filter(Boolean);
      const inspectionVehicles = inspections.map(inspection => inspection.vehicle).filter(Boolean);
      
      // Use case vehicles if available, otherwise fall back to inspection vehicles
      const vehicles = caseVehicles.length > 0 ? caseVehicles : inspectionVehicles;
      
      
      
      const vehicleValues = vehicles.map(vehicle => {
        // Use the correct field name from Vehicle model
        let value = vehicle.estimatedValue;
        
        // If no estimatedValue, try to use a reasonable default based on vehicle age
        if (!value || isNaN(value) || value <= 0) {
          const currentYear = new Date().getFullYear();
          const vehicleYear = parseInt(vehicle.year) || currentYear;
          const age = currentYear - vehicleYear;
          
          // Simple default value calculation based on age
          if (age <= 2) value = 25000; // Newer vehicles
          else if (age <= 5) value = 18000; // 3-5 years old
          else if (age <= 10) value = 12000; // 6-10 years old
          else value = 8000; // Older vehicles
        }
        
        const numericValue = typeof value === 'number' && !isNaN(value) && value > 0 ? value : 0;
        
        return numericValue;
      }).filter(value => value > 0);
      
      
      
      analytics.vehicles = {
        totalVehicles: vehicles.length,
        lowestValue: vehicleValues.length > 0 ? Math.min(...vehicleValues) : null,
        highestValue: vehicleValues.length > 0 ? Math.max(...vehicleValues) : null,
        averageValue: vehicleValues.length > 0 
          ? vehicleValues.reduce((sum, value) => sum + value, 0) / vehicleValues.length 
          : 0,
        valueDistribution: vehicles.reduce((acc, vehicle) => {
          // Use the correct field name from Vehicle model
          const type = vehicle.bodyStyle || 'Unknown';
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {})
      };
      
      
      
      // Update time tracking for inspector
      analytics.timeTracking = {
        totalTimeSpent: totalInspectionTime,
        averageTimePerInspection: averageInspectionTime,
        timeByStage: {},
        recentActivity: inspections
          .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
          .slice(0, 10)
          .map(inspection => {
            const case_ = cases.find(c => c.inspection && c.inspection.toString() === inspection._id.toString());
            const timeTracking = case_ ? inspectionTimeTracking.find(t => t.caseId.toString() === case_._id.toString()) : null;
            return {
              inspectionId: inspection._id,
              caseId: case_ ? case_._id : null,
              status: inspection.status,
              score: inspection.overallScore,
              timeSpent: timeTracking?.totalTime || 0,
              completedAt: inspection.completedAt,
              customer: inspection.customer ? {
                name: `${inspection.customer.firstName} ${inspection.customer.lastName}`,
                id: inspection.customer._id
              } : null,
              vehicle: inspection.vehicle ? {
                year: inspection.vehicle.year,
                make: inspection.vehicle.make,
                model: inspection.vehicle.model,
                id: inspection.vehicle._id
              } : null
            };
          })
      };
      
      analytics.roleSpecific = {
        inspectionsCompleted: completedInspections.length,
        averageInspectionScore: completedInspections.length > 0 
          ? completedInspections.reduce((sum, inspection) => sum + (inspection.overallScore || 0), 0) / completedInspections.length 
          : 0,
        averageInspectionTime: averageInspectionTime,
        recentInspections: completedInspections
          .sort((a, b) => new Date(b.completedAt || b.updatedAt || b.createdAt).getTime() - new Date(a.completedAt || a.updatedAt || a.createdAt).getTime())
          .slice(0, 5)
          .map(inspection => {
            const case_ = cases.find(c => c.inspection && c.inspection.toString() === inspection._id.toString());
            const timeTracking = case_ ? inspectionTimeTracking.find(t => t.caseId.toString() === case_._id.toString()) : null;
            return {
              caseId: case_ ? case_._id : inspection._id,
              score: inspection.overallScore || 0,
              status: inspection.status,
              completedAt: inspection.completedAt || inspection.updatedAt || inspection.createdAt,
              timeSpent: timeTracking?.totalTime || 0,
              customerName: inspection.customer ? `${inspection.customer.firstName} ${inspection.customer.lastName}` : 'Unknown',
              vehicleInfo: inspection.vehicle ? `${inspection.vehicle.year} ${inspection.vehicle.make} ${inspection.vehicle.model}` : 'Unknown'
            };
          }),
        pendingInspections: pendingInspections
          .slice(0, 5)
          .map(inspection => {
            const case_ = cases.find(c => c.inspection && c.inspection.toString() === inspection._id.toString());
            return {
              caseId: case_ ? case_._id : inspection._id,
              scheduledDate: inspection.scheduledDate || inspection.createdAt,
              customerName: inspection.customer ? `${inspection.customer.firstName} ${inspection.customer.lastName}` : 'Unknown',
              vehicleInfo: inspection.vehicle ? `${inspection.vehicle.year} ${inspection.vehicle.make} ${inspection.vehicle.model}` : 'Unknown'
            };
          }),
        inProgressInspections: inProgressInspections
          .slice(0, 5)
          .map(inspection => {
            const case_ = cases.find(c => c.inspection && c.inspection.toString() === inspection._id.toString());
            return {
              caseId: case_ ? case_._id : inspection._id,
              startedAt: inspection.updatedAt || inspection.createdAt,
              customerName: inspection.customer ? `${inspection.customer.firstName} ${inspection.customer.lastName}` : 'Unknown',
              vehicleInfo: inspection.vehicle ? `${inspection.vehicle.year} ${inspection.vehicle.make} ${inspection.vehicle.model}` : 'Unknown'
            };
          })
      };
    }

    res.status(200).json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Error getting user analytics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Import required modules for photo upload
const multer = require('multer');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');

// Configure multer for inspection photos
const inspectionPhotoStorage = multer.memoryStorage();
const inspectionPhotoUpload = multer({
  storage: inspectionPhotoStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Check if user exists with given email
const checkUserExists = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    const User = require('../models/User');
    const user = await User.findOne({ email: email.toLowerCase() });
    
    res.json({
      success: true,
      data: {
        exists: !!user,
        email: email
      }
    });

  } catch (error) {
    console.error('Error checking user existence:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while checking user'
    });
  }
};



// Get vehicle pricing from VIN using MarketCheck API
exports.getVehiclePricing = async (req, res) => {
  try {
    const { vin } = req.params;

    if (!vin) {
      return res.status(400).json({
        success: false,
        error: 'VIN is required'
      });
    }

    // Check if we have cached pricing data first
    const vehicle = await Vehicle.findOne({ vin: vin });
    if (vehicle && vehicle.estimatedValue && vehicle.pricingLastUpdated) {
      const lastUpdated = new Date(vehicle.pricingLastUpdated);
      const now = new Date();
      const hoursSinceUpdate = (now - lastUpdated) / (1000 * 60 * 60);
      
      // If pricing data is less than 24 hours old, return cached data
      if (hoursSinceUpdate < 24) {
        return res.status(200).json({
          success: true,
          data: {
            estimatedValue: vehicle.estimatedValue,
            source: vehicle.pricingSource || 'Cached Data',
            lastUpdated: vehicle.pricingLastUpdated.toISOString()
          }
        });
      }
    }

    try {
      // Fetch vehicle pricing from MarketCheck API
      const pricingData = await fetchMarketCheckPricing(vin);

      // Validate the pricing data before saving
      if (!pricingData || !pricingData.estimatedValue || isNaN(pricingData.estimatedValue) || pricingData.estimatedValue <= 0) {
        console.error('Invalid pricing data received from MarketCheck:', pricingData);
        throw new Error('Failed to get valid pricing data from MarketCheck API for this VIN');
      }

      // Store the pricing data in the vehicle record
      if (vehicle) {
        vehicle.estimatedValue = pricingData.estimatedValue;
        vehicle.pricingSource = pricingData.source;
        vehicle.pricingLastUpdated = new Date();
        await vehicle.save();
      }

      res.status(200).json({
        success: true,
        data: {
          estimatedValue: pricingData.estimatedValue,
          source: pricingData.source,
          lastUpdated: new Date().toISOString()
        }
      });
    } catch (apiError) {
      console.error('MarketCheck API error:', apiError.message);
      
      // If we have cached data, return it even if it's old
      if (vehicle && vehicle.estimatedValue) {
        return res.status(200).json({
          success: true,
          data: {
            estimatedValue: vehicle.estimatedValue,
            source: vehicle.pricingSource || 'Cached Data (API Unavailable)',
            lastUpdated: vehicle.pricingLastUpdated?.toISOString() || new Date().toISOString(),
            warning: 'Using cached data due to API rate limit'
          }
        });
      }
      
      // If no cached data, return a more helpful error
      res.status(503).json({
        success: false,
        error: 'Vehicle pricing service is temporarily unavailable. Please try again later or enter a manual estimate.',
        details: apiError.message
      });
    }
  } catch (error) {
    console.error('Error in getVehiclePricing:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch vehicle pricing. Please try again later or enter a manual estimate.'
    });
  }
};

// Fetch vehicle pricing from MarketCheck API
const fetchMarketCheckPricing = async (vin) => {
  try {


    const marketCheckApiKey = process.env.MARKETCHECK_API_KEY;
    
    if (!marketCheckApiKey) {
      throw new Error('MarketCheck API key not configured. Please set MARKETCHECK_API_KEY environment variable.');
    }

    // 1. Try MarketCheck's vehicle specs endpoint first
    const specsUrl = `https://mc-api.marketcheck.com/v2/decode/car/${encodeURIComponent(vin)}/specs?api_key=${marketCheckApiKey}`;
    try {
      const response = await axios.get(specsUrl);
      const data = response.data;
      
      // Extract vehicle specs for pricing
      const {
        year,
        make,
        model,
        trim,
        transmission,
        drivetrain,
        fuel_type,
        highway_mpg,
        city_mpg,
        engine_size,
        engine_block,
        cylinders,
        doors
      } = data;

      // 2. Try MarketCheck's price prediction endpoint
      const transmissionLower = transmission ? transmission.toLowerCase() : '';
      
      // Build query parameters, only including valid values
      const queryParams = new URLSearchParams({
        api_key: marketCheckApiKey,
        car_type: "used",
        year: year || '',
        make: make || '',
        model: model || '',
        trim: trim || '',
        transmission: transmissionLower === "manual" ? "Manual" : "Automatic",
        drivetrain: drivetrain?.toLowerCase() === "fwd" ? "FWD" : drivetrain || '',
        fuel_type: fuel_type || '',
        latitude: 41.149358, // Default location
        longitude: -96.145336, // Default location
        miles: 20000 // Default mileage
      });
      
      // Only add engine parameters if they have valid values
      if (highway_mpg && !isNaN(parseInt(highway_mpg))) queryParams.append('highway_mpg', highway_mpg);
      if (city_mpg && !isNaN(parseInt(city_mpg))) queryParams.append('city_mpg', city_mpg);
      if (doors && !isNaN(parseInt(doors))) queryParams.append('doors', doors);
      
      // Extract engine size from engine string (e.g., "2.5L I4" -> "2.5")
      if (data.engine) {
        const engineMatch = data.engine.match(/(\d+\.?\d*)L/);
        if (engineMatch) {
          queryParams.append('engine_size', engineMatch[1]);
        }
      }

      const priceUrl = `https://mc-api.marketcheck.com/v2/predict/car/price?${queryParams.toString()}`;
      console.log('MarketCheck price prediction URL:', priceUrl);
      
      const priceResponse = await axios.get(priceUrl);
      const priceData = priceResponse.data;
      console.log('MarketCheck price response:', priceData);
      
      if (priceData?.price_range?.lower_bound) {
        return {
          estimatedValue: parseFloat(priceData.price_range.lower_bound),
          source: 'MarketCheck API (Price Prediction)',
          priceRange: priceData.price_range
        };
      }
    } catch (error) {
      console.error('MarketCheck specs/price endpoint error:', error.response?.data || error.message);
    }

    // 3. Try MarketCheck's vehicle history endpoint
    const historyUrl = `https://mc-api.marketcheck.com/v2/history/car/${encodeURIComponent(vin)}?api_key=${marketCheckApiKey}`;
    try {
      const response = await axios.get(historyUrl);
      const data = response.data;
      console.log('MarketCheck history response:', data);
      
      if (data && Array.isArray(data) && data.length > 0) {
        // Filter out unrealistic prices (e.g., > $100k for most vehicles)
        const realisticListings = data.filter(listing => {
          const price = parseFloat(listing.price);
          return price && price > 1000 && price < 100000; // Reasonable price range
        });
        
        if (realisticListings.length > 0) {
          // Get the most recent realistic listing
          const latestListing = realisticListings[0];
          return {
            estimatedValue: parseFloat(latestListing.price),
            source: 'MarketCheck API (Vehicle History)',
            listing: latestListing
          };
        }
      }
    } catch (error) {
      console.error('MarketCheck history endpoint error:', error.response?.data || error.message);
    }

    // 4. Try MarketCheck's search endpoint
    const searchUrl = `https://mc-api.marketcheck.com/v2/search/car/active?api_key=${marketCheckApiKey}&vin=${encodeURIComponent(vin)}`;
    try {
      const response = await axios.get(searchUrl);
      const data = response.data;
      
      if (data && data.listings && data.listings.length > 0) {
        const prices = data.listings
          .filter(listing => {
            const price = parseFloat(listing.price);
            return price && price > 1000 && price < 100000; // Reasonable price range
          })
          .map(listing => parseFloat(listing.price));
        
        if (prices.length > 0) {
          const averagePrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
          return {
            estimatedValue: Math.round(averagePrice),
            source: 'MarketCheck API (Active Listings)'
          };
        }
      }
    } catch (error) {
      console.error('MarketCheck search endpoint error:', error.response?.data || error.message);
    }

    throw new Error('No pricing data available from MarketCheck API');

  } catch (error) {
    console.error('Error fetching from MarketCheck API:', error);
    throw error;
  }
};

// Get vehicle specifications from VIN using MarketCheck API
exports.getVehicleSpecs = async (req, res) => {
  try {
    const { vin } = req.params;

    if (!vin) {
      return res.status(400).json({
        success: false,
        error: 'VIN is required'
      });
    }

    // Check if we have cached vehicle data first
    const vehicle = await Vehicle.findOne({ vin: vin });
    if (vehicle && vehicle.year && vehicle.make && vehicle.model) {
      return res.status(200).json({
        success: true,
        data: {
          year: vehicle.year || '',
          make: vehicle.make || '',
          model: vehicle.model || '',
          trim: vehicle.trim || '',
          body_style: vehicle.bodyStyle || '',
          engine: vehicle.engine || '',
          transmission: vehicle.transmission || '',
          drivetrain: vehicle.drivetrain || '',
          fuel_type: vehicle.fuelType || '',
          doors: vehicle.doors || '',
          exterior_color: vehicle.color || '',
          interior_color: vehicle.interiorColor || ''
        },
        source: 'Cached Data'
      });
    }

    const marketCheckApiKey = process.env.MARKETCHECK_API_KEY;
    
    if (!marketCheckApiKey) {
      // If no API key, try to extract basic info from VIN
      return res.status(200).json({
        success: true,
        data: {},
        source: 'VIN Decode (No API Key)'
      });
    }

    // Use the vehicle specs endpoint from MarketCheck
    const specsUrl = `https://mc-api.marketcheck.com/v2/decode/car/${encodeURIComponent(vin)}/specs?api_key=${marketCheckApiKey}`;
    
    try {
      const response = await axios.get(specsUrl);
      const data = response.data;
      
      // Extract only the needed vehicle specs for frontend
      const vehicleSpecs = {
        year: data.year || '',
        make: data.make || '',
        model: data.model || '',
        trim: data.trim || '',
        body_style: data.body_style || '',
        engine: data.engine || '',
        transmission: data.transmission || '',
        drivetrain: data.drivetrain || '',
        fuel_type: data.fuel_type || '',
        doors: data.doors || '',
        exterior_color: data.exterior_color || '',
        interior_color: data.interior_color || ''
      };

      // Store specs in the vehicle record if it exists
      if (vehicle) {
        // Update the vehicle with basic specs
        if (vehicleSpecs.year) vehicle.year = vehicleSpecs.year;
        if (vehicleSpecs.make) vehicle.make = vehicleSpecs.make;
        if (vehicleSpecs.model) vehicle.model = vehicleSpecs.model;
        if (vehicleSpecs.body_style) vehicle.bodyStyle = vehicleSpecs.body_style;
        if (vehicleSpecs.exterior_color) vehicle.color = vehicleSpecs.exterior_color;
        
        await vehicle.save();
      }

      return res.status(200).json({
        success: true,
        data: vehicleSpecs,
        source: 'MarketCheck API'
      });
    } catch (error) {
      console.error('MarketCheck specs endpoint error:', error.response?.data || error.message);
      
      // If specs endpoint fails, try to get basic info from VIN
      return res.status(200).json({
        success: true,
        data: {},
        source: 'VIN Decode (API Unavailable)',
        warning: 'Using basic VIN decode due to API rate limit'
      });
    }
  } catch (error) {
    console.error('Error in getVehicleSpecs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch vehicle specifications. Please try again later or enter vehicle details manually.'
    });
  }
};


exports.checkUserExists = checkUserExists;