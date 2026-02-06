const express = require('express');
const { authenticateAdmin } = require('../middleware/auth');
const { executeQuery, initializeDatabase } = require('../config/database');
const { downloadFromS3 } = require('../services/s3Service');
// pdf-parse v2.x - try to get the actual parsing function
// The module exports an object, but should have a callable default function
const pdfParseModule = require('pdf-parse');
// In pdf-parse v2.x, the default export should still be the parsing function
// Try accessing it via .default or use the module itself if it's callable
const pdf = pdfParseModule.default || pdfParseModule;
const router = express.Router();

/**
 * Extract PAN number from PDF text
 * PAN format: 5 letters, 4 digits, 1 letter (e.g., FPFPM8829N)
 * @param {string} text - PDF text content
 * @returns {string|null} - Extracted PAN number or null
 */
function extractPANFromText(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }

  // PAN pattern: 5 uppercase letters, 4 digits, 1 uppercase letter
  // Look for patterns like "Permanent Account Number FPFPM8829N" or just the PAN itself
  const panPattern = /\b([A-Z]{5}[0-9]{4}[A-Z]{1})\b/g;
  const matches = text.match(panPattern);

  if (matches && matches.length > 0) {
    // Return the first valid PAN found
    const pan = matches[0].toUpperCase();
    console.log(`   📄 Extracted PAN from PDF: ${pan}`);
    return pan;
  }

  // Alternative: Look for "Permanent Account Number" followed by PAN
  const panWithLabel = /Permanent\s+Account\s+Number\s+([A-Z]{5}[0-9]{4}[A-Z]{1})/gi;
  const labelMatch = text.match(panWithLabel);
  if (labelMatch) {
    const pan = labelMatch[0].replace(/Permanent\s+Account\s+Number\s+/gi, '').trim().toUpperCase();
    console.log(`   📄 Extracted PAN from PDF (with label): ${pan}`);
    return pan;
  }

  return null;
}

/**
 * Extract PAN from PANCR PDF document
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @returns {Promise<string|null>} - Extracted PAN number or null
 */
