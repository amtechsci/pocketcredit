/**
 * Migration Script: Remove 'disbursed' status from loan_applications table
 * 
 * This script:
 * 1. Checks for existing records with 'disbursed' status
 * 2. Migrates them to 'account_manager' status
 * 3. Removes 'disbursed' from the enum
 */

const mysql = require('mysql2/promise');
const { getPool } = require('../config/database');

async function removeDisbursedStatus() {
  let pool;
  
  try {
    pool = getPool();
    
    console.log('🚀 Starting migration: Remove disbursed status from loan_applications\n');
    
    // Step 1: Check for existing records
    console.log('📋 Checking for existing records with disbursed status...');
    const [disbursedRecords] = await pool.execute(`
      SELECT COUNT(*) as count, id, application_number, status
      FROM loan_applications 
      WHERE status = 'disbursed'
    `);
    
    const count = disbursedRecords[0]?.count || 0;
    console.log(`   Found ${count} records with 'disbursed' status\n`);
    
    // Step 2: Migrate existing records
    if (count > 0) {
      console.log('🔄 Migrating disbursed records to account_manager status...');
      const [updateResult] = await pool.execute(`
        UPDATE loan_applications 
        SET status = 'account_manager', updated_at = NOW()
        WHERE status = 'disbursed'
      `);
      
      console.log(`   ✅ Migrated ${updateResult.affectedRows} records to 'account_manager' status\n`);
    } else {
      console.log('   ✅ No records to migrate\n');
    }
    
    // Step 3: Remove from enum
    console.log('🗑️  Removing disbursed from status enum...');
    await pool.execute(`
      ALTER TABLE loan_applications 
      MODIFY COLUMN status ENUM(
        'submitted', 
        'under_review', 
        'follow_up', 
        'approved', 
        'disbursal', 
        'ready_for_disbursement',
        'account_manager', 
        'cleared', 
        'rejected', 
        'cancelled'
      ) NOT NULL DEFAULT 'submitted'
    `);
    
    console.log('   ✅ Successfully removed disbursed from status enum\n');
    
    // Verify
    console.log('📋 Verifying status enum...');
    const [columns] = await pool.execute(`
      SELECT COLUMN_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'loan_applications'
        AND COLUMN_NAME = 'status'
    `);
    
    console.log(`   ✅ Status enum: ${columns[0]?.COLUMN_TYPE}\n`);
    console.log('✅ Migration completed successfully!\n');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  removeDisbursedStatus()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { removeDisbursedStatus };

