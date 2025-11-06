const express = require('express');
const router = express.Router();
const multer = require('multer');
const { executeQuery, initializeDatabase } = require('../config/database');
const { requireAuth } = require('../middleware/jwtAuth');
const { uploadToS3 } = require('../services/s3Service');
const {
  generateBankStatementURL,
  uploadBankStatementPDF,
  checkBankStatementStatus,
  retrieveBankStatementReport,
  generateClientRefNum
} = require('../services/digitapBankStatementService');

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
 * POST /api/user/initiate-bank-statement
 * Initiate bank statement collection for user profile (one-time)
 */
router.post('/initiate-bank-statement', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;
    const { mobile_number: providedMobile, bank_name, destination } = req.body;

    // Get user's mobile number from profile if not provided
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

    const mobile_number = providedMobile || users[0].phone;

    if (!mobile_number) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number is required'
      });
    }

    // Validate mobile number
    if (!/^[6-9]\d{9}$/.test(mobile_number)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid mobile number format'
      });
    }

    // Validate destination
    const validDestinations = ['netbanking', 'accountaggregator', 'statementupload'];
    const selectedDestination = destination || 'accountaggregator';
    
    if (!validDestinations.includes(selectedDestination)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid destination. Must be: netbanking, accountaggregator, or statementupload'
      });
    }

    // Check if user already has a bank statement
    const existing = await executeQuery(
      'SELECT id, status FROM user_bank_statements WHERE user_id = ?',
      [userId]
    );

    console.log('Existing bank statement check:', existing);

    if (existing.length > 0 && existing[0].status === 'completed') {
      console.log('⚠️  User already has completed bank statement');
      return res.status(400).json({
        success: false,
        message: 'Bank statement already uploaded. Please contact support to update.',
        existing_status: existing[0].status
      });
    }

    // If existing but not completed, we can regenerate URL
    if (existing.length > 0) {
      console.log(`ℹ️  User has existing bank statement with status: ${existing[0].status}, regenerating URL...`);
    }

    const clientRefNum = generateClientRefNum(userId, 0); // 0 for user-level
    
    // Use localhost for development
    const isDev = process.env.NODE_ENV !== 'production';
    const frontendUrl = isDev ? 'http://localhost:3000' : (process.env.FRONTEND_URL || 'https://pocketcredit.in');
    const apiUrl = isDev ? 'http://localhost:3002' : (process.env.APP_URL || 'https://api.pocketcredit.in');
    
    const returnUrl = `${frontendUrl}/bank-statement-success?complete=true`;
    const webhookUrl = `${apiUrl}/api/user/bank-data/webhook`;
    
    console.log('🔗 URLs configured:');
    console.log('   Return URL:', returnUrl);
    console.log('   Webhook URL:', webhookUrl);

    // Calculate date range (last 6 months)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6);
    
    // Format dates as YYYY-MM-DD
    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);

    // Generate Digitap URL with selected destination
    console.log(`🔄 Calling Digitap Generate URL API (destination: ${selectedDestination})...`);
    const result = await generateBankStatementURL({
      client_ref_num: clientRefNum,
      return_url: returnUrl,
      txn_completed_cburl: webhookUrl,
      mobile_num: mobile_number,
      start_date: startDateStr,
      end_date: endDateStr,
      destination: selectedDestination
    });

    console.log('Digitap result:', result);

    if (!result.success) {
      console.error('❌ Digitap Generate URL failed:', result.error);
      console.log('⚠️  Note: Bank Statement API may require production Digitap credentials');
      console.log('⚠️  Demo credentials only support mobile_prefill (credit check) API');
      
      return res.status(503).json({
        success: false,
        message: 'Bank Statement API unavailable with demo credentials. Please use Manual Upload option.',
        error: result.error,
        suggestion: 'Switch to Manual Upload tab to upload your PDF directly',
        demo_mode: true
      });
    }

    // Convert expires string to MySQL TIMESTAMP
    // Digitap returns "expires" not "expiry_time"
    let expiresAt = null;
    const expiryTime = result.data.expiry_time || result.data.expires;
    if (expiryTime) {
      expiresAt = new Date(expiryTime);
    }

    // Store in database with request_id and expires_at
    await executeQuery(
      `INSERT INTO user_bank_statements 
       (user_id, client_ref_num, request_id, mobile_number, bank_name, status, digitap_url, expires_at, upload_method, created_at) 
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, 'online', NOW())
       ON DUPLICATE KEY UPDATE 
       client_ref_num = VALUES(client_ref_num),
       request_id = VALUES(request_id),
       digitap_url = VALUES(digitap_url),
       expires_at = VALUES(expires_at),
       status = 'pending',
       updated_at = NOW()`,
      [userId, clientRefNum, result.data.request_id, mobile_number, bank_name || null, result.data.url, expiresAt]
    );

    console.log('✅ Digitap URL generated and stored:', result.data.url);
    console.log('   Request ID:', result.data.request_id);
    console.log('   Expires:', expiryTime);

    res.json({
      success: true,
      data: {
        digitapUrl: result.data.url,
        clientRefNum: clientRefNum,
        requestId: result.data.request_id,
        expiryTime: expiryTime
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
 * POST /api/user/upload-bank-statement
 * Upload bank statement PDF for user profile (one-time)
 */
router.post('/upload-bank-statement', requireAuth, upload.single('statement'), async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;
    const { bank_name, password } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Check if user already has a completed bank statement
    const existing = await executeQuery(
      'SELECT id, status FROM user_bank_statements WHERE user_id = ?',
      [userId]
    );

    if (existing.length > 0 && existing[0].status === 'completed') {
      return res.json({
        success: false,
        message: 'Bank statement already uploaded. Please contact support to update.'
      });
    }

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
    const clientRefNum = generateClientRefNum(userId, 0);

    // Upload to S3 first
    const s3Key = `user-bank-statements/${userId}/${Date.now()}_${req.file.originalname}`;
    const s3Result = await uploadToS3(req.file.buffer, s3Key, req.file.mimetype, false);
    
    let fileUrl = null;
    if (s3Result.success) {
      fileUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
    }

    // Try to upload to Digitap for analysis (optional - fallback if fails)
    let digitapStatus = 'completed'; // Default to completed if Digitap not available
    let useDigitapAnalysis = false;

    try {
      console.log('📤 Attempting to upload to Digitap for analysis...');
      const digitapResult = await uploadBankStatementPDF({
        mobile_no: mobileNumber,
        client_ref_num: clientRefNum,
        file_buffer: req.file.buffer,
        file_name: req.file.originalname,
        bank_name: bank_name || null,
        password: password || null
      });

      if (digitapResult.success) {
        console.log('✅ Digitap upload successful');
        digitapStatus = digitapResult.data?.status || 'processing';
        useDigitapAnalysis = true;
      } else {
        console.log('⚠️  Digitap upload failed, saving without analysis:', digitapResult.error);
      }
    } catch (digitapError) {
      console.log('⚠️  Digitap not available (demo credentials), saving file only');
    }

    // Store in database
    await executeQuery(
      `INSERT INTO user_bank_statements 
       (user_id, client_ref_num, mobile_number, bank_name, status, file_path, file_name, file_size, upload_method, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual', NOW())
       ON DUPLICATE KEY UPDATE 
       client_ref_num = VALUES(client_ref_num),
       file_path = VALUES(file_path), 
       file_name = VALUES(file_name), 
       file_size = VALUES(file_size), 
       status = VALUES(status), 
       updated_at = NOW()`,
      [userId, clientRefNum, mobileNumber, bank_name || null, digitapStatus, fileUrl, req.file.originalname, req.file.size]
    );

    res.json({
      success: true,
      message: useDigitapAnalysis 
        ? 'Bank statement uploaded successfully and sent for analysis'
        : 'Bank statement uploaded successfully',
      data: {
        fileName: req.file.originalname,
        fileSize: req.file.size,
        clientRefNum: clientRefNum,
        status: digitapStatus,
        hasDigitapAnalysis: useDigitapAnalysis,
        s3Uploaded: s3Result.success
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
 * GET /api/user/bank-statement-status
 * Get user's bank statement status
 */
router.get('/bank-statement-status', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;

    // Check if table exists first
    const tables = await executeQuery(`SHOW TABLES LIKE 'user_bank_statements'`);
    
    if (!tables || tables.length === 0) {
      // Table doesn't exist yet
      return res.json({
        success: true,
        data: {
          hasStatement: false,
          status: null
        }
      });
    }

    const statements = await executeQuery(
      `SELECT client_ref_num, request_id, status, file_name, report_data, digitap_url, expires_at, transaction_data, created_at, updated_at 
       FROM user_bank_statements 
       WHERE user_id = ? 
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (statements.length === 0) {
      return res.json({
        success: true,
        data: {
          hasStatement: false,
          status: null
        }
      });
    }

    const statement = statements[0];

    // If status is pending/InProgress and we have request_id, check with Digitap
    if (statement.request_id && (statement.status === 'pending' || statement.status === 'InProgress')) {
      const digitapStatus = await checkBankStatementStatus(statement.request_id);
      
      if (digitapStatus.success && digitapStatus.data) {
        const newStatus = digitapStatus.data.overall_status;
        
        await executeQuery(
          `UPDATE user_bank_statements 
           SET status = ?, transaction_data = ?, updated_at = NOW() 
           WHERE request_id = ?`,
          [newStatus, JSON.stringify(digitapStatus.data.txn_status), statement.request_id]
        );
        
        statement.status = newStatus;
        statement.transaction_data = digitapStatus.data.txn_status;
      }
    }

    const hasStatement = statement.status === 'completed';

    // Parse transaction_data safely (might be string or object)
    let transactionData = null;
    if (statement.transaction_data) {
      try {
        transactionData = typeof statement.transaction_data === 'string' 
          ? JSON.parse(statement.transaction_data) 
          : statement.transaction_data;
      } catch (e) {
        console.warn('Could not parse transaction_data:', e.message);
        transactionData = null;
      }
    }

    res.json({
      success: true,
      data: {
        hasStatement,
        status: statement.status,
        clientRefNum: statement.client_ref_num,
        requestId: statement.request_id,
        fileName: statement.file_name,
        hasReport: !!statement.report_data,
        digitapUrl: statement.digitap_url,
        expiresAt: statement.expires_at,
        transactionData: transactionData,
        createdAt: statement.created_at,
        updatedAt: statement.updated_at
      }
    });
  } catch (error) {
    console.error('Bank statement status check error:', error);
    
    // If error is about missing column, table needs migration
    if (error.message && error.message.includes('Unknown column')) {
      console.warn('⚠️  Table schema is outdated, needs migration');
      return res.json({
        success: true,
        data: {
          hasStatement: false,
          status: null,
          needsMigration: true
        }
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to check bank statement status'
    });
  }
});

/**
 * POST /api/user/fetch-bank-report
 * Fetch analyzed bank statement report for user
 */
router.post('/fetch-bank-report', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;

    const statements = await executeQuery(
      `SELECT client_ref_num, status, report_data 
       FROM user_bank_statements 
       WHERE user_id = ? 
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (statements.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No bank statement found'
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

    // Update status
    await executeQuery(
      `UPDATE user_bank_statements 
       SET status = ?, updated_at = NOW() 
       WHERE client_ref_num = ?`,
      [currentStatus, statement.client_ref_num]
    );

    // If report is ready, retrieve it
    if (currentStatus === 'ReportGenerated') {
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

      // Fetch from Digitap
      const reportResult = await retrieveBankStatementReport(statement.client_ref_num, 'json');

      if (!reportResult.success) {
        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve report from Digitap'
        });
      }

      // Save report
      await executeQuery(
        `UPDATE user_bank_statements 
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

    // Report not ready
    res.json({
      success: true,
      data: {
        status: currentStatus,
        message: 'Report is being processed',
        report: null
      }
    });
  } catch (error) {
    console.error('Fetch report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch report'
    });
  }
});

/**
 * POST /api/user/delete-pending-bank-statement
 * Delete pending/incomplete bank statement upload
 */
router.post('/delete-pending-bank-statement', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;

    // Delete only if status is not 'completed'
    await executeQuery(
      `DELETE FROM user_bank_statements 
       WHERE user_id = ? AND status != 'completed'`,
      [userId]
    );

    console.log(`✅ Deleted pending bank statement for user ${userId}`);

    res.json({
      success: true,
      message: 'Pending upload deleted successfully'
    });
  } catch (error) {
    console.error('Delete pending upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete pending upload'
    });
  }
});

/**
 * POST /api/user/bank-data/webhook
 * Webhook endpoint - Digitap calls this when transaction completes
 */
router.post('/bank-data/webhook', async (req, res) => {
  try {
    const { request_id, txn_status, client_ref_num } = req.body;

    console.log('📥 Digitap Webhook received:', { request_id, client_ref_num });
    console.log('   Transaction status:', JSON.stringify(txn_status, null, 2));

    await initializeDatabase();

    if (!request_id) {
      return res.status(400).json({
        success: false,
        message: 'Request ID is required'
      });
    }

    // Find the bank statement by request_id
    const statements = await executeQuery(
      'SELECT id, user_id FROM user_bank_statements WHERE request_id = ?',
      [request_id]
    );

    if (statements.length === 0) {
      console.warn('⚠️  No bank statement found for request_id:', request_id);
      return res.status(404).json({
        success: false,
        message: 'Bank statement record not found'
      });
    }

    const statement = statements[0];

    // Check if all transactions are completed
    const allCompleted = txn_status.every(txn => txn.status === 'Completed');
    const newStatus = allCompleted ? 'completed' : 'InProgress';

    // Update database with transaction data
    await executeQuery(
      `UPDATE user_bank_statements 
       SET status = ?, 
           transaction_data = ?, 
           updated_at = NOW() 
       WHERE request_id = ?`,
      [newStatus, JSON.stringify(txn_status), request_id]
    );

    console.log(`✅ Bank statement updated: status = ${newStatus}`);

    // If completed, try to fetch the report
    if (allCompleted) {
      console.log('📊 All transactions completed, can fetch report later');
      // Note: Report fetching will be done separately via another API call
    }

    res.json({
      success: true,
      message: 'Webhook processed successfully'
    });
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process webhook'
    });
  }
});

/**
 * GET /api/user/bank-data/success
 * Return URL endpoint - User lands here after completing on Digitap
 */
router.get('/bank-data/success', async (req, res) => {
  try {
    await initializeDatabase();
    
    // Get user ID from session/JWT (if available)
    // For now, redirect to frontend success page
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/bank-statement-success?complete=true`);
  } catch (error) {
    console.error('Return URL error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/bank-statement-success?error=true`);
  }
});

/**
 * POST /api/user/init-bank-statement-table
 * Initialize user_bank_statements table (one-time setup)
 */
router.post('/init-bank-statement-table', async (req, res) => {
  try {
    await initializeDatabase();

    // Check if table exists
    const tables = await executeQuery(`SHOW TABLES LIKE 'user_bank_statements'`);
    
    if (tables && tables.length > 0) {
      // Table exists, add new columns if missing
      console.log('Table exists, checking for new columns...');
      
      const columnsToAdd = [
        { name: 'request_id', definition: 'INT DEFAULT NULL AFTER client_ref_num' },
        { name: 'expires_at', definition: 'TIMESTAMP DEFAULT NULL AFTER digitap_url' },
        { name: 'transaction_data', definition: 'JSON DEFAULT NULL AFTER status' }
      ];

      for (const col of columnsToAdd) {
        try {
          await executeQuery(`ALTER TABLE user_bank_statements ADD COLUMN ${col.name} ${col.definition}`);
          console.log(`✅ Added column: ${col.name}`);
        } catch (err) {
          if (err.message && err.message.includes('Duplicate column')) {
            console.log(`   Column ${col.name} already exists`);
          } else {
            throw err;
          }
        }
      }

      // Add index for request_id if doesn't exist
      try {
        await executeQuery(`ALTER TABLE user_bank_statements ADD INDEX idx_request_id (request_id)`);
        console.log('✅ Added index: idx_request_id');
      } catch (err) {
        if (err.message && err.message.includes('Duplicate key')) {
          console.log('   Index idx_request_id already exists');
        }
      }

      // Update status enum to include 'InProgress'
      try {
        await executeQuery(`ALTER TABLE user_bank_statements MODIFY status ENUM('pending', 'processing', 'completed', 'failed', 'InProgress') DEFAULT 'pending'`);
        console.log('✅ Updated status enum');
      } catch (err) {
        console.log('   Status enum already updated or error:', err.message);
      }

      return res.json({
        success: true,
        message: 'user_bank_statements table updated with new columns'
      });
    }

    // Create table for user-level bank statements (not per-application)
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS user_bank_statements (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL UNIQUE,
        client_ref_num VARCHAR(255) NOT NULL UNIQUE,
        request_id INT DEFAULT NULL,
        mobile_number VARCHAR(15) NOT NULL,
        bank_name VARCHAR(100) DEFAULT NULL,
        upload_method ENUM('online', 'manual', 'aa') DEFAULT 'online',
        file_path VARCHAR(500) DEFAULT NULL,
        file_name VARCHAR(255) DEFAULT NULL,
        file_size INT DEFAULT NULL,
        digitap_url TEXT DEFAULT NULL,
        expires_at TIMESTAMP DEFAULT NULL,
        status ENUM('pending', 'processing', 'completed', 'failed', 'InProgress') DEFAULT 'pending',
        transaction_data JSON DEFAULT NULL,
        report_data LONGTEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_request_id (request_id),
        INDEX idx_client_ref_num (client_ref_num),
        INDEX idx_status (status),
        INDEX idx_expires_at (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='Stores user bank statements - one per user (profile level)'
    `);

    res.json({
      success: true,
      message: 'user_bank_statements table created successfully'
    });
  } catch (error) {
    console.error('Table creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create table',
      error: error.message
    });
  }
});

module.exports = router;


