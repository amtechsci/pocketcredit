const express = require('express');
const bcrypt = require('bcryptjs');
const { findUserByMobileNumber, findUserById, createUser, updateLastLogin } = require('../models/user');
const { createOrUpdateVerificationRecord } = require('../models/verification');
const { generateToken, verifyToken } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const router = express.Router();

// Generate random OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send SMS (mock implementation)
const sendSMS = async (mobile, message) => {
  // In production, integrate with actual SMS service like Twilio
  console.log(`📱 SMS to ${mobile}: ${message}`);
  return { success: true, messageId: 'mock_' + Date.now() };
};

// User Registration
router.post('/register', validate(schemas.userRegistration), async (req, res) => {
  try {
    const { name, email, mobile, password, dateOfBirth, panNumber } = req.validatedData;

    // Check if user already exists
    const existingUser = User.findOne({ $or: [{ email }, { mobile }, { panNumber }] });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'User with this email, mobile, or PAN already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = User.create({
      name,
      email,
      mobile,
      password: hashedPassword,
      dateOfBirth,
      panNumber: panNumber.toUpperCase(),
      kycStatus: 'pending',
      isEmailVerified: false,
      isMobileVerified: false,
      creditScore: null,
      riskCategory: 'medium',
      memberLevel: 'bronze',
      personalInfo: {},
      isActive: true
    });

    // Generate OTP for mobile verification
    const otp = generateOTP();
    OtpCode.create({
      userId: user.id,
      mobile,
      otp,
      purpose: 'mobile_verification',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    });

    // Send OTP
    await sendSMS(mobile, `Your Pocket Credit verification OTP is: ${otp}. Valid for 10 minutes.`);

    // Generate token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: 'user'
    });

    res.status(201).json({
      status: 'success',
      message: 'Registration successful. Please verify your mobile number.',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          mobile: user.mobile,
          kycStatus: user.kycStatus,
          isEmailVerified: user.isEmailVerified,
          isMobileVerified: user.isMobileVerified
        },
        token,
        requiresOtpVerification: true
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Registration failed'
    });
  }
});

// User Login
router.post('/login', validate(schemas.userLogin), async (req, res) => {
  try {
    const { email, password } = req.validatedData;

    // Find user
    const user = User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        status: 'error',
        message: 'Account is deactivated. Please contact support.'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password'
      });
    }

    // Generate token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: 'user'
    });

    // Log login activity
    LoginHistory.create({
      userId: user.id,
      userType: 'user',
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      loginTime: new Date().toISOString(),
      status: 'success'
    });

    res.json({
      status: 'success',
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          mobile: user.mobile,
          kycStatus: user.kycStatus,
          isEmailVerified: user.isEmailVerified,
          isMobileVerified: user.isMobileVerified,
          creditScore: user.creditScore,
          memberLevel: user.memberLevel
        },
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Login failed'
    });
  }
});

// Admin Login
router.post('/admin/login', validate(schemas.adminLogin), async (req, res) => {
  try {
    const { email, password } = req.validatedData;

    // Find admin
    const admin = Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid admin credentials'
      });
    }

    // Check if admin is active
    if (!admin.isActive) {
      return res.status(403).json({
        status: 'error',
        message: 'Admin account is deactivated'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, admin.password);
    if (!isValidPassword) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid admin credentials'
      });
    }

    // Generate token
    const token = generateToken({
      id: admin.id,
      email: admin.email,
      role: admin.role
    }, '8h'); // Admin tokens expire in 8 hours

    // Log admin login
    LoginHistory.create({
      userId: admin.id,
      userType: 'admin',
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      loginTime: new Date().toISOString(),
      status: 'success'
    });

    res.json({
      status: 'success',
      message: 'Admin login successful',
      data: {
        admin: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
          permissions: admin.permissions
        },
        token
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Admin login failed'
    });
  }
});

// Send OTP
router.post('/send-otp', async (req, res) => {
  try {
    const { mobile, purpose = 'verification' } = req.body;

    if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
      return res.status(400).json({
        status: 'error',
        message: 'Valid mobile number is required'
      });
    }

    // Generate OTP
    const otp = generateOTP();

    // Save OTP
    OtpCode.create({
      mobile,
      otp,
      purpose,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    });

    // Send SMS
    const message = purpose === 'login' 
      ? `Your Pocket Credit login OTP is: ${otp}. Valid for 10 minutes.`
      : `Your Pocket Credit verification OTP is: ${otp}. Valid for 10 minutes.`;
    
    await sendSMS(mobile, message);

    res.json({
      status: 'success',
      message: 'OTP sent successfully',
      data: {
        mobile,
        expiresIn: 600 // 10 minutes in seconds
      }
    });

  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to send OTP'
    });
  }
});

