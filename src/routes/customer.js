const express = require('express');
const router = express.Router();
const { protect, isAdmin } = require('../middleware/auth');
const {
  createVehicleSubmission,
  updateVehicleInfo,
  updateVehicleBasics,
  updateVehicleCondition,
  getVehicleSubmission,
  getAllVehicleSubmissions,
  updateContactAndGenerateOffer,
  uploadOwnershipPhoto,
  updatePayoutMethod,
  updateAppointment,
  updateMobile,
  getVehicleSubmissionsByEmail
} = require('../controllers/customerController');


// Public routes (no authentication required for customer submissions)
router.post('/vehicle-submission', createVehicleSubmission);
router.get('/vehicle-submission/:id', getVehicleSubmission);
router.get('/vehicle-submissions/email/:email', getVehicleSubmissionsByEmail);
router.put('/vehicle-submission/:id/vehicle-info', updateVehicleInfo);
router.put('/vehicle-submission/:id/basics', updateVehicleBasics);
router.put('/vehicle-submission/:id/condition', updateVehicleCondition);
router.put('/vehicle-submission/:id/contact-offer', updateContactAndGenerateOffer);
router.post('/upload-ownership-photo', uploadOwnershipPhoto);
router.put('/vehicle-submission/:id/payout-method', updatePayoutMethod);
router.put('/vehicle-submission/:id/appointment', updateAppointment);
router.put('/vehicle-submission/:id/mobile', updateMobile);

// Protected routes (require authentication)
router.get('/vehicle-submissions', protect, isAdmin, getAllVehicleSubmissions);

module.exports = router;
