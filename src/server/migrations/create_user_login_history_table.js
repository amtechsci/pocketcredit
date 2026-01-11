const { executeQuery, initializeDatabase } = require('../config/database');

async function createUserLoginHistoryTable() {
  try {
    await initializeDatabase();

    await executeQuery(`
      CREATE TABLE IF NOT EXISTS user_login_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        ip_address VARCHAR(45) NULL COMMENT 'IPv4 or IPv6 address',
        user_agent TEXT NULL COMMENT 'Browser user agent string',
        browser_name VARCHAR(100) NULL COMMENT 'Extracted browser name (Chrome, Firefox, etc.)',
        browser_version VARCHAR(50) NULL COMMENT 'Browser version',
        device_type VARCHAR(50) NULL COMMENT 'mobile, desktop, tablet',
        os_name VARCHAR(100) NULL COMMENT 'Operating system name',
        os_version VARCHAR(50) NULL COMMENT 'Operating system version',
        location_country VARCHAR(100) NULL COMMENT 'Country from IP geolocation',
        location_city VARCHAR(100) NULL COMMENT 'City from IP geolocation',
        location_region VARCHAR(100) NULL COMMENT 'Region/State from IP geolocation',
        latitude DECIMAL(10, 8) NULL COMMENT 'Latitude from IP geolocation',
        longitude DECIMAL(11, 8) NULL COMMENT 'Longitude from IP geolocation',
        login_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        success BOOLEAN DEFAULT TRUE COMMENT 'Whether login was successful',
        failure_reason VARCHAR(255) NULL COMMENT 'Reason if login failed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_login_time (login_time),
        INDEX idx_ip_address (ip_address),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  } catch (error) {
    console.error('❌ Error creating user_login_history table:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  createUserLoginHistoryTable()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { createUserLoginHistoryTable };

