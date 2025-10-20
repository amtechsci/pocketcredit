const { executeQuery, initializeDatabase } = require('../config/database');

async function addIncomeRangeColumns() {
  try {
    console.log('Starting database migration: Adding income_range columns...');
    
    await initializeDatabase();

    // Check and add income_range column to users table
    console.log('Checking users table...');
    const usersColumns = await executeQuery('SHOW COLUMNS FROM users LIKE "income_range"');
    
    if (!usersColumns || usersColumns.length === 0) {
      console.log('Adding income_range column to users table...');
      await executeQuery(`
        ALTER TABLE users 
        ADD COLUMN income_range VARCHAR(50) AFTER employment_type
      `);
      console.log('✓ Added income_range column to users table');
    } else {
      console.log('✓ income_range column already exists in users table');
    }

    // Check and add income_range column to employment_details table
    console.log('Checking employment_details table...');
    const empDetailsColumns = await executeQuery('SHOW COLUMNS FROM employment_details LIKE "income_range"');
    
    if (!empDetailsColumns || empDetailsColumns.length === 0) {
      console.log('Adding income_range column to employment_details table...');
      await executeQuery(`
        ALTER TABLE employment_details 
        ADD COLUMN income_range VARCHAR(50) AFTER employment_type
      `);
      console.log('✓ Added income_range column to employment_details table');
    } else {
      console.log('✓ income_range column already exists in employment_details table');
    }

    // Optional: Rename monthly_salary to monthly_salary_old (keep for reference)
    console.log('Checking if monthly_salary needs to be renamed...');
    const monthlySalaryColumn = await executeQuery('SHOW COLUMNS FROM employment_details LIKE "monthly_salary"');
    
    if (monthlySalaryColumn && monthlySalaryColumn.length > 0) {
      console.log('Renaming monthly_salary to monthly_salary_old in employment_details...');
      await executeQuery(`
        ALTER TABLE employment_details 
        CHANGE COLUMN monthly_salary monthly_salary_old DECIMAL(10,2)
      `);
      console.log('✓ Renamed monthly_salary to monthly_salary_old');
    } else {
      console.log('✓ monthly_salary column already renamed or doesn\'t exist');
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\nChanges made:');
    console.log('1. Added income_range column to users table');
    console.log('2. Added income_range column to employment_details table');
    console.log('3. Renamed monthly_salary to monthly_salary_old in employment_details');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
addIncomeRangeColumns();

