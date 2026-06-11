/**
 * Inspect payment_orders / transactions for a loan (gateway payment debugging).
 *
 *   node src/server/scripts/inspectGatewayPaymentOrders.js --loan-id=6604
 *   node src/server/scripts/inspectGatewayPaymentOrders.js --loan-id=PLL6604
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
const {
  parseBankReferenceFromWebhookData,
  orderHasGatewayTransaction
} = require('../utils/gatewayPaymentProcessing');

function parseLoanIdArg(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const n = parseInt(s.replace(/^PLL/i, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function repairEligibilityReason(order) {
  const reasons = [];
  if (order.status !== 'PAID') reasons.push(`status is '${order.status}' (repair only scans PAID)`);
  if (String(order.order_id || '').startsWith('ADMIN_')) reasons.push('ADMIN_ order (excluded)');
  if (order.recovery_link_id) reasons.push(`recovery_link_id=${order.recovery_link_id} (excluded)`);
  if (order.payment_type === 'extension_fee') reasons.push('extension_fee (excluded)');
  if (!order.loan_id) reasons.push('loan_id is null');
  if (reasons.length === 0) reasons.push('eligible for gateway ledger repair scan');
  return reasons.join('; ');
}

async function main() {
  const arg = process.argv.find((a) => a.startsWith('--loan-id=') || a.startsWith('--loan_id='));
  const loanId = parseLoanIdArg(arg ? arg.split('=').slice(1).join('=') : null);
  if (!loanId) {
    console.error('Usage: node inspectGatewayPaymentOrders.js --loan-id=6604');
    process.exit(1);
  }

  await initializeDatabase();

  const [loan] = await executeQuery(
    `SELECT id, application_number, status, user_id, closed_date, closed_amount, updated_at
     FROM loan_applications WHERE id = ?`,
    [loanId]
  );

  if (!loan) {
    console.log(`No loan_applications row with id=${loanId} (PLL${loanId})`);
    process.exit(1);
  }

  console.log('=== Loan ===');
  console.log(JSON.stringify(loan, null, 2));
  console.log('');

  const orders = await executeQuery(
    `SELECT id, order_id, loan_id, user_id, amount, payment_type, status,
            recovery_link_id, extension_id, payment_session_id,
            created_at, updated_at,
            CASE WHEN webhook_data IS NULL THEN NULL ELSE LEFT(webhook_data, 120) END AS webhook_data_preview
     FROM payment_orders
     WHERE loan_id = ?
     ORDER BY created_at DESC`,
    [loanId]
  );

  console.log(`=== payment_orders (${orders.length} row(s) for loan_id=${loanId}) ===`);
  if (orders.length === 0) {
    console.log('  (none — user may have paid but no order row was created, or wrong loan id)');
  }

  for (const order of orders) {
    const fullOrder = await executeQuery(
      'SELECT webhook_data FROM payment_orders WHERE id = ?',
      [order.id]
    );
    const utr = parseBankReferenceFromWebhookData(fullOrder[0]?.webhook_data);
    const hasTx = await orderHasGatewayTransaction(
      executeQuery,
      loanId,
      order.order_id,
      utr
    );

    console.log('');
    console.log(`  order_id:     ${order.order_id}`);
    console.log(`  status:       ${order.status}`);
    console.log(`  amount:       ${order.amount}`);
    console.log(`  payment_type: ${order.payment_type}`);
    console.log(`  created:      ${order.created_at}`);
    console.log(`  updated:      ${order.updated_at}`);
    console.log(`  utr/ref:      ${utr || '(none in webhook_data)'}`);
    console.log(`  has_tx:       ${hasTx ? 'yes' : 'NO — missing transactions row'}`);
    console.log(`  repair scan:  ${repairEligibilityReason(order)}`);
  }

  const txs = await executeQuery(
    `SELECT id, transaction_type, amount, reference_number, payment_method, status,
            LEFT(description, 100) AS description, transaction_date, created_at
     FROM transactions
     WHERE loan_application_id = ?
     ORDER BY created_at DESC`,
    [loanId]
  );

  console.log('');
  console.log(`=== transactions (${txs.length} row(s)) ===`);
  for (const tx of txs) {
    console.log(
      `  #${tx.id} ${tx.transaction_type} ₹${tx.amount} ref=${tx.reference_number || '-'} ${tx.status} ${tx.created_at}`
    );
  }

  const lps = await executeQuery(
    `SELECT id, amount, payment_method, transaction_id, status, payment_date
     FROM loan_payments WHERE loan_id = ? ORDER BY payment_date DESC`,
    [loanId]
  );

  console.log('');
  console.log(`=== loan_payments (${lps.length} row(s)) ===`);
  for (const lp of lps) {
    console.log(
      `  #${lp.id} ${lp.payment_method} ₹${lp.amount} txn_id=${lp.transaction_id} ${lp.status} ${lp.payment_date}`
    );
  }

  const paidCount = orders.filter((o) => o.status === 'PAID').length;
  const pendingCount = orders.filter((o) => o.status === 'PENDING').length;
  console.log('');
  console.log('=== Summary ===');
  console.log(`  payment_orders: ${orders.length} total, ${paidCount} PAID, ${pendingCount} PENDING`);
  console.log(
    `  repair --repair-gateway-ledger-only scans only PAID non-extension non-recovery orders — got scanned: ${orders.filter((o) => o.status === 'PAID' && o.payment_type !== 'extension_fee' && !o.recovery_link_id && !String(o.order_id).startsWith('ADMIN_')).length}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
