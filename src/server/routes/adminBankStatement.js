const express = require('express');
const router = express.Router();
const { executeQuery, initializeDatabase } = require('../config/database');
const { authenticateAdmin } = require('../middleware/auth');
const {
  uploadBankStatementPDF,
  checkBankStatementStatus,
  retrieveBankStatementReport,
  generateClientRefNum,
  generateBankStatementURL,
  startUploadAPI,
  uploadStatementAPI,
  getInstitutionList,
  completeUploadAPI
} = require('../services/digitapBankStatementService');
const { getPresignedUrl, downloadFromS3 } = require('../services/s3Service');
const { logActivity } = require('../middleware/activityLogger');

/**
 * GET /api/admin/bank-statement/:userId
 * Get all bank statement details for a user (admin only)
 * Returns all statements in a list for table display
 */
router.get('/:userId', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { userId } = req.params;
    const adminId = req.admin?.id;

    // Convert userId to integer for proper comparison
    const userIdInt = parseInt(userId, 10);
    if (isNaN(userIdInt)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    console.log(`📋 Fetching bank statements for user_id: ${userIdInt}`);

    // Get ALL bank statements for this user
    const statements = await executeQuery(
      `SELECT 
        id, user_id, client_ref_num, request_id, txn_id, mobile_number, bank_name,
        upload_method, file_path, file_name, file_size, status, user_status, 
        verification_status, verified_by, verified_at, verification_decision, verification_notes,
        report_data, transaction_data, created_at, updated_at
       FROM user_bank_statements 
       WHERE user_id = ? 
       ORDER BY created_at DESC`,
      [userIdInt]
    );

    console.log(`📋 Found ${statements.length} bank statement(s) for user ${userIdInt}`);

    // Additional safety check: verify all statements belong to the requested user
    const invalidStatements = statements.filter(s => s.user_id !== userIdInt);
    if (invalidStatements.length > 0) {
      console.error(`⚠️  Security: Some statements don't match requested userId (${userIdInt})`);
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (statements.length === 0) {
      console.log(`📋 No bank statements found for user ${userIdInt}`);
      return res.json({
        status: 'success',
        success: true,
        data: {
          hasStatement: false,
          statements: [],
          statement: null // Keep for backward compatibility
        }
      });
    }

    console.log(`📋 Processing ${statements.length} statement(s) for user ${userIdInt}`);

    // Process all statements
    const processedStatements = await Promise.all(statements.map(async (statement) => {
      // Parse report_data if it exists
      let reportData = null;
      if (statement.report_data) {
        try {
          reportData = typeof statement.report_data === 'string'
            ? JSON.parse(statement.report_data)
            : statement.report_data;
        } catch (e) {
          console.warn('Could not parse report_data:', e.message);
        }
      }

      // Parse transaction_data if it exists
      let transactionData = null;
      if (statement.transaction_data) {
        try {
          transactionData = typeof statement.transaction_data === 'string'
            ? JSON.parse(statement.transaction_data)
            : statement.transaction_data;
        } catch (e) {
          console.warn('Could not parse transaction_data:', e.message);
        }
      }

      // Generate presigned URL if file_path is an S3 key (not already a URL)
      let fileUrl = statement.file_path;
      if (statement.file_path && !statement.file_path.startsWith('http')) {
        try {
          fileUrl = await getPresignedUrl(statement.file_path, 3600);
        } catch (error) {
          console.error('Failed to generate presigned URL:', error);
          fileUrl = statement.file_path;
        }
      }

      return {
        ...statement,
        file_path: fileUrl,
        reportData,
        transactionData,
        hasReport: !!statement.report_data
      };
    }));

    // Get the most recent one for backward compatibility
    const latestStatement = processedStatements[0];

    res.json({
      status: 'success',
      success: true,
      data: {
        hasStatement: true,
        statements: processedStatements, // All statements for table
        statement: latestStatement // Latest one for backward compatibility
      }
    });
  } catch (error) {
    console.error('Admin bank statement fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bank statement'
    });
  }
});

/**
 * POST /api/admin/bank-statement/:userId/verify
 * Trigger Digitap API verification for a user's bank statement (admin only)
 */
