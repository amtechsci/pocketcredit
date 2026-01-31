const express = require('express');
const router = express.Router();
const multer = require('multer');
const { executeQuery, initializeDatabase } = require('../config/database');
const { requireAuth } = require('../middleware/jwtAuth');
const { authenticateAdmin } = require('../middleware/auth');
const { uploadToS3, getPresignedUrl } = require('../services/s3Service');
const {
  generateBankStatementURL,
  uploadBankStatementPDF,
  checkBankStatementStatus,
  retrieveBankStatementReport,
  generateClientRefNum
} = require('../services/digitapBankStatementService');
const { saveUserInfoFromBankAPI } = require('../services/userInfoService');

/**
 * Helper function to extract bank details from Digitap report data
 * Handles various JSON structures from Digitap API response
 */
async function extractAndSaveBankDetails(reportData, userId) {
  try {
    if (!reportData) {
      console.log('⚠️  No report data provided for bank details extraction');
      return { success: false, message: 'No report data' };
    }

    // Parse report data if it's a string
    let report = typeof reportData === 'string' ? JSON.parse(reportData) : reportData;

    // Try multiple possible paths for bank data
    let bankData = null;

    // Path 1: report.bankData or report.bank_data
    bankData = report.bankData || report.bank_data || report.bankInfo || report.bank_info;

    // Path 2: report.accountDetails or report.account_details
    if (!bankData) {
      bankData = report.accountDetails || report.account_details || report.accountInfo || report.account_info;
    }

    // Path 3: report.data.bankData or report.data.bank_data
    if (!bankData && report.data) {
      bankData = report.data.bankData || report.data.bank_data || report.data.accountDetails || report.data.account_details;
    }

    // Path 4: Direct account fields in report
    if (!bankData && (report.account_number || report.ifsc_code)) {
      bankData = report;
    }

    // Path 5: Check if report is an array and look in first element
    if (!bankData && Array.isArray(report) && report.length > 0) {
      bankData = report[0].bankData || report[0].bank_data || report[0].accountDetails || report[0].account_details || report[0];
    }

    // Path 6: Account Aggregator format (banks[0].accounts[0])
    if (!bankData && report.banks && Array.isArray(report.banks) && report.banks.length > 0) {
      const bank = report.banks[0];
      if (bank.accounts && Array.isArray(bank.accounts) && bank.accounts.length > 0) {
        bankData = bank.accounts[0];
      }
    }

    if (!bankData) {
      console.log('⚠️  Bank data not found in report structure');
      console.log('📋 Report keys:', Object.keys(report));
      return { success: false, message: 'Bank data not found in report' };
    }

    // Extract bank details with fallbacks
    const accountNumber = bankData.account_number || bankData.accountNumber || bankData.account_no || bankData.accountNo || null;
    const ifscCode = bankData.ifsc_code || bankData.ifscCode || bankData.ifsc || bankData.IFSC || null;
    const bankName = bankData.bank_name || bankData.bankName || bankData.bank || null;
    const accountHolderName = bankData.account_holder_name || bankData.accountHolderName || bankData.holder_name || bankData.holderName || bankData.name || null;
    const branchName = bankData.branch_name || bankData.branchName || bankData.branch || null;
    const accountType = bankData.account_type || bankData.accountType || bankData.type || null;

    // Validate required fields
    if (!accountNumber || !ifscCode) {
      console.log('⚠️  Missing required bank details (account_number or ifsc_code)');
      console.log('📋 Available fields:', Object.keys(bankData));
      return { success: false, message: 'Missing required bank details (account_number or ifsc_code)' };
    }

    // Validate IFSC code format
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(ifscCode.toUpperCase())) {
      console.log('⚠️  Invalid IFSC code format:', ifscCode);
      return { success: false, message: 'Invalid IFSC code format' };
    }

    // Get user details for account holder name if not provided
    let finalAccountHolderName = accountHolderName;
    if (!finalAccountHolderName) {
      const users = await executeQuery(
        'SELECT first_name, last_name FROM users WHERE id = ?',
        [userId]
      );
      if (users && users.length > 0) {
        finalAccountHolderName = `${users[0].first_name || ''} ${users[0].last_name || ''}`.trim();
      }
    }

    // Determine bank name from IFSC if not provided
    let finalBankName = bankName;
    if (!finalBankName) {
      const bankCode = ifscCode.substring(0, 4);
      const bankNames = {
        'SBIN': 'State Bank of India',
        'HDFC': 'HDFC Bank',
        'ICIC': 'ICICI Bank',
        'AXIS': 'Axis Bank',
        'KOTK': 'Kotak Mahindra Bank',
        'PNB': 'Punjab National Bank',
        'BOFA': 'Bank of America',
        'CITI': 'Citibank',
        'HSBC': 'HSBC Bank',
        'UBI': 'Union Bank of India',
        'BOI': 'Bank of India',
        'BOB': 'Bank of Baroda',
        'CANB': 'Canara Bank',
        'INDB': 'IndusInd Bank',
        'YESB': 'Yes Bank',
        'FDRL': 'Federal Bank',
        'IDFB': 'IDFC First Bank',
        'RATN': 'RBL Bank',
        'BAND': 'Bandhan Bank',
        'DCBL': 'DCB Bank'
      };
      finalBankName = bankNames[bankCode] || `${bankCode} Bank`;
    }

    // Check if bank details already exist for this user with same account number and IFSC
    const existingBankDetails = await executeQuery(
      'SELECT id FROM bank_details WHERE user_id = ? AND account_number = ? AND ifsc_code = ?',
      [userId, accountNumber, ifscCode.toUpperCase()]
    );

    let bankDetailsId;
    if (existingBankDetails && existingBankDetails.length > 0) {
      // Update existing bank details
      bankDetailsId = existingBankDetails[0].id;
      await executeQuery(
        `UPDATE bank_details 
         SET bank_name = ?, account_holder_name = ?, branch_name = ?, account_type = ?, updated_at = NOW()
         WHERE id = ?`,
        [finalBankName, finalAccountHolderName, branchName, accountType, bankDetailsId]
      );
      console.log(`✅ Updated existing bank details (ID: ${bankDetailsId}) for user ${userId}`);
    } else {
      // Insert new bank details
      const result = await executeQuery(
        `INSERT INTO bank_details 
         (user_id, account_number, ifsc_code, bank_name, account_holder_name, branch_name, account_type, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [userId, accountNumber, ifscCode.toUpperCase(), finalBankName, finalAccountHolderName, branchName, accountType]
      );
      bankDetailsId = result.insertId;
      console.log(`✅ Saved new bank details (ID: ${bankDetailsId}) for user ${userId}`);
    }

    return {
      success: true,
      message: 'Bank details extracted and saved successfully',
      data: {
        bank_details_id: bankDetailsId,
        account_number: accountNumber,
        ifsc_code: ifscCode.toUpperCase(),
        bank_name: finalBankName,
        account_holder_name: finalAccountHolderName
      }
    };

  } catch (error) {
    console.error('❌ Error extracting bank details:', error);
    console.error('   Error details:', error.message);
    return {
      success: false,
      message: 'Failed to extract bank details',
      error: error.message
    };
  }
}

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

    // For manual upload (statementupload), mobile number is optional
    // For online methods (accountaggregator, netbanking), mobile number is required
    const mobile_number = providedMobile || users[0].phone;

    if (destination !== 'statementupload') {
      // Online methods require mobile number
      if (!mobile_number) {
        return res.status(400).json({
          success: false,
          message: 'Mobile number is required for online verification'
        });
      }

      // Validate mobile number format
      if (!/^[6-9]\d{9}$/.test(mobile_number)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid mobile number format'
        });
      }
    } else {
      // For manual upload, use user's phone if available, but don't require it
      // Digitap may still need it for tracking, so we'll use user's phone if available
      if (!mobile_number) {
        console.warn('⚠️  No mobile number available for manual upload, using placeholder');
        // Use a placeholder - Digitap may handle this differently
      }
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

    // Determine URLs - prioritize environment variables, then use production URLs as default
    // Only use localhost if explicitly in development mode
    const isDevelopment = process.env.NODE_ENV === 'development' || (!process.env.NODE_ENV && !process.env.FRONTEND_URL);
    const frontendUrl = process.env.FRONTEND_URL || (isDevelopment ? 'http://localhost:3000' : 'https://pocketcredit.in');
    const apiUrl = process.env.APP_URL || (isDevelopment ? 'http://localhost:3002' : 'https://pocketcredit.in/api');

    // Return URL should point to backend first to log the callback, then redirect to frontend
    // Routes are mounted at /api/bank-statement, so paths are relative to that
    // apiUrl: production includes /api, development doesn't
    const returnUrl = isDevelopment ? `${apiUrl}/api/bank-statement/bank-data/success` : `${apiUrl}/api/bank-statement/bank-data/success`;
    const webhookUrl = isDevelopment ? `${apiUrl}/api/bank-statement/bank-data/webhook` : `${apiUrl}/api/bank-statement/bank-data/webhook`;

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
       upload_method = 'online',
       status = 'pending',
       updated_at = NOW()`,
      [userId, clientRefNum, result.data.request_id, mobile_number, bank_name || null, result.data.url, expiresAt]
    );

    // Save Account Aggregator linked mobile number to users table (only for accountaggregator method)
    if (selectedDestination === 'accountaggregator' && mobile_number) {
      await executeQuery(
        `UPDATE users 
         SET account_aggregator_mobile = ?, 
             updated_at = NOW() 
         WHERE id = ?`,
        [mobile_number, userId]
      );
      console.log(`✅ Saved Account Aggregator linked mobile number to users table: ${mobile_number}`);
    }

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
 * REFACTORED: User-only upload - no Digitap API calls
 * Verification is now admin-triggered only
 */
router.post('/upload-bank-statement', requireAuth, upload.single('statement'), async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;
    const { bank_name } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Check if user already has an uploaded bank statement
    const existing = await executeQuery(
      'SELECT id, status FROM user_bank_statements WHERE user_id = ?',
      [userId]
    );

    if (existing.length > 0 && existing[0].status === 'completed') {
      return res.json({
        success: false,
        message: 'Bank statement already uploaded and verified. Please contact support to update.'
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

    // Upload to S3
    // uploadToS3 signature: (fileBuffer, fileName, mimeType, options)
    // Options: { folder, userId, documentType, isPublic }
    const s3Result = await uploadToS3(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      {
        folder: 'user-bank-statements',
        userId: userId,
        documentType: 'statement',
        isPublic: false // Private file - will need presigned URL for access
      }
    );

    if (!s3Result || !s3Result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to upload file to storage'
      });
    }

    // Store S3 key in database (not presigned URL - URLs are too long and expire)
    // Presigned URLs will be generated on-demand when needed (e.g., in admin panel)
    const s3Key = s3Result.key;

    console.log(`✅ Bank statement uploaded: S3 Key: ${s3Key}`);

    // Store in database with status = 'completed' for manual uploads so step manager recognizes it as complete
    // No Digitap API calls - admin will trigger verification
    // Store S3 key in file_path (will be converted to presigned URL when needed)
    await executeQuery(
      `INSERT INTO user_bank_statements 
       (user_id, client_ref_num, mobile_number, bank_name, status, file_path, file_name, file_size, upload_method, created_at) 
       VALUES (?, ?, ?, ?, 'completed', ?, ?, ?, 'manual', NOW())
       ON DUPLICATE KEY UPDATE 
       client_ref_num = VALUES(client_ref_num),
       file_path = VALUES(file_path), 
       file_name = VALUES(file_name), 
       file_size = VALUES(file_size), 
       upload_method = VALUES(upload_method),
       status = 'completed',
       updated_at = NOW()`,
      [userId, clientRefNum, mobileNumber, bank_name || null, s3Key, req.file.originalname, req.file.size]
    );

    // Update loan application step to 'bank-details' if user has an active application
    // This marks bank-statement step as complete and allows user to proceed
    // IMPORTANT: This must complete before redirect to ensure step manager recognizes completion
    try {
      const applications = await executeQuery(
        `SELECT id, current_step, status FROM loan_applications 
         WHERE user_id = ? AND status IN ('pending', 'under_review', 'in_progress', 'submitted')
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );

      if (applications && applications.length > 0) {
        const application = applications[0];
        // Always update to 'bank-details' if we're at 'bank-statement' or earlier
        // This matches the Account Aggregator flow behavior
        if (!application.current_step ||
          application.current_step === 'bank-statement' ||
          application.current_step === 'employment-details' ||
          application.current_step === 'kyc-verification' ||
          application.current_step === 'application') {
          await executeQuery(
            `UPDATE loan_applications 
             SET current_step = 'bank-details', updated_at = NOW() 
             WHERE id = ?`,
            [application.id]
          );
          console.log(`✅ Updated loan application ${application.id} step from '${application.current_step}' to 'bank-details'`);

          // Step updated successfully - continue to send response
        } else {
          console.log(`ℹ️  Loan application ${application.id} already at step '${application.current_step}', no update needed`);
        }
      } else {
        console.log(`ℹ️  No active loan application found for user ${userId} to update step`);
      }
    } catch (stepUpdateError) {
      // Don't fail the upload if step update fails, but log it
      console.warn('⚠️  Could not update loan application step:', stepUpdateError.message);
    }

    // Get application ID if available for redirect (matching Account Aggregator flow)
    let applicationId = null;
    try {
      const apps = await executeQuery(
        `SELECT id FROM loan_applications 
         WHERE user_id = ? AND status IN ('pending', 'under_review', 'in_progress', 'submitted')
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );
      if (apps && apps.length > 0) {
        applicationId = apps[0].id;
      }
    } catch (e) {
      // Ignore error
    }

    res.json({
      success: true,
      message: 'Bank statement uploaded successfully. It will be reviewed by our team.',
      data: {
        fileName: req.file.originalname,
        fileSize: req.file.size,
        clientRefNum: clientRefNum,
        status: 'completed', // Set to 'completed' so step manager recognizes it (matches Account Aggregator flow)
        userStatus: 'uploaded',
        s3Uploaded: true,
        applicationId: applicationId // Include for redirect matching Account Aggregator flow
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
      `SELECT client_ref_num, request_id, txn_id, status, file_name, report_data, digitap_url, expires_at, transaction_data, upload_method, created_at, updated_at 
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
          status: null,
          userStatus: null
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
           WHERE request_id = ? OR client_ref_num = ?`,
          [newStatus, JSON.stringify(digitapStatus.data.txn_status), statement.request_id, statement.client_ref_num]
        );

        statement.status = newStatus;
        statement.transaction_data = digitapStatus.data.txn_status;
      }
    }

    // Bank statement is considered "has statement" if:
    // 1. status === 'completed' (online mode - Digitap verified or manual upload)
    // 2. upload_method === 'manual' (manual upload)
    const hasStatement = statement.status === 'completed' ||
      statement.upload_method === 'manual';
    let reportJustFetched = false;

    // Extract txn_id from transaction_data if not already in statement.txn_id
    let txnId = statement.txn_id;
    if (!txnId && statement.transaction_data) {
      try {
        const transactionData = typeof statement.transaction_data === 'string'
          ? JSON.parse(statement.transaction_data)
          : statement.transaction_data;

        if (transactionData && transactionData.txn_id) {
          txnId = transactionData.txn_id;
          console.log(`📊 Extracted txn_id from transaction_data: ${txnId}`);
        }
      } catch (e) {
        console.warn('Could not parse transaction_data to extract txn_id:', e.message);
      }
    }

    // Check if this is a manual upload - skip Digitap API calls for manual uploads
    const isManualUpload = statement.upload_method === 'manual';

    // If status is completed but report_data is empty, fetch it from Digitap
    // BUT skip this for manual uploads - they don't have Digitap transactions
    if (!isManualUpload &&
      ((hasStatement && !statement.report_data && (txnId || statement.client_ref_num)) ||
        (statement.status === 'completed' && !statement.report_data))) {
      console.log('📊 Status is completed but report_data is empty, fetching report from Digitap...');
      console.log(`📊 Using ${txnId ? `txn_id=${txnId}` : `client_ref_num=${statement.client_ref_num}`} to fetch report`);

      try {
        // Fetch report from Digitap - use txn_id if available, otherwise use client_ref_num
        // IMPORTANT: When using txn_id, do NOT send client_ref_num (API doesn't allow both)
        console.log(`📊 Attempting fetch with txnId: ${txnId}, clientRefNum: ${statement.client_ref_num}`);
        const reportResult = txnId
          ? await retrieveBankStatementReport(null, 'json', txnId)
          : await retrieveBankStatementReport(statement.client_ref_num, 'json');

        if (reportResult.success && reportResult.data && reportResult.data.report) {
          // Convert report to JSON string for storage
          const reportJsonString = typeof reportResult.data.report === 'string'
            ? reportResult.data.report
            : JSON.stringify(reportResult.data.report);

          console.log(`📊 Saving report to database, size: ${reportJsonString.length} characters`);

          // Save report to database
          await executeQuery(
            `UPDATE user_bank_statements 
             SET report_data = ?, status = 'completed', updated_at = NOW() 
             WHERE request_id = ?`,
            [reportJsonString, statement.request_id]
          );

          // Verify the save by checking the stored data length
          const verifyResult = await executeQuery(
            `SELECT LENGTH(report_data) as report_length FROM user_bank_statements WHERE request_id = ?`,
            [statement.request_id]
          );

          if (verifyResult && verifyResult[0]) {
            console.log(`✅ Report saved successfully, stored length: ${verifyResult[0].report_length} characters`);
          } else {
            console.warn('⚠️  Could not verify report save');
          }

          // Extract and save bank details from report
          try {
            const bankDetailsResult = await extractAndSaveBankDetails(reportResult.data.report, userId);
            if (bankDetailsResult.success) {
              console.log('✅ Bank details extracted and saved:', bankDetailsResult.data);
            } else {
              console.log('⚠️  Bank details extraction failed:', bankDetailsResult.message);
            }
          } catch (bankDetailsError) {
            console.error('❌ Error extracting bank details:', bankDetailsError);
            // Don't fail the request if bank details extraction fails
          }

          // Update statement object with fetched report
          statement.report_data = typeof reportResult.data.report === 'string'
            ? reportResult.data.report
            : JSON.stringify(reportResult.data.report);
          reportJustFetched = true;
        } else {
          console.log('⚠️  Report fetch failed:', reportResult.error || 'Unknown error');
        }
      } catch (fetchError) {
        console.error('❌ Error fetching report:', fetchError);
        // Continue with response even if fetch fails
      }
    } else if (isManualUpload) {
      // Manual upload - skip Digitap API call
      console.log('📊 Manual upload detected - skipping Digitap report fetch');
      console.log(`   Upload method: ${statement.upload_method}, Status: ${statement.status}`);
    }

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
        userStatus: statement.status, // Use status as userStatus
        verificationStatus: 'not_started', // Default verification status
        clientRefNum: statement.client_ref_num,
        requestId: statement.request_id,
        fileName: statement.file_name,
        hasReport: !!statement.report_data,
        reportJustFetched: reportJustFetched, // Flag to indicate report was just fetched
        isManualUpload: isManualUpload, // Flag to indicate manual upload (skip Digitap)
        uploadMethod: statement.upload_method || (isManualUpload ? 'manual' : 'online'),
        digitapUrl: statement.digitap_url,
        expiresAt: statement.expires_at,
        transactionData: transactionData,
        createdAt: statement.created_at,
        updatedAt: statement.updated_at
      }
    });
  } catch (error) {
    console.error('Bank statement status check error:', error);

    // If error is about missing column, table schema may be outdated
    if (error.message && error.message.includes('Unknown column')) {
      console.warn('⚠️  Table schema may be outdated');
      return res.json({
        success: true,
        data: {
          hasStatement: false,
          status: null,
          schemaOutdated: true
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
      `SELECT client_ref_num, txn_id, status, report_data, transaction_data, upload_method, file_path
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

    // Check if this is a manual upload
    // Manual uploads have: upload_method = 'manual' OR no client_ref_num
    const isManualUpload = statement.upload_method === 'manual' ||
      (!statement.client_ref_num && !statement.txn_id);

    // If it's a manual upload and we have report_data, return it
    if (isManualUpload) {
      if (statement.report_data) {
        console.log('📊 Manual upload detected - returning existing report_data');
        return res.json({
          success: true,
          data: {
            status: statement.status || 'completed',
            report: typeof statement.report_data === 'string'
              ? JSON.parse(statement.report_data)
              : statement.report_data,
            cached: true,
            isManualUpload: true
          }
        });
      } else {
        // Manual upload but no report_data - this shouldn't happen, but handle gracefully
        console.log('⚠️  Manual upload detected but no report_data found');
        return res.json({
          success: true,
          data: {
            status: statement.status || 'completed',
            report: null,
            message: 'Manual upload - report processing may be in progress',
            isManualUpload: true
          }
        });
      }
    }

    // Extract txn_id from transaction_data if not already in statement.txn_id
    let txnId = statement.txn_id;
    if (!txnId && statement.transaction_data) {
      try {
        const transactionData = typeof statement.transaction_data === 'string'
          ? JSON.parse(statement.transaction_data)
          : statement.transaction_data;

        if (transactionData && transactionData.txn_id) {
          txnId = transactionData.txn_id;
          console.log(`📊 Extracted txn_id from transaction_data: ${txnId}`);
        }
      } catch (e) {
        console.warn('Could not parse transaction_data to extract txn_id:', e.message);
      }
    }

    // Check status with Digitap (use request_id if available, otherwise client_ref_num)
    // Note: checkBankStatementStatus uses request_id, but we may not have it here
    // For now, we'll skip status check if we only have txn_id
    let statusResult = null;
    let currentStatus = statement.status;

    if (statement.client_ref_num) {
      // We need request_id for status check, but we can try with client_ref_num
      // Actually, checkBankStatementStatus expects request_id, so we'll skip this for now
      // and just use the stored status
    }

    // If report is ready, retrieve it
    if (currentStatus === 'completed' || currentStatus === 'ReportGenerated') {
      if (statement.report_data) {
        return res.json({
          success: true,
          data: {
            status: currentStatus,
            report: typeof statement.report_data === 'string'
              ? JSON.parse(statement.report_data)
              : statement.report_data,
            cached: true
          }
        });
      }

      // Only fetch from Digitap if we have a client_ref_num or txn_id
      if (!statement.client_ref_num && !txnId) {
        console.log('⚠️  No client_ref_num or txn_id - cannot fetch from Digitap');
        return res.status(400).json({
          success: false,
          message: 'No Digitap transaction found for this bank statement'
        });
      }

      // Fetch from Digitap - use txn_id if available, otherwise use client_ref_num
      // IMPORTANT: When using txn_id, do NOT send client_ref_num (API doesn't allow both)
      console.log(`📊 Fetching report using ${txnId ? `txn_id=${txnId}` : `client_ref_num=${statement.client_ref_num}`}`);
      const reportResult = txnId
        ? await retrieveBankStatementReport(null, 'json', txnId)
        : await retrieveBankStatementReport(statement.client_ref_num, 'json');

      if (!reportResult.success) {
        // If Digitap returns 403 (TxnNotFound), it means this is likely a manual upload
        // that was incorrectly marked as having a client_ref_num
        if (reportResult.error && reportResult.error.includes('TxnNotFound')) {
          console.log('⚠️  Digitap transaction not found - likely manual upload');
          return res.json({
            success: true,
            data: {
              status: currentStatus,
              report: statement.report_data ? (typeof statement.report_data === 'string' ? JSON.parse(statement.report_data) : statement.report_data) : null,
              message: 'Manual upload - no Digitap transaction',
              isManualUpload: true
            }
          });
        }

        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve report from Digitap'
        });
      }

      // Convert report to JSON string for storage
      const reportJsonString = typeof reportResult.data.report === 'string'
        ? reportResult.data.report
        : JSON.stringify(reportResult.data.report);

      console.log(`📊 Saving report to database, size: ${reportJsonString.length} characters`);

      // Save report
      await executeQuery(
        `UPDATE user_bank_statements 
         SET report_data = ?, status = 'completed', updated_at = NOW() 
         WHERE client_ref_num = ?`,
        [reportJsonString, statement.client_ref_num]
      );

      // Verify the save
      const verifyResult = await executeQuery(
        `SELECT LENGTH(report_data) as report_length FROM user_bank_statements WHERE client_ref_num = ?`,
        [statement.client_ref_num]
      );

      if (verifyResult && verifyResult[0]) {
        console.log(`✅ Report saved successfully, stored length: ${verifyResult[0].report_length} characters`);
      }

      // Extract and save user info from bank report
      try {
        const requestId = statement.client_ref_num || txnId;
        const userInfoResult = await saveUserInfoFromBankAPI(userId, reportResult.data.report, requestId);
        if (userInfoResult.success) {
          console.log(`✅ User info saved from Bank API: ${userInfoResult.action}`);
        }
      } catch (infoError) {
        console.error('❌ Error saving user info from Bank API:', infoError);
        // Don't fail the request if info extraction fails
      }

      // Extract and save bank details from report
      try {
        const bankDetailsResult = await extractAndSaveBankDetails(reportResult.data.report, userId);
        if (bankDetailsResult.success) {
          console.log('✅ Bank details extracted and saved:', bankDetailsResult.data);
        } else {
          console.log('⚠️  Bank details extraction failed:', bankDetailsResult.message);
        }
      } catch (bankDetailsError) {
        console.error('❌ Error extracting bank details:', bankDetailsError);
        // Don't fail the request if bank details extraction fails
      }

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
 * POST /api/user/extract-bank-details
 * Manually extract and save bank details from existing report_data
 * Useful for reprocessing reports or handling cases where extraction failed during webhook
 */
router.post('/extract-bank-details', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;

    // Get the latest bank statement with report_data
    const statements = await executeQuery(
      `SELECT id, user_id, report_data, status 
       FROM user_bank_statements 
       WHERE user_id = ? AND report_data IS NOT NULL AND status = 'completed'
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (statements.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No completed bank statement with report data found'
      });
    }

    const statement = statements[0];

    // Parse report_data
    let reportData;
    try {
      reportData = typeof statement.report_data === 'string'
        ? JSON.parse(statement.report_data)
        : statement.report_data;
    } catch (parseError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid report data format',
        error: parseError.message
      });
    }

    // Extract and save bank details
    const bankDetailsResult = await extractAndSaveBankDetails(reportData, userId);

    if (bankDetailsResult.success) {
      res.json({
        success: true,
        message: 'Bank details extracted and saved successfully',
        data: bankDetailsResult.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: bankDetailsResult.message || 'Failed to extract bank details',
        error: bankDetailsResult.error
      });
    }

  } catch (error) {
    console.error('Extract bank details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to extract bank details',
      error: error.message
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
 * GET/POST /api/bank-statement/bank-data/webhook
 * Webhook endpoint - Digitap calls this when transaction completes
 * Supports both GET (query params) and POST (body) requests
 */
router.get('/bank-data/webhook', async (req, res) => {
  // Handle GET request - log and process same as POST
  await handleBankDataWebhook(req, res);
});

router.post('/bank-data/webhook', async (req, res) => {
  // Handle POST request
  await handleBankDataWebhook(req, res);
});

async function handleBankDataWebhook(req, res) {
  let processingError = null;

  try {
    // Log webhook payload to database FIRST (before any processing)
    await logWebhookPayload(req, 'bank_data_webhook', '/api/bank-statement/bank-data/webhook', false, null);

    // Log full webhook payload for debugging
    console.log('📥 Digitap Webhook received - Full payload:', JSON.stringify(req.body, null, 2));

    const { request_id, txn_status, client_ref_num, status, code, client_ref_num: clientRefNum, txn_id } = req.body;

    // Handle different webhook formats
    const actualRequestId = request_id || req.body.requestId || req.body.request_id;
    const actualTxnStatus = txn_status || req.body.txn_status || req.body.transaction_status || req.body.data;
    const actualClientRefNum = client_ref_num || clientRefNum || req.body.client_ref_num;
    const actualCode = code || req.body.code;
    const actualStatus = status || req.body.status;
    const actualTxnId = txn_id || req.body.txn_id || req.body.txnId || null;

    console.log('📥 Parsed webhook data:', {
      request_id: actualRequestId,
      client_ref_num: actualClientRefNum,
      txn_id: actualTxnId,
      has_txn_status: !!actualTxnStatus
    });

    await initializeDatabase();

    if (!actualRequestId) {
      console.error('❌ Missing request_id in webhook payload');
      return res.status(400).json({
        success: false,
        message: 'Request ID is required'
      });
    }

    // Find the bank statement by request_id
    const statements = await executeQuery(
      'SELECT id, user_id, client_ref_num, txn_id FROM user_bank_statements WHERE request_id = ?',
      [actualRequestId]
    );

    if (statements.length === 0) {
      console.warn('⚠️  No bank statement found for request_id:', actualRequestId);
      return res.status(404).json({
        success: false,
        message: 'Bank statement record not found'
      });
    }

    const statement = statements[0];

    // Check if all transactions are completed
    let allCompleted = false;

    // Check for Digitap's "ReportGenerated" code format
    if (actualCode === 'ReportGenerated' && (actualStatus === 'Success' || actualStatus === 'success')) {
      allCompleted = true;
      console.log('✅ Report generated detected from code and status');
    }

    // Check transaction status array format
    if (!allCompleted && actualTxnStatus) {
      if (Array.isArray(actualTxnStatus)) {
        allCompleted = actualTxnStatus.every(txn => txn.status === 'Completed' || txn.status === 'completed');
      } else if (typeof actualTxnStatus === 'object' && actualTxnStatus.status) {
        // Handle single transaction object
        allCompleted = actualTxnStatus.status === 'Completed' || actualTxnStatus.status === 'completed';
      } else if (typeof actualTxnStatus === 'string' && (actualTxnStatus === 'Completed' || actualTxnStatus === 'completed')) {
        allCompleted = true;
      }
    }

    // Also check if status field indicates completion
    if (!allCompleted && (actualStatus === 'success' || actualStatus === 'Success' || actualStatus === 'completed' || actualStatus === 'Completed')) {
      allCompleted = true;
    }

    const newStatus = allCompleted ? 'completed' : 'InProgress';

    // Update database with transaction data and txn_id
    const updateFields = ['status = ?', 'transaction_data = ?'];
    const updateValues = [newStatus, JSON.stringify(actualTxnStatus || req.body)];

    // Add txn_id if provided
    if (actualTxnId) {
      updateFields.push('txn_id = ?');
      updateValues.push(actualTxnId);
    }

    updateFields.push('updated_at = NOW()');

    await executeQuery(
      `UPDATE user_bank_statements 
       SET ${updateFields.join(', ')} 
       WHERE request_id = ?`,
      [...updateValues, actualRequestId]
    );

    console.log(`✅ Bank statement updated: status = ${newStatus}, allCompleted = ${allCompleted}`);

    // If completed, automatically fetch and save the report
    if (allCompleted) {
      console.log('📊 All transactions completed, fetching report...');

      try {
        const clientRefNum = statement.client_ref_num || actualClientRefNum;
        const txnId = actualTxnId || statement.txn_id;

        // Priority: Use txn_id if available, otherwise use client_ref_num
        if (!txnId && !clientRefNum) {
          console.warn('⚠️  No txn_id or client_ref_num found, cannot fetch report');
        } else {
          // If we have "ReportGenerated" code, report is definitely ready - fetch directly
          if (actualCode === 'ReportGenerated') {
            console.log(`📥 ReportGenerated code detected - fetching report using ${txnId ? `txn_id=${txnId}` : `client_ref_num=${clientRefNum}`}`);

            // Use txn_id if available, otherwise use client_ref_num
            const reportResult = txnId
              ? await retrieveBankStatementReport(null, 'json', txnId)
              : await retrieveBankStatementReport(clientRefNum, 'json');

            console.log('📥 Report fetch result:', reportResult.success ? 'Success' : reportResult.error);

            if (reportResult.success && reportResult.data && reportResult.data.report) {
              // Convert report to JSON string for storage
              const reportJsonString = typeof reportResult.data.report === 'string'
                ? reportResult.data.report
                : JSON.stringify(reportResult.data.report);

              console.log(`📊 Saving report to database, size: ${reportJsonString.length} characters`);

              // Save report to database
              await executeQuery(
                `UPDATE user_bank_statements 
                 SET report_data = ?, status = 'completed', updated_at = NOW() 
                 WHERE request_id = ?`,
                [reportJsonString, actualRequestId]
              );

              // Verify the save by checking the stored data length
              const verifyResult = await executeQuery(
                `SELECT LENGTH(report_data) as report_length FROM user_bank_statements WHERE request_id = ?`,
                [actualRequestId]
              );

              if (verifyResult && verifyResult[0]) {
                console.log(`✅ Report saved successfully, stored length: ${verifyResult[0].report_length} characters`);
              } else {
                console.warn('⚠️  Could not verify report save');
              }

              // Extract and save bank details from report
              try {
                const bankDetailsResult = await extractAndSaveBankDetails(reportResult.data.report, statement.user_id);
                if (bankDetailsResult.success) {
                  console.log('✅ Bank details extracted and saved:', bankDetailsResult.data);
                } else {
                  console.log('⚠️  Bank details extraction failed:', bankDetailsResult.message);
                }
              } catch (bankDetailsError) {
                console.error('❌ Error extracting bank details:', bankDetailsError);
                // Don't fail the webhook if bank details extraction fails
              }
            } else {
              console.log('⚠️  Report fetch failed:', reportResult.error || 'Unknown error');
            }
          } else {
            // For other completion formats, check status first
            await new Promise(resolve => setTimeout(resolve, 3000));

            const statusResult = await checkBankStatementStatus(actualRequestId);

            console.log('📊 Status check result:', JSON.stringify(statusResult, null, 2));

            if (statusResult.success && (statusResult.data.overall_status === 'completed' || statusResult.data.is_complete)) {
              // Fetch the report - use txn_id if available, otherwise use client_ref_num
              console.log(`📥 Fetching report using ${txnId ? `txn_id=${txnId}` : `client_ref_num=${clientRefNum}`}`);

              const reportResult = txnId
                ? await retrieveBankStatementReport(null, 'json', txnId)
                : await retrieveBankStatementReport(clientRefNum, 'json');

              console.log('📥 Report fetch result:', reportResult.success ? 'Success' : reportResult.error);

              if (reportResult.success && reportResult.data && reportResult.data.report) {
                // Convert report to JSON string for storage
                const reportJsonString = typeof reportResult.data.report === 'string'
                  ? reportResult.data.report
                  : JSON.stringify(reportResult.data.report);

                console.log(`📊 Saving report to database, size: ${reportJsonString.length} characters`);

                // Save report to database
                await executeQuery(
                  `UPDATE user_bank_statements 
                   SET report_data = ?, status = 'completed', updated_at = NOW() 
                   WHERE request_id = ?`,
                  [reportJsonString, actualRequestId]
                );

                // Verify the save
                const verifyResult = await executeQuery(
                  `SELECT LENGTH(report_data) as report_length FROM user_bank_statements WHERE request_id = ?`,
                  [actualRequestId]
                );

                if (verifyResult && verifyResult[0]) {
                  console.log(`✅ Report saved successfully, stored length: ${verifyResult[0].report_length} characters`);
                } else {
                  console.warn('⚠️  Could not verify report save');
                }

                // Extract and save bank details from report
                try {
                  const bankDetailsResult = await extractAndSaveBankDetails(reportResult.data.report, statement.user_id);
                  if (bankDetailsResult.success) {
                    console.log('✅ Bank details extracted and saved:', bankDetailsResult.data);
                  } else {
                    console.log('⚠️  Bank details extraction failed:', bankDetailsResult.message);
                  }
                } catch (bankDetailsError) {
                  console.error('❌ Error extracting bank details:', bankDetailsError);
                  // Don't fail the webhook if bank details extraction fails
                }
              } else {
                console.log('⚠️  Report not ready yet or fetch failed:', reportResult.error || 'Unknown error');
              }
            } else {
              console.log('⚠️  Status check indicates report not ready yet. Status:', statusResult.data?.overall_status);
            }
          }
        }
      } catch (reportError) {
        console.error('❌ Error fetching report in webhook:', reportError);
        console.error('   Error details:', reportError.message);
        // Don't fail the webhook if report fetch fails - it can be fetched later
      }
    }

    // Update webhook log as processed
    await logWebhookPayload(req, 'bank_data_webhook', '/api/bank-statement/bank-data/webhook', true, null);

    res.json({
      success: true,
      message: 'Webhook processed successfully'
    });
  } catch (error) {
    processingError = error.message || 'Unknown error';
    console.error('❌ Webhook processing error:', error);

    // Update webhook log with error
    await logWebhookPayload(req, 'bank_data_webhook', '/api/bank-statement/bank-data/webhook', false, processingError);

    res.status(500).json({
      success: false,
      message: 'Failed to process webhook'
    });
  }
}

/**
 * GET /api/bank-statement/bank-data/success
 * Return URL endpoint - User lands here after completing on Digitap
 * This endpoint logs all query parameters and then redirects to frontend
 */
router.get('/bank-data/success', async (req, res) => {
  let processingError = null;

  try {
    // Log the success callback FIRST with all query parameters
    console.log('📥 Return URL callback received - Full query:', JSON.stringify(req.query, null, 2));
    console.log('📥 Return URL callback received - Full URL:', req.url);

    await logWebhookPayload(req, 'bank_data_success', '/api/bank-statement/bank-data/success', false, null);

    await initializeDatabase();

    // Try to extract and save any data from query parameters
    const { request_id, client_ref_num, status, txnId, success } = req.query;

    // Check if this is a cancellation (not an actual failure)
    const isCancellation = status === 'cancelled' || status === 'Cancelled' ||
      success === 'false' || req.query.error === 'true' ||
      req.query.cancelled === 'true';

    // If we have request_id or client_ref_num, try to update the bank statement record
    if (request_id || client_ref_num) {
      try {
        const updateFields = [];
        const updateValues = [];

        // Only update status if it's not a cancellation
        // For cancellations, keep status as 'InProgress' or 'pending' so user can retry
        if (status && !isCancellation) {
          // Don't update to 'failed' if it's a cancellation - keep it as InProgress
          if (status !== 'failed' && status !== 'Failed' && status !== 'cancelled' && status !== 'Cancelled') {
            updateFields.push('status = ?');
            updateValues.push(status);
          }
        } else if (isCancellation) {
          // For cancellations, set status to 'pending' so user can retry (not 'failed')
          updateFields.push('status = ?');
          updateValues.push('pending');
          console.log('🔄 User cancelled - setting status to pending (not failed)');
        }

        if (request_id) {
          updateFields.push('request_id = ?');
          updateValues.push(request_id);
        }

        if (updateFields.length > 0) {
          updateFields.push('updated_at = NOW()');
          const whereClause = request_id ? 'WHERE request_id = ?' : 'WHERE client_ref_num = ?';
          const whereValue = request_id || client_ref_num;

          await executeQuery(
            `UPDATE user_bank_statements 
             SET ${updateFields.join(', ')} 
             ${whereClause}`,
            [...updateValues, whereValue]
          );

          console.log(`✅ Updated bank statement record: ${whereClause} = ${whereValue}`);
        }
      } catch (updateError) {
        console.error('⚠️  Error updating bank statement from return URL:', updateError);
        // Don't fail the redirect if update fails
      }
    }

    // Mark webhook as processed
    await logWebhookPayload(req, 'bank_data_success', '/api/bank-statement/bank-data/success', true, null);

    // Redirect to frontend success page with all query parameters preserved
    const isDevelopment = process.env.NODE_ENV === 'development' || (!process.env.NODE_ENV && !process.env.FRONTEND_URL);
    const frontendUrl = process.env.FRONTEND_URL || (isDevelopment ? 'http://localhost:3000' : 'https://pocketcredit.in');
    const queryString = new URLSearchParams(req.query).toString();
    const redirectUrl = `${frontendUrl}/bank-statement-success?${queryString}&complete=true`;

    console.log(`🔄 Redirecting to frontend: ${redirectUrl}`);
    res.redirect(redirectUrl);

  } catch (error) {
    processingError = error.message || 'Unknown error';
    console.error('❌ Return URL error:', error);

    // Log the error
    await logWebhookPayload(req, 'bank_data_success', '/api/bank-statement/bank-data/success', false, processingError);

    const isDevelopment = process.env.NODE_ENV === 'development' || (!process.env.NODE_ENV && !process.env.FRONTEND_URL);
    const frontendUrl = process.env.FRONTEND_URL || (isDevelopment ? 'http://localhost:3000' : 'https://pocketcredit.in');
    const queryString = new URLSearchParams(req.query).toString();
    res.redirect(`${frontendUrl}/bank-statement-success?${queryString}&error=true`);
  }
});

/**
 * POST /api/user/init-bank-statement-table
 * Initialize user_bank_statements table (one-time setup)
 * DEPRECATED: Table schema should be managed separately
 */
router.post('/init-bank-statement-table', async (req, res) => {
  res.status(400).json({
    success: false,
    message: 'This endpoint is no longer available. Table schema should be managed separately.'
  });
});

/**
 * POST /api/bank-statement/download-excel
 * Admin endpoint to download Excel report from Digitap
 * Requires txn_id in request body
 */
router.post('/download-excel', authenticateAdmin, async (req, res) => {
  try {
    const { txn_id } = req.body;

    if (!txn_id) {
      return res.status(400).json({
        success: false,
        message: 'Transaction ID (txn_id) is required'
      });
    }

    console.log(`📥 Admin requesting Excel download for txn_id: ${txn_id}`);

    // Call Digitap API to retrieve Excel report
    const result = await retrieveBankStatementReport(null, 'xlsx', txn_id);

    if (!result.success) {
      console.error('❌ Failed to retrieve Excel report:', result.error);
      return res.status(500).json({
        success: false,
        message: result.error || 'Failed to retrieve Excel report from Digitap'
      });
    }

    // Check if we got binary data (Excel file)
    if (result.data && result.data.report) {
      const excelData = result.data.report;

      // If it's a Buffer or binary data, send it directly
      if (Buffer.isBuffer(excelData) || typeof excelData === 'string') {
        const buffer = Buffer.isBuffer(excelData) ? excelData : Buffer.from(excelData, 'base64');

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="bank_statement_${txn_id}.xlsx"`);
        res.send(buffer);
        return;
      }
    }

    // If we get here, the response format is unexpected
    console.error('❌ Unexpected response format from Digitap');
    return res.status(500).json({
      success: false,
      message: 'Unexpected response format from Digitap API'
    });

  } catch (error) {
    console.error('❌ Excel download error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download Excel report',
      error: error.message
    });
  }
});

module.exports = router;


