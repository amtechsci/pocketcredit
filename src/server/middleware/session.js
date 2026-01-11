const session = require('express-session');
const RedisStore = require('connect-redis').default;
const { getRedisClient } = require('../config/redis');
require('dotenv').config();

/**
 * Session Configuration Middleware
 * Configures express-session with Redis store for 24-hour sessions
 * 
 * NOTE: This is primarily kept for backward compatibility and hybrid auth fallback.
 * Main authentication now uses JWT tokens (see middleware/jwtAuth.js)
 * The requireAuth function below is LEGACY and not used - use jwtAuth.requireAuth instead
 */

// Get Redis client
const redisClient = getRedisClient();

// Session configuration
const sessionConfig = {
  store: redisClient ? new RedisStore({ 
    client: redisClient,
    prefix: 'pocket-credit:session:',
    ttl: 86400 // 24 hours in seconds
  }) : undefined, // Fallback to memory store if Redis unavailable
  
  secret: process.env.SESSION_SECRET || 'pocket-credit-session-secret-2025',
  resave: false,
  saveUninitialized: false,
  rolling: true, // Reset expiry on each request
  cookie: {
    secure: false, // Allow HTTP for now (set to true when using HTTPS)
    httpOnly: true, // Prevent XSS attacks
    maxAge: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    sameSite: 'lax' // CSRF protection
  },
  name: 'pocket-credit-session' // Custom session name
};

/**
 * Initialize session middleware
 * @returns {Function} Express session middleware
 */
const initializeSession = () => {
  return session(sessionConfig);
};

/**
 * Authentication middleware to check if user is logged in
 * @deprecated This function is LEGACY and not used anymore. Use jwtAuth.requireAuth instead.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const requireAuth = (req, res, next) => {
  if (req.session && req.session.authenticated && req.session.userId) {
    return next();
  }
  
  return res.status(401).json({
    status: 'error',
    message: 'Authentication required. Please login first.'
  });
};

/**
 * Optional authentication middleware
 * Sets req.user if session exists, but doesn't block the request
 * @deprecated This function is LEGACY and not used anymore.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const optionalAuth = (req, res, next) => {
  if (req.session && req.session.authenticated && req.session.userId) {
    req.user = {
      id: req.session.userId,
      mobile: req.session.mobile
    };
  }
  next();
};

/**
 * Session cleanup middleware
 * Cleans up expired sessions and invalid data
 * @deprecated This function is currently not used (commented out in server.js).
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const sessionCleanup = (req, res, next) => {
  // Check if session exists and is valid
  if (req.session && req.session.authenticated) {
    // Validate session data
    if (!req.session.userId || !req.session.mobile) {
      // Invalid session data, destroy it
      req.session.destroy((err) => {
        if (err) {
          console.error('Session cleanup error:', err);
        }
      });
    }
  }
  next();
};

module.exports = {
  initializeSession,
  requireAuth,
  optionalAuth,
  sessionCleanup
};
