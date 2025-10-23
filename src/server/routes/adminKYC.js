const express = require('express');
const router = express.Router();
const { executeQuery, initializeDatabase } = require('../config/database');
const { requireAdminAuth } = require('../middleware/adminAuth');

/**
 * GET /api/admin/kyc/user/:userId
 * Get all KYC verifications for a user
 */
router.get('/user/:userId', requireAdminAuth, async (req, res) => {
  const { userId } = req.params;

  try {
    await initializeDatabase();

    const kycRecords = await executeQuery(
      `SELECT 
        kv.id,
        kv.user_id,
        kv.application_id,
        kv.kyc_status,
        kv.kyc_method,
        kv.mobile_number,
        kv.verified_at,
        kv.verification_data,
        kv.created_at,
        kv.updated_at,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        la.loan_amount,
        la.status as loan_status
      FROM kyc_verifications kv
      LEFT JOIN users u ON kv.user_id = u.id
      LEFT JOIN loan_applications la ON kv.application_id = la.id
      WHERE kv.user_id = ?
      ORDER BY kv.created_at DESC`,
      [userId]
    );

    if (kycRecords.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // Parse verification_data JSON for each record
    const parsedRecords = kycRecords.map(record => {
      let verificationData = {};
      try {
        verificationData = typeof record.verification_data === 'string' 
          ? JSON.parse(record.verification_data) 
          : record.verification_data;
        
        // Parse nested stringified JSON if needed
        if (verificationData.kycData && typeof verificationData.kycData === 'string') {
          verificationData.kycData = JSON.parse(verificationData.kycData);
        }
        if (verificationData.docs && typeof verificationData.docs === 'string') {
          verificationData.docs = JSON.parse(verificationData.docs);
        }
      } catch (e) {
        console.error('Error parsing verification_data:', e);
      }

      return {
        ...record,
        verification_data: verificationData
      };
    });

    res.json({ success: true, data: parsedRecords });
  } catch (error) {
    console.error('Error fetching KYC records:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * GET /api/admin/kyc/application/:applicationId
 * Get KYC verification for a specific application
 */
router.get('/application/:applicationId', requireAdminAuth, async (req, res) => {
  const { applicationId } = req.params;

  try {
    await initializeDatabase();

    const kycRecords = await executeQuery(
      `SELECT 
        kv.*,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        la.loan_amount,
        la.status as loan_status
      FROM kyc_verifications kv
      LEFT JOIN users u ON kv.user_id = u.id
      LEFT JOIN loan_applications la ON kv.application_id = la.id
      WHERE kv.application_id = ?
      ORDER BY kv.created_at DESC
      LIMIT 1`,
      [applicationId]
    );

    if (kycRecords.length === 0) {
      return res.status(404).json({ success: false, message: 'KYC record not found' });
    }

    const record = kycRecords[0];
    let verificationData = {};
    try {
      verificationData = typeof record.verification_data === 'string' 
        ? JSON.parse(record.verification_data) 
        : record.verification_data;
      
      // Parse nested stringified JSON
      if (verificationData.kycData && typeof verificationData.kycData === 'string') {
        verificationData.kycData = JSON.parse(verificationData.kycData);
      }
      if (verificationData.docs && typeof verificationData.docs === 'string') {
        verificationData.docs = JSON.parse(verificationData.docs);
      }
    } catch (e) {
      console.error('Error parsing verification_data:', e);
    }

    res.json({ 
      success: true, 
      data: {
        ...record,
        verification_data: verificationData
      }
    });
  } catch (error) {
    console.error('Error fetching KYC record:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * GET /api/admin/kyc/all
 * Get all KYC verifications (paginated)
 */
router.get('/all', requireAdminAuth, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  const status = req.query.status; // pending, verified, failed

  try {
    await initializeDatabase();

    let whereClause = '';
    let params = [];
    
    if (status) {
      whereClause = 'WHERE kv.kyc_status = ?';
      params.push(status);
    }

    const kycRecords = await executeQuery(
      `SELECT 
        kv.id,
        kv.user_id,
        kv.application_id,
        kv.kyc_status,
        kv.kyc_method,
        kv.mobile_number,
        kv.verified_at,
        kv.created_at,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        la.loan_amount,
        la.status as loan_status
      FROM kyc_verifications kv
      LEFT JOIN users u ON kv.user_id = u.id
      LEFT JOIN loan_applications la ON kv.application_id = la.id
      ${whereClause}
      ORDER BY kv.created_at DESC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Get total count
    const countResult = await executeQuery(
      `SELECT COUNT(*) as total FROM kyc_verifications kv ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    res.json({ 
      success: true, 
      data: kycRecords,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching KYC records:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;



