/**
 * Shared rules for when a loan may be marked as cleared after a repayment.
 * Keep all auto-clearance paths consistent (payment webhooks, order-status, eNACH, admin transactions).
 */

const AMOUNT_TOLERANCE = 0.01;

// Tolerance (in ₹) for deciding whether a payment fully covers an EMI's current due.
// Differences within this band are treated as rounding; anything larger is a genuine
// shortfall and the EMI must stay partially paid (not silently marked fully paid).
const PAYMENT_ROUNDING_TOLERANCE = 1.0;

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

/**
 * Gateway / successful Cashfree EMI.
 * Marks the EMI fully paid ONLY when the amount covers the current penalty-inclusive due
 * (`emi_amount`). If the amount falls short — e.g. a stale/quoted figure paid days later after
 * more penalty + DPD interest accrued — the EMI stays pending with the partial recorded, so the
 * outstanding balance is never silently hidden.
 */
function markGatewayEmiPaidInSchedule(emiScheduleRaw, emiNumber, paymentAmount, paidDate) {
  const schedule = parseEmiSchedule(emiScheduleRaw);
  if (!schedule || emiNumber == null || emiNumber < 1 || schedule.length < emiNumber) {
    return { updated: false, emiScheduleArray: schedule, emiFullyPaid: false };
  }

  const idx = emiNumber - 1;
  const emi = schedule[idx] || {};
  const date = paidDate || new Date().toISOString().split('T')[0];
  const paid = parseFloat(paymentAmount) || 0;

  let baseInstalment = emi.instalment_amount;
  if (baseInstalment == null || baseInstalment === '') {
    baseInstalment = parseFloat(emi.emi_amount || 0) || paid;
  }

  // Current full due = penalty-inclusive emi_amount (kept fresh by the calc engine / daily cron).
  const due = parseFloat(emi.emi_amount || emi.instalment_amount || 0) || 0;
  const alreadyPaid = String(emi.status || '').toLowerCase() === 'paid';
  const fullyPaid = alreadyPaid || due <= 0 || paid >= due - PAYMENT_ROUNDING_TOLERANCE;

  schedule[idx] = {
    ...emi,
    status: fullyPaid ? 'paid' : 'pending',
    paid_date: date,
    paid_amount: paid,
    emi_amount: fullyPaid ? paid : (emi.emi_amount != null ? emi.emi_amount : paid),
    instalment_amount: parseFloat(baseInstalment) || paid,
    penalty_base: fullyPaid ? 0 : (emi.penalty_base || 0),
    penalty_gst: fullyPaid ? 0 : (emi.penalty_gst || 0),
    penalty_total: fullyPaid ? 0 : (emi.penalty_total || 0),
    dpd_interest_on_total_principal: fullyPaid
      ? 0
      : (emi.dpd_interest_on_total_principal || emi.dpd_interest || 0)
  };

  return { updated: true, emiScheduleArray: schedule, emiFullyPaid: fullyPaid };
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
 * Decide if loan should be cleared after repayments (eNACH / admin EMI / gateway EMI path).
 * When every EMI is fully paid on the schedule, the loan is complete — do not block clearance
 * because ledger totals lag penalty-inclusive calc by a few rupees (common with admin entries).
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
  const schedule = parseEmiSchedule(emiSchedule) || [];
  const schedulePaidTotal = schedule.reduce((sum, emi) => sum + getEmiPaidAmount(emi), 0);
  const effectivePaid = Math.round(Math.max(totalPaid, schedulePaidTotal) * 100) / 100;

  return {
    shouldClear: true,
    totalPaid: effectivePaid,
    amountDue,
    closedAmount: amountDue,
    reason: 'all_emis_fully_paid'
  };
}

/**
 * Find active EMI loans whose schedule shows all EMIs paid but status was never cleared
 * (e.g. auto-clear blocked by old amount-due check). Optionally scope to specific loan IDs.
 */
