const { getPool } = require('../config/database');
require('dotenv').config();

/**
 * Migration Script: Add profile_completion_step column to users table
 * This script adds the column needed for tracking profile completion progress
 */

const addProfileStepColumn = async () => {
  try {
    const pool = getPool();
    
    // Check if column already exists
    const checkColumnQuery = `
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'users' 
      AND COLUMN_NAME = 'profile_completion_step'
    `;
    
    const [existingColumns] = await pool.execute(checkColumnQuery, [process.env.DB_NAME || 'pocket']);
    
    if (existingColumns.length > 0) {
      console.log('✅ Column profile_completion_step already exists');
      return;
    }
    
    // Add the column
    const alterTableQuery = `
      ALTER TABLE users 
      ADD COLUMN profile_completion_step INT DEFAULT 0 NOT NULL
    `;
    
    await pool.execute(alterTableQuery);
    console.log('✅ Successfully added profile_completion_step column to users table');
    
    // Update existing users to have step 0 (incomplete profile)
    const updateExistingUsersQuery = `
      UPDATE users 
      SET profile_completion_step = 0 
      WHERE profile_completion_step IS NULL
    `;
    
    const [result] = await pool.execute(updateExistingUsersQuery);
    console.log(`✅ Updated ${result.affectedRows} existing users with profile_completion_step = 0`);
    
  } catch (error) {
    console.error('❌ Error adding profile_completion_step column:', error.message);
    throw error;
  }
};

// Run the migration if this file is executed directly
if (require.main === module) {
  addProfileStepColumn()
    .then(() => {
      console.log('🎉 Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error.message);
      process.exit(1);
    });
}

module.exports = addProfileStepColumn;
