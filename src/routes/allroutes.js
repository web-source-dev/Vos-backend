const express = require('express');
const router = express.Router();
const { protect, isAdmin, isAgent, isEstimator, isInspector, isAdminOrAgent, isEstimatorDebug, isQuoteManager, isUserManager } = require('../middleware/auth');
const {
  createCase,
  updateCase,
  customerIntake,
  scheduleInspection,
  getInspectionByToken,
  submitInspection,
  savePendingInspection,
  assignEstimator,
  getQuoteByToken,
  submitQuote,
  updateQuoteByCaseId,
  updateOfferDecision,
  updateOfferDecisionByCaseId,
  updatePaperwork,
  updateCaseStage,
  updateCaseStageByCaseId,
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
  saveCustomVehicle,
  getVehicleMakesAndModels,
  generateQuoteSummary,
  sendCustomerFormEmail
} = require('../controllers/allcontrollers');

// Import OBD2 controllers
const { uploadOBD2ScanToCase } = require('../controllers/obd2');

// Auth routes
router.get('/auth/me', protect, getCurrentUser);

// User management routes
router.get('/users', protect, isUserManager, getUsersByRole);
router.post('/users', protect, isAdmin, createUser);
router.put('/users/:userId', protect, isAdmin, updateUser);
router.delete('/users/:userId', protect, isAdmin, deleteUser);
router.get('/users/all', protect, isAdmin, getAllUsers);

// Case management routes (protected)
router.get('/cases', protect, getCases);
router.get('/cases/:caseId', protect, getCase);
router.post('/cases', protect, createCase);
router.put('/cases/:caseId', protect, updateCase);

// OBD2 scan upload for a specific case
router.post('/cases/:caseId/obd2-scan', protect, uploadOBD2ScanToCase);

// Customer intake route (public - no authentication required)
router.post('/customer-intake', customerIntake);

// Send customer form email (protected - requires authentication)
router.post('/send-customer-form', sendCustomerFormEmail);

// Inspection scheduling (protected)
router.post('/cases/:caseId/inspection', protect, scheduleInspection);
router.get('/inspection/:token', getInspectionByToken);
router.post('/inspection/:token', submitInspection);
router.put('/inspection/:token/pending', savePendingInspection);
router.get('/inspections/assigned', protect, isInspector, getInspectorInspections);

// Quote routes (protected)
router.post('/cases/:caseId/estimator', protect, assignEstimator);
router.get('/quote/:token', getQuoteByToken);
router.post('/quote/:token', submitQuote);
router.put('/cases/:caseId/quote', protect, isQuoteManager, updateQuoteByCaseId);

// Offer Decision routes
router.post('/quote/:token/decision', updateOfferDecision);
router.put('/cases/:caseId/offer-decision', protect, updateOfferDecisionByCaseId); // Remove isQuoteManager restriction

// Document upload route
router.post('/upload', protect, uploadDocument);

// Paperwork routes
router.post('/quote/:token/paperwork', updatePaperwork);
router.post('/cases/:caseId/paperwork', protect, isQuoteManager, savePaperworkByCaseId);

// Case stage updates
router.post('/quote/:token/stage', updateCaseStage);
router.put('/cases/:caseId/stage', protect, updateCaseStageByCaseId);

// Completion routes
router.post('/cases/:caseId/complete', completeCase);
router.post('/quote/:token/complete', completeCaseWithToken);
router.post('/cases/:caseId/complete-estimator', protect, isQuoteManager, completeCaseByCaseId);
router.post('/cases/:caseId/completion', protect, isQuoteManager, saveCompletionData);

// PDF generation
router.get('/cases/:caseId/pdf', generateCaseFile);
router.get('/quote/:token/pdf', generateCaseFileWithToken);
router.get('/cases/:caseId/bill-of-sale', protect, generateBillOfSalePDF);
router.get('/cases/:caseId/quote-summary', protect, generateQuoteSummary);
router.post('/cases/:caseId/quote-summary', protect, generateQuoteSummary);

// Status update
router.put('/cases/:caseId/status', protect, updateCaseStatus);

// Email sending
router.post('/cases/:caseId/send-email', protect, isQuoteManager, sendCustomerEmail);

// Vehicle data routes
router.get('/vehicle/pricing/:vin', getVehiclePricing);
router.get('/vehicle/specs/:vin', getVehicleSpecs);
router.get('/vehicle/makes-models', getVehicleMakesAndModels);
router.post('/vehicle/custom', protect, saveCustomVehicle);

// Analytics
router.get('/analytics', protect, isAdmin, getAnalytics);

module.exports = router;
