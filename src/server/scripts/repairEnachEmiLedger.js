/**
 * Repair eNACH EMI debits logged as part_payment → emi_payment, mark EMI paid, clear loan.
 *
 *   node server/scripts/repairEnachEmiLedger.js --loan-id=6342 --dry-run
 *   node server/scripts/repairEnachEmiLedger.js --loan-id=6342
 *   node server/scripts/repairEnachEmiLedger.js --loan-id=6342 --emi=2 --transaction-id=12345
 */

const path = require('path');
const fs = require('fs');

const loadEnv = () => {
  const possiblePaths = [
    path.join(__dirname, '../.env'),
    path.join(__dirname, '../../.env'),
    path.join(process.cwd(), '.env')
  ];
  for (const envPath of possiblePaths) {
    if (fs.existsSync(envPath)) {
      require('dotenv').config({ path: envPath });
      return envPath;
    }
  }
  require('dotenv').config();
  return '(default)';
};

loadEnv();

const { executeQuery, initializeDatabase } = require('../config/database');
const { repairMisclassifiedEnachEmiLedger } = require('../utils/loanClearance');

function parseArgs(argv) {
  let dryRun = false;
  let loanId = null;
  let transactionId = null;
  let emiNumber = null;
  for (const arg of argv) {
    if (arg === '--dry-run') dryRun = true;
    else if (arg.startsWith('--loan-id=')) loanId = parseInt(arg.split('=')[1].replace(/^PLL/i, ''), 10);
    else if (arg.startsWith('--transaction-id=')) transactionId = parseInt(arg.split('=')[1], 10);
    else if (arg.startsWith('--emi=')) emiNumber = parseInt(arg.split('=')[1], 10);
  }
  return { dryRun, loanId, transactionId, emiNumber };
}

async function main() {
  const { dryRun, loanId, transactionId, emiNumber } = parseArgs(process.argv.slice(2));
  if (!loanId) {
    console.error('Usage: --loan-id=6342 [--emi=2] [--transaction-id=] [--dry-run]');
    process.exit(1);
  }

  console.log('Mode:', dryRun ? 'DRY RUN' : 'LIVE');
  console.log('Loan:', loanId);

  await initializeDatabase();
  const result = await repairMisclassifiedEnachEmiLedger(executeQuery, {
    loanId,
    transactionId,
    emiNumber,
    dryRun
  });

  console.log(JSON.stringify(result, null, 2));
  if (!result.changed && result.reason) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
