const mysql = require('mysql2/promise');
require('dotenv').config();

async function createUANPassbookRequestsTable() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '13.235.251.238',
    user: process.env.DB_USER || 'pocket',
    password: process.env.DB_PASSWORD || 'Pocket@9988',
    database: process.env.DB_NAME || 'pocket_credit',
    port: process.env.DB_PORT || 3306,
  });

  try {
    console.log('Connected to database\n');

    // Create uan_passbook_requests table
    console.log('Creating uan_passbook_requests table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS uan_passbook_requests (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        client_ref_num VARCHAR(100) NOT NULL,
        txn_id VARCHAR(100) NULL COMMENT 'Transaction/Request ID from API response',
        mobile VARCHAR(15) NOT NULL,
        pan VARCHAR(20) NULL COMMENT 'PAN number used in request',
        status ENUM('pending', 'success', 'no_records', 'failed') DEFAULT 'pending',
        result_code INT NULL COMMENT 'API result code: 101=success, 103=no records, etc.',
        request_data JSON COMMENT 'Store full API request data',
        response_data JSON COMMENT 'Store full API response data',
        error_message TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_client_ref_num (client_ref_num),
        INDEX idx_txn_id (txn_id),
        INDEX idx_mobile (mobile),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✓ uan_passbook_requests table created/verified');

    console.log('\n✅ Migration completed successfully!');
    console.log('\nTable structure:');
    console.log('  - id: Primary key');
    console.log('  - user_id: Foreign key to users table');
    console.log('  - client_ref_num: Client reference number for the request');
    console.log('  - txn_id: Transaction ID from API response');
    console.log('  - mobile: Mobile number used for lookup');
    console.log('  - pan: PAN number used in request');
    console.log('  - status: pending, success, no_records, or failed');
    console.log('  - result_code: API result code (101=success, 103=no records)');
    console.log('  - request_data: JSON of full request data');
    console.log('  - response_data: JSON of full API response');
    console.log('  - error_message: Error message if any');
    console.log('  - created_at/updated_at: Timestamps');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

createUANPassbookRequestsTable();