router.post('/:userId/verify', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { userId } = req.params;
    const adminId = req.admin?.id;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Admin authentication required'
      });
    }

    // Get the bank statement
    const statements = await executeQuery(
      `SELECT id, user_id, client_ref_num, file_path, file_name, mobile_number, bank_name
       FROM user_bank_statements 
       WHERE user_id = ? 
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (statements.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No bank statement found for this user'
      });
    }

    const statement = statements[0];

    if (!statement.file_path) {
      return res.status(400).json({
        success: false,
        message: 'Bank statement file not found'
      });
    }

    // Check if verification is already in progress
    if (statement.verification_status === 'api_verification_pending' ||
      statement.verification_status === 'api_verified') {
      return res.status(400).json({
        success: false,
        message: 'Verification already in progress or completed'
      });
    }

    // Fetch file from S3 (we need the buffer for Digitap API)
    // For now, we'll need to download it or use the file_path
    // Note: In production, you'd fetch from S3 here
    // For this implementation, we'll assume the file is accessible

    // Update status to pending
    await executeQuery(
      `UPDATE user_bank_statements 
       SET verification_status = 'api_verification_pending',
           verified_by = ?,
           verified_at = NOW(),
           updated_at = NOW()
       WHERE id = ?`,
      [adminId, statement.id]
    );

    // Log activity
    try {
      await logActivity({
        userId: userId,
        action: 'bank_statement_verification_initiated',
        details: {
          statementId: statement.id,
          adminId: adminId,
          clientRefNum: statement.client_ref_num
        },
        adminId: adminId
      });
    } catch (logError) {
      console.warn('Failed to log activity:', logError);
    }

    // Trigger Digitap API verification
    // Note: We need the file buffer. In production, fetch from S3
    // For now, we'll use the existing client_ref_num and let admin upload via API
    // Or we can fetch the file from S3 if we have AWS SDK configured

    res.json({
      success: true,
      message: 'Verification initiated. Please upload the file to Digitap using the file path.',
      data: {
        statementId: statement.id,
        clientRefNum: statement.client_ref_num,
        filePath: statement.file_path,
        status: 'api_verification_pending'
      }
    });
  } catch (error) {
    console.error('Admin verification trigger error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate verification'
    });
  }
});

/**
 * POST /api/admin/bank-statement/:userId/verify-with-file
 * Trigger Digitap API verification with file upload (admin only)
 * This endpoint accepts a file upload and sends it to Digitap
 */
router.post('/:userId/verify-with-file', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { userId } = req.params;
    const adminId = req.admin?.id;
    const multer = require('multer');
    const upload = multer({ storage: multer.memoryStorage() });

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Admin authentication required'
      });
    }

    // Handle file upload using multer
    upload.single('statement')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: 'File upload error: ' + err.message
        });
      }

      // Determine if we should use existing file or new upload
      let fileBuffer = null;
      let fileName = null;
      let useExistingFile = false;

      if (!req.file) {
        // Try to get file from existing statement
        const statements = await executeQuery(
          `SELECT id, user_id, client_ref_num, file_path, file_name, mobile_number, bank_name
           FROM user_bank_statements 
           WHERE user_id = ? 
           ORDER BY created_at DESC LIMIT 1`,
          [userId]
        );

        if (statements.length === 0 || !statements[0].file_path) {
          return res.status(400).json({
            success: false,
            message: 'No file provided and no existing file found'
          });
        }

        const statement = statements[0];
        const s3Key = statement.file_path;

        // Check if file_path is an S3 key (doesn't start with http) or a URL
        if (!s3Key.startsWith('http')) {
          // It's an S3 key, download the file
          try {
            console.log(`📥 Downloading existing file from S3: ${s3Key}`);
            fileBuffer = await downloadFromS3(s3Key);
            fileName = statement.file_name || 'bank-statement.pdf';
            useExistingFile = true;
            console.log(`✅ Downloaded file from S3, size: ${fileBuffer.length} bytes`);
          } catch (error) {
            console.error('❌ Failed to download file from S3:', error);
            return res.status(500).json({
              success: false,
              message: 'Failed to retrieve existing file from storage'
            });
          }
        } else {
          // It's a URL, we can't use it directly - need a new upload
          return res.status(400).json({
            success: false,
            message: 'Please provide a file to upload. Existing file URL cannot be used for Digitap verification.'
          });
        }
      } else {
        // Use the newly uploaded file
        fileBuffer = req.file.buffer;
        fileName = req.file.originalname;
      }

      try {
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

        // Get bank_name from request body or existing statement
        let bankName = req.body.bank_name || null;

        // Get or create bank statement record
        const statements = await executeQuery(
          `SELECT id, client_ref_num, bank_name FROM user_bank_statements WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
          [userId]
        );

        let statementId;
        let finalClientRefNum = clientRefNum;

        if (statements.length > 0) {
          statementId = statements[0].id;
          finalClientRefNum = statements[0].client_ref_num;
          // Use bank_name from existing statement if not provided in request
          if (!bankName && statements[0].bank_name) {
            bankName = statements[0].bank_name;
          }
        } else {
          // Create new record (only if we're not using existing file)
          if (!useExistingFile) {
            const insertResult = await executeQuery(
              `INSERT INTO user_bank_statements 
               (user_id, client_ref_num, mobile_number, bank_name, status, user_status, verification_status, file_name, file_size, upload_method, created_at)
               VALUES (?, ?, ?, ?, 'pending', 'uploaded', 'api_verification_pending', ?, ?, 'manual', NOW())`,
              [userId, finalClientRefNum, mobileNumber, bankName, fileName, fileBuffer.length]
            );
            statementId = insertResult.insertId;
          }
        }

        // If using existing file, also try to get bank_name from the statement we fetched earlier
        if (useExistingFile && !bankName) {
          const existingStatements = await executeQuery(
            `SELECT bank_name FROM user_bank_statements WHERE user_id = ? AND file_path IS NOT NULL ORDER BY created_at DESC LIMIT 1`,
            [userId]
          );
          if (existingStatements.length > 0 && existingStatements[0].bank_name) {
            bankName = existingStatements[0].bank_name;
          }
        }

        // Try to upload file directly to Digitap using API endpoint
        // Note: Digitap may not support direct programmatic uploads - if it fails, we'll store for manual processing
        console.log(`📤 Attempting to upload ${useExistingFile ? 'existing' : 'new'} file to Digitap API: ${fileName}`);

        let digitapResult = null;
        let digitapUploadSuccess = false;

        try {
          // Use the proper API upload function
          digitapResult = await uploadBankStatementPDF({
            mobile_no: mobileNumber,
            client_ref_num: finalClientRefNum,
            file_buffer: fileBuffer,
            file_name: fileName,
            bank_name: bankName || null,
            password: null
          });

          if (digitapResult.success) {
            digitapUploadSuccess = true;
            console.log('✅ File successfully uploaded to Digitap API');
            console.log('📊 Digitap upload result:', digitapResult.data);
          } else {
            // Check if it's a 404 (endpoint doesn't exist) - this means Digitap doesn't support direct uploads
            if (digitapResult.status === 404 || (digitapResult.error && digitapResult.error.includes('404'))) {
              console.warn('⚠️  Digitap direct upload API not available (404). File will be stored for manual processing.');
            } else {
              console.error('❌ Failed to upload file to Digitap:', digitapResult.error);
            }
          }
        } catch (uploadError) {
          console.warn('⚠️  Digitap upload attempt failed:', uploadError.message);
          // Continue with file storage even if Digitap upload fails
        }

        // Store request_id and txn_id if available from upload response
        const requestId = digitapResult?.data?.request_id || null;
        const txnId = digitapResult?.data?.txn_id || null;

        // Update status based on upload result
        // Note: verification_status ENUM values: 'api_verification_pending', 'api_verified', 'api_failed'
        let verificationStatus = 'api_failed'; // Use api_failed when upload fails (instead of 'pending_manual_review' which doesn't exist in ENUM)
        let statusMessage = 'Bank statement file stored successfully. Ready for manual verification.';

        if (digitapUploadSuccess) {
          verificationStatus = 'api_verification_pending';
          statusMessage = 'Bank statement sent to Digitap for verification';
        }

        // Handle verified_by column - admins table uses UUID (varchar(36)) but verified_by might be INT
        // Check if verified_by column exists and modify it if needed to accept UUIDs
        let verifiedByValue = adminId;
        try {
          // Check if column exists
          const columns = await executeQuery(
            `SHOW COLUMNS FROM user_bank_statements LIKE 'verified_by'`
          );

          if (columns.length > 0) {
            const columnType = columns[0].Type.toLowerCase();
            // If column is INT but adminId is UUID (string), modify column to VARCHAR(36)
            if (columnType.includes('int') && typeof adminId === 'string' && adminId.includes('-')) {
              console.log(`⚠️  verified_by column is INT but admin.id is UUID. Modifying column to VARCHAR(36)...`);
              try {
                await executeQuery(
                  `ALTER TABLE user_bank_statements MODIFY verified_by VARCHAR(36) NULL COMMENT 'Admin UUID who verified'`
                );
                console.log('✅ Modified verified_by column to accept UUIDs');
              } catch (alterError) {
                console.warn('⚠️  Could not modify verified_by column:', alterError.message);
                // If modification fails, set to NULL
                verifiedByValue = null;
              }
            }
          } else {
            // Column doesn't exist, create it as VARCHAR(36) to accept UUIDs
            console.log('📝 Creating verified_by column as VARCHAR(36)...');
            try {
              await executeQuery(
                `ALTER TABLE user_bank_statements ADD COLUMN verified_by VARCHAR(36) NULL COMMENT 'Admin UUID who verified' AFTER verification_status`
              );
              console.log('✅ Created verified_by column');
            } catch (addError) {
              console.warn('⚠️  Could not add verified_by column:', addError.message);
              verifiedByValue = null;
            }
          }
        } catch (colError) {
          console.warn('⚠️  Could not check verified_by column:', colError.message);
          // If we can't determine, set to NULL to avoid errors
          verifiedByValue = null;
        }

        await executeQuery(
          `UPDATE user_bank_statements 
           SET verification_status = ?,
               request_id = ?,
               txn_id = ?,
               verified_by = ?,
               verified_at = NOW(),
               updated_at = NOW()
           WHERE id = ?`,
          [verificationStatus, requestId, txnId, verifiedByValue, statementId]
        );

        // Log activity
        try {
          await logActivity({
            userId: userId,
            action: digitapUploadSuccess ? 'bank_statement_verification_initiated' : 'bank_statement_uploaded_manual',
            details: {
              statementId: statementId,
              adminId: adminId,
              clientRefNum: finalClientRefNum,
              digitapStatus: digitapResult?.data?.status || 'not_uploaded',
              uploadMethod: digitapUploadSuccess ? 'api' : 'manual'
            },
            adminId: adminId
          });
        } catch (logError) {
          console.warn('Failed to log activity:', logError);
        }

        res.json({
          success: true,
          message: statusMessage,
          data: {
            statementId: statementId,
            clientRefNum: finalClientRefNum,
            digitapStatus: digitapResult?.data?.status || 'not_uploaded',
            verificationStatus: verificationStatus,
            digitapUploadSuccess: digitapUploadSuccess,
            note: digitapUploadSuccess ? null : 'Digitap direct upload not available. File stored for manual processing.'
          }
        });
      } catch (error) {
        console.error('Digitap upload error:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to process verification request'
        });
      }
    });
  } catch (error) {
    console.error('Admin verification with file error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate verification'
    });
  }
});

