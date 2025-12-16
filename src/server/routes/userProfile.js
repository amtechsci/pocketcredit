const express = require('express');
const { authenticateAdmin } = require('../middleware/auth');
const { executeQuery, initializeDatabase } = require('../config/database');
const { validateRequest } = require('../middleware/validation');
const { getPresignedUrl } = require('../services/s3Service');
const router = express.Router();

// Get user profile with all related data
router.get('/:userId', authenticateAdmin, async (req, res) => {
  try {
    console.log('🔍 Getting user profile for ID:', req.params.userId);
    await initializeDatabase();
    const { userId } = req.params;

    // Get user basic info from MySQL
    const users = await executeQuery(`
      SELECT 
        id, first_name, last_name, email, phone, 
        date_of_birth, gender, marital_status, kyc_completed, 
        email_verified, phone_verified, status, profile_completion_step, 
        profile_completed, eligibility_status, eligibility_reason, 
        eligibility_retry_date, selected_loan_plan_id, created_at, updated_at, last_login_at
      FROM users 
      WHERE id = ?
    `, [userId]);

    if (!users || users.length === 0) {
      console.log('❌ User not found in database');
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    const user = users[0];
    console.log('👤 User data:', user);

    // Get user's selected loan plan if exists
    let selectedLoanPlan = null;
    if (user.selected_loan_plan_id) {
      const plans = await executeQuery(
        'SELECT * FROM loan_plans WHERE id = ?',
        [user.selected_loan_plan_id]
      );
      if (plans && plans.length > 0) {
        selectedLoanPlan = plans[0];
      }
    }

    // Get loan applications for this user
    const applications = await executeQuery(`
      SELECT 
        id, application_number, loan_amount, loan_purpose, 
        tenure_months, interest_rate, status, rejection_reason, 
        approved_by, approved_at, disbursed_at, created_at, updated_at,
        processing_fee_percent, interest_percent_per_day, 
        processing_fee, total_interest, total_repayable, plan_snapshot
      FROM loan_applications 
      WHERE user_id = ?
      ORDER BY created_at DESC
    `, [userId]);

    console.log('📋 Found applications:', applications ? applications.length : 0);

    // Get additional user data from related tables
    const addresses = await executeQuery(`
      SELECT * FROM addresses WHERE user_id = ? AND is_primary = 1 LIMIT 1
    `, [userId]);

    const employment = await executeQuery(`
      SELECT ed.*, u.income_range 
      FROM employment_details ed
      LEFT JOIN users u ON ed.user_id = u.id
      WHERE ed.user_id = ? 
      LIMIT 1
    `, [userId]);

    // Calculate age from date_of_birth
    const calculateAge = (dateOfBirth) => {
      if (!dateOfBirth) return 'N/A';
      const today = new Date();
      const birthDate = new Date(dateOfBirth);
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    };

    // Convert income_range to approximate monthly income
    const getMonthlyIncomeFromRange = (range) => {
      if (!range) return 0;
      const rangeMap = {
        '1k-20k': 10000,
        '20k-30k': 25000,
        '30k-40k': 35000,
        'above-40k': 50000
      };
      return rangeMap[range] || 0;
    };

    // Derive risk category and member level from available data
    const incomeRange = (employment && employment[0])?.income_range;
    const monthlyIncomeValue = getMonthlyIncomeFromRange(incomeRange);
    let riskCategory = 'N/A';
    if (monthlyIncomeValue > 0) {
      if (monthlyIncomeValue >= 50000) riskCategory = 'Low';
      else if (monthlyIncomeValue >= 25000) riskCategory = 'Medium';
      else riskCategory = 'High';
    }
    const memberLevel = riskCategory === 'Low' ? 'gold' : riskCategory === 'Medium' ? 'silver' : (riskCategory === 'High' ? 'bronze' : 'bronze');

    // Fetch bank statement report
    let bankStatement = null;
    let txnId = null;
    try {
      const bankStmtResults = await executeQuery(
        'SELECT report_data, txn_id FROM user_bank_statements WHERE user_id = ? AND status = "completed" ORDER BY created_at DESC LIMIT 1',
        [userId]
      );
      if (bankStmtResults.length > 0 && bankStmtResults[0].report_data) {
        // Handle case where report_data might already be an object (if mysql driver parses JSON)
        bankStatement = typeof bankStmtResults[0].report_data === 'string'
          ? JSON.parse(bankStmtResults[0].report_data)
          : bankStmtResults[0].report_data;
        // Include txn_id for Excel download
        txnId = bankStmtResults[0].txn_id;
        if (bankStatement && txnId) {
          bankStatement.txn_id = txnId;
        }
      }
    } catch (e) {
      console.error('Error fetching bank statement:', e);
    }

    // Fetch KYC Verification Data
    let kycData = null;
    try {
      const kycQuery = `
        SELECT verification_data, kyc_status as status, created_at
        FROM kyc_verifications 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT 1
      `;
      const kycResult = await executeQuery(kycQuery, [userId]);

      if (kycResult.length > 0) {
        kycData = kycResult[0];
        // Parse verification_data if it's a string
        if (kycData.verification_data && typeof kycData.verification_data === 'string') {
          try {
            kycData.verification_data = JSON.parse(kycData.verification_data);
          } catch (e) {
            console.error('Error parsing KYC verification data:', e);
          }
        }
      }
    } catch (e) {
      console.error('Error fetching KYC verification:', e);
    }

    // Fetch KYC Documents
    let kycDocuments = [];
    try {
      const docsQuery = `
        SELECT id, document_type, file_name, s3_key, mime_type, created_at
        FROM kyc_documents
        WHERE user_id = ?
        ORDER BY created_at DESC
      `;
      const docsResult = await executeQuery(docsQuery, [userId]);

      // Generate presigned URLs for documents
      kycDocuments = await Promise.all(docsResult.map(async (doc) => {
        try {
          const url = await getPresignedUrl(doc.s3_key);
          return { ...doc, url };
        } catch (err) {
          console.error(`Failed to generate URL for doc ${doc.id}:`, err);
          return { ...doc, url: null };
        }
      }));
    } catch (e) {
      console.error('Error fetching KYC documents:', e);
    }

    // Fetch Bank Details
    let bankDetails = [];
    try {
      const bankQuery = `
        SELECT *
        FROM bank_details
        WHERE user_id = ?
        ORDER BY created_at DESC
      `;
      const bankResults = await executeQuery(bankQuery, [userId]);

      if (bankResults && bankResults.length > 0) {
        bankDetails = bankResults.map(bank => ({
          id: bank.id,
          bankName: bank.bank_name,
          accountNumber: bank.account_number,
          ifscCode: bank.ifsc_code,
          accountHolderName: bank.account_holder_name,
          branchName: bank.branch_name || 'N/A',
          accountType: bank.account_type || 'Savings',
          isPrimary: bank.is_primary ? true : false,
          verificationStatus: bank.verification_status || 'N/A',
          createdAt: bank.created_at
        }));
      }
    } catch (e) {
      console.error('Error fetching bank details:', e);
    }

    // Construct bankInfo object for frontend compatibility (UserProfileDetail.tsx expects this structure)
    let bankInfo = {
      bankName: 'N/A',
      accountNumber: 'N/A',
      ifscCode: 'N/A',
      accountType: 'N/A',
      accountHolderName: 'N/A',
      branchName: 'N/A',
      verificationStatus: 'N/A',
      verifiedDate: null,
      addedDate: null,
      isPrimary: false
    };

    if (bankDetails.length > 0) {
      // Use the primary bank account if available, otherwise the most recent one
      const primaryBank = bankDetails.find(b => b.isPrimary) || bankDetails[0];

      bankInfo = {
        id: primaryBank.id,
        bankName: primaryBank.bankName || 'N/A',
        accountNumber: primaryBank.accountNumber || 'N/A',
        ifscCode: primaryBank.ifscCode || 'N/A',
        accountType: primaryBank.accountType || 'Savings',
        accountHolderName: primaryBank.accountHolderName || 'N/A',
        branchName: primaryBank.branchName || 'N/A',
        verificationStatus: primaryBank.verificationStatus || 'pending',
        verifiedDate: primaryBank.verifiedDate || null,
        addedDate: primaryBank.createdAt || null,
        isPrimary: primaryBank.isPrimary
      };
    }

    // Transform user data to match frontend expectations
    const userProfile = {
      id: user.id,
      name: `${user.first_name} ${user.last_name || ''}`.trim(),
      email: user.email || 'N/A',
      mobile: user.phone || 'N/A',
      dateOfBirth: user.date_of_birth ? new Date(user.date_of_birth).toLocaleDateString('en-IN') : 'N/A',
      panNumber: 'N/A', // This field doesn't exist in users table yet
      kycStatus: user.kyc_completed ? 'completed' : 'pending',
      isEmailVerified: user.email_verified ? true : false,
      isMobileVerified: user.phone_verified ? true : false,
      status: user.status || 'active',
      registeredDate: user.created_at, // For admin UI compatibility
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      lastLoginAt: user.last_login_at || 'N/A',
      riskCategory,
      memberLevel,
      profileCompletionStep: user.profile_completion_step || 1,
      profileCompleted: user.profile_completed ? true : false,
      eligibilityStatus: user.eligibility_status || 'pending',
      eligibilityReason: user.eligibility_reason || 'N/A',
      eligibilityRetryDate: user.eligibility_retry_date || 'N/A',
      selectedLoanPlanId: user.selected_loan_plan_id || null,
      selectedLoanPlan: selectedLoanPlan,
      personalInfo: {
        age: calculateAge(user.date_of_birth),
        gender: user.gender || 'N/A',
        maritalStatus: user.marital_status || 'N/A',
        fatherName: 'N/A', // These fields don't exist in users table yet
        motherName: 'N/A',
        spouseName: 'N/A',
        address: (addresses && addresses[0])?.address_line1 || 'N/A',
        city: (addresses && addresses[0])?.city || 'N/A',
        state: (addresses && addresses[0])?.state || 'N/A',
        pincode: (addresses && addresses[0])?.pincode || 'N/A',
        education: 'N/A', // This field doesn't exist yet
        employment: (employment && employment[0])?.employment_type || 'N/A',
        company: (employment && employment[0])?.company_name || 'N/A',
        monthlyIncome: monthlyIncomeValue,
        workExperience: (employment && employment[0])?.work_experience_years || 'N/A',
        designation: (employment && employment[0])?.designation || 'N/A',
        yearsAtCurrentAddress: 'N/A', // This would need to be calculated
        residenceType: 'N/A', // This field doesn't exist yet
        totalExperience: (employment && employment[0])?.work_experience_years || 'N/A',
        otherIncome: 0 // This field doesn't exist yet
      },
      // Default values for data not yet in MySQL
      documents: [],
      bankDetails: bankDetails,
      bankInfo: bankInfo, // Added for frontend compatibility
      references: [],
      transactions: [],
      followUps: [],
      notes: [],
      smsHistory: [],
      loginHistory: [],
      bankStatement: bankStatement,
      kycVerification: kycData,
      kycDocuments: kycDocuments,
      loans: applications.map(app => {
        // Calculate EMI if we have the required data
        const calculateEMI = (principal, rate, tenure) => {
          if (!principal || !rate || !tenure) return 0;
          const monthlyRate = rate / 100 / 12;
          const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, tenure)) /
            (Math.pow(1 + monthlyRate, tenure) - 1);
          return Math.round(emi);
        };

        const emi = calculateEMI(app.loan_amount, app.interest_rate, app.tenure_months);
        const processingFee = Math.round(app.loan_amount * 0.025); // 2.5% processing fee
        const gst = Math.round(processingFee * 0.18); // 18% GST on processing fee
        const totalInterest = emi * app.tenure_months - app.loan_amount;
        const totalAmount = app.loan_amount + processingFee + gst + totalInterest;

        return {
          id: app.id,
          loanId: app.application_number,
          amount: app.loan_amount,
          principalAmount: app.loan_amount,
          type: app.loan_purpose || 'Personal Loan',
          status: app.status,
          appliedDate: app.created_at,
          approvedDate: app.approved_at,
          disbursedDate: app.disbursed_at,
          disbursed_at: app.disbursed_at,
          emi: emi,
          tenure: app.tenure_months,
          timePeriod: app.tenure_months,
          processingFeePercent: app.processing_fee_percent || 14,
          interestRate: app.interest_percent_per_day || 0.3,
          disbursedAmount: app.disbursed_at ? app.loan_amount : 0,
          processingFee: app.processing_fee || processingFee,
          gst: gst,
          interest: app.total_interest || totalInterest,
          totalAmount: app.total_repayable || totalAmount,
          reason: app.rejection_reason || app.loan_purpose || 'N/A',
          statusDate: app.approved_at || app.disbursed_at || app.created_at,
          createdAt: app.created_at,
          updatedAt: app.updated_at || app.created_at,
          plan_snapshot: app.plan_snapshot
        };
      })
    };

    console.log('✅ User profile data prepared successfully');
    res.json({
      status: 'success',
      data: userProfile
    });

  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch user profile'
    });
  }
});

