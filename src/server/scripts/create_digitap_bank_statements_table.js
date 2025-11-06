const { executeQuery, initializeDatabase } = require('../config/database');

/**
 * Migration Script: Create Digitap Bank Statements Table
 * This table stores bank statement analysis data from Digitap APIs
 */

async function createDigitapBankStatementsTable() {
  try {
    console.log('Starting digitap_bank_statements table creation...');
    
    await initializeDatabase();

    // Create digitap_bank_statements table
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS digitap_bank_statements (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        application_id INT NOT NULL,
        client_ref_num VARCHAR(255) NOT NULL UNIQUE,
        mobile_number VARCHAR(15) NOT NULL,
        bank_name VARCHAR(100) DEFAULT NULL,
        
        -- Upload details
        upload_method ENUM('online', 'manual', 'aa') DEFAULT 'online',
        file_path VARCHAR(500) DEFAULT NULL,
        file_name VARCHAR(255) DEFAULT NULL,
        file_size INT DEFAULT NULL,
        
        -- Digitap tracking
        digitap_url TEXT DEFAULT NULL,
        status ENUM('pending', 'processing', 'completed', 'failed', 'ReportGenerated') DEFAULT 'pending',
        
        -- Report data (JSON)
        report_data LONGTEXT DEFAULT NULL,
        
        -- Timestamps
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        -- Foreign keys
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (application_id) REFERENCES loan_applications(id) ON DELETE CASCADE,
        
        -- Indexes
        INDEX idx_user_id (user_id),
        INDEX idx_application_id (application_id),
        INDEX idx_client_ref_num (client_ref_num),
        INDEX idx_status (status),
        UNIQUE KEY unique_application (application_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='Stores bank statement analysis data from Digitap APIs'
    `);
    
    console.log('✅ digitap_bank_statements table created successfully');
    console.log('\n📊 Table supports:');
    console.log('  - Bank Statement URL generation (online)');
    console.log('  - Direct PDF upload (manual)');
    console.log('  - Account Aggregator (aa)');
    console.log('  - Status tracking');
    console.log('  - Report storage (JSON format)');
    console.log('\n✅ Migration completed successfully!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

createDigitapBankStatementsTable();


