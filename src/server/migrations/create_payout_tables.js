/**
 * Migration: Create tables for Cashfree Payout API
 * Run with: node src/server/migrations/create_payout_tables.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function createPayoutTables() {
    // Read database config from environment or use defaults
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'pocket_credit',
        port: process.env.DB_PORT || 3306,
        multipleStatements: true
    };

    let connection;
    
    try {
        console.log('🔌 Connecting to database...');
        connection = await mysql.createConnection(config);
        console.log('✅ Connected to database\n');

        // Read SQL file
        const sqlFile = path.join(__dirname, 'create_payout_tables.sql');
        const sql = fs.readFileSync(sqlFile, 'utf8');

        console.log('📝 Executing migration SQL...\n');
        
        // Split SQL by semicolons and execute each statement
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const statement of statements) {
            try {
                await connection.query(statement);
                console.log('✅ Executed:', statement.substring(0, 100) + '...');
            } catch (error) {
                // Ignore "already exists" errors
                if (error.message.includes('already exists') || 
                    error.code === 'ER_DUP_FIELDNAME' ||
                    error.code === 'ER_DUP_KEYNAME') {
                    console.log('ℹ️  Skipped (already exists):', statement.substring(0, 100) + '...');
                } else {
                    throw error;
                }
            }
        }

        console.log('\n✅ Migration completed successfully!');
        console.log('\n📊 Tables created:');
        console.log('   - payout_transactions');
        console.log('   - payout_webhook_events');
        console.log('   - Added payout_transaction_id to transactions table');

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n🔌 Database connection closed');
        }
    }
}

// Run migration
if (require.main === module) {
    createPayoutTables()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = { createPayoutTables };

