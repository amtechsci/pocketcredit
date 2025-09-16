const express = require('express');
const { getConnection } = require('../utils/mysqlDatabase');
const router = express.Router();

// =====================================================
// EMAIL VERIFICATION
// =====================================================

// POST /api/verification/send-email-otp - Send Email OTP
router.post('/send-email-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const connection = await getConnection();

    // Check if user exists
    const [users] = await connection.execute(
      'SELECT id, email_verified FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store verification record
    await connection.execute(
      `INSERT INTO user_verifications (user_id, verification_type, verification_method, 
                                       verification_code, status, expires_at) 
       VALUES (?, 'email', 'otp', ?, 'pending', DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
      [user.id, otp]
    );

    // TODO: Send actual email with OTP
    // For now, we'll just return the OTP for testing
    console.log(`Email OTP for ${email}: ${otp}`);

    res.json({
      success: true,
      message: 'Email OTP sent successfully',
      data: {
        otp: process.env.NODE_ENV === 'development' ? otp : undefined // Only show in development
      }
    });

  } catch (error) {
    console.error('Send email OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while sending email OTP'
    });
  }
});

// POST /api/verification/verify-email-otp - Verify Email OTP
router.post('/verify-email-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required'
      });
    }

    const connection = await getConnection();

    // Get user
    const [users] = await connection.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const userId = users[0].id;

    // Verify OTP
    const [verifications] = await connection.execute(
      `SELECT id, attempts_count, max_attempts FROM user_verifications 
       WHERE user_id = ? AND verification_type = 'email' AND verification_code = ? 
       AND status = 'pending' AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [userId, otp]
    );

    if (verifications.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    const verification = verifications[0];

    // Check attempt limit
    if (verification.attempts_count >= verification.max_attempts) {
      await connection.execute(
        'UPDATE user_verifications SET status = "failed" WHERE id = ?',
        [verification.id]
      );

      return res.status(400).json({
        success: false,
        message: 'Maximum verification attempts exceeded'
      });
    }

    // Mark as verified
    await connection.execute(
      'UPDATE user_verifications SET status = "verified", verified_at = NOW() WHERE id = ?',
      [verification.id]
    );

    // Update user email verification status
    await connection.execute(
      'UPDATE users SET email_verified = TRUE WHERE id = ?',
      [userId]
    );

    res.json({
      success: true,
      message: 'Email verified successfully'
    });

  } catch (error) {
    console.error('Verify email OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while verifying email OTP'
    });
  }
});

// =====================================================
// PHONE VERIFICATION
// =====================================================

// POST /api/verification/send-phone-otp - Send Phone OTP
router.post('/send-phone-otp', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    const connection = await getConnection();

    // Check if user exists
    const [users] = await connection.execute(
      'SELECT id, phone_verified FROM users WHERE phone = ?',
      [phone]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store verification record
    await connection.execute(
      `INSERT INTO user_verifications (user_id, verification_type, verification_method, 
                                       verification_code, status, expires_at) 
       VALUES (?, 'phone', 'otp', ?, 'pending', DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
      [user.id, otp]
    );

    // TODO: Send actual SMS with OTP
    // For now, we'll just return the OTP for testing
    console.log(`Phone OTP for ${phone}: ${otp}`);

    res.json({
      success: true,
      message: 'Phone OTP sent successfully',
      data: {
        otp: process.env.NODE_ENV === 'development' ? otp : undefined // Only show in development
      }
    });

  } catch (error) {
    console.error('Send phone OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while sending phone OTP'
    });
  }
});

// POST /api/verification/verify-phone-otp - Verify Phone OTP
router.post('/verify-phone-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and OTP are required'
      });
    }

    const connection = await getConnection();

    // Get user
    const [users] = await connection.execute(
      'SELECT id FROM users WHERE phone = ?',
      [phone]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const userId = users[0].id;

    // Verify OTP
    const [verifications] = await connection.execute(
      `SELECT id, attempts_count, max_attempts FROM user_verifications 
       WHERE user_id = ? AND verification_type = 'phone' AND verification_code = ? 
       AND status = 'pending' AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [userId, otp]
    );

    if (verifications.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    const verification = verifications[0];

    // Check attempt limit
    if (verification.attempts_count >= verification.max_attempts) {
      await connection.execute(
        'UPDATE user_verifications SET status = "failed" WHERE id = ?',
        [verification.id]
      );

      return res.status(400).json({
        success: false,
        message: 'Maximum verification attempts exceeded'
      });
    }

    // Mark as verified
    await connection.execute(
      'UPDATE user_verifications SET status = "verified", verified_at = NOW() WHERE id = ?',
      [verification.id]
    );

    // Update user phone verification status
    await connection.execute(
      'UPDATE users SET phone_verified = TRUE WHERE id = ?',
      [userId]
    );

    res.json({
      success: true,
      message: 'Phone verified successfully'
    });

  } catch (error) {
    console.error('Verify phone OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while verifying phone OTP'
    });
  }
});

