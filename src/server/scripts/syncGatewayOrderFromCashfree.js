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
const { ensureGatewayPaymentLedgerRecords, extractPaymentReference } = require('../utils/gatewayPaymentProcessing');
const {
  markGatewayEmiPaidInSchedule,
  evaluateLoanClearanceEligibility,
  shouldClearLoanAfterPayment,
  getEmiNumberFromPaymentType,
  resolveClosedAmount
} = require('../utils/loanClearance');

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
    `SELECT po.*, la.application_number, la.status AS loan_status
     FROM payment_orders po
     JOIN loan_applications la ON la.id = po.loan_id
     WHERE po.order_id = ?`,
    [orderId]
  );

  if (!order) {
    console.error(`Order not found in payment_orders: ${orderId}`);
    process.exit(1);
  }

  console.log(`Loan PLL${order.loan_id} (${order.application_number}), DB order status: ${order.status}, loan: ${order.loan_status}`);

  const cashfreeStatus = await cashfreePayment.getOrderStatus(orderId);
  if (!cashfreeStatus.success) {
    console.error('Cashfree API error:', cashfreeStatus.error);
    process.exit(1);
  }

  const data = cashfreeStatus.data || {};
  const cfStatus = cashfreeStatus.orderStatus || data.order_status || data.order?.order_status;
  const payments = data.payments || data.payment || [];
  const paymentData = Array.isArray(payments) && payments.length > 0 ? payments[0] : (payments || data.payment || {});
  const bankReferenceNumber = extractPaymentReference(paymentData) || extractPaymentReference(data);

  console.log(`Cashfree order_status: ${cfStatus}, UTR/ref: ${bankReferenceNumber || '(none)'}`);

  if (cfStatus !== 'PAID') {
    console.log('Order is not PAID in Cashfree — nothing to sync.');
    process.exit(0);
  }

  if (dryRun) {
    console.log('DRY RUN — would set order PAID, create transaction, update EMI schedule / clear loan.');
    process.exit(0);
  }

  await executeQuery(
    `UPDATE payment_orders SET status = 'PAID', webhook_data = ?, updated_at = NOW() WHERE order_id = ?`,
    [JSON.stringify({ synced_from: 'syncGatewayOrderFromCashfree', cashfree: data }), orderId]
  );
  console.log(`Updated payment_orders → PAID`);

  const ledger = await ensureGatewayPaymentLedgerRecords(executeQuery, {
    loanId: order.loan_id,
    userId: order.user_id,
    orderId,
    orderAmount: order.amount,
    bankReferenceNumber,
    paymentType: order.payment_type || 'loan_repayment',
    applicationNumber: order.application_number
  });
  console.log('Ledger:', ledger);

  const paymentType = order.payment_type || 'loan_repayment';
  if (!paymentType.startsWith('emi_') && paymentType !== 'pre-close' && paymentType !== 'full_payment' && paymentType !== 'loan_repayment') {
    console.log('Non-EMI payment type — ledger sync only.');
    return;
  }

  const [loan] = await executeQuery(
    `SELECT id, user_id, emi_schedule, total_repayable, status FROM loan_applications WHERE id = ?`,
    [order.loan_id]
  );

  if (!loan || !['account_manager', 'overdue', 'default', 'delinquent'].includes(loan.status)) {
    console.log(`Loan status '${loan?.status}' — skipping EMI/clearance automation.`);
    return;
  }

  if (paymentType.startsWith('emi_')) {
    const emiNum = getEmiNumberFromPaymentType(paymentType);
    const markResult = markGatewayEmiPaidInSchedule(loan.emi_schedule, emiNum, order.amount);
    if (markResult.updated) {
      await executeQuery(
        `UPDATE loan_applications SET emi_schedule = ? WHERE id = ?`,
        [JSON.stringify(markResult.emiScheduleArray), order.loan_id]
      );
      console.log(`EMI #${emiNum} marked in schedule`);

      if (shouldClearLoanAfterPayment(paymentType, markResult.emiScheduleArray)) {
        const clearance = await evaluateLoanClearanceEligibility({
          executeQuery,
          loan: { ...loan, emi_schedule: markResult.emiScheduleArray },
          emiSchedule: markResult.emiScheduleArray
        });
        if (clearance.shouldClear) {
          const closedAmount = resolveClosedAmount(clearance, loan);
          await executeQuery(
            `UPDATE loan_applications
             SET status = 'cleared', closed_date = CURDATE(), closed_amount = ?, updated_at = NOW()
             WHERE id = ?`,
            [closedAmount, order.loan_id]
          );
          console.log(`Loan PLL${order.loan_id} cleared (closed_amount=${closedAmount})`);
        } else {
          console.log('All EMIs paid on schedule but clearance check did not pass:', clearance.reason);
        }
      }
    }
  } else if (paymentType === 'pre-close' || paymentType === 'full_payment') {
    const closedAmount = parseFloat(loan.total_repayable) || parseFloat(order.amount) || 0;
    await executeQuery(
      `UPDATE loan_applications
       SET status = 'cleared', closed_date = CURDATE(), closed_amount = ?, updated_at = NOW()
       WHERE id = ?`,
      [closedAmount, order.loan_id]
    );
    console.log(`Loan PLL${order.loan_id} cleared (${paymentType})`);
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