async function extractPANFromPDF(pdfBuffer) {
  let parser = null;
  try {
    // Ensure buffer is a Buffer object
    if (!Buffer.isBuffer(pdfBuffer)) {
      pdfBuffer = Buffer.from(pdfBuffer);
    }

    console.log('   🔍 Attempting to parse PDF, buffer size:', pdfBuffer.length);

    // pdf-parse v2.4.5 uses PDFParse class
    const { PDFParse } = require('pdf-parse');

    // Create parser instance with the PDF buffer
    parser = new PDFParse({ data: pdfBuffer });

    // Extract text from PDF
    const result = await parser.getText();

    const text = result.text || '';
    console.log('   ✅ PDF parsed successfully, text length:', text.length);
    return extractPANFromText(text);
  } catch (error) {
    console.error('   ❌ Error extracting PAN from PDF:', error.message);
    console.error('   Error stack:', error.stack);
    return null;
  } finally {
    // Clean up parser resources
    if (parser) {
      try {
        await parser.destroy();
      } catch (destroyError) {
        // Ignore destroy errors
      }
    }
  }
}

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
      if (status === 'registered') {
        // Registered: Users who just completed OTP step (phone_verified = 1 AND profile_completion_step < 2 or NULL)
        // These are users who just completed OTP step and haven't moved to step 2 (employment quick check) yet
        whereConditions.push(`(u.phone_verified = 1 AND (u.profile_completion_step < 2 OR u.profile_completion_step IS NULL))`);
      } else if (status === 'approved') {
        // Approved: Users who completed 2nd page (employment quick check) and got approved
        // profile_completion_step >= 2, status = 'active', eligibility_status = 'eligible'
        whereConditions.push(`(u.profile_completion_step >= 2 AND u.status = 'active' AND u.eligibility_status = 'eligible')`);
      } else if (status === 'experian_hold') {
        // Experian Hold: Users held due to BRE conditions failure
        // status = 'on_hold' AND application_hold_reason LIKE 'Experian Hold%'
        whereConditions.push(`(u.status = 'on_hold' AND u.application_hold_reason LIKE 'Experian Hold%')`);
      } else {
        // Map 'hold' to 'on_hold' for backward compatibility
        const statusValue = status === 'hold' ? 'on_hold' : status;
        whereConditions.push('u.status = ?');
        queryParams.push(statusValue);
      }
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
    let users;
    try {
      users = await executeQuery(baseQuery, queryParams);
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
        previous_credit_score,
        result_code,
        api_message,
        is_eligible,
        rejection_reasons,
        has_settlements,
        has_writeoffs,
        has_suit_files,
        has_wilful_default,
        negative_indicators,
        full_report,
        pdf_url,
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

    // Generate presigned URL if pdf_url is an S3 key (starts with "pocket/" or doesn't start with "http")
    let pdfUrl = creditData.pdf_url;
    if (pdfUrl && !pdfUrl.startsWith('http')) {
      try {
        // pdf_url is an S3 key, generate presigned URL (expires in 1 hour)
        const { getPresignedUrl } = require('../services/s3Service');
        pdfUrl = await getPresignedUrl(pdfUrl, 3600);
        console.log('✅ Generated presigned URL for credit report PDF');
      } catch (error) {
        console.error('❌ Failed to generate presigned URL for credit report PDF:', error);
        // Keep original S3 key if presigned URL generation fails
      }
    }

    res.json({
      status: 'success',
      message: 'Credit analytics data retrieved successfully',
      data: {
        ...creditData,
        pdf_url: pdfUrl
      }
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

    // Check if force parameter is provided to allow refetching
    const forceRefetch = req.body?.force === true || req.query?.force === 'true';

    // Check if credit check already exists for this user
    const existingCheck = await executeQuery(
      'SELECT id, credit_score, is_eligible, checked_at FROM credit_checks WHERE user_id = ?',
      [userId]
    );

    // If credit check exists and not forcing refetch, return existing data
    if (existingCheck.length > 0 && !forceRefetch) {
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
      'SELECT first_name, last_name, phone, email, pan_number, DATE_FORMAT(date_of_birth, "%Y-%m-%d") as date_of_birth FROM users WHERE id = ?',
      [userId]
    );

    if (!user || user.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    const userData = user[0];

    // Priority 1: Check for PANCR document in kyc_documents and extract PAN via OCR
    if (!userData.pan_number) {
      try {
        const pancrDocs = await executeQuery(
          'SELECT id, s3_key, file_name FROM kyc_documents WHERE user_id = ? AND document_type = ? AND s3_key IS NOT NULL ORDER BY created_at DESC LIMIT 1',
          [userId, 'PANCR']
        );

        if (pancrDocs && pancrDocs.length > 0 && pancrDocs[0].s3_key) {
          console.log(`📄 Found PANCR document, extracting PAN via OCR...`);
          try {
            // Download PDF from S3
            const pdfBuffer = await downloadFromS3(pancrDocs[0].s3_key);
            console.log(`✅ Downloaded PANCR PDF from S3, size: ${pdfBuffer.length} bytes`);

            // Extract PAN from PDF
            const extractedPAN = await extractPANFromPDF(pdfBuffer);

            if (extractedPAN) {
              // Validate PAN format
              const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
              if (panRegex.test(extractedPAN)) {
                // Update users table with extracted PAN
                await executeQuery(
                  `UPDATE users 
                   SET pan_number = ?,
                       updated_at = NOW()
                   WHERE id = ?`,
                  [extractedPAN, userId]
                );
                console.log(`✅ Saved extracted PAN to users table: ${extractedPAN}`);

                // Also save to verification_records table
                await executeQuery(
                  `INSERT INTO verification_records (user_id, document_type, document_number, verification_status, created_at, updated_at)
                   VALUES (?, 'pan', ?, 'pending', NOW(), NOW())
                   ON DUPLICATE KEY UPDATE
                     document_number = VALUES(document_number),
                     updated_at = NOW()`,
                  [userId, extractedPAN]
                );
                console.log(`✅ Saved PAN to verification_records: ${extractedPAN}`);

                userData.pan_number = extractedPAN;
              } else {
                console.warn(`⚠️ Extracted PAN format invalid: ${extractedPAN}`);
              }
            } else {
              console.warn(`⚠️ Could not extract PAN from PANCR PDF`);
            }
          } catch (ocrError) {
            console.error(`❌ Error processing PANCR document for OCR: ${ocrError.message}`);
          }
        }
      } catch (kycError) {
        console.error(`❌ Error checking kyc_documents for PANCR: ${kycError.message}`);
      }
    }

    // Priority 2: Get PAN from verification_records (if already extracted)
    if (!userData.pan_number) {
      const panVerification = await executeQuery(
        'SELECT document_number FROM verification_records WHERE user_id = ? AND document_type = ? ORDER BY updated_at DESC LIMIT 1',
        [userId, 'pan']
      );

      if (panVerification && panVerification.length > 0 && panVerification[0].document_number) {
        userData.pan_number = panVerification[0].document_number;
        console.log(`✅ Using PAN from verification_records: ${userData.pan_number}`);
      }
    }

    // Priority 2: Get DOB from user_info (Aadhar from Digilocker)
    if (!userData.date_of_birth) {
      const aadharInfo = await executeQuery(
        'SELECT DATE_FORMAT(dob, "%Y-%m-%d") as dob FROM user_info WHERE user_id = ? AND source = ? ORDER BY created_at DESC LIMIT 1',
        [userId, 'digilocker']
      );

      if (aadharInfo && aadharInfo.length > 0 && aadharInfo[0].dob) {
        userData.date_of_birth = aadharInfo[0].dob;
        console.log(`✅ Using DOB from Aadhar (Digilocker): ${userData.date_of_birth}`);
      }
    }

    // Fallback: If PAN or DOB still not found, try to get from digitap_responses (pre-fill data)
    if (!userData.pan_number || !userData.date_of_birth) {
      const digitapData = await executeQuery(
        'SELECT response_data FROM digitap_responses WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
        [userId]
      );

      if (digitapData && digitapData.length > 0 && digitapData[0].response_data) {
        const prefillData = typeof digitapData[0].response_data === 'string'
          ? JSON.parse(digitapData[0].response_data)
          : digitapData[0].response_data;

        // Use pre-fill data if available (only if not already found)
        if (!userData.pan_number && prefillData.pan) {
          userData.pan_number = prefillData.pan;
          console.log(`✅ Using PAN from digitap_responses: ${userData.pan_number}`);
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
          console.log(`✅ Using DOB from digitap_responses: ${userData.date_of_birth}`);
        }
      }
    }

    // Validate required fields after checking all sources
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

    // Normalize email - treat placeholder values as empty
    const placeholderEmails = ['N/A', 'NA', 'n/a', 'na', 'NONE', 'none', 'NULL', 'null', ''];
    const normalizedEmail = userData.email && !placeholderEmails.includes(userData.email.trim().toUpperCase())
      ? userData.email
      : null;

    // Use default email if normalized email is null/empty
    const emailForRequest = normalizedEmail || `user${userId}@pocketcredit.in`;

    let creditReportResponse;
    try {
      creditReportResponse = await creditAnalyticsService.requestCreditReport({
        client_ref_num: clientRefNum,
        mobile_no: userData.phone,
        first_name: userData.first_name || 'User',
        last_name: userData.last_name || '',
        date_of_birth: userData.date_of_birth, // YYYY-MM-DD
        email: emailForRequest,
        pan: userData.pan_number,
        device_ip: req.ip || '192.168.1.1'
      });

      console.log('✅ Credit report received:', {
        result_code: creditReportResponse?.result_code,
        request_id: creditReportResponse?.request_id
      });
    } catch (apiError) {
      console.error('❌ Credit report API error:', apiError.message);

      // Check if it's a service unavailable error
      if (apiError.isServiceUnavailable || apiError.status === 503 || apiError.response?.status === 503) {
        const serviceError = new Error('Credit Analytics service is temporarily unavailable. The external credit check service is down or overloaded. Please try again in a few minutes.');
        serviceError.status = 503;
        serviceError.isServiceUnavailable = true;
        throw serviceError;
      }

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

    // Extract PDF URL from response and download to S3
    let s3PdfKey = null;
    const experianPdfUrl = creditAnalyticsService.extractPdfUrl(creditReportResponse);

    if (experianPdfUrl) {
      console.log('📄 PDF URL extracted from response:', experianPdfUrl);

      try {
        // Download PDF from Experian URL
        const axios = require('axios');
        console.log('📥 Downloading credit report PDF from Experian...');
        const pdfResponse = await axios.get(experianPdfUrl, {
          responseType: 'arraybuffer',
          timeout: 30000,
          headers: {
            'Accept': 'application/pdf'
          }
        });

        const pdfBuffer = Buffer.from(pdfResponse.data);
        console.log(`✅ Downloaded PDF from Experian, size: ${pdfBuffer.length} bytes`);

        // Validate it's a PDF
        if (pdfBuffer.length < 100 || !pdfBuffer.toString('ascii', 0, 4).startsWith('%PDF')) {
          throw new Error('Downloaded file does not appear to be a valid PDF');
        }

        // Upload to S3
        const { uploadGeneratedPDF } = require('../services/s3Service');
        const fileName = `Credit_Report_${clientRefNum}.pdf`;
        const uploadResult = await uploadGeneratedPDF(pdfBuffer, fileName, userId, 'credit-report');
        s3PdfKey = uploadResult.key;
        console.log(`✅ Uploaded credit report PDF to S3: ${s3PdfKey}`);
      } catch (pdfError) {
        console.error('❌ Error downloading/uploading credit report PDF:', pdfError.message);
        // Continue without PDF - don't fail the entire credit check
        // Save the original Experian URL as fallback
        s3PdfKey = experianPdfUrl;
      }
    } else {
      console.log('⚠️ PDF URL not found in credit report response');
    }

    // Save credit check to database (update if exists, insert if new)
    try {
      // If force refetch, get the old credit score before updating
      let previousCreditScore = null;
      if (forceRefetch) {
        const existingCheck = await executeQuery(
          'SELECT credit_score FROM credit_checks WHERE user_id = ?',
          [userId]
        );
        if (existingCheck.length > 0 && existingCheck[0].credit_score !== null) {
          previousCreditScore = existingCheck[0].credit_score;
          console.log(`📊 Saving previous credit score: ${previousCreditScore}`);
        }
      }

      await executeQuery(
        `INSERT INTO credit_checks (
          user_id, request_id, client_ref_num, 
          credit_score, previous_credit_score, result_code, api_message, 
          is_eligible, rejection_reasons,
          has_settlements, has_writeoffs, has_suit_files, has_wilful_default,
          negative_indicators, full_report, pdf_url, checked_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          request_id = VALUES(request_id),
          client_ref_num = VALUES(client_ref_num),
          previous_credit_score = IF(VALUES(previous_credit_score) IS NOT NULL, VALUES(previous_credit_score), previous_credit_score),
          credit_score = VALUES(credit_score),
          result_code = VALUES(result_code),
          api_message = VALUES(api_message),
          is_eligible = VALUES(is_eligible),
          rejection_reasons = VALUES(rejection_reasons),
          has_settlements = VALUES(has_settlements),
          has_writeoffs = VALUES(has_writeoffs),
          has_suit_files = VALUES(has_suit_files),
          has_wilful_default = VALUES(has_wilful_default),
          negative_indicators = VALUES(negative_indicators),
          full_report = VALUES(full_report),
          pdf_url = VALUES(pdf_url),
          checked_at = NOW(),
          updated_at = NOW()`,
        [
          userId,
          creditReportResponse.request_id || null,
          clientRefNum,
          validation.creditScore || null,
          previousCreditScore, // Save previous score when refetching
          creditReportResponse.result_code || null,
          creditReportResponse.message || null,
          validation.isEligible ? 1 : 0,
          validation.reasons.length > 0 ? JSON.stringify(validation.reasons) : null,
          validation.negativeIndicators.hasSettlements ? 1 : 0,
          validation.negativeIndicators.hasWriteOffs ? 1 : 0,
          validation.negativeIndicators.hasSuitFiles ? 1 : 0,
          validation.negativeIndicators.hasWilfulDefault ? 1 : 0,
          JSON.stringify(validation.negativeIndicators),
          JSON.stringify(creditReportResponse),
          s3PdfKey || null
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
      status: error.response?.status || error.status,
      code: error.code,
      isServiceUnavailable: error.isServiceUnavailable
    });

    // Determine HTTP status code
    const httpStatus = error.isServiceUnavailable || error.status === 503 ? 503 : 500;

    // Provide more detailed error message
    let errorMessage = 'Failed to perform credit check';
    if (error.message) {
      errorMessage = error.message; // Use the enhanced error message if available
    } else if (error.response?.data?.message) {
      errorMessage += `: ${error.response.data.message}`;
    }

    res.status(httpStatus).json({
      status: 'error',
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      details: process.env.NODE_ENV === 'development' ? {
        stack: error.stack,
        response: error.response?.data || error.originalError?.response?.data,
        isServiceUnavailable: error.isServiceUnavailable
      } : undefined
    });
  }
});

// Get users in cooling period
router.get('/cooling-period/list', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();

    const {
      page = 1,
      limit = 20,
      search = ''
    } = req.query;

    const pageNum = parseInt(page);
    const pageSize = parseInt(limit);
    const offset = (pageNum - 1) * pageSize;

    // Build query for users in cooling period
    // Cooling period = status = 'on_hold' with reason containing 'cooling period'
    let baseQuery = `
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        u.status,
        u.application_hold_reason,
        u.loan_limit,
        u.created_at,
        u.updated_at
      FROM users u
      WHERE u.status = 'on_hold'
        AND (u.application_hold_reason LIKE '%cooling period%' 
             OR u.application_hold_reason LIKE '%Cooling period%'
             OR u.application_hold_reason LIKE '%COOLING PERIOD%')
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

    if (whereConditions.length > 0) {
      baseQuery += ' AND ' + whereConditions.join(' AND ');
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM (${baseQuery}) as filtered_users`;
    const countResult = await executeQuery(countQuery, queryParams);
    const total = countResult && countResult.length > 0 ? countResult[0].total : 0;

    // Add pagination and ordering
    // Use direct values for LIMIT/OFFSET instead of placeholders to avoid MySQL parameter issues
    baseQuery += ` ORDER BY u.updated_at DESC LIMIT ${parseInt(pageSize)} OFFSET ${parseInt(offset)}`;

    const users = await executeQuery(baseQuery, queryParams);

    res.json({
      status: 'success',
      data: {
        users: users || [],
        total: total,
        page: pageNum,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    });

  } catch (error) {
    console.error('Get cooling period users error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch cooling period users'
    });
  }
});

// GET /api/admin/users/registered/list
// Get users who just completed OTP step
router.get('/registered/list', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const offset = (page - 1) * limit;

    let whereConditions = [];
    let queryParams = [];

    // Registered users: phone_verified = 1 AND profile_completion_step < 2 (or NULL)
    // These are users who just completed OTP step and haven't moved to step 2 (employment quick check) yet
    whereConditions.push(`(u.phone_verified = 1 AND (u.profile_completion_step < 2 OR u.profile_completion_step IS NULL))`);

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

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM users u ${whereClause}`;
    const countResult = await executeQuery(countQuery, queryParams);
    const total = countResult && countResult.length > 0 ? countResult[0].total : 0;

    // Get users
    // Use direct values for LIMIT/OFFSET instead of placeholders to avoid MySQL parameter issues
    const usersQuery = `
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        u.status,
        u.phone_verified,
        u.profile_completion_step,
        DATE_FORMAT(u.created_at, '%Y-%m-%d') as created_at,
        DATE_FORMAT(u.updated_at, '%Y-%m-%d') as updated_at
      FROM users u
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;
    const users = await executeQuery(usersQuery, queryParams);

    res.json({
      status: 'success',
      data: {
        users: users || [],
        total: total,
        page: page,
        limit: limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get registered users error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch registered users'
    });
  }
});

// GET /api/admin/users/approved/list
// Get users who completed 2nd page and moved to next step
router.get('/approved/list', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const offset = (page - 1) * limit;

    let whereConditions = [];
    let queryParams = [];

    // Approved users: profile_completion_step >= 2 AND status = 'active' AND eligibility_status = 'eligible'
    whereConditions.push(`(u.profile_completion_step >= 2 AND u.status = 'active' AND u.eligibility_status = 'eligible')`);

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

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM users u ${whereClause}`;
    const countResult = await executeQuery(countQuery, queryParams);
    const total = countResult && countResult.length > 0 ? countResult[0].total : 0;

    // Get users with employment details
    // Use direct values for LIMIT/OFFSET instead of placeholders to avoid MySQL parameter issues
    const usersQuery = `
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        u.status,
        u.eligibility_status,
        u.profile_completion_step,
        u.employment_type,
        u.income_range,
        DATE_FORMAT(u.date_of_birth, '%Y-%m-%d') as date_of_birth,
        DATE_FORMAT(u.created_at, '%Y-%m-%d') as created_at,
        DATE_FORMAT(u.updated_at, '%Y-%m-%d') as updated_at
      FROM users u
      ${whereClause}
      ORDER BY u.updated_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;
    const users = await executeQuery(usersQuery, queryParams);

    res.json({
      status: 'success',
      data: {
        users: users || [],
        total: total,
        page: page,
        limit: limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get approved users error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch approved users'
    });
  }
});