// =====================================================
// DIGILOCKER INTEGRATION (PLACEHOLDER)
// =====================================================

// POST /api/verification/digilocker/initiate - Initiate DigiLocker Verification
router.post('/digilocker/initiate', async (req, res) => {
  try {
    const { user_id, document_type } = req.body; // document_type: 'aadhaar', 'pan'

    if (!user_id || !document_type) {
      return res.status(400).json({
        success: false,
        message: 'User ID and document type are required'
      });
    }

    const connection = await getConnection();

    // Generate verification reference
    const verification_reference = `DL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store verification record
    await connection.execute(
      `INSERT INTO user_verifications (user_id, verification_type, verification_method, 
                                       verification_reference, status, metadata) 
       VALUES (?, 'digilocker', 'api', ?, 'pending', ?)`,
      [user_id, verification_reference, JSON.stringify({ document_type })]
    );

    // TODO: Integrate with actual DigiLocker API
    // For now, simulate the process
    const digilocker_url = `https://digilocker.gov.in/oauth/authorize?response_type=code&client_id=${process.env.DIGILOCKER_CLIENT_ID}&redirect_uri=${process.env.DIGILOCKER_REDIRECT_URI}&state=${verification_reference}`;

    res.json({
      success: true,
      message: 'DigiLocker verification initiated',
      data: {
        verification_reference,
        digilocker_url,
        status: 'pending'
      }
    });

  } catch (error) {
    console.error('DigiLocker initiate error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while initiating DigiLocker verification'
    });
  }
});

// POST /api/verification/digilocker/callback - DigiLocker Callback
router.post('/digilocker/callback', async (req, res) => {
  try {
    const { code, state, error } = req.body;

    if (error) {
      return res.status(400).json({
        success: false,
        message: `DigiLocker authorization failed: ${error}`
      });
    }

    if (!code || !state) {
      return res.status(400).json({
        success: false,
        message: 'Authorization code and state are required'
      });
    }

    const connection = await getConnection();

    // Find verification record
    const [verifications] = await connection.execute(
      'SELECT * FROM user_verifications WHERE verification_reference = ? AND status = "pending"',
      [state]
    );

    if (verifications.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Verification session not found or expired'
      });
    }

    const verification = verifications[0];

    // TODO: Exchange code for access token and fetch documents
    // For now, simulate successful verification
    await connection.execute(
      `UPDATE user_verifications SET status = "verified", verified_at = NOW(), 
       metadata = JSON_SET(metadata, '$.access_token', ?, '$.documents_fetched', ?) 
       WHERE id = ?`,
      ['mock_access_token', JSON.stringify(['aadhaar', 'pan']), verification.id]
    );

    // Update KYC status based on document type
    const metadata = JSON.parse(verification.metadata);
    if (metadata.document_type === 'aadhaar') {
      await connection.execute(
        'UPDATE user_kyc_status SET aadhaar_verified = TRUE WHERE user_id = ?',
        [verification.user_id]
      );
    } else if (metadata.document_type === 'pan') {
      await connection.execute(
        'UPDATE user_kyc_status SET pan_verified = TRUE WHERE user_id = ?',
        [verification.user_id]
      );
    }

    res.json({
      success: true,
      message: 'DigiLocker verification completed successfully',
      data: {
        verification_reference: state,
        documents_verified: [metadata.document_type]
      }
    });

  } catch (error) {
    console.error('DigiLocker callback error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while processing DigiLocker callback'
    });
  }
});

// =====================================================
// BANK ACCOUNT VERIFICATION (PLACEHOLDER)
// =====================================================