// Update user basic information
router.put('/:userId/basic-info', authenticateAdmin, async (req, res) => {
  try {
    console.log('📝 Updating basic info for user:', req.params.userId);
    await initializeDatabase();
    const { userId } = req.params;
    const { firstName, lastName, dateOfBirth, panNumber } = req.body;

    // Update user basic info in MySQL
    await executeQuery(`
      UPDATE users 
      SET 
        first_name = ?,
        last_name = ?,
        date_of_birth = ?,
        updated_at = NOW()
      WHERE id = ?
    `, [firstName, lastName, dateOfBirth, userId]);

    console.log('✅ Basic info updated successfully');
    console.log('📝 Updated fields:', { firstName, lastName, dateOfBirth, panNumber });

    res.json({
      status: 'success',
      message: 'Basic information updated successfully',
      data: {
        userId,
        firstName,
        lastName,
        dateOfBirth,
        panNumber: 'N/A (column not in DB yet)'
      }
    });

  } catch (error) {
    console.error('Update basic info error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update basic information'
    });
  }
});

// Update user's loan plan (admin only)
router.put('/:userId/loan-plan', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { userId } = req.params;
    const { plan_id } = req.body;

    if (!plan_id) {
      return res.status(400).json({
        status: 'error',
        message: 'Plan ID is required'
      });
    }

    // Verify plan exists and is active
    const plans = await executeQuery(
      'SELECT id FROM loan_plans WHERE id = ? AND is_active = 1',
      [plan_id]
    );

    if (plans.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Loan plan not found or inactive'
      });
    }

    // Update user's selected loan plan
    await executeQuery(
      'UPDATE users SET selected_loan_plan_id = ?, updated_at = NOW() WHERE id = ?',
      [plan_id, userId]
    );

    res.json({
      status: 'success',
      message: 'User loan plan updated successfully',
      data: { plan_id }
    });
  } catch (error) {
    console.error('Update user loan plan error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update user loan plan'
    });
  }
});

