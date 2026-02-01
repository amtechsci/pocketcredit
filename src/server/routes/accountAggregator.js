const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { executeQuery, initializeDatabase } = require('../config/database');
const { requireAuth } = require('../middleware/jwtAuth');
const { uploadToS3 } = require('../services/s3Service');
const {
  initiateBankStatementCollection,
  uploadBankStatementPDF,
  checkBankStatementStatus,
  retrieveBankStatementReport
} = require('../services/digitapBankStatementService');

/**
 * Helper function to log webhook payloads to database
 */
async function logWebhookPayload(req, webhookType, endpoint, processed = false, error = null) {
  try {
    await initializeDatabase();
    
    const headers = {};
    Object.keys(req.headers).forEach(key => {
      headers[key] = req.headers[key];
    });

    const queryParams = req.query && Object.keys(req.query).length > 0 ? req.query : null;
    const bodyData = req.body && Object.keys(req.body).length > 0 ? req.body : null;
    
    // Extract common fields
    const requestId = req.body?.request_id || req.body?.requestId || req.query?.request_id || req.query?.requestId || null;
    const clientRefNum = req.body?.client_ref_num || req.body?.client_ref_num || req.query?.client_ref_num || null;
    const status = req.body?.status || req.query?.status || null;

    // Get client IP
    const ipAddress = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || null;
    const userAgent = req.headers['user-agent'] || null;

    // Store raw payload as string
    const rawPayload = JSON.stringify({
      method: req.method,
      url: req.url,
      headers: headers,
      query: req.query,
      body: req.body
    }, null, 2);

    await executeQuery(
      `INSERT INTO webhook_logs 
       (webhook_type, http_method, endpoint, headers, query_params, body_data, raw_payload, 
        request_id, client_ref_num, status, ip_address, user_agent, processed, processing_error, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        webhookType,
        req.method,
        endpoint,
        JSON.stringify(headers),
        queryParams ? JSON.stringify(queryParams) : null,
        bodyData ? JSON.stringify(bodyData) : null,
        rawPayload,
        requestId,
        clientRefNum,
        status,
        ipAddress,
        userAgent,
        processed,
        error
      ]
    );

    console.log(`📝 Webhook logged: ${webhookType} - ${req.method} ${endpoint}`);
  } catch (logError) {
    console.error('❌ Error logging webhook:', logError);
    // Don't throw - logging failure shouldn't break webhook processing
  }
}

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
 * Initiate Bank Statement Collection using Digitap
 * This generates a secure URL where users can:
 * - Login to Net Banking
 * - Upload PDF statements
 * - Use Account Aggregator
 */
router.post('/initiate', requireAuth, async (req, res) => {
  const { mobile_number, bank_name, application_id } = req.body;
  const userId = req.userId;

  if (!mobile_number || !application_id) {
    return res.status(400).json({
      success: false,
      message: 'Mobile number and application ID are required'
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

    // Verify application belongs to user
    const applications = await executeQuery(
      'SELECT id FROM loan_applications WHERE id = ? AND user_id = ?',
      [application_id, userId]
    );

    if (!applications || applications.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Loan application not found'
      });
    }

    // Determine URLs - prioritize environment variables, then use production URLs as default
    const isDevelopment = process.env.NODE_ENV === 'development' || (!process.env.NODE_ENV && !process.env.FRONTEND_URL);
    const frontendUrl = process.env.FRONTEND_URL || (isDevelopment ? 'http://localhost:3000' : 'https://pocketcredit.in');
    // APP_URL: production includes /api, development doesn't
    const appUrl = process.env.APP_URL || (isDevelopment ? 'http://localhost:3002' : 'https://pocketcredit.in/api');
    const returnUrl = `${frontendUrl}/link-salary-bank-account?applicationId=${application_id}&bankStatementComplete=true`;
    // Routes are mounted at /api/aa, so add /api for dev, or just /aa for prod (since appUrl already has /api)
    const webhookUrl = isDevelopment ? `${appUrl}/api/aa/webhook` : `${appUrl}/aa/webhook`;

    // Use Digitap's Bank Statement Collection API
    const result = await initiateBankStatementCollection(
      userId,
      application_id,
      returnUrl,
      webhookUrl,
      mobile_number
    );

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.error || 'Failed to initiate bank statement collection'
      });
    }

    // Store in database for tracking
    await executeQuery(
      `INSERT INTO digitap_bank_statements 
       (user_id, application_id, client_ref_num, mobile_number, bank_name, status, digitap_url, created_at) 
       VALUES (?, ?, ?, ?, ?, 'pending', ?, NOW())
       ON DUPLICATE KEY UPDATE 
       client_ref_num = VALUES(client_ref_num),
       digitap_url = VALUES(digitap_url),
       status = 'pending',
       updated_at = NOW()`,
      [userId, application_id, result.data.client_ref_num, mobile_number, bank_name || null, result.data.url]
    );

    res.json({
      success: true,
      data: {
        aaUrl: result.data.url,
        transactionId: result.data.client_ref_num,
        expiryTime: result.data.expiry_time
      },
      message: 'Bank statement collection initiated successfully'
    });
  } catch (error) {
    console.error('Bank statement initiation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate bank statement collection'
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

      // Redirect to next step (bank details after bank statement)
      res.redirect(
        `${process.env.FRONTEND_URL || 'http://localhost:3000'}/link-salary-bank-account?applicationId=${
          aaRequest.application_id
        }&bankStatementComplete=true`
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
        `${process.env.FRONTEND_URL || 'http://localhost:3000'}/loan-application/bank-statement?applicationId=${
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
 * Manual upload of bank statement PDF to Digitap for analysis
 */
router.post('/upload-statement', requireAuth, upload.single('statement'), async (req, res) => {
  const userId = req.userId;
  const { application_id, bank_name, password } = req.body;

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

    // Get user's mobile number
    const users = await executeQuery(
      'SELECT phone FROM users WHERE id = ?',
      [userId]
    );

    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const mobileNumber = users[0].phone;
    const { generateClientRefNum } = require('../services/digitapBankStatementService');
    const clientRefNum = generateClientRefNum(userId, application_id);

    // Upload to Digitap for analysis
    const digitapResult = await uploadBankStatementPDF({
      mobile_no: mobileNumber,
      client_ref_num: clientRefNum,
      file_buffer: req.file.buffer,
      file_name: req.file.originalname,
      bank_name: bank_name || null,
      password: password || null
    });

    if (!digitapResult.success) {
      return res.status(500).json({
        success: false,
        message: digitapResult.error || 'Failed to upload to Digitap'
      });
    }

    // Also upload to S3 for backup
    const s3Key = `bank-statements/${userId}/${application_id}/${Date.now()}_${req.file.originalname}`;
    await uploadToS3(req.file.buffer, s3Key, req.file.mimetype, false);
    const fileUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;

    // Store in database
    await executeQuery(
      `INSERT INTO digitap_bank_statements 
       (user_id, application_id, client_ref_num, mobile_number, bank_name, status, file_path, file_name, file_size, upload_method, created_at) 
       VALUES (?, ?, ?, ?, ?, 'processing', ?, ?, ?, 'manual', NOW())
       ON DUPLICATE KEY UPDATE 
       client_ref_num = VALUES(client_ref_num),
       file_path = VALUES(file_path), 
       file_name = VALUES(file_name), 
       file_size = VALUES(file_size), 
       upload_method = VALUES(upload_method),
       status = 'processing', 
       updated_at = NOW()`,
      [userId, application_id, clientRefNum, mobileNumber, bank_name || null, fileUrl, req.file.originalname, req.file.size]
    );

    res.json({
      success: true,
      message: 'Bank statement uploaded successfully and sent for analysis',
      data: {
        fileName: req.file.originalname,
        fileSize: req.file.size,
        clientRefNum: clientRefNum,
        status: digitapResult.data?.status || 'processing',
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
 * Get bank statement status for an application (from Digitap)
 */
router.get('/status/:applicationId', requireAuth, async (req, res) => {
  const { applicationId } = req.params;
  const userId = req.userId;

  try {
    await initializeDatabase();

    // Check Digitap bank statement status
    const statements = await executeQuery(
      `SELECT client_ref_num, status, file_name, report_data, created_at, updated_at 
       FROM digitap_bank_statements 
       WHERE user_id = ? AND application_id = ? 
       ORDER BY created_at DESC LIMIT 1`,
      [userId, applicationId]
    );

    if (statements.length === 0) {
      return res.json({
        success: true,
        data: {
          hasStatement: false,
          method: null,
          status: null
        }
      });
    }

    const statement = statements[0];

    // If we have a client_ref_num and status is processing, check with Digitap
    if (statement.client_ref_num && (statement.status === 'pending' || statement.status === 'processing')) {
      const digitapStatus = await checkBankStatementStatus(statement.client_ref_num);
      
      if (digitapStatus.success && digitapStatus.data) {
        // Update our database with latest status
        await executeQuery(
          `UPDATE digitap_bank_statements 
           SET status = ?, updated_at = NOW() 
           WHERE client_ref_num = ?`,
          [digitapStatus.data.status, statement.client_ref_num]
        );
        
        statement.status = digitapStatus.data.status;
      }
    }

    const hasStatement = statement.status === 'completed' || statement.status === 'ReportGenerated';

    res.json({
      success: true,
      data: {
        hasStatement,
        method: statement.upload_method || 'digitap',
        status: statement.status,
        clientRefNum: statement.client_ref_num,
        fileName: statement.file_name,
        hasReport: !!statement.report_data,
        createdAt: statement.created_at,
        updatedAt: statement.updated_at
      }
    });
  } catch (error) {
    console.error('Bank statement status check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check bank statement status'
    });
  }
});

/**
 * POST /api/aa/check-and-retrieve/:applicationId
 * Check status and retrieve report if ready
 */
router.post('/check-and-retrieve/:applicationId', requireAuth, async (req, res) => {
  const { applicationId } = req.params;
  const userId = req.userId;

  try {
    await initializeDatabase();

    // Get the bank statement record
    const statements = await executeQuery(
      `SELECT client_ref_num, status, report_data 
       FROM digitap_bank_statements 
       WHERE user_id = ? AND application_id = ? 
       ORDER BY created_at DESC LIMIT 1`,
      [userId, applicationId]
    );

    if (statements.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No bank statement found for this application'
      });
    }

    const statement = statements[0];

    // Check status with Digitap
    const statusResult = await checkBankStatementStatus(statement.client_ref_num);

    if (!statusResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to check status with Digitap'
      });
    }

    const currentStatus = statusResult.data.status;

    // Update status in database
    await executeQuery(
      `UPDATE digitap_bank_statements 
       SET status = ?, updated_at = NOW() 
       WHERE client_ref_num = ?`,
      [currentStatus, statement.client_ref_num]
    );

    // If report is ready, retrieve it
    if (currentStatus === 'ReportGenerated') {
      // Check if we already have the report
      if (statement.report_data) {
        return res.json({
          success: true,
          data: {
            status: currentStatus,
            report: JSON.parse(statement.report_data),
            cached: true
          }
        });
      }

      // Retrieve report from Digitap
      const reportResult = await retrieveBankStatementReport(statement.client_ref_num, 'json');

      if (!reportResult.success) {
        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve report from Digitap'
        });
      }

      // Save report to database
      await executeQuery(
        `UPDATE digitap_bank_statements 
         SET report_data = ?, status = 'completed', updated_at = NOW() 
         WHERE client_ref_num = ?`,
        [JSON.stringify(reportResult.data.report), statement.client_ref_num]
      );

      return res.json({
        success: true,
        data: {
          status: 'completed',
          report: reportResult.data.report,
          cached: false
        }
      });
    }

    // Report not ready yet
    res.json({
      success: true,
      data: {
        status: currentStatus,
        message: 'Report is being processed',
        report: null
      }
    });
  } catch (error) {
    console.error('Check and retrieve error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check and retrieve report'
    });
  }
});

/**
 * POST /api/aa/init-table
 * Initialize digitap_bank_statements table (one-time setup)
 */
router.post('/init-table', async (req, res) => {
  try {
    res.status(400).json({
      success: false,
      message: 'This endpoint is no longer available. Table schema should be managed separately.'
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Operation failed',
      error: error.message
    });
  }
});

/**
 * GET/POST /api/aa/webhook
 * Webhook endpoint for Digitap callbacks
 * Digitap will call this when bank statement processing is complete
 */
router.get('/webhook', async (req, res) => {
  await handleAAWebhook(req, res);
});

router.post('/webhook', async (req, res) => {
  await handleAAWebhook(req, res);
});

async function handleAAWebhook(req, res) {
  let processingError = null;
  
  try {
    // Log webhook payload to database FIRST
    await logWebhookPayload(req, 'aa_webhook', '/api/aa/webhook', false, null);
    
    const { client_ref_num, status, event_type } = req.body || req.query;

    console.log('📥 Digitap Webhook received:', { client_ref_num, status, event_type });

    await initializeDatabase();

    // Update status in database
    await executeQuery(
      `UPDATE digitap_bank_statements 
       SET status = ?, updated_at = NOW() 
       WHERE client_ref_num = ?`,
      [status, client_ref_num]
    );

    // If report is ready, fetch and store it
    if (status === 'ReportGenerated') {
      console.log('📊 Report ready, fetching from Digitap...');
      
      const reportResult = await retrieveBankStatementReport(client_ref_num, 'json');
      
      if (reportResult.success) {
        await executeQuery(
          `UPDATE digitap_bank_statements 
           SET report_data = ?, status = 'completed', updated_at = NOW() 
           WHERE client_ref_num = ?`,
          [JSON.stringify(reportResult.data.report), client_ref_num]
        );
        
        console.log('✅ Report saved to database');
      }
    }

    // Update webhook log as processed
    await logWebhookPayload(req, 'aa_webhook', '/api/aa/webhook', true, null);

    // Send success response to Digitap
    res.json({
      success: true,
      message: 'Webhook processed successfully'
    });
  } catch (error) {
    processingError = error.message || 'Unknown error';
    console.error('❌ Webhook processing error:', error);
    
    // Update webhook log with error
    await logWebhookPayload(req, 'aa_webhook', '/api/aa/webhook', false, processingError);
    
    res.status(500).json({
      success: false,
      message: 'Failed to process webhook'
    });
  }
}

module.exports = router;



