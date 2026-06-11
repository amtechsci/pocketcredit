/**
 * Audit gateway payments missing from transactions / not applied after webhook.
 *
 * Fast DB-only scan (start here):
 *   node src/server/scripts/auditGatewayPaymentGaps.js --since=2026-06-01
 *
 * Verify high-signal gaps only (list A + B — fast, ~few API calls):
 *   node src/server/scripts/auditGatewayPaymentGaps.js --since=2026-06-01 --verify-cashfree
 *
 * Verify ALL pending/expired orders (slow — hundreds of API calls):
 *   node src/server/scripts/auditGatewayPaymentGaps.js --since=2026-06-01 --verify-cashfree --verify-all-pending
 *
 * Fix (dry-run first):
 *   node src/server/scripts/auditGatewayPaymentGaps.js --since=2026-06-01 --verify-cashfree --fix --dry-run
 *   node src/server/scripts/auditGatewayPaymentGaps.js --since=2026-06-01 --verify-cashfree --fix
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
  let verifyAllPending = false;
  let fix = false;
  let dryRun = false;

  for (const arg of argv) {
    if (arg === '--verify-cashfree') verifyCashfree = true;
    else if (arg === '--verify-all-pending') verifyAllPending = true;
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

  return { since, verifyCashfree, verifyAllPending, fix, dryRun };
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

function dedupeOrdersByOrderId(rows) {
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.order_id)) map.set(r.order_id, r);
  }
  return [...map.values()];
}

async function main() {
  const { since, verifyCashfree, verifyAllPending, fix, dryRun } = parseArgs(process.argv.slice(2));

  console.log('Gateway payment gap audit');
  console.log('  Since:', since || '(all time)');
  console.log('  Verify Cashfree:', verifyCashfree ? (verifyAllPending ? 'all pending/expired' : 'high-signal only (A+B)') : 'no (DB only)');
  console.log('  Fix:', fix ? (dryRun ? 'dry-run' : 'LIVE') : 'no (report only)');
  console.log('');

  await initializeDatabase();

  const gaps = await findGatewayPaymentGaps(executeQuery, { sinceDate: since });

  printOrderRows('A) DB status PAID but no transaction row', gaps.paidMissingTransaction);
  printOrderRows('B) Webhook SUCCESS logged but not fully applied', gaps.webhookSuccessNotApplied);
  printOrderRows(
    'C) PENDING/EXPIRED checkout sessions (mostly unpaid — not all are bugs)',
    gaps.pendingExpiredCandidates.slice(0, 20)
  );
  if (gaps.pendingExpiredCandidates.length > 20) {
    console.log(`  ... ${gaps.pendingExpiredCandidates.length} total abandoned/retry sessions since filter date`);
    console.log('  (Only list B + Cashfree PAID matter for missing payments; ignore most of C)');
  }

  let cashfreeGaps = [];
  if (verifyCashfree) {
    const highSignal = dedupeOrdersByOrderId([
      ...gaps.webhookSuccessNotApplied,
      ...gaps.paidMissingTransaction.filter((r) => r.order_status !== 'PAID')
    ]);
    const toVerify = verifyAllPending ? gaps.pendingExpiredCandidates : highSignal;

    console.log(`\nCalling Cashfree API for ${toVerify.length} order(s)...`);
    const cf = await findCashfreePaidDbGapOrders(executeQuery, cashfreePayment, {
      orderRows: toVerify,
      onProgress: ({ checked, total, orderId }) => {
        if (checked === total || checked % 10 === 0) {
          console.log(`  Cashfree check: ${checked}/${total} — last ${orderId}`);
        }
      }
    });
    cashfreeGaps = cf.cashfreePaidDbGap;
    printOrderRows('D) Cashfree PAID but DB not fully applied (fix these)', cashfreeGaps);
  }

  const summary = {
    paidMissingTransaction: gaps.paidMissingTransaction.length,
    webhookSuccessNotApplied: gaps.webhookSuccessNotApplied.length,
    pendingExpiredCheckoutSessions: gaps.pendingExpiredCandidates.length,
    cashfreePaidDbGap: cashfreeGaps.length
  };
  console.log('\n=== Summary ===');
  console.log(JSON.stringify(summary, null, 2));

  if (!fix) {
    console.log('\nNext: fix high-signal gaps with --verify-cashfree --fix --dry-run');
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
