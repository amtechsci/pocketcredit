const express = require('express');
const { executeQuery, initializeDatabase } = require('../config/database');
const { requireAuth } = require('../middleware/jwtAuth');
const router = express.Router();

// =====================================================
// LOAN APPLICATION MANAGEMENT
// =====================================================

// NOTE: Old /api/loans/apply endpoint removed - use /api/loan-applications/apply instead

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

      // Query for pending loan applications (including all new statuses)
      // Include repeat_disbursal, ready_to_repeat_disbursal, and cancelled statuses
      const applications = await executeQuery(
        `SELECT 
          la.id,
          la.application_number,
          la.loan_amount,
          la.loan_purpose,
          la.status,
          DATE_FORMAT(la.created_at, '%Y-%m-%d %H:%i:%s') as created_at
        FROM loan_applications la
        WHERE la.user_id = ? AND la.status IN ('submitted', 'under_review', 'follow_up', 'ready_for_disbursement', 'disbursal', 'account_manager', 'cleared', 'repeat_disbursal', 'ready_to_repeat_disbursal', 'cancelled')
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
        created_at: app.created_at || null, // Already formatted as IST string from SQL
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
      // Check if loan application has bank details linked
      const loanWithBank = await executeQuery(
        'SELECT user_bank_id FROM loan_applications WHERE id = ? AND user_bank_id IS NOT NULL',
        [applicationId]
      );
      
      // Check if user has exactly 3 references and alternate data (user-level, not loan-specific)
      const userReferences = await executeQuery(
        'SELECT COUNT(*) as ref_count FROM `references` WHERE user_id = ?',
        [userId]
      );
      
      // Check if user has alternate data
      const userAlternateData = await executeQuery(
        'SELECT alternate_mobile, company_name, company_email FROM users WHERE id = ?',
        [userId]
      );
      
      const hasRequiredReferences = userReferences && userReferences.length > 0 && userReferences[0].ref_count === 3;
      const hasAlternateData = userAlternateData && userAlternateData.length > 0 && 
        userAlternateData[0].alternate_mobile && userAlternateData[0].company_name && userAlternateData[0].company_email;
      
      if (loanWithBank && loanWithBank.length > 0 && hasRequiredReferences && hasAlternateData) {
        currentStep = 'completed';
      } else if (loanWithBank && loanWithBank.length > 0) {
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