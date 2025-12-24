const { executeQuery } = require('../config/database');

// Simple in-memory cache for dashboard data
const dashboardCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Helper function to get cached data or fetch fresh data
const getCachedOrFetch = async (key, fetchFunction, ttl = CACHE_TTL) => {
  const cached = dashboardCache.get(key);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < ttl) {
    return cached.data;
  }
  
  const data = await fetchFunction();
  dashboardCache.set(key, {
    data,
    timestamp: now
  });
  
  return data;
};

/**
 * Get comprehensive dashboard data for a user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getDashboardSummary = async (req, res) => {
  try {
    const userId = req.userId; // JWT middleware provides this
    
    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Not authenticated'
      });
    }

    // Check if user has completed their profile
    const userQuery = `
      SELECT profile_completed, profile_completion_step, first_name, last_name, email, date_of_birth
      FROM users 
      WHERE id = ? AND status = 'active'
    `;
    const users = await executeQuery(userQuery, [userId]);
    
    if (!users || users.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    const user = users[0];

    // Check if user needs to complete profile
    if (!user.profile_completed) {
      // Check what specific data is missing
      const addresses = await executeQuery('SELECT * FROM addresses WHERE user_id = ?', [userId]);
      const employment = await executeQuery('SELECT * FROM employment_details WHERE user_id = ?', [userId]);
      const verification = await executeQuery('SELECT * FROM verification_records WHERE user_id = ?', [userId]);
      
      let nextStep = 'basic_details';
      let stepName = 'Basic Information';
      
      if (user.first_name && user.last_name && user.email && user.date_of_birth) {
        nextStep = 'additional_details';
        stepName = 'Address & PAN Details';
      }
      
      if (addresses.length > 0 && verification.length > 0) {
        nextStep = 'employment_details';
        stepName = 'Employment Details';
      }
      
      if (employment.length > 0) {
        nextStep = 'complete';
        stepName = 'Profile Complete';
      }

      return res.status(200).json({
        status: 'profile_incomplete',
        message: 'Profile completion required',
        data: {
          profile_completion_required: true,
          current_step: user.profile_completion_step,
          next_step: nextStep,
          step_name: stepName,
          missing_data: {
            addresses: addresses.length === 0,
            employment: employment.length === 0,
            verification: verification.length === 0
          },
          redirect_to: '/profile-completion'
        }
      });
    }

    // Use caching for dashboard data
    const cacheKey = `dashboard_${userId}`;
    const dashboardData = await getCachedOrFetch(cacheKey, async () => {
      return await fetchDashboardData(userId);
    });

    res.json({
      status: 'success',
      data: dashboardData
    });

  } catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch dashboard data'
    });
  }
};

// Separate function to fetch dashboard data (for caching)
const fetchDashboardData = async (userId) => {
  console.log('🔍 Fetching dashboard data for user:', userId);
  
  // Get user basic info including credit score, loan limit, and hold status
  const userQuery = `
    SELECT 
      id, first_name, last_name, phone, email, created_at, 
      credit_score, loan_limit, status, eligibility_status,
      application_hold_reason, hold_until_date,
      employment_type, graduation_status
    FROM users 
    WHERE id = ?
  `;
  const users = await executeQuery(userQuery, [userId]);
  console.log('👤 User query result:', users);
  
  if (!users || users.length === 0) {
    throw new Error('User not found');
  }

  const user = users[0];
  
  // Check if user is on hold and prepare hold information
  let holdInfo = null;
  if (user.status === 'on_hold') {
    holdInfo = {
      is_on_hold: true,
      hold_reason: user.application_hold_reason,
      hold_type: user.hold_until_date ? 'temporary' : 'permanent'
    };
    
    if (user.hold_until_date) {
      const holdUntil = new Date(user.hold_until_date);
      const now = new Date();
      const remainingDays = Math.ceil((holdUntil - now) / (1000 * 60 * 60 * 24));
      
      holdInfo.hold_until = holdUntil.toISOString();
      holdInfo.hold_until_formatted = holdUntil.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      holdInfo.remaining_days = remainingDays > 0 ? remainingDays : 0;
      holdInfo.is_expired = remainingDays <= 0;
    }
  }

  // Get financial details from employment_details
  // Note: income_range is now stored as text (e.g., '1k-20k'), not a numeric value
  const financialQuery = `
    SELECT income_range, monthly_salary_old, 0 as monthly_expenses, 0 as existing_loans
    FROM employment_details 
    WHERE user_id = ?
  `;
  const financialDetails = await executeQuery(financialQuery, [userId]);
  console.log('💰 Financial details result:', financialDetails);
  
  // Fetch tier information from loan_limit_tiers based on income_range
  let tierInfo = null;
  let monthly_income = 0;
  let salary_range_display = null;
  
  if (financialDetails && financialDetails[0] && financialDetails[0].income_range) {
    const incomeRange = financialDetails[0].income_range;
    
    // Fetch tier from loan_limit_tiers table
    const tierQuery = `
      SELECT 
        id, tier_name, min_salary, max_salary, loan_limit, hold_permanent, income_range
      FROM loan_limit_tiers 
      WHERE income_range = ? AND is_active = 1
      LIMIT 1
    `;
    const tiers = await executeQuery(tierQuery, [incomeRange]);
    
    if (tiers && tiers.length > 0) {
      tierInfo = tiers[0];
      
      // Check if loan_limit is 0 - hold user permanently
      if (tierInfo.loan_limit === 0 || tierInfo.hold_permanent === 1) {
        const holdReason = `Application held: Gross monthly income ${tierInfo.max_salary ? `₹${parseInt(tierInfo.min_salary).toLocaleString('en-IN')} to ₹${parseInt(tierInfo.max_salary).toLocaleString('en-IN')}` : `₹${parseInt(tierInfo.min_salary).toLocaleString('en-IN')} and above`} (Loan limit: ₹0)`;
        
        // Hold user permanently if not already on hold
        if (user.status !== 'on_hold') {
          await executeQuery(
            `UPDATE users 
             SET status = ?, eligibility_status = ?, application_hold_reason = ?, updated_at = NOW()
             WHERE id = ?`,
            [
              'on_hold',
              'not_eligible',
              holdReason,
              userId
            ]
          );
          
          // Update user object for consistency
          user.status = 'on_hold';
          user.eligibility_status = 'not_eligible';
          user.application_hold_reason = holdReason;
        }
        
        // Update holdInfo
        holdInfo = {
          is_on_hold: true,
          hold_reason: holdReason,
          hold_type: 'permanent'
        };
      }
      
      // Calculate monthly income (average of min and max, or min if no max)
      monthly_income = tierInfo.max_salary 
        ? Math.round((parseFloat(tierInfo.min_salary) + parseFloat(tierInfo.max_salary)) / 2)
        : parseFloat(tierInfo.min_salary);
      
      // Format salary range for display
      if (tierInfo.max_salary) {
        salary_range_display = `₹${parseInt(tierInfo.min_salary).toLocaleString('en-IN')} to ₹${parseInt(tierInfo.max_salary).toLocaleString('en-IN')}`;
      } else {
        salary_range_display = `₹${parseInt(tierInfo.min_salary).toLocaleString('en-IN')} and above`;
      }
    } else {
      // Fallback to old logic if tier not found
      if (incomeRange === '1k-20k') monthly_income = 10000;
      else if (incomeRange === '20k-30k') monthly_income = 25000;
      else if (incomeRange === '30k-40k') monthly_income = 35000;
      else if (incomeRange === 'above-40k') monthly_income = 50000;
      else if (financialDetails[0].monthly_salary_old) monthly_income = financialDetails[0].monthly_salary_old;
    }
  } else if (financialDetails && financialDetails[0] && financialDetails[0].monthly_salary_old) {
    monthly_income = financialDetails[0].monthly_salary_old;
  }
  
  const financial = financialDetails && financialDetails[0] ? {
    ...financialDetails[0],
    monthly_income,
    salary_range_display,
    tier_info: tierInfo
  } : { monthly_income: 0, monthly_expenses: 0, existing_loans: 0 };

  // Get loan statistics from loan_applications
  const loanStatsQuery = `
    SELECT 
      COUNT(*) as total_loans,
      SUM(CASE WHEN status IN ('approved', 'disbursed') THEN 1 ELSE 0 END) as active_loans,
      SUM(CASE WHEN status IN ('approved', 'disbursed') THEN loan_amount ELSE 0 END) as total_loan_amount,
      SUM(CASE WHEN status IN ('approved', 'disbursed') THEN loan_amount ELSE 0 END) as outstanding_amount
    FROM loan_applications 
    WHERE user_id = ?
  `;
  const loanStats = await executeQuery(loanStatsQuery, [userId]);
  const stats = loanStats && loanStats[0] ? loanStats[0] : {};

  // Get active loans with details from loan_applications
  const activeLoansQuery = `
    SELECT 
      id,
      application_number as loan_number,
      loan_amount,
      interest_percent_per_day,
      tenure_months,
      status,
      disbursed_at,
      loan_purpose,
      DATEDIFF(CURDATE(), disbursed_at) as days_since_disbursement
    FROM loan_applications
    WHERE user_id = ? AND status IN ('approved', 'disbursed')
    ORDER BY created_at DESC
  `;
  const activeLoans = await executeQuery(activeLoansQuery, [userId]);

  // Calculate outstanding amount for each loan (simplified without EMI data)
  const loansWithOutstanding = (activeLoans || []).map(loan => {
    // Since we don't have EMI data, we'll show the full loan amount as outstanding
    // This can be updated later when EMI tracking is implemented
    const outstandingAmount = loan.loan_amount || 0;
    
    return {
      ...loan,
      outstanding_amount: outstandingAmount,
      completed_tenure: 0, // No EMI tracking available
      progress_percentage: 0 // No EMI tracking available
    };
  });

  // Get upcoming payments (simplified - no EMI data available)
  const upcomingPayments = []; // No EMI tracking available

  // Check for pending loan applications
  const pendingApplicationsQuery = `
    SELECT id, status, application_number
    FROM loan_applications
    WHERE user_id = ? AND status IN ('submitted', 'under_review', 'bank_details_provided')
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const pendingApplications = await executeQuery(pendingApplicationsQuery, [userId]);
  const hasPendingApplication = pendingApplications && pendingApplications.length > 0;
  const pendingApplicationInfo = hasPendingApplication ? pendingApplications[0] : null;

  // User can apply for new loan only if they have no active loans AND no pending applications
  const canApplyForLoan = !hasPendingApplication && (activeLoans.length === 0);

  // Get recent notifications (notifications table doesn't exist yet)
  const notifications = [];

  // Calculate available credit (simplified calculation without EMI data)
  const monthlyIncome = financial.monthly_income || 0;
  const existingLoanAmount = (activeLoans || []).reduce((sum, loan) => sum + (loan.loan_amount || 0), 0);
  const availableCredit = Math.max(0, (monthlyIncome * 0.4) * 12 - existingLoanAmount); // 40% of income rule

  // Calculate payment score (simplified)
  const paymentScore = 98; // This would be calculated based on payment history

  console.log(`💰 Dashboard - User ${user.id} loan_limit: ${user.loan_limit}`);

  // Prepare dashboard summary
  return {
    user: {
      id: user.id,
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
      phone: user.phone,
      email: user.email,
      member_since: user.created_at,
      employment_type: user.employment_type,
      graduation_status: user.graduation_status,
      loan_limit: user.loan_limit
    },
    financial: financial, // Include financial details with salary range
    hold_info: holdInfo, // Add hold information if user is on hold
    loan_status: {
      can_apply: canApplyForLoan && !holdInfo, // Cannot apply if on hold
      has_pending_application: hasPendingApplication,
      pending_application: pendingApplicationInfo,
      active_loans_count: activeLoans.length
    },
    summary: {
      credit_score: user.credit_score || 0,
      available_credit: user.loan_limit || availableCredit,
      total_loans: parseInt(stats.total_loans) || 0,
      active_loans: parseInt(stats.active_loans) || 0,
      total_loan_amount: parseFloat(stats.total_loan_amount) || 0,
      outstanding_amount: parseFloat(stats.outstanding_amount) || 0,
      payment_score: paymentScore
    },
    active_loans: loansWithOutstanding,
    upcoming_payments: upcomingPayments,
    notifications: notifications,
    alerts: []
  };
};

/**
 * Get detailed loan information
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getLoanDetails = async (req, res) => {
  try {
    const userId = req.userId; // JWT middleware provides this
    const { loanId } = req.params;
    
    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Not authenticated'
      });
    }

    const loanQuery = `
      SELECT 
        l.*,
        la.loan_purpose,
        la.application_number
      FROM loans l
      LEFT JOIN loan_applications la ON l.loan_application_id = la.id
      WHERE l.id = ? AND l.user_id = ?
    `;
    const loans = await executeQuery(loanQuery, [loanId, userId]);
    
    if (!loans || loans.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Loan not found'
      });
    }

    const loan = loans[0];

    // Get payment history for this loan
    const paymentsQuery = `
      SELECT 
        id,
        amount,
        transaction_type,
        status,
        created_at,
        processed_at
      FROM transactions 
      WHERE loan_id = ? AND transaction_type = 'emi_payment'
      ORDER BY created_at DESC
    `;
    const payments = await executeQuery(paymentsQuery, [loanId]);

    res.json({
      status: 'success',
      data: {
        loan: loan,
        payments: payments
      }
    });

  } catch (error) {
    console.error('Loan details error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch loan details'
    });
  }
};

// Function to invalidate cache for a user
const invalidateUserCache = (userId) => {
  const cacheKey = `dashboard_${userId}`;
  dashboardCache.delete(cacheKey);
};

// Function to clear all cache
const clearAllCache = () => {
  dashboardCache.clear();
};

module.exports = {
  getDashboardSummary,
  getLoanDetails,
  invalidateUserCache,
  clearAllCache
};
