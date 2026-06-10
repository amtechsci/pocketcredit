/**
 * Backfill admin repayment transactions into payment_orders / loan_payments
 * and repair emi_schedule for manual EMI entries.
 *
 * Usage (from project root, MySQL/XAMPP running):
 *   node src/server/scripts/backfillAdminRepayments.js
 *   node src/server/scripts/backfillAdminRepayments.js --dry-run
 *   node src/server/scripts/backfillAdminRepayments.js --loan-id=8171
 *   node src/server/scripts/backfillAdminRepayments.js --dry-run --loan-id=8171
 */

const path = require('path');
const fs = require('fs');

const envPaths = [
  path.join(__dirname, '../../../.env'),
  path.join(__dirname, '../.env'),
  path.join(__dirname, '../../.env')
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    console.log(`Loading environment from: ${envPath}`);
    require('dotenv').config({ path: envPath });
    break;
  }
}

const { executeQuery, initializeDatabase } = require('../config/database');
const { backfillAdminRepaymentRecords } = require('../utils/adminRepaymentSync');

function parseArgs(argv) {
  let dryRun = false;
  let loanId = null;

  for (const arg of argv) {
    if (arg === '--dry-run' || arg === '--dry_run') {
      dryRun = true;
    } else if (arg.startsWith('--loan-id=')) {
      loanId = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--loan_id=')) {
      loanId = parseInt(arg.split('=')[1], 10);
    }
  }

  return { dryRun, loanId };
}

async function main() {
  const { dryRun, loanId } = parseArgs(process.argv.slice(2));

  console.log('Connecting to database...');
  console.log('  Host:', process.env.DB_HOST || 'localhost');
  console.log('  Port:', process.env.DB_PORT || '3306');
  console.log('  Database:', process.env.DB_NAME || 'pocket_credit');
  console.log('  User:', process.env.DB_USER || 'root');
  console.log('');
  console.log('Mode:', dryRun ? 'DRY RUN (no writes)' : 'LIVE (will update database)');
  console.log('Scope:', loanId ? `loan_id=${loanId}` : 'ALL loans');
  console.log('');

  await initializeDatabase();

  const summary = await backfillAdminRepaymentRecords(executeQuery, {
    loanId,
    dryRun
  });

  console.log('Backfill summary:');
  console.log(JSON.stringify(summary, null, 2));

  if (summary.errors?.length) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Backfill failed:', err.message);
  process.exit(1);
});
