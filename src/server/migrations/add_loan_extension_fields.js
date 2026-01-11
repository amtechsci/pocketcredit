const mysql = require('mysql2/promise');

async function addLoanExtensionFields() {
  const pool = mysql.createPool({
    host: '13.235.251.238',
    user: 'pocket',
    password: 'Pocket@9988',
    database: 'pocket_credit',
    port: 3306
  });

  try {

    // Add allow_extension column
    const [allowExtensionColumns] = await pool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'pocket_credit' 
      AND TABLE_NAME = 'loan_plans' 
      AND COLUMN_NAME = 'allow_extension'
    `);

    if (allowExtensionColumns.length === 0) {
      await pool.query(`
        ALTER TABLE loan_plans 
        ADD COLUMN allow_extension TINYINT(1) DEFAULT 0 
        COMMENT 'Whether loan extension is allowed for this plan'
      `);
    } else {
    }

    // Add extension_show_from_days column
    const [showFromColumns] = await pool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'pocket_credit' 
      AND TABLE_NAME = 'loan_plans' 
      AND COLUMN_NAME = 'extension_show_from_days'
    `);

    if (showFromColumns.length === 0) {
      await pool.query(`
        ALTER TABLE loan_plans 
        ADD COLUMN extension_show_from_days INT NULL 
        COMMENT 'Days before due date when extension option becomes available (negative number, e.g., -5 for D-5)'
      `);
    } else {
    }

    // Add extension_show_till_days column
    const [showTillColumns] = await pool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'pocket_credit' 
      AND TABLE_NAME = 'loan_plans' 
      AND COLUMN_NAME = 'extension_show_till_days'
    `);

    if (showTillColumns.length === 0) {
      await pool.query(`
        ALTER TABLE loan_plans 
        ADD COLUMN extension_show_till_days INT NULL 
        COMMENT 'Days after due date when extension option expires (positive number, e.g., 15 for D+15)'
      `);
    } else {
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding loan extension fields:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

addLoanExtensionFields();

