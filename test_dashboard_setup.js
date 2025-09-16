const { initializeDatabase, executeQuery } = require('./src/server/config/database');

async function testDashboardSetup() {
  try {
    console.log('🧪 Testing Dashboard Setup...\n');

    // Initialize database first
    console.log('1. Initializing database connection...');
    await initializeDatabase();
    console.log('✅ Database initialized');

    // Test 1: Check if user exists
    console.log('\n2. Checking if test user exists...');
    const users = await executeQuery('SELECT id, first_name, last_name, phone FROM users WHERE id = 1');
    
    if (users && users.length > 0) {
      console.log('✅ User found:', users[0]);
    } else {
      console.log('❌ User not found. Please run sample_dashboard_data.sql first.');
      return;
    }

    // Test 2: Check financial details
    console.log('\n3. Checking financial details...');
    const financial = await executeQuery('SELECT credit_score, monthly_income FROM financial_details WHERE user_id = 1');
    
    if (financial && financial.length > 0) {
      console.log('✅ Financial details found:', financial[0]);
    } else {
      console.log('❌ Financial details not found.');
    }

    // Test 3: Check loans
    console.log('\n4. Checking loans...');
    const loans = await executeQuery('SELECT id, loan_number, loan_amount, status FROM loans WHERE user_id = 1');
    
    if (loans && loans.length > 0) {
      console.log('✅ Loans found:', loans);
    } else {
      console.log('❌ No loans found.');
    }

    // Test 4: Check transactions
    console.log('\n5. Checking transactions...');
    const transactions = await executeQuery('SELECT id, amount, transaction_type, status FROM transactions WHERE user_id = 1');
    
    if (transactions && transactions.length > 0) {
      console.log('✅ Transactions found:', transactions);
    } else {
      console.log('❌ No transactions found.');
    }

    // Test 5: Test dashboard query
    console.log('\n6. Testing dashboard summary query...');
    const dashboardData = await executeQuery(`
      SELECT 
        u.id, u.first_name, u.last_name, u.phone, u.email,
        fd.credit_score, fd.monthly_income,
        COUNT(l.id) as total_loans,
        SUM(CASE WHEN l.status = 'active' THEN 1 ELSE 0 END) as active_loans
      FROM users u
      LEFT JOIN financial_details fd ON u.id = fd.user_id
      LEFT JOIN loans l ON u.id = l.user_id
      WHERE u.id = 1
      GROUP BY u.id
    `);

    if (dashboardData && dashboardData.length > 0) {
      console.log('✅ Dashboard query successful:', dashboardData[0]);
    } else {
      console.log('❌ Dashboard query failed.');
    }

    console.log('\n🎉 Dashboard setup test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testDashboardSetup();