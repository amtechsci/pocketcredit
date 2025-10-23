require('dotenv').config();
const mysql = require('mysql2/promise');

async function createAccountAggregatorTables() {
  let connection;

  try {
    // Database connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || '13.235.251.238',
      user: process.env.DB_USER || 'pocket',
      password: process.env.DB_PASSWORD || 'Pocket@9988',
      database: process.env.DB_NAME || 'pocket_credit',
      port: process.env.DB_PORT || 3306
    });

    console.log('Connected to database');

    // Create account_aggregator_requests table
    console.log('Creating account_aggregator_requests table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS account_aggregator_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        application_id INT NOT NULL,
        transaction_id VARCHAR(100) NOT NULL UNIQUE,
        mobile_number VARCHAR(15) NOT NULL,
        bank_name VARCHAR(100) NOT NULL,
        status ENUM('pending', 'approved', 'failed', 'expired') DEFAULT 'pending',
        consent_id VARCHAR(100) NULL,
        consent_data JSON NULL COMMENT 'Stores consent details (period, frequency, purpose)',
        statement_data JSON NULL COMMENT 'Stores fetched statement data',
        callback_url VARCHAR(512) NULL,
        approved_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (application_id) REFERENCES loan_applications(id) ON DELETE CASCADE,
        INDEX idx_user_app (user_id, application_id),
        INDEX idx_transaction (transaction_id),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ account_aggregator_requests table created');

    // Create bank_statements table
    console.log('Creating bank_statements table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS bank_statements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        application_id INT NOT NULL,
        upload_method ENUM('account_aggregator', 'manual') NOT NULL,
        file_path VARCHAR(512) NULL COMMENT 'S3 URL for manual uploads',
        file_name VARCHAR(255) NULL,
        file_size INT NULL COMMENT 'File size in bytes',
        status ENUM('uploaded', 'processing', 'verified', 'rejected') DEFAULT 'uploaded',
        verified_by INT NULL COMMENT 'Admin user ID who verified',
        verified_at DATETIME NULL,
        rejection_reason TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (application_id) REFERENCES loan_applications(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_app (user_id, application_id),
        INDEX idx_status (status),
        INDEX idx_upload_method (upload_method)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ bank_statements table created');

    console.log('\n✅ All Account Aggregator tables created successfully!');
  } catch (error) {
    console.error('Error creating tables:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

// Run the migration
createAccountAggregatorTables();



