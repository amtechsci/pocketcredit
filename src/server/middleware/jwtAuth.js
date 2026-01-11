const jwt = require('jsonwebtoken');
const { findUserById } = require('../models/user');

const JWT_SECRET = process.env.JWT_SECRET || 'pocket-credit-secret-key-2025';

/**
 * JWT Authentication Middleware for Users
 * Replaces session-based authentication with JWT tokens
 */
const requireAuth = async (req, res, next) => {
  try {
    // Get JWT token from Authorization header (case-insensitive)
    // Express lowercases headers, so check lowercase first
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    const token = authHeader && typeof authHeader === 'string' ? authHeader.split(' ')[1] : null; // Bearer TOKEN

    if (!token) {
      // Ensure response is sent and prevent further processing
      if (!res.headersSent) {
        res.status(401).json({
          success: false,
          message: 'Missing Authentication Token'
        });
      }
      return; // Explicit return to prevent further execution
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    // Get user from database to ensure user still exists and is active
    let user;
    try {
      user = await findUserById(decoded.id);
    } catch (dbError) {
      res.status(500).json({
        success: false,
        message: 'Database error during authentication'
      });
      return;
    }
    
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    // Allow 'active', 'on_hold', and 'deleted' users to authenticate
    // Users on hold can view their dashboard but can't progress (enforced by checkHoldStatus middleware)
    // Deleted users can view their deleted status message
    if (user.status !== 'active' && user.status !== 'on_hold' && user.status !== 'deleted') {
      return res.status(401).json({
        success: false,
        message: 'Account is not active'
      });
    }

    // Set user data on request object for use in route handlers
    req.user = user;
    req.userId = user.id; // For compatibility with existing session-based code

    next();

  } catch (error) {
    // Only send response if it hasn't been sent yet
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Authentication failed: ' + (error.message || 'Unknown error')
      });
    }
  }
};

/**
 * Alternative middleware that works with both session and JWT
 * For gradual migration - checks JWT first, falls back to session
 */
const requireAuthHybrid = async (req, res, next) => {
  try {
    // Try JWT first
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await findUserById(decoded.id);
        
        // Allow both 'active' and 'on_hold' users
        if (user && (user.status === 'active' || user.status === 'on_hold')) {
          req.user = user;
          req.userId = user.id;
          return next();
        }
      } catch (jwtError) {
        // JWT failed, try session
      }
    }

    // Fall back to session-based auth
    if (req.session && req.session.userId) {
      const user = await findUserById(req.session.userId);
      
      // Allow both 'active' and 'on_hold' users
      if (user && (user.status === 'active' || user.status === 'on_hold')) {
        req.user = user;
        req.userId = user.id;
        return next();
      }
    }

    // Both JWT and session failed
    return res.status(401).json({
      status: 'error',
      message: 'Authentication required. Please login first.'
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Authentication failed'
    });
  }
};

module.exports = {
  requireAuth,
  requireAuthHybrid
};
