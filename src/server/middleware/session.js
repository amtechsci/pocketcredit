const session = require('express-session');
const RedisStore = require('connect-redis').default;
const { getRedisClient } = require('../config/redis');
require('dotenv').config();

/**
 * Session Configuration Middleware
 * Configures express-session with Redis store for 24-hour sessions
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
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
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
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const requireAuth = (req, res, next) => {
  console.log('requireAuth: Checking session...');
  console.log('requireAuth: req.session:', req.session);
  console.log('requireAuth: req.session.authenticated:', req.session?.authenticated);
  console.log('requireAuth: req.session.userId:', req.session?.userId);
  
  if (req.session && req.session.authenticated && req.session.userId) {
    console.log('requireAuth: Authentication successful');
    return next();
  }
  
  console.log('requireAuth: Authentication failed');
  return res.status(401).json({
    status: 'error',
    message: 'Authentication required. Please login first.'
  });
};

/**
 * Optional authentication middleware
 * Sets req.user if session exists, but doesn't block the request
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
