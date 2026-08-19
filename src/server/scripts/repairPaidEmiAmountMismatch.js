/**
 * Fix paid EMIs where emi_amount > paid_amount (admin dashboard EMI payment bug).
 *
 *   node server/scripts/repairPaidEmiAmountMismatch.js --dry-run
 *   node server/scripts/repairPaidEmiAmountMismatch.js --loan-ids=8142,8205,8351,8191,8428,8415,6342,8233,8165
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
};

loadEnv();

const { executeQuery, initializeDatabase } = require('../config/database');
const { repairPaidEmiAmountMismatch } = require('../utils/loanClearance');

function parseArgs(argv) {
  let dryRun = false;
  let loanIds = null;
  for (const arg of argv) {
    if (arg === '--dry-run') dryRun = true;
    else if (arg.startsWith('--loan-ids=')) {
      loanIds = arg
        .split('=')[1]
        .split(',')
        .map((s) => parseInt(s.trim().replace(/^PLL/i, ''), 10))
        .filter((id) => Number.isFinite(id) && id > 0);
    } else if (arg.startsWith('--loan-id=')) {
      loanIds = [parseInt(arg.split('=')[1].replace(/^PLL/i, ''), 10)];
    }
  }
  return { dryRun, loanIds };
}

async function main() {
  const { dryRun, loanIds } = parseArgs(process.argv.slice(2));
  console.log('Mode:', dryRun ? 'DRY RUN' : 'LIVE');
  if (loanIds?.length) console.log('Scope:', loanIds.map((id) => `PLL${id}`).join(', '));
  else console.log('Scope: ALL loans with mismatched paid EMIs');

  await initializeDatabase();
  const summary = await repairPaidEmiAmountMismatch(executeQuery, {
    loanIds,
    dryRun
  });
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
