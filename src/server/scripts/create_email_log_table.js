const mysql = require('mysql2/promise');
require('dotenv').config();

async function createEmailLogTable() {
  let connection;
  
  try {
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'pocket_credit'
    });

    console.log('Connected to database');

    // Create kfs_email_log table
    console.log('Creating kfs_email_log table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS kfs_email_log (
        id INT PRIMARY KEY AUTO_INCREMENT,
        loan_id INT NOT NULL,
        recipient_email VARCHAR(255) NOT NULL,
        subject VARCHAR(255),
        status ENUM('pending', 'sent', 'failed', 'bounced') DEFAULT 'pending',
        sent_at TIMESTAMP NULL,
        opened_at TIMESTAMP NULL,
        error_message TEXT,
        pdf_generated_at TIMESTAMP NULL,
        sent_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (loan_id) REFERENCES loan_applications(id) ON DELETE CASCADE,
        INDEX idx_loan_id (loan_id),
        INDEX idx_status (status),
        INDEX idx_sent_at (sent_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ kfs_email_log table created');

    console.log('\n✅ Email log table created successfully!');

  } catch (error) {
    console.error('❌ Error creating email log table:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

// Run the migration
createEmailLogTable()
  .then(() => {
    console.log('\n✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });


