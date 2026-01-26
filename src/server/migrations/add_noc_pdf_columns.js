/**
 * Migration: Add NOC PDF columns to loan_applications table
 * Adds noc_pdf_url and noc_pdf_generated_at columns
 */

const { initializeDatabase, executeQuery } = require('../config/database');

async function addNOCPDFColumns() {
  try {
    console.log('🔄 Starting migration: Add NOC PDF columns...');
    await initializeDatabase();

    // Check if columns already exist
    const checkColumns = await executeQuery(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'loan_applications' 
      AND COLUMN_NAME IN ('noc_pdf_url', 'noc_pdf_generated_at')
    `);

    const existingColumns = checkColumns.map(row => row.COLUMN_NAME);

    // Add noc_pdf_url column if it doesn't exist
    if (!existingColumns.includes('noc_pdf_url')) {
      console.log('📝 Adding noc_pdf_url column...');
      await executeQuery(`
        ALTER TABLE loan_applications
        ADD COLUMN noc_pdf_url VARCHAR(500) NULL COMMENT 'S3 key/URL of No Dues Certificate PDF'
      `);
      console.log('✅ Added noc_pdf_url column');
    } else {
      console.log('ℹ️  noc_pdf_url column already exists');
    }

    // Add noc_pdf_generated_at column if it doesn't exist
    if (!existingColumns.includes('noc_pdf_generated_at')) {
      console.log('📝 Adding noc_pdf_generated_at column...');
      await executeQuery(`
        ALTER TABLE loan_applications
        ADD COLUMN noc_pdf_generated_at DATETIME NULL COMMENT 'Timestamp when NOC PDF was generated'
      `);
      console.log('✅ Added noc_pdf_generated_at column');
    } else {
      console.log('ℹ️  noc_pdf_generated_at column already exists');
    }

    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if called directly
if (require.main === module) {
  addNOCPDFColumns();
}

module.exports = { addNOCPDFColumns };
