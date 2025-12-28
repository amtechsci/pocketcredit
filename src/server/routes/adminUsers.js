const express = require('express');
const { authenticateAdmin } = require('../middleware/auth');
const { executeQuery, initializeDatabase } = require('../config/database');
const router = express.Router();

// Get all users with filters and pagination
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();

    const {
      page = 1,
      limit = 20,
      status = 'all',
      search = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    console.log('🔍 Users request:', { search, status, page, limit });

    // Build the base query
    let baseQuery = `
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.phone as mobile,
        u.status,
        u.kyc_completed,
        u.created_at as createdAt,
        u.updated_at as updatedAt,
        u.last_login_at as lastLogin,
        COUNT(la.id) as totalApplications,
        SUM(CASE WHEN la.status = 'approved' THEN 1 ELSE 0 END) as approvedApplications,
        SUM(CASE WHEN la.status = 'rejected' THEN 1 ELSE 0 END) as rejectedApplications
      FROM users u
      LEFT JOIN loan_applications la ON u.id = la.user_id
    `;

    const whereConditions = [];
    const queryParams = [];

    // Search filter
    if (search) {
      whereConditions.push(`(
        u.first_name LIKE ? OR 
        u.last_name LIKE ? OR 
        u.email LIKE ? OR 
        u.phone LIKE ?
      )`);
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Status filter
    if (status && status !== 'all') {
      // Map 'hold' to 'on_hold' for backward compatibility
      const statusValue = status === 'hold' ? 'on_hold' : status;
      whereConditions.push('u.status = ?');
      queryParams.push(statusValue);
    }

    // Add WHERE clause if conditions exist
    if (whereConditions.length > 0) {
      baseQuery += ' WHERE ' + whereConditions.join(' AND ');
    }

    // Add GROUP BY
    baseQuery += ' GROUP BY u.id';

    // Add ORDER BY clause
    const validSortFields = {
      'name': 'u.first_name',
      'email': 'u.email',
      'status': 'u.status',
      'createdAt': 'u.created_at',
      'lastLogin': 'u.last_login_at'
    };

    const sortField = validSortFields[sortBy] || 'u.created_at';
    const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';
    baseQuery += ` ORDER BY ${sortField} ${sortDirection}`;

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(DISTINCT u.id) as total
      FROM users u
      ${whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : ''}
    `;

    const countResult = await executeQuery(countQuery, queryParams);
    const totalUsers = countResult[0].total;

    // Add pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    baseQuery += ` LIMIT ${parseInt(limit)} OFFSET ${offset}`;

    // Execute the main query
    console.log('🔍 Executing users query with params:', queryParams);
    console.log('🔍 Query:', baseQuery);

    let users;
    try {
      users = await executeQuery(baseQuery, queryParams);
      console.log('🔍 Users query executed successfully, got', users.length, 'results');
    } catch (queryError) {
      console.error('❌ Users query execution error:', queryError);
      throw queryError;
    }

    // Transform the data to match the expected format
    const usersWithData = users.map(user => ({
      id: user.id,
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unknown User',
      email: user.email || '',
      mobile: user.mobile || '',
      status: user.status || 'active',
      kycCompleted: user.kyc_completed || false,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      totalApplications: parseInt(user.totalApplications) || 0,
      approvedApplications: parseInt(user.approvedApplications) || 0,
      rejectedApplications: parseInt(user.rejectedApplications) || 0
    }));

    res.json({
      status: 'success',
      data: {
        users: usersWithData,
        total: totalUsers,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalUsers / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch users'
    });
  }
});

// Get user details by ID
router.get('/:id', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();

    const { id } = req.params;

    const userQuery = `
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.phone as mobile,
        u.status,
        u.kyc_completed,
        u.created_at as createdAt,
        u.updated_at as updatedAt,
        u.last_login_at as lastLogin,
        u.date_of_birth,
        u.gender,
        u.marital_status,
        u.pan_number,
        u.aadhar_number,
        COUNT(la.id) as totalApplications,
        SUM(CASE WHEN la.status = 'approved' THEN 1 ELSE 0 END) as approvedApplications,
        SUM(CASE WHEN la.status = 'rejected' THEN 1 ELSE 0 END) as rejectedApplications
      FROM users u
      LEFT JOIN loan_applications la ON u.id = la.user_id
      WHERE u.id = ?
      GROUP BY u.id
    `;

    const users = await executeQuery(userQuery, [id]);

    if (users.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    const user = users[0];

    // If PAN is not in users table, try to get it from digitap_responses
    let panNumber = user.pan_number;
    if (!panNumber) {
      try {
        const digitapQuery = `
          SELECT response_data 
          FROM digitap_responses 
          WHERE user_id = ? 
          ORDER BY created_at DESC 
          LIMIT 1
        `;
        const digitapResults = await executeQuery(digitapQuery, [id]);
        if (digitapResults.length > 0 && digitapResults[0].response_data) {
          const responseData = typeof digitapResults[0].response_data === 'string'
            ? JSON.parse(digitapResults[0].response_data)
            : digitapResults[0].response_data;
          panNumber = responseData.pan || null;
        }
      } catch (e) {
        console.error('Error fetching PAN from digitap_responses:', e);
      }
    }



    // Fetch bank details
    let bankInfo = {
      bankName: 'N/A',
      accountNumber: 'N/A',
      ifscCode: 'N/A',
      accountType: 'N/A',
      accountHolderName: 'N/A',
      branchName: 'N/A',
      verificationStatus: 'N/A',
      verificationDate: null
    };

    try {
      // Use SELECT * to avoid errors if specific columns don't exist yet
      const bankQuery = `
        SELECT *
        FROM bank_details
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const bankResults = await executeQuery(bankQuery, [id]);

      if (bankResults.length > 0) {
        const bank = bankResults[0];
        bankInfo = {
          id: bank.id,
          bankName: bank.bank_name || 'N/A',
          accountNumber: bank.account_number || 'N/A',
          ifscCode: bank.ifsc_code || 'N/A',
          accountType: bank.account_type || 'Savings',
          accountHolderName: bank.account_holder_name || 'N/A',
          branchName: bank.branch_name || 'N/A',
          // Check for both is_verified and verification_status
          verificationStatus: bank.is_verified ? 'verified' : (bank.verification_status || 'pending'),
          verifiedDate: bank.is_verified ? bank.updated_at : null,
          addedDate: bank.created_at,
          isPrimary: bank.is_primary ? true : false
        };
      }
    } catch (e) {
      console.error('Error fetching bank details:', e);
    }

    const userData = {
      id: user.id,
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unknown User',
      email: user.email || '',
      mobile: user.mobile || '',
      status: user.status || 'active',
      kycCompleted: user.kyc_completed || false,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      dateOfBirth: user.date_of_birth,
      gender: user.gender,
      maritalStatus: user.marital_status,
      panNumber: panNumber,
      aadharNumber: user.aadhar_number,
      totalApplications: parseInt(user.totalApplications) || 0,
      approvedApplications: parseInt(user.approvedApplications) || 0,
      rejectedApplications: parseInt(user.rejectedApplications) || 0,
      bankInfo: bankInfo
    };

    res.json({
      status: 'success',
      data: userData
    });

  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch user details'
    });
  }
});