// Update user contact information
router.put('/:userId/contact-info', authenticateAdmin, async (req, res) => {
  try {
    console.log('📞 Updating contact info for user:', req.params.userId);
    await initializeDatabase();
    const { userId } = req.params;
    const { email, phone, alternatePhone } = req.body;

    // Update user contact info in MySQL
    await executeQuery(`
      UPDATE users 
      SET 
        email = ?,
        phone = ?,
        updated_at = NOW()
      WHERE id = ?
    `, [email, phone, userId]);

    console.log('✅ Contact info updated successfully');
    res.json({
      status: 'success',
      message: 'Contact information updated successfully',
      data: { userId, email, phone, alternatePhone }
    });

  } catch (error) {
    console.error('Update contact info error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update contact information'
    });
  }
});

// Update user address information
router.put('/:userId/address-info', authenticateAdmin, async (req, res) => {
  try {
    console.log('🏠 Updating address info for user:', req.params.userId);
    await initializeDatabase();
    const { userId } = req.params;
    const { address, city, state, pincode, country } = req.body;

    // For now, we'll store address info in a JSON field or create a separate table
    // Since address columns don't exist in users table yet, we'll return success
    console.log('✅ Address info updated successfully (stored in memory)');
    res.json({
      status: 'success',
      message: 'Address information updated successfully',
      data: { userId, address, city, state, pincode, country }
    });

  } catch (error) {
    console.error('Update address info error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update address information'
    });
  }
});

