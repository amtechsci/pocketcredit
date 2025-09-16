const mysql = require('mysql2/promise');
require('dotenv').config();

// Database Configuration
const dbConfig = {
  host: process.env.DB_HOST || '13.235.194.211',
  user: process.env.DB_USER || 'pocket',
  password: process.env.DB_PASSWORD || 'Pocket@9988',
  database: process.env.DB_NAME || 'pocket',
  port: process.env.DB_PORT || 3306
};

async function createUserTables() {
  let connection;
  
  try {
    console.log('🔌 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected successfully!');
    
    // Read the user tables schema
    const fs = require('fs');
    const path = require('path');
    
    const schemaPath = path.join(__dirname, '../../../user_tables_clean.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('📋 Creating user tables...');
    
    // Split the schema into individual statements
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    let executedCount = 0;
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await connection.execute(statement);
          executedCount++;
          
          // Log table creation
          if (statement.toUpperCase().includes('CREATE TABLE')) {
            const tableName = statement.match(/CREATE TABLE (\w+)/i)?.[1];
            if (tableName) {
              console.log(`  ✅ Created table: ${tableName}`);
            }
          }
          
          // Log index creation
          if (statement.toUpperCase().includes('CREATE INDEX')) {
            const indexName = statement.match(/CREATE INDEX (\w+)/i)?.[1];
            if (indexName) {
              console.log(`  📊 Created index: ${indexName}`);
            }
          }
          
          // Log sample data insertion
          if (statement.toUpperCase().includes('INSERT INTO')) {
            const tableName = statement.match(/INSERT INTO (\w+)/i)?.[1];
            if (tableName) {
              console.log(`  📝 Inserted sample data into: ${tableName}`);
            }
          }
          
        } catch (error) {
          if (!error.message.includes('already exists')) {
            console.error(`❌ Error executing statement: ${error.message}`);
            console.error(`Statement: ${statement.substring(0, 100)}...`);
          }
        }
      }
    }
    
    console.log(`\n🎉 User tables creation completed!`);
    console.log(`📊 Executed ${executedCount} statements successfully`);
    
    // Verify tables were created
    console.log('\n🔍 Verifying user tables...');
    const [tables] = await connection.execute(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'pocket' 
      AND table_name IN ('users', 'user_addresses', 'user_employment', 'user_bank_accounts', 'user_documents', 'user_kyc_status', 'user_verifications', 'user_sessions')
      ORDER BY table_name
    `);
    
    console.log(`📋 Created ${tables.length} user tables:`);
    tables.forEach(table => {
      console.log(`  - ${table.table_name}`);
    });
    
    // Check sample data
    console.log('\n📊 Checking sample data...');
    const [userCount] = await connection.execute('SELECT COUNT(*) as count FROM users');
    console.log(`👤 Users: ${userCount[0].count} records`);
    
    const [addressCount] = await connection.execute('SELECT COUNT(*) as count FROM user_addresses');
    console.log(`🏠 Addresses: ${addressCount[0].count} records`);
    
    const [employmentCount] = await connection.execute('SELECT COUNT(*) as count FROM user_employment');
    console.log(`💼 Employment: ${employmentCount[0].count} records`);
    
    const [bankCount] = await connection.execute('SELECT COUNT(*) as count FROM user_bank_accounts');
    console.log(`🏦 Bank Accounts: ${bankCount[0].count} records`);
    
    console.log('\n🚀 User tables setup completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Test the user registration API');
    console.log('2. Test the user login API');
    console.log('3. Create loan application tables');
    console.log('4. Implement the automated verification APIs');
    
  } catch (error) {
    console.error('❌ User tables creation failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed.');
    }
  }
}

// Run the creation
createUserTables();
