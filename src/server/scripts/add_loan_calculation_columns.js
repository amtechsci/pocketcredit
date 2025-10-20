const mysql = require('mysql2/promise');
require('dotenv').config();

async function addLoanCalculationColumns() {
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

    // Check if columns exist
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'loan_applications'
    `, [process.env.DB_NAME || 'pocket_credit']);

    const existingColumns = columns.map(col => col.COLUMN_NAME);
    
    // Add processing_fee_percent if it doesn't exist
    if (!existingColumns.includes('processing_fee_percent')) {
      console.log('Adding processing_fee_percent column...');
      await connection.execute(`
        ALTER TABLE loan_applications 
        ADD COLUMN processing_fee_percent DECIMAL(5,2) DEFAULT 14.00 COMMENT 'Processing fee percentage'
      `);
      console.log('✓ Added processing_fee_percent column');
    } else {
      console.log('✓ processing_fee_percent column already exists');
    }

    // Add interest_percent_per_day if it doesn't exist
    if (!existingColumns.includes('interest_percent_per_day')) {
      console.log('Adding interest_percent_per_day column...');
      await connection.execute(`
        ALTER TABLE loan_applications 
        ADD COLUMN interest_percent_per_day DECIMAL(5,4) DEFAULT 0.3000 COMMENT 'Daily interest percentage'
      `);
      console.log('✓ Added interest_percent_per_day column');
    } else {
      console.log('✓ interest_percent_per_day column already exists');
    }

    // Add processing_fee if it doesn't exist
    if (!existingColumns.includes('processing_fee')) {
      console.log('Adding processing_fee column...');
      await connection.execute(`
        ALTER TABLE loan_applications 
        ADD COLUMN processing_fee DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Calculated processing fee amount'
      `);
      console.log('✓ Added processing_fee column');
    } else {
      console.log('✓ processing_fee column already exists');
    }

    // Add total_interest if it doesn't exist
    if (!existingColumns.includes('total_interest')) {
      console.log('Adding total_interest column...');
      await connection.execute(`
        ALTER TABLE loan_applications 
        ADD COLUMN total_interest DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Calculated total interest'
      `);
      console.log('✓ Added total_interest column');
    } else {
      console.log('✓ total_interest column already exists');
    }

    // Add total_repayable if it doesn't exist
    if (!existingColumns.includes('total_repayable')) {
      console.log('Adding total_repayable column...');
      await connection.execute(`
        ALTER TABLE loan_applications 
        ADD COLUMN total_repayable DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Total amount to be repaid'
      `);
      console.log('✓ Added total_repayable column');
    } else {
      console.log('✓ total_repayable column already exists');
    }

    // Add disbursed_at if it doesn't exist
    if (!existingColumns.includes('disbursed_at')) {
      console.log('Adding disbursed_at column...');
      await connection.execute(`
        ALTER TABLE loan_applications 
        ADD COLUMN disbursed_at DATETIME NULL COMMENT 'Date when loan was disbursed'
      `);
      console.log('✓ Added disbursed_at column');
    } else {
      console.log('✓ disbursed_at column already exists');
    }

    // Add plan_snapshot if it doesn't exist
    if (!existingColumns.includes('plan_snapshot')) {
      console.log('Adding plan_snapshot column...');
      await connection.execute(`
        ALTER TABLE loan_applications 
        ADD COLUMN plan_snapshot JSON NULL COMMENT 'Snapshot of loan plan details at application time'
      `);
      console.log('✓ Added plan_snapshot column');
    } else {
      console.log('✓ plan_snapshot column already exists');
    }

    console.log('\n✅ All loan calculation columns are ready!');

  } catch (error) {
    console.error('❌ Error adding loan calculation columns:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

// Run the migration
addLoanCalculationColumns()
  .then(() => {
    console.log('\n✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });

