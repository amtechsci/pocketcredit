const express = require('express');
const router = express.Router();
const {
  authenticatePartnerBasic,
  authenticatePartnerToken,
  generatePartnerAccessToken,
  generatePartnerRefreshToken,
  verifyRefreshToken
} = require('../middleware/partnerAuth');
const { findPartnerByUuid } = require('../models/partner');
const { executeQuery, initializeDatabase } = require('../config/database');
const { encryptForPartner, decryptFromPartner, loadKeyFromFile } = require('../utils/partnerEncryption');
const path = require('path');
const fs = require('fs');

/**
 * POST /api/v1/partner/login
 * Partner login endpoint - returns access and refresh tokens
 */
router.post('/login', authenticatePartnerBasic, async (req, res) => {
  try {
    const partner = req.partner;

    // Generate tokens
    const accessToken = generatePartnerAccessToken(partner);
    const refreshToken = generatePartnerRefreshToken(partner);

    // Response data
    const responseData = {
      status: true,
      code: 2000,
      message: 'Success',
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: 900 // 15 minutes in seconds
      }
    };

    // Check if this is a dashboard request (from web browser)
    // Dashboard requests should NOT be encrypted for frontend compatibility
    const isDashboardRequest = req.headers['x-dashboard-request'] === 'true' ||
      req.headers['x-requested-with'] === 'XMLHttpRequest' ||
      (req.headers['origin'] && req.headers['origin'].includes('pocketcredit.in')) ||
      (req.headers['referer'] && req.headers['referer'].includes('/partner/'));

    // Check if client explicitly requests unencrypted response (for testing/debugging)
    const requestUnencrypted = req.headers['x-no-encryption'] === 'true' ||
      req.query.no_encryption === 'true';

    // Only encrypt for API-to-API communication, not for dashboard or when explicitly requested
    const shouldEncrypt = !isDashboardRequest &&
      !requestUnencrypted &&
      process.env.PARTNER_API_ENCRYPTION_ENABLED === 'true' &&
      partner.public_key_path;

    if (isDashboardRequest) {
      console.log('📱 Dashboard login request detected - skipping encryption');
    }

    if (shouldEncrypt) {
      try {
        // Load keys
        const partnerPublicKey = loadKeyFromFile(partner.public_key_path);
        const ourPrivateKeyPath = process.env.PARTNER_PRIVATE_KEY_PATH || path.join(__dirname, '../../partner_keys/pocketcredit_private.pem');
        const ourPrivateKey = loadKeyFromFile(ourPrivateKeyPath);

        // Encrypt response
        const encryptedResponse = encryptForPartner(
          partner.partner_uuid,
          responseData,
          partnerPublicKey,
          ourPrivateKey
        );

        return res.json(encryptedResponse);
      } catch (encryptError) {
        console.error('Encryption error:', encryptError);
        // Fall back to unencrypted response
        console.warn('Falling back to unencrypted response');
      }
    }

    // Return unencrypted response (for dashboard or when encryption fails)
    res.json(responseData);
  } catch (error) {
    console.error('Partner login error:', error);
    res.status(500).json({
      status: false,
      code: 4113,
      message: 'Token Generation Failed'
    });
  }
});

/**
 * POST /api/v1/partner/refresh-token
 * Refresh access token using refresh token
 */