async function repairPendingLoanClearance(executeQuery, {
  loanId = null,
  loanIds = null,
  dryRun = false,
  onProgress = null
} = {}) {
  const scopedIds = Array.isArray(loanIds) && loanIds.length > 0
    ? loanIds.map((id) => parseInt(id, 10)).filter((id) => Number.isFinite(id) && id > 0)
    : (loanId != null ? [parseInt(loanId, 10)] : null);

  let sql = `
    SELECT id, user_id, status, emi_schedule, total_repayable, application_number
    FROM loan_applications
    WHERE status IN ('account_manager', 'overdue', 'default', 'delinquent')
      AND emi_schedule IS NOT NULL
      AND emi_schedule != ''
      AND emi_schedule != '[]'
  `;
  const params = [];
  if (scopedIds && scopedIds.length > 0) {
    sql += ` AND id IN (${scopedIds.map(() => '?').join(', ')})`;
    params.push(...scopedIds);
  }
  sql += ' ORDER BY id ASC';

  const rows = await executeQuery(sql, params);
  const summary = {
    scanned: rows.length,
    eligible: 0,
    cleared: 0,
    errors: []
  };

  let processed = 0;
  for (const loan of rows) {
    processed += 1;
    try {
      if (!areAllEmisPaid(loan.emi_schedule)) {
        continue;
      }

      summary.eligible += 1;
      const clearance = await evaluateLoanClearanceEligibility({
        executeQuery,
        loan,
        emiSchedule: loan.emi_schedule
      });

      if (!clearance.shouldClear) {
        continue;
      }

      const closedAmount = resolveClosedAmount(clearance, loan);
      const closedDate = new Date().toISOString().split('T')[0];

      if (!dryRun) {
        await executeQuery(
          `UPDATE loan_applications
           SET status = 'cleared', closed_date = ?, closed_amount = ?, updated_at = NOW()
           WHERE id = ?`,
          [closedDate, closedAmount, loan.id]
        );

        try {
          const { triggerEventSMS } = require('./eventSmsTrigger');
          await triggerEventSMS('loan_cleared', {
            userId: loan.user_id,
            loanId: loan.id
          });
        } catch (smsErr) {
          console.warn(`[repairPendingLoanClearance] loan_cleared SMS skipped PLL${loan.id}: ${smsErr.message}`);
        }

        try {
          const { runCoolingPeriodCheckAfterLoanClear } = require('./creditLimitCalculator');
          await runCoolingPeriodCheckAfterLoanClear(loan.user_id, loan.id);
        } catch (coolErr) {
          console.warn(`[repairPendingLoanClearance] cooling period skipped PLL${loan.id}: ${coolErr.message}`);
        }
      }

      summary.cleared += 1;
    } catch (err) {
      summary.errors.push({ loan_id: loan.id, message: err.message });
    }

    if (typeof onProgress === 'function') {
      onProgress({
        processed,
        total: rows.length,
        loanId: loan.id,
        pct: rows.length > 0 ? Math.round((processed / rows.length) * 100) : 100
      });
    }
  }

  return summary;
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
 *
 * @param {boolean|null} [overrideEmiFullyPaid] - When provided, skips re-deriving emiFullyPaid
 *   from the schedule (avoids misclassification when emi_amount was bumped by a concurrent
 *   getLoanCalculation call between charge submission and success processing).
 */
async function recordEnachLedgerTransaction({
  executeQuery,
  loan,
  paymentId,
  amount,
  emiNumber,
  bankReference,
  overrideEmiFullyPaid = null
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

  // Prefer the caller-supplied flag; fall back to reading the in-memory schedule.
  // The caller (applySuccessfulChargeToLoan) already ran applyPaymentToEmi and knows the
  // definitive result — using that value avoids misclassification when emi_amount in the
  // stored schedule was raised by a concurrent getLoanCalculation call.
  let emiFullyPaid;
  if (overrideEmiFullyPaid !== null) {
    emiFullyPaid = overrideEmiFullyPaid;
  } else {
    const schedule = parseEmiSchedule(loan.emi_schedule) || [];
    const emi = schedule[emiNumber - 1];
    emiFullyPaid = emi ? isEmiFullyPaid(emi) : false;
  }
  // Targeted eNACH EMI debits are always EMI collections — never "part_payment" in txn history.
  const txType =
    emiNumber > 0 ? 'emi_payment' : emiFullyPaid ? 'emi_payment' : 'part_payment';
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

/**
 * Repair eNACH EMI debits wrongly logged as part_payment (e.g. PLL6342 EMI2).
 * Updates txn type, marks the EMI paid on schedule, and clears loan if fully paid.
 */
async function repairMisclassifiedEnachEmiLedger(executeQuery, {
  loanId,
  transactionId = null,
  emiNumber = null,
  dryRun = false
} = {}) {
  const lid = parseInt(loanId, 10);
  if (!lid) {
    return { changed: false, reason: 'invalid_loan_id' };
  }

  let sql = `
    SELECT id, transaction_type, amount, description, reference_number, transaction_date
    FROM transactions
    WHERE loan_application_id = ?
      AND status = 'completed'
      AND (
        transaction_type = 'part_payment'
        OR (transaction_type = 'emi_payment' AND description LIKE '%eNACH%')
      )
      AND description LIKE '%eNACH%'
  `;
  const params = [lid];
  if (transactionId != null) {
    sql += ' AND id = ?';
    params.push(parseInt(transactionId, 10));
  }
  sql += ' ORDER BY transaction_date ASC, id ASC';

  const txs = await executeQuery(sql, params);
  if (!txs.length) {
    return { changed: false, reason: 'no_enach_transactions', loanId: lid };
  }

  const loans = await executeQuery(
    `SELECT id, user_id, emi_schedule, status, total_repayable FROM loan_applications WHERE id = ?`,
    [lid]
  );
  if (!loans.length) {
    return { changed: false, reason: 'loan_not_found', loanId: lid };
  }
  const loan = loans[0];
  let schedule = parseEmiSchedule(loan.emi_schedule) || [];
  const repaired = [];

  for (const tx of txs) {
    const desc = String(tx.description || '');
    let emiNum = emiNumber != null ? parseInt(emiNumber, 10) : null;
    if (!emiNum) {
      const m = desc.match(/EMI\s+(\d+)/i);
      if (m) emiNum = parseInt(m[1], 10);
    }
    if (!emiNum || emiNum < 1) {
      repaired.push({ transaction_id: tx.id, skipped: true, reason: 'emi_number_unknown' });
      continue;
    }

    const idx = emiNum - 1;
    if (!schedule[idx]) {
      repaired.push({ transaction_id: tx.id, skipped: true, reason: 'emi_not_in_schedule', emiNumber: emiNum });
      continue;
    }

    const paidDate = normalizeDateOnly(tx.transaction_date);
    const paidAmt = parseFloat(tx.amount) || 0;
    const emi = schedule[idx];
    schedule[idx] = {
      ...emi,
      status: 'paid',
      paid_date: paidDate,
      paid_amount: paidAmt
    };

    if (!dryRun && tx.transaction_type === 'part_payment') {
      await executeQuery(
        `UPDATE transactions SET transaction_type = 'emi_payment', updated_at = NOW() WHERE id = ?`,
        [tx.id]
      );
    }

    repaired.push({
      transaction_id: tx.id,
      emiNumber: emiNum,
      typeFixed: tx.transaction_type === 'part_payment',
      amount: paidAmt
    });
  }

  let loanCleared = false;
  if (repaired.some((r) => !r.skipped)) {
    if (!dryRun) {
      await executeQuery(
        `UPDATE loan_applications SET emi_schedule = ?, updated_at = NOW() WHERE id = ?`,
        [JSON.stringify(schedule), lid]
      );
    }

    const clearance = await evaluateLoanClearanceEligibility({
      executeQuery,
      loan: { ...loan, emi_schedule: schedule },
      emiSchedule: schedule
    });

    if (clearance.shouldClear && !dryRun) {
      const closedAmount = clearance.amountDue || parseFloat(loan.total_repayable) || 0;
      await executeQuery(
        `UPDATE loan_applications
         SET status = 'cleared', closed_date = CURDATE(), closed_amount = ?, updated_at = NOW()
         WHERE id = ? AND status != 'cleared'`,
        [closedAmount, lid]
      );
      loanCleared = true;
    }

    return {
      changed: true,
      dryRun,
      loanId: lid,
      repaired,
      loanCleared,
      clearance: clearance.shouldClear
        ? { shouldClear: true, amountDue: clearance.amountDue, totalPaid: clearance.totalPaid }
        : { shouldClear: false, reason: clearance.reason }
    };
  }

  return { changed: false, loanId: lid, repaired };
}

/**
 * Fix paid EMIs where emi_amount > paid_amount (admin dashboard penalty refresh bug).
 */
async function repairPaidEmiAmountMismatch(executeQuery, {
  loanId = null,
  loanIds = null,
  dryRun = false
} = {}) {
  const scopedIds = Array.isArray(loanIds) && loanIds.length > 0
    ? loanIds.map((id) => parseInt(id, 10)).filter((id) => Number.isFinite(id) && id > 0)
    : (loanId != null ? [parseInt(loanId, 10)] : null);

  let sql = `SELECT id, emi_schedule, status FROM loan_applications WHERE emi_schedule IS NOT NULL`;
  const params = [];
  if (scopedIds?.length) {
    sql += ` AND id IN (${scopedIds.map(() => '?').join(', ')})`;
    params.push(...scopedIds);
  }

  const loans = await executeQuery(sql, params);
  const summary = { scanned: loans.length, fixed: 0, emisAdjusted: 0, loanIds: [], dryRun };

  for (const loan of loans) {
    const schedule = parseEmiSchedule(loan.emi_schedule);
    if (!schedule?.length) continue;

    let changed = false;
    const adjusted = [];
    for (let i = 0; i < schedule.length; i++) {
      const emi = schedule[i];
      const st = String(emi?.status || '').toLowerCase();
      if (st !== 'paid' && st !== 'completed') continue;

      const paidAmt = parseFloat(emi.paid_amount);
      const emiAmt = parseFloat(emi.emi_amount);
      if (!paidAmt || paidAmt <= 0) continue;
      if (!emiAmt || emiAmt <= paidAmt + 0.02) continue;

      schedule[i] = {
        ...emi,
        emi_amount: paidAmt,
        paid_amount: paidAmt,
        penalty_base: 0,
        penalty_gst: 0,
        penalty_total: 0,
        dpd_interest_on_total_principal: 0,
        dpd_interest: 0
      };
      changed = true;
      adjusted.push(i + 1);
    }

    if (changed) {
      summary.fixed += 1;
      summary.emisAdjusted += adjusted.length;
      summary.loanIds.push(loan.id);
      if (!dryRun) {
        await executeQuery(
          `UPDATE loan_applications SET emi_schedule = ?, updated_at = NOW() WHERE id = ?`,
          [JSON.stringify(schedule), loan.id]
        );
      }
    }
  }

  return summary;
}

function normalizeDateOnly(raw) {
  if (raw == null || raw === '') return new Date().toISOString().slice(0, 10);
  const s = String(raw).trim();
  const lead = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (lead) return lead[1];
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return new Date().toISOString().slice(0, 10);
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
  markGatewayEmiPaidInSchedule,
  shouldSendEmiClearedSms,
  getTotalSuccessfulLoanPayments,
  getTotalRepaymentsReceived,
  getLoanAmountDueForClearance,
  evaluateLoanClearanceEligibility,
  repairPendingLoanClearance,
  resolveClosedAmount,
  recordEnachLedgerTransaction,
  repairMisclassifiedEnachEmiLedger,
  repairPaidEmiAmountMismatch,
  getSystemAdminId
};
