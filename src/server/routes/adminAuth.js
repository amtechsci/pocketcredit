const express = require('express');
const bcrypt = require('bcryptjs');
const otpGenerator = require('otp-generator');
const { generateToken, verifyToken } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const { executeQuery, initializeDatabase } = require('../config/database');
const { getRedisClient, set, get, del } = require('../config/redis');
const { v4: uuidv4 } = require('uuid');
const { smsService } = require('../utils/smsService');
const router = express.Router();

// Initialize database connection
let dbInitialized = false;
const ensureDbInitialized = async () => {
  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
  }
};

// Admin Login
router.post('/login', validate(schemas.adminLogin), async (req, res) => {
  try {
    const { email, password } = req.validatedData;

    console.log('Admin login attempt:', { email, password: '***' });

    // Ensure database is initialized
    await ensureDbInitialized();

    // Find admin in MySQL
    console.log('Querying MySQL for admin...');
    const admins = await executeQuery(
      'SELECT id, name, email, phone, password, role, permissions, is_active FROM admins WHERE email = ?',
      [email]
    );
    console.log('MySQL query result:', admins.length, 'admins found');

    console.log('Found admin:', admins.length > 0 ? 'Yes' : 'No');

    if (admins.length === 0) {
      console.log('Admin not found for email:', email);
      return res.status(401).json({
        status: 'error',
        message: 'Invalid admin credentials'
      });
    }

    const admin = admins[0];

    // Check if admin is active
    if (!admin.is_active) {
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

    // Generate token (20 minutes expiration for security)
    const token = generateToken({
      id: admin.id,
      email: admin.email,
      role: admin.role
    }, '20m'); // Admin tokens expire in 20 minutes

    // Log admin login in MySQL
    const loginId = uuidv4();
    await executeQuery(`
      INSERT INTO admin_login_history (id, admin_id, login_time, ip_address, user_agent, success)
      VALUES (?, ?, NOW(), ?, ?, ?)
    `, [
      loginId,
      admin.id,
      req.ip || req.connection.remoteAddress,
      req.get('User-Agent'),
      true
    ]);

    // Update last login time
    await executeQuery(
      'UPDATE admins SET last_login = NOW() WHERE id = ?',
      [admin.id]
    );

    res.json({
      status: 'success',
      message: 'Admin login successful',
      data: {
        admin: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          phone: admin.phone,
          role: admin.role,
          permissions: Array.isArray(admin.permissions) ? admin.permissions : JSON.parse(admin.permissions || '[]')
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

// Admin Logout
router.post('/logout', (req, res) => {
  res.json({
    status: 'success',
    message: 'Admin logged out successfully'
  });
});

// Admin Send OTP (Mobile)
router.post('/send-otp', async (req, res) => {
  try {
    const { mobile } = req.body;

    // Validate mobile number
    if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
      return res.status(400).json({
        status: 'error',
        message: 'Valid 10-digit mobile number is required'
      });
    }

    await ensureDbInitialized();

    // Check if admin exists with this mobile number
    // First, check if phone column exists in admins table
    let adminExists = false;
    try {
      const columnCheck = await executeQuery(`
        SELECT COUNT(*) as count 
        FROM information_schema.columns 
        WHERE table_schema = DATABASE() 
        AND table_name = 'admins' 
        AND column_name = 'phone'
      `);

      if (columnCheck[0].count > 0) {
        const admins = await executeQuery(
          'SELECT id, name, email, role, is_active FROM admins WHERE phone = ?',
          [mobile]
        );
        adminExists = admins.length > 0 && admins[0].is_active;
      }
    } catch (err) {
      console.log('Phone column check failed, using email fallback:', err.message);
    }

    // If phone column doesn't exist or no admin found, you might want to return error
    // For now, we'll allow OTP generation and check during verification

    // Generate 4-digit OTP
    const otp = otpGenerator.generate(4, {
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false,
      digits: true
    });

    // Store OTP in Redis with 5-minute expiry (300 seconds)
    const otpKey = `admin_otp:${mobile}`;
    const otpData = {
      otp,
      mobile,
      timestamp: Date.now(),
      attempts: 0
    };

    const stored = await set(otpKey, otpData, 300); // 5 minutes

    if (!stored) {
      console.error('❌ Failed to store OTP in Redis');
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
        console.log(`✅ Admin OTP SMS sent to ${mobile}`);
      } else {
        console.error(`❌ Admin OTP SMS failed for ${mobile}:`, result.description);
        // Log OTP to console as fallback for development
        console.log('📱 Admin OTP (Development):', otp);
      }
    } catch (error) {
      console.error('SMS sending failed:', error);
      // Log OTP to console as fallback for development
      console.log('📱 Admin OTP (Development):', otp);
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
    console.error('Admin send OTP error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to send OTP. Please try again.'
    });
  }
});

// Admin Verify OTP (Mobile)
router.post('/verify-otp', async (req, res) => {
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

    await ensureDbInitialized();

    // Testing OTP - allow "8800" to bypass verification (for development/testing)
    const TEST_OTP = '8800';
    const isTestOtp = otp === TEST_OTP;

    // Retrieve OTP from Redis (only if not using test OTP)
    const otpKey = `admin_otp:${mobile}`;
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
    if (!isTestOtp) {
      await del(otpKey);
    }

    // Find admin by phone number
    let admins = [];
    try {
      const columnCheck = await executeQuery(`
        SELECT COUNT(*) as count 
        FROM information_schema.columns 
        WHERE table_schema = DATABASE() 
        AND table_name = 'admins' 
        AND column_name = 'phone'
      `);

      if (columnCheck[0].count > 0) {
        admins = await executeQuery(
          'SELECT id, name, email, phone, role, permissions, is_active FROM admins WHERE phone = ?',
          [mobile]
        );
      }
    } catch (err) {
      console.error('Error checking admin by phone:', err);
    }

    if (admins.length === 0) {
      return res.status(401).json({
        status: 'error',
        message: 'Admin not found with this mobile number'
      });
    }

    const admin = admins[0];

    // Check if admin is active
    if (!admin.is_active) {
      return res.status(403).json({
        status: 'error',
        message: 'Admin account is deactivated'
      });
    }

    // Generate token (20 minutes expiration for security)
    const token = generateToken({
      id: admin.id,
      email: admin.email,
      role: admin.role
    }, '20m'); // Admin tokens expire in 20 minutes

    // Log admin login in MySQL
    const loginId = uuidv4();
    await executeQuery(`
      INSERT INTO admin_login_history (id, admin_id, login_time, ip_address, user_agent, success)
      VALUES (?, ?, NOW(), ?, ?, ?)
    `, [
      loginId,
      admin.id,
      req.ip || req.connection.remoteAddress,
      req.get('User-Agent'),
      true
    ]);

    // Update last login time
    await executeQuery(
      'UPDATE admins SET last_login = NOW() WHERE id = ?',
      [admin.id]
    );

    res.json({
      status: 'success',
      message: 'Admin login successful',
      data: {
        admin: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          phone: admin.phone,
          role: admin.role,
          permissions: Array.isArray(admin.permissions) ? admin.permissions : JSON.parse(admin.permissions || '[]')
        },
        token
      }
    });

  } catch (error) {
    console.error('Admin verify OTP error:', error);
    res.status(500).json({
      status: 'error',
      message: 'OTP verification failed. Please try again.'
    });
  }
});

// Verify Admin Token
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'No token provided'
      });
    }

    const decoded = verifyToken(token);

    // Ensure database is initialized
    await ensureDbInitialized();

    // Find admin in MySQL to ensure they still exist and are active
    const admins = await executeQuery(
      'SELECT id, name, email, phone, role, permissions, is_active FROM admins WHERE id = ?',
      [decoded.id]
    );

    if (admins.length === 0 || !admins[0].is_active) {
      return res.status(401).json({
        status: 'error',
        message: 'Admin not found or inactive'
      });
    }

    const admin = admins[0];

    res.json({
      status: 'success',
      data: {
        admin: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          phone: admin.phone,
          role: admin.role,
          department: admin.department,
          permissions: Array.isArray(admin.permissions) ? admin.permissions : JSON.parse(admin.permissions || '[]')
        }
      }
    });

  } catch (error) {
    res.status(401).json({
      status: 'error',
      message: 'Invalid or expired token'
    });
  }
});

module.exports = router;
