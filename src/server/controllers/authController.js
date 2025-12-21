const otpGenerator = require('otp-generator');
const { getRedisClient, set, get, del } = require('../config/redis');
const { findUserByMobileNumber, findUserById, createUser, updateLastLogin, getProfileSummary } = require('../models/user');
const { initializeDatabase, executeQuery } = require('../config/database');

// Try to load loginDataParser, but don't fail if it doesn't exist
let extractLoginData = null;
try {
  const loginDataParser = require('../utils/loginDataParser');
  extractLoginData = loginDataParser.extractLoginData;
} catch (e) {
  console.warn('⚠️  loginDataParser not available, login history will be skipped:', e.message);
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

    // Fallback to database if Redis is not available
    if (!stored) {
      console.warn('⚠️  Redis not available, storing OTP in database as fallback');
      try {
        await initializeDatabase();
        
        // Delete any existing unverified OTPs for this mobile
        await executeQuery(
          `DELETE FROM login_otp_verification 
           WHERE mobile = ? AND verified = 0`,
          [mobile]
        );
        
        // Store OTP in database with 5-minute expiry
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
        await executeQuery(
          `INSERT INTO login_otp_verification (mobile, otp, attempts, expires_at, verified) 
           VALUES (?, ?, 0, ?, 0)`,
          [mobile, otp, expiresAt]
        );
        
        console.log(`✅ OTP stored in database for ${mobile}`);
      } catch (dbError) {
        console.error('❌ Failed to store OTP in database:', dbError);
        // Log OTP to console as last resort
        console.log(`📱 OTP for ${mobile}: ${otp} (Valid for 5 minutes) - Redis and DB failed`);
      }
    }

    // Send SMS using your SMS service
    const message = `${otp} is OTP for Creditlab login verification & valid till 2min. Don't share this OTP with anyone.`;
    const template_id = '1407174844163241940';
    const sender = 'CREDLB';
    
    const smsUrl = `https://sms.smswala.in/app/smsapi/index.php?key=2683C705E7CB39&campaign=16613&routeid=30&type=text&contacts=${mobile}&senderid=${sender}&msg=${encodeURIComponent(message)}&template_id=${template_id}&pe_id=1401337620000065797`;
    
    try {
      const response = await fetch(smsUrl);
      const result = await response.text();
      console.log(`📱 SMS sent to ${mobile}: ${result}`);
    } catch (error) {
      console.error('SMS sending failed:', error);
      // Log OTP to console as fallback
      console.log(`📱 OTP for ${mobile}: ${otp} (Valid for 5 minutes) - SMS failed`);
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

    // Retrieve OTP from Redis first, fallback to database
    const otpKey = `otp:${mobile}`;
    let otpData = await get(otpKey);
    let fromDatabase = false;

    // If not in Redis, check database
    if (!otpData) {
      try {
        await initializeDatabase();
        
        const otpRecords = await executeQuery(
          `SELECT * FROM login_otp_verification 
           WHERE mobile = ? AND verified = 0 AND expires_at > NOW()
           ORDER BY created_at DESC LIMIT 1`,
          [mobile]
        );

        if (otpRecords && otpRecords.length > 0) {
          const record = otpRecords[0];
          otpData = {
            otp: record.otp,
            mobile: record.mobile,
            attempts: record.attempts || 0,
            timestamp: new Date(record.created_at).getTime(),
            id: record.id // Store DB ID for updates
          };
          fromDatabase = true;
          console.log(`📥 OTP retrieved from database for ${mobile}`);
        }
      } catch (dbError) {
        console.error('Error retrieving OTP from database:', dbError);
      }
    }

    if (!otpData) {
      return res.status(400).json({
        status: 'error',
        message: 'OTP not found or expired. Please request a new OTP.'
      });
    }

    // Check if OTP matches
    if (otpData.otp !== otp) {
      // Increment attempts counter
      otpData.attempts = (otpData.attempts || 0) + 1;
      
      // If too many attempts, delete the OTP
      if (otpData.attempts >= 3) {
        if (fromDatabase) {
          await executeQuery(
            `DELETE FROM login_otp_verification WHERE id = ?`,
            [otpData.id]
          );
        } else {
          await del(otpKey);
        }
        return res.status(400).json({
          status: 'error',
          message: 'Too many incorrect attempts. Please request a new OTP.'
        });
      }
      
      // Update attempts
      if (fromDatabase) {
        await executeQuery(
          `UPDATE login_otp_verification SET attempts = ? WHERE id = ?`,
          [otpData.attempts, otpData.id]
        );
      } else {
        await set(otpKey, otpData, 300);
      }
      
      return res.status(400).json({
        status: 'error',
        message: 'Invalid OTP. Please try again.'
      });
    }

    // OTP is valid, delete it
    if (fromDatabase) {
      await executeQuery(
        `UPDATE login_otp_verification SET verified = 1 WHERE id = ?`,
        [otpData.id]
      );
    } else {
      await del(otpKey);
    }

    // Check if user exists
    let user = await findUserByMobileNumber(mobile);

    if (!user) {
      // Create new user
      user = await createUser({
        phone: mobile,
        phone_verified: true
      });
      
      console.log(`✅ New user created: ${mobile}`);
    } else {
      // Update last login for existing user
      await updateLastLogin(user.id);
      console.log(`✅ User login: ${mobile}`);
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
          console.log(`✅ Login history saved for user ${user.id}`);
        } else {
          console.log('⚠️  user_login_history table does not exist yet, skipping login history');
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
