/**
 * Audit gateway payments missing from transactions / not applied after webhook.
 *
 * Fast DB-only scan:
 *   node src/server/scripts/auditGatewayPaymentGaps.js
 *   node src/server/scripts/auditGatewayPaymentGaps.js --since=2026-06-01
 *
 * Also verify PENDING/EXPIRED orders against Cashfree API (slower):
 *   node src/server/scripts/auditGatewayPaymentGaps.js --verify-cashfree --since=2026-06-01
 *
 * Fix all gaps found (dry-run first):
 *   node src/server/scripts/auditGatewayPaymentGaps.js --verify-cashfree --fix --dry-run
 *   node src/server/scripts/auditGatewayPaymentGaps.js --verify-cashfree --fix
 */

const path = require('path');
const fs = require('fs');

const loadEnv = () => {
  const possiblePaths = [
    path.join(__dirname, '../.env'),
    path.join(__dirname, '../../.env'),
    path.join(__dirname, '../../../.env'),
    path.join(process.cwd(), '.env')
  ];
  for (const envPath of possiblePaths) {
    if (fs.existsSync(envPath)) {
      const result = require('dotenv').config({ path: envPath });
      if (!result.error) return envPath;
    }
  }
  require('dotenv').config();
  return '(default dotenv)';
};

loadEnv();

const { executeQuery, initializeDatabase } = require('../config/database');
const cashfreePayment = require('../services/cashfreePayment');
const {
  findGatewayPaymentGaps,
  findCashfreePaidDbGapOrders,
  repairGatewayLedgerFromPaidOrders,
  syncPaidGatewayOrder
} = require('../utils/gatewayPaymentProcessing');

function parseArgs(argv) {
  let since = null;
  let verifyCashfree = false;
  let fix = false;
  let dryRun = false;

  for (const arg of argv) {
    if (arg === '--verify-cashfree') verifyCashfree = true;
    else if (arg === '--fix') fix = true;
    else if (arg === '--dry-run' || arg === '--dry_run') dryRun = true;
    else if (arg.startsWith('--since=')) since = arg.split('=').slice(1).join('=').trim();
    else if (arg.startsWith('--since-days=')) {
      const days = parseInt(arg.split('=')[1], 10);
      if (Number.isFinite(days) && days > 0) {
        const d = new Date();
        d.setDate(d.getDate() - days);
        since = d.toISOString().slice(0, 10);
      }
    }
  }

  return { since, verifyCashfree, fix, dryRun };
}

function printOrderRows(label, rows) {
  console.log(`\n=== ${label} (${rows.length}) ===`);
  if (rows.length === 0) {
    console.log('  (none)');
    return;
  }
  for (const r of rows) {
    const utr = r.utr ? ` utr=${r.utr}` : '';
    const wh = r.last_webhook_at ? ` webhook=${r.last_webhook_at}` : '';
    console.log(
      `  PLL${r.loan_id} (${r.application_number}) order=${r.order_id} db=${r.order_status} loan=${r.loan_status} ₹${r.amount}${utr}${wh}`
    );
  }
}

async function main() {
  const { since, verifyCashfree, fix, dryRun } = parseArgs(process.argv.slice(2));

  console.log('Gateway payment gap audit');
  console.log('  Since:', since || '(all time)');
  console.log('  Verify Cashfree:', verifyCashfree ? 'yes' : 'no (DB only)');
  console.log('  Fix:', fix ? (dryRun ? 'dry-run' : 'LIVE') : 'no (report only)');
  console.log('');

  await initializeDatabase();

  const gaps = await findGatewayPaymentGaps(executeQuery, { sinceDate: since });

  printOrderRows('A) DB status PAID but no transaction row', gaps.paidMissingTransaction);
  printOrderRows('B) Webhook SUCCESS logged but not fully applied', gaps.webhookSuccessNotApplied);
  printOrderRows(
    'C) PENDING/EXPIRED candidates (need Cashfree verify)',
    gaps.pendingExpiredCandidates.slice(0, 50)
  );
  if (gaps.pendingExpiredCandidates.length > 50) {
    console.log(`  ... and ${gaps.pendingExpiredCandidates.length - 50} more (use --verify-cashfree to check all)`);
  }

  let cashfreeGaps = [];
  if (verifyCashfree) {
    console.log('\nCalling Cashfree API for PENDING/EXPIRED orders (may take a few minutes)...');
    const cf = await findCashfreePaidDbGapOrders(executeQuery, cashfreePayment, {
      sinceDate: since,
      onProgress: ({ checked, total, orderId }) => {
        if (checked % 25 === 0 || checked === total) {
          console.log(`  Cashfree check: ${checked}/${total} — last ${orderId}`);
        }
      }
    });
    cashfreeGaps = cf.cashfreePaidDbGap;
    printOrderRows('D) Cashfree PAID but DB still PENDING/EXPIRED (PLL6604 pattern)', cashfreeGaps);
  }

  const summary = {
    paidMissingTransaction: gaps.paidMissingTransaction.length,
    webhookSuccessNotApplied: gaps.webhookSuccessNotApplied.length,
    pendingExpiredCandidates: gaps.pendingExpiredCandidates.length,
    cashfreePaidDbGap: cashfreeGaps.length
  };
  console.log('\n=== Summary ===');
  console.log(JSON.stringify(summary, null, 2));

  if (!fix) {
    console.log('\nRun with --fix --dry-run after --verify-cashfree to preview repairs.');
    return;
  }

  const orderIdsToSync = new Set();
  for (const r of gaps.webhookSuccessNotApplied) orderIdsToSync.add(r.order_id);
  for (const r of cashfreeGaps) orderIdsToSync.add(r.order_id);

  console.log(`\nFixing ${orderIdsToSync.size} order(s) via Cashfree sync...`);
  const fixResults = { synced: 0, skipped: 0, errors: [] };

  for (const orderId of orderIdsToSync) {
    try {
      const res = await syncPaidGatewayOrder(executeQuery, orderId, { dryRun, cashfreePayment });
      if (res.success) {
        fixResults.synced += 1;
        console.log(`  OK ${orderId} PLL${res.loanId}${res.loanCleared ? ' CLEARED' : ''}`);
      } else {
        fixResults.skipped += 1;
        console.log(`  SKIP ${orderId}: ${res.reason}`);
      }
    } catch (err) {
      fixResults.errors.push({ orderId, message: err.message });
      console.log(`  ERR ${orderId}: ${err.message}`);
    }
  }

  if (gaps.paidMissingTransaction.length > 0) {
    console.log('\nRepairing PAID orders missing transaction rows...');
    const ledgerRepair = await repairGatewayLedgerFromPaidOrders(executeQuery, { dryRun });
    fixResults.ledgerRepair = ledgerRepair;
    console.log(JSON.stringify(ledgerRepair, null, 2));
  }

  console.log('\nFix results:', JSON.stringify(fixResults, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
