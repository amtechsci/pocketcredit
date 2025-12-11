/**
 * Migration: Add 'ready_for_disbursement' status and post-disbursal progress tracking
 * This adds the new status and fields to track user progress through post-disbursal steps
 */

require('dotenv').config();

const { executeQuery, initializeDatabase } = require('../config/database');

async function addPostDisbursalStatusAndProgress() {
  try {
    await initializeDatabase();
    console.log('Starting migration: Add post-disbursal status and progress tracking');

    // 1. Add new status to loan_applications table
    console.log('1. Adding "ready_for_disbursement" status to loan_applications...');
    
    // First, check current enum values
    const currentEnum = await executeQuery(`
      SELECT COLUMN_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'loan_applications' 
        AND COLUMN_NAME = 'status'
    `);
    
    console.log('Current status enum:', currentEnum[0]?.COLUMN_TYPE);

    // Add new status (MySQL doesn't support IF NOT EXISTS for ENUM, so we'll try to modify)
    try {
      await executeQuery(`
        ALTER TABLE loan_applications 
        MODIFY COLUMN status ENUM(
          'submitted', 
          'under_review', 
          'follow_up', 
          'approved', 
          'disbursal', 
          'ready_for_disbursement',
          'disbursed', 
          'account_manager', 
          'cleared', 
          'rejected', 
          'cancelled'
        ) NOT NULL DEFAULT 'submitted'
      `);
      console.log('✅ Added "ready_for_disbursement" status');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME' || error.message.includes('Duplicate')) {
        console.log('ℹ️  Status enum already includes ready_for_disbursement');
      } else {
        throw error;
      }
    }

    // 2. Add post-disbursal progress tracking fields
    console.log('2. Adding post-disbursal progress tracking fields...');
    
    const fieldsToAdd = [
      { name: 'enach_done', type: 'TINYINT(1) DEFAULT 0', comment: 'E-NACH registration completed' },
      { name: 'selfie_captured', type: 'TINYINT(1) DEFAULT 0', comment: 'Selfie image captured' },
      { name: 'selfie_verified', type: 'TINYINT(1) DEFAULT 0', comment: 'Face match verification passed' },
      { name: 'selfie_image_url', type: 'VARCHAR(500) NULL', comment: 'S3 URL of captured selfie' },
      { name: 'references_completed', type: 'TINYINT(1) DEFAULT 0', comment: '3 references and alternate number provided' },
      { name: 'kfs_viewed', type: 'TINYINT(1) DEFAULT 0', comment: 'KFS document viewed' },
      { name: 'agreement_signed', type: 'TINYINT(1) DEFAULT 0', comment: 'Loan agreement e-signed' },
      { name: 'post_disbursal_step', type: 'INT DEFAULT 1', comment: 'Current step in post-disbursal flow (1-7)' },
      { name: 'post_disbursal_progress', type: 'JSON NULL', comment: 'Detailed progress tracking for each step' }
    ];

    for (const field of fieldsToAdd) {
      try {
        // Check if column exists
        const columnExists = await executeQuery(`
          SELECT COLUMN_NAME 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'loan_applications' 
            AND COLUMN_NAME = ?
        `, [field.name]);

        if (columnExists.length === 0) {
          await executeQuery(`
            ALTER TABLE loan_applications
            ADD COLUMN ${field.name} ${field.type} COMMENT '${field.comment}'
          `);
          console.log(`✅ Added column: ${field.name}`);
        } else {
          console.log(`ℹ️  Column ${field.name} already exists`);
        }
      } catch (error) {
        console.error(`❌ Error adding column ${field.name}:`, error.message);
        // Continue with other fields
      }
    }

    console.log('✅ Migration completed successfully');

  } catch (error) {
    console.error('❌ Error in migration:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  addPostDisbursalStatusAndProgress()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { addPostDisbursalStatusAndProgress };




