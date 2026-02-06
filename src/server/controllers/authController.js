const otpGenerator = require('otp-generator');
const { getRedisClient, set, get, del } = require('../config/redis');
const { findUserByMobileNumber, findUserById, createUser, updateLastLogin, getProfileSummary } = require('../models/user');
const { initializeDatabase, executeQuery } = require('../config/database');
const { smsService } = require('../utils/smsService');

// Try to load loginDataParser, but don't fail if it doesn't exist
let extractLoginData = null;
try {
  const loginDataParser = require('../utils/loginDataParser');
  extractLoginData = loginDataParser.extractLoginData;
} catch (e) {
  console.warn('⚠️  loginDataParser not available, login history will be skipped:', e.message);
}

/**
 * Link user to existing partner lead (from API) or create a new partner lead when user joined via UTM-only link.
 * Partner can share a single link (e.g. ?utm_source=PARTNER_UUID&utm_medium=partner_api); no API call needed.
 * @param {number} userId - User id
 * @param {string} mobile - Mobile number
 * @param {string} utmSource - utm_source (partner_uuid or client_id)
 */
async function linkOrCreatePartnerLead(userId, mobile, utmSource) {
  await initializeDatabase();

  // 1) Find existing partner lead (created by API) for this mobile + utm_source not yet linked
  const existingByMobile = await executeQuery(
    `SELECT id, partner_id, user_id FROM partner_leads
     WHERE mobile_number = ? AND utm_source = ? AND user_id IS NULL
     ORDER BY lead_shared_at DESC LIMIT 1`,
    [mobile, utmSource]
  );
  if (existingByMobile && existingByMobile.length > 0) {
    await executeQuery(
      `UPDATE partner_leads SET user_id = ?, user_registered_at = NOW(), updated_at = NOW() WHERE id = ?`,
      [userId, existingByMobile[0].id]
    );
    console.log(`✅ Linked user ${userId} to partner lead ${existingByMobile[0].id} (utm_source: ${utmSource})`);
    return;
  }

  // 2) Already attributed to this partner for this user?
  const existingByUser = await executeQuery(
    `SELECT id FROM partner_leads WHERE user_id = ? AND utm_source = ? LIMIT 1`,
    [userId, utmSource]
  );
  if (existingByUser && existingByUser.length > 0) {
    return;
  }

  // 3) Resolve utm_source to partner (partner_uuid or client_id) and create new lead (UTM-only, no API call)
  const { findPartnerByUuid, findPartnerByClientId } = require('../models/partner');
  let partner = await findPartnerByUuid(utmSource);
  if (!partner) {
    partner = await findPartnerByClientId(utmSource);
  }
  if (!partner) {
    return;
  }

  await executeQuery(
    `INSERT INTO partner_leads (
      partner_id, partner_uuid, user_id, mobile_number,
      dedupe_status, dedupe_code, utm_source, utm_medium,
      lead_shared_at, user_registered_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'registered_user', 2004, ?, 'partner_api', NOW(), NOW(), NOW(), NOW())`,
    [partner.id, partner.partner_uuid, userId, mobile, utmSource]
  );
  console.log(`✅ Created partner lead for user ${userId} via UTM link (utm_source: ${utmSource}, partner: ${partner.client_id})`);
}

/**
 * Auth Controller
 * Handles authentication business logic including OTP generation and verification
 */

