const mysql = require('mysql2/promise');
require('dotenv').config();

async function addAdditionalDetailsColumns() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '13.235.251.238',
    user: process.env.DB_USER || 'pocket',
    password: process.env.DB_PASSWORD || 'Pocket@9988',
    database: process.env.DB_NAME || 'pocket_credit',
    port: process.env.DB_PORT || 3306,
  });

  try {
    console.log('Connected to database');

    // Add columns to users table
    const columns = [
      { name: 'personal_email', type: 'VARCHAR(255)', after: 'email' },
      { name: 'personal_email_verified', type: 'BOOLEAN', default: 'FALSE', after: 'personal_email' },
      { name: 'official_email', type: 'VARCHAR(255)', after: 'personal_email_verified' },
      { name: 'official_email_verified', type: 'BOOLEAN', default: 'FALSE', after: 'official_email' },
      { name: 'marital_status', type: 'ENUM("single", "married", "divorced", "widow")', after: 'official_email_verified' },
      { name: 'salary_date', type: 'INT', after: 'marital_status' },
    ];

    for (const column of columns) {
      try {
        // Check if column exists
        const [rows] = await connection.execute(
          `SELECT COLUMN_NAME 
           FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = ? 
           AND TABLE_NAME = 'users' 
           AND COLUMN_NAME = ?`,
          [process.env.DB_NAME || 'pocket_credit', column.name]
        );

        if (rows.length === 0) {
          // Column doesn't exist, add it
          let query = `ALTER TABLE users ADD COLUMN ${column.name} ${column.type}`;
          if (column.default) {
            query += ` DEFAULT ${column.default}`;
          }
          if (column.after) {
            query += ` AFTER ${column.after}`;
          }
          
          await connection.execute(query);
          console.log(`✓ Added column: ${column.name}`);
        } else {
          console.log(`✓ Column already exists: ${column.name}`);
        }
      } catch (error) {
        console.error(`✗ Error adding column ${column.name}:`, error.message);
      }
    }

    // Create email_otp_verification table
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS email_otp_verification (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        email VARCHAR(255) NOT NULL,
        otp VARCHAR(6) NOT NULL,
        type ENUM('personal', 'official') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        verified BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_email_type (email, type),
        INDEX idx_user_id (user_id)
      )
    `;

    await connection.execute(createTableQuery);
    console.log('✓ Created/verified email_otp_verification table');

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await connection.end();
  }
}

addAdditionalDetailsColumns();

