const { executeQuery, initializeDatabase } = require('../config/database');

async function addDigitapTables() {
  try {
    console.log('Starting database migration: Adding Digitap tables and columns...');
    
    await initializeDatabase();

    // Create digitap_responses table
    console.log('Creating digitap_responses table...');
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS digitap_responses (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        mobile_number VARCHAR(20),
        response_data JSON,
        experian_score INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_mobile (mobile_number),
        INDEX idx_score (experian_score)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ digitap_responses table created/verified');

    // Check and add experian_score column to users table
    console.log('Checking if experian_score column exists in users table...');
    const columns = await executeQuery('SHOW COLUMNS FROM users LIKE "experian_score"');
    
    if (!columns || columns.length === 0) {
      console.log('Adding experian_score column to users table...');
      await executeQuery(`
        ALTER TABLE users 
        ADD COLUMN experian_score INT AFTER loan_limit,
        ADD INDEX idx_experian_score (experian_score)
      `);
      console.log('✓ experian_score column added to users table');
    } else {
      console.log('✓ experian_score column already exists in users table');
    }

    console.log('\n✅ Digitap migration completed successfully!');
    console.log('\nChanges made:');
    console.log('1. Created digitap_responses table (if not exists)');
    console.log('2. Added experian_score column to users table (if not exists)');
    console.log('3. Added indexes for performance');
    
    console.log('\n📝 Next steps:');
    console.log('1. Set DIGITAP_API_KEY in your .env file');
    console.log('2. Set DIGITAP_API_URL in your .env file (optional, defaults to test URL)');
    console.log('3. Test the /api/digitap/prefill endpoint');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
addDigitapTables();

