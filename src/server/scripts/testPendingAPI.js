const mysql = require('mysql2/promise');
require('dotenv').config();

async function testPendingAPI() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'pocket_credit'
    });

    const userId = 4; // User with pending application

    console.log('=== Testing Pending API Logic for User', userId, '===');
    
    // First check if user has any active loans
    const [activeLoans] = await connection.execute(
      `SELECT id, loan_amount, status, created_at FROM loans 
       WHERE user_id = ? AND status IN ('active')`,
      [userId]
    );

    console.log('Active loans found:', activeLoans.length);
    if (activeLoans.length > 0) {
      console.log('Active loans:', activeLoans);
      return;
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
    console.log('Applications:', applications);

    // Simulate the API response
    const apiResponse = {
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

    console.log('\n=== API Response ===');
    console.log(JSON.stringify(apiResponse, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testPendingAPI();