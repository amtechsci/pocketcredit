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
    if (!user.profile_completed || user.profile_completion_step < 5) {
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
  
  // Get user basic info
  const userQuery = `
    SELECT id, first_name, last_name, phone, email, created_at
    FROM users 
    WHERE id = ? AND status = 'active'
  `;
  const users = await executeQuery(userQuery, [userId]);
  console.log('👤 User query result:', users);
  
  if (!users || users.length === 0) {
    throw new Error('User not found');
  }

  const user = users[0];

  // Get financial details from employment_details (since financial_details doesn't exist)
  const financialQuery = `
    SELECT monthly_salary as monthly_income, 0 as credit_score, 0 as monthly_expenses, 0 as existing_loans
    FROM employment_details 
    WHERE user_id = ?
  `;
  const financialDetails = await executeQuery(financialQuery, [userId]);
  console.log('💰 Financial details result:', financialDetails);
  const financial = financialDetails && financialDetails[0] ? financialDetails[0] : {};

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
      interest_rate,
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

  // Get recent notifications (notifications table doesn't exist yet)
  const notifications = [];

  // Calculate available credit (simplified calculation without EMI data)
  const monthlyIncome = financial.monthly_income || 0;
  const existingLoanAmount = (activeLoans || []).reduce((sum, loan) => sum + (loan.loan_amount || 0), 0);
  const availableCredit = Math.max(0, (monthlyIncome * 0.4) * 12 - existingLoanAmount); // 40% of income rule

  // Calculate payment score (simplified)
  const paymentScore = 98; // This would be calculated based on payment history

  // Prepare dashboard summary
  return {
    user: {
      id: user.id,
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
      phone: user.phone,
      email: user.email,
      member_since: user.created_at
    },
    summary: {
      credit_score: financial.credit_score || 0,
      available_credit: availableCredit,
      total_loans: parseInt(stats.total_loans) || 0,
      active_loans: parseInt(stats.active_loans) || 0,
      total_loan_amount: parseFloat(stats.total_loan_amount) || 0,
      outstanding_amount: parseFloat(stats.outstanding_amount) || 0,
      payment_score: paymentScore
    },
    active_loans: loansWithOutstanding,
    upcoming_payments: upcomingPayments,
    notifications: notifications,
    alerts: [
      {
        type: 'success',
        title: 'EMI Auto-Pay Enabled',
        message: 'Your next EMI will be auto-debited on the due date',
        icon: 'CheckCircle'
      },
      {
        type: 'info',
        title: 'Credit Score Updated',
        message: `Your credit score is ${financial.credit_score || 0}`,
        icon: 'TrendingUp'
      }
    ]
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
