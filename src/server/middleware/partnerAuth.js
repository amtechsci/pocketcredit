const jwt = require('jsonwebtoken');
const { findPartnerByUuid } = require('../models/partner');

const JWT_SECRET = process.env.JWT_SECRET || 'pocket-credit-secret-key-2025';
const PARTNER_JWT_SECRET = process.env.PARTNER_JWT_SECRET || JWT_SECRET;

/**
 * Authenticate partner using Basic Auth
 * Validates client_id and client_secret from Authorization header
 */
const authenticatePartnerBasic = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return res.status(401).json({
        status: false,
        code: 4110,
        message: 'Authentication failed'
      });
    }

    // Decode Basic Auth
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8');
    const [clientId, clientSecret] = credentials.split(':');

    if (!clientId || !clientSecret) {
      return res.status(401).json({
        status: false,
        code: 4111,
        message: 'Invalid API credentials'
      });
    }

    // Verify partner credentials
    const { verifyPartnerCredentials } = require('../models/partner');
    const partner = await verifyPartnerCredentials(clientId, clientSecret);

    if (!partner) {
      return res.status(401).json({
        status: false,
        code: 4111,
        message: 'Invalid API credentials'
      });
    }

    // Attach partner to request
    req.partner = partner;
    next();
  } catch (error) {
    console.error('Partner authentication error:', error);
    return res.status(500).json({
      status: false,
      code: 4110,
      message: 'Authentication failed'
    });
  }
};

/**
 * Authenticate partner using Bearer token (JWT)
 * Validates access token from Authorization header
 */
const authenticatePartnerToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: false,
        code: 4114,
        message: 'Token is Required'
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        status: false,
        code: 4114,
        message: 'Token is Required'
      });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, PARTNER_JWT_SECRET);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          status: false,
          code: 4117,
          message: 'Token expired'
        });
      }
      return res.status(401).json({
        status: false,
        code: 4118,
        message: 'Invalid access or refresh token'
      });
    }

    // Validate token type
    if (decoded.type !== 'access_token') {
      return res.status(401).json({
        status: false,
        code: 4115,
        message: 'Invalid token type'
      });
    }

    // Verify partner exists and is active
    const partner = await findPartnerByUuid(decoded.partner_id);
    
    if (!partner || !partner.is_active) {
      return res.status(401).json({
        status: false,
        code: 4116,
        message: 'Partner not found or inactive'
      });
    }

    // Attach partner and decoded token to request
    req.partner = partner;
    req.token = decoded;
    next();
  } catch (error) {
    console.error('Partner token authentication error:', error);
    return res.status(500).json({
      status: false,
      code: 4110,
      message: 'Authentication failed'
    });
  }
};

/**
 * Generate partner access token
 * @param {Object} partner - Partner object
 * @returns {string} JWT access token
 */
const generatePartnerAccessToken = (partner) => {
  const payload = {
    partner_id: partner.partner_uuid,
    client_id: partner.client_id,
    type: 'access_token',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (15 * 60), // 15 minutes
    aud: partner.partner_uuid,
    iss: 'pocketcredit'
  };
  
  return jwt.sign(payload, PARTNER_JWT_SECRET);
};

/**
 * Generate partner refresh token
 * @param {Object} partner - Partner object
 * @returns {string} JWT refresh token
 */
const generatePartnerRefreshToken = (partner) => {
  const payload = {
    partner_id: partner.partner_uuid,
    client_id: partner.client_id,
    type: 'refresh_token',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days
    aud: partner.partner_uuid,
    iss: 'pocketcredit'
  };
  
  return jwt.sign(payload, PARTNER_JWT_SECRET);
};

/**
 * Verify refresh token
 * @param {string} token - Refresh token
 * @returns {Object} Decoded token
 */
const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, PARTNER_JWT_SECRET);
    
    if (decoded.type !== 'refresh_token') {
      throw new Error('Invalid token type');
    }
    
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Refresh token expired');
    }
    throw new Error('Invalid refresh token');
  }
};

module.exports = {
  authenticatePartnerBasic,
  authenticatePartnerToken,
  generatePartnerAccessToken,
  generatePartnerRefreshToken,
  verifyRefreshToken
};