/**
 * POST /api/admin/bank-statement/:userId/check-status/:statementId
 * Check status of a specific bank statement and retrieve report if ready (admin only)
 */
router.post('/:userId/check-status/:statementId', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { userId, statementId } = req.params;
    const adminId = req.admin?.id;

    // Get the specific bank statement
    const statements = await executeQuery(
      `SELECT id, user_id, client_ref_num, request_id, txn_id, verification_status, status, report_data
       FROM user_bank_statements 
       WHERE id = ? AND user_id = ?`,
      [statementId, userId]
    );

    if (statements.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bank statement not found'
      });
    }

    const statement = statements[0];

    if (!statement.request_id) {
      return res.status(400).json({
        success: false,
        message: 'No request_id found. Statement was not sent to Digitap.'
      });
    }

    // Check status with Digitap
    const statusResult = await checkBankStatementStatus(statement.request_id);

    if (!statusResult.success) {
      return res.status(500).json({
        success: false,
        message: `Failed to check status: ${statusResult.error}`
      });
    }

    console.log('📊 Status Check Result:', JSON.stringify(statusResult.data, null, 2));

    // Extract latest txn_id from status response and update database
    const statusTxnId = statusResult.data.txn_status?.[0]?.txn_id || statement.txn_id;
    
    // Update database with status AND latest txn_id (important for downloads)
    await executeQuery(
      `UPDATE user_bank_statements 
       SET status = ?,
           txn_id = ?,
           transaction_data = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [statusResult.data.overall_status, statusTxnId, JSON.stringify(statusResult.data.txn_status), statement.id]
    );
    console.log(`✅ Updated database with latest txn_id: ${statusTxnId}`);

    // If report is ready, retrieve it
    if (statusResult.data.is_complete && statusResult.data.overall_status === 'completed') {
      console.log('✅ Report ready! Retrieving report...');
      console.log(`📥 Using txn_id: ${statusTxnId} to retrieve report`);
      // Function signature: retrieveBankStatementReport(client_ref_num, format, txn_id)
      const reportResult = await retrieveBankStatementReport(null, 'json', statusTxnId);

      if (reportResult.success && reportResult.data) {
        console.log('✅ Report retrieved successfully');
        
        // Store report in database
        await executeQuery(
          `UPDATE user_bank_statements 
           SET report_data = ?,
               verification_status = 'api_verified',
               status = 'completed',
               updated_at = NOW()
           WHERE id = ?`,
          [JSON.stringify(reportResult.data), statement.id]
        );

        return res.json({
          status: 'success',
          success: true,
          message: 'Report is ready and has been retrieved.',
          data: {
            statementStatus: 'completed',
            verificationStatus: 'api_verified',
            hasReport: true,
            txnStatus: statusResult.data.txn_status
          }
        });
      }
    }

    // Report not ready yet or retrieval failed
    return res.json({
      status: 'success',
      success: true,
      message: `Status: ${statusResult.data.overall_status}`,
      data: {
        statementStatus: statusResult.data.overall_status,
        verificationStatus: statement.verification_status,
        isComplete: statusResult.data.is_complete,
        isInProgress: statusResult.data.is_in_progress,
        isFailed: statusResult.data.is_failed,
        txnStatus: statusResult.data.txn_status,
        hasReport: false
      }
    });
  } catch (error) {
    console.error('Check status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check statement status'
    });
  }
});

/**
 * POST /api/admin/bank-statement/:userId/check-status
 * Check Digitap verification status for latest statement (admin only) - Legacy endpoint
 */
router.post('/:userId/check-status', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { userId } = req.params;

    const statements = await executeQuery(
      `SELECT id, request_id, txn_id, client_ref_num, verification_status
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

    if (!statement.request_id) {
      return res.json({
        success: true,
        data: {
          status: statement.verification_status,
          message: 'No Digitap request ID found. Verification may not have been initiated.'
        }
      });
    }

    // Check status with Digitap
    const statusResult = await checkBankStatementStatus(statement.request_id);

    if (statusResult.success && statusResult.data) {
      const newStatus = statusResult.data.overall_status;
      let verificationStatus = 'api_verification_pending';

      if (newStatus === 'completed') {
        verificationStatus = 'api_verified';
      } else if (newStatus === 'failed') {
        verificationStatus = 'api_failed';
      }

      // Update database
      await executeQuery(
        `UPDATE user_bank_statements 
         SET verification_status = ?,
             status = ?,
             transaction_data = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [
          verificationStatus,
          newStatus,
          JSON.stringify(statusResult.data.txn_status),
          statement.id
        ]
      );

      res.json({
        success: true,
        data: {
          status: verificationStatus,
          digitapStatus: newStatus,
          transactionStatus: statusResult.data.txn_status,
          isComplete: statusResult.data.is_complete
        }
      });
    } else {
      res.json({
        success: false,
        message: statusResult.error || 'Failed to check status',
        data: {
          status: statement.verification_status
        }
      });
    }
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check verification status'
    });
  }
});

/**
 * GET /api/admin/bank-statement/:userId/download-report/:statementId
 * Download report for a specific statement (admin only)
 * Supports both JSON and XLSX formats
 */
router.get('/:userId/download-report/:statementId', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { userId, statementId } = req.params;
    const { format = 'json' } = req.query;
    const adminId = req.admin?.id;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Admin authentication required'
      });
    }

    // Get the specific statement
    const statements = await executeQuery(
      `SELECT id, user_id, txn_id, request_id, client_ref_num, report_data, file_name
       FROM user_bank_statements 
       WHERE id = ? AND user_id = ?`,
      [statementId, userId]
    );

    if (statements.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bank statement not found'
      });
    }

    const statement = statements[0];

    // If report already exists in database and format is JSON, return it
    if (statement.report_data && format === 'json') {
      try {
        const reportData = typeof statement.report_data === 'string'
          ? JSON.parse(statement.report_data)
          : statement.report_data;

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="bank-statement-${statement.client_ref_num || statementId}.json"`);
        return res.json(reportData);
      } catch (e) {
        console.warn('Could not parse cached report:', e);
      }
    }

    // Fetch from Digitap
    // Always check status first if we have request_id to get the latest txn_id
    // This ensures we use the correct txn_id even if database has an old one
    let txnIdToUse = statement.txn_id;
    
    if (statement.request_id) {
      console.log(`📊 Checking status to get latest txn_id for request_id: ${statement.request_id}`);
      try {
        const statusResult = await checkBankStatementStatus(statement.request_id);
        if (statusResult.success && statusResult.data?.txn_status?.[0]?.txn_id) {
          const latestTxnId = statusResult.data.txn_status[0].txn_id;
          console.log(`✅ Got latest txn_id from status check: ${latestTxnId} (database had: ${txnIdToUse || 'none'})`);
          txnIdToUse = latestTxnId;
          // Update database with latest txn_id for future use
          await executeQuery(
            `UPDATE user_bank_statements SET txn_id = ? WHERE id = ?`,
            [latestTxnId, statement.id]
          );
        }
      } catch (statusError) {
        console.warn('⚠️  Could not check status, using txn_id from database:', statusError.message);
      }
    }

    if (!txnIdToUse && !statement.client_ref_num) {
      return res.status(400).json({
        success: false,
        message: 'No transaction ID or client reference number found for this statement'
      });
    }

    console.log(`📥 Downloading ${format} report using txn_id: ${txnIdToUse || 'N/A'}`);
    
    const reportResult = txnIdToUse
      ? await retrieveBankStatementReport(null, format, txnIdToUse)
      : await retrieveBankStatementReport(statement.client_ref_num, format);

    if (reportResult.success && reportResult.data) {
      // Save report to database if JSON
      if (format === 'json') {
        const reportJsonString = typeof reportResult.data.report === 'string'
          ? reportResult.data.report
          : JSON.stringify(reportResult.data.report);

        await executeQuery(
          `UPDATE user_bank_statements 
           SET report_data = ?,
               updated_at = NOW()
           WHERE id = ?`,
          [reportJsonString, statement.id]
        );

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="bank-statement-${statement.client_ref_num || statementId}.json"`);
        return res.json(reportResult.data.report);
      } else if (format === 'xlsx') {
        // For XLSX, return the buffer directly
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="bank-statement-${statement.client_ref_num || statementId}.xlsx"`);
        return res.send(reportResult.data.report);
      }
    } else {
      return res.status(500).json({
        success: false,
        message: reportResult.error || 'Failed to fetch report from Digitap'
      });
    }
  } catch (error) {
    console.error('Download report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download report'
    });
  }
});

