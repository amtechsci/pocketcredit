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

async function updateMemberTiers() {
  let connection;
  
  try {
    console.log('🔌 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected successfully!');
    
    // Read the member tiers update schema
    const fs = require('fs');
    const path = require('path');
    
    const schemaPath = path.join(__dirname, '../../../member_tiers_clean.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('📋 Updating member tiers structure...');
    
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
          
          // Log column addition
          if (statement.toUpperCase().includes('ADD COLUMN')) {
            const match = statement.match(/ADD COLUMN (\w+)/i);
            if (match) {
              console.log(`  ➕ Added column: ${match[1]}`);
            }
          }
          
          // Log foreign key addition
          if (statement.toUpperCase().includes('ADD FOREIGN KEY')) {
            console.log(`  🔗 Added foreign key constraint`);
          }
          
          // Log data insertion
          if (statement.toUpperCase().includes('INSERT INTO')) {
            const tableName = statement.match(/INSERT INTO (\w+)/i)?.[1];
            if (tableName) {
              console.log(`  📝 Inserted data into: ${tableName}`);
            }
          }
          
          // Log data update
          if (statement.toUpperCase().includes('UPDATE')) {
            const tableName = statement.match(/UPDATE (\w+)/i)?.[1];
            if (tableName) {
              console.log(`  🔄 Updated data in: ${tableName}`);
            }
          }
          
          // Log column drop
          if (statement.toUpperCase().includes('DROP COLUMN')) {
            const match = statement.match(/DROP COLUMN (\w+)/i);
            if (match) {
              console.log(`  ❌ Dropped column: ${match[1]}`);
            }
          }
          
          // Log index operations
          if (statement.toUpperCase().includes('DROP INDEX')) {
            const match = statement.match(/DROP INDEX (\w+)/i);
            if (match) {
              console.log(`  📊 Dropped index: ${match[1]}`);
            }
          }
          
          if (statement.toUpperCase().includes('CREATE INDEX')) {
            const match = statement.match(/CREATE INDEX (\w+)/i);
            if (match) {
              console.log(`  📊 Created index: ${match[1]}`);
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
    
    console.log(`\n🎉 Member tiers update completed!`);
    console.log(`📊 Executed ${executedCount} statements successfully`);
    
    // Verify the changes
    console.log('\n🔍 Verifying changes...');
    
    // Check member_tiers table
    const [memberTiers] = await connection.execute('SELECT COUNT(*) as count FROM member_tiers');
    console.log(`👥 Member Tiers: ${memberTiers[0].count} records`);
    
    // Check users table structure
    const [userColumns] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'pocket' AND TABLE_NAME = 'users' 
      AND COLUMN_NAME IN ('member_id', 'member_tier')
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log(`📋 Users table columns:`);
    userColumns.forEach(col => {
      console.log(`  - ${col.COLUMN_NAME}: ${col.DATA_TYPE} (${col.IS_NULLABLE === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // Check member tier data
    const [tiers] = await connection.execute(`
      SELECT mt.id, mt.name, mt.display_name, mt.processing_fee_rate, mt.interest_rate_per_day, 
             COUNT(u.id) as user_count
      FROM member_tiers mt
      LEFT JOIN users u ON mt.id = u.member_id
      GROUP BY mt.id, mt.name, mt.display_name, mt.processing_fee_rate, mt.interest_rate_per_day
      ORDER BY mt.priority_level
    `);
    
    console.log(`\n📊 Member Tiers Summary:`);
    tiers.forEach(tier => {
      console.log(`  ${tier.id}. ${tier.display_name} (${tier.name})`);
      console.log(`     - Processing Fee: ${tier.processing_fee_rate}%`);
      console.log(`     - Interest Rate: ${tier.interest_rate_per_day}% per day`);
      console.log(`     - Users: ${tier.user_count}`);
    });
    
    console.log('\n🚀 Member tiers structure updated successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Update frontend to use member_id instead of member_tier');
    console.log('2. Create admin APIs to manage member tiers');
    console.log('3. Update user APIs to handle member tier assignments');
    console.log('4. Create loan application tables');
    
  } catch (error) {
    console.error('❌ Member tiers update failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed.');
    }
  }
}

// Run the update
updateMemberTiers();
