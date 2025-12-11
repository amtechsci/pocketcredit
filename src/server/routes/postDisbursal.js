const express = require('express');
const router = express.Router();
const multer = require('multer');
const { executeQuery, initializeDatabase } = require('../config/database');
const { requireAuth } = require('../middleware/jwtAuth');
const { uploadToS3 } = require('../services/s3Service');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Get post-disbursal progress
router.get('/progress/:applicationId', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const { applicationId } = req.params;
    const userId = req.userId;

    // Verify application belongs to user
    const [application] = await executeQuery(
      'SELECT id, user_id, status FROM loan_applications WHERE id = ? AND user_id = ?',
      [applicationId, userId]
    );

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Check if columns exist first
    let existingColumns = [];
    try {
      const columnsResult = await executeQuery(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'loan_applications' 
          AND COLUMN_NAME IN ('enach_done', 'selfie_captured', 'selfie_verified', 'references_completed', 'kfs_viewed', 'agreement_signed', 'post_disbursal_step')
      `);

      if (columnsResult && Array.isArray(columnsResult) && columnsResult.length > 0) {
        existingColumns = columnsResult.map(col => col.COLUMN_NAME || col.column_name);
      }
    } catch (colError) {
      console.error('Error checking columns:', colError);
      // Continue with empty array - will return default values
    }
    
    // Build SELECT query with only existing columns
    const selectFields = [];
    if (existingColumns.includes('enach_done')) selectFields.push('enach_done');
    if (existingColumns.includes('selfie_captured')) selectFields.push('selfie_captured');
    if (existingColumns.includes('selfie_verified')) selectFields.push('selfie_verified');
    if (existingColumns.includes('references_completed')) selectFields.push('references_completed');
    if (existingColumns.includes('kfs_viewed')) selectFields.push('kfs_viewed');
    if (existingColumns.includes('agreement_signed')) selectFields.push('agreement_signed');
    if (existingColumns.includes('post_disbursal_step')) selectFields.push('post_disbursal_step as current_step');

    // If no columns exist, return default values
    if (selectFields.length === 0) {
      return res.json({
        success: true,
        data: {
          enach_done: false,
          selfie_captured: false,
          selfie_verified: false,
          references_completed: false,
          kfs_viewed: false,
          agreement_signed: false,
          current_step: 1
        },
        warning: 'Database migration required. Please run the migration script.'
      });
    }

    const [progress] = await executeQuery(
      `SELECT ${selectFields.join(', ')} FROM loan_applications WHERE id = ?`,
      [applicationId]
    );

    res.json({
      success: true,
      data: {
        enach_done: progress.enach_done || false,
        selfie_captured: progress.selfie_captured || false,
        selfie_verified: progress.selfie_verified || false,
        references_completed: progress.references_completed || false,
        kfs_viewed: progress.kfs_viewed || false,
        agreement_signed: progress.agreement_signed || false,
        current_step: progress.current_step || 1
      }
    });
  } catch (error) {
    console.error('Error fetching post-disbursal progress:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch progress'
    });
  }
});

// Update post-disbursal progress
router.put('/progress/:applicationId', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const { applicationId } = req.params;
    const userId = req.userId;
    const {
      enach_done,
      selfie_captured,
      selfie_verified,
      references_completed,
      kfs_viewed,
      agreement_signed,
      current_step
    } = req.body;

    // Verify application belongs to user
    const [application] = await executeQuery(
      'SELECT id, user_id, status FROM loan_applications WHERE id = ? AND user_id = ?',
      [applicationId, userId]
    );

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Check if post-disbursal columns exist
    let existingColumns = [];
    try {
      const columnsResult = await executeQuery(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'loan_applications' 
          AND COLUMN_NAME IN ('enach_done', 'selfie_captured', 'selfie_verified', 'references_completed', 'kfs_viewed', 'agreement_signed', 'post_disbursal_step')
      `);

      if (columnsResult && Array.isArray(columnsResult) && columnsResult.length > 0) {
        existingColumns = columnsResult.map(col => col.COLUMN_NAME || col.column_name);
      }
    } catch (colError) {
      console.error('Error checking columns:', colError);
      // Continue with empty array - will return error message
    }
    
    // If columns don't exist, return helpful error message
    if (existingColumns.length === 0) {
      console.error('Post-disbursal columns do not exist. Please run the migration.');
      return res.status(500).json({
        success: false,
        message: 'Database migration required. Please run: node src/server/migrations/add_post_disbursal_status_and_progress.js',
        error: 'Missing database columns'
      });
    }

    // Build update query dynamically, only for columns that exist
    const updates = [];
    const params = [];

    if (enach_done !== undefined && existingColumns.includes('enach_done')) {
      updates.push('enach_done = ?');
      params.push(enach_done ? 1 : 0);
    }
    if (selfie_captured !== undefined && existingColumns.includes('selfie_captured')) {
      updates.push('selfie_captured = ?');
      params.push(selfie_captured ? 1 : 0);
    }
    if (selfie_verified !== undefined && existingColumns.includes('selfie_verified')) {
      updates.push('selfie_verified = ?');
      params.push(selfie_verified ? 1 : 0);
    }
    if (references_completed !== undefined && existingColumns.includes('references_completed')) {
      updates.push('references_completed = ?');
      params.push(references_completed ? 1 : 0);
    }
    if (kfs_viewed !== undefined && existingColumns.includes('kfs_viewed')) {
      updates.push('kfs_viewed = ?');
      params.push(kfs_viewed ? 1 : 0);
    }
    if (agreement_signed !== undefined && existingColumns.includes('agreement_signed')) {
      updates.push('agreement_signed = ?');
      params.push(agreement_signed ? 1 : 0);
    }
    if (current_step !== undefined && existingColumns.includes('post_disbursal_step')) {
      updates.push('post_disbursal_step = ?');
      params.push(current_step);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update or columns do not exist'
      });
    }

    updates.push('updated_at = NOW()');
    params.push(applicationId);

    await executeQuery(
      `UPDATE loan_applications SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    res.json({
      success: true,
      message: 'Progress updated successfully'
    });
  } catch (error) {
    console.error('Error updating post-disbursal progress:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage,
      sql: error.sql
    });
    
    // Check if it's a column not found error
    if (error.code === 'ER_BAD_FIELD_ERROR' || error.sqlMessage?.includes('Unknown column')) {
      return res.status(500).json({
        success: false,
        message: 'Database migration required. Please run the migration script to add post-disbursal columns.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to update progress',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Upload selfie for verification
router.post('/upload-selfie', requireAuth, upload.single('selfie'), async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;
    const { applicationId } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Verify application belongs to user
    const [application] = await executeQuery(
      'SELECT id, user_id, status FROM loan_applications WHERE id = ? AND user_id = ?',
      [applicationId, userId]
    );

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Upload to S3
    const fileName = `selfies/${userId}/${applicationId}-${Date.now()}.jpg`;
    const s3Url = await uploadToS3(
      req.file.buffer,
      fileName,
      req.file.mimetype,
      { folder: 'loan-selfies' }
    );

    // Update application with selfie URL and mark as captured
    await executeQuery(
      `UPDATE loan_applications 
       SET selfie_image_url = ?, selfie_captured = 1, updated_at = NOW() 
       WHERE id = ?`,
      [s3Url, applicationId]
    );

    res.json({
      success: true,
      data: {
        selfie_url: s3Url,
        message: 'Selfie uploaded successfully'
      }
    });
  } catch (error) {
    console.error('Error uploading selfie:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload selfie'
    });
  }
});

// Complete all post-disbursal steps
router.post('/complete/:applicationId', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const { applicationId } = req.params;
    const userId = req.userId;

    // Verify application belongs to user
    const [application] = await executeQuery(
      'SELECT id, user_id, status FROM loan_applications WHERE id = ? AND user_id = ?',
      [applicationId, userId]
    );

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Verify all steps are completed
    const [progress] = await executeQuery(
      `SELECT 
        enach_done,
        selfie_verified,
        references_completed,
        kfs_viewed,
        agreement_signed
      FROM loan_applications 
      WHERE id = ?`,
      [applicationId]
    );

    const allStepsComplete = 
      progress.enach_done &&
      progress.selfie_verified &&
      progress.references_completed &&
      progress.kfs_viewed &&
      progress.agreement_signed;

    if (!allStepsComplete) {
      return res.status(400).json({
        success: false,
        message: 'All steps must be completed before finalizing'
      });
    }

    // Update status to ready_for_disbursement
    await executeQuery(
      `UPDATE loan_applications 
       SET status = 'ready_for_disbursement', updated_at = NOW() 
       WHERE id = ?`,
      [applicationId]
    );

    res.json({
      success: true,
      data: {
        message: 'Post-disbursal flow completed successfully',
        status: 'ready_for_disbursement'
      }
    });
  } catch (error) {
    console.error('Error completing post-disbursal flow:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete flow'
    });
  }
});

module.exports = router;