/**
 * POST /api/admin/bank-statement/:userId/fetch-report
 * Fetch verification report from Digitap (admin only)
 * (Kept for backward compatibility - fetches latest statement)
 */
router.post('/:userId/fetch-report', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { userId } = req.params;
    const { format = 'json' } = req.body;

    const statements = await executeQuery(
      `SELECT id, txn_id, client_ref_num, report_data
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

    // If report already exists, return it
    if (statement.report_data && format === 'json') {
      try {
        const reportData = typeof statement.report_data === 'string'
          ? JSON.parse(statement.report_data)
          : statement.report_data;

        return res.json({
          success: true,
          data: {
            report: reportData,
            cached: true
          }
        });
      } catch (e) {
        console.warn('Could not parse cached report:', e);
      }
    }

    // Fetch from Digitap
    if (!statement.txn_id && !statement.client_ref_num) {
      return res.status(400).json({
        success: false,
        message: 'No transaction ID or client reference number found'
      });
    }

    const reportResult = statement.txn_id
      ? await retrieveBankStatementReport(null, format, statement.txn_id)
      : await retrieveBankStatementReport(statement.client_ref_num, format);

    if (reportResult.success && reportResult.data) {
      // Save report to database
      const reportJsonString = typeof reportResult.data.report === 'string'
        ? reportResult.data.report
        : JSON.stringify(reportResult.data.report);

      await executeQuery(
        `UPDATE user_bank_statements 
         SET report_data = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [reportJsonString, statement.id]
      );

      res.json({
        success: true,
        data: {
          report: reportResult.data.report,
          cached: false
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: reportResult.error || 'Failed to fetch report'
      });
    }
  } catch (error) {
    console.error('Report fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch verification report'
    });
  }
});

/**
 * POST /api/admin/bank-statement/:userId/update-decision
 * Update verification decision (admin only)
 */
