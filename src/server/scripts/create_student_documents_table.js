/**
 * Migration Script: Create student_documents table
 * Stores uploaded documents for student verification
 */

require('dotenv').config();

// Set remote database config if not set
if (!process.env.DB_HOST) {
  process.env.DB_HOST = '13.235.251.238';
  process.env.DB_USER = 'pocket';
  process.env.DB_PASSWORD = 'Pocket@9988';
  process.env.DB_NAME = 'pocket_credit';
  process.env.DB_PORT = '3306';
}

const { executeQuery, initializeDatabase } = require('../config/database');

async function createStudentDocumentsTable() {
  try {
    await initializeDatabase();
    console.log('Starting migration: Create student_documents table');

    // Create student_documents table
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS student_documents (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        document_type ENUM('college_id_front', 'college_id_back', 'marks_memo', 'educational_certificate') NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        s3_key VARCHAR(500),
        s3_bucket VARCHAR(255),
        file_size INT,
        mime_type VARCHAR(100),
        upload_status ENUM('pending', 'uploaded', 'verified', 'rejected') DEFAULT 'uploaded',
        verification_notes TEXT,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        verified_at TIMESTAMP NULL,
        verified_by INT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_upload_status (upload_status),
        INDEX idx_document_type (document_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='Stores student documents uploaded for verification'
    `);

    console.log('✅ student_documents table created successfully');

    // Check if college_name and graduation_status columns exist in users table
    const checkColumns = await executeQuery(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users' 
        AND COLUMN_NAME IN ('college_name', 'graduation_status')
    `);

    const existingColumns = checkColumns.map(row => row.COLUMN_NAME);
    console.log('Existing student columns in users table:', existingColumns);

    // Add college_name if it doesn't exist
    if (!existingColumns.includes('college_name')) {
      await executeQuery(`
        ALTER TABLE users 
        ADD COLUMN college_name VARCHAR(255) NULL 
        COMMENT 'College/University name for students'
        AFTER employment_type
      `);
      console.log('✅ Added college_name column to users table');
    } else {
      console.log('✅ college_name column already exists');
    }

    // Add graduation_status if it doesn't exist
    if (!existingColumns.includes('graduation_status')) {
      await executeQuery(`
        ALTER TABLE users 
        ADD COLUMN graduation_status ENUM('not_graduated', 'graduated') DEFAULT 'not_graduated'
        COMMENT 'Graduation status for students'
        AFTER college_name
      `);
      console.log('✅ Added graduation_status column to users table');
    } else {
      console.log('✅ graduation_status column already exists');
    }

    // Add graduation_date if it doesn't exist
    const checkGradDate = await executeQuery(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users' 
        AND COLUMN_NAME = 'graduation_date'
    `);

    if (checkGradDate.length === 0) {
      await executeQuery(`
        ALTER TABLE users 
        ADD COLUMN graduation_date DATE NULL 
        COMMENT 'Date when student marked as graduated'
        AFTER graduation_status
      `);
      console.log('✅ Added graduation_date column to users table');
    } else {
      console.log('✅ graduation_date column already exists');
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\nCreated/Verified:');
    console.log('  - student_documents table');
    console.log('  - users.college_name column');
    console.log('  - users.graduation_status column');
    console.log('  - users.graduation_date column');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

// Run migration
createStudentDocumentsTable();

