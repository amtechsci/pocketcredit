const mysql = require('mysql2/promise');
require('dotenv').config();

/**
 * Migration script to add profile completion columns to users table
 * This script adds the missing columns for profile completion functionality
 */

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'pocket',
  port: 3306,
};

async function addProfileColumns() {
  let connection;
  
  try {
    console.log('🔌 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    
    console.log('✅ Connected to database successfully');
    
    // Check if columns already exist
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME IN ('profile_completion_step', 'profile_completed', 'address_line1', 'address_line2', 'city', 'state', 'pincode', 'country', 'pan_number')
    `, [dbConfig.database]);
    
    const existingColumns = columns.map(col => col.COLUMN_NAME);
    console.log('📋 Existing profile columns:', existingColumns);
    
    // Add missing columns
    const columnsToAdd = [
      { name: 'profile_completion_step', definition: 'INT DEFAULT 1' },
      { name: 'profile_completed', definition: 'BOOLEAN DEFAULT FALSE' },
      { name: 'address_line1', definition: 'VARCHAR(255) NULL' },
      { name: 'address_line2', definition: 'VARCHAR(255) NULL' },
      { name: 'city', definition: 'VARCHAR(100) NULL' },
      { name: 'state', definition: 'VARCHAR(100) NULL' },
      { name: 'pincode', definition: 'VARCHAR(10) NULL' },
      { name: 'country', definition: "VARCHAR(100) DEFAULT 'India'" },
      { name: 'pan_number', definition: 'VARCHAR(20) NULL' }
    ];
    
    for (const column of columnsToAdd) {
      if (!existingColumns.includes(column.name)) {
        console.log(`➕ Adding column: ${column.name}`);
        await connection.execute(`
          ALTER TABLE users ADD COLUMN ${column.name} ${column.definition}
        `);
        console.log(`✅ Added column: ${column.name}`);
      } else {
        console.log(`⏭️  Column already exists: ${column.name}`);
      }
    }
    
    // Add index for profile_completion_step if it doesn't exist
    const [indexes] = await connection.execute(`
      SELECT INDEX_NAME 
      FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_profile_completion_step'
    `, [dbConfig.database]);
    
    if (indexes.length === 0) {
      console.log('➕ Adding index: idx_profile_completion_step');
      await connection.execute(`
        ALTER TABLE users ADD INDEX idx_profile_completion_step (profile_completion_step)
      `);
      console.log('✅ Added index: idx_profile_completion_step');
    } else {
      console.log('⏭️  Index already exists: idx_profile_completion_step');
    }
    
    // Update existing users to have profile_completion_step = 2 if they have basic info
    console.log('🔄 Updating existing users...');
    const [updateResult] = await connection.execute(`
      UPDATE users 
      SET profile_completion_step = 2 
      WHERE (first_name IS NOT NULL AND first_name != '') 
        AND (last_name IS NOT NULL AND last_name != '') 
        AND (email IS NOT NULL AND email != '')
        AND profile_completion_step = 1
    `);
    
    console.log(`✅ Updated ${updateResult.affectedRows} users to step 2`);
    
    // Set profile_completed = true for users with complete profiles
    const [completeResult] = await connection.execute(`
      UPDATE users 
      SET profile_completed = TRUE 
      WHERE profile_completion_step >= 4
    `);
    
    console.log(`✅ Set ${completeResult.affectedRows} users as profile completed`);
    
    console.log('🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the migration
addProfileColumns();