router.post('/:userId/update-decision', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { userId } = req.params;
    const adminId = req.admin?.id;
    const { decision, notes } = req.body;

    if (!decision || !['approved', 'rejected', 'pending'].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid decision. Must be: approved, rejected, or pending'
      });
    }

    const statements = await executeQuery(
      `SELECT id FROM user_bank_statements WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (statements.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No bank statement found'
      });
    }

    const statementId = statements[0].id;

    // Update decision and user status
    let userStatus = 'under_review';
    if (decision === 'approved') {
      userStatus = 'verified';
    } else if (decision === 'rejected') {
      userStatus = 'rejected';
    }

    await executeQuery(
      `UPDATE user_bank_statements 
       SET verification_decision = ?,
           verification_notes = ?,
           user_status = ?,
           verified_by = ?,
           verified_at = NOW(),
           updated_at = NOW()
       WHERE id = ?`,
      [decision, notes || null, userStatus, adminId, statementId]
    );

    // Log activity
    try {
      await logActivity({
        userId: userId,
        action: 'bank_statement_verification_decision',
        details: {
          statementId: statementId,
          adminId: adminId,
          decision: decision,
          notes: notes
        },
        adminId: adminId
      });
    } catch (logError) {
      console.warn('Failed to log activity:', logError);
    }

    res.json({
      success: true,
      message: 'Verification decision updated',
      data: {
        decision,
        userStatus,
        notes
      }
    });
  } catch (error) {
    console.error('Decision update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update verification decision'
    });
  }
});

/**
 * POST /api/admin/bank-statement/:userId/add-new
 * Add new statement - creates a new statement record and starts Digitap upload process
 * This endpoint creates a new statement entry and calls Digitap Start Upload API for admin to upload
 */
router.post('/:userId/add-new', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { userId } = req.params;
    const adminId = req.admin?.id;
    const { institution_id, start_month, end_month, bank_name } = req.body;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Admin authentication required'
      });
    }

    // Get user's mobile number
    const users = await executeQuery(
      'SELECT phone FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const mobileNumber = users[0].phone;
    if (!mobileNumber) {
      return res.status(400).json({
        success: false,
        message: 'User mobile number not found'
      });
    }

    // Generate unique client_ref_num for this new statement
    const clientRefNum = generateClientRefNum(userId, Date.now());

    // Create a new statement record
    // Note: user_status should be NULL or 'uploaded' for new online statements, not 'pending'
    const insertResult = await executeQuery(
      `INSERT INTO user_bank_statements 
       (user_id, client_ref_num, mobile_number, bank_name, upload_method, status, user_status, verification_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'online', 'pending', NULL, 'not_started', NOW(), NOW())`,
      [userId, clientRefNum, mobileNumber, bank_name || null]
    );

    const newStatementId = insertResult.insertId;

    // Determine institution_id
    let finalInstitutionId = institution_id;

    // If not provided, try to get from bank_name or institution list
    if (!finalInstitutionId && bank_name) {
      try {
        const institutionListResult = await getInstitutionList('Statement');
        if (institutionListResult.success && institutionListResult.data && institutionListResult.data.length > 0) {
          const bankNameLower = bank_name.toLowerCase().trim();
          const matchingInstitution = institutionListResult.data.find(inst => {
            if (!inst.name) return false;
            const instNameLower = inst.name.toLowerCase().trim();
            return instNameLower.includes(bankNameLower) || bankNameLower.includes(instNameLower);
          });

          if (matchingInstitution) {
            finalInstitutionId = matchingInstitution.id;
            console.log(`✅ Found institution_id ${finalInstitutionId} for bank: ${bank_name}`);
          }
        }
      } catch (error) {
        console.warn('⚠️  Could not fetch institution list:', error.message);
      }
    }

    // If still no institution_id, use default
    if (!finalInstitutionId) {
      console.warn(`⚠️  No institution_id provided. Using default: 1`);
      finalInstitutionId = 1; // Default fallback
    }

    // Determine callback URL
    const defaultApiUrl = process.env.APP_URL || 'https://pocketcredit.in/api';
    const txnCompletedCbUrl = `${defaultApiUrl}/bank-statement/bank-data/webhook`;

    // Call Digitap Start Upload API
    console.log(`📤 Calling Digitap Start Upload API for new statement (user ${userId})...`);

    const startUploadResult = await startUploadAPI({
      client_ref_num: clientRefNum,
      txn_completed_cburl: txnCompletedCbUrl,
      institution_id: finalInstitutionId,
      start_month: start_month,
      end_month: end_month,
      acceptance_policy: 'atLeastOneTransactionInRange'
    });

    if (!startUploadResult.success) {
      // Delete the statement record if Start Upload failed
      await executeQuery(
        `DELETE FROM user_bank_statements WHERE id = ?`,
        [newStatementId]
      );

      let errorMessage = startUploadResult.error;
      if (startUploadResult.code === 'NotSignedUp') {
        errorMessage = 'Your Digitap account has not been enabled for the Bank Data PDF Upload Service. Please contact Digitap support to enable this service for your account.';
      }

      const statusCode = startUploadResult.status === 403 ? 502 : (startUploadResult.status || 500);

      return res.status(statusCode).json({
        success: false,
        message: errorMessage,
        code: startUploadResult.code,
        errorDetails: startUploadResult.raw_response
      });
    }

    const { url: uploadUrl, token, request_id, txn_id, expires } = startUploadResult.data;

    // Update database with request_id, txn_id, and status
    await executeQuery(
      `UPDATE user_bank_statements 
       SET verification_status = 'api_verification_pending',
           request_id = ?,
           txn_id = ?,
           verified_by = ?,
           verified_at = NOW(),
           updated_at = NOW()
       WHERE id = ?`,
      [request_id, txn_id, adminId, newStatementId]
    );

    // Log activity
    try {
      await logActivity({
        userId: userId,
        action: 'bank_statement_new_upload_started',
        details: {
          statementId: newStatementId,
          adminId: adminId,
          clientRefNum: clientRefNum,
          requestId: request_id,
          txnId: txn_id,
          uploadUrl: uploadUrl
        },
        adminId: adminId
      });
    } catch (logError) {
      console.warn('Failed to log activity:', logError);
    }

    console.log(`✅ New statement created and upload URL generated for user ${userId}, request_id: ${request_id}`);

    res.json({
      success: true,
      status: 'success',
      message: 'New statement created and upload URL generated successfully',
      data: {
        uploadUrl: uploadUrl,
        token: token,
        requestId: request_id,
        txnId: txn_id,
        expires: expires,
        clientRefNum: clientRefNum,
        statementId: newStatementId
      }
    });
  } catch (error) {
    console.error('Add new statement error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create new statement and start upload process'
    });
  }
});

/**
 * POST /api/admin/bank-statement/:userId/add-new-from-user
 * Reset bank statement status to allow user to upload again
 * This endpoint resets existing statements and allows the user to upload via account aggregator (online) or manual (offline) mode
 */
router.post('/:userId/add-new-from-user', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { userId } = req.params;
    const adminId = req.admin?.id;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Admin authentication required'
      });
    }

    // Check if user exists
    const users = await executeQuery(
      'SELECT id FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get existing statements
    const existingStatements = await executeQuery(
      `SELECT id, status, verification_status FROM user_bank_statements WHERE user_id = ?`,
      [userId]
    );

    // Reset all existing statements to allow new upload
    // Set status to 'pending' and verification_status to 'not_started' so user can upload again
    if (existingStatements.length > 0) {
      await executeQuery(
        `UPDATE user_bank_statements 
         SET status = 'pending',
             verification_status = 'not_started',
             user_status = NULL,
             request_id = NULL,
             txn_id = NULL,
             digitap_url = NULL,
             expires_at = NULL,
             updated_at = NOW()
         WHERE user_id = ?`,
        [userId]
      );
      console.log(`✅ Reset ${existingStatements.length} existing statement(s) for user ${userId}`);
    }

    // Log activity
    try {
      await logActivity({
        userId: userId,
        action: 'bank_statement_reset_for_user_upload',
        details: {
          adminId: adminId,
          resetStatements: existingStatements.length,
          message: 'Bank statement status reset. User can now upload via account aggregator or manual mode.'
        },
        adminId: adminId
      });
    } catch (logError) {
      console.warn('Failed to log activity:', logError);
    }

    console.log(`✅ Bank statement status reset for user ${userId}. User can now upload via account aggregator or manual mode.`);

    res.json({
      success: true,
      status: 'success',
      message: 'Bank statement status reset successfully. User can now upload via account aggregator (online) or manual (offline) mode.',
      data: {
        resetStatements: existingStatements.length,
        userCanUpload: true
      }
    });
  } catch (error) {
    console.error('Add new from user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset bank statement status'
    });
  }
});

/**
 * POST /api/admin/bank-statement/:userId/start-upload/:statementId
 * Start Digitap upload process for a specific statement - returns upload URL
 * This is used for manual uploads to generate report
 */
router.post('/:userId/start-upload/:statementId', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { userId, statementId } = req.params;
    const adminId = req.admin?.id;
    const { institution_id, start_month, end_month } = req.body;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Admin authentication required'
      });
    }

    // Get the specific bank statement
    const statements = await executeQuery(
      `SELECT id, user_id, client_ref_num, file_path, file_name, mobile_number, bank_name, verification_status, upload_method
       FROM user_bank_statements 
       WHERE id = ? AND user_id = ?`,
      [statementId, userId]
    );

    if (statements.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bank statement not found'
      });
    }

    const statement = statements[0];

    // Check if verification is already completed - don't allow re-upload
    if (statement.verification_status === 'api_verified') {
      return res.status(400).json({
        success: false,
        message: 'Verification already completed. Cannot regenerate upload URL.'
      });
    }

    // If verification is pending, allow regenerating URL (token might have expired or user needs to re-upload)
    if (statement.verification_status === 'api_verification_pending') {
      console.log(`⚠️  Verification already in progress for statement ${statementId}, but allowing URL regeneration`);
    }

    // Use existing client_ref_num or generate new one
    let clientRefNum = statement.client_ref_num;
    if (!clientRefNum) {
      clientRefNum = generateClientRefNum(userId, 0);
      // Update the statement with client_ref_num
      await executeQuery(
        `UPDATE user_bank_statements SET client_ref_num = ? WHERE id = ?`,
        [clientRefNum, statement.id]
      );
    }

    // Determine institution_id
    let finalInstitutionId = institution_id;

    // If not provided, try to get from bank_name or institution list
    if (!finalInstitutionId) {
      if (statement.bank_name) {
        try {
          const institutionListResult = await getInstitutionList('Statement');
          if (institutionListResult.success && institutionListResult.data && institutionListResult.data.length > 0) {
            const bankNameLower = statement.bank_name.toLowerCase().trim();
            const matchingInstitution = institutionListResult.data.find(inst => {
              if (!inst.name) return false;
              const instNameLower = inst.name.toLowerCase().trim();
              return instNameLower.includes(bankNameLower) || bankNameLower.includes(instNameLower);
            });

            if (matchingInstitution) {
              finalInstitutionId = matchingInstitution.id;
              console.log(`✅ Found institution_id ${finalInstitutionId} for bank: ${statement.bank_name}`);
            }
          }
        } catch (error) {
          console.warn('⚠️  Could not fetch institution list:', error.message);
        }
      }

      // If still no institution_id, let Digitap auto-detect the bank
      if (!finalInstitutionId) {
        console.warn(`⚠️  No institution_id provided. Digitap will auto-detect the bank from the PDF.`);
        // Don't set a default - let Digitap auto-detect
      }
    }

    // Determine callback URL
    const defaultApiUrl = process.env.APP_URL || 'https://pocketcredit.in/api';
    const txnCompletedCbUrl = `${defaultApiUrl}/bank-statement/bank-data/webhook`;

    // Call Digitap Start Upload API
    console.log(`📤 Calling Digitap Start Upload API for statement ${statementId} (user ${userId})...`);

    // Build params - only include institution_id if we have it (let Digitap auto-detect if not)
    const startUploadParams = {
      client_ref_num: clientRefNum,
      txn_completed_cburl: txnCompletedCbUrl,
      acceptance_policy: 'atLeastOneTransactionInRange'
    };

    // Only add institution_id if we have a valid one
    if (finalInstitutionId) {
      startUploadParams.institution_id = finalInstitutionId;
    }

    // Add optional date range
    if (start_month) startUploadParams.start_month = start_month;
    if (end_month) startUploadParams.end_month = end_month;

    const startUploadResult = await startUploadAPI(startUploadParams);

    if (!startUploadResult.success) {
      let errorMessage = startUploadResult.error;
      if (startUploadResult.code === 'NotSignedUp') {
        errorMessage = 'Your Digitap account has not been enabled for the Bank Data PDF Upload Service. Please contact Digitap support to enable this service for your account.';
      }

      const statusCode = startUploadResult.status === 403 ? 502 : (startUploadResult.status || 500);

      return res.status(statusCode).json({
        success: false,
        message: errorMessage,
        code: startUploadResult.code,
        errorDetails: startUploadResult.raw_response
      });
    }

    const { url: uploadUrl, token, request_id, txn_id, expires } = startUploadResult.data;

    // IMPORTANT: Update database with NEW request_id and txn_id IMMEDIATELY
    // This ensures refresh button and status checks use the correct, latest request_id
    await executeQuery(
      `UPDATE user_bank_statements 
       SET request_id = ?,
           txn_id = ?,
           verification_status = 'api_verification_pending',
           updated_at = NOW()
       WHERE id = ?`,
      [request_id, txn_id, statement.id]
    );
    console.log(`✅ Updated database with NEW request_id: ${request_id}, txn_id: ${txn_id}`);

    // For manual uploads, automatically upload the existing file to Digitap
    if (statement.upload_method === 'manual' && statement.file_path) {
      try {
        console.log(`\n📤 Auto-uploading manual file to Digitap for statement ${statementId}...`);
        console.log(`📁 File Name: ${statement.file_name}`);
        console.log(`📁 File Path: ${statement.file_path}`);
        console.log(`🏦 Bank: ${statement.bank_name || 'Auto-detect'}`);
        
        // Download file from S3
        const { downloadFromS3 } = require('../services/s3Service');
        let fileBuffer;
        
        // Check if file_path is an S3 key (doesn't start with http) or a URL
        if (!statement.file_path.startsWith('http')) {
          // It's an S3 key, download the file
          console.log(`📥 Downloading file from S3: ${statement.file_path}`);
          fileBuffer = await downloadFromS3(statement.file_path);
          console.log(`✅ Downloaded ${fileBuffer.length} bytes from S3`);
        } else {
          // It's a URL, fetch it
          console.log(`📥 Downloading file from URL: ${statement.file_path}`);
          const axios = require('axios');
          const fileResponse = await axios.get(statement.file_path, { responseType: 'arraybuffer' });
          fileBuffer = Buffer.from(fileResponse.data);
          console.log(`✅ Downloaded ${fileBuffer.length} bytes from URL`);
        }

        // Upload to Digitap using Upload Statement API
        const uploadResult = await uploadStatementAPI({
          upload_url: uploadUrl,
          token: token,
          request_id: request_id,
          file_buffer: fileBuffer,
          file_name: statement.file_name || 'bank-statement.pdf'
        });

        if (!uploadResult.success) {
          console.error('❌ Failed to upload file to Digitap:', uploadResult.error);
          return res.status(500).json({
            success: false,
            message: `Failed to upload file to Digitap: ${uploadResult.error}`,
            code: uploadResult.code
          });
        }

        console.log('✅ File uploaded to Digitap successfully');

        // Call Complete Upload API
        const { completeUploadAPI } = require('../services/digitapBankStatementService');
        const completeResult = await completeUploadAPI({
          request_id: request_id
        });

        if (!completeResult.success) {
          console.error('❌ Failed to complete upload:', completeResult.error);
          return res.status(500).json({
            success: false,
            message: `File uploaded but failed to complete: ${completeResult.error}`,
            code: completeResult.code
          });
        }

        console.log('✅ Upload completed successfully. Digitap is now processing the statement.');

        // Update database with NEW request_id, txn_id, and status BEFORE checking status
        // This ensures refresh button uses the correct request_id
        await executeQuery(
          `UPDATE user_bank_statements 
           SET verification_status = 'api_verification_pending',
               request_id = ?,
               txn_id = ?,
               status = 'processing',
               updated_at = NOW()
           WHERE id = ?`,
          [request_id, txn_id, statement.id]
        );
        
        console.log(`✅ Updated database with request_id: ${request_id}, txn_id: ${txn_id}`);

        // Wait a bit for Digitap to process (usually very fast for single PDF)
        console.log('⏳ Waiting 3 seconds for Digitap to process...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Check status
        const { checkBankStatementStatus, retrieveBankStatementReport } = require('../services/digitapBankStatementService');
        const statusResult = await checkBankStatementStatus(request_id);

        if (statusResult.success && statusResult.data) {
          console.log('📊 Status Check Result:', JSON.stringify(statusResult.data, null, 2));

          // Update database with status
          await executeQuery(
            `UPDATE user_bank_statements 
             SET status = ?,
                 transaction_data = ?,
                 updated_at = NOW()
             WHERE id = ?`,
            [statusResult.data.overall_status, JSON.stringify(statusResult.data.txn_status), statement.id]
          );

          // If report is ready, retrieve it
          if (statusResult.data.is_complete && statusResult.data.overall_status === 'completed') {
            console.log('✅ Report ready! Retrieving report...');
            // Use txn_id from status response (most reliable)
            const statusTxnId = statusResult.data.txn_status?.[0]?.txn_id || txn_id;
            console.log(`📥 Using txn_id: ${statusTxnId} to retrieve report`);
            // Function signature: retrieveBankStatementReport(client_ref_num, format, txn_id)
            const reportResult = await retrieveBankStatementReport(null, 'json', statusTxnId);

            if (reportResult.success && reportResult.data) {
              console.log('✅ Report retrieved successfully');
              
              // Store report in database
              await executeQuery(
                `UPDATE user_bank_statements 
                 SET report_data = ?,
                     verification_status = 'api_verified',
                     status = 'completed',
                     updated_at = NOW()
                 WHERE id = ?`,
                [JSON.stringify(reportResult.data), statement.id]
              );

              return res.json({
                status: 'success',
                success: true,
                message: 'Bank statement processed successfully. Report is ready.',
                data: {
                  requestId: request_id,
                  txnId: txn_id,
                  statementId: statement.id,
                  status: 'completed',
                  hasReport: true
                }
              });
            }
          }
        }

        // Return success - report might take longer to process
        return res.json({
          status: 'success',
          success: true,
          message: 'Bank statement uploaded to Digitap successfully. Processing in progress.',
          data: {
            requestId: request_id,
            txnId: txn_id,
            statementId: statement.id,
            status: statusResult.data?.overall_status || 'processing'
          }
        });

      } catch (uploadError) {
        console.error('❌ Error during auto-upload:', uploadError);
        return res.status(500).json({
          success: false,
          message: `Failed to upload file: ${uploadError.message}`
        });
      }
    }

    // Handle verified_by column - admins table uses UUID (varchar(36)) but verified_by might be INT
    // Check if verified_by column exists and modify it if needed to accept UUIDs
    let verifiedByValue = adminId;
    try {
      // Check if column exists
      const columns = await executeQuery(
        `SHOW COLUMNS FROM user_bank_statements LIKE 'verified_by'`
      );

      if (columns.length > 0) {
        const columnType = columns[0].Type.toLowerCase();
        // If column is INT but adminId is UUID (string), modify column to VARCHAR(36)
        if (columnType.includes('int') && typeof adminId === 'string' && adminId.includes('-')) {
          console.log(`⚠️  verified_by column is INT but admin.id is UUID. Modifying column to VARCHAR(36)...`);
          try {
            await executeQuery(
              `ALTER TABLE user_bank_statements MODIFY verified_by VARCHAR(36) NULL COMMENT 'Admin UUID who verified'`
            );
            console.log('✅ Modified verified_by column to accept UUIDs');
          } catch (alterError) {
            console.warn('⚠️  Could not modify verified_by column:', alterError.message);
            // If modification fails, set to NULL
            verifiedByValue = null;
          }
        }
      } else {
        // Column doesn't exist, create it as VARCHAR(36) to accept UUIDs
        console.log('📝 Creating verified_by column as VARCHAR(36)...');
        try {
          await executeQuery(
            `ALTER TABLE user_bank_statements ADD COLUMN verified_by VARCHAR(36) NULL COMMENT 'Admin UUID who verified' AFTER verification_status`
          );
          console.log('✅ Created verified_by column');
        } catch (addError) {
          console.warn('⚠️  Could not add verified_by column:', addError.message);
          verifiedByValue = null;
        }
      }
    } catch (colError) {
      console.warn('⚠️  Could not check verified_by column:', colError.message);
      // If we can't determine, set to NULL to avoid errors
      verifiedByValue = null;
    }

    // Update database with request_id, txn_id, and status
    await executeQuery(
      `UPDATE user_bank_statements 
       SET verification_status = 'api_verification_pending',
           request_id = ?,
           txn_id = ?,
           verified_by = ?,
           verified_at = NOW(),
           updated_at = NOW()
       WHERE id = ?`,
      [request_id, txn_id, verifiedByValue, statement.id]
    );

    // Log activity
    try {
      await logActivity({
        userId: userId,
        action: 'bank_statement_generate_report_url',
        details: {
          statementId: statement.id,
          adminId: adminId,
          clientRefNum: clientRefNum,
          requestId: request_id,
          txnId: txn_id,
          uploadUrl: uploadUrl
        },
        adminId: adminId
      });
    } catch (logError) {
      console.warn('Failed to log activity:', logError);
    }

    console.log(`✅ Upload URL generated for statement ${statementId}, request_id: ${request_id}`);

    res.json({
      status: 'success',
      success: true,
      message: 'Upload URL generated successfully',
      data: {
        uploadUrl: uploadUrl,
        token: token,
        requestId: request_id,
        txnId: txn_id,
        expires: expires,
        clientRefNum: clientRefNum,
        statementId: statement.id
      }
    });
  } catch (error) {
    console.error('Start upload for statement error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start upload process'
    });
  }
});

/**
 * POST /api/admin/bank-statement/:userId/start-upload
 * Start Digitap upload process - returns upload URL for admin to redirect to
 * This endpoint calls Digitap Start Upload API and returns the upload URL
 * (For existing statements - latest one)
 */
router.post('/:userId/start-upload', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { userId } = req.params;
    const adminId = req.admin?.id;
    const { institution_id, start_month, end_month } = req.body;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Admin authentication required'
      });
    }

    // Get the bank statement
    const statements = await executeQuery(
      `SELECT id, user_id, client_ref_num, file_path, file_name, mobile_number, bank_name, verification_status
       FROM user_bank_statements 
       WHERE user_id = ? 
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (statements.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No bank statement found for this user'
      });
    }

    const statement = statements[0];

    if (!statement.file_path) {
      return res.status(400).json({
        success: false,
        message: 'Bank statement file not found'
      });
    }

    // Check if verification is already in progress
    if (statement.verification_status === 'api_verification_pending' ||
      statement.verification_status === 'api_verified') {
      return res.status(400).json({
        success: false,
        message: 'Verification already in progress or completed'
      });
    }

    // Generate or get client_ref_num
    let clientRefNum = statement.client_ref_num;
    if (!clientRefNum) {
      clientRefNum = generateClientRefNum(userId, 0);
      // Update the statement with client_ref_num
      await executeQuery(
        `UPDATE user_bank_statements SET client_ref_num = ? WHERE id = ?`,
        [clientRefNum, statement.id]
      );
    }

    // Determine institution_id
    let finalInstitutionId = institution_id;

    // If not provided, try to get from bank_name or institution list
    if (!finalInstitutionId) {
      if (statement.bank_name) {
        try {
          const institutionListResult = await getInstitutionList('Statement');
          if (institutionListResult.success && institutionListResult.data && institutionListResult.data.length > 0) {
            const bankNameLower = statement.bank_name.toLowerCase().trim();
            const matchingInstitution = institutionListResult.data.find(inst => {
              if (!inst.name) return false;
              const instNameLower = inst.name.toLowerCase().trim();
              return instNameLower.includes(bankNameLower) || bankNameLower.includes(instNameLower);
            });

            if (matchingInstitution) {
              finalInstitutionId = matchingInstitution.id;
              console.log(`✅ Found institution_id ${finalInstitutionId} for bank: ${statement.bank_name}`);
            }
          }
        } catch (error) {
          console.warn('⚠️  Could not fetch institution list:', error.message);
        }
      }

      // If still no institution_id, use default
      if (!finalInstitutionId) {
        console.warn(`⚠️  No institution_id provided. Using default: 1`);
        finalInstitutionId = 1; // Default fallback
      }
    }

    // Determine callback URL
    const defaultApiUrl = process.env.APP_URL || 'https://pocketcredit.in/api';
    const txnCompletedCbUrl = `${defaultApiUrl}/bank-statement/bank-data/webhook`;

    // Call Digitap Start Upload API
    console.log(`📤 Calling Digitap Start Upload API for user ${userId}...`);

    const startUploadResult = await startUploadAPI({
      client_ref_num: clientRefNum,
      txn_completed_cburl: txnCompletedCbUrl,
      institution_id: finalInstitutionId,
      start_month: start_month,
      end_month: end_month,
      acceptance_policy: 'atLeastOneTransactionInRange'
    });

    if (!startUploadResult.success) {
      // Provide helpful error message for NotSignedUp error
      let errorMessage = startUploadResult.error;
      if (startUploadResult.code === 'NotSignedUp') {
        errorMessage = 'Your Digitap account has not been enabled for the Bank Data PDF Upload Service. Please contact Digitap support to enable this service for your account.';
      }

      // Return 502 (Bad Gateway) instead of 403 to avoid logout
      // 403 from Digitap is an API service error, not an authentication error
      const statusCode = startUploadResult.status === 403 ? 502 : (startUploadResult.status || 500);

      return res.status(statusCode).json({
        success: false,
        message: errorMessage,
        code: startUploadResult.code,
        errorDetails: startUploadResult.raw_response
      });
    }

    const { url: uploadUrl, token, request_id, txn_id, expires } = startUploadResult.data;

    // Update database with request_id, txn_id, and status
    await executeQuery(
      `UPDATE user_bank_statements 
       SET verification_status = 'api_verification_pending',
           request_id = ?,
           txn_id = ?,
           verified_by = ?,
           verified_at = NOW(),
           updated_at = NOW()
       WHERE id = ?`,
      [request_id, txn_id, adminId, statement.id]
    );

    // Log activity
    try {
      await logActivity({
        userId: userId,
        action: 'bank_statement_upload_url_generated',
        details: {
          statementId: statement.id,
          adminId: adminId,
          clientRefNum: clientRefNum,
          requestId: request_id,
          txnId: txn_id,
          uploadUrl: uploadUrl
        },
        adminId: adminId
      });
    } catch (logError) {
      console.warn('Failed to log activity:', logError);
    }

    console.log(`✅ Upload URL generated for user ${userId}, request_id: ${request_id}`);

    res.json({
      success: true,
      message: 'Upload URL generated successfully',
      data: {
        uploadUrl: uploadUrl,
        token: token,
        requestId: request_id,
        txnId: txn_id,
        expires: expires,
        clientRefNum: clientRefNum,
        statementId: statement.id
      }
    });
  } catch (error) {
    console.error('Start upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start upload process'
    });
  }
});

