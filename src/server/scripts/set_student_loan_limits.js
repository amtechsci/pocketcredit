/**
 * Migration Script: Set loan limits for existing students
 * 
 * This script sets the loan_limit for students who don't have it set:
 * - Not Graduated: ₹10,000
 * - Graduated: ₹25,000
 */

require('dotenv').config();

// Set remote database config if not set
if (!process.env.DB_HOST) {
  process.env.DB_HOST = '13.235.251.238';
  process.env.DB_USER = 'pocket';
  process.env.DB_PASSWORD = 'Pocket@9988';
  process.env.DB_NAME = 'pocket_credit';
  process.env.DB_PORT = '3306';
}

const { executeQuery, initializeDatabase } = require('../config/database');

async function setStudentLoanLimits() {
  try {
    await initializeDatabase();
    console.log('🔧 Starting migration: Set loan limits for students');

    // Get all students without loan_limit set
    const students = await executeQuery(`
      SELECT id, graduation_status, loan_limit 
      FROM users 
      WHERE employment_type = 'student'
    `);

    console.log(`📊 Found ${students.length} students`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const student of students) {
      // Determine loan limit based on graduation status
      const loanLimit = student.graduation_status === 'graduated' ? 25000 : 10000;
      
      // Only update if loan_limit is NULL or 0
      if (!student.loan_limit || student.loan_limit === 0) {
        await executeQuery(`
          UPDATE users 
          SET loan_limit = ?, updated_at = NOW() 
          WHERE id = ?
        `, [loanLimit, student.id]);

        console.log(`  ✅ User ${student.id}: Set loan_limit to ₹${loanLimit.toLocaleString('en-IN')} (${student.graduation_status || 'not_graduated'})`);
        updatedCount++;
      } else {
        console.log(`  ⏭️  User ${student.id}: Already has loan_limit ₹${student.loan_limit.toLocaleString('en-IN')} (skipped)`);
        skippedCount++;
      }
    }

    console.log('\n✅ Migration completed successfully!');
    console.log(`   Updated: ${updatedCount} students`);
    console.log(`   Skipped: ${skippedCount} students (already had loan_limit)`);
    console.log(`   Total:   ${students.length} students`);

  } catch (error) {
    console.error('❌ Error during migration:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  setStudentLoanLimits().then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  });
}

module.exports = { setStudentLoanLimits };

