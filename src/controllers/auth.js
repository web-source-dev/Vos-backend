const User = require('../models/User');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public (for new user registration)
exports.register = async (req, res, next) => {
  try {
    console.log('Registration attempt:', { email: req.body.email, firstName: req.body.firstName, lastName: req.body.lastName, role: req.body.role });
    
    const { email, password, firstName, lastName, role, location } = req.body;

    // Validate required fields
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        error: 'Please fill in all required fields: email, password, first name, and last name.'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid email address.'
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long.'
      });
    }

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
    try {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'An account with this email address already exists. Please try logging in instead.'
        });
      }
    } catch (dbError) {
      console.error('Database error during registration:', dbError);
      return res.status(500).json({
        success: false,
        error: 'Server error. Please try again later.'
      });
    }

    // Create user
    try {
      const user = await User.create({
        email,
        password,
        firstName,
        lastName,
        role: role || 'customer',
        location
      });

      sendTokenResponse(user, 201, res);
    } catch (createError) {
      console.error('User creation error:', createError);
      
      // Handle duplicate key error
      if (createError.code === 11000) {
        return res.status(400).json({
          success: false,
          error: 'An account with this email address already exists. Please try logging in instead.'
        });
      }
      
      return res.status(500).json({
        success: false,
        error: 'Server error. Please try again later.'
      });
    }
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
    console.log('Login attempt:', { email: req.body.email });
    
    const { email, password } = req.body;

    // Validate email & password
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please enter both your email address and password.'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid email address.'
      });
    }

    // Check for user
    let user;
    try {
      user = await User.findOne({ email }).select('+password');

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password. Please check your credentials and try again.'
        });
      }
    } catch (dbError) {
      console.error('Database error during login:', dbError);
      return res.status(500).json({
        success: false,
        error: 'Server error. Please try again later.'
      });
    }

    // Check if password matches
    try {
      const isMatch = await user.matchPassword(password);

      if (!isMatch) {
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password. Please check your credentials and try again.'
        });
      }
    } catch (passwordError) {
      console.error('Password verification error:', passwordError);
      return res.status(500).json({
        success: false,
        error: 'Server error. Please try again later.'
      });
    }

    sendTokenResponse(user, 200, res);
  } catch (error) {
    console.error(error);
    next(error);
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    // Validate email
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Please provide your email address.'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid email address.'
      });
    }

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      // Don't reveal if user exists or not for security
      return res.status(200).json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Set reset token and expiry (1 hour)
    user.resetPasswordToken = resetPasswordToken;
    user.resetPasswordExpire = Date.now() + 60 * 60 * 1000; // 1 hour

    await user.save();

    // Create reset URL
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;

    // Send email
    try {
      const { sendPasswordResetEmail } = require('../services/email');
      await sendPasswordResetEmail(user.email, user.firstName, resetUrl);

      res.status(200).json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    } catch (emailError) {
      console.error('Email error:', emailError);
      
      // Clear the reset token if email fails
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();

      return res.status(500).json({
        success: false,
        error: 'Email could not be sent. Please try again later.'
      });
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    next(error);
  }
};

// @desc    Reset password
// @route   POST /api/auth/reset-password/:token
// @access  Public
exports.resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    // Validate password
    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a new password.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long.'
      });
    }

    // Hash the token to compare with stored hash
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find user by reset token and check if token is expired
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token. Please request a new password reset.'
      });
    }

    // Set new password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    // Send confirmation email
    try {
      const { sendPasswordResetConfirmationEmail } = require('../services/email');
      await sendPasswordResetConfirmationEmail(user.email, user.firstName);
    } catch (emailError) {
      console.error('Confirmation email error:', emailError);
      // Don't fail the reset if confirmation email fails
    }

    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
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

// @desc    Update current user profile
// @route   PUT /api/auth/profile
// @access  Private
exports.updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { firstName, lastName, email, location } = req.body;

    const update = {};
    if (firstName !== undefined) update.firstName = firstName;
    if (lastName !== undefined) update.lastName = lastName;
    if (email !== undefined) update.email = email;
    if (location !== undefined) update.location = location;

    const updated = await User.findByIdAndUpdate(userId, { $set: update }, { new: true });

    if (!updated) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: updated._id,
        email: updated.email,
        firstName: updated.firstName,
        lastName: updated.lastName,
        role: updated.role,
        location: updated.location,
      },
    });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

// @desc    Change current user password
// @route   PUT /api/auth/password
// @access  Private
exports.changePassword = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Current and new password are required' });
    }

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'New password must be at least 6 characters' });
    }

    user.password = newPassword;
    await user.save();

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    next(error);
  }
};