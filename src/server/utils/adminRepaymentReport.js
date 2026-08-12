/**
 * Shared helpers for admin repayment visibility in BS / CIBIL reports.
 * Admin ledger rows may exist without payment_orders mirrors — reports must include both.
 */

const {
  isGatewayOriginatedTransaction,
  resolvePaymentTypeForAdminTransaction
} = require('./adminRepaymentSync');

const ADMIN_REPAYMENT_TX_TYPES_SQL = `('emi_payment', 'full_payment', 'settlement', 'part_payment')`;

/** payment_orders.payment_type values used in CIBIL cleared activity */
const ADMIN_REPAYMENT_PAYMENT_TYPES_SQL = `('emi_1st', 'emi_2nd', 'emi_3rd', 'emi_4th', 'loan_repayment', 'full_payment', 'pre-close', 'settlement')`;

const EMI_PAYMENT_TYPE_BY_NUM = { 1: 'emi_1st', 2: 'emi_2nd', 3: 'emi_3rd', 4: 'emi_4th' };

const isAdminOriginatedRepaymentTransaction = (row) => !isGatewayOriginatedTransaction(row);

/** SQL: completed admin repayment transaction (excludes auto gateway ledger rows). */
const sqlAdminRepaymentTxBase = (tAlias = 't') => `
  ${tAlias}.status = 'completed'
  AND ${tAlias}.loan_application_id IS NOT NULL
  AND ${tAlias}.transaction_type IN ${ADMIN_REPAYMENT_TX_TYPES_SQL}
  AND NOT (
    ${tAlias}.description REGEXP 'via[[:space:]]+cashfree'
    OR ${tAlias}.description REGEXP 'Order:[[:space:]]*(LOAN_|RECOV)'
  )`;

/** SQL: admin transaction has no payment_orders row linked via _T{transactionId}. */
const sqlAdminTxNotMirroredInPaymentOrders = (tAlias = 't') => `
  NOT EXISTS (
    SELECT 1 FROM payment_orders po
    WHERE po.loan_id = ${tAlias}.loan_application_id
      AND po.status = 'PAID'
      AND po.order_id REGEXP CONCAT('_T', ${tAlias}.id, '$')
  )`;

/**
 * EXISTS: loan has repayment activity from payment_orders OR admin transactions.
 * @param {string} loanCol - e.g. 'la.id'
 */
const sqlLoanHasRepaymentActivity = (loanCol, { dateFrom = null, dateTo = null } = {}) => {
  let poDate = '';
  let txDate = '';
  if (dateFrom && dateTo) {
    poDate = ' AND DATE(po_d.updated_at) BETWEEN ? AND ?';
    txDate = ' AND DATE(t_d.transaction_date) BETWEEN ? AND ?';
  }
  return {
    sql: `(
      EXISTS (
        SELECT 1 FROM payment_orders po_d
        WHERE po_d.loan_id = ${loanCol}
          AND po_d.status = 'PAID'
          AND po_d.payment_type IN ${ADMIN_REPAYMENT_PAYMENT_TYPES_SQL}
          ${poDate}
      )
      OR EXISTS (
        SELECT 1 FROM transactions t_d
        WHERE t_d.loan_application_id = ${loanCol}
          AND ${sqlAdminRepaymentTxBase('t_d')}
          ${txDate}
      )
    )`,
    extraParams: dateFrom && dateTo ? [dateFrom, dateTo, dateFrom, dateTo] : []
  };
};

