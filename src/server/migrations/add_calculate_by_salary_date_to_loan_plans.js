const mysql = require('mysql2/promise');

async function addCalculateBySalaryDateColumn() {
  const pool = mysql.createPool({
    host: '13.235.251.238',
    user: 'pocket',
    password: 'Pocket@9988',
    database: 'pocket_credit',
    port: 3306
  });

  try {

    // Check if column already exists
    const [columns] = await pool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'pocket_credit' 
      AND TABLE_NAME = 'loan_plans' 
      AND COLUMN_NAME = 'calculate_by_salary_date'
    `);

    if (columns.length > 0) {
      await pool.end();
      return;
    }

    // Add calculate_by_salary_date column
    await pool.query(`
      ALTER TABLE loan_plans 
      ADD COLUMN calculate_by_salary_date TINYINT(1) DEFAULT 0 
      COMMENT 'If 1, calculate repayment dates based on user salary date (for both single and multi-EMI plans)'
      AFTER repayment_days
    `);

    
    await pool.end();
  } catch (error) {
    console.error('❌ Error adding calculate_by_salary_date column:', error);
    await pool.end();
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  addCalculateBySalaryDateColumn()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = addCalculateBySalaryDateColumn;

