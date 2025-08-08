const User = require('../models/User');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public (for new user registration)
exports.register = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, role, location } = req.body;

    // For public registration, allow customer and certain roles
    // If req.user exists (admin creating user), allow all roles
    // If no req.user (public registration), restrict to basic roles
    const validRoles = ['admin', 'agent', 'estimator', 'inspector', 'customer'];
    const allowedPublicRoles = ['agent', 'estimator', 'inspector', 'customer']; // No admin creation via public registration
    
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role. Must be one of: admin, agent, estimator, inspector, customer'
      });
    }

    // If this is a public registration (no authenticated user), restrict roles
    if (!req.user && role === 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin accounts cannot be created via public registration'
      });
    }

    // If this is an admin creating a user, allow all roles
    // If this is a customer registration, allow it
    // Otherwise, restrict to admin only
    if (req.user && req.user.role !== 'admin' && role !== 'customer') {
      return res.status(403).json({
        success: false,
        error: 'Only admin can register new users'
      });
    }

    // Check if user exists
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
      role: role || 'customer',
      location
    });

    sendTokenResponse(user, 201, res);
  } catch (error) {
    console.error(error);
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate email & password
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide an email and password'
      });
    }

    // Check for user
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    sendTokenResponse(user, 200, res);
  } catch (error) {
    console.error(error);
    next(error);
  }
};

// @desc    Verify user token
// @route   GET /api/auth/verify
// @access  Private
exports.verify = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

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
    console.error(error);
    next(error);
  }
};

// @desc    Log user out / clear cookie
// @route   GET /api/auth/logout
// @access  Private
exports.logout = async (req, res, next) => {
  res.status(200).json({
    success: true,
    data: {}
  });
};

// Get token from model, create cookie and send response
const sendTokenResponse = (user, statusCode, res) => {
  // Create token
  const token = user.getSignedJwtToken();

  const userData = {
    id: user._id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    location: user.location
  };

  res.status(statusCode).json({
    success: true,
    token,
    user: userData
  });
}; 