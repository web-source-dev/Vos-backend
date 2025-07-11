const Case = require('../models/Case');
const Customer = require('../models/Customer');
const Vehicle = require('../models/Vehicle');
const Inspection = require('../models/Inspection');
const Quote = require('../models/Quote');
const Transaction = require('../models/Transaction');
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
      currentStage: 1,
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
        7: 'pending'
      }
    });

    // Populate the references for the response
    const populatedCase = await Case.findById(newCase._id)
      .populate('customer')
      .populate('vehicle');

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
      process.env.BASE_URL
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

    console.log('Inspection retrieved:', {
      id: inspection._id,
      sectionsCount: inspection.sections?.length || 0,
      overallRating: inspection.overallRating,
      completed: inspection.completed
    });

    if (inspection.sections && inspection.sections.length > 0) {
      inspection.sections.forEach((section, index) => {
        console.log(`Section ${index + 1}: ${section.name}`, {
          questionsCount: section.questions?.length || 0,
          rating: section.rating,
          score: section.score,
        });
      });
    }

    res.status(200).json({
      success: true,
      data: inspection
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

    // Send email notification about completed inspection
    if (caseData) {
      try {
        await emailService.sendInspectionCompletedEmail(
          inspection,
          caseData.customer,
          caseData.vehicle,
          process.env.BASE_URL
        );
      } catch (emailError) {
        console.error('Error sending inspection completion email:', emailError);
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

// Assign estimator for quote preparation
exports.assignEstimator = async (req, res) => {
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

    // Create quote record
    const quote = await Quote.create({
      caseId: caseId,
      vehicle: caseData.vehicle._id,
      customer: caseData.customer._id,
      inspection: caseData.inspection._id,
      estimator,
      status: 'draft',
      createdBy: req.user.id
    });

    // Update case with quote reference
    await Case.findByIdAndUpdate(caseId, {
      quote: quote._id,
      currentStage: 4,
      'stageStatuses.3': 'complete',
      'stageStatuses.4': 'active',
      status: 'quote-ready'
    });

    // Populate the quote with related data for the response
    const populatedQuote = await Quote.findById(quote._id)
      .populate('caseId')
      .populate('vehicle')
      .populate('customer')
      .populate('inspection');

    // Send email to estimator
    await emailService.sendEstimatorEmail(
      populatedQuote,
      caseData.inspection,
      caseData.customer,
      caseData.vehicle,
      process.env.BASE_URL
    );

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

    // Update case status
    await Case.findOneAndUpdate(
      { quote: quote._id },
      {
        currentStage: 5,
        'stageStatuses.4': 'complete',
        'stageStatuses.5': 'active'
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

    // Update case status based on decision
    let caseUpdate = {
      'stageStatuses.5': 'complete',
      'stageStatuses.6': 'active'
    };

    if (offerDecision.decision === 'accepted') {
      caseUpdate.currentStage = 6;
    } else if (offerDecision.decision === 'declined') {
      caseUpdate.status = 'closed';
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
        currentStage: 7,
        'stageStatuses.6': 'complete',
        'stageStatuses.7': 'active'
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
        currentStage: 7,
        'stageStatuses.6': 'complete',
        'stageStatuses.7': 'active',
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
      process.env.BASE_URL
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
      process.env.BASE_URL
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

    // Don't automatically advance stages - let the frontend manage stage progression
    // The frontend will call updateCaseStageByCaseId separately to manage stage status

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

    // Don't automatically advance stages - let the frontend manage stage progression
    // The frontend will call updateCaseStageByCaseId separately to manage stage status
    // Only update case status if decision is declined
    if (offerDecision.decision === 'declined') {
      await Case.findByIdAndUpdate(
        caseId,
        { status: 'closed' }
      );
      console.log('Case marked as closed due to declined offer');
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

    // Generate case file PDF
    const pdfResult = await pdfService.generateCasePDF(caseData);

    // Update case with PDF path and completion status only - don't automatically advance stages
    // The frontend will call updateCaseStageByCaseId separately to manage stage status
    const updatedCase = await Case.findByIdAndUpdate(
      caseId,
      {
        pdfCaseFile: pdfResult.filePath,
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
      process.env.BASE_URL
    );

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

    // Process document uploads if any files were uploaded
    const documents = {};
    if (paperworkData.documentsUploaded) {
      documents.idRescan = paperworkData.documentsUploaded.idRescan ? '/uploads/documents/id-rescan.jpg' : null;
      documents.signedBillOfSale = paperworkData.documentsUploaded.signedBillOfSale ? '/uploads/documents/signed-bill-of-sale.pdf' : null;
      documents.titlePhoto = paperworkData.documentsUploaded.titlePhoto ? '/uploads/documents/title-photo.jpg' : null;
      documents.insuranceDeclaration = paperworkData.documentsUploaded.insuranceDeclaration ? '/uploads/documents/insurance-declaration.pdf' : null;
      documents.sellerSignature = paperworkData.documentsUploaded.sellerSignature ? '/uploads/documents/seller-signature.jpg' : null;
      documents.additionalDocument = paperworkData.documentsUploaded.additionalDocument ? '/uploads/documents/additional-document.pdf' : null;
    }

    // If there are actual document paths in the paperwork data, use those
    if (paperworkData.documents) {
      Object.keys(paperworkData.documents).forEach(key => {
        if (paperworkData.documents[key]) {
          documents[key] = paperworkData.documents[key];
        }
      });
    }

    console.log('Documents processed:', documents);

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
            salePrice: paperworkData.billOfSale?.salePrice || 0,
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
          preferredPaymentMethod: paperworkData.preferredPaymentMethod || 'Wire',
          documents: documents,
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
            salePrice: paperworkData.billOfSale?.salePrice || 0,
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
          preferredPaymentMethod: paperworkData.preferredPaymentMethod || 'Wire',
          documents: documents,
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
          salePrice: paperworkData.billOfSale?.salePrice || 0,
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
        preferredPaymentMethod: paperworkData.preferredPaymentMethod || 'Wire',
        documents: documents,
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
        status: 'completed'
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

    if (!emailType || !['quote', 'decision', 'thank-you'].includes(emailType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email type. Must be one of: quote, decision, thank-you'
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
          process.env.BASE_URL
        );
        break;
      case 'decision':
        // Send decision confirmation email
        emailResult = await emailService.sendDecisionEmail(
          caseData.customer,
          caseData.vehicle,
          caseData.quote,
          process.env.BASE_URL
        );
        break;
      case 'thank-you':
        // Send thank you email
        emailResult = await emailService.sendCustomerConfirmationEmail(
          caseData.customer,
          caseData.vehicle,
          caseData.transaction,
          caseData.pdfCaseFile ? `${process.env.NEXT_PUBLIC_API_URL}/uploads/pdfs/${path.basename(caseData.pdfCaseFile)}` : null,
          process.env.BASE_URL
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

    // Fetch vehicle pricing from MarketCheck API
    const pricingData = await fetchMarketCheckPricing(vin);

    // Validate the pricing data before saving
    if (!pricingData || !pricingData.estimatedValue || isNaN(pricingData.estimatedValue) || pricingData.estimatedValue <= 0) {
      console.error('Invalid pricing data received from MarketCheck:', pricingData);
      return res.status(500).json({
        success: false,
        error: 'Failed to get valid pricing data from MarketCheck API for this VIN'
      });
    }

    // Store the pricing data in the vehicle record
    const vehicle = await Vehicle.findOne({ vin: vin });
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
  } catch (error) {
    console.error('Error fetching vehicle pricing from MarketCheck:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch vehicle pricing from MarketCheck API'
    });
  }
};

// Fetch vehicle pricing from MarketCheck API
const fetchMarketCheckPricing = async (vin) => {
  try {
    console.log(`Fetching vehicle pricing from MarketCheck API for VIN: ${vin}`);

    const marketCheckApiKey = process.env.MARKETCHECK_API_KEY;
    
    if (!marketCheckApiKey) {
      throw new Error('MarketCheck API key not configured. Please set MARKETCHECK_API_KEY environment variable.');
    }

    // 1. Try MarketCheck's vehicle specs endpoint first
    const specsUrl = `https://mc-api.marketcheck.com/v2/decode/car/${encodeURIComponent(vin)}/specs?api_key=${marketCheckApiKey}`;
    try {
      const response = await axios.get(specsUrl);
      const data = response.data;
      console.log('MarketCheck API specs response:', data);
      
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
      console.log('MarketCheck search response:', data);
      
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
          completedAt: completionData.completedAt || new Date()
        },
        status: 'completed',
        currentStage: 7,
        'stageStatuses.7': 'complete'
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
      // Calculate revenue
      const revenue = caseData.quote?.offerDecision?.finalAmount || 
                     caseData.quote?.offerAmount || 
                     caseData.transaction?.billOfSale?.salePrice || 0;
      analytics.totalRevenue += revenue;

      // Cases by status
      analytics.casesByStatus[caseData.status] = (analytics.casesByStatus[caseData.status] || 0) + 1;

      // Cases by stage
      analytics.casesByStage[`Stage ${caseData.currentStage}`] = (analytics.casesByStage[`Stage ${caseData.currentStage}`] || 0) + 1;

      // Revenue by month
      const month = new Date(caseData.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      if (!analytics.revenueByMonth[month]) {
        analytics.revenueByMonth[month] = { revenue: 0, cases: 0 };
      }
      analytics.revenueByMonth[month].revenue += revenue;
      analytics.revenueByMonth[month].cases += 1;

      // Cases by day
      const day = new Date(caseData.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!analytics.casesByDay[day]) {
        analytics.casesByDay[day] = { cases: 0, revenue: 0 };
      }
      analytics.casesByDay[day].cases += 1;
      analytics.casesByDay[day].revenue += revenue;

      // Top vehicles
      if (caseData.vehicle?.make && caseData.vehicle?.model) {
        const vehicleKey = `${caseData.vehicle.make} ${caseData.vehicle.model}`;
        if (!analytics.topVehicles[vehicleKey]) {
          analytics.topVehicles[vehicleKey] = { count: 0, totalValue: 0 };
        }
        analytics.topVehicles[vehicleKey].count += 1;
        analytics.topVehicles[vehicleKey].totalValue += revenue;
      }

      // Agent performance
      if (caseData.createdBy) {
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

      // Decision breakdown
      const decision = caseData.quote?.offerDecision?.decision || 'pending';
      analytics.decisionBreakdown[decision] = (analytics.decisionBreakdown[decision] || 0) + 1;

      // Stage progression
      const stageIndex = caseData.currentStage - 1;
      if (stageIndex >= 0 && stageIndex < analytics.stageProgression.length) {
        analytics.stageProgression[stageIndex].count += 1;
      }
    });

    // Calculate averages and percentages
    analytics.avgCaseValue = analytics.totalCases > 0 ? analytics.totalRevenue / analytics.totalCases : 0;
    analytics.completionRate = analytics.totalCases > 0 ? 
      (analytics.casesByStatus.completed || 0) / analytics.totalCases * 100 : 0;

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

    analytics.decisionBreakdown = Object.entries(analytics.decisionBreakdown).map(([decision, count]) => ({
      decision: decision.charAt(0).toUpperCase() + decision.slice(1),
      count,
      percentage: (count / analytics.totalCases) * 100
    }));

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

    const marketCheckApiKey = process.env.MARKETCHECK_API_KEY;
    
    if (!marketCheckApiKey) {
      throw new Error('MarketCheck API key not configured. Please set MARKETCHECK_API_KEY environment variable.');
    }

    // Use the vehicle specs endpoint from MarketCheck
    const specsUrl = `https://mc-api.marketcheck.com/v2/decode/car/${encodeURIComponent(vin)}/specs?api_key=${marketCheckApiKey}`;
    
    try {
      const response = await axios.get(specsUrl);
      const data = response.data;
      console.log('MarketCheck API specs response for getVehicleSpecs:', data);
      
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
      const vehicle = await Vehicle.findOne({ vin: vin });
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
        data: vehicleSpecs
      });
    } catch (error) {
      console.error('MarketCheck specs endpoint error:', error.response?.data || error.message);
      
      // If specs endpoint fails, try to get basic info from VIN
      try {
        // Use the pricing function but extract just the specs
        const pricingData = await fetchMarketCheckPricing(vin);
        
        // The pricing function might have found some basic vehicle info
        return res.status(200).json({
          success: true,
          data: {
            year: pricingData.year || '',
            make: pricingData.make || '',
            model: pricingData.model || ''
          },
          source: 'Pricing API fallback'
        });
      } catch (secondError) {
        console.error('Error fetching vehicle specs from pricing fallback:', secondError);
        return res.status(500).json({
          success: false,
          error: 'Failed to get vehicle specifications from MarketCheck API'
        });
      }
    }
  } catch (error) {
    console.error('Error in getVehicleSpecs:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch vehicle specifications'
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
      currentStage: 1,
      status: 'new',
      createdBy: null, // No user assigned yet
      documents: {
        driverLicenseFront: '',
        driverLicenseRear: '',
        vehicleTitle: ''
      },
      stageStatuses: {
        1: 'complete',
        2: 'pending',
        3: 'pending',
        4: 'pending',
        5: 'pending',
        6: 'pending',
        7: 'pending'
      }
    });

    // Populate the references for the response
    const populatedCase = await Case.findById(newCase._id)
      .populate('customer')
      .populate('vehicle');

    // Send email notification to admin
    try {
      await emailService.sendCustomerIntakeNotification(
        customer,
        vehicle,
        populatedCase,
        process.env.BASE_URL
      );
    } catch (emailError) {
      console.error('Error sending customer intake notification email:', emailError);
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