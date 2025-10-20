const mysql = require('mysql2/promise');
require('dotenv').config();

async function testUserProfileRoute() {
  let connection;
  
  try {
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'pocket_credit'
    });

    console.log('Connected to database');

    // Test the query that's failing
    const userId = 20;
    
    console.log('\n1. Testing user query...');
    const [users] = await connection.execute(`
      SELECT 
        id, first_name, last_name, email, phone, 
        date_of_birth, gender, marital_status, kyc_completed, 
        email_verified, phone_verified, status, profile_completion_step, 
        profile_completed, eligibility_status, eligibility_reason, 
        eligibility_retry_date, created_at, updated_at, last_login_at
      FROM users 
      WHERE id = ?
    `, [userId]);
    
    console.log('✓ User found:', users.length > 0 ? 'Yes' : 'No');
    if (users.length > 0) {
      console.log('  User:', users[0].first_name, users[0].last_name);
    }
    
    console.log('\n2. Testing loan applications query...');
    const [applications] = await connection.execute(`
      SELECT 
        id, application_number, loan_amount, loan_purpose, 
        tenure_months, interest_rate, status, rejection_reason, 
        approved_by, approved_at, disbursed_at, created_at, updated_at,
        processing_fee_percent, interest_percent_per_day, 
        processing_fee, total_interest, total_repayable, plan_snapshot
      FROM loan_applications 
      WHERE user_id = ?
      ORDER BY created_at DESC
    `, [userId]);
    
    console.log('✓ Applications found:', applications.length);
    if (applications.length > 0) {
      console.log('  First application:', applications[0].application_number);
      console.log('  Status:', applications[0].status);
      console.log('  Processing Fee %:', applications[0].processing_fee_percent);
      console.log('  Interest % per day:', applications[0].interest_percent_per_day);
    }
    
    console.log('\n3. Testing addresses query...');
    const [addresses] = await connection.execute(`
      SELECT * FROM addresses WHERE user_id = ? AND is_primary = 1 LIMIT 1
    `, [userId]);
    console.log('✓ Addresses found:', addresses.length);
    
    console.log('\n4. Testing employment query...');
    const [employment] = await connection.execute(`
      SELECT * FROM employment_details WHERE user_id = ? LIMIT 1
    `, [userId]);
    console.log('✓ Employment records found:', employment.length);
    
    console.log('\n✅ All queries executed successfully!');
    console.log('The route should work. Make sure to restart the backend server.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\nDatabase connection closed');
    }
  }
}

testUserProfileRoute();