// GET /api/admin/users/qa-verification/list
// Get users with loan applications in QA Verification status
router.get('/qa-verification/list', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const offset = (page - 1) * limit;

    let whereConditions = [];
    let queryParams = [];

    // QA Verification users: loan_applications.status = 'qa_verification'
    whereConditions.push(`la.status = 'qa_verification'`);

    // Search filter
    if (search) {
      whereConditions.push(`(
        u.first_name LIKE ? OR 
        u.last_name LIKE ? OR 
        u.email LIKE ? OR 
        u.phone LIKE ? OR
        la.application_number LIKE ?
      )`);
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM loan_applications la
      INNER JOIN users u ON la.user_id = u.id
      ${whereClause}
    `;
    const countResult = await executeQuery(countQuery, queryParams);
    const total = countResult && countResult.length > 0 ? countResult[0].total : 0;

    // Get users with loan application details
    const usersQuery = `
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        u.status,
        u.loan_limit,
        la.id as loan_application_id,
        la.application_number,
        la.loan_amount,
        la.status as loan_status,
        DATE_FORMAT(la.created_at, '%Y-%m-%d %H:%i:%s') as created_at,
        DATE_FORMAT(la.updated_at, '%Y-%m-%d %H:%i:%s') as updated_at
      FROM loan_applications la
      INNER JOIN users u ON la.user_id = u.id
      ${whereClause}
      ORDER BY la.updated_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;
    const users = await executeQuery(usersQuery, queryParams);

    res.json({
      status: 'success',
      data: {
        users: users || [],
        total: total,
        page: page,
        limit: limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get QA Verification users error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch QA Verification users'
    });
  }
});

