require('dotenv').config();
const mysql = require('mysql2/promise');

async function createWebhookLogsTable() {
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

    // Create webhook_logs table
    console.log('Creating webhook_logs table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS webhook_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        webhook_type VARCHAR(50) NOT NULL COMMENT 'Type: bank_data_webhook, txn_completed_cburl, digiwebhook, etc.',
        http_method VARCHAR(10) NOT NULL COMMENT 'GET, POST, PUT, etc.',
        endpoint VARCHAR(255) NOT NULL COMMENT 'Webhook endpoint path',
        headers JSON NULL COMMENT 'Request headers',
        query_params JSON NULL COMMENT 'Query parameters (for GET requests)',
        body_data JSON NULL COMMENT 'Request body (for POST requests)',
        raw_payload LONGTEXT NULL COMMENT 'Complete raw payload as string',
        request_id VARCHAR(255) NULL COMMENT 'Extracted request_id if present',
        client_ref_num VARCHAR(255) NULL COMMENT 'Extracted client_ref_num if present',
        status VARCHAR(50) NULL COMMENT 'Extracted status if present',
        ip_address VARCHAR(45) NULL COMMENT 'Client IP address',
        user_agent VARCHAR(500) NULL COMMENT 'User agent string',
        processed BOOLEAN DEFAULT FALSE COMMENT 'Whether webhook was successfully processed',
        processing_error TEXT NULL COMMENT 'Error message if processing failed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_webhook_type (webhook_type),
        INDEX idx_http_method (http_method),
        INDEX idx_request_id (request_id),
        INDEX idx_client_ref_num (client_ref_num),
        INDEX idx_created_at (created_at),
        INDEX idx_processed (processed)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ webhook_logs table created successfully');

    console.log('\n✅ Webhook logs table created successfully!');
  } catch (error) {
    console.error('Error creating table:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

// Run the migration
createWebhookLogsTable();