// Update user status
router.patch('/:id/status', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();

    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['active', 'inactive', 'pending'].includes(status)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid status. Must be active, inactive, or pending'
      });
    }

    const updateQuery = 'UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?';
    const result = await executeQuery(updateQuery, [status, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    res.json({
      status: 'success',
      message: 'User status updated successfully'
    });

  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update user status'
    });
  }
});

// Delete user
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();

    const { id } = req.params;

    // Check if user has any applications
    const applicationsQuery = 'SELECT COUNT(*) as count FROM loan_applications WHERE user_id = ?';
    const applicationsResult = await executeQuery(applicationsQuery, [id]);

    if (applicationsResult[0].count > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot delete user with existing loan applications'
      });
    }

    const deleteQuery = 'DELETE FROM users WHERE id = ?';
    const result = await executeQuery(deleteQuery, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    res.json({
      status: 'success',
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete user'
    });
  }
});

// Get user credit analytics data
router.get('/:id/credit-analytics', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();

    const { id } = req.params;

    // Fetch credit check data from credit_checks table
    const query = `
      SELECT 
        id,
        user_id,
        request_id,
        client_ref_num,
        credit_score,
        is_eligible,
        rejection_reasons,
        has_settlements,
        has_writeoffs,
        has_suit_files,
        has_wilful_default,
        negative_indicators,
        full_report,
        checked_at,
        created_at,
        updated_at
      FROM credit_checks
      WHERE user_id = ?
      ORDER BY checked_at DESC
      LIMIT 1
    `;

    const results = await executeQuery(query, [id]);

    if (results.length === 0) {
      return res.json({
        status: 'success',
        message: 'No credit analytics data found for this user',
        data: null
      });
    }

    const creditData = results[0];

    // Parse JSON fields
    if (creditData.rejection_reasons) {
      try {
        creditData.rejection_reasons = JSON.parse(creditData.rejection_reasons);
      } catch (e) {
        creditData.rejection_reasons = [];
      }
    }

    if (creditData.negative_indicators) {
      try {
        creditData.negative_indicators = JSON.parse(creditData.negative_indicators);
      } catch (e) {
        creditData.negative_indicators = null;
      }
    }

    if (creditData.full_report) {
      try {
        // Check if it's already an object or needs parsing
        if (typeof creditData.full_report === 'string') {
          creditData.full_report = JSON.parse(creditData.full_report);
        }
      } catch (e) {
        console.error('❌ Error parsing credit report full_report:', e);
        creditData.full_report = null;
      }
    }

    res.json({
      status: 'success',
      message: 'Credit analytics data retrieved successfully',
      data: creditData
    });

  } catch (error) {
    console.error('Get credit analytics error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve credit analytics data'
    });
  }
});

