const mysql = require('mysql2/promise');
require('dotenv').config();

// Remote Database Configuration
const dbConfig = {
  host: '13.235.194.211',
  user: 'pocket',
  password: 'Pocket@9988',
  database: 'pocket',
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

async function setupRemoteDatabase() {
  let connection;
  
  try {
    console.log('🔌 Connecting to remote database...');
    console.log(`📍 Host: ${dbConfig.host}`);
    console.log(`🗄️  Database: ${dbConfig.database}`);
    
    // Create connection
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to remote database successfully!');
    
    // Read and execute the schema
    const fs = require('fs');
    const path = require('path');
    
    const schemaPath = path.join(__dirname, '../../../database_schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('📋 Executing database schema...');
    
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
          
          // Log settings insertion
          if (statement.toUpperCase().includes('INSERT INTO system_settings')) {
            console.log(`  ⚙️  Inserted system settings`);
          }
          
        } catch (error) {
          if (!error.message.includes('already exists')) {
            console.error(`❌ Error executing statement: ${error.message}`);
            console.error(`Statement: ${statement.substring(0, 100)}...`);
          }
        }
      }
    }
    
    console.log(`\n🎉 Database setup completed!`);
    console.log(`📊 Executed ${executedCount} statements successfully`);
    
    // Verify tables were created
    console.log('\n🔍 Verifying tables...');
    const [tables] = await connection.execute('SHOW TABLES');
    
    console.log(`📋 Found ${tables.length} tables:`);
    tables.forEach(table => {
      console.log(`  - ${Object.values(table)[0]}`);
    });
    
    // Check system settings
    console.log('\n⚙️  Checking system settings...');
    const [settings] = await connection.execute('SELECT COUNT(*) as count FROM system_settings');
    console.log(`📊 System settings: ${settings[0].count} records`);
    
    // Create sample admin user
    console.log('\n👤 Creating sample admin user...');
    const bcrypt = require('bcrypt');
    const adminPassword = await bcrypt.hash('admin123', 10);
    
    await connection.execute(`
      INSERT IGNORE INTO admin_users 
      (username, email, password_hash, first_name, last_name, role, status) 
      VALUES 
      ('admin', 'admin@pocketcredit.com', ?, 'System', 'Administrator', 'super_admin', 'active')
    `, [adminPassword]);
    
    console.log('✅ Sample admin user created (username: admin, password: admin123)');
    
    console.log('\n🚀 Remote database setup completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Update your backend configuration to use the remote database');
    console.log('2. Test the API endpoints');
    console.log('3. Start implementing the automated features');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed.');
    }
  }
}

// Run the setup
setupRemoteDatabase();
