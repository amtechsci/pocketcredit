const mysql = require('mysql2/promise');
require('dotenv').config();

async function createTables() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '13.235.251.238',
    user: process.env.DB_USER || 'pocket',
    password: process.env.DB_PASSWORD || 'Pocket@9988',
    database: process.env.DB_NAME || 'pocket_credit',
    port: process.env.DB_PORT || 3306,
  });

  try {
    console.log('Connected to database\n');

    // Create kyc_verifications table
    console.log('Creating kyc_verifications table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS kyc_verifications (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        application_id INT NOT NULL,
        kyc_status ENUM('pending', 'verified', 'failed', 'skipped') DEFAULT 'pending',
        kyc_method VARCHAR(50) COMMENT 'digilocker, manual, etc.',
        mobile_number VARCHAR(15),
        verified_at TIMESTAMP NULL,
        verification_data JSON COMMENT 'Store API response data',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (application_id) REFERENCES loan_applications(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_application_id (application_id),
        INDEX idx_kyc_status (kyc_status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✓ kyc_verifications table created/verified');

    // Create application_employment_details table
    console.log('\nCreating application_employment_details table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS application_employment_details (
        id INT PRIMARY KEY AUTO_INCREMENT,
        application_id INT NOT NULL,
        user_id INT NOT NULL,
        company_name VARCHAR(255) NOT NULL,
        industry VARCHAR(255) NOT NULL,
        department VARCHAR(255) NOT NULL,
        designation VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (application_id) REFERENCES loan_applications(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_application_id (application_id),
        UNIQUE KEY uk_application (application_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✓ application_employment_details table created/verified');

    // Add industry and department columns to employment_details if they don't exist
    console.log('\nUpdating employment_details table...');
    
    const columns = [
      { name: 'industry', type: 'VARCHAR(255)', after: 'company_name' },
      { name: 'department', type: 'VARCHAR(255)', after: 'industry' }
    ];

    for (const column of columns) {
      try {
        const [rows] = await connection.execute(
          `SELECT COLUMN_NAME 
           FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = ? 
           AND TABLE_NAME = 'employment_details' 
           AND COLUMN_NAME = ?`,
          [process.env.DB_NAME || 'pocket_credit', column.name]
        );

        if (rows.length === 0) {
          await connection.execute(
            `ALTER TABLE employment_details 
             ADD COLUMN ${column.name} ${column.type} AFTER ${column.after}`
          );
          console.log(`✓ Added column: ${column.name} to employment_details`);
        } else {
          console.log(`✓ Column already exists: ${column.name}`);
        }
      } catch (error) {
        console.error(`✗ Error adding column ${column.name}:`, error.message);
      }
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\nTables created/updated:');
    console.log('  1. kyc_verifications - Stores KYC verification status via Digilocker');
    console.log('  2. application_employment_details - Stores detailed employment info per application');
    console.log('  3. employment_details - Updated with industry and department columns');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

createTables();

