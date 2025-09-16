const mysql = require('mysql2/promise');
require('dotenv').config();

async function testDashboardQuery() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'pocket_credit'
    });

    const userId = 4; // From the loan application we saw

    console.log('=== Testing Dashboard Query for User', userId, '===');
    
    // Test the pending applications query
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
    console.table(applications);

    // Also test if there are any active loans
    const [activeLoans] = await connection.execute(
      `SELECT id, loan_amount, status, created_at FROM loans 
       WHERE user_id = ? AND status IN ('active')`,
      [userId]
    );

    console.log('\n=== Active Loans ===');
    console.log('Active loans found:', activeLoans.length);
    console.table(activeLoans);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testDashboardQuery();

