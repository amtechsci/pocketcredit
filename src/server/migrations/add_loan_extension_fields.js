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
    console.log('🚀 Adding Loan Extension Fields to loan_plans table...\n');

    // Add allow_extension column
    console.log('1️⃣ Adding allow_extension column...');
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
      console.log('✅ allow_extension column added\n');
    } else {
      console.log('✅ allow_extension column already exists\n');
    }

    // Add extension_show_from_days column
    console.log('2️⃣ Adding extension_show_from_days column...');
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
      console.log('✅ extension_show_from_days column added\n');
    } else {
      console.log('✅ extension_show_from_days column already exists\n');
    }

    // Add extension_show_till_days column
    console.log('3️⃣ Adding extension_show_till_days column...');
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
      console.log('✅ extension_show_till_days column added\n');
    } else {
      console.log('✅ extension_show_till_days column already exists\n');
    }

    console.log('✅ All loan extension fields added successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding loan extension fields:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

addLoanExtensionFields();