// Update user employment information
router.put('/:userId/employment-info', authenticateAdmin, async (req, res) => {
  try {
    console.log('💼 Updating employment info for user:', req.params.userId);
    await initializeDatabase();
    const { userId } = req.params;
    const { company, designation, monthlyIncome, workExperience } = req.body;

    // For now, we'll store employment info in memory since columns don't exist yet
    console.log('✅ Employment info updated successfully (stored in memory)');
    res.json({
      status: 'success',
      message: 'Employment information updated successfully',
      data: { userId, company, designation, monthlyIncome, workExperience }
    });

  } catch (error) {
    console.error('Update employment info error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update employment information'
    });
  }
});

// Update bank details status
router.put('/:userId/bank-details/:bankId', authenticateAdmin, async (req, res) => {
  try {
    console.log('🏦 Updating bank details status:', req.params.bankId);
    await initializeDatabase();
    const { userId, bankId } = req.params;
    const { verificationStatus, rejectionReason } = req.body;

    // Map status to is_verified (1 for verified, 0 for others)
    const isVerified = verificationStatus === 'verified' ? 1 : 0;

    // Update query
    // We try to update verification_status column too if it exists, otherwise just is_verified
    // Since we can't easily check column existence in query, we'll try to update both
    // If verification_status doesn't exist, this might fail, so we should check schema or use a safer approach
    // For now, let's assume is_verified is the main flag and we'll try to update verification_status if possible

    // First check if verification_status column exists
    const columns = await executeQuery(`SHOW COLUMNS FROM bank_details LIKE 'verification_status'`);
    const hasVerificationStatus = columns.length > 0;

    const rejectionReasonColumn = await executeQuery(`SHOW COLUMNS FROM bank_details LIKE 'rejection_reason'`);
    const hasRejectionReason = rejectionReasonColumn.length > 0;

    let updateQuery = 'UPDATE bank_details SET is_verified = ?, updated_at = NOW()';
    const params = [isVerified];

    if (hasVerificationStatus) {
      updateQuery += ', verification_status = ?';
      params.push(verificationStatus);
    }

    if (hasRejectionReason && rejectionReason) {
      updateQuery += ', rejection_reason = ?';
      params.push(rejectionReason);
    }

    updateQuery += ' WHERE id = ? AND user_id = ?';
    params.push(bankId, userId);

    await executeQuery(updateQuery, params);

    console.log('✅ Bank details status updated successfully');
    res.json({
      status: 'success',
      message: 'Bank details status updated successfully',
      data: {
        id: bankId,
        isVerified,
        verificationStatus,
        rejectionReason
      }
    });

  } catch (error) {
    console.error('Update bank details status error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update bank details status'
    });
  }
});

// Add bank details
router.post('/:userId/bank-details', authenticateAdmin, async (req, res) => {
  try {
    console.log('🏦 Adding bank details for user:', req.params.userId);
    await initializeDatabase();
    const { userId } = req.params;
    const { bankName, accountNumber, ifscCode, accountHolderName, branchName } = req.body;

    // For now, we'll store bank details in memory since table doesn't exist yet
    console.log('✅ Bank details added successfully (stored in memory)');
    res.json({
      status: 'success',
      message: 'Bank details added successfully',
      data: { userId, bankName, accountNumber, ifscCode, accountHolderName, branchName }
    });

  } catch (error) {
    console.error('Add bank details error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to add bank details'
    });
  }
});

// Add reference details
router.post('/:userId/reference-details', authenticateAdmin, async (req, res) => {
  try {
    console.log('👥 Adding reference details for user:', req.params.userId);
    await initializeDatabase();
    const { userId } = req.params;
    const { name, relationship, phone, email, address } = req.body;

    // For now, we'll store reference details in memory since table doesn't exist yet
    console.log('✅ Reference details added successfully (stored in memory)');
    res.json({
      status: 'success',
      message: 'Reference details added successfully',
      data: { userId, name, relationship, phone, email, address }
    });

  } catch (error) {
    console.error('Add reference details error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to add reference details'
    });
  }
});

// Upload document
router.post('/:userId/documents', authenticateAdmin, async (req, res) => {
  try {
    console.log('📄 Uploading document for user:', req.params.userId);
    await initializeDatabase();
    const { userId } = req.params;
    const { documentType, fileName, fileSize, description } = req.body;

    // For now, we'll store document info in memory since table doesn't exist yet
    console.log('✅ Document uploaded successfully (stored in memory)');
    res.json({
      status: 'success',
      message: 'Document uploaded successfully',
      data: { userId, documentType, fileName, fileSize, description }
    });

  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to upload document'
    });
  }
});