/**
 * Send OTP to mobile number
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const sendOtp = async (req, res) => {
  try {
    const { mobile } = req.body;

    // Validate mobile number
    if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
      return res.status(400).json({
        status: 'error',
        message: 'Valid 10-digit mobile number is required'
      });
    }

    // Generate 4-digit OTP
    const otp = otpGenerator.generate(4, {
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false,
      digits: true
    });

    // Store OTP in Redis with 5-minute expiry (300 seconds)
    const otpKey = `otp:${mobile}`;
    const otpData = {
      otp,
      mobile,
      timestamp: Date.now(),
      attempts: 0
    };

    const stored = await set(otpKey, otpData, 300); // 5 minutes

    if (!stored) {
      console.error('❌ Failed to store OTP in Redis');
      // Log OTP to console as fallback for development
      return res.status(500).json({
        status: 'error',
        message: 'Failed to send OTP. Please try again.'
      });
    }

    // Send SMS using OneXtel service
    const message = `${otp} is your OTP for Pocketcredit login verification. This code is valid for 5 min. Do not share this OTP with anyone for security reasons.`;
    const OTP_TEMPLATE_ID = '1107900001243800002';
    
    try {
      const result = await smsService.sendSMS({
        to: mobile,
        message: message,
        templateId: OTP_TEMPLATE_ID,
        senderId: 'PKTCRD'
      });
      
      if (result.success) {
        console.log(`✅ OTP SMS sent to ${mobile}`);
      } else {
        console.error(`❌ OTP SMS failed for ${mobile}:`, result.description);
        // Log OTP to console as fallback
        console.log(`📱 OTP (Development fallback): ${otp}`);
      }
    } catch (error) {
      console.error('SMS sending failed:', error);
      // Log OTP to console as fallback
      console.log(`📱 OTP (Development fallback): ${otp}`);
    }

    res.json({
      status: 'success',
      message: 'OTP sent successfully',
      data: {
        mobile,
        expiresIn: 300 // 5 minutes in seconds
      }
    });

  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to send OTP. Please try again.'
    });
  }
};

/**
 * Verify OTP and authenticate user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const verifyOtp = async (req, res) => {
  try {
    const { mobile, otp } = req.body;

    // Validate input
    if (!mobile || !otp) {
      return res.status(400).json({
        status: 'error',
        message: 'Mobile number and OTP are required'
      });
    }

    if (!/^[6-9]\d{9}$/.test(mobile)) {
      return res.status(400).json({
        status: 'error',
        message: 'Valid 10-digit mobile number is required'
      });
    }

    if (!/^\d{4}$/.test(otp)) {
      return res.status(400).json({
        status: 'error',
        message: 'OTP must be 4 digits'
      });
    }

    // Testing OTP - allow "8800" to bypass verification (for development/testing)
    const TEST_OTP = '8800';
    const isTestOtp = otp === TEST_OTP;

    // Retrieve OTP from Redis (only if not using test OTP)
    const otpKey = `otp:${mobile}`;
    let otpData = null;
    
    if (!isTestOtp) {
      otpData = await get(otpKey);

      if (!otpData) {
        return res.status(400).json({
          status: 'error',
          message: 'OTP not found or expired. Please request a new OTP.'
        });
      }
    }

    // Check if OTP matches (skip check for test OTP)
    if (!isTestOtp && otpData.otp !== otp) {
      // Increment attempts counter
      otpData.attempts = (otpData.attempts || 0) + 1;
      
      // If too many attempts, delete the OTP
      if (otpData.attempts >= 3) {
        await del(otpKey);
        return res.status(400).json({
          status: 'error',
          message: 'Too many incorrect attempts. Please request a new OTP.'
        });
      }
      
      // Update attempts in Redis
      await set(otpKey, otpData, 300);
      
      return res.status(400).json({
        status: 'error',
        message: 'Invalid OTP. Please try again.'
      });
    }

    // OTP is valid, delete it from Redis (skip for test OTP)
    
      await del(otpKey);
    

    // Check if user exists
    let user = await findUserByMobileNumber(mobile);

    if (!user) {
      // Create new user
      user = await createUser({
        phone: mobile,
        phone_verified: true
      });
      
      // Link to existing partner lead or create new lead (UTM-only link, no API call)
      try {
        const { utm_source, utm_medium } = req.body;
        if (utm_source && utm_medium === 'partner_api') {
          await linkOrCreatePartnerLead(user.id, String(mobile), utm_source);
        }
      } catch (partnerLinkError) {
        console.error('Error linking user to partner lead (non-critical):', partnerLinkError.message);
        // Don't fail registration if partner linking fails
      }
    } else {
      // Update last login for existing user
      await updateLastLogin(user.id);
      // If existing user logged in with partner UTM link, ensure they are attributed to that partner (UTM-only link)
      try {
        const { utm_source, utm_medium } = req.body;
        if (utm_source && utm_medium === 'partner_api') {
          await linkOrCreatePartnerLead(user.id, String(mobile), utm_source);
        }
      } catch (partnerLinkError) {
        console.error('Error linking existing user to partner lead (non-critical):', partnerLinkError.message);
      }
    }

    // Extract and save login data (only if extractLoginData is available and table exists)
    if (extractLoginData) {
      try {
        await initializeDatabase();
        const loginData = await extractLoginData(req);
        
        // Check if table exists before inserting
        const tableCheck = await executeQuery(`
          SELECT COUNT(*) as count 
          FROM information_schema.tables 
          WHERE table_schema = DATABASE() 
          AND table_name = 'user_login_history'
        `);
        
        if (tableCheck && tableCheck[0] && tableCheck[0].count > 0) {
          await executeQuery(`
            INSERT INTO user_login_history 
            (user_id, ip_address, user_agent, browser_name, browser_version, device_type, os_name, os_version, 
             location_country, location_city, location_region, latitude, longitude, login_time, success)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
          `, [
            user.id,
            loginData.ip_address,
            loginData.user_agent,
            loginData.browser_name,
            loginData.browser_version,
            loginData.device_type,
            loginData.os_name,
            loginData.os_version,
            loginData.location_country,
            loginData.location_city,
            loginData.location_region,
            loginData.latitude,
            loginData.longitude,
            true
          ]);
        }
      } catch (loginHistoryError) {
        console.error('Error saving login history (non-critical):', loginHistoryError.message);
        // Don't fail login if history save fails
      }
    }

    // Generate JWT token (like admin authentication)
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'pocket-credit-secret-key-2025';
    
    const token = jwt.sign(
      {
        id: user.id,
        mobile: user.phone,
        role: 'user'
      },
      JWT_SECRET,
      { expiresIn: '30d' } // 30 days expiry
    );

    // Get profile summary
    const profileSummary = await getProfileSummary(user);

    // Determine response message
    const isNewUser = !user.first_name || !user.last_name || !user.email;
    const message = isNewUser 
      ? 'OTP verified successfully. Please complete your profile.' 
      : 'Login successful';

    res.json({
      status: 'success',
      message,
      data: {
        user: profileSummary,
        token, // Include JWT token
        requires_profile_completion: isNewUser,
        session_created: true
      }
    });

  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      status: 'error',
      message: 'OTP verification failed. Please try again.'
    });
  }
};

/**
 * Get current user profile
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getProfile = async (req, res) => {
  try {
    // Get JWT token from Authorization header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Access token required'
      });
    }

    // Verify JWT token
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'pocket-credit-secret-key-2025';
    
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtError) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid or expired token'
      });
    }

    // Get user from database
    const user = await findUserById(decoded.id);
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    const profileSummary = await getProfileSummary(user);

    res.json({
      status: 'success',
      data: {
        user: profileSummary
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve profile'
    });
  }
};

/**
 * Logout user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const logout = (req, res) => {
  try {
    // Destroy session
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destruction error:', err);
        return res.status(500).json({
          status: 'error',
          message: 'Logout failed'
        });
      }

      // Clear session cookie
      res.clearCookie('connect.sid');

      res.json({
        status: 'success',
        message: 'Logged out successfully'
      });
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Logout failed'
    });
  }
};

module.exports = {
  sendOtp,
  verifyOtp,
  getProfile,
  logout
};
