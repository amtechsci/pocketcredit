const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { executeQuery, initializeDatabase } = require('../config/database');
const { requireAuth } = require('../middleware/jwtAuth');
const { uploadToS3 } = require('../services/s3Service');

// Multer configuration for PDF uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

/**
 * POST /api/aa/initiate
 * Initiate Account Aggregator flow
 */
router.post('/initiate', requireAuth, async (req, res) => {
  const { mobile_number, bank_name, application_id } = req.body;
  const userId = req.userId;

  if (!mobile_number || !bank_name || !application_id) {
    return res.status(400).json({
      success: false,
      message: 'Mobile number, bank name, and application ID are required'
    });
  }

  // Validate mobile number
  if (!/^[6-9]\d{9}$/.test(mobile_number)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid mobile number format'
    });
  }

  try {
    await initializeDatabase();

    // Generate unique transaction ID
    const transactionId = `AA_${userId}_${application_id}_${Date.now()}`;

    // In production, you would call actual AA provider API (NADL, Finvu, Sahamati, etc.)
    // For demo, we'll create a mock URL
    const aaProviderUrl = process.env.AA_PROVIDER_URL || 'https://aa-provider.example.com';
    const callbackUrl = `${process.env.APP_URL || 'https://pocketcredit.in'}/api/aa/callback`;

    // Store AA request in database
    await executeQuery(
      `INSERT INTO account_aggregator_requests 
       (user_id, application_id, transaction_id, mobile_number, bank_name, status, callback_url, created_at) 
       VALUES (?, ?, ?, ?, ?, 'pending', ?, NOW())`,
      [userId, application_id, transactionId, mobile_number, bank_name, callbackUrl]
    );

    // Mock AA URL (in production, this would be from AA provider)
    const aaUrl = `${aaProviderUrl}/consent?txnId=${transactionId}&mobile=${mobile_number}&bank=${encodeURIComponent(
      bank_name
    )}&callback=${encodeURIComponent(callbackUrl)}`;

    res.json({
      success: true,
      data: {
        aaUrl,
        transactionId
      },
      message: 'Account Aggregator initiated successfully'
    });
  } catch (error) {
    console.error('AA initiation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate Account Aggregator'
    });
  }
});

/**
 * GET /api/aa/callback
 * Callback endpoint from AA provider
 */
router.get('/callback', async (req, res) => {
  const { txnId, status, consentId } = req.query;

  console.log('AA Callback received:', { txnId, status, consentId });

  if (!txnId) {
    return res.status(400).send('Missing transaction ID');
  }

  try {
    await initializeDatabase();

    // Find the AA request
    const aaRequests = await executeQuery(
      'SELECT * FROM account_aggregator_requests WHERE transaction_id = ?',
      [txnId]
    );

    if (aaRequests.length === 0) {
      console.error('AA request not found for txnId:', txnId);
      return res.redirect(`${process.env.FRONTEND_URL || 'https://pocketcredit.in'}/aa-failed?reason=not_found`);
    }

    const aaRequest = aaRequests[0];

    if (status === 'success' || status === 'approved') {
      // Update status to success
      await executeQuery(
        `UPDATE account_aggregator_requests 
         SET status = 'approved', consent_id = ?, approved_at = NOW(), updated_at = NOW() 
         WHERE transaction_id = ?`,
        [consentId, txnId]
      );

      // In production, you would now fetch the actual bank statement data using consentId
      // For demo, we'll just mark it as approved

      console.log('AA Consent approved for user:', aaRequest.user_id);

      // Redirect to next step
      res.redirect(
        `${process.env.FRONTEND_URL || 'https://pocketcredit.in'}/loan-application/employment-details?applicationId=${
          aaRequest.application_id
        }&aaSuccess=true`
      );
    } else {
      // Update status to failed
      await executeQuery(
        `UPDATE account_aggregator_requests 
         SET status = 'failed', updated_at = NOW() 
         WHERE transaction_id = ?`,
        [txnId]
      );

      console.log('AA Consent failed for user:', aaRequest.user_id);

      res.redirect(
        `${process.env.FRONTEND_URL || 'https://pocketcredit.in'}/loan-application/bank-statement?applicationId=${
          aaRequest.application_id
        }&aaFailed=true`
      );
    }
  } catch (error) {
    console.error('AA callback processing error:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'https://pocketcredit.in'}/aa-failed?reason=error`);
  }
});

/**
 * POST /api/aa/upload-statement
 * Manual upload of bank statement PDF
 */
router.post('/upload-statement', requireAuth, upload.single('statement'), async (req, res) => {
  const userId = req.userId;
  const { application_id } = req.body;

  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded'
    });
  }

  if (!application_id) {
    return res.status(400).json({
      success: false,
      message: 'Application ID is required'
    });
  }

  try {
    await initializeDatabase();

    // Upload to S3
    const s3Key = `bank-statements/${userId}/${application_id}/${Date.now()}_${req.file.originalname}`;
    const uploadResult = await uploadToS3(req.file.buffer, s3Key, req.file.mimetype, false);

    if (!uploadResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to upload file to storage'
      });
    }

    // Construct full S3 URL
    const fileUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;

    // Store in database
    await executeQuery(
      `INSERT INTO bank_statements 
       (user_id, application_id, upload_method, file_path, file_name, file_size, status, created_at) 
       VALUES (?, ?, 'manual', ?, ?, ?, 'uploaded', NOW())
       ON DUPLICATE KEY UPDATE 
       file_path = VALUES(file_path), 
       file_name = VALUES(file_name), 
       file_size = VALUES(file_size), 
       status = 'uploaded', 
       updated_at = NOW()`,
      [userId, application_id, fileUrl, req.file.originalname, req.file.size]
    );

    res.json({
      success: true,
      message: 'Bank statement uploaded successfully',
      data: {
        fileName: req.file.originalname,
        fileSize: req.file.size,
        uploadedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Bank statement upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload bank statement'
    });
  }
});

/**
 * GET /api/aa/status/:applicationId
 * Get AA status for an application
 */
router.get('/status/:applicationId', requireAuth, async (req, res) => {
  const { applicationId } = req.params;
  const userId = req.userId;

  try {
    await initializeDatabase();

    // Check AA request status
    const aaRequests = await executeQuery(
      `SELECT status, consent_id, approved_at, created_at 
       FROM account_aggregator_requests 
       WHERE user_id = ? AND application_id = ? 
       ORDER BY created_at DESC LIMIT 1`,
      [userId, applicationId]
    );

    // Check manual upload status
    const bankStatements = await executeQuery(
      `SELECT status, file_name, created_at 
       FROM bank_statements 
       WHERE user_id = ? AND application_id = ? 
       ORDER BY created_at DESC LIMIT 1`,
      [userId, applicationId]
    );

    const hasAA = aaRequests.length > 0 && aaRequests[0].status === 'approved';
    const hasManual = bankStatements.length > 0 && bankStatements[0].status === 'uploaded';

    res.json({
      success: true,
      data: {
        hasStatement: hasAA || hasManual,
        method: hasAA ? 'account_aggregator' : hasManual ? 'manual' : null,
        aaStatus: aaRequests[0] || null,
        manualStatus: bankStatements[0] || null
      }
    });
  } catch (error) {
    console.error('AA status check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check AA status'
    });
  }
});

module.exports = router;



