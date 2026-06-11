/**
 * Idempotent ledger rows for successful Cashfree loan repayments.
 * Webhook and order-status must both call this so payments are never "paid but not recorded".
 */

const { getSystemAdminId } = require('./loanClearance');

function extractPaymentReference(payment) {
  if (!payment || typeof payment !== 'object') return null;
  const utr =
    payment.bank_reference ||
    payment.payment_utr ||
    payment.utr ||
    payment.bank_reference_number ||
    payment.reference_number ||
    null;
  if (utr && String(utr).trim()) return String(utr).trim();
  const msg = payment.payment_message;
  if (msg && String(msg).trim() && !String(msg).includes('::')) return String(msg).trim();
  return null;
}

function parseBankReferenceFromWebhookData(webhookData) {
  if (!webhookData) return null;
  try {
    const payload = typeof webhookData === 'string' ? JSON.parse(webhookData) : webhookData;
    return extractPaymentReference(payload?.data?.payment);
  } catch {
    return null;
  }
}

async function ensureGatewayPaymentLedgerRecords(executeQuery, {
  loanId,
  userId,
  orderId,
  orderAmount,
  bankReferenceNumber,
  paymentType,
  applicationNumber
}) {
  const amount = parseFloat(orderAmount) || 0;
  const ref = String(bankReferenceNumber || orderId || '').trim();
  const result = { loanPaymentCreated: false, transactionCreated: false, reference: ref };

  if (!loanId || !orderId || amount <= 0) {
    return { ...result, skipped: true, reason: 'invalid_params' };
  }

  const existingLp = await executeQuery(
    `SELECT id FROM loan_payments WHERE transaction_id = ? AND loan_id = ? LIMIT 1`,
    [orderId, loanId]
  );

  if (existingLp.length === 0) {
    try {
      await executeQuery(
        `INSERT INTO loan_payments (
           loan_id, amount, payment_method, transaction_id, status, payment_date
         ) VALUES (?, ?, 'CASHFREE', ?, 'SUCCESS', NOW())`,
        [loanId, amount, orderId]
      );
      result.loanPaymentCreated = true;
    } catch (err) {
      console.warn(`[gatewayPayment] loan_payments insert skipped order ${orderId}: ${err.message}`);
    }
  }

  const existingTx = await executeQuery(
    `SELECT id FROM transactions
     WHERE loan_application_id = ?
       AND (reference_number = ? OR reference_number = ?)
     LIMIT 1`,
    [loanId, ref, orderId]
  );

  if (existingTx.length > 0) {
    return result;
  }

  const systemAdminId = await getSystemAdminId(executeQuery);
  if (!systemAdminId) {
    console.warn('[gatewayPayment] No system admin — cannot create transactions row for order', orderId);
    return result;
  }

  let transactionType = 'emi_payment';
  if (paymentType === 'pre-close' || paymentType === 'full_payment') {
    transactionType = 'credit';
  }

  const appLabel = applicationNumber || loanId;
  const description =
    paymentType === 'pre-close' || paymentType === 'full_payment'
      ? `Full Payment via Cashfree - Order: ${orderId}, App: ${appLabel}`
      : `${String(paymentType || 'loan_repayment').replace('_', ' ').toUpperCase()} via Cashfree - Order: ${orderId}, App: ${appLabel}`;

  try {
    await executeQuery(
      `INSERT INTO transactions (
         user_id, loan_application_id, transaction_type, amount, description,
         category, payment_method, reference_number, transaction_date,
         status, priority, created_by, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, 'loan', 'other', ?, CURDATE(), 'completed', 'high', ?, NOW(), NOW())`,
      [
        userId,
        loanId,
        transactionType,
        amount,
        description,
        ref,
        systemAdminId
      ]
    );
    result.transactionCreated = true;
  } catch (err) {
    console.warn(`[gatewayPayment] transactions insert failed order ${orderId}: ${err.message}`);
  }

  return result;
}

