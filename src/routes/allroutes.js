const express = require('express');
const router = express.Router();
const { protect, isAdmin, isAgent, isEstimator, isInspector, isAdminOrAgent, isEstimatorDebug, isQuoteManager, isUserManager } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
  createCase,
  scheduleInspection,
  getInspectionByToken,
  submitInspection,
  assignEstimator,
  getQuoteByToken,
  submitQuote,
  updateQuoteByCaseId,
  updateOfferDecision,
  updateOfferDecisionByCaseId,
  updatePaperwork,
  updateCaseStage,
  completeCase,
  completeCaseWithToken,
  completeCaseByCaseId,
  generateCaseFile,
  generateCaseFileWithToken,
  generateBillOfSalePDF,
  updateCaseStatus,
  getCases,
  getCase,
  getCurrentUser,
  getUsersByRole,
  createUser,
  updateUser,
  deleteUser,
  getAllUsers,
  uploadDocument,
  savePaperworkByCaseId,
  saveCompletionData,
  getInspectorInspections,
  sendCustomerEmail,
  getVehiclePricing,
  getVehicleSpecs,
  getAnalytics,
  uploadAndProcessOBD2PDF,
  getOBD2Diagnostics
} = require('../controllers/allcontrollers');

const signingController = require('../controllers/signing');

const {
  createSigningRequest,
  getSigningSession,
  submitSignedDocument,
  getSigningStatus,
  getSigningStatusByCaseId
} = signingController;

// Configure multer for PDF file uploads
const pdfStorage = multer.diskStorage({
  destination: function(req, file, cb) {
    // Create directory if it doesn't exist
    const dir = path.join(__dirname, '../../uploads/diagnostics');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function(req, file, cb) {
    // Add timestamp to filename to prevent duplicates
    const timestamp = Date.now();
    cb(null, `obd2-${timestamp}-${file.originalname}`);
  }
});

// Create multer upload instance
const uploadPDF = multer({
  storage: pdfStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // Limit file size to 10MB
  },
  fileFilter: function(req, file, cb) {
    // Accept only PDFs
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// Auth routes
router.get('/auth/me', protect, getCurrentUser);

// User management routes
router.get('/users', protect, isUserManager, getUsersByRole);
router.post('/users', protect, isAdmin, createUser);
router.put('/users/:userId', protect, isAdmin, updateUser);
router.delete('/users/:userId', protect, isAdmin, deleteUser);

// Inspector routes
router.get('/inspections/assigned', protect, isInspector, getInspectorInspections);
// Case management routes (protected)
router.get('/cases', protect, getCases);
router.get('/cases/:caseId', protect, getCase);
router.post('/cases', protect, createCase);
router.post('/cases/:caseId/inspection', protect, scheduleInspection);
router.post('/cases/:caseId/estimator', protect, assignEstimator);
router.post('/cases/:caseId/complete', protect, completeCase);
router.get('/cases/:caseId/pdf', generateCaseFile);
router.get('/cases/:caseId/bill-of-sale', generateBillOfSalePDF);
router.put('/cases/:caseId/status', protect, updateCaseStatus);
router.post('/cases/:caseId/completion', protect, saveCompletionData);

// Document signing routes
router.post('/cases/:caseId/sign-request', protect, createSigningRequest);
router.get('/signing/:token', getSigningSession);
router.post('/signing/:token/submit', submitSignedDocument);
router.get('/signing/:token/status', getSigningStatus);
router.get('/cases/:caseId/signing-status', protect, getSigningStatusByCaseId);

// Quote management routes (protected)
router.put('/cases/:caseId/quote', protect, isQuoteManager, updateQuoteByCaseId);
router.put('/cases/:caseId/offer-decision', protect, isQuoteManager, updateOfferDecisionByCaseId);
router.post('/cases/:caseId/complete-estimator', protect, isQuoteManager, completeCaseByCaseId);

// Paperwork management routes (protected)
router.post('/cases/:caseId/paperwork', protect, isQuoteManager, savePaperworkByCaseId);

// Email routes (protected)
router.post('/cases/:caseId/send-email', protect, sendCustomerEmail);

// Document upload route
router.post('/upload', protect, uploadDocument);

// Token-based routes (no authentication required)
router.get('/inspection/:token', getInspectionByToken);
router.post('/inspection/:token', submitInspection);
router.get('/quote/:id', getQuoteByToken);
router.post('/quote/:id', submitQuote);
router.post('/quote/:id/decision', updateOfferDecision);
router.post('/quote/:id/paperwork', updatePaperwork);
router.post('/quote/:id/stage', updateCaseStage);
router.post('/quote/:id/complete', completeCaseWithToken);
router.get('/quote/:id/pdf', generateCaseFileWithToken);

// Vehicle pricing routes
router.get('/vehicle/pricing/:vin', protect, getVehiclePricing);
router.get('/vehicle/specs/:vin', protect, getVehicleSpecs);

// Analytics routes (protected)
router.get('/analytics', protect, isAdmin, getAnalytics);

// Add signature to PDF route
router.post('/cases/:id/add-signature', protect, signingController.addSignatureToPdf);

module.exports = router;
