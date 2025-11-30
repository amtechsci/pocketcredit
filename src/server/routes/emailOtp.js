const express = require('express');
const router = express.Router();
const { executeQuery, initializeDatabase } = require('../config/database');
const { requireAuth } = require('../middleware/jwtAuth');
const nodemailer = require('nodemailer');

// Email transporter configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP to email
router.post('/send', requireAuth, async (req, res) => {
  const { email, type } = req.body;
  const userId = req.userId;

  if (!email || !type) {
    return res.status(400).json({
      status: 'error',
      message: 'Email and type are required'
    });
  }

  if (!['personal', 'official'].includes(type)) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid type. Must be personal or official'
    });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid email format'
    });
  }

  try {
    await initializeDatabase();
    
    // Check if email is already verified
    const existingVerification = await executeQuery(
      `SELECT * FROM email_otp_verification 
       WHERE user_id = ? AND email = ? AND type = ? AND verified = TRUE`,
      [userId, email, type]
    );

    if (existingVerification && existingVerification.length > 0) {
      return res.json({
        success: true,
        message: 'Email already verified'
      });
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete any existing unverified OTPs for this user and email
    await executeQuery(
      `DELETE FROM email_otp_verification 
       WHERE user_id = ? AND email = ? AND type = ? AND verified = FALSE`,
      [userId, email, type]
    );

    // Store OTP in database
    await executeQuery(
      `INSERT INTO email_otp_verification (user_id, email, otp, type, expires_at) 
       VALUES (?, ?, ?, ?, ?)`,
      [userId, email, otp, type, expiresAt]
    );

    // Send email
    const emailType = type === 'personal' ? 'Personal' : 'Official';
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: email,
      subject: `Verify Your ${emailType} Email - Pocket Credit`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Email Verification</h2>
          <p>Hello,</p>
          <p>Your OTP for ${emailType} email verification is:</p>
          <div style="background-color: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #1f2937; font-size: 32px; letter-spacing: 5px; margin: 0;">${otp}</h1>
          </div>
          <p>This OTP will expire in 10 minutes.</p>
          <p>If you didn't request this verification, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
          <p style="color: #6b7280; font-size: 12px;">
            This is an automated email from Pocket Credit. Please do not reply to this email.
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    res.json({
      success: true,
      message: 'OTP sent successfully'
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to send OTP',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Verify OTP
router.post('/verify', requireAuth, async (req, res) => {
  const { email, otp, type } = req.body;
  const userId = req.userId;

  if (!email || !otp || !type) {
    return res.status(400).json({
      status: 'error',
      message: 'Email, OTP, and type are required'
    });
  }

  try {
    await initializeDatabase();
    
    // Find the OTP record
    const otpRecords = await executeQuery(
      `SELECT * FROM email_otp_verification 
       WHERE user_id = ? AND email = ? AND type = ? AND otp = ? AND verified = FALSE
       ORDER BY created_at DESC LIMIT 1`,
      [userId, email, type, otp]
    );

    if (!otpRecords || otpRecords.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP'
      });
    }

    const otpRecord = otpRecords[0];

    // Check if OTP has expired
    if (new Date() > new Date(otpRecord.expires_at)) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new one.'
      });
    }

    // Mark OTP as verified
    await executeQuery(
      `UPDATE email_otp_verification 
       SET verified = TRUE 
       WHERE id = ?`,
      [otpRecord.id]
    );

    // Update user table
    const emailField = type === 'personal' ? 'personal_email' : 'official_email';
    const verifiedField = type === 'personal' ? 'personal_email_verified' : 'official_email_verified';
    
    await executeQuery(
      `UPDATE users 
       SET ${emailField} = ?, ${verifiedField} = TRUE 
       WHERE id = ?`,
      [email, userId]
    );

    res.json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to verify OTP',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;

