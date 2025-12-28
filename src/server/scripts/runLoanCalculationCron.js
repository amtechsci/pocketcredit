/**
 * Manual Loan Calculation Cron Runner
 * 
 * Run this script manually to trigger the loan calculation cron job
 * Usage: node src/server/scripts/runLoanCalculationCron.js
 * 
 * IMPORTANT: 
 * 1. Make sure your MySQL server (XAMPP) is running before executing this script!
 * 2. Uses .env configuration with fallback to local XAMPP defaults
 */

const path = require('path');
const fs = require('fs');

// Load .env file from project root or src/server
const envPaths = [
  path.join(__dirname, '../../../.env'),        // Project root
  path.join(__dirname, '../.env'),              // src/server
  path.join(__dirname, '../../.env')            // src
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    console.log(`📄 Loading environment from: ${envPath}`);
    require('dotenv').config({ path: envPath });
    break;
  }
}

const { calculateLoanInterestAndPenalty } = require('../jobs/loanCalculationJob');
const { initializeDatabase } = require('../config/database');

async function initDB() {
  console.log('🔌 Connecting to database...');
  console.log('   Host:', process.env.DB_HOST || 'localhost');
  console.log('   Port:', process.env.DB_PORT || '3306');
  console.log('   Database:', process.env.DB_NAME || 'pocket_credit');
  console.log('   User:', process.env.DB_USER || 'root');
  
  try {
    // Use the database module's initialization (this sets up the pool correctly)
    await initializeDatabase();
    console.log('✅ Database connected successfully\n');
  } catch (error) {
    console.error('\n❌ Failed to connect to database!');
    console.error('Error:', error.message);
    console.error('\nPossible issues:');
    console.error('  1. Database server is not running');
    console.error('  2. Database does not exist');
    console.error('  3. Invalid credentials in .env file');
    console.error('  4. Network/firewall issues');
    throw error;
  }
}

async function runCron() {
  try {
    console.log('🚀 Starting manual loan calculation cron...\n');
    
    // Initialize database
    await initDB();
    
    // Run the cron job
    console.log('📊 Running loan calculation job...\n');
    console.log('═'.repeat(60));
    await calculateLoanInterestAndPenalty();
    console.log('═'.repeat(60));
    
    const logDate = new Date().toISOString().split('T')[0].replace(/-/g, '');
    console.log('\n✅ Loan calculation cron completed successfully!');
    console.log(`📝 Check log file at: src/server/log/cron_${logDate}.log`);
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error running cron:');
    console.error('Message:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

// Run the cron job
runCron();

