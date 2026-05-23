/**
 * Shared rules for when a loan may be marked as cleared after a repayment.
 * Keep all auto-clearance paths consistent (payment webhooks, order-status, eNACH, admin transactions).
 */

const AMOUNT_TOLERANCE = 0.01;

const ACTIVE_REPAYMENT_STATUSES = ['account_manager', 'overdue', 'default', 'delinquent'];

const REPAYMENT_TRANSACTION_TYPES = [
  'emi_payment',
  'part_payment',
  'full_payment',
  'settlement',
  'credit'
];

function parseEmiSchedule(raw) {
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function getEmiDueAmount(emi) {
  if (!emi) return 0;
  const due = parseFloat(emi.instalment_amount || emi.emi_amount || 0);
  return Number.isFinite(due) ? due : 0;
}

function getEmiPaidAmount(emi) {
  if (!emi) return 0;
  const paid = parseFloat(emi.paid_amount || 0);
  if (Number.isFinite(paid) && paid > 0) return paid;
  if (String(emi.status || '').toLowerCase() === 'paid') {
    return getEmiDueAmount(emi);
  }
  return 0;
}

function isEmiFullyPaid(emi) {
  if (String(emi?.status || '').toLowerCase() === 'paid') return true;
  const due = getEmiDueAmount(emi);
  if (due <= 0) return String(emi?.status || '').toLowerCase() === 'paid';
  return getEmiPaidAmount(emi) >= due - AMOUNT_TOLERANCE;
}

function areAllEmisPaid(emiSchedule) {
  const schedule = parseEmiSchedule(emiSchedule);
  if (!schedule || schedule.length === 0) return false;
  return schedule.every((emi) => isEmiFullyPaid(emi));
}

/**
 * Apply a repayment to one EMI. Marks paid only when cumulative paid_amount covers EMI due.
 */
function applyPaymentToEmi(emi, paymentAmount, paidDate) {
  const due = getEmiDueAmount(emi);
  const prevPaid = getEmiPaidAmount(emi);
  const increment = parseFloat(paymentAmount) || 0;
  const newPaid = Math.round((prevPaid + increment) * 100) / 100;
  const date = paidDate || new Date().toISOString().split('T')[0];

  const updated = {
    ...emi,
    paid_amount: newPaid
  };

  if (due > 0 && newPaid >= due - AMOUNT_TOLERANCE) {
    updated.status = 'paid';
    updated.paid_date = emi.paid_date || date;
  } else if (String(emi.status || '').toLowerCase() !== 'paid') {
    updated.status = 'pending';
  }

  return updated;
}

/**
 * Sync clearance gate for payment webhooks after emi_schedule has been updated in-memory.
 * pre-close / full_payment are explicit full-close Cashfree types.
 * settlement is excluded — negotiated partial amounts must not auto-clear as full repayable.
 *
 * @param {string} paymentType - Cashfree/admin payment type
 * @param {Array|object|string|null} emiScheduleAfterUpdate - emi_schedule after any EMI status update
 * @returns {boolean}
 */
function shouldClearLoanAfterPayment(paymentType, emiScheduleAfterUpdate) {
  const type = String(paymentType || 'loan_repayment').toLowerCase();

  if (type === 'pre-close' || type === 'full_payment') {
    return true;
  }

  if (type.startsWith('emi_')) {
    return areAllEmisPaid(emiScheduleAfterUpdate);
  }

  return false;
}

/**
 * Backup clearance when create-order finds PAID order + loan_payments but loan still active.
 * Verifies amounts for EMI paths; never auto-clears settlement as full repayable.
 */
async function evaluateBackupLoanClearance({ executeQuery, loan, paymentType }) {
  const type = String(paymentType || '').toLowerCase();

  if (type === 'settlement') {
    return { shouldClear: false, reason: 'settlement_not_auto_full_clear' };
  }

  if (type === 'pre-close' || type === 'full_payment') {
    return {
      shouldClear: true,
      closedAmount: parseFloat(loan.total_repayable) || 0,
      reason: 'explicit_full_close_payment'
    };
  }

  if (type.startsWith('emi_')) {
    if (!shouldClearLoanAfterPayment(type, loan.emi_schedule)) {
      return { shouldClear: false, reason: 'not_all_emis_paid' };
    }
    return evaluateLoanClearanceEligibility({ executeQuery, loan, emiSchedule: loan.emi_schedule });
  }

  return evaluateLoanClearanceEligibility({ executeQuery, loan, emiSchedule: loan.emi_schedule });
}

function markAllEmisPaid(emiSchedule, paidDate) {
  const schedule = parseEmiSchedule(emiSchedule);
  if (!schedule) return null;
  const date = paidDate || new Date().toISOString().split('T')[0];
  return schedule.map((emi) => ({
    ...emi,
    status: 'paid',
    paid_date: emi.paid_date || date,
    paid_amount: getEmiDueAmount(emi) || getEmiPaidAmount(emi)
  }));
}

function getEmiNumberFromPaymentType(paymentType) {
  const map = {
    emi_1st: 1,
    emi_2nd: 2,
    emi_3rd: 3,
    emi_4th: 4
  };
  return map[String(paymentType || '').toLowerCase()] || 0;
}

/**
 * Apply one EMI payment to schedule in-memory. Does not persist — caller must UPDATE loan_applications.
 * Uses applyPaymentToEmi so partial payments stay pending, not 'paid'.
 * @returns {{ updated: boolean, emiScheduleArray: Array|null, emiFullyPaid: boolean }}
 */
function markEmiPaidInSchedule(emiScheduleRaw, emiNumber, paymentAmount, paidDate) {
  if (!emiNumber || emiNumber < 1) {
    return { updated: false, emiScheduleArray: null, emiFullyPaid: false };
  }

  const schedule = parseEmiSchedule(emiScheduleRaw);
  if (!schedule || schedule.length < emiNumber) {
    return { updated: false, emiScheduleArray: schedule, emiFullyPaid: false };
  }

  const emiIndex = emiNumber - 1;
  schedule[emiIndex] = applyPaymentToEmi(schedule[emiIndex], paymentAmount, paidDate);
  const emiFullyPaid = isEmiFullyPaid(schedule[emiIndex]);

  return { updated: true, emiScheduleArray: schedule, emiFullyPaid };
}

/** Only notify customer when schedule was persisted, this EMI is fully paid, and loan is not fully cleared yet. */
function shouldSendEmiClearedSms(emiScheduleUpdated, shouldClearLoan, emiFullyPaid = false) {
  return emiScheduleUpdated === true && emiFullyPaid === true && shouldClearLoan !== true;
}

async function getTotalSuccessfulLoanPayments(executeQuery, loanId) {
  const rows = await executeQuery(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM loan_payments
     WHERE loan_id = ? AND status = 'SUCCESS'`,
    [loanId]
  );
  return parseFloat(rows[0]?.total || 0);
}

/**
 * Sum repayments without double-counting gateway/eNACH rows present in both tables.
 */
async function getTotalRepaymentsReceived(executeQuery, loanId) {
  const lpTotal = await getTotalSuccessfulLoanPayments(executeQuery, loanId);

  const paymentRefs = await executeQuery(
    `SELECT transaction_id FROM loan_payments WHERE loan_id = ? AND status = 'SUCCESS'`,
    [loanId]
  );
  const refSet = new Set(
    (paymentRefs || []).map((row) => String(row.transaction_id || '')).filter(Boolean)
  );

  const txRows = await executeQuery(
    `SELECT amount, reference_number
     FROM transactions
     WHERE loan_application_id = ?
       AND transaction_type IN (${REPAYMENT_TRANSACTION_TYPES.map(() => '?').join(', ')})`,
    [loanId, ...REPAYMENT_TRANSACTION_TYPES]
  );

  let adminOnlyTotal = 0;
  for (const tx of txRows || []) {
    const ref = String(tx.reference_number || '');
    if (ref && refSet.has(ref)) continue;
    adminOnlyTotal += parseFloat(tx.amount || 0);
  }

  return Math.round((lpTotal + adminOnlyTotal) * 100) / 100;
}

async function getLoanAmountDueForClearance(loanId, loanFallback) {
  try {
    const { getLoanCalculation } = require('./loanCalculations');
    const calc = await getLoanCalculation(loanId);
    const totalRepayable = parseFloat(calc?.total?.repayable || calc?.total_repayable || 0);
    const penalty = parseFloat(calc?.penalty?.penalty_total || 0);
    const due = Math.round((totalRepayable + penalty) * 100) / 100;
    if (due > 0) return due;
  } catch (e) {
    console.warn(`[loanClearance] Could not calculate amount due for loan #${loanId}:`, e.message);
  }
  return parseFloat(loanFallback?.total_repayable || 0) || 0;
}

/**
 * Decide if loan should be cleared after repayments (eNACH / admin EMI path).
 */
async function evaluateLoanClearanceEligibility({ executeQuery, loan, emiSchedule }) {
  if (!loan || !ACTIVE_REPAYMENT_STATUSES.includes(loan.status)) {
    return { shouldClear: false, reason: 'loan_not_active' };
  }

  if (!areAllEmisPaid(emiSchedule)) {
    return { shouldClear: false, reason: 'not_all_emis_fully_paid' };
  }

  const totalPaid = await getTotalRepaymentsReceived(executeQuery, loan.id);
  const amountDue = await getLoanAmountDueForClearance(loan.id, loan);

  if (totalPaid >= amountDue - AMOUNT_TOLERANCE) {
    return { shouldClear: true, totalPaid, amountDue, closedAmount: amountDue };
  }

  return {
    shouldClear: false,
    reason: 'total_paid_below_amount_due',
    totalPaid,
    amountDue
  };
}

/** Prefer closedAmount, then amountDue (repayable + penalties), then loan.total_repayable. */
function resolveClosedAmount(clearance, loanFallback) {
  if (clearance?.closedAmount != null && Number.isFinite(Number(clearance.closedAmount))) {
    return Number(clearance.closedAmount);
  }
  if (clearance?.amountDue != null && Number.isFinite(Number(clearance.amountDue))) {
    return Number(clearance.amountDue);
  }
  return parseFloat(loanFallback?.total_repayable) || 0;
}

async function getSystemAdminId(executeQuery) {
  const rows = await executeQuery(
    `SELECT id FROM admins WHERE is_active = 1 AND role = ? ORDER BY created_at ASC LIMIT 1`,
    ['superadmin']
  );
  return rows?.[0]?.id || null;
}

/**
 * Ledger row in transactions for automated eNACH debits (admin Transaction History).
 */
async function recordEnachLedgerTransaction({
  executeQuery,
  loan,
  paymentId,
  amount,
  emiNumber,
  bankReference
}) {
  const reference = String(paymentId || '').trim();
  if (!reference) {
    return { created: false, reason: 'missing_reference' };
  }

  const existing = await executeQuery(
    `SELECT id FROM transactions
     WHERE loan_application_id = ? AND reference_number = ?
     LIMIT 1`,
    [loan.id, reference]
  );
  if (existing?.length) {
    return { created: false, reason: 'already_exists' };
  }

  const systemAdminId = await getSystemAdminId(executeQuery);
  if (!systemAdminId) {
    console.warn('[eNACH] No system admin found — skipping transactions ledger row');
    return { created: false, reason: 'no_system_admin' };
  }

  const schedule = parseEmiSchedule(loan.emi_schedule) || [];
  const emi = schedule[emiNumber - 1];
  const emiFullyPaid = emi ? isEmiFullyPaid(emi) : false;
  const txType = emiFullyPaid ? 'emi_payment' : 'part_payment';
  const today = new Date().toISOString().split('T')[0];
  const utr = bankReference && String(bankReference) !== reference
    ? ` (UTR ${bankReference})`
    : '';

  await executeQuery(
    `INSERT INTO transactions (
      user_id, loan_application_id, transaction_type, amount, description,
      category, payment_method, reference_number, transaction_date,
      status, priority, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'loan', 'other', ?, ?, 'completed', 'high', ?, NOW(), NOW())`,
    [
      loan.user_id,
      loan.id,
      txType,
      amount,
      `EMI ${emiNumber} via eNACH auto-debit — payment ${reference}${utr}`,
      reference,
      today,
      systemAdminId
    ]
  );

  return { created: true, transactionType: txType };
}

module.exports = {
  AMOUNT_TOLERANCE,
  ACTIVE_REPAYMENT_STATUSES,
  parseEmiSchedule,
  getEmiDueAmount,
  getEmiPaidAmount,
  isEmiFullyPaid,
  areAllEmisPaid,
  applyPaymentToEmi,
  shouldClearLoanAfterPayment,
  evaluateBackupLoanClearance,
  markAllEmisPaid,
  getEmiNumberFromPaymentType,
  markEmiPaidInSchedule,
  shouldSendEmiClearedSms,
  getTotalSuccessfulLoanPayments,
  getTotalRepaymentsReceived,
  getLoanAmountDueForClearance,
  evaluateLoanClearanceEligibility,
  resolveClosedAmount,
  recordEnachLedgerTransaction
};
