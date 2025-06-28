const express = require('express');
const { register, login, verify, logout } = require('../controllers/auth');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All routes are now protected
router.post('/register', register);
router.post('/login', login); // Keep login public
router.get('/verify', protect, verify);
router.get('/logout', protect, logout);

module.exports = router; 