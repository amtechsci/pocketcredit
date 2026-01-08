const express = require('express');
const router = express.Router();
const multer = require('multer');
const { executeQuery, initializeDatabase } = require('../config/database');
const { requireAuth } = require('../middleware/jwtAuth');
const { uploadToS3 } = require('../services/s3Service');
const { compareFaces, downloadImage } = require('../services/faceMatchService');
const axios = require('axios');

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

    // Check if user is a repeat customer (has cleared loans)
    let isRepeatCustomer = false;
    try {
      const clearedLoans = await executeQuery(
        'SELECT id FROM loan_applications WHERE user_id = ? AND status = "cleared" LIMIT 1',
        [userId]
      );
      if (clearedLoans && clearedLoans.length > 0) {
        isRepeatCustomer = true;
        console.log(`🔄 Repeat customer detected for user ${userId}`);
      }
    } catch (repeatCheckError) {
      console.error('Error checking for repeat customer:', repeatCheckError);
    }

    // Check if columns exist first
    let existingColumns = [];
    try {
      const columnsResult = await executeQuery(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'loan_applications' 
          AND COLUMN_NAME IN ('enach_done', 'selfie_captured', 'selfie_verified', 'references_completed', 'kfs_viewed', 'agreement_signed', 'bank_confirm_done', 'post_disbursal_step')
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
    if (existingColumns.includes('bank_confirm_done')) selectFields.push('bank_confirm_done');
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

    // Check if user has any existing active E-NACH mandates from previous loans
    let hasActiveEnach = progress.enach_done || false;
    
    if (!hasActiveEnach) {
      try {
        const activeEnachMandates = await executeQuery(
          `SELECT id FROM enach_subscriptions 
           WHERE user_id = ? 
           AND (status IN ('ACTIVE', 'AUTHENTICATED', 'BANK_APPROVAL_PENDING') 
                OR mandate_status = 'APPROVED')
           LIMIT 1`,
          [userId]
        );
        
        if (activeEnachMandates && activeEnachMandates.length > 0) {
          hasActiveEnach = true;
          console.log(`✅ User ${userId} has existing active E-NACH mandate. Auto-completing E-NACH step for loan ${applicationId}.`);
          
          // Update the loan application to mark enach_done = true
          if (existingColumns.includes('enach_done')) {
            await executeQuery(
              'UPDATE loan_applications SET enach_done = 1 WHERE id = ?',
              [applicationId]
            );
          }
        }
      } catch (enachCheckError) {
        console.error('Error checking for active E-NACH mandates:', enachCheckError);
        // Continue with current enach_done value if check fails
      }
    }

    // Check if user has existing verified selfie from previous loans
    let hasVerifiedSelfie = (progress.selfie_captured && progress.selfie_verified) || false;
    
    if (!hasVerifiedSelfie) {
      try {
        const existingSelfie = await executeQuery(
          `SELECT selfie_image_url FROM loan_applications 
           WHERE user_id = ? 
           AND selfie_captured = 1 
           AND selfie_verified = 1 
           AND selfie_image_url IS NOT NULL
           AND id != ?
           ORDER BY updated_at DESC
           LIMIT 1`,
          [userId, applicationId]
        );
        
        if (existingSelfie && existingSelfie.length > 0 && existingSelfie[0].selfie_image_url) {
          hasVerifiedSelfie = true;
          const selfieUrl = existingSelfie[0].selfie_image_url;
          console.log(`✅ User ${userId} has existing verified selfie. Auto-completing Selfie step for loan ${applicationId}.`);
          
          // Update the current loan application with existing selfie and mark as verified
          if (existingColumns.includes('selfie_captured') && existingColumns.includes('selfie_verified')) {
            await executeQuery(
              `UPDATE loan_applications 
               SET selfie_image_url = ?, selfie_captured = 1, selfie_verified = 1 
               WHERE id = ?`,
              [selfieUrl, applicationId]
            );
          }
        }
      } catch (selfieCheckError) {
        console.error('Error checking for existing verified selfie:', selfieCheckError);
        // Continue with current selfie status if check fails
      }
    }

    // Check if user has existing references (3+ refs + alternate mobile)
    let hasCompletedReferences = progress.references_completed || false;
    
    if (!hasCompletedReferences) {
      try {
        // Check for 3 references in references table
        const userReferences = await executeQuery(
          'SELECT COUNT(*) as ref_count FROM `references` WHERE user_id = ?',
          [userId]
        );
        
        // Check for alternate mobile in users table
        const userAlternate = await executeQuery(
          'SELECT alternate_mobile FROM users WHERE id = ? AND alternate_mobile IS NOT NULL',
          [userId]
        );
        
        const hasThreeRefs = userReferences && userReferences[0] && userReferences[0].ref_count >= 3;
        const hasAlternateMobile = userAlternate && userAlternate.length > 0 && userAlternate[0].alternate_mobile;
        
        if (hasThreeRefs && hasAlternateMobile) {
          hasCompletedReferences = true;
          console.log(`✅ User ${userId} has existing references (${userReferences[0].ref_count} refs + alternate mobile). Auto-completing References step for loan ${applicationId}.`);
          
          // Update the loan application to mark references_completed = true
          if (existingColumns.includes('references_completed')) {
            await executeQuery(
              'UPDATE loan_applications SET references_completed = 1 WHERE id = ?',
              [applicationId]
            );
          }
        }
      } catch (referencesCheckError) {
        console.error('Error checking for existing references:', referencesCheckError);
        // Continue with current references status if check fails
      }
    }

    res.json({
      success: true,
      data: {
        enach_done: hasActiveEnach,
        selfie_captured: hasVerifiedSelfie,
        selfie_verified: hasVerifiedSelfie,
        references_completed: hasCompletedReferences,
        kfs_viewed: progress.kfs_viewed || false,
        agreement_signed: progress.agreement_signed || false,
        bank_confirm_done: progress.bank_confirm_done || false,
        is_repeat_customer: isRepeatCustomer,
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
      bank_confirm_done,
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
          AND COLUMN_NAME IN ('enach_done', 'selfie_captured', 'selfie_verified', 'references_completed', 'kfs_viewed', 'agreement_signed', 'bank_confirm_done', 'post_disbursal_step')
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

    // SECURITY: Validate eNACH completion before allowing enach_done to be set to true
    if (enach_done === true && existingColumns.includes('enach_done')) {
      // Check if there's an active eNACH subscription for this loan application
      try {
        const enachCheck = await executeQuery(
          `SELECT subscription_id, status, mandate_status 
           FROM enach_subscriptions 
           WHERE loan_application_id = ? 
             AND (status IN ('ACTIVE', 'BANK_APPROVAL_PENDING', 'AUTHENTICATED') 
                  OR mandate_status IN ('APPROVED', 'ACTIVE'))
           ORDER BY created_at DESC 
           LIMIT 1`,
          [applicationId]
        );

        if (!enachCheck || enachCheck.length === 0) {
          return res.status(403).json({
            success: false,
            message: 'Cannot mark eNACH as done: No active eNACH subscription found. Please complete eNACH registration first.',
            error: 'SECURITY: eNACH bypass attempt prevented'
          });
        }

        const subscription = enachCheck[0];
        console.log(`[Security] Validating eNACH completion for app ${applicationId}:`, {
          subscription_id: subscription.subscription_id,
          status: subscription.status,
          mandate_status: subscription.mandate_status
        });

        // Additional validation: Ensure subscription is actually active/approved
        if (!['ACTIVE', 'BANK_APPROVAL_PENDING', 'AUTHENTICATED'].includes(subscription.status) &&
            !['APPROVED', 'ACTIVE'].includes(subscription.mandate_status)) {
          return res.status(403).json({
            success: false,
            message: 'Cannot mark eNACH as done: eNACH subscription is not active or approved.',
            error: 'SECURITY: Invalid eNACH status'
          });
        }
      } catch (enachError) {
        console.error('[Security] Error validating eNACH:', enachError);
        // If table doesn't exist or query fails, reject the request for security
        return res.status(403).json({
          success: false,
          message: 'Cannot mark eNACH as done: Unable to verify eNACH status.',
          error: 'SECURITY: eNACH validation failed'
        });
      }
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
      
      // If agreement is being signed, update status based on loan type
      // Repeat loans: repeat_disbursal -> ready_to_repeat_disbursal
      // Regular loans: disbursal -> ready_for_disbursement
      if (agreement_signed) {
        const newStatus = isRepeatLoan ? 'ready_to_repeat_disbursal' : 'ready_for_disbursement';
        updates.push('status = ?');
        params.push(newStatus);
        console.log(`[Post-Disbursal] Agreement signed - updating status from ${application.status} to ${newStatus}`);
      }
    }
    if (bank_confirm_done !== undefined && existingColumns.includes('bank_confirm_done')) {
      updates.push('bank_confirm_done = ?');
      params.push(bank_confirm_done ? 1 : 0);
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

    // Upload selfie to S3 first
    const fileName = `selfies/${userId}/${applicationId}-${Date.now()}.jpg`;
    const s3Url = await uploadToS3(
      req.file.buffer,
      fileName,
      req.file.mimetype,
      { folder: 'loan-selfies' }
    );

    console.log(`📸 Selfie uploaded to S3: ${s3Url}`);

    // Update application with selfie URL and mark as captured
    await executeQuery(
      `UPDATE loan_applications 
       SET selfie_image_url = ?, selfie_captured = 1, updated_at = NOW() 
       WHERE id = ?`,
      [s3Url, applicationId]
    );

    // Now perform face match verification
    try {
      console.log(`🔍 Starting face match verification for application ${applicationId}...`);

      // Get Digilocker photo from kyc_verifications
      const kycResults = await executeQuery(
        `SELECT verification_data 
         FROM kyc_verifications 
         WHERE user_id = ? 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [userId]
      );

      if (!kycResults || kycResults.length === 0) {
        console.warn('⚠️ No KYC verification data found - skipping face match');
        return res.json({
          success: true,
          data: {
            selfie_url: s3Url,
            message: 'Selfie uploaded successfully. Face verification skipped - no KYC data found.',
            verification: {
              skipped: true,
              reason: 'No KYC data'
            }
          }
        });
      }

      const verificationData = kycResults[0].verification_data;
      let kycData = null;

      // Parse verification_data JSON
      if (typeof verificationData === 'string') {
        kycData = JSON.parse(verificationData);
      } else {
        kycData = verificationData;
      }

      // Extract Digilocker photo
      // The photo could be:
      // 1. Base64 string in kycData.image (from Aadhaar XML)
      // 2. URL in documents array
      let digilockerPhotoBase64 = null;
      let digilockerPhotoUrl = null;

      // Parse kycData.kycData if it's a JSON string
      let parsedKycData = null;
      if (kycData.kycData) {
        if (typeof kycData.kycData === 'string') {
          try {
            parsedKycData = JSON.parse(kycData.kycData);
            console.log('✅ Parsed kycData.kycData from JSON string');
          } catch (e) {
            console.error('❌ Error parsing kycData.kycData:', e);
            parsedKycData = null;
          }
        } else {
          parsedKycData = kycData.kycData;
        }
      }

      // Check for base64 image first (most common from Aadhaar KYC)
      if (parsedKycData && parsedKycData.image) {
        digilockerPhotoBase64 = parsedKycData.image;
        console.log(`📸 Found Digilocker photo as base64 string (${digilockerPhotoBase64.length} chars)`);
      }

      // If no base64 image, look for photo URLs
      if (!digilockerPhotoBase64) {
        // Check various possible locations for photo URL
        if (parsedKycData) {
          const kyc = parsedKycData;

          // Look for photo in documents array
          if (kyc.digilockerFiles && Array.isArray(kyc.digilockerFiles)) {
            const photoDoc = kyc.digilockerFiles.find(doc =>
              doc.docType === 'PHOTO' ||
              doc.docType === 'profile_photo' ||
              doc.document_type === 'PHOTO'
            );
            digilockerPhotoUrl = photoDoc?.url || photoDoc?.docLink || photoDoc?.uri;
          }

          // Also check docs array
          if (!digilockerPhotoUrl && kyc.docs && Array.isArray(kyc.docs)) {
            const photoDoc = kyc.docs.find(doc =>
              doc.docType === 'PHOTO' ||
              doc.docType === 'profile_photo' ||
              doc.document_type === 'PHOTO'
            );
            digilockerPhotoUrl = photoDoc?.url || photoDoc?.docLink || photoDoc?.uri;
          }

          // Check direct photo_url field
          if (!digilockerPhotoUrl) {
            digilockerPhotoUrl = kyc.photo_url || kyc.photoUrl || kyc.profile_photo;
          }
        }

        // Also check in docs array at root level
        if (!digilockerPhotoUrl && kycData.docs && Array.isArray(kycData.docs)) {
          const photoDoc = kycData.docs.find(doc =>
            doc.docType === 'PHOTO' ||
            doc.docType === 'profile_photo' ||
            doc.document_type === 'PHOTO'
          );
          digilockerPhotoUrl = photoDoc?.url || photoDoc?.docLink || photoDoc?.uri;
        }
      }

      // Check if we have either base64 or URL
      if (!digilockerPhotoBase64 && !digilockerPhotoUrl) {
        console.warn('⚠️ No Digilocker photo found in KYC data');
        console.log('KYC Data keys:', Object.keys(kycData));
        if (parsedKycData) {
          console.log('parsedKycData keys:', Object.keys(parsedKycData));
          console.log('parsedKycData has image?', !!parsedKycData.image);
        } else if (kycData.kycData) {
          console.log('kycData.kycData type:', typeof kycData.kycData);
          if (typeof kycData.kycData === 'string') {
            console.log('kycData.kycData is a JSON string (needs parsing)');
          } else {
            console.log('kycData.kycData keys:', Object.keys(kycData.kycData));
          }
        }

        return res.json({
          success: true,
          data: {
            selfie_url: s3Url,
            message: 'Selfie uploaded successfully. Face verification skipped - no Digilocker photo found.',
            verification: {
              skipped: true,
              reason: 'No Digilocker photo'
            }
          }
        });
      }

      // Get Digilocker photo as buffer
      let digilockerPhotoBuffer;

      if (digilockerPhotoBase64) {
        // Photo is already base64, convert to buffer
        console.log(`✅ Using base64 Digilocker photo from kycData.image`);
        digilockerPhotoBuffer = Buffer.from(digilockerPhotoBase64, 'base64');
      } else if (digilockerPhotoUrl) {
        // Photo is a URL, need to download it
        console.log(`📥 Found Digilocker photo URL: ${digilockerPhotoUrl.substring(0, 50)}...`);

        try {
          digilockerPhotoBuffer = await downloadImage(digilockerPhotoUrl);
        } catch (downloadError) {
          console.error('❌ Failed to download Digilocker photo:', downloadError.message);
          return res.json({
            success: true,
            data: {
              selfie_url: s3Url,
              message: 'Selfie uploaded successfully. Face verification failed - could not download Digilocker photo.',
              verification: {
                skipped: true,
                reason: 'Photo download failed',
                error: downloadError.message
              }
            }
          });
        }
      }

      // Compare faces using face match API
      console.log('🎯 Calling face match API...');
      const faceMatchResult = await compareFaces(
        req.file.buffer,           // Selfie
        digilockerPhotoBuffer,     // Digilocker photo
        applicationId
      );

      console.log('Face match result:', faceMatchResult);

      // Determine if verification passed (confidence > 70%)
      const verificationPassed = faceMatchResult.success &&
        faceMatchResult.match &&
        faceMatchResult.confidence >= 70;

      // Update verification status in database
      if (verificationPassed) {
        await executeQuery(
          `UPDATE loan_applications 
           SET selfie_verified = 1, updated_at = NOW() 
           WHERE id = ?`,
          [applicationId]
        );

        // Store face match result in kyc_verifications
        await executeQuery(
          `UPDATE kyc_verifications 
           SET verification_data = JSON_SET(
             COALESCE(verification_data, '{}'),
             '$.faceMatch', ?
           )
           WHERE user_id = ?`,
          [JSON.stringify(faceMatchResult), userId]
        );
      }

      res.json({
        success: true,
        data: {
          selfie_url: s3Url,
          message: verificationPassed
            ? 'Selfie verified successfully'
            : 'Face verification failed - please try again',
          verification: {
            verified: verificationPassed,
            match: faceMatchResult.match,
            confidence: faceMatchResult.confidence,
            details: faceMatchResult.details
          }
        }
      });

    } catch (faceMatchError) {
      console.error('❌ Face match verification error:', faceMatchError);

      // Return success for upload but indicate verification failure
      res.json({
        success: true,
        data: {
          selfie_url: s3Url,
          message: 'Selfie uploaded but verification failed. Please try again.',
          verification: {
            verified: false,
            error: faceMatchError.message
          }
        }
      });
    }

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

    // Check if this is a repeat loan (repeat_disbursal status)
    const isRepeatLoan = application.status === 'repeat_disbursal';

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

    // Update status based on loan type
    // Repeat loans: repeat_disbursal -> ready_to_repeat_disbursal
    // Regular loans: disbursal -> ready_for_disbursement
    const newStatus = isRepeatLoan ? 'ready_to_repeat_disbursal' : 'ready_for_disbursement';
    await executeQuery(
      `UPDATE loan_applications 
       SET status = ?, updated_at = NOW() 
       WHERE id = ?`,
      [newStatus, applicationId]
    );

    console.log(`[Post-Disbursal] Flow completed - status updated from ${application.status} to ${newStatus}`);

    res.json({
      success: true,
      data: {
        message: 'Post-disbursal flow completed successfully',
        status: newStatus
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