router.post('/refresh-token', authenticatePartnerBasic, async (req, res) => {
  try {
    // Debug: Log all headers that might contain refresh token (for troubleshooting)
    const relevantHeaders = Object.keys(req.headers).filter(k =>
      k.toLowerCase().includes('refresh') || k.toLowerCase().includes('token')
    );
    if (relevantHeaders.length > 0) {
      console.log('🔍 Refresh token endpoint - Relevant headers found:', relevantHeaders);
    }

    // Express normalizes headers to lowercase
    // Try common header name variations
    let refreshTokenHeader = null;

    // Check common header name patterns (Express converts to lowercase)
    const headerVariations = [
      'refresh_token',
      'refresh-token',
      'x-refresh-token',
      'x-refresh_token'
    ];

    for (const headerName of headerVariations) {
      if (req.headers[headerName]) {
        refreshTokenHeader = req.headers[headerName];
        console.log(`✅ Found refresh token in header: ${headerName}`);
        break;
      }
    }

    // If not found in common patterns, search all headers (case-insensitive)
    if (!refreshTokenHeader) {
      for (const [key, value] of Object.entries(req.headers)) {
        const normalizedKey = key.toLowerCase().replace(/[-_]/g, '');
        if (normalizedKey === 'refreshtoken') {
          refreshTokenHeader = value;
          console.log(`✅ Found refresh token in header: ${key}`);
          break;
        }
      }
    }

    // Also check request body (common pattern for token refresh)
    const refreshTokenFromBody = req.body?.refresh_token || req.body?.refreshToken;
    if (refreshTokenFromBody) {
      console.log('✅ Found refresh token in request body');
    }

    // Get token from header or body
    const tokenSource = refreshTokenHeader || refreshTokenFromBody;

    if (!tokenSource) {
      // Enhanced debugging
      console.log('❌ Refresh token not found. All headers:', Object.keys(req.headers));
      console.log('❌ Request body:', req.body);

      return res.status(401).json({
        status: false,
        code: 4114,
        message: 'Token is Required. Please provide refresh_token in header (refresh_token or refresh-token) or request body.'
      });
    }

    // Extract token (handle "Bearer " prefix if present)
    const refreshToken = tokenSource.startsWith('Bearer ')
      ? tokenSource.split(' ')[1]
      : tokenSource;

    // Verify refresh token
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (error) {
      return res.status(401).json({
        status: false,
        code: 4118,
        message: 'Invalid access or refresh token'
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

    // Generate new access token
    const accessToken = generatePartnerAccessToken(partner);

    // Response data
    const responseData = {
      status: true,
      code: 2000,
      message: 'Success',
      data: {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 900 // 15 minutes in seconds
      }
    };

    // Check if encryption is enabled
    const shouldEncrypt = process.env.PARTNER_API_ENCRYPTION_ENABLED === 'true' && partner.public_key_path;

    if (shouldEncrypt) {
      try {
        // Load keys
        const partnerPublicKey = loadKeyFromFile(partner.public_key_path);
        const ourPrivateKeyPath = process.env.PARTNER_PRIVATE_KEY_PATH || path.join(__dirname, '../../partner_keys/pocketcredit_private.pem');
        const ourPrivateKey = loadKeyFromFile(ourPrivateKeyPath);

        // Encrypt response
        const encryptedResponse = encryptForPartner(
          partner.partner_uuid,
          responseData,
          partnerPublicKey,
          ourPrivateKey
        );

        return res.json(encryptedResponse);
      } catch (encryptError) {
        console.error('Encryption error:', encryptError);
        // Fall back to unencrypted response
      }
    }

    // Return unencrypted response
    res.json(responseData);
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      status: false,
      code: 4113,
      message: 'Token Generation Failed'
    });
  }
});

/**
 * Generate UTM link for partner
 */
const generateUTMLink = (partnerUuid, mobileNumber) => {
  const baseUrl = process.env.PARTNER_APP_URL || 'https://pocketcredit.in';
  const utmSource = encodeURIComponent(partnerUuid);
  const utmMedium = 'partner_api';
  const utmCampaign = encodeURIComponent(`lead_${mobileNumber}_${Date.now()}`);

  // If base URL is bit.ly, append UTM params
  if (baseUrl.includes('bit.ly')) {
    return `${baseUrl}?utm_source=${utmSource}&utm_medium=${utmMedium}&utm_campaign=${utmCampaign}`;
  }

  // For custom URLs, append UTM params
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}utm_source=${utmSource}&utm_medium=${utmMedium}&utm_campaign=${utmCampaign}`;
};

/**
 * Extract UTM parameters from URL
 */
const extractUTMParams = (utmLink) => {
  try {
    const url = new URL(utmLink.includes('?') ? utmLink : `${utmLink}?`);
    return {
      utm_source: url.searchParams.get('utm_source') || '',
      utm_medium: url.searchParams.get('utm_medium') || 'partner_api',
      utm_campaign: url.searchParams.get('utm_campaign') || ''
    };
  } catch (e) {
    // Fallback for bit.ly or invalid URLs
    const match = utmLink.match(/[?&]utm_source=([^&]+)/);
    return {
      utm_source: match ? decodeURIComponent(match[1]) : '',
      utm_medium: 'partner_api',
      utm_campaign: ''
    };
  }
};

/**
 * Calculate age from date of birth
 */
const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) return null;
  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

/**
 * Validate basic funnel checks
 */
const validateFunnelChecks = (requestData) => {
  const errors = [];

  // Age validation (18-45)
  if (requestData.date_of_birth) {
    const age = calculateAge(requestData.date_of_birth);
    if (age === null) {
      errors.push('Invalid date of birth');
    } else if (age < 18 || age > 45) {
      errors.push(`Age ${age} is outside required range (18-45)`);
    }
  }

  // Employment type validation (must be Salaried)
  if (requestData.employment_type && requestData.employment_type.toLowerCase() !== 'salaried') {
    errors.push('Employment type must be Salaried');
  }

  // Salary validation (min 20k)
  if (requestData.monthly_salary) {
    const salary = parseFloat(requestData.monthly_salary);
    if (isNaN(salary) || salary < 20000) {
      errors.push('Monthly salary must be 20,000 or above');
    }
  }

  // Payment mode validation (must be Bank Transfer)
  if (requestData.payment_mode) {
    const paymentMode = requestData.payment_mode.toLowerCase();
    if (!paymentMode.includes('bank') && !paymentMode.includes('transfer')) {
      errors.push('Income payment mode must be Bank Transfer');
    }
  }

  return errors;
};

/**
 * POST /api/v1/partner/lead-dedupe-check
 * Check if a lead already exists in the system
 * Now includes: Basic funnel checks, UTM generation, Lead tracking
 */
router.post('/lead-dedupe-check', authenticatePartnerToken, async (req, res) => {
  try {
    await initializeDatabase();
    const partner = req.partner;

    // Check if request is encrypted
    let requestData = req.body;
    const isEncrypted = (requestData.partnerId === partner.partner_uuid || requestData.partnerId === partner.client_id) &&
      requestData.encryptedData &&
      requestData.encryptedKey;

    // Decrypt if encrypted
    if (isEncrypted) {
      try {
        // Check if partner has public key configured
        if (!partner.public_key_path) {
          console.error('Partner does not have public_key_path configured');
          return res.status(400).json({
            status: false,
            code: 4122,
            message: 'Encryption not configured for this partner. Please configure partner public key.'
          });
        }

        const partnerPublicKey = loadKeyFromFile(partner.public_key_path);
        const ourPrivateKeyPath = process.env.PARTNER_PRIVATE_KEY_PATH || path.join(__dirname, '../../partner_keys/pocketcredit_private.pem');
        const ourPrivateKey = loadKeyFromFile(ourPrivateKeyPath);

        requestData = decryptFromPartner(requestData, partnerPublicKey, ourPrivateKey);
      } catch (decryptError) {
        console.error('Decryption error:', decryptError);
        return res.status(400).json({
          status: false,
          code: 2003,
          message: 'Missing Parameters!',
          error: process.env.NODE_ENV === 'development' ? decryptError.message : undefined
        });
      }
    }

    // Validate required fields
    const {
      first_name,
      last_name,
      mobile_number,
      pan_number,
      // Optional funnel check fields
      date_of_birth,
      employment_type,
      monthly_salary,
      payment_mode
    } = requestData;

    if (!first_name || !last_name || !mobile_number || !pan_number) {
      return res.status(400).json({
        status: false,
        code: 2003,
        message: 'Missing Parameters!'
      });
    }

    // Validate mobile number format (10 digits)
    const mobileRegex = /^[0-9]{10}$/;
    if (!mobileRegex.test(String(mobile_number))) {
      return res.status(400).json({
        status: false,
        code: 4119,
        message: 'Invalid Mobile Number or Format'
      });
    }

    // Validate PAN format (10 characters, alphanumeric)
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(pan_number.toUpperCase())) {
      return res.status(400).json({
        status: false,
        code: 4120,
        message: 'Invalid Pan Number or Format'
      });
    }

    // Validate basic funnel checks if provided
    const funnelErrors = validateFunnelChecks(requestData);
    if (funnelErrors.length > 0) {
      return res.status(400).json({
        status: false,
        code: 4121,
        message: 'Basic Funnel Check Failed',
        errors: funnelErrors
      });
    }

    // Check if user exists by mobile number or PAN
    // Also get user status and hold information
    const existingUsers = await executeQuery(
      `SELECT id, phone, pan_number, first_name, last_name, status, 
              application_hold_reason, hold_until_date, eligibility_status
       FROM users 
       WHERE phone = ? OR pan_number = ? 
       LIMIT 1`,
      [String(mobile_number), pan_number.toUpperCase()]
    );

    // Generate UTM link
    const utmLink = generateUTMLink(partner.partner_uuid, mobile_number);
    const utmParams = extractUTMParams(utmLink);
    const utmSource = utmParams.utm_source || partner.partner_uuid;
    const utmMedium = utmParams.utm_medium || 'partner_api';
    const utmCampaign = utmParams.utm_campaign || `lead_${mobile_number}_${Date.now()}`;

    let dedupeStatus = 'fresh_lead';
    let dedupeCode = 2005;
    let responseMessage = 'Fresh Lead Registered Successfully!';
    let userId = null;

    if (!existingUsers || existingUsers.length === 0) {
      // Fresh lead - user doesn't exist
      dedupeStatus = 'fresh_lead';
      dedupeCode = 2005;
      responseMessage = 'Fresh Lead Registered Successfully!';
    } else {
      userId = existingUsers[0].id;
      const existingUser = existingUsers[0];

      // Check user status (hold, suspended, inactive, etc.)
      const isUserOnHold = existingUser.application_hold_reason ||
        (existingUser.hold_until_date && new Date(existingUser.hold_until_date) > new Date());

      if (existingUser.status === 'suspended' ||
        existingUser.status === 'inactive' ||
        isUserOnHold ||
        existingUser.eligibility_status === 'not_eligible') {
        // User is on hold, suspended, inactive, or not eligible - treat as active user
        dedupeStatus = 'active_user';
        dedupeCode = 2006;
        responseMessage = 'Active Loan User';
      } else {
        // Check if user has active loans
        const activeLoans = await executeQuery(
          `SELECT id, status 
           FROM loan_applications 
           WHERE user_id = ? 
           AND status IN ('submitted', 'under_review', 'follow_up', 'approved', 'disbursal', 
                          'ready_for_disbursement', 'disbursed', 'account_manager', 'cleared', 'cancelled')
           LIMIT 1`,
          [existingUser.id]
        );

        if (activeLoans && activeLoans.length > 0) {
          // Active loan user
          dedupeStatus = 'active_user';
          dedupeCode = 2006;
          responseMessage = 'Active Loan User';
        } else {
          // Registered user but no active loans
          dedupeStatus = 'registered_user';
          dedupeCode = 2004;
          responseMessage = 'Registered User';
        }
      }
    }

    // Check if lead already exists for this partner
    try {
      const existingLeads = await executeQuery(
        `SELECT id FROM partner_leads WHERE partner_id = ? AND mobile_number = ? LIMIT 1`,
        [partner.id, String(mobile_number)]
      );

      if (existingLeads && existingLeads.length > 0) {
        // Update existing lead
        await executeQuery(
          `UPDATE partner_leads 
           SET dedupe_status = ?, dedupe_code = ?, updated_at = NOW(),
               first_name = ?, last_name = ?, pan_number = ?,
               date_of_birth = ?, employment_type = ?, monthly_salary = ?, payment_mode = ?,
               utm_link = ?, utm_source = ?, utm_medium = ?, utm_campaign = ?
           WHERE id = ?`,
          [
            dedupeStatus,
            dedupeCode,
            first_name,
            last_name,
            pan_number.toUpperCase(),
            date_of_birth || null,
            employment_type || null,
            monthly_salary ? parseFloat(monthly_salary) : null,
            payment_mode || null,
            utmLink,
            utmSource,
            utmMedium,
            utmCampaign,
            existingLeads[0].id
          ]
        );
      } else {
        // Store new lead in partner_leads table
        await executeQuery(
          `INSERT INTO partner_leads (
            partner_id, partner_uuid, user_id, first_name, last_name, mobile_number, pan_number,
            date_of_birth, employment_type, monthly_salary, payment_mode,
            dedupe_status, dedupe_code, utm_link, utm_source, utm_medium, utm_campaign,
            lead_shared_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())`,
          [
            partner.id,
            partner.partner_uuid,
            userId,
            first_name,
            last_name,
            String(mobile_number),
            pan_number.toUpperCase(),
            date_of_birth || null,
            employment_type || null,
            monthly_salary ? parseFloat(monthly_salary) : null,
            payment_mode || null,
            dedupeStatus,
            dedupeCode,
            utmLink,
            utmSource,
            utmMedium,
            utmCampaign
          ]
        );
      }
    } catch (leadError) {
      console.error('Error processing partner lead:', leadError);
      // Continue even if lead storage/update fails
    }

    // Prepare response
    const responseData = {
      status: dedupeCode === 2006 ? false : true,
      code: dedupeCode,
      message: responseMessage
    };

    // Add UTM link ONLY for Fresh Lead (2005), not for Registered User (2004)
    // Registered users are already in the system, so no need to share UTM link
    // Active users (2006) are rejected and don't get UTM link
    if (dedupeCode === 2005) {
      responseData.utm_link = utmLink;
      responseData.redirect_url = utmLink;
    }

    // Encrypt response if encryption is enabled AND request was encrypted
    // Only encrypt response if the original request was encrypted (for consistency)
    if (isEncrypted) {
      const encryptionEnabled = process.env.PARTNER_API_ENCRYPTION_ENABLED === 'true';
      const hasPublicKey = !!partner.public_key_path;

      console.log('🔍 Encryption check:', {
        isEncrypted,
        encryptionEnabled,
        envValue: process.env.PARTNER_API_ENCRYPTION_ENABLED,
        hasPublicKey,
        publicKeyPath: partner.public_key_path
      });

      if (encryptionEnabled && hasPublicKey) {
        try {
          const partnerPublicKey = loadKeyFromFile(partner.public_key_path);
          const ourPrivateKeyPath = process.env.PARTNER_PRIVATE_KEY_PATH || path.join(__dirname, '../../partner_keys/pocketcredit_private.pem');
          const ourPrivateKey = loadKeyFromFile(ourPrivateKeyPath);

          const encryptedResponse = encryptForPartner(
            partner.partner_uuid,
            responseData,
            partnerPublicKey,
            ourPrivateKey
          );

          return res.json(encryptedResponse);
        } catch (encryptError) {
          console.error('Encryption error:', encryptError);
          // Fall back to unencrypted response
        }
      }
    }

    return res.json(responseData);

  } catch (error) {
    console.error('Lead dedupe check error:', error);
    res.status(500).json({
      status: false,
      code: 5000,
      message: 'Internal Server Error'
    });
  }
});

module.exports = router;