// Perform credit check for a user (admin only)
router.post('/:id/perform-credit-check', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { id } = req.params;
    const userId = parseInt(id);

    if (!userId || isNaN(userId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid user ID'
      });
    }

    // Check if credit check already exists for this user
    const existingCheck = await executeQuery(
      'SELECT id, credit_score, is_eligible, checked_at FROM credit_checks WHERE user_id = ?',
      [userId]
    );

    if (existingCheck.length > 0) {
      return res.json({
        status: 'success',
        message: 'Credit check already performed for this user',
        data: {
          already_checked: true,
          credit_score: existingCheck[0].credit_score,
          is_eligible: existingCheck[0].is_eligible,
          checked_at: existingCheck[0].checked_at
        }
      });
    }

    // Get user details for credit check
    const user = await executeQuery(
      'SELECT first_name, last_name, phone, email, pan_number, date_of_birth FROM users WHERE id = ?',
      [userId]
    );

    if (!user || user.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    const userData = user[0];

    // If PAN or DOB not in users table, try to get from digitap_responses (pre-fill data)
    if (!userData.pan_number || !userData.date_of_birth) {
      const digitapData = await executeQuery(
        'SELECT response_data FROM digitap_responses WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
        [userId]
      );

      if (digitapData && digitapData.length > 0 && digitapData[0].response_data) {
        const prefillData = typeof digitapData[0].response_data === 'string'
          ? JSON.parse(digitapData[0].response_data)
          : digitapData[0].response_data;

        // Use pre-fill data if available
        if (!userData.pan_number && prefillData.pan) {
          userData.pan_number = prefillData.pan;
        }
        if (!userData.date_of_birth && prefillData.dob) {
          // Convert DD/MM/YYYY to YYYY-MM-DD if needed
          if (prefillData.dob.includes('/')) {
            const dobParts = prefillData.dob.split('/');
            if (dobParts.length === 3) {
              userData.date_of_birth = `${dobParts[2]}-${dobParts[1]}-${dobParts[0]}`;
            }
          } else {
            userData.date_of_birth = prefillData.dob;
          }
        }
      }
    }

    // Validate required fields after checking digitap data
    if (!userData.pan_number || !userData.date_of_birth) {
      return res.status(400).json({
        status: 'error',
        message: 'PAN and Date of Birth are required for credit check. User profile is incomplete.'
      });
    }

    // Import credit analytics service
    const creditAnalyticsService = require('../services/creditAnalyticsService');

    // Request credit report from Experian
    const clientRefNum = `PC${userId}_${Date.now()}`;

    console.log('🔍 Requesting credit report for user:', userId);
    console.log('📋 User data:', {
      phone: userData.phone,
      pan: userData.pan_number,
      dob: userData.date_of_birth,
      email: userData.email
    });

    let creditReportResponse;
    try {
      creditReportResponse = await creditAnalyticsService.requestCreditReport({
        client_ref_num: clientRefNum,
        mobile_no: userData.phone,
        first_name: userData.first_name || 'User',
        last_name: userData.last_name || '',
        date_of_birth: userData.date_of_birth, // YYYY-MM-DD
        email: userData.email || `user${userId}@pocketcredit.in`,
        pan: userData.pan_number,
        device_ip: req.ip || '192.168.1.1'
      });
      
      console.log('✅ Credit report received:', {
        result_code: creditReportResponse?.result_code,
        request_id: creditReportResponse?.request_id
      });
    } catch (apiError) {
      console.error('❌ Credit report API error:', apiError.message);
      throw new Error(`Failed to request credit report: ${apiError.message}`);
    }

    if (!creditReportResponse) {
      throw new Error('Credit report API returned empty response');
    }

    // Validate eligibility
    let validation;
    try {
      validation = creditAnalyticsService.validateEligibility(creditReportResponse);
      console.log('✅ Eligibility validation completed:', {
        isEligible: validation.isEligible,
        creditScore: validation.creditScore
      });
    } catch (validationError) {
      console.error('❌ Eligibility validation error:', validationError.message);
      throw new Error(`Failed to validate eligibility: ${validationError.message}`);
    }

    // Save credit check to database
    try {
      await executeQuery(
        `INSERT INTO credit_checks (
          user_id, request_id, client_ref_num, 
          credit_score, result_code, api_message, 
          is_eligible, rejection_reasons,
          has_settlements, has_writeoffs, has_suit_files, has_wilful_default,
          negative_indicators, full_report, checked_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          userId,
          creditReportResponse.request_id || null,
          clientRefNum,
          validation.creditScore || null,
          creditReportResponse.result_code || null,
          creditReportResponse.message || null,
          validation.isEligible ? 1 : 0,
          validation.reasons.length > 0 ? JSON.stringify(validation.reasons) : null,
          validation.negativeIndicators.hasSettlements ? 1 : 0,
          validation.negativeIndicators.hasWriteOffs ? 1 : 0,
          validation.negativeIndicators.hasSuitFiles ? 1 : 0,
          validation.negativeIndicators.hasWilfulDefault ? 1 : 0,
          JSON.stringify(validation.negativeIndicators),
          JSON.stringify(creditReportResponse)
        ]
      );
      console.log('✅ Credit check saved to database');
    } catch (dbError) {
      console.error('❌ Database error saving credit check:', dbError.message);
      // Continue even if database save fails, but log the error
      console.error('Database error details:', dbError);
    }

    // If not eligible, update user profile to on_hold
    if (!validation.isEligible) {
      const holdReason = `Credit check failed: ${validation.reasons.join(', ')}`;
      const holdDuration = 60; // 60 days hold

      await executeQuery(
        `UPDATE users 
         SET status = 'on_hold', 
             eligibility_status = 'not_eligible',
             application_hold_reason = ?, 
             updated_at = NOW()
         WHERE id = ?`,
        [holdReason, userId]
      );
    }

    res.json({
      status: 'success',
      message: validation.isEligible ? 'Credit check passed' : 'Credit check failed',
      data: {
        is_eligible: validation.isEligible,
        credit_score: validation.creditScore,
        reasons: validation.reasons,
        request_id: creditReportResponse.request_id
      }
    });

  } catch (error) {
    console.error('❌ Admin perform credit check error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      code: error.code
    });
    
    // Provide more detailed error message
    let errorMessage = 'Failed to perform credit check';
    if (error.message) {
      errorMessage += `: ${error.message}`;
    }
    if (error.response?.data?.message) {
      errorMessage += ` (${error.response.data.message})`;
    }
    
    res.status(500).json({
      status: 'error',
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      details: process.env.NODE_ENV === 'development' ? {
        stack: error.stack,
        response: error.response?.data
      } : undefined
    });
  }
});

module.exports = router;
