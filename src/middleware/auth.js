const jwt = require('jsonwebtoken');
const User = require('../models/User');
const mongoose = require('mongoose');

// Validate MongoDB ObjectId
exports.validateObjectId = (paramName) => {
  return (req, res, next) => {
    const id = req.params[paramName];
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: `${paramName} is required`
      });
    }
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: `Invalid ${paramName} format. Must be a valid MongoDB ObjectId.`
      });
    }
    
    next();
  };
};

// Protect routes
exports.protect = async (req, res, next) => {
  try {
    let token;

    // Get token from Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    // Also check cookies for token
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    // Make sure token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized to access this route - No token provided'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token
      const user = await User.findById(decoded.id).select('+password');

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Not authorized to access this route - User not found'
        });
      }

      // Add user to request
      req.user = user;
      next();
    } catch (err) {
      console.error('Token verification error:', err);
      return res.status(401).json({
        success: false,
        error: 'Not authorized to access this route - Invalid token'
      });
    }
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error during authentication'
    });
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized to access this route'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `User role ${req.user.role} is not authorized to access this route`
      });
    }

    next();
  };
};

// Role-specific middleware functions
exports.isAdmin = exports.authorize('admin');
exports.isAgent = exports.authorize('agent');
exports.isEstimator = exports.authorize('estimator');
exports.isInspector = exports.authorize('inspector');
exports.isAdminOrAgent = exports.authorize('admin', 'agent');
exports.isAdminOrEstimator = exports.authorize('admin', 'estimator');
exports.isAdminOrInspector = exports.authorize('admin', 'inspector');

// Middleware for quote management (admin, agent, or estimator)
exports.isQuoteManager = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this route'
    });
  }

  if (req.user.role !== 'admin' && req.user.role !== 'agent' && req.user.role !== 'estimator') {
    return res.status(403).json({
      success: false,
      error: `User role ${req.user.role} is not authorized to access this route`
    });
  }

  next();
};

// Debug middleware for estimator role
exports.isEstimatorDebug = (req, res, next) => {
  console.log('isEstimator middleware - User:', req.user ? req.user.id : 'No user');
  console.log('isEstimator middleware - User role:', req.user ? req.user.role : 'No role');
  
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this route'
    });
  }

  if (req.user.role !== 'estimator' && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: `User role ${req.user.role} is not authorized to access this route`
    });
  }

  console.log('isEstimator middleware - Access granted');
  next();
}; 