// Verify OTP
router.post('/verify-otp', validate(schemas.otpVerification), async (req, res) => {
  try {
    const { mobile, otp } = req.validatedData;

    // Find valid OTP
    const otpRecord = OtpCode.findOne({ mobile, otp });
    if (!otpRecord) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid OTP'
      });
    }

    // Check if OTP is expired
    if (new Date() > new Date(otpRecord.expiresAt)) {
      return res.status(400).json({
        status: 'error',
        message: 'OTP has expired'
      });
    }

    // Mark mobile as verified if user exists
    if (otpRecord.userId) {
      User.update(otpRecord.userId, { isMobileVerified: true });
    }

    // Delete used OTP
    OtpCode.delete(otpRecord.id);

    res.json({
      status: 'success',
      message: 'OTP verified successfully',
      data: {
        mobile,
        verified: true
      }
    });

  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({
      status: 'error',
      message: 'OTP verification failed'
    });
  }
});

// Mobile Login with OTP
router.post('/mobile-login', async (req, res) => {
  try {
    const { mobile, otp } = req.body;

    if (!mobile || !otp) {
      return res.status(400).json({
        status: 'error',
        message: 'Mobile number and OTP are required'
      });
    }

    // Verify OTP
    const otpRecord = OtpCode.findOne({ mobile, otp, purpose: 'login' });
    if (!otpRecord) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid OTP'
      });
    }

    // Check if OTP is expired
    if (new Date() > new Date(otpRecord.expiresAt)) {
      return res.status(400).json({
        status: 'error',
        message: 'OTP has expired'
      });
    }

    // Find user
    const user = User.findOne({ mobile });
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found with this mobile number'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        status: 'error',
        message: 'Account is deactivated'
      });
    }

    // Generate token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: 'user'
    });

    // Delete used OTP
    OtpCode.delete(otpRecord.id);

    // Log login activity
    LoginHistory.create({
      userId: user.id,
      userType: 'user',
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      loginTime: new Date().toISOString(),
      status: 'success',
      method: 'otp'
    });

    res.json({
      status: 'success',
      message: 'Mobile login successful',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          mobile: user.mobile,
          kycStatus: user.kycStatus,
          isEmailVerified: user.isEmailVerified,
          isMobileVerified: user.isMobileVerified,
          creditScore: user.creditScore,
          memberLevel: user.memberLevel
        },
        token
      }
    });

  } catch (error) {
    console.error('Mobile login error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Mobile login failed'
    });
  }
});

// Refresh Token
router.post('/refresh-token', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        status: 'error',
        message: 'Token is required'
      });
    }

    // Verify the token
    const decoded = verifyToken(token);
    
    // Generate new token
    const newToken = generateToken({
      id: decoded.id,
      email: decoded.email,
      role: decoded.role
    });

    res.json({
      status: 'success',
      message: 'Token refreshed successfully',
      data: {
        token: newToken
      }
    });

  } catch (error) {
    res.status(401).json({
      status: 'error',
      message: 'Invalid or expired token'
    });
  }
});

// Logout
router.post('/logout', (req, res) => {
  // In a production environment, you might want to blacklist the token
  res.json({
    status: 'success',
    message: 'Logged out successfully'
  });
});

// Forgot Password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        status: 'error',
        message: 'Email is required'
      });
    }

    const user = User.findOne({ email });
    if (!user) {
      // Don't reveal if email exists or not
      return res.json({
        status: 'success',
        message: 'If the email exists, you will receive password reset instructions'
      });
    }

    // Generate reset token (in production, this would be a secure token)
    const resetToken = generateToken({
      id: user.id,
      purpose: 'password_reset'
    }, '1h');

    // In production, send email with reset link
    console.log(`📧 Password reset link for ${email}: /reset-password?token=${resetToken}`);

    res.json({
      status: 'success',
      message: 'If the email exists, you will receive password reset instructions',
      data: {
        // In production, don't send the token in response
        resetToken: resetToken
      }
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to process password reset request'
    });
  }
});

// Reset Password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Token and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        status: 'error',
        message: 'Password must be at least 6 characters long'
      });
    }

    // Verify reset token
    const decoded = verifyToken(token);
    if (decoded.purpose !== 'password_reset') {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid reset token'
      });
    }

    // Find user
    const user = User.findById(decoded.id);
    if (!user) {
      return res.status(400).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update password
    User.update(user.id, { password: hashedPassword });

    res.json({
      status: 'success',
      message: 'Password reset successful'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(400).json({
      status: 'error',
      message: 'Invalid or expired reset token'
    });
  }
});

module.exports = router;