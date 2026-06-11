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
       AND (
         reference_number = ?
         OR reference_number = ?
         OR description LIKE CONCAT('%', ?, '%')
       )
     LIMIT 1`,
    [loanId, ref, orderId, orderId]
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
       AND (
         reference_number = ?
         OR reference_number = ?
         OR description LIKE CONCAT('%', ?, '%')
       )
     LIMIT 1`,
    [loanId, ref, orderId, orderId]
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

/**
 * Find gateway payment gaps (DB + optional webhook cross-check).
 */
async function findGatewayPaymentGaps(executeQuery, { sinceDate = null } = {}) {
  const dateFilter = sinceDate ? ' AND po.created_at >= ?' : '';
  const dateParams = sinceDate ? [sinceDate] : [];

  const paidMissingTransaction = await executeQuery(
    `SELECT po.order_id, po.loan_id, la.application_number, la.status AS loan_status,
            po.amount, po.payment_type, po.status AS order_status, po.updated_at
     FROM payment_orders po
     JOIN loan_applications la ON la.id = po.loan_id
     WHERE po.status = 'PAID'
       AND po.order_id NOT LIKE 'ADMIN_%'
       AND (po.recovery_link_id IS NULL OR po.recovery_link_id = 0)
       AND (po.payment_type IS NULL OR po.payment_type != 'extension_fee')
       AND po.loan_id IS NOT NULL
       ${dateFilter}
       AND NOT EXISTS (
         SELECT 1 FROM transactions t
         WHERE t.loan_application_id = po.loan_id
           AND (
             t.reference_number = po.order_id
             OR t.description LIKE CONCAT('%', po.order_id, '%')
           )
       )
     ORDER BY po.updated_at DESC`,
    dateParams
  );

  const webhookSuccessNotApplied = await executeQuery(
    `SELECT po.order_id, po.loan_id, la.application_number, la.status AS loan_status,
            po.amount, po.payment_type, po.status AS order_status,
            MAX(wl.created_at) AS last_webhook_at,
            MAX(wl.id) AS last_webhook_id
     FROM payment_orders po
     JOIN loan_applications la ON la.id = po.loan_id
     JOIN webhook_logs wl ON wl.client_ref_num = po.order_id
       AND wl.webhook_type = 'payment_gateway'
       AND wl.body_data LIKE '%"payment_status"%SUCCESS%'
     WHERE po.order_id NOT LIKE 'ADMIN_%'
       AND (po.recovery_link_id IS NULL OR po.recovery_link_id = 0)
       AND (po.payment_type IS NULL OR po.payment_type != 'extension_fee')
       ${dateFilter}
       AND (
         po.status != 'PAID'
         OR NOT EXISTS (
           SELECT 1 FROM transactions t
           WHERE t.loan_application_id = po.loan_id
             AND (
               t.reference_number = po.order_id
               OR t.description LIKE CONCAT('%', po.order_id, '%')
             )
         )
       )
     GROUP BY po.order_id, po.loan_id, la.application_number, la.status,
              po.amount, po.payment_type, po.status
     ORDER BY last_webhook_at DESC`,
    dateParams
  );

  const pendingExpiredCandidates = await executeQuery(
    `SELECT po.order_id, po.loan_id, la.application_number, la.status AS loan_status,
            po.amount, po.payment_type, po.status AS order_status, po.created_at
     FROM payment_orders po
     JOIN loan_applications la ON la.id = po.loan_id
     WHERE po.status IN ('PENDING', 'EXPIRED')
       AND po.order_id NOT LIKE 'ADMIN_%'
       AND (po.recovery_link_id IS NULL OR po.recovery_link_id = 0)
       AND (po.payment_type IS NULL OR po.payment_type != 'extension_fee')
       AND po.loan_id IS NOT NULL
       ${dateFilter}
     ORDER BY po.created_at DESC`,
    dateParams
  );

  return {
    paidMissingTransaction,
    webhookSuccessNotApplied,
    pendingExpiredCandidates
  };
}

/**
 * Verify specific orders (or all PENDING/EXPIRED) against Cashfree API.
 */
