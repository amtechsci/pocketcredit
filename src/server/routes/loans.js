const express = require('express');
const { getConnection } = require('../utils/mysqlDatabase');
const { requireAuth } = require('../middleware/session');
const router = express.Router();

// =====================================================
// LOAN APPLICATION MANAGEMENT
// =====================================================

// Test endpoint
router.get('/test', (req, res) => {
  res.json({ message: 'Loans route is working' });
});

// POST /api/loans/apply - Create New Loan Application
router.post('/apply', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { 
      desired_amount, 
      purpose
    } = req.body;

    // Validation
    if (!desired_amount || !purpose) {
      return res.status(400).json({
        success: false,
        message: 'Loan amount and purpose are required'
      });
    }

    if (desired_amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Loan amount must be greater than 0'
      });
    }

    const connection = await getConnection();

    // Check if user already has an active loan
    const [activeLoans] = await connection.execute(
      `SELECT id, status FROM loans WHERE user_id = ? AND status IN ('active')`,
      [userId]
    );

    if (activeLoans.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active loan. Please complete or close your existing loan before applying for a new one.'
      });
    }

    // Check if user has any pending loan applications
    const [pendingApplications] = await connection.execute(
      `SELECT id, status FROM loan_applications 
       WHERE user_id = ? AND status IN ('submitted', 'under_review', 'approved', 'disbursed')`,
      [userId]
    );

    if (pendingApplications.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending loan application. Please complete your existing application before applying for a new one.'
      });
    }

    // Get user profile and employment details for eligibility checks
    const [users] = await connection.execute(
      `SELECT u.*, ed.monthly_salary, ed.employment_type, ed.company_name
       FROM users u 
       LEFT JOIN employment_details ed ON u.id = ed.user_id
       WHERE u.id = ?`,
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];

    // Check if user has completed profile setup
    if (!user.profile_completed) {
      return res.status(400).json({
        success: false,
        message: 'Please complete your profile setup before applying for a loan'
      });
    }

    // Basic eligibility check using employment details
    if (!user.monthly_salary || user.monthly_salary < 25000) {
      return res.status(400).json({
        success: false,
        message: 'Minimum monthly income of ₹25,000 required for loan application'
      });
    }

    // Generate application number
    const applicationNumber = `LA${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // Default tenure is 30 months as per requirements
    const tenureMonths = 30;

    // Insert loan application
    const [result] = await connection.execute(
      `INSERT INTO loan_applications 
       (user_id, application_number, loan_amount, loan_purpose, tenure_months, status) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, applicationNumber, desired_amount, purpose, tenureMonths, 'submitted']
    );

    res.status(201).json({
      success: true,
      message: 'Loan application submitted successfully',
      data: {
        application_id: result.insertId,
        application_number: applicationNumber,
        status: 'submitted',
        current_step: 'bank_details'
      }
    });

  } catch (error) {
    console.error('Loan application error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while creating loan application'
    });
  }
});