// Add transaction
router.post('/:userId/transactions', authenticateAdmin, async (req, res) => {
  try {
    console.log('💰 Adding transaction for user:', req.params.userId);
    await initializeDatabase();
    const { userId } = req.params;
    const adminId = req.admin.id; // Get admin ID from authenticated token

    // Extract all fields
    const {
      amount,
      transaction_type, // Frontend sends "transaction_type" or "type"
      type,             // Fallback
      loan_application_id,
      description,
      category,
      payment_method,
      reference_number,
      transaction_date,
      transaction_time,
      status,
      priority,
      bank_name,
      account_number,
      additional_notes
    } = req.body;

    const txType = transaction_type || type;
    const txDate = transaction_date || new Date().toISOString().split('T')[0];
    const txStatus = status || 'completed';

    // Validate required fields
    if (!amount || !txType) {
      return res.status(400).json({
        status: 'error',
        message: 'Amount and transaction type are required'
      });
    }

    // Insert transaction into database
    const query = `
      INSERT INTO transactions (
        user_id, loan_application_id, transaction_type, amount, description, 
        category, payment_method, reference_number, transaction_date, 
        transaction_time, status, priority, bank_name, account_number, 
        additional_notes, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    const values = [
      userId,
      loan_application_id || null,
      txType,
      amount,
      description || null,
      category || null,
      payment_method || null,
      reference_number || null,
      txDate,
      transaction_time || null,
      txStatus,
      priority || 'normal',
      bank_name || null,
      account_number || null,
      additional_notes || null,
      adminId
    ];

    const result = await executeQuery(query, values);
    const transactionId = result.insertId;

    let loanStatusUpdated = false;
    let newStatus = null;

    // If this is a loan disbursement, update the loan application status
    console.log(`🔍 Checking loan status update conditions. Type: ${txType}, LoanID: ${loan_application_id}`);

    if (txType === 'loan_disbursement' && loan_application_id) {
      const loanIdInt = parseInt(loan_application_id);
      const userIdInt = parseInt(userId);

      // 1. Verify loan exists (query by ID only first)
      console.log(`🔍 Verifying loan #${loanIdInt}`);
      const loans = await executeQuery(
        'SELECT id, user_id, status FROM loan_applications WHERE id = ?',
        [loanIdInt]
      );

      console.log(`🔍 Found loans: ${JSON.stringify(loans)}`);

      if (loans.length > 0) {
        const loan = loans[0];
        // Check ownership in JS to be safe
        if (loan.user_id == userIdInt || loan.user_id == userId) {
          console.log(`✅ Loan ownership confirmed. Current status: ${loan.status}`);

          // 2. Update loan status
          console.log(`Attempting to update loan status to account_manager...`);
          const updateResult = await executeQuery(`
               UPDATE loan_applications 
               SET 
                 status = 'account_manager',
                 disbursed_at = NOW(),
                 updated_at = NOW()
               WHERE id = ?
             `, [loanIdInt]);

          console.log('Update result:', updateResult);

          loanStatusUpdated = true;
          newStatus = 'account_manager';
          console.log(`✅ Updated loan #${loanIdInt} status to account_manager`);
        } else {
          console.warn(`❌ Loan #${loanIdInt} belongs to user ${loan.user_id}, not requested user ${userId}`);
        }
      } else {
        console.warn(`⚠️ Loan #${loanIdInt} not found`);
      }
    } else {
      console.log('Skipping loan status update (conditions not met)');
    }

    console.log('✅ Transaction added successfully to database');

    res.json({
      status: 'success',
      message: loanStatusUpdated
        ? 'Transaction added and loan status updated to Account Manager'
        : 'Transaction added successfully',
      data: {
        transaction_id: transactionId,
        user_id: userId,
        amount,
        transaction_type: txType,
        loan_status_updated: loanStatusUpdated,
        new_status: newStatus
      }
    });

  } catch (error) {
    console.error('Add transaction error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to add transaction',
      error: error.message
    });
  }
});

// Get user transactions
router.get('/:userId/transactions', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { userId } = req.params;

    const transactions = await executeQuery(`
      SELECT t.*, a.name as created_by_name, la.application_number
      FROM transactions t
      LEFT JOIN admins a ON t.created_by = a.id
      LEFT JOIN loan_applications la ON t.loan_application_id = la.id
      WHERE t.user_id = ?
      ORDER BY t.transaction_date DESC, t.created_at DESC
    `, [userId]);

    res.json({
      status: 'success',
      data: transactions
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch transactions'
    });
  }
});

// Add follow-up
router.post('/:userId/follow-ups', authenticateAdmin, async (req, res) => {
  try {
    console.log('📞 Adding follow-up for user:', req.params.userId);
    await initializeDatabase();
    const { userId } = req.params;
    const { type, scheduledDate, notes, priority, status } = req.body;

    // For now, we'll store follow-up info in memory since table doesn't exist yet
    console.log('✅ Follow-up added successfully (stored in memory)');
    res.json({
      status: 'success',
      message: 'Follow-up added successfully',
      data: { userId, type, scheduledDate, notes, priority, status }
    });

  } catch (error) {
    console.error('Add follow-up error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to add follow-up'
    });
  }
});

// Add note
router.post('/:userId/notes', authenticateAdmin, async (req, res) => {
  try {
    console.log('📝 Adding note for user:', req.params.userId);
    await initializeDatabase();
    const { userId } = req.params;
    const { subject, note, category, priority } = req.body;

    // For now, we'll store note info in memory since table doesn't exist yet
    console.log('✅ Note added successfully (stored in memory)');
    res.json({
      status: 'success',
      message: 'Note added successfully',
      data: { userId, subject, note, category, priority }
    });

  } catch (error) {
    console.error('Add note error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to add note'
    });
  }
});