// GET /api/admin/users/account-manager/list
// Get users with loan applications in Account Manager status (account_manager or overdue)
router.get('/account-manager/list', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const offset = (page - 1) * limit;

    let whereConditions = [];
    let queryParams = [];

    // Account Manager: loan_applications.status IN ('account_manager', 'overdue')
    whereConditions.push(`la.status IN ('account_manager', 'overdue')`);

    // Search filter
    if (search) {
      whereConditions.push(`(
        u.first_name LIKE ? OR 
        u.last_name LIKE ? OR 
        u.email LIKE ? OR 
        u.phone LIKE ? OR
        la.application_number LIKE ?
      )`);
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM loan_applications la
      INNER JOIN users u ON la.user_id = u.id
      ${whereClause}
    `;
    const countResult = await executeQuery(countQuery, queryParams);
    const total = countResult && countResult.length > 0 ? countResult[0].total : 0;

    // Get users with loan application details (include disbursed_at, disbursal_amount for account manager)
    const usersQuery = `
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        u.status,
        u.loan_limit,
        la.id as loan_application_id,
        la.application_number,
        la.loan_amount,
        la.disbursal_amount,
        la.disbursed_at,
        la.status as loan_status,
        DATE_FORMAT(la.created_at, '%Y-%m-%d %H:%i:%s') as created_at,
        DATE_FORMAT(la.updated_at, '%Y-%m-%d %H:%i:%s') as updated_at
      FROM loan_applications la
      INNER JOIN users u ON la.user_id = u.id
      ${whereClause}
      ORDER BY la.updated_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;
    const users = await executeQuery(usersQuery, queryParams);

    res.json({
      status: 'success',
      data: {
        users: users || [],
        total: total,
        page: page,
        limit: limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get Account Manager users error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch Account Manager users'
    });
  }
});

module.exports = router;
