const express = require('express');
const { createSession, handleResult, getSessionStatus } = require('../controllers/veriff');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Create Veriff session
router.post('/session', protect, createSession);

// Handle Veriff webhook result
router.post('/result', handleResult);

// Get session status
router.get('/session/:sessionId', protect, getSessionStatus);

module.exports = router; 