// POST /api/verification/bank/verify - Verify Bank Account
router.post('/bank/verify', async (req, res) => {
  try {
    const { user_id, bank_account_id } = req.body;

    if (!user_id || !bank_account_id) {
      return res.status(400).json({
        success: false,
        message: 'User ID and bank account ID are required'
      });
    }

    const connection = await getConnection();

    // Get bank account details
    const [bankAccounts] = await connection.execute(
      'SELECT * FROM user_bank_accounts WHERE id = ? AND user_id = ?',
      [bank_account_id, user_id]
    );

    if (bankAccounts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bank account not found'
      });
    }

    const bankAccount = bankAccounts[0];

    // Generate verification reference
    const verification_reference = `BANK_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store verification record
    await connection.execute(
      `INSERT INTO user_verifications (user_id, verification_type, verification_method, 
                                       verification_reference, status, metadata) 
       VALUES (?, 'bank_api', 'api', ?, 'pending', ?)`,
      [user_id, verification_reference, JSON.stringify({
        bank_account_id,
        account_number: bankAccount.account_number,
        ifsc_code: bankAccount.ifsc_code
      })]
    );

    // TODO: Integrate with actual bank verification API
    // For now, simulate the verification process
    setTimeout(async () => {
      try {
        await connection.execute(
          `UPDATE user_verifications SET status = "verified", verified_at = NOW() 
           WHERE verification_reference = ?`,
          [verification_reference]
        );

        await connection.execute(
          'UPDATE user_bank_accounts SET is_verified = TRUE, verified_at = NOW() WHERE id = ?',
          [bank_account_id]
        );

        await connection.execute(
          'UPDATE user_kyc_status SET bank_account_verified = TRUE WHERE user_id = ?',
          [user_id]
        );
      } catch (error) {
        console.error('Bank verification update error:', error);
      }
    }, 5000); // Simulate 5-second verification process

    res.json({
      success: true,
      message: 'Bank account verification initiated',
      data: {
        verification_reference,
        status: 'pending',
        estimated_completion_time: '5 minutes'
      }
    });

  } catch (error) {
    console.error('Bank verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while verifying bank account'
    });
  }
});

// =====================================================
// VIDEO KYC (PLACEHOLDER)
// =====================================================

// POST /api/verification/video-kyc/initiate - Initiate Video KYC
router.post('/video-kyc/initiate', async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const connection = await getConnection();

    // Generate session ID
    const session_id = `VKYC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store verification record
    await connection.execute(
      `INSERT INTO user_verifications (user_id, verification_type, verification_method, 
                                       verification_reference, status, metadata) 
       VALUES (?, 'video_kyc', 'api', ?, 'pending', ?)`,
      [user_id, session_id, JSON.stringify({ session_id, initiated_at: new Date().toISOString() })]
    );

    // TODO: Integrate with actual Video KYC API
    // For now, return mock session details
    res.json({
      success: true,
      message: 'Video KYC session initiated',
      data: {
        session_id,
        video_kyc_url: `https://video-kyc-api.example.com/session/${session_id}`,
        status: 'pending',
        instructions: [
          'Ensure good lighting',
          'Have your ID documents ready',
          'Speak clearly when stating your name and loan purpose'
        ]
      }
    });

  } catch (error) {
    console.error('Video KYC initiate error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while initiating video KYC'
    });
  }
});

// POST /api/verification/video-kyc/complete - Complete Video KYC
router.post('/video-kyc/complete', async (req, res) => {
  try {
    const { session_id, verification_result } = req.body;

    if (!session_id || !verification_result) {
      return res.status(400).json({
        success: false,
        message: 'Session ID and verification result are required'
      });
    }

    const connection = await getConnection();

    // Find verification record
    const [verifications] = await connection.execute(
      'SELECT * FROM user_verifications WHERE verification_reference = ? AND status = "pending"',
      [session_id]
    );

    if (verifications.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Video KYC session not found or expired'
      });
    }

    const verification = verifications[0];

    // Update verification status
    const status = verification_result.success ? 'verified' : 'failed';
    await connection.execute(
      `UPDATE user_verifications SET status = ?, verified_at = NOW(), 
       metadata = JSON_SET(metadata, '$.verification_result', ?) 
       WHERE id = ?`,
      [status, JSON.stringify(verification_result), verification.id]
    );

    if (verification_result.success) {
      // Update KYC status
      await connection.execute(
        'UPDATE user_kyc_status SET video_kyc_verified = TRUE WHERE user_id = ?',
        [verification.user_id]
      );
    }

    res.json({
      success: true,
      message: `Video KYC ${status} successfully`,
      data: {
        session_id,
        status,
        verification_result
      }
    });

  } catch (error) {
    console.error('Video KYC complete error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while completing video KYC'
    });
  }
});

module.exports = router;