async function orderHasGatewayTransaction(executeQuery, loanId, orderId, bankReferenceNumber) {
  const ref = String(bankReferenceNumber || orderId || '').trim();
  const rows = await executeQuery(
    `SELECT id FROM transactions
     WHERE loan_application_id = ?
       AND (reference_number = ? OR reference_number = ?)
     LIMIT 1`,
    [loanId, ref, orderId]
  );
  return rows.length > 0;
}

/**
 * Backfill missing loan_payments / transactions for PAID Cashfree orders (global repair).
 */
async function repairGatewayLedgerFromPaidOrders(executeQuery, {
  loanId = null,
  loanIds = null,
  dryRun = false,
  onProgress = null
} = {}) {
  const summary = {
    scanned: 0,
    missingLedger: 0,
    loanPaymentsCreated: 0,
    transactionsCreated: 0,
    skipped: 0,
    errors: []
  };

  let loanFilterSql = '';
  const params = [];
  if (loanIds?.length) {
    loanFilterSql = ` AND po.loan_id IN (${loanIds.map(() => '?').join(',')})`;
    params.push(...loanIds);
  } else if (loanId) {
    loanFilterSql = ' AND po.loan_id = ?';
    params.push(loanId);
  }

  const orders = await executeQuery(
    `SELECT
       po.order_id,
       po.loan_id,
       po.user_id,
       po.amount,
       po.payment_type,
       po.webhook_data,
       la.application_number
     FROM payment_orders po
     LEFT JOIN loan_applications la ON la.id = po.loan_id
     WHERE po.status = 'PAID'
       AND po.order_id NOT LIKE 'ADMIN_%'
       AND (po.recovery_link_id IS NULL OR po.recovery_link_id = 0)
       AND (po.payment_type IS NULL OR po.payment_type != 'extension_fee')
       AND po.loan_id IS NOT NULL
       ${loanFilterSql}
     ORDER BY po.loan_id, po.updated_at`,
    params
  );

  summary.scanned = orders.length;

  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];
    const bankReferenceNumber = parseBankReferenceFromWebhookData(order.webhook_data);
    const hasTx = await orderHasGatewayTransaction(
      executeQuery,
      order.loan_id,
      order.order_id,
      bankReferenceNumber
    );

    if (hasTx) {
      summary.skipped++;
      if (onProgress) {
        onProgress({
          processed: i + 1,
          total: orders.length,
          loanId: order.loan_id,
          orderId: order.order_id,
          action: 'skipped'
        });
      }
      continue;
    }

    summary.missingLedger++;

    if (dryRun) {
      if (onProgress) {
        onProgress({
          processed: i + 1,
          total: orders.length,
          loanId: order.loan_id,
          orderId: order.order_id,
          action: 'would_repair'
        });
      }
      continue;
    }

    try {
      const result = await ensureGatewayPaymentLedgerRecords(executeQuery, {
        loanId: order.loan_id,
        userId: order.user_id,
        orderId: order.order_id,
        orderAmount: order.amount,
        bankReferenceNumber,
        paymentType: order.payment_type || 'loan_repayment',
        applicationNumber: order.application_number
      });
      if (result.loanPaymentCreated) summary.loanPaymentsCreated++;
      if (result.transactionCreated) summary.transactionsCreated++;
      if (onProgress) {
        onProgress({
          processed: i + 1,
          total: orders.length,
          loanId: order.loan_id,
          orderId: order.order_id,
          action: 'repaired',
          result
        });
      }
    } catch (err) {
      summary.errors.push({
        loanId: order.loan_id,
        orderId: order.order_id,
        message: err.message
      });
    }
  }

  return summary;
}

module.exports = {
  ensureGatewayPaymentLedgerRecords,
  repairGatewayLedgerFromPaidOrders,
  extractPaymentReference,
  parseBankReferenceFromWebhookData
};
