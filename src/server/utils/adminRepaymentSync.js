/**
 * Keep admin-recorded repayments in sync with payment_orders / loan_payments
 * so BS Repayment reports and EMI schedules stay consistent with manual entries.
 */

const { parseEmiSchedule } = require('./loanClearance');

const ADMIN_REPAYMENT_TX_TYPES = new Set([
  'emi_payment',
  'full_payment',
  'settlement',
  'part_payment'
]);

const EMI_PAYMENT_TYPE_SUFFIX = {
  1: 'emi_1st',
  2: 'emi_2nd',
  3: 'emi_3rd',
  4: 'emi_4th'
};

/**
 * Normalize any transaction_date value to YYYY-MM-DD.
 * Never use String(date).split(' ')[0] — locale strings start with "Wed", "Mon", etc.
 */
function normalizeDateOnly(raw) {
  const today = () => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  };

  if (raw == null || raw === '') return today();

  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return today();
    return `${raw.getFullYear()}-${String(raw.getMonth() + 1).padStart(2, '0')}-${String(raw.getDate()).padStart(2, '0')}`;
  }

  const s = String(raw).trim();

  const lead = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (lead) return lead[1];

  if (s.includes('T')) {
    const part = s.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(part)) return part;
  }

  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
  }

  return today();
}

function toMysqlDatetime(dateOnly) {
  const d = normalizeDateOnly(dateOnly);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    throw new Error(`Invalid date "${d}" from input ${JSON.stringify(dateOnly)}`);
  }
  return `${d} 12:00:00`;
}

function getFirstUnpaidEmiNumber(emiScheduleRaw) {
  const schedule = parseEmiSchedule(emiScheduleRaw);
  if (!schedule || schedule.length === 0) return 1;
  const idx = schedule.findIndex(
    (emi) => String(emi?.status || '').toLowerCase() !== 'paid'
  );
  return idx === -1 ? null : idx + 1;
}

function resolvePaymentTypeForAdminTransaction(txType, emiNumber) {
  const type = String(txType || '').toLowerCase();
  if (type === 'emi_payment') {
    return EMI_PAYMENT_TYPE_SUFFIX[emiNumber] || `emi_${emiNumber}${emiNumber === 1 ? 'st' : emiNumber === 2 ? 'nd' : emiNumber === 3 ? 'rd' : 'th'}`;
  }
  if (type === 'full_payment') return 'full_payment';
  if (type === 'settlement') return 'settlement';
  if (type === 'part_payment') return 'loan_repayment';
  return null;
}

/**
 * Admin manual EMI payment is authoritative — always mark the target EMI paid.
 */
function markAdminEmiPaidInSchedule(emiScheduleRaw, emiNumber, paymentAmount, paidDate) {
  const schedule = parseEmiSchedule(emiScheduleRaw);
  if (!schedule || emiNumber == null || emiNumber < 1 || schedule.length < emiNumber) {
    return { updated: false, emiScheduleArray: schedule, emiNumber: null, emiFullyPaid: false };
  }

  const idx = emiNumber - 1;
  const emi = schedule[idx] || {};
  const date = normalizeDateOnly(paidDate);
  const paid = parseFloat(paymentAmount) || 0;

  let baseInstalment = emi.instalment_amount;
  if (baseInstalment == null || baseInstalment === '') {
    baseInstalment = parseFloat(emi.emi_amount || 0) || paid;
  }

  schedule[idx] = {
    ...emi,
    status: 'paid',
    paid_date: date,
    paid_amount: paid,
    instalment_amount: parseFloat(baseInstalment) || paid
  };

  return {
    updated: true,
    emiScheduleArray: schedule,
    emiNumber,
    emiFullyPaid: true
  };
}

function emiNumberFromPaymentTypeString(paymentType) {
  const pt = String(paymentType || '').toLowerCase();
  if (pt === 'emi_1st') return 1;
  if (pt === 'emi_2nd') return 2;
  if (pt === 'emi_3rd') return 3;
  if (pt === 'emi_4th') return 4;
  return null;
}

async function findPaymentOrderByType(executeQuery, loanId, paymentType) {
  const rows = await executeQuery(
    `SELECT id, order_id, status, amount, payment_type
     FROM payment_orders
     WHERE loan_id = ? AND payment_type = ?
     ORDER BY id DESC
     LIMIT 1`,
    [loanId, paymentType]
  );
  return rows[0] || null;
}

async function findPaymentOrderByTransactionId(executeQuery, loanId, transactionId) {
  const rows = await executeQuery(
    `SELECT id, order_id, status, amount, payment_type
     FROM payment_orders
     WHERE loan_id = ? AND order_id LIKE ?
     ORDER BY id DESC
     LIMIT 1`,
    [loanId, `%_T${transactionId}`]
  );
  return rows[0] || null;
}

