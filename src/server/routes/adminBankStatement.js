const express = require('express');
const router = express.Router();
const { executeQuery, initializeDatabase } = require('../config/database');
const { authenticateAdmin } = require('../middleware/auth');
const {
  uploadBankStatementPDF,
  checkBankStatementStatus,
  retrieveBankStatementReport,
  generateClientRefNum,
  generateBankStatementURL
} = require('../services/digitapBankStatementService');
const { getPresignedUrl, downloadFromS3 } = require('../services/s3Service');
const { logActivity } = require('../middleware/activityLogger');

/**
 * GET /api/admin/bank-statement/:userId
 * Get bank statement details for a user (admin only)
 */
router.get('/:userId', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { userId } = req.params;
    const adminId = req.admin?.id;

    // Get the most recent bank statement for this user
    // Also verify user_id matches to prevent cross-user data leaks
    const statements = await executeQuery(
      `SELECT 
        id, user_id, client_ref_num, request_id, txn_id, mobile_number, bank_name,
        upload_method, file_path, file_name, file_size, status, user_status, 
        verification_status, verified_by, verified_at, verification_decision, verification_notes,
        report_data, transaction_data, created_at, updated_at
       FROM user_bank_statements 
       WHERE user_id = ? 
       ORDER BY updated_at DESC, created_at DESC 
       LIMIT 1`,
      [userId]
    );

    // Additional safety check: verify the statement belongs to the requested user
    if (statements.length > 0 && statements[0].user_id !== parseInt(userId)) {
      console.error(`⚠️  Security: Statement user_id (${statements[0].user_id}) doesn't match requested userId (${userId})`);
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (statements.length === 0) {
      return res.json({
        success: true,
        data: {
          hasStatement: false,
          statement: null
        }
      });
    }

    const statement = statements[0];

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
    // For manual uploads, file_path stores the S3 key, so we need to generate a presigned URL
    let fileUrl = statement.file_path;
    if (statement.file_path && !statement.file_path.startsWith('http')) {
      try {
        // file_path is an S3 key, generate presigned URL (expires in 1 hour)
        fileUrl = await getPresignedUrl(statement.file_path, 3600);
      } catch (error) {
        console.error('Failed to generate presigned URL:', error);
        // Keep original file_path if presigned URL generation fails
        fileUrl = statement.file_path;
      }
    }

    res.json({
      success: true,
      data: {
        hasStatement: true,
        statement: {
          ...statement,
          file_path: fileUrl, // Return presigned URL for access
          reportData,
          transactionData
        }
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

        await executeQuery(
          `UPDATE user_bank_statements 
           SET verification_status = ?,
               request_id = ?,
               txn_id = ?,
               verified_by = ?,
               verified_at = NOW(),
               updated_at = NOW()
           WHERE id = ?`,
          [verificationStatus, requestId, txnId, adminId, statementId]
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
 * POST /api/admin/bank-statement/:userId/check-status
 * Check Digitap verification status (admin only)
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
 * POST /api/admin/bank-statement/:userId/fetch-report
 * Fetch verification report from Digitap (admin only)
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

module.exports = router;