/** Unified repayment activity stream (gateway payment_orders + unmirrored admin transactions). */
const sqlCibilCombinedActivityFrom = (loanCol) => `
  SELECT po.updated_at AS activity_at,
         po.payment_type AS activity_type,
         po.id AS sort_id
  FROM payment_orders po
  WHERE po.loan_id = ${loanCol}
    AND po.status = 'PAID'
    AND po.payment_type IN ${ADMIN_REPAYMENT_PAYMENT_TYPES_SQL}
  UNION ALL
  SELECT t.transaction_date AS activity_at,
         CASE
           WHEN t.transaction_type = 'emi_payment' THEN
             ELT(
               LEAST(GREATEST((
                 SELECT COUNT(*)
                 FROM transactions t2
                 WHERE t2.loan_application_id = t.loan_application_id
                   AND t2.transaction_type = 'emi_payment'
                   AND t2.status = 'completed'
                   AND (
                     t2.transaction_date < t.transaction_date
                     OR (t2.transaction_date = t.transaction_date AND t2.id <= t.id)
                   )
               ), 1), 4),
               'emi_1st', 'emi_2nd', 'emi_3rd', 'emi_4th'
             )
           WHEN t.transaction_type = 'full_payment' THEN 'full_payment'
           WHEN t.transaction_type = 'settlement' THEN 'settlement'
           WHEN t.transaction_type = 'part_payment' THEN 'loan_repayment'
           ELSE 'loan_repayment'
         END AS activity_type,
         t.id AS sort_id
  FROM transactions t
  WHERE t.loan_application_id = ${loanCol}
    AND ${sqlAdminRepaymentTxBase('t')}
    AND ${sqlAdminTxNotMirroredInPaymentOrders('t')}`;

const sqlCibilCombinedRepaymentPayAt = (loanCol, offset = 0) => `
  (SELECT activity_at FROM (${sqlCibilCombinedActivityFrom(loanCol)}) combined
   ORDER BY activity_at ASC, sort_id ASC
   LIMIT 1 OFFSET ${parseInt(offset, 10) || 0})`;

const sqlCibilCombinedRepaymentPayType = (loanCol, offset = 0) => `
  (SELECT activity_type FROM (${sqlCibilCombinedActivityFrom(loanCol)}) combined
   ORDER BY activity_at ASC, sort_id ASC
   LIMIT 1 OFFSET ${parseInt(offset, 10) || 0})`;

const sqlCibilFirstRepaymentPayAt = (loanCol) => `
  (SELECT MIN(activity_at) FROM (${sqlCibilCombinedActivityFrom(loanCol)}) combined)`;

const sqlCibilSettlementFromCombined = (loanCol) => `
  COALESCE(
    (SELECT po.amount FROM payment_orders po
     WHERE po.loan_id = ${loanCol} AND po.payment_type = 'settlement' AND po.status = 'PAID'
     ORDER BY po.updated_at DESC LIMIT 1),
    (SELECT t.amount FROM transactions t
     WHERE t.loan_application_id = ${loanCol}
       AND t.transaction_type = 'settlement'
       AND ${sqlAdminRepaymentTxBase('t')}
     ORDER BY t.transaction_date DESC, t.id DESC LIMIT 1)
  )`;

const sqlCibilSettlementDateFromCombined = (loanCol) => `
  COALESCE(
    (SELECT po.updated_at FROM payment_orders po
     WHERE po.loan_id = ${loanCol} AND po.payment_type = 'settlement' AND po.status = 'PAID'
     ORDER BY po.updated_at DESC LIMIT 1),
    (SELECT t.transaction_date FROM transactions t
     WHERE t.loan_application_id = ${loanCol}
       AND t.transaction_type = 'settlement'
       AND ${sqlAdminRepaymentTxBase('t')}
     ORDER BY t.transaction_date DESC, t.id DESC LIMIT 1)
  )`;

/** Dedupe report rows — never collapse rows that only share a UTR/reference. */
const dedupeRepaymentReportRows = (rows) => {
  const byPoOrTx = new Map();
  for (const row of rows || []) {
    const key =
      row.po_id != null
        ? `po:${row.po_id}`
        : row.source_transaction_id != null
          ? `tx:${row.source_transaction_id}`
          : null;
    if (key) {
      if (!byPoOrTx.has(key)) byPoOrTx.set(key, row);
      continue;
    }
    byPoOrTx.set(`fallback:${byPoOrTx.size}`, row);
  }

  const byOrderId = new Map();
  for (const row of byPoOrTx.values()) {
    const oid = String(row.order_id || '').trim();
    if (!oid || oid.startsWith('ADMIN_TX_')) {
      byOrderId.set(`__noid_${byOrderId.size}`, row);
      continue;
    }
    const prev = byOrderId.get(oid);
    if (!prev || (parseInt(row.po_id, 10) || 0) < (parseInt(prev.po_id, 10) || 0)) {
      byOrderId.set(oid, row);
    }
  }
  return [...byOrderId.values()];
};

/**
 * Admin repayment transactions missing a payment_orders mirror (for BS repayment CSV rows).
 */
