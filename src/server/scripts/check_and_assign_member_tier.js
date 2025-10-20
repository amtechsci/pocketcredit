const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkAndAssignMemberTier() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '13.235.251.238',
    user: process.env.DB_USER || 'pocket',
    password: process.env.DB_PASSWORD || 'Pocket@9988',
    database: process.env.DB_NAME || 'pocket_credit',
    port: process.env.DB_PORT || 3306,
  });

  try {
    console.log('Connected to database\n');

    // Check member tiers in the system
    console.log('=== MEMBER TIERS ===');
    const [tiers] = await connection.execute(
      'SELECT id, tier_name, processing_fee_percent, interest_percent_per_day FROM member_tiers ORDER BY id'
    );
    
    if (tiers.length === 0) {
      console.log('❌ No member tiers found!');
      return;
    }
    
    console.log('Available tiers:');
    tiers.forEach(tier => {
      console.log(`  - ${tier.tier_name} (ID: ${tier.id}): PF=${tier.processing_fee_percent}%, Interest=${tier.interest_percent_per_day}%/day`);
    });
    
    // Get Bronze tier
    const bronzeTier = tiers.find(t => t.tier_name.toLowerCase() === 'bronze');
    if (!bronzeTier) {
      console.log('\n❌ Bronze tier not found!');
      return;
    }
    
    console.log(`\n✓ Bronze tier found: ID=${bronzeTier.id}, PF=${bronzeTier.processing_fee_percent}%`);

    // Check users without tier assignment
    console.log('\n=== USERS WITHOUT TIER ===');
    const [usersWithoutTier] = await connection.execute(
      'SELECT id, first_name, last_name, phone, email, member_tier_id FROM users WHERE member_tier_id IS NULL OR member_tier_id = 0'
    );
    
    if (usersWithoutTier.length === 0) {
      console.log('✓ All users have tiers assigned');
    } else {
      console.log(`Found ${usersWithoutTier.length} users without tier:`);
      usersWithoutTier.forEach(user => {
        console.log(`  - User ${user.id}: ${user.first_name} ${user.last_name} (${user.phone || user.email})`);
      });
      
      // Assign Bronze tier to all users without a tier
      console.log(`\n📌 Assigning Bronze tier (ID: ${bronzeTier.id}) to all users...`);
      await connection.execute(
        'UPDATE users SET member_tier_id = ? WHERE member_tier_id IS NULL OR member_tier_id = 0',
        [bronzeTier.id]
      );
      console.log(`✓ Updated ${usersWithoutTier.length} users with Bronze tier`);
    }

    // Verify user tier assignments
    console.log('\n=== VERIFICATION ===');
    const [allUsers] = await connection.execute(`
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.phone,
        u.member_tier_id,
        mt.tier_name,
        mt.processing_fee_percent,
        mt.interest_percent_per_day
      FROM users u
      LEFT JOIN member_tiers mt ON u.member_tier_id = mt.id
      ORDER BY u.id
      LIMIT 10
    `);
    
    console.log('Sample user tier assignments:');
    allUsers.forEach(user => {
      const tierInfo = user.tier_name 
        ? `${user.tier_name} (PF:${user.processing_fee_percent}%, Int:${user.interest_percent_per_day}%)`
        : '❌ NO TIER';
      console.log(`  - User ${user.id} (${user.first_name}): ${tierInfo}`);
    });

    console.log('\n✅ Done!');
    console.log('\nNow when users calculate loans, they will use:');
    console.log(`  Processing Fee: ${bronzeTier.processing_fee_percent}% (instead of default 3%)`);
    console.log(`  Interest: ${bronzeTier.interest_percent_per_day}% per day`);
    console.log(`\nFor ₹10,000 loan for 15 days:`);
    console.log(`  Processing Fee: ₹${(10000 * bronzeTier.processing_fee_percent / 100).toFixed(2)}`);
    console.log(`  Interest: ₹${(10000 * bronzeTier.interest_percent_per_day * 15 / 100).toFixed(2)}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await connection.end();
  }
}

checkAndAssignMemberTier();

