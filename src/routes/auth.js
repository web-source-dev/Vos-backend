const express = require('express');
const { register, login, verify, logout, updateProfile, changePassword } = require('../controllers/auth');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Registration should be public (no protection needed)
router.post('/register', register);
router.post('/login', login); // Keep login public
router.get('/verify', protect, verify);
router.get('/logout', protect, logout);
router.put('/profile', protect, updateProfile);
router.put('/password', protect, changePassword);

module.exports = router; 