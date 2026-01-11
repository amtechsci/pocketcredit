const mysql = require('mysql2/promise');

async function addInterestPercentPerDayColumn() {
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
      AND COLUMN_NAME = 'interest_percent_per_day'
    `);

    if (columns.length > 0) {
      await pool.end();
      return;
    }

    // Add interest_percent_per_day column
    // Using DECIMAL(7,5) to support values like 0.30000 (0.3% per day) or 0.00100 (0.1% per day)
    await pool.query(`
      ALTER TABLE loan_plans 
      ADD COLUMN interest_percent_per_day DECIMAL(7,5) NULL DEFAULT NULL
      COMMENT 'Daily interest percentage as decimal (e.g., 0.001 = 0.1% per day, 0.003 = 0.3% per day). Used for both single and multi-EMI plans.'
      AFTER calculate_by_salary_date
    `);

    
    await pool.end();
  } catch (error) {
    console.error('❌ Error adding interest_percent_per_day column:', error);
    await pool.end();
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  addInterestPercentPerDayColumn()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = addInterestPercentPerDayColumn;