const fetchOrphanAdminRepaymentTransactions = async (
  executeQuery,
  { from_date, to_date, stateNameSubquery }
) => {
  let sql = `
    SELECT
      u.id AS user_id,
      CONCAT('PC', LPAD(u.id, 5, '0')) AS rcid,
      CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS pan_name,
      ${stateNameSubquery} AS state_name,
      la.id AS lid,
      la.disbursal_amount AS processed_amount,
      la.processing_fee AS p_fee,
      la.total_interest AS service_charge,
      la.processed_penalty AS penality_charge,
      la.processed_due_date,
      la.loan_amount AS principal_amount,
      la.loan_amount AS amount,
      la.processing_fee AS processing_fees,
      la.processing_fee_percent AS pro_fee_per,
      COALESCE(la.interest_percent_per_day * 100, 0) AS interest_percentage,
      t.id AS source_transaction_id,
      NULL AS po_id,
      CONCAT('ADMIN_TX_', t.id) AS order_id,
      CONCAT('ADMIN_TX_', t.id) AS transaction_number,
      t.reference_number AS payment_reference_number,
      t.transaction_date AS transaction_date,
      t.transaction_type AS admin_transaction_type,
      (
        SELECT COUNT(*)
        FROM transactions t2
        WHERE t2.loan_application_id = t.loan_application_id
          AND t2.transaction_type = 'emi_payment'
          AND t2.status = 'completed'
          AND (
            t2.transaction_date < t.transaction_date
            OR (t2.transaction_date = t.transaction_date AND t2.id <= t.id)
          )
      ) AS emi_seq,
      t.amount AS transaction_amount,
      la.processed_at AS loan_start_date,
      la.fees_breakdown AS fees_breakdown,
      la.processed_p_fee AS processed_p_fee,
      la.processed_post_service_fee AS processed_post_service_fee,
      la.processed_gst AS processed_gst,
      la.plan_snapshot AS plan_snapshot,
      la.emi_schedule AS emi_schedule,
      la.interest_percent_per_day AS interest_percent_per_day
    FROM transactions t
    INNER JOIN loan_applications la ON la.id = t.loan_application_id
    INNER JOIN users u ON u.id = la.user_id
    WHERE ${sqlAdminRepaymentTxBase('t')}
      AND ${sqlAdminTxNotMirroredInPaymentOrders('t')}
  `;
  const params = [];
  if (from_date && to_date) {
    sql += ` AND DATE(t.transaction_date) BETWEEN ? AND ?`;
    params.push(from_date, to_date);
  }
  sql += ` ORDER BY t.loan_application_id ASC, t.transaction_date ASC, t.id ASC`;

  const orphans = await executeQuery(sql, params);
  for (const row of orphans) {
    const txType = String(row.admin_transaction_type || '').toLowerCase();
    if (txType === 'emi_payment') {
      const seq = parseInt(row.emi_seq, 10) || 1;
      row.payment_type =
        resolvePaymentTypeForAdminTransaction(txType, seq) ||
        EMI_PAYMENT_TYPE_BY_NUM[seq] ||
        'emi_1st';
    } else if (txType === 'full_payment') {
      row.payment_type = 'full_payment';
    } else if (txType === 'settlement') {
      row.payment_type = 'settlement';
    } else if (txType === 'part_payment') {
      row.payment_type = 'loan_repayment';
    } else {
      row.payment_type = 'loan_repayment';
    }
    delete row.admin_transaction_type;
    delete row.emi_seq;
  }
  return orphans;
};

module.exports = {
  ADMIN_REPAYMENT_TX_TYPES_SQL,
  ADMIN_REPAYMENT_PAYMENT_TYPES_SQL,
  EMI_PAYMENT_TYPE_BY_NUM,
  isAdminOriginatedRepaymentTransaction,
  sqlAdminRepaymentTxBase,
  sqlAdminTxNotMirroredInPaymentOrders,
  sqlLoanHasRepaymentActivity,
  sqlCibilCombinedActivityFrom,
  sqlCibilCombinedRepaymentPayAt,
  sqlCibilCombinedRepaymentPayType,
  sqlCibilFirstRepaymentPayAt,
  sqlCibilSettlementFromCombined,
  sqlCibilSettlementDateFromCombined,
  dedupeRepaymentReportRows,
  fetchOrphanAdminRepaymentTransactions
};