async function upsertAdminPaymentOrder(executeQuery, {
  loanId,
  userId,
  applicationNumber,
  paymentType,
  amount,
  transactionId,
  transactionDate
}) {
  const ts = toMysqlDatetime(transactionDate);
  const orderId = `ADMIN_${applicationNumber || loanId}_${paymentType}_T${transactionId}`;

  const existing =
    (transactionId != null
      ? await findPaymentOrderByTransactionId(executeQuery, loanId, transactionId)
      : null) ||
    (await findPaymentOrderByType(executeQuery, loanId, paymentType));

  if (existing) {
    await executeQuery(
      `UPDATE payment_orders
       SET order_id = ?, status = 'PAID', amount = ?, updated_at = ?
       WHERE id = ?`,
      [orderId, amount, ts, existing.id]
    );
  } else {
    await executeQuery(
      `INSERT INTO payment_orders (
         order_id, loan_id, user_id, amount, payment_type, status, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, 'PAID', ?, ?)`,
      [orderId, loanId, userId, amount, paymentType, ts, ts]
    );
  }

  return orderId;
}

let loanPaymentsAvailable = null;

async function isLoanPaymentsTableAvailable(executeQuery) {
  if (loanPaymentsAvailable !== null) return loanPaymentsAvailable;
  try {
    const rows = await executeQuery(`
      SELECT 1
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loan_payments'
      LIMIT 1
    `);
    loanPaymentsAvailable = rows.length > 0;
  } catch {
    loanPaymentsAvailable = false;
  }
  return loanPaymentsAvailable;
}

/**
 * Optional mirror row for clearance totals. BS Repayment report reads payment_orders.
 * Uses CASHFREE in payment_method when present (matches gateway enum on this DB).
 */
async function upsertAdminLoanPayment(executeQuery, {
  loanId,
  amount,
  orderId,
  transactionDate
}) {
  if (!(await isLoanPaymentsTableAvailable(executeQuery))) {
    return { skipped: true, reason: 'no_loan_payments_table' };
  }

  const ts = toMysqlDatetime(transactionDate);

  try {
    const existing = await executeQuery(
      `SELECT id FROM loan_payments WHERE loan_id = ? AND transaction_id = ?`,
      [loanId, orderId]
    );

    if (existing.length > 0) {
      await executeQuery(
        `UPDATE loan_payments
         SET amount = ?, payment_method = 'CASHFREE', status = 'SUCCESS', payment_date = ?
         WHERE id = ?`,
        [amount, ts, existing[0].id]
      );
    } else {
      await executeQuery(
        `INSERT INTO loan_payments (
           loan_id, amount, payment_method, transaction_id, status, payment_date
         ) VALUES (?, ?, 'CASHFREE', ?, 'SUCCESS', ?)`,
        [loanId, amount, orderId, ts]
      );
    }
    return { skipped: false };
  } catch (err) {
    console.warn(`[adminRepaymentSync] loan_payments skipped for ${orderId}: ${err.message}`);
    return { skipped: true, reason: err.message };
  }
}

async function linkTransactionToPaymentOrder(executeQuery, transactionId, orderId) {
  await executeQuery(
    `UPDATE transactions
     SET description = CASE
       WHEN description IS NULL OR description = '' THEN ?
       WHEN description LIKE ? THEN description
       ELSE CONCAT(description, ' | Order: ', ?)
     END
     WHERE id = ?`,
    [`Admin repayment — Order: ${orderId}`, `%Order: ${orderId}%`, orderId, transactionId]
  );
}

/**
 * Sync one admin repayment transaction into payment_orders, loan_payments, and (for EMI) emi_schedule.
 */
