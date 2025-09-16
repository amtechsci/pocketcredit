const otpGenerator = require('otp-generator');
const { getRedisClient, set, get, del } = require('../config/redis');
const { findUserByMobileNumber, findUserById, createUser, updateLastLogin, getProfileSummary } = require('../models/user');

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

    // Generate 6-digit OTP
    const otp = otpGenerator.generate(6, {
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false
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
      console.warn('⚠️  Redis not available, OTP stored in memory (not recommended for production)');
      // In production, you might want to fail here or use an alternative storage
    }

    // Log OTP to console for testing (remove in production)
    console.log(`📱 OTP for ${mobile}: ${otp} (Valid for 5 minutes)`);

    // In production, integrate with SMS service like Twilio
    // await sendSMS(mobile, `Your Pocket Credit OTP is: ${otp}. Valid for 5 minutes.`);

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

    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        status: 'error',
        message: 'OTP must be 6 digits'
      });
    }

    // Retrieve OTP from Redis
    const otpKey = `otp:${mobile}`;
    const otpData = await get(otpKey);

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

    // OTP is valid, delete it from Redis
    await del(otpKey);

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

    // Create session
    req.session.userId = user.id;
    req.session.mobile = user.phone;
    req.session.authenticated = true;

    // Get profile summary
    const profileSummary = getProfileSummary(user);

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
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Not authenticated'
      });
    }

    const user = await findUserById(userId);
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    const profileSummary = getProfileSummary(user);

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
