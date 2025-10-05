const express = require('express');
const { executeQuery, initializeDatabase } = require('../config/database');
const { requireAuth } = require('../middleware/jwtAuth');
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
    const userId = req.userId; // JWT middleware provides this

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

    await initializeDatabase();

    // Check if user already has an active loan
    const activeLoans = await executeQuery(
      `SELECT id, status FROM loan_applications WHERE user_id = ? AND status IN ('approved', 'disbursed')`,
      [userId]
    );

    if (activeLoans && activeLoans.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active loan. Please complete or close your existing loan before applying for a new one.'
      });
    }

    // Check if user has any pending loan applications
    const pendingApplications = await executeQuery(
      `SELECT id, status FROM loan_applications 
       WHERE user_id = ? AND status IN ('submitted', 'under_review')`,
      [userId]
    );

    if (pendingApplications && pendingApplications.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending loan application. Please complete your existing application before applying for a new one.'
      });
    }

    // Get user profile and employment details for eligibility checks
    const users = await executeQuery(
      `SELECT u.*, ed.monthly_salary, ed.employment_type, ed.company_name
       FROM users u 
       LEFT JOIN employment_details ed ON u.id = ed.user_id
       WHERE u.id = ?`,
      [userId]
    );

    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found'
      });
    }

    const user = users[0];

    // Generate unique application number
    const applicationNumber = `LA${Date.now()}${Math.floor(Math.random() * 1000000)}`;
    const currentDate = new Date();

    // Create loan application
    const result = await executeQuery(
      `INSERT INTO loan_applications (
        user_id, application_number, loan_amount, loan_purpose, 
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'submitted', NOW(), NOW())`,
      [userId, applicationNumber, desired_amount, purpose]
    );

    const applicationId = result.insertId;

    res.status(201).json({
      success: true,
      message: 'Loan application created successfully',
      data: {
        id: applicationId,
        application_number: applicationNumber,
        desired_amount: desired_amount,
        purpose: purpose,
        status: 'submitted',
        created_at: currentDate.toISOString()
      }
    });

  } catch (error) {
    console.error('Create loan application error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while creating loan application'
    });
  }
});

// GET /api/loans/pending - Get Pending Loan Applications for Dashboard
router.get('/pending', requireAuth, async (req, res) => {
  const startTime = Date.now();
  try {
    await initializeDatabase(); // Initialize DB
    const userId = req.userId;

    // Create a timeout promise (5 seconds)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Query timeout')), 5000);
    });

    const queryPromise = (async () => {
      console.log('Database connection established'); // This log is now less relevant as connection is managed by executeQuery

      // Query for pending loan applications
      const applications = await executeQuery(
        `SELECT DISTINCT
          la.id,
          la.application_number,
          la.loan_amount,
          la.loan_purpose,
          la.status,
          la.created_at
        FROM loan_applications la
        WHERE la.user_id = ? AND la.status IN ('submitted', 'under_review', 'approved', 'disbursed')
        ORDER BY la.created_at DESC
        LIMIT 10`,
        [userId]
      );

      // Transform data to avoid nested objects
      const responseData = applications.map(app => ({
        id: app.id,
        application_number: app.application_number,
        loan_amount: parseFloat(app.loan_amount) || 0,
        loan_purpose: app.loan_purpose || 'Not specified',
        status: app.status || 'submitted',
        created_at: app.created_at ? new Date(app.created_at).toISOString() : new Date().toISOString(),
        days_pending: 0 // Simplified calculation
      }));

      console.log(`Processed ${responseData.length} applications successfully`);
      return responseData;
    })();

    const finalData = await Promise.race([queryPromise, timeoutPromise]);
    const endTime = Date.now();
    console.log(`⏱️ Pending applications query completed in ${endTime - startTime}ms`);

    res.json({
      success: true,
      data: {
        applications: finalData || [],
        total_count: finalData ? finalData.length : 0
      }
    });

  } catch (error) {
    const endTime = Date.now();
    console.error(`❌ Pending applications error after ${endTime - startTime}ms:`, error.message);
    
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching pending loan applications'
    });
  }
});

// GET /api/loans/:applicationId - Get Loan Application Details
router.get('/:applicationId', requireAuth, async (req, res) => {
  try {
    const userId = req.userId; // JWT middleware provides this
    const { applicationId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    await initializeDatabase();

    // Get loan application details - simplified query to avoid timeout
    const applications = await executeQuery(
      `SELECT id, application_number, loan_amount, loan_purpose, status, created_at
       FROM loan_applications 
       WHERE id = ? AND user_id = ?`,
      [applicationId, userId]
    );

    if (!applications || applications.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Loan application not found'
      });
    }


    const application = applications[0];

    // Get current step separately to avoid complex joins
    let currentStep = 'bank_details';
    try {
      const bankDetails = await executeQuery(
        'SELECT id FROM bank_details WHERE loan_application_id = ? LIMIT 1',
        [applicationId]
      );
      
      const references = await executeQuery(
        'SELECT id FROM loan_references WHERE application_id = ? LIMIT 1',
        [applicationId]
      );
      
      if (bankDetails && bankDetails.length > 0 && references && references.length > 0) {
        currentStep = 'completed';
      } else if (bankDetails && bankDetails.length > 0) {
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