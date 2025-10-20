const express = require('express');
const router = express.Router();
const { executeQuery, initializeDatabase } = require('../config/database');
const { requireAuth } = require('../middleware/jwtAuth');
const axios = require('axios');

/**
 * POST /api/digilocker/generate-kyc-url
 * Generate Digilocker KYC URL for user verification
 */
router.post('/generate-kyc-url', requireAuth, async (req, res) => {
  const { mobile_number, application_id, first_name, last_name, email } = req.body;
  const userId = req.userId;

  if (!mobile_number || !application_id) {
    return res.status(400).json({
      success: false,
      message: 'Mobile number and application ID are required'
    });
  }

  // Validate mobile number format
  if (!/^[6-9]\d{9}$/.test(mobile_number)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid mobile number format'
    });
  }

  try {
    await initializeDatabase();
    
    // Generate unique UID for this KYC request
    const uid = `PC${userId}_${application_id}_${Date.now()}`;
    
    // Prepare Digilocker API request
    const digilockerRequest = {
      uid: uid,
      emailId: email || "",
      firstName: first_name || "",
      lastName: last_name || "",
      isHideExplanationScreen: false,
      isSendOtp: false,
      mobile: mobile_number,
      redirectionUrl: `${process.env.APP_URL || 'https://pocketcredit.in'}/api/digiwebhook`,
      serviceId: process.env.DIGILOCKER_SERVICE_ID || "4"
    };

    console.log('🔐 Generating Digilocker KYC URL:', { uid, mobile: mobile_number });

    // Call Digilocker API to generate KYC URL
    const digilockerResponse = await axios.post(
      process.env.DIGILOCKER_API_URL || 'https://svcint.digitap.work/wrap/demo/api/ent/v1/kyc/generate-url',
      digilockerRequest,
      {
        headers: {
          'Authorization': process.env.DIGILOCKER_AUTH_TOKEN || 'MjcxMDg3NTA6UlRwYzRpVjJUQnFNdFhKRWR6a1BhRG5CRDVZTk9BRkI=',
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Digilocker API Response:', digilockerResponse.data);

    if (digilockerResponse.data.code === "200" && digilockerResponse.data.model) {
      const { url, transactionId, kycUrl } = digilockerResponse.data.model;

      // Store KYC verification record with transaction ID
      const kycCheck = await executeQuery(
        'SELECT id FROM kyc_verifications WHERE user_id = ? AND application_id = ?',
        [userId, application_id]
      );

      const verificationData = JSON.stringify({
        uid,
        transactionId,
        url,
        kycUrl,
        mobile_number,
        timestamp: new Date().toISOString()
      });

      if (kycCheck.length > 0) {
        // Update existing record
        await executeQuery(
          `UPDATE kyc_verifications 
           SET kyc_status = 'pending', 
               kyc_method = 'digilocker', 
               mobile_number = ?, 
               verification_data = ?,
               updated_at = NOW() 
           WHERE id = ?`,
          [mobile_number, verificationData, kycCheck[0].id]
        );
      } else {
        // Create new record
        await executeQuery(
          `INSERT INTO kyc_verifications 
           (user_id, application_id, kyc_status, kyc_method, mobile_number, verification_data, created_at, updated_at) 
           VALUES (?, ?, 'pending', 'digilocker', ?, ?, NOW(), NOW())`,
          [userId, application_id, mobile_number, verificationData]
        );
      }

      res.json({
        success: true,
        message: 'KYC URL generated successfully',
        data: {
          kycUrl: kycUrl,
          transactionId: transactionId,
          shortUrl: url
        }
      });
    } else {
      throw new Error('Invalid response from Digilocker API');
    }

  } catch (error) {
    console.error('❌ Digilocker KYC URL generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate KYC URL. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/digilocker/kyc-status/:applicationId
 * Get KYC verification status for an application
 */
router.get('/kyc-status/:applicationId', requireAuth, async (req, res) => {
  const { applicationId } = req.params;
  const userId = req.userId;

  try {
    await initializeDatabase();
    
    const results = await executeQuery(
      `SELECT kyc_status, kyc_method, verified_at, created_at 
       FROM kyc_verifications 
       WHERE user_id = ? AND application_id = ? 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [userId, applicationId]
    );

    if (results.length === 0) {
      return res.json({
        success: true,
        data: {
          kyc_status: 'pending',
          kyc_method: null,
          verified_at: null
        }
      });
    }

    res.json({
      success: true,
      data: results[0]
    });

  } catch (error) {
    console.error('Get KYC status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch KYC status'
    });
  }
});

module.exports = router;

