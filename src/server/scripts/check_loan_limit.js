require('dotenv').config();

// Set remote database config
if (!process.env.DB_HOST) {
  process.env.DB_HOST = '13.235.251.238';
  process.env.DB_USER = 'pocket';
  process.env.DB_PASSWORD = 'Pocket@9988';
  process.env.DB_NAME = 'pocket_credit';
  process.env.DB_PORT = '3306';
}

const { executeQuery, initializeDatabase } = require('../config/database');

async function checkLoanLimits() {
  try {
    await initializeDatabase();
    console.log('🔍 Checking loan limits for all students...\n');

    const students = await executeQuery(`
      SELECT id, first_name, last_name, phone, employment_type, graduation_status, loan_limit, created_at
      FROM users 
      WHERE employment_type = 'student'
      ORDER BY id DESC
      LIMIT 10
    `);

    console.log(`📊 Found ${students.length} students (showing last 10):\n`);

    students.forEach((student, index) => {
      const name = `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'N/A';
      const expectedLoanLimit = student.graduation_status === 'graduated' ? 25000 : 10000;
      const isCorrect = student.loan_limit === expectedLoanLimit;
      
      console.log(`${index + 1}. User ID: ${student.id}`);
      console.log(`   Name: ${name}`);
      console.log(`   Phone: ${student.phone}`);
      console.log(`   Graduation Status: ${student.graduation_status}`);
      console.log(`   Current Loan Limit: ₹${(student.loan_limit || 0).toLocaleString('en-IN')}`);
      console.log(`   Expected Loan Limit: ₹${expectedLoanLimit.toLocaleString('en-IN')}`);
      console.log(`   Status: ${isCorrect ? '✅ Correct' : '❌ INCORRECT'}`);
      console.log(`   Created: ${new Date(student.created_at).toLocaleDateString('en-IN')}`);
      console.log('');
    });

    console.log('\n💡 If any loan limits are incorrect:');
    console.log('   1. Run: node src/server/scripts/set_student_loan_limits.js');
    console.log('   2. Restart the server to clear cache');
    console.log('   3. Or call: POST /api/dashboard/clear-cache to clear cache for specific user');

  } catch (error) {
    console.error('❌ Error checking loan limits:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  checkLoanLimits();
}

