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

  // Optional name validation per provider rules
  const nameRegex = /^[A-Za-z][A-Za-z .\-_' ]{0,44}$/; // start alpha, allowed ., -, ', space, _ up to 45
  if (first_name && !nameRegex.test(first_name)) {
    return res.status(400).json({ success: false, message: 'Invalid first name format' });
  }
  if (last_name && !nameRegex.test(last_name)) {
    return res.status(400).json({ success: false, message: 'Invalid last name format' });
  }
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return res.status(400).json({ success: false, message: 'Invalid email format' });
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
      // APP_URL: production includes /api, development doesn't
      redirectionUrl: (() => {
        const isDevelopment = process.env.NODE_ENV === 'development' || (!process.env.NODE_ENV && !process.env.APP_URL);
        const appUrl = process.env.APP_URL || (isDevelopment ? 'http://localhost:3002' : 'https://pocketcredit.in/api');
        // Routes are mounted at /api/digiwebhook, so add /api for dev, or just /digiwebhook for prod
        return isDevelopment ? `${appUrl}/api/digiwebhook` : `${appUrl}/digiwebhook`;
      })(),
      serviceId: process.env.DIGILOCKER_SERVICE_ID || "4"
    };

    console.log('🔐 Generating Digilocker KYC URL:', { uid, mobile: mobile_number });

    // Call Digilocker API to generate KYC URL
    const digilockerResponse = await axios.post(
      process.env.DIGILOCKER_API_URL || 'https://svcint.digitap.work/wrap/demo/api/ent/v1/kyc/generate-url',
      digilockerRequest,
      {
        headers: {
          // Per docs: base64(client_id:client_secret)
          'ent_authorization': process.env.DIGILOCKER_AUTH_TOKEN || 'MjcxMDg3NTA6UlRwYzRpVjJUQnFNdFhKRWR6a1BhRG5CRDVZTk9BRkI=',
          // Backward compatibility if gateway expects Authorization
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
      `SELECT kyc_status, kyc_method, verified_at, created_at, verification_data 
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

/**
 * POST /api/digilocker/fetch-kyc-data
 * Fetch actual KYC data from Digilocker using transactionId
 */
router.post('/fetch-kyc-data', requireAuth, async (req, res) => {
  const { transaction_id } = req.body;
  const userId = req.userId;

  if (!transaction_id) {
    return res.status(400).json({
      success: false,
      message: 'Transaction ID is required'
    });
  }

  try {
    await initializeDatabase();

    console.log('📥 Fetching KYC data from Digilocker for txnId:', transaction_id);

    // Call Digilocker API to fetch actual KYC data
    // TODO: Replace with actual Digilocker fetch data endpoint
    const digilockerResponse = await axios.post(
      process.env.DIGILOCKER_FETCH_API_URL || 'https://svcint.digitap.work/wrap/demo/api/ent/v1/kyc/fetch-data',
      {
        transactionId: transaction_id
      },
      {
        headers: {
          'Authorization': process.env.DIGILOCKER_AUTH_TOKEN || 'MjcxMDg3NTA6UlRwYzRpVjJUQnFNdFhKRWR6a1BhRG5CRDVZTk9BRkI=',
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Digilocker KYC Data Response:', digilockerResponse.data);

    if (digilockerResponse.data && digilockerResponse.data.code === "200") {
      const kycData = digilockerResponse.data.model || digilockerResponse.data.data;

      // Update kyc_verifications table with full data
      await executeQuery(
        `UPDATE kyc_verifications 
         SET verification_data = JSON_SET(
           COALESCE(verification_data, '{}'),
           '$.kycData', ?
         )
         WHERE user_id = ? 
         AND JSON_EXTRACT(verification_data, '$.transactionId') = ?`,
        [JSON.stringify(kycData), userId, transaction_id]
      );

      res.json({
        success: true,
        message: 'KYC data fetched successfully',
        data: kycData
      });
    } else {
      throw new Error('Invalid response from Digilocker fetch API');
    }

  } catch (error) {
    console.error('❌ Fetch KYC data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch KYC data from Digilocker',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/digilocker/get-details/:transactionId
 * Proxy to Digitap get-digilocker-details (returns profile data)
 */
router.get('/get-details/:transactionId', requireAuth, async (req, res) => {
  const { transactionId } = req.params;
  const userId = req.userId;
  if (!transactionId) {
    return res.status(400).json({ success: false, message: 'Transaction ID is required' });
  }
  try {
    await initializeDatabase();
    // Demo/UAT environment by default
    const apiUrl = process.env.DIGILOCKER_GET_DETAILS_URL || 'https://svcint.digitap.work/wrap/demo/api/ent/v1/kyc/get-digilocker-details';
    const apiResp = await axios.post(
      apiUrl,
      { transactionId },
      { headers: { 'ent_authorization': process.env.DIGILOCKER_AUTH_TOKEN || 'MjcxMDg3NTA6UlRwYzRpVjJUQnFNdFhKRWR6a1BhRG5CRDVZTk9BRkI=', 'Content-Type': 'application/json' } }
    );
    if (!apiResp.data || apiResp.data.code !== '200') {
      return res.status(400).json({ success: false, message: apiResp.data?.msg || 'Failed to fetch details' });
    }
    const details = apiResp.data.model || apiResp.data.data;
    // Persist under verification_data.kycData (parse if it's a string)
    const kycDataParsed = typeof details === 'string' ? JSON.parse(details) : details;
    await executeQuery(
      `UPDATE kyc_verifications SET verification_data = JSON_SET(COALESCE(verification_data,'{}'), '$.kycData', CAST(? AS JSON)) 
       WHERE user_id = ? AND JSON_EXTRACT(verification_data, '$.transactionId') = ?`,
      [JSON.stringify(kycDataParsed), userId, transactionId]
    );
    res.json({ success: true, data: details });
  } catch (e) {
    console.error('get-details error:', e);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * GET /api/digilocker/list-docs/:transactionId
 * Proxy to Digitap digilocker/list-docs (returns doc links)
 */
router.get('/list-docs/:transactionId', requireAuth, async (req, res) => {
  const { transactionId } = req.params;
  const userId = req.userId;
  if (!transactionId) {
    return res.status(400).json({ success: false, message: 'Transaction ID is required' });
  }
  try {
    await initializeDatabase();
    // Demo/UAT environment by default
    const apiUrl = process.env.DIGILOCKER_LIST_DOCS_URL || 'https://svcint.digitap.work/wrap/demo/api/ent/v1/digilocker/list-docs';
    const apiResp = await axios.post(
      apiUrl,
      { transactionId },
      { headers: { 'ent_authorization': process.env.DIGILOCKER_AUTH_TOKEN || 'MjcxMDg3NTA6UlRwYzRpVjJUQnFNdFhKRWR6a1BhRG5CRDVZTk9BRkI=', 'Content-Type': 'application/json' } }
    );
    if (!apiResp.data || apiResp.data.code !== '200') {
      return res.status(400).json({ success: false, message: apiResp.data?.msg || 'Failed to list docs' });
    }
    const docs = apiResp.data.model || apiResp.data.data;
    // Persist under verification_data.docs (parse if it's a string)
    const docsParsed = typeof docs === 'string' ? JSON.parse(docs) : docs;
    await executeQuery(
      `UPDATE kyc_verifications SET verification_data = JSON_SET(COALESCE(verification_data,'{}'), '$.docs', CAST(? AS JSON)) 
       WHERE user_id = ? AND JSON_EXTRACT(verification_data, '$.transactionId') = ?`,
      [JSON.stringify(docsParsed), userId, transactionId]
    );
    res.json({ success: true, data: docs });
  } catch (e) {
    console.error('list-docs error:', e);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;