async function syncAdminRepaymentTransaction(executeQuery, {
  transaction,
  loan,
  dryRun = false,
  emiNumber: emiNumberOverride = null,
  skipEmiScheduleUpdate = false
}) {
  const txType = String(transaction.transaction_type || '').toLowerCase();
  if (!ADMIN_REPAYMENT_TX_TYPES.has(txType)) {
    return { changed: false, skipped: true, reason: 'not_repayment_type' };
  }

  const loanId = parseInt(transaction.loan_application_id || loan?.id, 10);
  const userId = parseInt(transaction.user_id || loan?.user_id, 10);
  const amount = parseFloat(transaction.amount) || 0;
  const txDate = normalizeDateOnly(transaction.transaction_date);
  const applicationNumber = loan?.application_number || loanId;

  if (!loanId || !userId || amount <= 0) {
    return { changed: false, skipped: true, reason: 'invalid_loan_or_amount' };
  }

  let emiScheduleArray = parseEmiSchedule(loan?.emi_schedule);
  let emiNumber = null;
  let emiScheduleUpdated = false;

  const existingOrderForTx = !dryRun && transaction.id
    ? await findPaymentOrderByTransactionId(executeQuery, loanId, transaction.id)
    : null;

  if (txType === 'emi_payment') {
    emiNumber = emiNumberOverride;

    if (emiNumber == null && existingOrderForTx?.payment_type) {
      emiNumber = emiNumberFromPaymentTypeString(existingOrderForTx.payment_type);
    }

    if (emiNumber == null) {
      emiNumber = getFirstUnpaidEmiNumber(emiScheduleArray);
    }

    if (emiNumber == null) {
      const suffixMatch = String(transaction.description || '').match(/emi_(\d+(?:st|nd|rd|th))/i);
      if (suffixMatch) {
        const n = parseInt(suffixMatch[1], 10);
        if (n >= 1 && n <= 4) emiNumber = n;
      }
    }

    if (emiNumber == null) emiNumber = 1;

    if (existingOrderForTx) {
      skipEmiScheduleUpdate = true;
    }

    if (!skipEmiScheduleUpdate) {
      const markResult = markAdminEmiPaidInSchedule(
        emiScheduleArray,
        emiNumber,
        amount,
        txDate
      );
      emiScheduleArray = markResult.emiScheduleArray;
      emiScheduleUpdated = markResult.updated === true;
    }
  }

  const paymentType = resolvePaymentTypeForAdminTransaction(txType, emiNumber);
  if (!paymentType) {
    return { changed: false, skipped: true, reason: 'unknown_payment_type' };
  }

  if (dryRun) {
    return {
      changed: true,
      dryRun: true,
      loanId,
      paymentType,
      emiNumber,
      emiScheduleUpdated,
      amount,
      transactionDate: txDate
    };
  }

  if (emiScheduleUpdated && emiScheduleArray) {
    await executeQuery(
      `UPDATE loan_applications SET emi_schedule = ?, updated_at = NOW() WHERE id = ?`,
      [JSON.stringify(emiScheduleArray), loanId]
    );
  }

  const orderId = await upsertAdminPaymentOrder(executeQuery, {
    loanId,
    userId,
    applicationNumber,
    paymentType,
    amount,
    transactionId: transaction.id,
    transactionDate: txDate
  });

  await upsertAdminLoanPayment(executeQuery, {
    loanId,
    amount,
    orderId,
    transactionDate: txDate
  });

  await linkTransactionToPaymentOrder(executeQuery, transaction.id, orderId);

  return {
    changed: true,
    loanId,
    paymentType,
    orderId,
    emiNumber,
    emiScheduleUpdated,
    emiScheduleArray
  };
}

async function backfillAdminRepaymentRecords(executeQuery, { loanId = null, dryRun = false } = {}) {
  let sql = `
    SELECT
      t.id, t.user_id, t.loan_application_id, t.transaction_type, t.amount,
      DATE_FORMAT(t.transaction_date, '%Y-%m-%d') AS transaction_date,
      t.payment_method, t.description, t.status,
      la.application_number, la.emi_schedule, la.status AS loan_status, la.user_id AS loan_user_id
    FROM transactions t
    INNER JOIN loan_applications la ON la.id = t.loan_application_id
    WHERE t.transaction_type IN ('emi_payment', 'full_payment', 'settlement', 'part_payment')
      AND t.status = 'completed'
      AND t.loan_application_id IS NOT NULL
  `;
  const params = [];
  if (loanId != null) {
    sql += ' AND t.loan_application_id = ?';
    params.push(loanId);
  }
  sql += ' ORDER BY t.loan_application_id ASC, t.transaction_date ASC, t.id ASC';

  const rows = await executeQuery(sql, params);
  const byLoan = new Map();

  for (const row of rows) {
    const lid = row.loan_application_id;
    if (!byLoan.has(lid)) byLoan.set(lid, []);
    byLoan.get(lid).push(row);
  }

  const summary = {
    loans: byLoan.size,
    transactions: rows.length,
    synced: 0,
    emiSchedulesFixed: 0,
    errors: []
  };

  for (const [lid, txs] of byLoan) {
    let currentSchedule = txs[0]?.emi_schedule || null;
    let emiPaymentSeq = 0;

    for (const tx of txs) {
      try {
        let emiNumberOverride = null;
        if (String(tx.transaction_type || '').toLowerCase() === 'emi_payment') {
          emiPaymentSeq += 1;
          emiNumberOverride = emiPaymentSeq;
        }

        const loan = {
          id: lid,
          user_id: tx.loan_user_id || tx.user_id,
          application_number: tx.application_number,
          emi_schedule: currentSchedule,
          status: tx.loan_status
        };

        const result = await syncAdminRepaymentTransaction(executeQuery, {
          transaction: tx,
          loan,
          dryRun,
          emiNumber: emiNumberOverride
        });

        if (result.changed) summary.synced += 1;
        if (result.emiScheduleUpdated) {
          summary.emiSchedulesFixed += 1;
          currentSchedule = result.emiScheduleArray;
        } else if (result.emiScheduleArray) {
          currentSchedule = result.emiScheduleArray;
        }
      } catch (err) {
        summary.errors.push({
          transaction_id: tx.id,
          loan_id: lid,
          message: err.message
        });
      }
    }
  }

  return summary;
}

module.exports = {
  ADMIN_REPAYMENT_TX_TYPES,
  normalizeDateOnly,
  getFirstUnpaidEmiNumber,
  markAdminEmiPaidInSchedule,
  resolvePaymentTypeForAdminTransaction,
  syncAdminRepaymentTransaction,
  backfillAdminRepaymentRecords
};
