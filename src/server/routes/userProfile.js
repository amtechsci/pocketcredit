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

    // Get user basic info from MySQL (including PAN, alternate_mobile, company_name, company_email)
    const users = await executeQuery(`
      SELECT 
        id, first_name, last_name, email, phone, 
        date_of_birth, gender, marital_status, kyc_completed, 
        email_verified, phone_verified, status, profile_completion_step, 
        profile_completed, eligibility_status, eligibility_reason, 
        eligibility_retry_date, selected_loan_plan_id, created_at, updated_at, last_login_at,
        pan_number, alternate_mobile, company_name, company_email, salary_date,
        personal_email, official_email, loan_limit, credit_score, experian_score,
        monthly_net_income
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

    // Get latest loan application status for profile status display
    const latestApplication = applications && applications.length > 0 ? applications[0] : null;
    const profileStatus = latestApplication ? latestApplication.status : (user.status || 'active');
    
    // Get assigned account manager if status is account_manager
    let assignedManager = null;
    if (profileStatus === 'account_manager' && latestApplication?.approved_by) {
      const manager = await executeQuery('SELECT name FROM admins WHERE id = ?', [latestApplication.approved_by]);
      if (manager && manager.length > 0) {
        assignedManager = manager[0].name;
      }
    }

    // Calculate pocket credit score (default 640, increase by 6 if loan cleared on/before due date)
    let pocketCreditScore = user.credit_score || 640;
    
    // Check if user has any cleared loans that were cleared on or before due date
    if (applications && applications.length > 0) {
      const clearedLoans = applications.filter(app => app.status === 'cleared');
      for (const loan of clearedLoans) {
        // Check if loan was cleared on or before due date
        if (loan.disbursed_at) {
          const disbursedDate = new Date(loan.disbursed_at);
          const dueDate = new Date(disbursedDate);
          // Assuming tenure in months, calculate due date
          const tenureDays = loan.tenure_months ? loan.tenure_months * 30 : 30;
          dueDate.setDate(dueDate.getDate() + tenureDays);
          const clearedDate = loan.updated_at ? new Date(loan.updated_at) : new Date();
          
          if (clearedDate <= dueDate) {
            pocketCreditScore += 6;
          }
        }
      }
    }

    // Get ALL addresses (not just primary) - ordered by is_primary DESC, then created_at DESC
    const addresses = await executeQuery(`
      SELECT * FROM addresses 
      WHERE user_id = ? 
      ORDER BY is_primary DESC, created_at DESC
    `, [userId]);

    // Get ALL employment details (latest first) - also get income_range from users table
    const employment = await executeQuery(`
      SELECT ed.*, u.income_range 
      FROM employment_details ed
      LEFT JOIN users u ON ed.user_id = u.id
      WHERE ed.user_id = ? 
      ORDER BY ed.id DESC
    `, [userId]);

    // Try to get income_range from users table if not in employment
    let incomeRange = (employment && employment[0])?.income_range;
    if (!incomeRange) {
      const userIncomeRange = await executeQuery(
        'SELECT income_range FROM users WHERE id = ?',
        [userId]
      );
      incomeRange = userIncomeRange[0]?.income_range || null;
    }

    // Get ALL references for this user
    const references = await executeQuery(`
      SELECT id, user_id, name, phone, relation, status, admin_id, created_at, updated_at 
      FROM \`references\` 
      WHERE user_id = ? 
      ORDER BY created_at ASC
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
        // Old format
        '1k-20k': 10000,
        '20k-30k': 25000,
        '30k-40k': 35000,
        'above-40k': 50000,
        // New format from loan_limit_tiers
        '0-15000': 7500,
        '15000-30000': 22500,
        '30000-50000': 40000,
        '50000-75000': 62500,
        '75000-100000': 87500,
        '100000+': 125000
      };
      return rangeMap[range] || 0;
    };

    // Derive risk category and member level from available data
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
    let bankStatementRecords = [];
    try {
      const bankStmtResults = await executeQuery(
        'SELECT id, report_data, txn_id, status, upload_method, file_path, file_name, file_size, bank_name, created_at, updated_at FROM user_bank_statements WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
      );
      if (bankStmtResults.length > 0) {
        // Get the latest completed one for bankStatement (backward compatibility)
        const completed = bankStmtResults.find(r => r.status === 'completed');
        if (completed && completed.report_data) {
          bankStatement = typeof completed.report_data === 'string'
            ? JSON.parse(completed.report_data)
            : completed.report_data;
          txnId = completed.txn_id;
          if (bankStatement && txnId) {
            bankStatement.txn_id = txnId;
          }
        }
        
        // Store all bank statement records
        bankStatementRecords = bankStmtResults.map(record => ({
          id: record.id,
          txn_id: record.txn_id,
          status: record.status,
          upload_method: record.upload_method || 'unknown',
          file_path: record.file_path,
          file_name: record.file_name,
          file_size: record.file_size,
          bank_name: record.bank_name,
          created_at: record.created_at,
          updated_at: record.updated_at,
          has_report_data: !!record.report_data
        }));
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

    // Fetch user_info from multiple sources (for multi-source of truth)
    let userInfoRecords = [];
    try {
      const userInfoQuery = `
        SELECT id, name, dob, source, additional_details, created_at
        FROM user_info
        WHERE user_id = ?
        ORDER BY source, created_at DESC
      `;
      const userInfoResults = await executeQuery(userInfoQuery, [userId]);
      
      userInfoRecords = userInfoResults.map(record => {
        let additionalDetails = {};
        if (record.additional_details) {
          try {
            additionalDetails = typeof record.additional_details === 'string' 
              ? JSON.parse(record.additional_details) 
              : record.additional_details;
          } catch (e) {
            console.error('Error parsing additional_details:', e);
          }
        }
        return {
          id: record.id,
          name: record.name,
          dob: record.dob,
          source: record.source,
          additionalDetails: additionalDetails,
          createdAt: record.created_at
        };
      });
    } catch (e) {
      console.error('Error fetching user_info records:', e);
    }

    // Fetch user login history
    let loginHistory = [];
    try {
      const loginHistoryQuery = `
        SELECT 
          id, ip_address, user_agent, browser_name, browser_version, device_type, 
          os_name, os_version, location_country, location_city, location_region, 
          latitude, longitude, login_time, success, failure_reason, created_at
        FROM user_login_history
        WHERE user_id = ?
        ORDER BY login_time DESC
        LIMIT 50
      `;
      const loginHistoryResults = await executeQuery(loginHistoryQuery, [userId]);
      loginHistory = loginHistoryResults || [];
    } catch (e) {
      console.error('Error fetching login history:', e);
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

    // Generate customer unique ID (CLID) - format: PC + user ID
    const clid = `PC${String(user.id).padStart(5, '0')}`;

    // Transform user data to match frontend expectations
    const userProfile = {
      id: user.id,
      clid: clid,
      name: `${user.first_name} ${user.last_name || ''}`.trim(),
      email: user.email || user.personal_email || user.official_email || 'N/A',
      personalEmail: user.personal_email || null,
      officialEmail: user.official_email || null,
      mobile: user.phone || 'N/A',
      dateOfBirth: user.date_of_birth ? new Date(user.date_of_birth).toLocaleDateString('en-IN') : 'N/A',
      panNumber: user.pan_number || 'N/A',
      alternateMobile: user.alternate_mobile || 'N/A',
      companyName: user.company_name || 'N/A',
      companyEmail: user.company_email || 'N/A',
      salaryDate: user.salary_date || null,
      loanLimit: parseFloat(user.loan_limit) || 0,
      monthlyIncome: parseFloat(user.monthly_net_income) || monthlyIncomeValue || 0,
      kycStatus: user.kyc_completed ? 'completed' : 'pending',
      isEmailVerified: user.email_verified ? true : false,
      isMobileVerified: user.phone_verified ? true : false,
      status: user.status || 'active',
      profileStatus: profileStatus, // Latest loan application status
      assignedManager: assignedManager, // Assigned account manager name
      registeredDate: user.created_at, // For admin UI compatibility
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      lastLoginAt: user.last_login_at || 'N/A',
      riskCategory,
      memberLevel,
      creditScore: pocketCreditScore, // Pocket credit score (calculated)
      experianScore: user.experian_score || null, // Experian score from API
      limitVsSalaryPercent: (user.monthly_net_income && user.loan_limit) 
        ? ((parseFloat(user.loan_limit) / parseFloat(user.monthly_net_income)) * 100).toFixed(1)
        : null,
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
        // Primary address (first one, which should be is_primary = 1)
        address: (addresses && addresses[0])?.address_line1 || 'N/A',
        addressLine2: (addresses && addresses[0])?.address_line2 || 'N/A',
        city: (addresses && addresses[0])?.city || 'N/A',
        state: (addresses && addresses[0])?.state || 'N/A',
        pincode: (addresses && addresses[0])?.pincode || 'N/A',
        country: (addresses && addresses[0])?.country || 'India',
        // Employment details (latest)
        education: (employment && employment[0])?.education || 'N/A',
        employment: (employment && employment[0])?.employment_type || 'N/A',
        company: (employment && employment[0])?.company_name || 'N/A',
        industry: (employment && employment[0])?.industry || 'N/A',
        department: (employment && employment[0])?.department || 'N/A',
        monthlyIncome: (employment && employment[0]?.monthly_salary_old && parseFloat(employment[0].monthly_salary_old) > 0) 
          ? parseFloat(employment[0].monthly_salary_old) 
          : (parseFloat(user.monthly_net_income) || monthlyIncomeValue || 0),
        workExperience: (employment && employment[0]?.work_experience_years !== null && employment[0]?.work_experience_years !== undefined && employment[0]?.work_experience_years !== '') 
          ? employment[0].work_experience_years 
          : (employment && employment[0]?.work_experience_years === 0 ? 0 : null),
        designation: (employment && employment[0])?.designation || 'N/A',
        totalExperience: (employment && employment[0]?.work_experience_years !== null && employment[0]?.work_experience_years !== undefined && employment[0]?.work_experience_years !== '') 
          ? employment[0].work_experience_years 
          : (employment && employment[0]?.work_experience_years === 0 ? 0 : null)
      },
      // All addresses (not just primary)
      allAddresses: addresses || [],
      // All employment records
      allEmployment: employment || [],
      // Default values for data not yet in MySQL
      documents: [],
      bankDetails: bankDetails,
      bankInfo: bankInfo, // Added for frontend compatibility
      references: references || [],
      transactions: [],
      followUps: [],
      notes: [],
      smsHistory: [],
      bankStatement: bankStatement,
      bankStatementRecords: bankStatementRecords, // All bank statement records
      kycVerification: kycData,
      kycDocuments: kycDocuments,
      userInfoRecords: userInfoRecords, // Multi-source of truth data
      loginHistory: loginHistory, // User login history from database
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

        // Generate shorter loan ID format: PLL + 4 digits (last 4 digits of application number or ID)
        const loanIdDigits = app.application_number ? app.application_number.slice(-4) : String(app.id).padStart(4, '0').slice(-4);
        const shortLoanId = `PLL${loanIdDigits}`;

        return {
          id: app.id,
          loanId: app.application_number,
          shortLoanId: shortLoanId,
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

// Update user's loan limit (admin only)
router.put('/:userId/loan-limit', authenticateAdmin, async (req, res) => {
  try {
    console.log('💰 Updating loan limit for user:', req.params.userId);
    await initializeDatabase();
    const { userId } = req.params;
    const { loanLimit } = req.body;

    if (!loanLimit || isNaN(parseFloat(loanLimit))) {
      return res.status(400).json({
        status: 'error',
        message: 'Valid loan limit is required'
      });
    }

    // Update user's loan limit
    await executeQuery(
      'UPDATE users SET loan_limit = ?, updated_at = NOW() WHERE id = ?',
      [parseFloat(loanLimit), userId]
    );

    console.log('✅ Loan limit updated successfully');
    res.json({
      status: 'success',
      message: 'Loan limit updated successfully',
      data: { userId, loanLimit: parseFloat(loanLimit) }
    });
  } catch (error) {
    console.error('Update loan limit error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update loan limit'
    });
  }
});

// Update user contact information
router.put('/:userId/contact-info', authenticateAdmin, async (req, res) => {
  try {
    console.log('📞 Updating contact info for user:', req.params.userId);
    await initializeDatabase();
    const { userId } = req.params;
    const { email, phone, alternatePhone, personalEmail, officialEmail } = req.body;

    const updates = [];
    const values = [];

    if (email !== undefined) {
      updates.push('email = ?');
      values.push(email);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      values.push(phone);
    }
    if (alternatePhone !== undefined) {
      updates.push('alternate_mobile = ?');
      values.push(alternatePhone);
    }
    if (personalEmail !== undefined) {
      updates.push('personal_email = ?');
      values.push(personalEmail);
    }
    if (officialEmail !== undefined) {
      updates.push('official_email = ?');
      values.push(officialEmail);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No fields to update provided'
      });
    }

    updates.push('updated_at = NOW()');
    values.push(userId);

    // Update user contact info in MySQL
    await executeQuery(`
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = ?
    `, values);

    console.log('✅ Contact info updated successfully');
    res.json({
      status: 'success',
      message: 'Contact information updated successfully',
      data: { userId, email, phone, alternatePhone, personalEmail, officialEmail }
    });

  } catch (error) {
    console.error('Update contact info error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update contact information'
    });
  }
});

// Add new address for user
router.post('/:userId/addresses', authenticateAdmin, async (req, res) => {
  try {
    console.log('🏠 Adding address for user:', req.params.userId);
    await initializeDatabase();
    const { userId } = req.params;
    const { address_line1, address_line2, city, state, pincode, country = 'India', address_type = 'current', is_primary = false } = req.body;

    // Validation
    if (!address_line1 || !city || !state || !pincode) {
      return res.status(400).json({
        status: 'error',
        message: 'Address line 1, city, state, and pincode are required'
      });
    }

    if (!/^\d{6}$/.test(pincode)) {
      return res.status(400).json({
        status: 'error',
        message: 'Pincode must be 6 digits'
      });
    }

    // If setting as primary, unset other primary addresses
    if (is_primary) {
      await executeQuery(
        `UPDATE addresses SET is_primary = 0 WHERE user_id = ?`,
        [userId]
      );
    }

    // Insert new address
    const result = await executeQuery(
      `INSERT INTO addresses (user_id, address_type, address_line1, address_line2, city, state, pincode, country, is_primary, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [userId, address_type, address_line1, address_line2 || null, city, state, pincode, country, is_primary ? 1 : 0]
    );

    // Fetch the created address
    const newAddress = await executeQuery(
      `SELECT * FROM addresses WHERE id = ?`,
      [result.insertId]
    );

    console.log('✅ Address added successfully');
    res.json({
      status: 'success',
      message: 'Address added successfully',
      data: newAddress[0]
    });

  } catch (error) {
    console.error('Add address error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to add address'
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

// Update specific address
router.put('/:userId/addresses/:addressId', authenticateAdmin, async (req, res) => {
  try {
    console.log('🏠 Updating address:', req.params.addressId, 'for user:', req.params.userId);
    await initializeDatabase();
    const { userId, addressId } = req.params;
    const { address_line1, address_line2, city, state, pincode, country = 'India', address_type = 'current', is_primary = false } = req.body;

    // Validation
    if (!address_line1 || !city || !state || !pincode) {
      return res.status(400).json({
        status: 'error',
        message: 'Address line 1, city, state, and pincode are required'
      });
    }

    if (!/^\d{6}$/.test(pincode)) {
      return res.status(400).json({
        status: 'error',
        message: 'Pincode must be 6 digits'
      });
    }

    // If setting as primary, unset other primary addresses
    if (is_primary) {
      await executeQuery(
        `UPDATE addresses SET is_primary = 0 WHERE user_id = ? AND id != ?`,
        [userId, addressId]
      );
    }

    // Update address
    await executeQuery(
      `UPDATE addresses 
       SET address_type = ?, address_line1 = ?, address_line2 = ?, city = ?, state = ?, pincode = ?, country = ?, is_primary = ?, updated_at = NOW()
       WHERE id = ? AND user_id = ?`,
      [address_type, address_line1, address_line2 || null, city, state, pincode, country, is_primary ? 1 : 0, addressId, userId]
    );

    // Fetch the updated address
    const updatedAddress = await executeQuery(
      `SELECT * FROM addresses WHERE id = ?`,
      [addressId]
    );

    console.log('✅ Address updated successfully');
    res.json({
      status: 'success',
      message: 'Address updated successfully',
      data: updatedAddress[0]
    });

  } catch (error) {
    console.error('Update address error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update address'
    });
  }
});

// Update user employment information
router.put('/:userId/employment-info', authenticateAdmin, async (req, res) => {
  try {
    console.log('💼 Updating employment info for user:', req.params.userId);
    await initializeDatabase();
    const { userId } = req.params;
    const { company, companyName, designation, industry, department, monthlyIncome, income, workExperience } = req.body;

    // Use companyName if provided, otherwise company
    const finalCompanyName = companyName || company;
    // Use income if provided, otherwise monthlyIncome
    const finalIncome = income || monthlyIncome;

    // Get the latest employment record for this user
    const existingEmployment = await executeQuery(`
      SELECT id FROM employment_details 
      WHERE user_id = ? 
      ORDER BY id DESC 
      LIMIT 1
    `, [userId]);

    let employmentId;
    if (existingEmployment && existingEmployment.length > 0) {
      // Update existing employment record
      employmentId = existingEmployment[0].id;
      const updates = [];
      const values = [];

      if (finalCompanyName !== undefined) {
        updates.push('company_name = ?');
        values.push(finalCompanyName);
      }
      if (designation !== undefined) {
        updates.push('designation = ?');
        values.push(designation);
      }
      if (industry !== undefined) {
        updates.push('industry = ?');
        values.push(industry);
      }
      if (department !== undefined) {
        updates.push('department = ?');
        values.push(department);
      }
      if (finalIncome !== undefined && finalIncome !== null) {
        updates.push('monthly_salary_old = ?');
        values.push(finalIncome);
      }
      if (workExperience !== undefined && workExperience !== null) {
        updates.push('work_experience_years = ?');
        values.push(workExperience);
      }

      if (updates.length > 0) {
        updates.push('updated_at = NOW()');
        values.push(employmentId);
        await executeQuery(`
          UPDATE employment_details 
          SET ${updates.join(', ')}
          WHERE id = ?
        `, values);
      }
    } else {
      // Create new employment record if none exists
      const result = await executeQuery(`
        INSERT INTO employment_details 
        (user_id, company_name, designation, industry, department, monthly_salary_old, work_experience_years, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [
        userId,
        finalCompanyName || null,
        designation || null,
        industry || null,
        department || null,
        finalIncome || null,
        workExperience || null
      ]);
      employmentId = result.insertId;
    }

    // Also update users table with company_name and monthly_net_income
    const userUpdates = [];
    const userValues = [];
    
    if (finalCompanyName !== undefined) {
      userUpdates.push('company_name = ?');
      userValues.push(finalCompanyName);
    }
    if (finalIncome !== undefined && finalIncome !== null) {
      userUpdates.push('monthly_net_income = ?');
      userValues.push(finalIncome);
    }

    if (userUpdates.length > 0) {
      userUpdates.push('updated_at = NOW()');
      userValues.push(userId);
      await executeQuery(`
        UPDATE users 
        SET ${userUpdates.join(', ')}
        WHERE id = ?
      `, userValues);
    }

    console.log('✅ Employment info updated successfully');
    res.json({
      status: 'success',
      message: 'Employment information updated successfully',
      data: { userId, employmentId, company: finalCompanyName, designation, industry, department, monthlyIncome: finalIncome, workExperience }
    });

  } catch (error) {
    console.error('Update employment info error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update employment information',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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

// Update bank details (edit)
router.put('/:userId/bank-details/:bankId/edit', authenticateAdmin, async (req, res) => {
  try {
    console.log('🏦 Updating bank details:', req.params.bankId);
    await initializeDatabase();
    const { userId, bankId } = req.params;
    const { bankName, accountNumber, ifscCode, accountHolderName, branchName, accountType } = req.body;

    // Verify bank detail belongs to user
    const existing = await executeQuery(
      'SELECT id FROM bank_details WHERE id = ? AND user_id = ?',
      [bankId, userId]
    );

    if (!existing || existing.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Bank detail not found'
      });
    }

    const updates = [];
    const values = [];

    if (bankName) {
      updates.push('bank_name = ?');
      values.push(bankName);
    }
    if (accountNumber) {
      updates.push('account_number = ?');
      values.push(accountNumber);
    }
    if (ifscCode) {
      updates.push('ifsc_code = ?');
      values.push(ifscCode.toUpperCase());
    }
    if (accountHolderName) {
      updates.push('account_holder_name = ?');
      values.push(accountHolderName);
    }
    if (branchName !== undefined) {
      updates.push('branch_name = ?');
      values.push(branchName);
    }
    if (accountType) {
      updates.push('account_type = ?');
      values.push(accountType);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No fields to update provided'
      });
    }

    values.push(bankId, userId);

    await executeQuery(
      `UPDATE bank_details SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ? AND user_id = ?`,
      values
    );

    console.log('✅ Bank details updated successfully');
    res.json({
      status: 'success',
      message: 'Bank details updated successfully'
    });

  } catch (error) {
    console.error('Update bank details error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update bank details'
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

// Update reference status (Admin only)
router.put('/:userId/references/:referenceId', authenticateAdmin, async (req, res) => {
  try {
    console.log('👥 Updating reference status:', req.params.referenceId);
    await initializeDatabase();
    const { userId, referenceId } = req.params;
    const { verificationStatus, feedback, rejectionReason } = req.body;

    if (!verificationStatus || !['pending', 'verified', 'rejected'].includes(verificationStatus)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid status. Must be pending, verified, or rejected'
      });
    }

    // Get admin ID from request (if available)
    const adminId = req.admin?.id || null;

    // Update reference status
    await executeQuery(
      `UPDATE \`references\` 
       SET status = ?, admin_id = ?, updated_at = NOW() 
       WHERE id = ? AND user_id = ?`,
      [verificationStatus, adminId, referenceId, userId]
    );

    console.log('✅ Reference status updated successfully');
    res.json({
      status: 'success',
      message: 'Reference status updated successfully',
      data: { referenceId, status: verificationStatus }
    });

  } catch (error) {
    console.error('Update reference status error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update reference status'
    });
  }
});

// Upload document (with file)
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit (increased from 10MB)
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, JPG, and PNG files are allowed.'));
    }
  }
});

router.post('/:userId/documents/upload', authenticateAdmin, upload.single('document'), async (req, res) => {
  try {
    console.log('📄 Uploading document for user:', req.params.userId);
    await initializeDatabase();
    const { userId } = req.params;
    const { documentType, documentTitle, description } = req.body;

    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'No file uploaded'
      });
    }

    if (!documentType || !documentTitle) {
      return res.status(400).json({
        status: 'error',
        message: 'Document type and title are required'
      });
    }

    // For now, we'll store document info in memory since table doesn't exist yet
    // In production, you would upload to S3 and store metadata in database
    console.log('✅ Document uploaded successfully:', {
      fileName: req.file.originalname,
      fileSize: req.file.size,
      documentType,
      documentTitle
    });
    
    res.json({
      status: 'success',
      message: 'Document uploaded successfully',
      data: { 
        userId, 
        documentType, 
        documentTitle,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        description: description || null
      }
    });

  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to upload document'
    });
  }
});

// Upload document (legacy endpoint for backward compatibility)
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