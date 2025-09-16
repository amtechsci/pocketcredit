const express = require('express');
const session = require('express-session');
const { getConnection } = require('../utils/mysqlDatabase');

// Create a test app
const app = express();

// Mock session middleware
app.use(session({
  secret: 'test-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// Test the pending applications endpoint without auth
app.get('/test-pending', async (req, res) => {
  try {
    const userId = 4; // Hardcode user ID for testing
    console.log('Testing with userId:', userId);

    const connection = await getConnection();

    // First check if user has any active loans
    const [activeLoans] = await connection.execute(
      `SELECT id, loan_amount, status, created_at FROM loans 
       WHERE user_id = ? AND status IN ('active')`,
      [userId]
    );

    console.log('Active loans found:', activeLoans.length);

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

    // If no active loans, check for pending loan applications
    const [applications] = await connection.execute(
      `SELECT la.*, 
              CASE 
                WHEN bd.id IS NOT NULL AND ref.id IS NOT NULL THEN 'completed'
                WHEN bd.id IS NOT NULL THEN 'references'
                ELSE 'bank_details'
              END as current_step
       FROM loan_applications la
       LEFT JOIN bank_details bd ON la.id = bd.loan_application_id
       LEFT JOIN \`references\` ref ON la.id = ref.loan_application_id
       WHERE la.user_id = ? AND la.status IN ('submitted', 'under_review', 'approved', 'disbursed')
       ORDER BY la.created_at DESC`,
      [userId]
    );

    console.log('Pending applications found:', applications.length);

    res.json({
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
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

const PORT = 3003;
app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
  console.log('Visit http://localhost:3003/test-pending to test the pending applications API');
});

