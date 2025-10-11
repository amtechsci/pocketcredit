const mysql = require('mysql2/promise');

async function createLoanPlansSystem() {
  const pool = mysql.createPool({
    host: '13.235.251.238',
    user: 'pocket',
    password: 'Pocket@9988',
    database: 'pocket_credit',
    port: 3306
  });

  try {
    console.log('🚀 Creating Loan Plans System...\n');

    // 1. Create loan_plans table
    console.log('1️⃣ Creating loan_plans table...');
    const createLoanPlansTable = `
      CREATE TABLE IF NOT EXISTS loan_plans (
        id INT AUTO_INCREMENT PRIMARY KEY,
        plan_name VARCHAR(100) NOT NULL,
        plan_code VARCHAR(50) UNIQUE NOT NULL,
        plan_type ENUM('single', 'multi_emi') NOT NULL DEFAULT 'single',
        
        -- For Single Payment Plans
        repayment_days INT NULL COMMENT 'Total days to repay for single payment plans',
        
        -- For Multi-EMI Plans
        emi_frequency ENUM('daily', 'weekly', 'biweekly', 'monthly') NULL,
        emi_count INT NULL COMMENT 'Number of EMIs',
        total_duration_days INT NULL COMMENT 'Auto-calculated: total plan duration',
        
        -- Eligibility
        min_credit_score INT NULL DEFAULT 0,
        eligible_member_tiers TEXT NULL COMMENT 'JSON array of eligible tier names',
        eligible_employment_types TEXT NULL COMMENT 'JSON array of eligible employment types',
        
        -- Settings
        is_active TINYINT(1) DEFAULT 1,
        plan_order INT NOT NULL DEFAULT 1,
        description TEXT NULL,
        terms_conditions TEXT NULL,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_active (is_active),
        INDEX idx_type (plan_type),
        INDEX idx_order (plan_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.query(createLoanPlansTable);
    console.log('✅ loan_plans table created\n');

    // 2. Create late_fee_tiers table
    console.log('2️⃣ Creating late_fee_tiers table...');
    const createLateFeeTiersTable = `
      CREATE TABLE IF NOT EXISTS late_fee_tiers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        member_tier_id INT NOT NULL,
        tier_name VARCHAR(100) NOT NULL COMMENT 'Descriptive name for this late fee tier',
        days_overdue_start INT NOT NULL,
        days_overdue_end INT NULL COMMENT 'NULL means no upper limit',
        fee_type ENUM('percentage', 'fixed') NOT NULL DEFAULT 'percentage',
        fee_value DECIMAL(10,2) NOT NULL,
        tier_order INT NOT NULL DEFAULT 1,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (member_tier_id) REFERENCES member_tiers(id) ON DELETE CASCADE,
        INDEX idx_member_tier (member_tier_id),
        INDEX idx_days (days_overdue_start, days_overdue_end)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.query(createLateFeeTiersTable);
    console.log('✅ late_fee_tiers table created\n');

    // 3. Enhance member_tiers table
    console.log('3️⃣ Enhancing member_tiers table...');
    try {
      await pool.query('ALTER TABLE member_tiers ADD COLUMN tier_description TEXT NULL');
      console.log('   ✓ Added tier_description column');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('   ⚠ tier_description already exists');
      } else throw err;
    }
    
    try {
      await pool.query('ALTER TABLE member_tiers ADD COLUMN is_active TINYINT(1) DEFAULT 1');
      console.log('   ✓ Added is_active column');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('   ⚠ is_active already exists');
      } else throw err;
    }
    console.log('✅ member_tiers table enhanced\n');

    // 4. Insert default loan plans
    console.log('4️⃣ Inserting default loan plans...');
    const insertDefaultPlans = `
      INSERT INTO loan_plans 
        (plan_name, plan_code, plan_type, repayment_days, emi_frequency, emi_count, total_duration_days, 
         min_credit_score, eligible_employment_types, is_active, plan_order, description)
      VALUES
        ('15-Day Quick Loan', 'QUICK_15D', 'single', 15, NULL, NULL, 15, 
         0, '["salaried", "student"]', 1, 1, 'Fast cash for emergencies - repay in 15 days'),
        
        ('30-Day Monthly Loan', 'MONTHLY_30D', 'single', 30, NULL, NULL, 30, 
         0, '["salaried", "student"]', 1, 2, 'One-month bullet repayment plan'),
        
        ('3-Month Easy EMI', 'EMI_3M', 'multi_emi', NULL, 'monthly', 3, 90, 
         0, '["salaried", "student"]', 1, 3, 'Pay in 3 equal monthly installments'),
        
        ('6-Month Standard EMI', 'EMI_6M', 'multi_emi', NULL, 'monthly', 6, 180, 
         600, '["salaried"]', 1, 4, 'Standard 6-month EMI plan for salaried employees'),
        
        ('12-Month Premium EMI', 'EMI_12M', 'multi_emi', NULL, 'monthly', 12, 360, 
         650, '["salaried"]', 1, 5, 'Premium long-term plan with lower EMIs')
      ON DUPLICATE KEY UPDATE plan_name = VALUES(plan_name)
    `;
    await pool.query(insertDefaultPlans);
    console.log('✅ Default loan plans inserted\n');

    // 5. Insert default late fee tiers
    console.log('5️⃣ Inserting default late fee tiers...');
    
    // First, get member tiers
    const [memberTiers] = await pool.query('SELECT id, tier_name FROM member_tiers');
    
    if (memberTiers.length > 0) {
      for (const tier of memberTiers) {
        console.log(`   Creating late fees for ${tier.tier_name} tier...`);
        
        // Check if late fees already exist for this tier
        const [existing] = await pool.query(
          'SELECT COUNT(*) as count FROM late_fee_tiers WHERE member_tier_id = ?',
          [tier.id]
        );
        
        if (existing[0].count === 0) {
          // Insert late fee structure based on tier
          let lateFees = [];
          
          if (tier.tier_name.toLowerCase() === 'bronze') {
            lateFees = [
              { name: 'Day 1 Penalty', start: 1, end: 1, percent: 3 },
              { name: 'Days 2-20', start: 2, end: 20, percent: 2 },
              { name: 'Days 21-40', start: 21, end: 40, percent: 1.5 },
              { name: 'Days 41+', start: 41, end: null, percent: 1 }
            ];
          } else if (tier.tier_name.toLowerCase() === 'silver') {
            lateFees = [
              { name: 'Day 1 Penalty', start: 1, end: 1, percent: 2.5 },
              { name: 'Days 2-20', start: 2, end: 20, percent: 1.5 },
              { name: 'Days 21+', start: 21, end: null, percent: 1 }
            ];
          } else if (tier.tier_name.toLowerCase() === 'gold') {
            lateFees = [
              { name: 'Day 1 Penalty', start: 1, end: 1, percent: 2 },
              { name: 'Days 2-15', start: 2, end: 15, percent: 1 },
              { name: 'Days 16+', start: 16, end: null, percent: 0.5 }
            ];
          } else {
            // Default structure
            lateFees = [
              { name: 'Day 1 Penalty', start: 1, end: 1, percent: 3 },
              { name: 'Days 2-20', start: 2, end: 20, percent: 2 },
              { name: 'Days 21+', start: 21, end: null, percent: 1 }
            ];
          }
          
          for (let i = 0; i < lateFees.length; i++) {
            const fee = lateFees[i];
            await pool.query(
              `INSERT INTO late_fee_tiers 
                (member_tier_id, tier_name, days_overdue_start, days_overdue_end, fee_type, fee_value, tier_order)
              VALUES (?, ?, ?, ?, 'percentage', ?, ?)`,
              [tier.id, fee.name, fee.start, fee.end, fee.percent, i + 1]
            );
          }
          console.log(`   ✓ ${lateFees.length} late fee tiers created`);
        } else {
          console.log(`   ⚠ Late fees already exist (skipping)`);
        }
      }
      console.log('✅ Default late fee tiers inserted\n');
    } else {
      console.log('⚠ No member tiers found. Create member tiers first.\n');
    }

    // 6. Verify data
    console.log('6️⃣ Verifying data...\n');
    
    const [plans] = await pool.query('SELECT * FROM loan_plans ORDER BY plan_order');
    console.log('📋 Loan Plans Created:');
    console.log('═══════════════════════════════════════════════════════════');
    plans.forEach(p => {
      const type = p.plan_type === 'single' ? `${p.repayment_days} days` : `${p.emi_count} × ${p.emi_frequency}`;
      console.log(`${p.plan_order}. ${p.plan_name.padEnd(25)} | ${type.padEnd(15)} | ${p.is_active ? '✅ Active' : '❌ Inactive'}`);
    });
    console.log('═══════════════════════════════════════════════════════════\n');

    const [lateFeeCount] = await pool.query('SELECT COUNT(*) as count FROM late_fee_tiers');
    console.log(`💰 Late Fee Tiers Created: ${lateFeeCount[0].count} tiers\n`);

    console.log('✅ Loan Plans System created successfully!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await pool.end();
    process.exit();
  }
}

createLoanPlansSystem();

