/**
 * Backfill admin repayment transactions into payment_orders / loan_payments
 * and repair emi_schedule for manual EMI entries.
 *
 * Usage (from project root, MySQL/XAMPP running):
 *   node src/server/scripts/backfillAdminRepayments.js
 *   node src/server/scripts/backfillAdminRepayments.js --dry-run
 *   node src/server/scripts/backfillAdminRepayments.js --loan-id=8171
 *   node src/server/scripts/backfillAdminRepayments.js --loan-ids=4769,2739
 *   node src/server/scripts/backfillAdminRepayments.js --loan-ids-file=src/server/scripts/affected-emi-double-mark-loans.txt
 *   node src/server/scripts/backfillAdminRepayments.js --dry-run --loan-ids-file=src/server/scripts/affected-emi-double-mark-loans.txt
 */

const path = require('path');
const fs = require('fs');

// Match src/server/server.js — prefer src/server/.env over project root .env
const loadEnv = () => {
  const possiblePaths = [
    path.join(__dirname, '../.env'),              // src/server
    path.join(__dirname, '../../.env'),           // src/
    path.join(__dirname, '../../../.env'),        // project root
    path.join(process.cwd(), '.env')
  ];

  for (const envPath of possiblePaths) {
    if (fs.existsSync(envPath)) {
      const result = require('dotenv').config({ path: envPath });
      if (!result.error) {
        console.log(`Loading environment from: ${envPath}`);
        return envPath;
      }
    }
  }

  require('dotenv').config();
  return '(default dotenv)';
};

const loadedEnvPath = loadEnv();

const { executeQuery, initializeDatabase } = require('../config/database');
const { backfillAdminRepaymentRecords } = require('../utils/adminRepaymentSync');

function parseLoanIdsFromFile(filePath) {
  const resolved = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Loan IDs file not found: ${resolved}`);
  }
  const raw = fs.readFileSync(resolved, 'utf8');
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => parseInt(s.replace(/^PLL/i, ''), 10))
    .filter((id) => Number.isFinite(id) && id > 0);
}

function parseArgs(argv) {
  let dryRun = false;
  let loanId = null;
  let loanIds = null;

  for (const arg of argv) {
    if (arg === '--dry-run' || arg === '--dry_run') {
      dryRun = true;
    } else if (arg.startsWith('--loan-id=')) {
      loanId = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--loan_id=')) {
      loanId = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--loan-ids=')) {
      loanIds = arg
        .split('=')[1]
        .split(',')
        .map((s) => parseInt(s.trim().replace(/^PLL/i, ''), 10))
        .filter((id) => Number.isFinite(id) && id > 0);
    } else if (arg.startsWith('--loan-ids-file=')) {
      loanIds = parseLoanIdsFromFile(arg.split('=').slice(1).join('='));
    }
  }

  return { dryRun, loanId, loanIds };
}

async function main() {
  const { dryRun, loanId, loanIds } = parseArgs(process.argv.slice(2));

  console.log('Connecting to database...');
  console.log('  Env file:', loadedEnvPath);
  console.log('  Host:', process.env.DB_HOST || 'localhost');
  console.log('  Port:', process.env.DB_PORT || '3306');
  console.log('  Database:', process.env.DB_NAME || 'pocket_credit');
  console.log('  User:', process.env.DB_USER || 'root');
  console.log('  Password set:', process.env.DB_PASSWORD ? 'yes' : 'no');
  console.log('');
  console.log('Mode:', dryRun ? 'DRY RUN (no writes)' : 'LIVE (will update database)');
  if (loanIds && loanIds.length > 0) {
    console.log('Scope:', `${loanIds.length} loan(s):`, loanIds.join(', '));
  } else if (loanId) {
    console.log('Scope:', `loan_id=${loanId}`);
  } else {
    console.log('Scope:', 'ALL loans');
  }
  console.log('Script version: adminRepaymentSync v6 (sequential EMI + spurious revert)');
  console.log('');

  await initializeDatabase();

  const summary = await backfillAdminRepaymentRecords(executeQuery, {
    loanId: loanIds?.length ? null : loanId,
    loanIds: loanIds?.length ? loanIds : null,
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
