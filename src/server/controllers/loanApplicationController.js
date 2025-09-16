const Joi = require('joi');
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

// Validation schemas
const loanApplicationSchema = Joi.object({
  loan_amount: Joi.number().min(50000).max(5000000).required().messages({
    'number.min': 'Minimum loan amount is ₹50,000',
    'number.max': 'Maximum loan amount is ₹5,000,000',
    'any.required': 'Loan amount is required'
  }),
  tenure_months: Joi.number().min(6).max(60).required().messages({
    'number.min': 'Minimum tenure is 6 months',
    'number.max': 'Maximum tenure is 60 months',
    'any.required': 'Tenure in months is required'
  }),
  loan_purpose: Joi.string().min(5).max(255).required().messages({
    'string.min': 'Loan purpose must be at least 5 characters long',
    'string.max': 'Loan purpose must not exceed 255 characters',
    'any.required': 'Loan purpose is required'
  }),
  interest_rate: Joi.number().min(8).max(30).optional().messages({
    'number.min': 'Interest rate must be at least 8%',
    'number.max': 'Interest rate must not exceed 30%'
  }),
  emi_amount: Joi.number().min(1000).optional().messages({
    'number.min': 'EMI amount must be at least ₹1,000'
  })
});

/**
 * Apply for a loan
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const applyForLoan = async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    // Check if user profile is complete
    const user = await findUserById(userId);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Critical prerequisite check: Profile must be complete
    if (user.profile_completion_step < 4) {
      return res.status(403).json({
        status: 'error',
        message: 'Please complete your profile before applying for a loan',
        data: {
          profile_completion_step: user.profile_completion_step,
          required_step: 4,
          profile_completed: false
        }
      });
    }

    // Check if user has pending applications
    const hasPending = await hasPendingApplications(userId);
    if (hasPending) {
      return res.status(400).json({
        status: 'error',
        message: 'You already have a pending loan application. Please wait for it to be processed before applying for another loan.'
      });
    }

    // Validate request body
    const { error, value } = loanApplicationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        details: error.details.map(detail => detail.message)
      });
    }

    // Calculate EMI if not provided
    let emiAmount = value.emi_amount;
    if (!emiAmount && value.interest_rate) {
      // Simple EMI calculation: EMI = P * r * (1+r)^n / ((1+r)^n - 1)
      const principal = value.loan_amount;
      const rate = value.interest_rate / 100 / 12; // Monthly rate
      const months = value.tenure_months;
      
      if (rate > 0) {
        emiAmount = Math.round(principal * rate * Math.pow(1 + rate, months) / (Math.pow(1 + rate, months) - 1));
      } else {
        emiAmount = Math.round(principal / months);
      }
    }

    // Prepare application data
    const applicationData = {
      ...value,
      emi_amount: emiAmount
    };

    // Create loan application
    const newApplication = await createApplication(userId, applicationData);

    if (!newApplication) {
      return res.status(500).json({
        status: 'error',
        message: 'Failed to create loan application'
      });
    }

    // Get application summary
    const applicationSummary = getApplicationSummary(newApplication);

    res.status(201).json({
      status: 'success',
      message: 'Loan application submitted successfully',
      data: {
        application: applicationSummary,
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
      status: 'error',
      message: 'Failed to submit loan application'
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
    const userId = req.session.userId;

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
    const userId = req.session.userId;
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
    const userId = req.session.userId;

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