// GET /api/loans/pending - Get Pending Loan Applications for Dashboard
router.get('/pending', requireAuth, async (req, res) => {
  let connection;
  const startTime = Date.now();
  
  try {
    console.log('Pending applications API: Starting...');
    const userId = req.session.userId;
    console.log('Pending applications API called for user ID:', userId);

    if (!userId) {
      console.log('No user ID in session');
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Set a longer timeout for the entire operation
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database query timeout')), 30000);
    });

    const queryPromise = (async () => {
      connection = await getConnection();
      console.log('Database connection established');

      // First check if user has any active loans
      const [activeLoans] = await connection.execute(
        `SELECT id, loan_amount, status, created_at FROM loans 
         WHERE user_id = ? AND status IN ('active')`,
        [userId]
      );

      if (activeLoans.length > 0) {
        // Return active loans as "pending" for dashboard display
        return res.json({
          success: true,
          data: {
            applications: activeLoans.map(loan => ({
              id: loan.id,
              application_number: `LOAN-${loan.id}`,
              loan_amount: loan.loan_amount,
              loan_purpose: 'Active Loan',
              status: loan.status,
              current_step: 'active_loan',
              created_at: loan.created_at
            }))
          }
        });
      }

      // If no active loans, check for pending loan applications with optimized query
      console.log('Querying pending loan applications...');
      const [applications] = await connection.execute(
        'SELECT\n' +
        '  la.id,\n' +
        '  la.application_number,\n' +
        '  la.loan_amount,\n' +
        '  la.loan_purpose,\n' +
        '  la.status,\n' +
        '  la.created_at,\n' +
        '  CASE\n' +
        "    WHEN bd.id IS NOT NULL AND ref.id IS NOT NULL THEN 'completed'\n" +
        "    WHEN bd.id IS NOT NULL THEN 'references'\n" +
        "    ELSE 'bank_details'\n" +
        '  END as current_step\n' +
        'FROM loan_applications la\n' +
        'LEFT JOIN bank_details bd ON la.id = bd.loan_application_id\n' +
        'LEFT JOIN `references` ref ON la.id = ref.loan_application_id\n' +
        "WHERE la.user_id = ? AND la.status IN ('submitted', 'under_review', 'approved', 'disbursed')\n" +
        'ORDER BY la.created_at DESC\n' +
        'LIMIT 10',
        [userId]
      );

      console.log(`Found ${applications.length} pending applications`);

      const responseData = {
        success: true,
        data: {
          applications: applications.map(app => ({
            id: app.id,
            application_number: app.application_number,
            loan_amount: app.loan_amount,
            loan_purpose: app.loan_purpose,
            status: app.status,
            current_step: app.current_step,
            created_at: app.created_at
          }))
        }
      };

      console.log('Returning pending applications:', responseData);
      res.json(responseData);
    })();

    // Race between query and timeout
    await Promise.race([queryPromise, timeoutPromise]);
    
    // Log performance metrics
    const duration = Date.now() - startTime;
    console.log(`Pending applications API completed in ${duration}ms`);

  } catch (error) {
    console.error('Get pending loan applications error:', error);
    
    if (error.message === 'Database query timeout') {
      res.status(408).json({
        success: false,
        message: 'Request timeout - please try again'
      });
    } else if (error.code === 'ECONNRESET' || error.code === 'PROTOCOL_CONNECTION_LOST') {
      res.status(503).json({
        success: false,
        message: 'Database connection lost - please try again'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error while fetching pending loan applications'
      });
    }
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.warn('Error releasing database connection:', releaseError.message);
      }
    }
  }
});

// GET /api/loans/:applicationId - Get Loan Application Details
router.get('/:applicationId', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { applicationId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const connection = await getConnection();

    // Get loan application details - simplified query to avoid timeout
    const [applications] = await connection.execute(
      `SELECT id, application_number, loan_amount, loan_purpose, status, created_at
       FROM loan_applications 
       WHERE id = ? AND user_id = ?`,
      [applicationId, userId]
    );

    if (applications.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Loan application not found'
      });
    }

    const application = applications[0];

    // Get current step separately to avoid complex joins
    let currentStep = 'bank_details';
    try {
      const [bankDetails] = await connection.execute(
        'SELECT id FROM bank_details WHERE loan_application_id = ? LIMIT 1',
        [applicationId]
      );
      
      const [references] = await connection.execute(
        'SELECT id FROM `references` WHERE loan_application_id = ? LIMIT 1',
        [applicationId]
      );
      
      if (bankDetails.length > 0 && references.length > 0) {
        currentStep = 'completed';
      } else if (bankDetails.length > 0) {
        currentStep = 'references';
      } else {
        currentStep = 'bank_details';
      }
    } catch (stepError) {
      console.warn(`Error getting step for application ${applicationId}:`, stepError.message);
      currentStep = 'bank_details';
    }

    res.json({
      success: true,
      data: {
        id: application.id,
        application_number: application.application_number,
        loan_amount: application.loan_amount,
        loan_purpose: application.loan_purpose,
        status: application.status,
        current_step: currentStep,
        created_at: application.created_at
      }
    });

  } catch (error) {
    console.error('Get loan application error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching loan application'
    });
  }
});

module.exports = router;