/**
 * POST /api/admin/bank-statement/:userId/complete-upload
 * Complete the Digitap upload process after admin has uploaded file
 * This endpoint calls Digitap Complete Upload API
 */
router.post('/:userId/complete-upload', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { userId } = req.params;
    const adminId = req.admin?.id;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Admin authentication required'
      });
    }

    // Get the bank statement with request_id
    const statements = await executeQuery(
      `SELECT id, user_id, request_id, verification_status
       FROM user_bank_statements 
       WHERE user_id = ? 
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (statements.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No bank statement found for this user'
      });
    }

    const statement = statements[0];

    if (!statement.request_id) {
      return res.status(400).json({
        success: false,
        message: 'No request_id found. Please start upload first.'
      });
    }

    if (statement.verification_status !== 'api_verification_pending') {
      return res.status(400).json({
        success: false,
        message: 'Upload is not in pending status. Current status: ' + statement.verification_status
      });
    }

    // Call Digitap Complete Upload API
    console.log(`📤 Calling Digitap Complete Upload API for request_id: ${statement.request_id}...`);

    const completeUploadResult = await completeUploadAPI({
      request_id: statement.request_id
    });

    if (!completeUploadResult.success) {
      return res.status(500).json({
        success: false,
        message: `Failed to complete upload: ${completeUploadResult.error}`,
        code: completeUploadResult.code
      });
    }

    // Log activity
    try {
      await logActivity({
        userId: userId,
        action: 'bank_statement_upload_completed',
        details: {
          statementId: statement.id,
          adminId: adminId,
          requestId: statement.request_id
        },
        adminId: adminId
      });
    } catch (logError) {
      console.warn('Failed to log activity:', logError);
    }

    console.log(`✅ Upload completed for user ${userId}, request_id: ${statement.request_id}`);

    res.json({
      success: true,
      message: 'Upload completed successfully. Processing has started.',
      data: {
        requestId: statement.request_id,
        status: 'processing'
      }
    });
  } catch (error) {
    console.error('Complete upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete upload process'
    });
  }
});

/**
 * POST /api/admin/bank-statement/:userId/approve-manual
 * Quick approval for manual bank statement uploads (no Digitap verification needed)
 * This is for cases where user uploaded manually and admin wants to approve without API verification
 */
router.post('/:userId/approve-manual', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { userId } = req.params;
    const adminId = req.admin?.id;
    const { notes } = req.body;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Admin authentication required'
      });
    }

    // Get the bank statement
    const statements = await executeQuery(
      `SELECT id, user_id, upload_method, user_status, verification_status
       FROM user_bank_statements 
       WHERE user_id = ? 
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (statements.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No bank statement found for this user'
      });
    }

    const statement = statements[0];

    // Check if this is a manual upload
    const isManualUpload = statement.upload_method === 'manual' ||
      statement.user_status === 'uploaded' ||
      statement.user_status === 'under_review';

    if (!isManualUpload) {
      return res.status(400).json({
        success: false,
        message: 'This is not a manual upload. Use the verify endpoint for Digitap verification.'
      });
    }

    // Update to verified status
    await executeQuery(
      `UPDATE user_bank_statements 
       SET user_status = 'verified',
           verification_status = 'api_verified',
           verification_decision = 'approved',
           verification_notes = ?,
           verified_by = ?,
           verified_at = NOW(),
           status = 'completed',
           updated_at = NOW()
       WHERE id = ?`,
      [notes || 'Manual upload approved by admin', adminId, statement.id]
    );

    // Also update the user's loan application step if applicable
    // This allows user to proceed to the next step
    try {
      await executeQuery(
        `UPDATE loan_applications 
         SET current_step = 'bank-details', updated_at = NOW() 
         WHERE user_id = ? AND status IN ('pending', 'under_review', 'in_progress', 'submitted')
         AND (current_step IS NULL OR current_step = 'bank-statement')`,
        [userId]
      );
      console.log(`✅ Updated loan application step to 'bank-details' for user ${userId}`);
    } catch (stepError) {
      console.warn('Could not update loan application step:', stepError.message);
    }

    // Log activity
    try {
      await logActivity({
        userId: userId,
        action: 'bank_statement_manual_approved',
        details: {
          statementId: statement.id,
          adminId: adminId,
          notes: notes
        },
        adminId: adminId
      });
    } catch (logError) {
      console.warn('Failed to log activity:', logError);
    }

    console.log(`✅ Manual bank statement approved for user ${userId} by admin ${adminId}`);

    res.json({
      success: true,
      message: 'Manual bank statement upload approved successfully',
      data: {
        statementId: statement.id,
        userStatus: 'verified',
        verificationStatus: 'api_verified',
        verificationDecision: 'approved'
      }
    });
  } catch (error) {
    console.error('Manual approval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve manual upload'
    });
  }
});

