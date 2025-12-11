const mysql = require('mysql2/promise');

async function addDefaultLoanPlanFeatures() {
  const pool = mysql.createPool({
    host: '13.235.251.238',
    user: 'pocket',
    password: 'Pocket@9988',
    database: 'pocket_credit',
    port: 3306
  });

  try {
    console.log('🚀 Adding default loan plan features...\n');

    // 1. Add is_default column to loan_plans
    console.log('1️⃣ Adding is_default column to loan_plans...');
    const [loanPlansColumns] = await pool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'pocket_credit' 
      AND TABLE_NAME = 'loan_plans' 
      AND COLUMN_NAME = 'is_default'
    `);

    if (loanPlansColumns.length === 0) {
      await pool.query(`
        ALTER TABLE loan_plans 
        ADD COLUMN is_default TINYINT(1) DEFAULT 0 
        COMMENT 'If 1, this plan is the default plan for new users/companies'
        AFTER is_active
      `);
      console.log('✅ Added is_default column to loan_plans\n');
    } else {
      console.log('✅ is_default column already exists\n');
    }

    // 2. Add default_loan_plan_id to companies table
    console.log('2️⃣ Adding default_loan_plan_id to companies...');
    const [companiesColumns] = await pool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'pocket_credit' 
      AND TABLE_NAME = 'companies' 
      AND COLUMN_NAME = 'default_loan_plan_id'
    `);

    if (companiesColumns.length === 0) {
      await pool.query(`
        ALTER TABLE companies 
        ADD COLUMN default_loan_plan_id INT NULL 
        COMMENT 'Default loan plan ID for this company. NULL means use system default.'
        AFTER is_verified,
        ADD FOREIGN KEY (default_loan_plan_id) REFERENCES loan_plans(id) ON DELETE SET NULL
      `);
      console.log('✅ Added default_loan_plan_id to companies\n');
    } else {
      console.log('✅ default_loan_plan_id column already exists\n');
    }

    // 3. Add selected_loan_plan_id to users table (for user profile plan selection)
    console.log('3️⃣ Adding selected_loan_plan_id to users...');
    const [usersColumns] = await pool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'pocket_credit' 
      AND TABLE_NAME = 'users' 
      AND COLUMN_NAME = 'selected_loan_plan_id'
    `);

    if (usersColumns.length === 0) {
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN selected_loan_plan_id INT NULL 
        COMMENT 'User selected loan plan ID. NULL means use company default or system default.'
        AFTER employment_type,
        ADD FOREIGN KEY (selected_loan_plan_id) REFERENCES loan_plans(id) ON DELETE SET NULL
      `);
      console.log('✅ Added selected_loan_plan_id to users\n');
    } else {
      console.log('✅ selected_loan_plan_id column already exists\n');
    }

    // 4. Set first active plan as default if no default exists
    console.log('4️⃣ Setting default plan if none exists...');
    const [defaultPlans] = await pool.query(`
      SELECT id FROM loan_plans WHERE is_default = 1 AND is_active = 1 LIMIT 1
    `);

    if (defaultPlans.length === 0) {
      const [activePlans] = await pool.query(`
        SELECT id FROM loan_plans WHERE is_active = 1 ORDER BY id ASC LIMIT 1
      `);
      
      if (activePlans.length > 0) {
        await pool.query(`
          UPDATE loan_plans SET is_default = 1 WHERE id = ?
        `, [activePlans[0].id]);
        console.log(`✅ Set plan ID ${activePlans[0].id} as default\n`);
      }
    } else {
      console.log('✅ Default plan already exists\n');
    }
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error adding default loan plan features:', error);
    await pool.end();
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  addDefaultLoanPlanFeatures()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = addDefaultLoanPlanFeatures;