async function findCashfreePaidDbGapOrders(executeQuery, cashfreePayment, {
  sinceDate = null,
  orderRows = null,
  delayMs = 150,
  onProgress = null
} = {}) {
  let candidates = orderRows;
  if (!candidates) {
    const { pendingExpiredCandidates } = await findGatewayPaymentGaps(executeQuery, { sinceDate });
    candidates = pendingExpiredCandidates;
  }

  const gaps = [];
  let checked = 0;

  for (const order of candidates) {
    checked += 1;
    try {
      const cf = await cashfreePayment.getOrderStatus(order.order_id);
      const data = cf.data || {};
      const cfStatus = cf.orderStatus || data.order_status || data.order?.order_status;
      if (cfStatus === 'PAID') {
        const payments = data.payments || data.payment || [];
        const paymentData = Array.isArray(payments) && payments.length > 0
          ? payments[0]
          : (payments || data.payment || {});
        const utr = extractPaymentReference(paymentData) || extractPaymentReference(data);
        gaps.push({ ...order, cashfreeStatus: cfStatus, utr: utr || null });
      }
    } catch (err) {
      gaps.push({ ...order, cashfreeStatus: 'ERROR', error: err.message });
    }

    if (onProgress) {
      onProgress({ checked, total: candidates.length, orderId: order.order_id });
    }
    if (delayMs > 0 && checked < candidates.length) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return { checked: candidates.length, cashfreePaidDbGap: gaps.filter((g) => g.cashfreeStatus === 'PAID') };
}

/**
 * Full sync: Cashfree PAID → payment_orders, transactions, EMI schedule, clearance.
 */
async function syncPaidGatewayOrder(executeQuery, orderId, {
  dryRun = false,
  bankReferenceOverride = null,
  cashfreePayment = null
} = {}) {
  const cf = cashfreePayment || require('../services/cashfreePayment');

  const [order] = await executeQuery(
    `SELECT po.*, la.application_number, la.status AS loan_status
     FROM payment_orders po
     JOIN loan_applications la ON la.id = po.loan_id
     WHERE po.order_id = ?`,
    [orderId]
  );

  if (!order) {
    return { success: false, reason: 'order_not_found', orderId };
  }

  const cashfreeStatus = await cf.getOrderStatus(orderId);
  if (!cashfreeStatus.success) {
    return { success: false, reason: 'cashfree_api_error', orderId, error: cashfreeStatus.error };
  }

  const data = cashfreeStatus.data || {};
  const cfStatus = cashfreeStatus.orderStatus || data.order_status || data.order?.order_status;
  if (cfStatus !== 'PAID') {
    return { success: false, reason: 'not_paid_in_cashfree', orderId, cashfreeStatus: cfStatus };
  }

  const payments = data.payments || data.payment || [];
  const paymentData = Array.isArray(payments) && payments.length > 0
    ? payments[0]
    : (payments || data.payment || {});
  const bankReferenceNumber = bankReferenceOverride
    || extractPaymentReference(paymentData)
    || extractPaymentReference(data)
    || parseBankReferenceFromWebhookData(
      (await executeQuery(
        `SELECT body_data FROM webhook_logs
         WHERE webhook_type = 'payment_gateway' AND client_ref_num = ?
         ORDER BY created_at DESC LIMIT 1`,
        [orderId]
      ))[0]?.body_data
    );

  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      orderId,
      loanId: order.loan_id,
      dbStatus: order.status,
      utr: bankReferenceNumber || null
    };
  }

  await executeQuery(
    `UPDATE payment_orders SET status = 'PAID', webhook_data = ?, updated_at = NOW() WHERE order_id = ?`,
    [JSON.stringify({ synced_from: 'syncPaidGatewayOrder', cashfree: data }), orderId]
  );

  const ledger = await ensureGatewayPaymentLedgerRecords(executeQuery, {
    loanId: order.loan_id,
    userId: order.user_id,
    orderId,
    orderAmount: order.amount,
    bankReferenceNumber,
    paymentType: order.payment_type || 'loan_repayment',
    applicationNumber: order.application_number
  });

  const result = {
    success: true,
    orderId,
    loanId: order.loan_id,
    ledger,
    emiUpdated: false,
    loanCleared: false
  };

  const paymentType = order.payment_type || 'loan_repayment';
  const [loan] = await executeQuery(
    `SELECT id, user_id, emi_schedule, total_repayable, status FROM loan_applications WHERE id = ?`,
    [order.loan_id]
  );

  if (!loan || !['account_manager', 'overdue', 'default', 'delinquent'].includes(loan.status)) {
    return result;
  }

  const {
    markGatewayEmiPaidInSchedule,
    evaluateLoanClearanceEligibility,
    shouldClearLoanAfterPayment,
    getEmiNumberFromPaymentType,
    resolveClosedAmount
  } = require('./loanClearance');

  if (paymentType.startsWith('emi_')) {
    const emiNum = getEmiNumberFromPaymentType(paymentType);
    const markResult = markGatewayEmiPaidInSchedule(loan.emi_schedule, emiNum, order.amount);
    if (markResult.updated) {
      await executeQuery(
        `UPDATE loan_applications SET emi_schedule = ? WHERE id = ?`,
        [JSON.stringify(markResult.emiScheduleArray), order.loan_id]
      );
      result.emiUpdated = true;

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
          result.loanCleared = true;
          result.closedAmount = closedAmount;
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
    result.loanCleared = true;
    result.closedAmount = closedAmount;
  }

  return result;
}

module.exports = {
  ensureGatewayPaymentLedgerRecords,
  repairGatewayLedgerFromPaidOrders,
  findGatewayPaymentGaps,
  findCashfreePaidDbGapOrders,
  syncPaidGatewayOrder,
  extractPaymentReference,
  parseBankReferenceFromWebhookData,
  orderHasGatewayTransaction
};
