const express = require('express');
const { executeQuery, initializeDatabase } = require('../config/database');
const { requireAuth } = require('../middleware/jwtAuth');
const router = express.Router();

// =====================================================
// EMAIL VERIFICATION
// =====================================================

// POST /api/verification/send-email-otp - Send Email OTP
router.post('/send-email-otp', async (req, res) => {
  try {
    await initializeDatabase();
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Check if user exists
    const users = await executeQuery(
      'SELECT id, email_verified FROM users WHERE email = ?',
      [email]
    );

    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found with this email'
      });
    }

    const user = users[0];

    if (user.email_verified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP in verification_records table
    await executeQuery(
      'INSERT INTO verification_records (user_id, document_type, document_number, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW()) ON DUPLICATE KEY UPDATE document_number = ?, updated_at = NOW()',
      [user.id, 'email_otp', otp, otp]
    );

    // TODO: Send actual email with OTP
    // For now, just return success
    console.log(`Email OTP for ${email}: ${otp}`);

    res.json({
      success: true,
      message: 'OTP sent to email successfully',
      data: {
        email,
        otp // Remove this in production
      }
    });

  } catch (error) {
    console.error('Error sending email OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while sending email OTP'
    });
  }
});

// POST /api/verification/verify-email-otp - Verify Email OTP
router.post('/verify-email-otp', async (req, res) => {
  try {
    await initializeDatabase();
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required'
      });
    }

    // Check if user exists
    const users = await executeQuery(
      'SELECT id, email_verified FROM users WHERE email = ?',
      [email]
    );

    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found with this email'
      });
    }

    const user = users[0];

    if (user.email_verified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
    }

    // Verify OTP
    const verificationRecords = await executeQuery(
      'SELECT * FROM verification_records WHERE user_id = ? AND document_type = ? AND document_number = ? ORDER BY created_at DESC LIMIT 1',
      [user.id, 'email_otp', otp]
    );

    if (!verificationRecords || verificationRecords.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP'
      });
    }

    // Check if OTP is not expired (5 minutes)
    const otpCreatedAt = new Date(verificationRecords[0].created_at);
    const now = new Date();
    const diffInMinutes = (now - otpCreatedAt) / (1000 * 60);

    if (diffInMinutes > 5) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired'
      });
    }

    // Update user email verification status
    await executeQuery(
      'UPDATE users SET email_verified = 1, updated_at = NOW() WHERE id = ?',
      [user.id]
    );

    // Delete the OTP record
    await executeQuery(
      'DELETE FROM verification_records WHERE user_id = ? AND document_type = ?',
      [user.id, 'email_otp']
    );

    res.json({
      success: true,
      message: 'Email verified successfully',
      data: {
        email,
        verified: true
      }
    });

  } catch (error) {
    console.error('Error verifying email OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while verifying email OTP'
    });
  }
});

// POST /api/verification/send-phone-otp - Send Phone OTP
router.post('/send-phone-otp', async (req, res) => {
  try {
    await initializeDatabase();
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    // Check if user exists
    const users = await executeQuery(
      'SELECT id, phone_verified FROM users WHERE phone = ?',
      [phone]
    );

    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found with this phone number'
      });
    }

    const user = users[0];

    if (user.phone_verified) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is already verified'
      });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP in verification_records table
    await executeQuery(
      'INSERT INTO verification_records (user_id, document_type, document_number, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW()) ON DUPLICATE KEY UPDATE document_number = ?, updated_at = NOW()',
      [user.id, 'phone_otp', otp, otp]
    );

    // TODO: Send actual SMS with OTP
    // For now, just return success
    console.log(`Phone OTP for ${phone}: ${otp}`);

    res.json({
      success: true,
      message: 'OTP sent to phone successfully',
      data: {
        phone,
        otp // Remove this in production
      }
    });

  } catch (error) {
    console.error('Error sending phone OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while sending phone OTP'
    });
  }
});

// POST /api/verification/verify-phone-otp - Verify Phone OTP
router.post('/verify-phone-otp', async (req, res) => {
  try {
    await initializeDatabase();
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and OTP are required'
      });
    }

    // Check if user exists
    const users = await executeQuery(
      'SELECT id, phone_verified FROM users WHERE phone = ?',
      [phone]
    );

    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found with this phone number'
      });
    }

    const user = users[0];

    if (user.phone_verified) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is already verified'
      });
    }

    // Verify OTP
    const verificationRecords = await executeQuery(
      'SELECT * FROM verification_records WHERE user_id = ? AND document_type = ? AND document_number = ? ORDER BY created_at DESC LIMIT 1',
      [user.id, 'phone_otp', otp]
    );

    if (!verificationRecords || verificationRecords.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP'
      });
    }

    // Check if OTP is not expired (5 minutes)
    const otpCreatedAt = new Date(verificationRecords[0].created_at);
    const now = new Date();
    const diffInMinutes = (now - otpCreatedAt) / (1000 * 60);

    if (diffInMinutes > 5) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired'
      });
    }

    // Update user phone verification status
    await executeQuery(
      'UPDATE users SET phone_verified = 1, updated_at = NOW() WHERE id = ?',
      [user.id]
    );

    // Delete the OTP record
    await executeQuery(
      'DELETE FROM verification_records WHERE user_id = ? AND document_type = ?',
      [user.id, 'phone_otp']
    );

    res.json({
      success: true,
      message: 'Phone number verified successfully',
      data: {
        phone,
        verified: true
      }
    });

  } catch (error) {
    console.error('Error verifying phone OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while verifying phone OTP'
    });
  }
});

module.exports = router;