/**
 * POST /api/admin/bank-statement/:userId/upload-file/:statementId
 * Upload a file for an existing bank statement (converts to manual upload)
 */
router.post('/:userId/upload-file/:statementId', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { userId, statementId } = req.params;
    const adminId = req.admin?.id;
    const multer = require('multer');
    const upload = multer({ 
      storage: multer.memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
      fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
          cb(null, true);
        } else {
          cb(new Error('Only PDF files are allowed'));
        }
      }
    });
    const { uploadToS3 } = require('../services/s3Service');

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Admin authentication required'
      });
    }

    // Handle file upload using multer
    upload.single('file')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: 'File upload error: ' + err.message
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      try {
        // Get the statement
        const statements = await executeQuery(
          `SELECT id, user_id, client_ref_num, file_path, file_name, bank_name
           FROM user_bank_statements 
           WHERE id = ? AND user_id = ?`,
          [statementId, userId]
        );

        if (statements.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'Bank statement not found'
          });
        }

        const statement = statements[0];

        // Upload to S3
        const s3Result = await uploadToS3(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype,
          {
            folder: 'user-bank-statements',
            userId: userId,
            documentType: 'statement',
            isPublic: false
          }
        );

        if (!s3Result || !s3Result.success) {
          return res.status(500).json({
            success: false,
            message: 'Failed to upload file to storage'
          });
        }

        const s3Key = s3Result.key;
        console.log(`✅ File uploaded for statement ${statementId}: S3 Key: ${s3Key}`);

        // Update statement with file and change to manual upload
        await executeQuery(
          `UPDATE user_bank_statements 
           SET file_path = ?,
               file_name = ?,
               file_size = ?,
               upload_method = 'manual',
               status = 'pending',
               verification_status = 'not_started',
               updated_at = NOW()
           WHERE id = ? AND user_id = ?`,
          [s3Key, req.file.originalname, req.file.size, statementId, userId]
        );

        res.json({
          status: 'success',
          success: true,
          message: 'File uploaded successfully',
          data: {
            statementId: statement.id,
            fileName: req.file.originalname,
            fileSize: req.file.size,
            uploadMethod: 'manual'
          }
        });
      } catch (error) {
        console.error('Upload file error:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to upload file'
        });
      }
    });
  } catch (error) {
    console.error('Upload file error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload file'
    });
  }
});

module.exports = router;

