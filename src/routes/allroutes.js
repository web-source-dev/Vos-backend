const express = require('express');
const router = express.Router();
const { protect, isAdmin, isAgent, isEstimator, isInspector, isAdminOrAgent, isEstimatorDebug, isQuoteManager } = require('../middleware/auth');
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
  getAnalytics,
  createVeriffSession,
  getVeriffSessionStatus,
  veriffWebhook
} = require('../controllers/allcontrollers');

// Auth routes
router.get('/auth/me', protect, getCurrentUser);

// User management routes
router.get('/users', protect, isAdmin, getUsersByRole);
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

// Veriff ID verification routes
router.post('/cases/:caseId/veriff-session', protect, createVeriffSession);
router.get('/cases/:caseId/veriff-status', protect, getVeriffSessionStatus);
router.post('/veriff/webhook', veriffWebhook); // No auth required for webhook

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

// Analytics routes (protected)
router.get('/analytics', protect, isAdmin, getAnalytics);

module.exports = router;
