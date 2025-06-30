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

// Schedule inspection and assign inspector
exports.scheduleInspection = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { inspector, scheduledDate, scheduledTime } = req.body;

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
      estimatedRepairCost: inspection.estimatedRepairCost,
      estimatedRepairTime: inspection.estimatedRepairTime,
      completed: inspection.completed
    });

    if (inspection.sections && inspection.sections.length > 0) {
      inspection.sections.forEach((section, index) => {
        console.log(`Section ${index + 1}: ${section.name}`, {
          questionsCount: section.questions?.length || 0,
          rating: section.rating,
          score: section.score,
          repairCost: section.repairCost,
          repairTime: section.repairTime
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
            hasRepairCost: !!section.repairCost,
            hasRepairTime: !!section.repairTime
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
            repairCost: section.repairCost || 0,
            repairTime: section.repairTime || 0
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
        estimatedRepairCost: inspectionData.totalRepairCost || 0,
        estimatedRepairTime: inspectionData.totalRepairTime || 'No repairs needed'
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
      `${process.env.BASE_URL}/files/${pdfResult.fileName}`,
      process.env.BASE_URL
    );

    res.status(200).json({
      success: true,
      data: {
        case: updatedCase,
        pdfUrl: `${process.env.BASE_URL}/files/${pdfResult.fileName}`
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

    // Update case with PDF path and completion status
    const updatedCase = await Case.findByIdAndUpdate(
      caseData._id,
      {
        pdfCaseFile: pdfResult.filePath,
        currentStage: 7,
        'stageStatuses.6': 'complete',
        'stageStatuses.7': 'active',
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
      `${process.env.BASE_URL}/files/${pdfResult.fileName}`,
      process.env.BASE_URL
    );

    res.status(200).json({
      success: true,
      data: {
        case: updatedCase,
        pdfUrl: `${process.env.BASE_URL}/files/${pdfResult.fileName}`
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

    // Update case status to next stage
    await Case.findByIdAndUpdate(
      caseId,
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

    // Find the case and its quote
    const caseData = await Case.findById(caseId).populate('quote');
    
    if (!caseData) {
      return res.status(404).json({
        success: false,
        error: 'Case not found'
      });
    }

    if (!caseData.quote) {
      return res.status(404).json({
        success: false,
        error: 'No quote found for this case'
      });
    }

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
      return res.status(404).json({
        success: false,
        error: 'Quote not found'
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

    await Case.findByIdAndUpdate(
      caseId,
      caseUpdate
    );

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
      `${process.env.BASE_URL}/files/${pdfResult.fileName}`,
      process.env.BASE_URL
    );

    console.log('Case completed successfully by case ID');

    res.status(200).json({
      success: true,
      data: {
        case: updatedCase,
        pdfUrl: `${process.env.BASE_URL}/files/${pdfResult.fileName}`
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
      color: paperworkData.billOfSale?.vehicleColor || caseData.vehicle?.color,
      licensePlate: paperworkData.billOfSale?.vehicleLicensePlate || caseData.vehicle?.licensePlate,
      licenseState: paperworkData.billOfSale?.vehicleLicenseState || caseData.vehicle?.licenseState,
      bodyStyle: paperworkData.billOfSale?.vehicleBodyStyle || caseData.vehicle?.bodyStyle,
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
            paymentMethod: paperworkData.billOfSale?.paymentMethod || 'ACH Transfer',
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
            accountHolderName: paperworkData.bankDetails?.accountHolderName || '',
            routingNumber: paperworkData.bankDetails?.routingNumber || '',
            accountNumber: paperworkData.bankDetails?.accountNumber || '',
            accountType: paperworkData.bankDetails?.accountType || 'checking',
            bankName: paperworkData.bankDetails?.bankName || '',
            bankPhone: paperworkData.bankDetails?.bankPhone || '',
            accountOpenedDate: paperworkData.bankDetails?.accountOpenedDate || new Date().toISOString().slice(0, 7),
            electronicConsentAgreed: paperworkData.bankDetails?.electronicConsentAgreed || false,
          },
          taxInfo: {
            ssn: paperworkData.taxInfo?.ssn || '',
            taxId: paperworkData.taxInfo?.taxId || '',
            reportedIncome: paperworkData.taxInfo?.reportedIncome || false,
            form1099Agreed: paperworkData.taxInfo?.form1099Agreed || false,
          },
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
            paymentMethod: paperworkData.billOfSale?.paymentMethod || 'ACH Transfer',
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
            accountHolderName: paperworkData.bankDetails?.accountHolderName || '',
            routingNumber: paperworkData.bankDetails?.routingNumber || '',
            accountNumber: paperworkData.bankDetails?.accountNumber || '',
            accountType: paperworkData.bankDetails?.accountType || 'checking',
            bankName: paperworkData.bankDetails?.bankName || '',
            bankPhone: paperworkData.bankDetails?.bankPhone || '',
            accountOpenedDate: paperworkData.bankDetails?.accountOpenedDate || new Date().toISOString().slice(0, 7),
            electronicConsentAgreed: paperworkData.bankDetails?.electronicConsentAgreed || false,
          },
          taxInfo: {
            ssn: paperworkData.taxInfo?.ssn || '',
            taxId: paperworkData.taxInfo?.taxId || '',
            reportedIncome: paperworkData.taxInfo?.reportedIncome || false,
            form1099Agreed: paperworkData.taxInfo?.form1099Agreed || false,
          },
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
          paymentMethod: paperworkData.billOfSale?.paymentMethod || 'ACH Transfer',
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
          accountHolderName: paperworkData.bankDetails?.accountHolderName || '',
          routingNumber: paperworkData.bankDetails?.routingNumber || '',
          accountNumber: paperworkData.bankDetails?.accountNumber || '',
          accountType: paperworkData.bankDetails?.accountType || 'checking',
          bankName: paperworkData.bankDetails?.bankName || '',
          bankPhone: paperworkData.bankDetails?.bankPhone || '',
          accountOpenedDate: paperworkData.bankDetails?.accountOpenedDate || new Date().toISOString().slice(0, 7),
          electronicConsentAgreed: paperworkData.bankDetails?.electronicConsentAgreed || false,
        },
        taxInfo: {
          ssn: paperworkData.taxInfo?.ssn || '',
          taxId: paperworkData.taxInfo?.taxId || '',
          reportedIncome: paperworkData.taxInfo?.reportedIncome || false,
          form1099Agreed: paperworkData.taxInfo?.form1099Agreed || false,
        },
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

    // Update case with transaction reference and stage status
    const updatedCase = await Case.findByIdAndUpdate(
      caseId,
      {
        transaction: transaction._id,
        currentStage: 7,
        'stageStatuses.6': 'complete',
        'stageStatuses.7': 'active',
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
          caseData.pdfCaseFile ? `${process.env.BASE_URL}/files/${path.basename(caseData.pdfCaseFile)}` : null,
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

    // Check if environment variables are set
    if (!process.env.MARKETCHECK_API_KEY || !process.env.MARKETCHECK_API_SECRET) {
      console.error('MarketCheck API credentials not configured');
      return res.status(500).json({
        success: false,
        error: 'MarketCheck API credentials not configured. Please set MARKETCHECK_API_KEY and MARKETCHECK_API_SECRET environment variables.'
      });
    }

    // Fetch vehicle pricing from MarketCheck API
    const pricingData = await fetchMarketCheckPricing(vin);

    // Validate the pricing data before saving
    if (!pricingData || !pricingData.estimatedValue || isNaN(pricingData.estimatedValue) || pricingData.estimatedValue <= 0) {
      console.error('Invalid pricing data received:', pricingData);
      return res.status(500).json({
        success: false,
        error: 'Failed to get valid pricing data for this VIN'
      });
    }

    // Store the pricing data in the vehicle record
    const vehicle = await Vehicle.findOne({ vin: vin });
    if (vehicle) {
      vehicle.estimatedValue = pricingData.estimatedValue;
      vehicle.pricingSource = 'MarketCheck API';
      vehicle.pricingLastUpdated = new Date();
      await vehicle.save();
    }

    res.status(200).json({
      success: true,
      data: {
        estimatedValue: pricingData.estimatedValue,
        source: 'MarketCheck API',
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching vehicle pricing:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch vehicle pricing'
    });
  }
};

// Fetch vehicle pricing from MarketCheck API
const fetchMarketCheckPricing = async (vin) => {
  try {
    // Try multiple MarketCheck API endpoints for better coverage
    const endpoints = [
      `https://api.marketcheck.com/v2/valuation/vin/${vin}`,
      `https://api.marketcheck.com/v2/valuation/vin/${vin}?api_key=${process.env.MARKETCHECK_API_KEY}`,
      `https://api.marketcheck.com/v2/valuation/vin/${vin}?api_key=${process.env.MARKETCHECK_API_KEY}&api_secret=${process.env.MARKETCHECK_API_SECRET}`
    ];

    let data = null;
    let response = null;

    // Try each endpoint until one works
    for (const apiUrl of endpoints) {
      try {
        console.log(`Trying MarketCheck endpoint: ${apiUrl}`);
        
        // Create Basic Auth header with API key and secret
        const authHeader = Buffer.from(`${process.env.MARKETCHECK_API_KEY}:${process.env.MARKETCHECK_API_SECRET}`).toString('base64');
        
        response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${authHeader}`,
            'Content-Type': 'application/json',
            'User-Agent': 'VOS-System/1.0'
          }
        });

        if (response.ok) {
          data = await response.json();
          console.log('MarketCheck API response:', JSON.stringify(data, null, 2));
          break; // Exit loop if successful
        } else {
          console.log(`Endpoint failed with status: ${response.status}`);
        }
      } catch (endpointError) {
        console.log(`Endpoint error:`, endpointError.message);
        continue; // Try next endpoint
      }
    }

    // If all endpoints failed, throw error
    if (!data) {
      throw new Error(`All MarketCheck API endpoints failed for VIN: ${vin}`);
    }
    
    // Extract pricing information from MarketCheck response
    let estimatedValue = 0;
    
    // Try multiple possible response structures
    if (data && data.valuation) {
      estimatedValue = data.valuation.estimated_value || 
                      data.valuation.average_price || 
                      data.valuation.median_price || 
                      data.valuation.price || 
                      data.valuation.value ||
                      0;
    } else if (data && data.price) {
      estimatedValue = data.price;
    } else if (data && data.estimated_value) {
      estimatedValue = data.estimated_value;
    } else if (data && data.value) {
      estimatedValue = data.value;
    } else if (data && data.average_price) {
      estimatedValue = data.average_price;
    } else if (data && data.median_price) {
      estimatedValue = data.median_price;
    } else if (data && Array.isArray(data) && data.length > 0) {
      // Handle array response
      const firstItem = data[0];
      estimatedValue = firstItem.price || firstItem.value || firstItem.estimated_value || 0;
    }

    // If no pricing data found, try alternative endpoints or fallback
    if (!estimatedValue || estimatedValue === 0) {
      console.log('No pricing data found in primary response, trying vehicle specs');
      
      // Try to get basic vehicle info and estimate from that
      const vehicleInfo = await fetchMarketCheckVehicleInfo(vin);
      console.log('Vehicle info:', vehicleInfo);
      
      if (vehicleInfo) {
        estimatedValue = estimateValueFromVehicleInfo(vehicleInfo);
      }
    }

    // Validate the estimated value before returning
    const finalValue = Math.round(estimatedValue || 0);
    if (isNaN(finalValue) || finalValue <= 0) {
      console.log('Invalid estimated value from MarketCheck, using fallback');
      return {
        estimatedValue: estimateBasicValue(vin)
      };
    }

    return {
      estimatedValue: finalValue
    };
  } catch (error) {
    console.error('Error fetching from MarketCheck API:', error);
    
    // Fallback to basic estimation if API fails
    console.log('Falling back to basic estimation');
    return {
      estimatedValue: estimateBasicValue(vin)
    };
  }
};

// Fetch basic vehicle information from MarketCheck
const fetchMarketCheckVehicleInfo = async (vin) => {
  try {
    // Try multiple endpoints for vehicle specs
    const endpoints = [
      `https://api.marketcheck.com/v2/specs/vin/${vin}`,
      `https://api.marketcheck.com/v2/specs/vin/${vin}?api_key=${process.env.MARKETCHECK_API_KEY}`,
      `https://api.marketcheck.com/v2/vin/${vin}/specs`,
      `https://api.marketcheck.com/v2/vin/${vin}/specs?api_key=${process.env.MARKETCHECK_API_KEY}`
    ];

    let data = null;

    // Try each endpoint until one works
    for (const apiUrl of endpoints) {
      try {
        console.log(`Trying MarketCheck specs endpoint: ${apiUrl}`);
        
        const authHeader = Buffer.from(`${process.env.MARKETCHECK_API_KEY}:${process.env.MARKETCHECK_API_SECRET}`).toString('base64');
        
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${authHeader}`,
            'Content-Type': 'application/json',
            'User-Agent': 'VOS-System/1.0'
          }
        });

        if (response.ok) {
          data = await response.json();
          console.log('MarketCheck specs response:', JSON.stringify(data, null, 2));
          break; // Exit loop if successful
        } else {
          console.log(`Specs endpoint failed with status: ${response.status}`);
        }
      } catch (endpointError) {
        console.log(`Specs endpoint error:`, endpointError.message);
        continue; // Try next endpoint
      }
    }

    return data;
  } catch (error) {
    console.error('Error fetching vehicle specs from MarketCheck:', error);
    return null;
  }
};

// Estimate value from vehicle information
const estimateValueFromVehicleInfo = (vehicleInfo) => {
  try {
    if (!vehicleInfo || !vehicleInfo.specs) {
      return 0;
    }

    const specs = vehicleInfo.specs;
    const year = parseInt(specs.year) || new Date().getFullYear();
    const make = specs.make || '';
    const model = specs.model || '';
    
    // Basic pricing logic based on year and make
    let basePrice = 25000; // Default base price
    
    // Adjust base price by make (simplified)
    const makeAdjustments = {
      'BMW': 1.5,
      'Mercedes': 1.6,
      'Audi': 1.4,
      'Lexus': 1.3,
      'Toyota': 0.9,
      'Honda': 0.9,
      'Ford': 0.8,
      'Chevrolet': 0.8,
      'Nissan': 0.85,
      'Hyundai': 0.8,
      'Kia': 0.75
    };
    
    if (makeAdjustments[make]) {
      basePrice *= makeAdjustments[make];
    }
    
    // Adjust for year (newer = higher price)
    const currentYear = new Date().getFullYear();
    const ageFactor = Math.max(0.3, 1 - (currentYear - year) * 0.08);
    basePrice *= ageFactor;
    
    return Math.round(basePrice);
  } catch (error) {
    console.error('Error estimating value from vehicle info:', error);
    return 0;
  }
};

// Basic fallback estimation
const estimateBasicValue = (vin) => {
  try {
    if (!vin || vin.length < 10) {
      console.log('Invalid VIN provided for estimation');
      return 25000; // Default fallback
    }

    // Extract year from VIN (position 9, but VINs can vary)
    // For most VINs, the year is in position 9, but we need to handle different formats
    let year;
    try {
      const yearChar = vin.charAt(9);
      // Convert character to year (this is a simplified approach)
      // In reality, VIN year encoding is more complex
      const yearCode = parseInt(yearChar);
      if (!isNaN(yearCode)) {
        // Simple mapping for recent years (this is a basic approach)
        const yearMap = {
          0: 2010, 1: 2011, 2: 2012, 3: 2013, 4: 2014, 5: 2015, 6: 2016, 7: 2017, 8: 2018, 9: 2019,
          A: 2010, B: 2011, C: 2012, D: 2013, E: 2014, F: 2015, G: 2016, H: 2017, J: 2018, K: 2019,
          L: 2020, M: 2021, N: 2022, P: 2023, R: 2024
        };
        year = yearMap[yearChar] || 2015; // Default to 2015 if unknown
      } else {
        year = 2015; // Default year
      }
    } catch (e) {
      year = 2015; // Default year if parsing fails
    }

    // Extract make code from VIN (first 3 characters)
    const makeCode = vin.substring(0, 3).toUpperCase();
    
    // Basic pricing by make
    const makePricing = {
      '1H': 25000, // Honda
      '1N': 28000, // Nissan
      '1F': 32000, // Ford
      '1G': 35000, // General Motors
      '1J': 40000, // Jeep
      '1T': 22000, // Toyota
      '1V': 45000, // Volkswagen
      'WBA': 55000, // BMW
      'WDD': 65000, // Mercedes
      'WAU': 50000, // Audi
      'JTD': 22000, // Toyota
      'JHM': 25000, // Honda
      'JH4': 25000, // Honda
      '5NPE': 28000, // Nissan
      '5NPD': 28000, // Nissan
      '5NPE': 28000, // Nissan
      '1F': 32000, // Ford
      '1G': 35000, // General Motors
      '1J': 40000, // Jeep
      '1V': 45000, // Volkswagen
    };
    
    let basePrice = makePricing[makeCode] || 30000;
    
    // Adjust for year
    const currentYear = new Date().getFullYear();
    const ageFactor = Math.max(0.3, 1 - (currentYear - year) * 0.1);
    basePrice *= ageFactor;
    
    const finalPrice = Math.round(basePrice);
    
    // Ensure we don't return NaN or invalid values
    if (isNaN(finalPrice) || finalPrice <= 0) {
      console.log('Invalid price calculated, using default');
      return 25000;
    }
    
    return finalPrice;
  } catch (error) {
    console.error('Error in basic value estimation:', error);
    return 25000; // Default fallback
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

