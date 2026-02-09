/**
 * Run migrations 002 and 003 (admin leave columns + loan temp assignment columns).
 * Usage: from server folder: node scripts/runMigrations.js
 * Or from project root: node src/server/scripts/runMigrations.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pocket_credit',
  port: process.env.DB_PORT || 3306,
  multipleStatements: true
};

async function run() {
  const conn = await mysql.createConnection(dbConfig);
  const migrationsDir = path.join(__dirname, '../migrations');
  const runOne = async (name) => {
    const file = path.join(migrationsDir, name);
    if (!fs.existsSync(file)) {
      console.log(`⏭️  ${name} not found, skipping`);
      return;
    }
    const sql = fs.readFileSync(file, 'utf8');
    const statements = sql
      .split(';')
      .map(s => s.replace(/--.*$/gm, '').trim())
      .filter(s => s.length > 0);
    for (const stmt of statements) {
      try {
        await conn.query(stmt);
        console.log(`✅ ${name}: ran statement`);
      } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME' || e.code === 'ER_DUP_KEYNAME' || (e.message && (e.message.includes('Duplicate column') || e.message.includes('Duplicate key')))) {
          console.log(`⏭️  ${name}: already applied, skipping`);
        } else {
          console.error(`❌ ${name}:`, e.message);
          throw e;
        }
      }
    }
  };
  try {
    console.log('Running migrations...');
    await runOne('002_admin_temp_inactive_leave.sql');
    await runOne('003_loan_temp_assigned_admin.sql');
    console.log('Done.');
  } finally {
    await conn.end();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
