const { findUserById } = require('../models/user');
const { 
  createApplication, 
  findApplicationsByUserId, 
  getApplicationStats,
  hasPendingApplications,
  getApplicationSummary 
} = require('../models/loanApplicationModel');

/**
 * Loan Application Controller
 * Handles loan application business logic with profile validation
 */

// NOTE: Joi validation removed - using simple validation like the old /loans/apply endpoint
// This allows flexibility for plan-based loans without strict schema constraints

/**
 * Apply for a loan
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const applyForLoan = async (req, res) => {
  try {
    // Get userId from JWT auth (req.userId) or session (req.session.userId) for hybrid auth
    const userId = req.userId || req.session?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        status: 'error',
        message: 'Authentication required'
      });
    }

    // Check if user profile is complete
    const user = await findUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        status: 'error',
        message: 'User not found'
      });
    }

    // Critical prerequisite check: Profile must be complete
    // Changed from step < 4 to step < 2, as step 4 doesn't exist in the flow
    // Step 2 = Employment quick check completed, which is the minimum to apply
    if (user.profile_completion_step < 2) {
      return res.status(403).json({
        success: false,
        status: 'error',
        message: 'Please complete your profile before applying for a loan',
        data: {
          profile_completion_step: user.profile_completion_step,
          required_step: 2,
          profile_completed: false
        }
      });
    }

    // Check if user's loan limit has reached cooling period threshold (>= ₹45,600)
    const userLoanLimit = parseFloat(user.loan_limit) || 0;
    if (userLoanLimit >= 45600) {
      // User has reached or exceeded the maximum regular limit threshold
      // Mark them in cooling period if not already marked
      if (user.status !== 'on_hold') {
        const { checkAndMarkCoolingPeriod } = require('../utils/creditLimitCalculator');
        // Calculate credit limit to get full data for cooling period check
        const { calculateCreditLimitFor2EMI } = require('../utils/creditLimitCalculator');
        try {
          const creditLimitData = await calculateCreditLimitFor2EMI(userId);
          await checkAndMarkCoolingPeriod(userId, null, creditLimitData);
          console.log(`[LoanApplication] User ${userId} with limit ₹${userLoanLimit} marked in cooling period during application attempt`);
        } catch (coolingPeriodError) {
          console.error('❌ Error marking cooling period (non-fatal):', coolingPeriodError);
          // Continue to block even if marking fails
        }
      }
      
      return res.status(403).json({
        success: false,
        status: 'error',
        message: 'Your Profile is under cooling period. We will let you know once you are eligible.',
        hold_status: {
          is_on_hold: true,
          hold_type: 'permanent',
          hold_reason: 'Your Profile is under cooling period. We will let you know once you are eligible.',
          can_reapply: false,
          loan_limit: userLoanLimit,
          threshold: 45600
        }
      });
    }

    // Check if user is on hold (cooling period or other hold reasons)
    if (user.status === 'on_hold') {
      const holdReason = user.application_hold_reason || 'Your account is on hold';
      
      // Check if it's a temporary hold (has hold_until_date)
      if (user.hold_until_date) {
        const holdUntil = new Date(user.hold_until_date);
        const now = new Date();
        
        if (now <= holdUntil) {
          // Still on hold - calculate remaining days
          const remainingDays = Math.ceil((holdUntil - now) / (1000 * 60 * 60 * 24));
          
          return res.status(403).json({
            success: false,
            status: 'error',
            message: holdReason,
            hold_status: {
              is_on_hold: true,
              hold_type: 'temporary',
              hold_reason: holdReason,
              hold_until: holdUntil.toISOString(),
              remaining_days: remainingDays
            }
          });
        }
        // Hold expired - continue (will be updated by middleware or other process)
      } else {
        // Permanent hold (no hold_until_date) - block application
        return res.status(403).json({
          success: false,
          status: 'error',
          message: holdReason,
          hold_status: {
            is_on_hold: true,
            hold_type: 'permanent',
            hold_reason: holdReason,
            can_reapply: false
          }
        });
      }
    }

    // Check if user has pending applications
    const hasPending = await hasPendingApplications(userId);
    if (hasPending) {
      return res.status(400).json({
        success: false,
        status: 'error',
        message: 'You already have a pending loan application. Please wait for it to be processed before applying for another loan.'
      });
    }

    // Simple validation (removed Joi schema - like old /loans/apply endpoint)
    const { loan_amount, loan_purpose } = req.body;
    
    if (!loan_amount || !loan_purpose) {
      return res.status(400).json({
        success: false,
        status: 'error',
        message: 'Loan amount and purpose are required'
      });
    }

    if (loan_amount <= 0) {
      return res.status(400).json({
        success: false,
        status: 'error',
        message: 'Loan amount must be greater than 0'
      });
    }

    // Prepare application data from request body (no transformation needed)
    const applicationData = req.body;
    

    // Create loan application
    const newApplication = await createApplication(userId, applicationData);

    if (!newApplication) {
      return res.status(500).json({
        success: false,
        status: 'error',
        message: 'Failed to create loan application'
      });
    }

    // Link loan to partner lead if UTM parameters are present
    try {
      const { utm_source } = req.body;
      if (utm_source) {
        const { linkLoanToLead } = require('../services/partnerPayoutService');
        await linkLoanToLead(userId, newApplication.id, utm_source);
      }
    } catch (partnerLinkError) {
      console.error('Error linking loan to partner lead (non-critical):', partnerLinkError.message);
      // Don't fail loan creation if partner linking fails
    }

    // Get application summary
    const applicationSummary = getApplicationSummary(newApplication);

    res.status(201).json({
      success: true,
      status: 'success',
      message: 'Loan application submitted successfully',
      data: {
        application: applicationSummary,
        application_id: newApplication.id || applicationSummary.id,  // For backward compatibility
        next_steps: [
          'Your application is under review',
          'You will receive updates via SMS and email',
          'Check your application status regularly'
        ]
      }
    });

  } catch (error) {
    console.error('Apply for loan error:', error);
    res.status(500).json({
      success: false,
      status: 'error',
      message: 'Failed to submit loan application',
      error: error.message
    });
  }
};

/**
 * Get all user loan applications
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAllUserLoanApplications = async (req, res) => {
  try {
    const userId = req.userId || req.session?.userId;

    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    // Get user's loan applications
    const applications = await findApplicationsByUserId(userId);

    // Get application statistics
    const stats = await getApplicationStats(userId);

    // Convert to application summaries
    const applicationSummaries = applications.map(app => getApplicationSummary(app));

    res.json({
      status: 'success',
      data: {
        applications: applicationSummaries,
        statistics: stats,
        total_applications: applications.length
      }
    });

  } catch (error) {
    console.error('Get user loan applications error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve loan applications'
    });
  }
};

/**
 * Get loan application by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getLoanApplicationById = async (req, res) => {
  try {
    const userId = req.userId || req.session?.userId;
    const { applicationId } = req.params;

    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    const { findApplicationById } = require('../models/loanApplicationModel');
    const application = await findApplicationById(applicationId);

    if (!application) {
      return res.status(404).json({
        status: 'error',
        message: 'Loan application not found'
      });
    }

    // Check if the application belongs to the current user
    if (application.user_id !== userId) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. This application does not belong to you.'
      });
    }

    const applicationSummary = getApplicationSummary(application);

    res.json({
      status: 'success',
      data: {
        application: applicationSummary
      }
    });

  } catch (error) {
    console.error('Get loan application by ID error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve loan application'
    });
  }
};

/**
 * Get loan application statistics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getLoanApplicationStats = async (req, res) => {
  try {
    const userId = req.userId || req.session?.userId;

    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    const stats = await getApplicationStats(userId);

    res.json({
      status: 'success',
      data: {
        statistics: stats
      }
    });

  } catch (error) {
    console.error('Get loan application stats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve loan application statistics'
    });
  }
};

module.exports = {
  applyForLoan,
  getAllUserLoanApplications,
  getLoanApplicationById,
  getLoanApplicationStats
};