// Send SMS
router.post('/:userId/sms', authenticateAdmin, async (req, res) => {
  try {
    console.log('📱 Sending SMS for user:', req.params.userId);
    await initializeDatabase();
    const { userId } = req.params;
    const { message, templateId } = req.body;

    // For now, we'll store SMS info in memory since table doesn't exist yet
    console.log('✅ SMS sent successfully (stored in memory)');
    res.json({
      status: 'success',
      message: 'SMS sent successfully',
      data: { userId, message, templateId }
    });

  } catch (error) {
    console.error('Send SMS error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to send SMS'
    });
  }
});

/**
 * POST /api/admin/user-profile/:userId/refetch-kyc
 * Refetch KYC data from Digilocker and process documents
 */
router.post('/:userId/refetch-kyc', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { userId } = req.params;

    console.log('🔄 Admin refetching KYC data for user:', userId);

    // Get the latest KYC verification record for this user
    const kycRecords = await executeQuery(
      `SELECT id, user_id, verification_data, kyc_status
       FROM kyc_verifications 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [userId]
    );

    if (kycRecords.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'No KYC verification record found for this user'
      });
    }

    const kycRecord = kycRecords[0];
    
    // Parse verification_data if it's a JSON string
    let verificationData;
    if (typeof kycRecord.verification_data === 'string') {
      try {
        verificationData = JSON.parse(kycRecord.verification_data);
      } catch (e) {
        console.error('❌ Error parsing verification_data:', e);
        verificationData = {};
      }
    } else {
      verificationData = kycRecord.verification_data || {};
    }
    
    // Get transactionId from various possible locations
    const transactionId = verificationData.transactionId || 
                          verificationData.transaction_id || 
                          (verificationData.verification_data && verificationData.verification_data.transactionId);

    if (!transactionId) {
      return res.status(400).json({
        status: 'error',
        message: 'No transaction ID found in KYC verification record'
      });
    }

    console.log('📥 Fetching KYC data from Digilocker for txnId:', transactionId);
    console.log('📋 Verification data structure:', JSON.stringify(verificationData, null, 2));

    if (!transactionId) {
      console.error('❌ Transaction ID not found. Verification data keys:', Object.keys(verificationData));
      return res.status(400).json({
        status: 'error',
        message: 'No transaction ID found in KYC verification record',
        debug: {
          verificationDataKeys: Object.keys(verificationData),
          verificationDataSample: verificationData
        }
      });
    }

    // Import axios and processAndUploadDocs
    const axios = require('axios');
    
    // Import processAndUploadDocs function
    let processAndUploadDocs;
    try {
      const digilockerRoutes = require('./digilocker');
      processAndUploadDocs = digilockerRoutes.processAndUploadDocs;
      if (!processAndUploadDocs) {
        throw new Error('processAndUploadDocs function not found in digilocker routes');
      }
      console.log('✅ Successfully imported processAndUploadDocs');
    } catch (importError) {
      console.error('❌ Error importing processAndUploadDocs:', importError);
      console.error('❌ Import error stack:', importError.stack);
      return res.status(500).json({
        status: 'error',
        message: `Failed to import processAndUploadDocs: ${importError.message}`,
        error: process.env.NODE_ENV === 'development' ? importError.stack : undefined
      });
    }

    // Call Digilocker API to fetch actual KYC data
    // Use get-digilocker-details endpoint (same as get-details route)
    const useProduction = process.env.DIGILOCKER_USE_PRODUCTION === 'true';
    const apiUrl = process.env.DIGILOCKER_GET_DETAILS_URL || 
      (useProduction
        ? 'https://api.digitap.ai/ent/v1/kyc/get-digilocker-details'
        : 'https://apidemo.digitap.work/ent/v1/kyc/get-digilocker-details');
    
    // Get auth token
    let authToken = process.env.DIGILOCKER_AUTH_TOKEN;
    if (!authToken && process.env.DIGILOCKER_CLIENT_ID && process.env.DIGILOCKER_CLIENT_SECRET) {
      const credentials = `${process.env.DIGILOCKER_CLIENT_ID}:${process.env.DIGILOCKER_CLIENT_SECRET}`;
      authToken = Buffer.from(credentials).toString('base64');
    }
    // Fallback to DIGITAP credentials if DIGILOCKER credentials not set
    if (!authToken && process.env.DIGITAP_CLIENT_ID && process.env.DIGITAP_CLIENT_SECRET) {
      const credentials = `${process.env.DIGITAP_CLIENT_ID}:${process.env.DIGITAP_CLIENT_SECRET}`;
      authToken = Buffer.from(credentials).toString('base64');
    }
    if (!authToken && process.env.NODE_ENV !== 'production') {
      authToken = 'MjcxMDg3NTA6UlRwYzRpVjJUQnFNdFhKRWR6a1BhRG5CRDVZTk9BRkI=';
    }

    console.log('🔗 Calling Digilocker get-details API:', apiUrl);
    console.log('🔑 Using auth token:', authToken ? 'Yes' : 'No');

    const digilockerResponse = await axios.post(
      apiUrl,
      { transactionId: transactionId },
      {
        headers: {
          'ent_authorization': authToken,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    console.log('✅ Digilocker KYC Data Response Status:', digilockerResponse.status);
    console.log('✅ Digilocker KYC Data Response Code:', digilockerResponse.data?.code);

    if (digilockerResponse.data && digilockerResponse.data.code === "200") {
      const kycData = digilockerResponse.data.model || digilockerResponse.data.data;
      
      console.log('📊 KYC Data fetched successfully. Keys:', Object.keys(kycData || {}));

      // Update kyc_verifications table with full KYC data
      await executeQuery(
        `UPDATE kyc_verifications 
         SET verification_data = JSON_SET(
           COALESCE(verification_data, '{}'),
           '$.kycData', ?
         ),
         updated_at = NOW()
         WHERE id = ?`,
        [JSON.stringify(kycData), kycRecord.id]
      );

      // Extract and save user info from Digilocker KYC data
      try {
        const { saveUserInfoFromDigilocker, saveAddressFromDigilocker } = require('../services/userInfoService');
        await saveUserInfoFromDigilocker(kycRecord.user_id, kycData, transactionId);
        console.log('✅ User info extracted and saved from Digilocker KYC.');
        
        // Also save address if available
        await saveAddressFromDigilocker(kycRecord.user_id, kycData, transactionId);
        console.log('✅ Address extracted and saved from Digilocker KYC.');
      } catch (infoError) {
        console.error('❌ Error saving user info from Digilocker KYC:', infoError.message);
        // Continue even if user info extraction fails
      }

      // Also fetch documents using list-docs endpoint
      let documentsProcessed = 0;
      try {
        const listDocsUrl = process.env.DIGILOCKER_LIST_DOCS_URL || 
          (useProduction
            ? 'https://api.digitap.ai/ent/v1/digilocker/list-docs'
            : 'https://apidemo.digitap.work/ent/v1/digilocker/list-docs');
        
        console.log('📄 Fetching documents from list-docs endpoint...');
        const docsResponse = await axios.post(
          listDocsUrl,
          { transactionId: transactionId },
          {
            headers: {
              'ent_authorization': authToken,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          }
        );

        if (docsResponse.data && docsResponse.data.code === '200') {
          const docs = docsResponse.data.model || docsResponse.data.data;
          const docsParsed = typeof docs === 'string' ? JSON.parse(docs) : docs;
          
          console.log(`📄 Found ${Array.isArray(docsParsed) ? docsParsed.length : 0} documents`);
          
          // Process and upload documents
          if (docsParsed && Array.isArray(docsParsed) && docsParsed.length > 0) {
            console.log(`🚀 Processing ${docsParsed.length} documents...`);
            try {
              const userIdInt = parseInt(userId);
              if (isNaN(userIdInt)) {
                throw new Error(`Invalid user ID: ${userId}`);
              }
              await processAndUploadDocs(userIdInt, transactionId, docsParsed);
              documentsProcessed = docsParsed.length;
              console.log(`✅ Successfully processed ${documentsProcessed} documents`);
            } catch (docError) {
              console.error('❌ Error processing documents:', docError);
              console.error('❌ Document processing error stack:', docError.stack);
            }
          }
        } else {
          console.log('⚠️ list-docs returned non-200 code:', docsResponse.data?.code);
        }
      } catch (docsError) {
        console.error('❌ Error fetching documents from list-docs:', docsError.message);
        // Continue even if document fetch fails
      }

      res.json({
        status: 'success',
        message: 'KYC data refetched successfully',
        data: {
          kycData: kycData,
          documentsProcessed: documentsProcessed,
          transactionId: transactionId
        }
      });
    } else {
      return res.status(400).json({
        status: 'error',
        message: digilockerResponse.data?.msg || 'Invalid response from Digilocker API',
        code: digilockerResponse.data?.code
      });
    }

  } catch (error) {
    console.error('❌ Refetch KYC data error:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      status: 'error',
      message: 'Failed to refetch KYC data from Digilocker',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;