const { initializeDatabase, executeQuery } = require('./src/server/config/database');

async function insertSampleData() {
  try {
    console.log('🚀 Inserting sample dashboard data...\n');

    // Initialize database first
    console.log('1. Initializing database connection...');
    await initializeDatabase();
    console.log('✅ Database initialized');

    // Insert user
    console.log('\n2. Creating test user...');
    const userResult = await executeQuery(`
      INSERT INTO users (id, phone, first_name, last_name, email, status, profile_completion_step, profile_completed)
      VALUES (1, '9876543210', 'Atul', 'Mishra', 'atul.mishra@example.com', 'active', 4, TRUE)
      ON DUPLICATE KEY UPDATE 
        first_name = 'Atul',
        last_name = 'Mishra',
        email = 'atul.mishra@example.com',
        status = 'active',
        profile_completion_step = 4,
        profile_completed = TRUE
    `);
    console.log('✅ User created/updated');

    // Insert financial details
    console.log('\n3. Creating financial details...');
    const financialResult = await executeQuery(`
      INSERT INTO financial_details (user_id, monthly_income, monthly_expenses, existing_loans, credit_score, financial_verified)
      VALUES (1, 75000, 45000, 0, 720, TRUE)
      ON DUPLICATE KEY UPDATE 
        monthly_income = 75000,
        monthly_expenses = 45000,
        credit_score = 720,
        financial_verified = TRUE
    `);
    console.log('✅ Financial details created/updated');

    // Insert loan application
    console.log('\n4. Creating loan application...');
    const appResult = await executeQuery(`
      INSERT INTO loan_applications (user_id, application_number, loan_amount, loan_purpose, tenure_months, interest_rate, emi_amount, status)
      VALUES (1, 'APP001', 300000, 'Personal Loan', 24, 12.5, 15000, 'approved')
      ON DUPLICATE KEY UPDATE 
        loan_amount = 300000,
        loan_purpose = 'Personal Loan',
        tenure_months = 24,
        interest_rate = 12.5,
        emi_amount = 15000,
        status = 'approved'
    `);
    console.log('✅ Loan application created/updated');

    // Insert loan
    console.log('\n5. Creating loan...');
    const loanResult = await executeQuery(`
      INSERT INTO loans (user_id, loan_application_id, loan_number, loan_amount, disbursed_amount, interest_rate, tenure_months, emi_amount, status, disbursed_at, first_emi_date)
      VALUES (1, LAST_INSERT_ID(), 'PL001', 300000, 300000, 12.5, 24, 15000, 'active', '2023-08-15 10:00:00', '2023-09-15')
      ON DUPLICATE KEY UPDATE 
        loan_amount = 300000,
        disbursed_amount = 300000,
        interest_rate = 12.5,
        tenure_months = 24,
        emi_amount = 15000,
        status = 'active'
    `);
    console.log('✅ Loan created/updated');

    // Insert transactions
    console.log('\n6. Creating transactions...');
    const transactionResult = await executeQuery(`
      INSERT INTO transactions (user_id, loan_id, transaction_type, amount, transaction_id, payment_method, payment_gateway, status, processed_at)
      VALUES 
      (1, 1, 'emi_payment', 15000, 'TXN001', 'upi', 'razorpay', 'success', '2023-09-15 10:00:00'),
      (1, 1, 'emi_payment', 15000, 'TXN002', 'upi', 'razorpay', 'success', '2023-10-15 10:00:00'),
      (1, 1, 'emi_payment', 15000, 'TXN003', 'upi', 'razorpay', 'success', '2023-11-15 10:00:00'),
      (1, 1, 'emi_payment', 15000, 'TXN004', 'upi', 'razorpay', 'success', '2023-12-15 10:00:00')
      ON DUPLICATE KEY UPDATE 
        status = 'success'
    `);
    console.log('✅ Transactions created/updated');

    // Insert notifications
    console.log('\n7. Creating notifications...');
    const notificationResult = await executeQuery(`
      INSERT INTO notifications (user_id, title, message, notification_type, channel, status, sent_at)
      VALUES 
      (1, 'EMI Payment Successful', 'Your EMI payment of ₹15,000 has been processed successfully.', 'success', 'in_app', 'delivered', NOW()),
      (1, 'Credit Score Updated', 'Your credit score has been updated to 720. Great job!', 'info', 'in_app', 'delivered', NOW()),
      (1, 'Loan Application Approved', 'Congratulations! Your loan application has been approved.', 'success', 'in_app', 'delivered', NOW())
      ON DUPLICATE KEY UPDATE 
        status = 'delivered'
    `);
    console.log('✅ Notifications created/updated');

    console.log('\n🎉 Sample data inserted successfully!');
    console.log('\nYou can now test the dashboard by:');
    console.log('1. Starting the server: cd src/server && npm start');
    console.log('2. Logging in with phone: 9876543210');
    console.log('3. Accessing the dashboard');

  } catch (error) {
    console.error('❌ Error inserting sample data:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the script
insertSampleData();
