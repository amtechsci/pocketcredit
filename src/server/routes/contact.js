const express = require('express');
const { executeQuery, initializeDatabase } = require('../config/database');
const { requireAuth } = require('../middleware/jwtAuth');
const emailService = require('../services/emailService');
const router = express.Router();

/**
 * POST /api/contact/send-email
 * Send contact email from user to support
 * @access Private
 */
router.post('/send-email', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;
    const { subject, message } = req.body;

    // Validate input
    if (!subject || !message) {
      return res.status(400).json({
        status: 'error',
        message: 'Subject and message are required'
      });
    }

    // Get user information
    const users = await executeQuery(
      `SELECT first_name, last_name, email, phone, personal_email, official_email 
       FROM users 
       WHERE id = ?`,
      [userId]
    );

    if (!users || users.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    const user = users[0];
    const userEmail = user.personal_email || user.official_email || user.email;
    const userName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'User';
    const userPhone = user.phone || '';

    if (!userEmail) {
      return res.status(400).json({
        status: 'error',
        message: 'User email not found. Please update your email in profile.'
      });
    }

    // Get support email from system settings
    let supportEmail = 'support@pocketcredit.in'; // Default
    
    try {
      const settings = await executeQuery(
        `SELECT value FROM system_settings WHERE \`key\` = 'support_email' LIMIT 1`
      );
      
      if (settings && settings.length > 0 && settings[0].value) {
        supportEmail = settings[0].value;
      }
    } catch (error) {
      console.warn('⚠️  Could not fetch support email from system settings, using default:', error.message);
    }

    // Send email
    const emailResult = await emailService.sendContactEmail({
      userEmail,
      userName,
      userPhone,
      subject,
      message,
      supportEmail
    });

    res.json({
      status: 'success',
      message: 'Email sent successfully',
      data: {
        messageId: emailResult.messageId,
        supportEmail: supportEmail
      }
    });

  } catch (error) {
    console.error('❌ Error sending contact email:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to send email. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;

