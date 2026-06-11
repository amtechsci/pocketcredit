/**
 * Sync a Cashfree payment order from API when webhook failed (admin/server-side).
 *
 *   node src/server/scripts/syncGatewayOrderFromCashfree.js --order-id=LOAN_PC18279076873_emi_2nd_1781085463000
 *   node src/server/scripts/syncGatewayOrderFromCashfree.js --order-id=... --dry-run
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
const { syncPaidGatewayOrder } = require('../utils/gatewayPaymentProcessing');

function parseArgs(argv) {
  let orderId = null;
  let dryRun = false;
  for (const arg of argv) {
    if (arg === '--dry-run' || arg === '--dry_run') dryRun = true;
    else if (arg.startsWith('--order-id=')) orderId = arg.split('=').slice(1).join('=').trim();
    else if (arg.startsWith('--order_id=')) orderId = arg.split('=').slice(1).join('=').trim();
  }
  return { orderId, dryRun };
}

async function main() {
  const { orderId, dryRun } = parseArgs(process.argv.slice(2));
  if (!orderId) {
    console.error('Usage: node syncGatewayOrderFromCashfree.js --order-id=LOAN_... [--dry-run]');
    process.exit(1);
  }

  await initializeDatabase();

  const [order] = await executeQuery(
    `SELECT po.loan_id, la.application_number, po.status
     FROM payment_orders po
     JOIN loan_applications la ON la.id = po.loan_id
     WHERE po.order_id = ?`,
    [orderId]
  );

  if (!order) {
    console.error(`Order not found in payment_orders: ${orderId}`);
    process.exit(1);
  }

  console.log(`Loan PLL${order.loan_id} (${order.application_number}), DB order status: ${order.status}`);

  const result = await syncPaidGatewayOrder(executeQuery, orderId, { dryRun, cashfreePayment });

  if (!result.success) {
    console.error('Sync failed:', result.reason, result.error || '');
    process.exit(result.reason === 'not_paid_in_cashfree' ? 0 : 1);
  }

  console.log(JSON.stringify(result, null, 2));
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
