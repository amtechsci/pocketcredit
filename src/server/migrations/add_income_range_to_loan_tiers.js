require('dotenv').config();
const { executeQuery, initializeDatabase } = require('../config/database');

async function addIncomeRangeToLoanTiers() {
  try {
    await initializeDatabase();

    console.log('🔄 Adding income_range and hold_permanent columns to loan_limit_tiers table...\n');

    // Add income_range column
    try {
      await executeQuery(`
        ALTER TABLE loan_limit_tiers 
        ADD COLUMN income_range VARCHAR(50) NULL COMMENT 'Income range code (e.g., 1k-20k, 20k-30k)' AFTER loan_limit
      `);
      console.log('✅ Added income_range column');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠️  income_range column already exists');
      } else {
        throw err;
      }
    }

    // Add hold_permanent column
    try {
      await executeQuery(`
        ALTER TABLE loan_limit_tiers 
        ADD COLUMN hold_permanent TINYINT(1) DEFAULT 0 COMMENT 'Whether to hold permanently for this income range' AFTER income_range
      `);
      console.log('✅ Added hold_permanent column');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠️  hold_permanent column already exists');
      } else {
        throw err;
      }
    }

    // Add index on income_range for faster lookups
    try {
      await executeQuery(`
        CREATE UNIQUE INDEX idx_income_range ON loan_limit_tiers(income_range)
      `);
      console.log('✅ Added unique index on income_range');
    } catch (err) {
      if (err.code === 'ER_DUP_KEYNAME') {
        console.log('⚠️  Index on income_range already exists');
      } else {
        throw err;
      }
    }

    console.log('\n✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  addIncomeRangeToLoanTiers()
    .then(() => {
      console.log('Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = addIncomeRangeToLoanTiers;

