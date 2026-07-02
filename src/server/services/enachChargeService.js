const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { executeQuery, initializeDatabase } = require('../config/database');
const {
  parseEmiSchedule,
  evaluateLoanClearanceEligibility,
  recordEnachLedgerTransaction,
  isEmiFullyPaid
} = require('../utils/loanClearance');

const CASHFREE_API_BASE = process.env.CASHFREE_API_BASE || 'https://sandbox.cashfree.com/pg';
const CASHFREE_CLIENT_ID = process.env.CASHFREE_CLIENT_ID;
const CASHFREE_CLIENT_SECRET = process.env.CASHFREE_CLIENT_SECRET;
const CASHFREE_API_VERSION = process.env.CASHFREE_API_VERSION || '2025-01-01';

function getCashfreeHeaders(idempotencyKey = null) {
  const headers = {
    'Content-Type': 'application/json',
    'x-api-version': CASHFREE_API_VERSION,
    'x-client-id': CASHFREE_CLIENT_ID,
    'x-client-secret': CASHFREE_CLIENT_SECRET,
    'x-request-id': uuidv4(),
    'x-idempotency-key': idempotencyKey || uuidv4()
  };
  return headers;
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (e) {
    return fallback;
  }
}

/**
 * For idempotent re-runs: derive whether the original charge fully cleared its EMI.
 * Legacy runs may omit presentedEmiNumber — look up the prior ledger/run record instead of
 * defaulting to fully paid (which would incorrectly mark the run SUCCESS).
 */
async function resolvePriorChargeEmiFullyPaid({
  loanApplicationId,
  paymentId,
  targetEmiNumber,
  schedule,
  findEmiIndexByNumber
}) {
  let emiNumber = Number(targetEmiNumber) || 0;

  const emiFullyPaidFromSchedule = (n) => {
    if (!n) return null;
    const idx = findEmiIndexByNumber(n);
    if (idx === -1) return null;
    return isEmiFullyPaid(schedule[idx]);
  };

  if (emiNumber > 0) {
    const fromSchedule = emiFullyPaidFromSchedule(emiNumber);
    if (fromSchedule !== null) return fromSchedule;
  }

  try {
    const txRows = await executeQuery(
      `SELECT transaction_type, description FROM transactions
       WHERE loan_application_id = ? AND reference_number = ?
       LIMIT 1`,
      [loanApplicationId, paymentId]
    );
    if (txRows?.length) {
      const txType = String(txRows[0].transaction_type || '').toLowerCase();
      if (txType === 'part_payment') return false;
      if (txType === 'emi_payment') return true;

      const desc = String(txRows[0].description || '');
      const emiMatch = desc.match(/EMI\s+(\d+)\s+via\s+eNACH/i);
      if (emiMatch) {
        emiNumber = Number(emiMatch[1]) || 0;
        const fromSchedule = emiFullyPaidFromSchedule(emiNumber);
        if (fromSchedule !== null) return fromSchedule;
      }
    }
  } catch (err) {
    console.warn('[eNACH] Prior charge ledger lookup failed (non-fatal):', err.message);
  }

  try {
    const runRows = await executeQuery(
      `SELECT emi_number, status FROM enach_auto_debit_runs
       WHERE loan_application_id = ? AND payment_id = ?
       LIMIT 1`,
      [loanApplicationId, paymentId]
    );
    if (runRows?.length) {
      const runStatus = String(runRows[0].status || '').toUpperCase();
      if (runStatus === 'PARTIAL') return false;
      if (!emiNumber) emiNumber = Number(runRows[0].emi_number) || 0;
      if (runStatus === 'SUCCESS') {
        const fromSchedule = emiFullyPaidFromSchedule(emiNumber);
        return fromSchedule !== null ? fromSchedule : true;
      }
    }
  } catch (err) {
    console.warn('[eNACH] Prior auto-debit run lookup failed (non-fatal):', err.message);
  }

  const fromSchedule = emiFullyPaidFromSchedule(emiNumber);
  if (fromSchedule !== null) return fromSchedule;

  // Unknown prior outcome — conservative PARTIAL so remainder can be re-presented
  return false;
}

async function chargeSubscription({ userId, dbSubscriptionId, amount, source = 'manual' }) {
  await initializeDatabase();

  if (!CASHFREE_CLIENT_ID || !CASHFREE_CLIENT_SECRET) {
    throw new Error('Cashfree eNACH credentials are not configured');
  }

  const subscriptions = await executeQuery(
    `SELECT es.*
     FROM enach_subscriptions es
     WHERE es.id = ? AND es.user_id = ?`,
    [dbSubscriptionId, userId]
  );

  if (!subscriptions || subscriptions.length === 0) {
    throw new Error('eNACH subscription not found');
  }

  const subscription = subscriptions[0];
  const merchantSubscriptionId = subscription.subscription_id;
  const cfSubscriptionId = subscription.cf_subscription_id;
  const subscriptionIdToUse = merchantSubscriptionId || cfSubscriptionId;

  if (!subscriptionIdToUse) {
    throw new Error('No subscription identifier available for charge');
  }

  const chargeAmount = Number(amount);
  if (!Number.isFinite(chargeAmount) || chargeAmount <= 0) {
    throw new Error('Invalid charge amount');
  }

  const paymentId = `charge_${subscriptionIdToUse}_${Date.now()}`;
  const chargePayload = {
    subscription_id: subscriptionIdToUse,
    payment_id: paymentId,
    payment_type: 'CHARGE',
    payment_amount: chargeAmount,
    payment_currency: 'INR'
  };

  const headers = getCashfreeHeaders(paymentId);
  const chargeUrl = `${CASHFREE_API_BASE}/subscriptions/pay`;

  try {
    const chargeResponse = await axios.post(chargeUrl, chargePayload, {
      headers,
      timeout: 60000
    });

    const paymentStatus = chargeResponse.data?.payment_status || 'PENDING';
    const cfPaymentId = chargeResponse.data?.cf_payment_id || null;

    await executeQuery(
      `INSERT INTO enach_charge_requests
      (user_id, subscription_id, db_subscription_id, payment_id, cf_payment_id, amount, status,
       request_data, response_data, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        userId,
        subscriptionIdToUse,
        dbSubscriptionId,
        paymentId,
        cfPaymentId,
        chargeAmount,
        paymentStatus,
        JSON.stringify(chargePayload),
        JSON.stringify(chargeResponse.data || {})
      ]
    );

    return {
      success: true,
      status: paymentStatus,
      paymentId,
      cfPaymentId,
      subscriptionId: subscriptionIdToUse,
      response: chargeResponse.data || {}
    };
  } catch (error) {
    await executeQuery(
      `INSERT INTO enach_charge_requests
      (user_id, subscription_id, db_subscription_id, payment_id, amount, status,
       request_data, response_data, error_message, created_at)
      VALUES (?, ?, ?, ?, ?, 'FAILED', ?, ?, ?, NOW())`,
      [
        userId,
        subscriptionIdToUse,
        dbSubscriptionId,
        paymentId,
        chargeAmount,
        JSON.stringify(chargePayload),
        JSON.stringify(error.response?.data || {}),
        error.message
      ]
    );

    return {
      success: false,
      status: 'FAILED',
      paymentId,
      subscriptionId: subscriptionIdToUse,
      response: error.response?.data || null,
      error: error.message
    };
  }
}

async function fetchChargeStatus(subscriptionId, paymentId) {
  if (!CASHFREE_CLIENT_ID || !CASHFREE_CLIENT_SECRET) {
    throw new Error('Cashfree eNACH credentials are not configured');
  }

  const headers = getCashfreeHeaders();
  const url = `${CASHFREE_API_BASE}/subscriptions/${subscriptionId}/payments/${paymentId}`;
  const response = await axios.get(url, { headers, timeout: 30000 });
  return response.data || {};
}

async function resolveEnachBankReference(paymentId) {
  const rows = await executeQuery(
    `SELECT cf_payment_id, response_data FROM enach_charge_requests WHERE payment_id = ? LIMIT 1`,
    [paymentId]
  );
  if (!rows?.length) return paymentId;

  const row = rows[0];
  if (row.cf_payment_id) return String(row.cf_payment_id);

  const response = parseJson(row.response_data, {});
  return (
    response.bank_reference ||
    response.payment_utr ||
    response.utr ||
    paymentId
  );
}

/**
 * Applies a SUCCESSFUL eNACH charge to the loan's EMI schedule.
 *
 * eNACH settles 1–5+ days after the debit is presented, and penalty/DPD keep accruing in that window
 * (the daily cron keeps emi_amount current). We do NOT freeze penalty — if a mandate fails the
 * borrower must keep accruing — so paid_date is the actual settlement date. But the borrower's real
 * obligation is the due AS OF the presentation date (that's what we debited); any extra penalty that
 * piles up while the money is in transit is our settlement lag, not the borrower's fault. So we mark
 * the EMI fully paid when the charge covered the presentation-date due (`presentationDue`), regardless
 * of how much the live due has since grown — i.e. a successful charge clears the EMI even on a 4–5 day
 * lag, waiving only the in-transit accrual. A genuinely short/stale charge (collected < presentation
 * due) still stays partial. This presentation-due rule is eNACH-only (system-initiated); manual/admin
 * and gateway payments use the strict live-due coverage check.
 *
 * @param {number} [presentationDue] - The borrower's obligation at presentation (penalty-inclusive due
 *   for the EMI as of the day the charge was raised, minus any prior paid). When omitted/0, falls back
 *   to the strict live-due check.
 * @param {number} [presentedEmiNumber] - The specific EMI this charge was raised for. The charge is
 *   applied to THIS EMI only (never the "next unpaid" one) so a re-applied/duplicate success can't
 *   drift a single EMI's money onto a later EMI. Omitted/0 → legacy "first unpaid due EMI" behaviour.
 */
async function applySuccessfulChargeToLoan({ loanApplicationId, paymentId, amount, presentationDue = 0, presentedEmiNumber = 0 }) {
  await initializeDatabase();
  const loans = await executeQuery(
    `SELECT id, status, user_id, application_number, emi_schedule, total_repayable
     FROM loan_applications
     WHERE id = ?`,
    [loanApplicationId]
  );

  if (!loans || loans.length === 0) {
    return { updated: false, reason: 'loan_not_found' };
  }

  const loan = loans[0];
  if (!loan.emi_schedule) {
    return { updated: false, reason: 'emi_schedule_missing' };
  }

  const schedule = parseJson(loan.emi_schedule, null);
  if (!Array.isArray(schedule) || schedule.length === 0) {
    return { updated: false, reason: 'emi_schedule_invalid' };
  }

  const targetEmiNumber = Number(presentedEmiNumber) || 0;
  const findEmiIndexByNumber = (n) => schedule.findIndex(
    (e) => Number(e.emi_number || e.instalment_no) === Number(n)
  );

  // IDEMPOTENCY: a given eNACH charge must hit the schedule EXACTLY ONCE. If this payment was
  // already recorded for this loan, the schedule was updated on the first pass — re-running (recheck
  // after a mid-way crash left the run PENDING, two overlapping recheck passes, a retried webhook)
  // must NOT slide the same money onto the NEXT unpaid EMI. That drift is what made a single EMI-1
  // debit show up as "2 EMIs paid". Report the presented EMI's current state and stop.
  const priorChargeRow = await executeQuery(
    `SELECT id FROM loan_payments WHERE transaction_id = ? AND loan_id = ? LIMIT 1`,
    [paymentId, loanApplicationId]
  );
  if (priorChargeRow && priorChargeRow.length > 0) {
    const priorFullyPaid = await resolvePriorChargeEmiFullyPaid({
      loanApplicationId,
      paymentId,
      targetEmiNumber,
      schedule,
      findEmiIndexByNumber
    });
    return { updated: false, reason: 'already_applied', emiFullyPaid: priorFullyPaid };
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  let targetIndex = -1;

  if (targetEmiNumber > 0) {
    // Bind strictly to the EMI that was presented — never let the charge drift to another EMI.
    targetIndex = findEmiIndexByNumber(targetEmiNumber);
    if (targetIndex === -1) {
      return { updated: false, reason: 'target_emi_not_found', emiFullyPaid: false };
    }
    if (String(schedule[targetIndex].status || '').toLowerCase() === 'paid') {
      // Presented EMI already cleared (e.g. a manual payment landed first) — do nothing rather than
      // push this charge onto a later EMI.
      return { updated: false, reason: 'target_emi_already_paid', emiFullyPaid: true };
    }
  } else {
    // Legacy runs with no stored emi_number: fall back to the first unpaid due EMI.
    for (let i = 0; i < schedule.length; i++) {
      const emi = schedule[i];
      const status = String(emi.status || '').toLowerCase();
      const dueDate = String(emi.due_date || emi.dueDate || '').split('T')[0].split(' ')[0];
      if (status !== 'paid' && dueDate <= todayStr) {
        targetIndex = i;
        break;
      }
    }
    if (targetIndex === -1) {
      return { updated: false, reason: 'no_unpaid_due_emi' };
    }
  }

  const targetEmi = schedule[targetIndex];
  const chargeAmount = Number(amount) || 0;
  const prevPaid = Number(targetEmi.paid_amount || 0) || 0;
  const newPaid = Math.round((prevPaid + chargeAmount) * 100) / 100;

  // Decide "fully paid" against the borrower's PRESENTATION-DATE obligation, not the (now grown)
  // live due — settlement lag accrual is the system's, not the borrower's. A successful charge that
  // covered the presentation due clears the EMI even after a 4–5 day lag (only the in-transit accrual
  // is waived). If presentationDue is unknown (e.g. an old run), fall back to the strict live-due
  // check so a genuinely short charge is never silently treated as full.
  const liveDue = Number(targetEmi.emi_amount || targetEmi.instalment_amount || 0) || 0;
  const obligation = Number(presentationDue) > 0 ? Number(presentationDue) : liveDue;
  const EPSILON = 0.5; // rounding tolerance only
  const emiFullyPaid = obligation <= 0 || chargeAmount >= obligation - EPSILON;

  schedule[targetIndex] = {
    ...targetEmi,
    paid_amount: newPaid,
    status: emiFullyPaid ? 'paid' : 'pending',
    // Penalty is NOT frozen — paid_date is the actual settlement date so accrual is honest if a
    // later (separate) charge is ever needed. Only stamp paid_date once the EMI is fully cleared.
    paid_date: emiFullyPaid ? (targetEmi.paid_date || todayStr) : (targetEmi.paid_date || null)
  };
  const emiNumber = targetEmiNumber > 0 ? targetEmiNumber : (targetIndex + 1);

  await executeQuery(
    `UPDATE loan_applications
     SET emi_schedule = ?, updated_at = NOW()
     WHERE id = ?`,
    [JSON.stringify(schedule), loanApplicationId]
  );

  const existingPayment = await executeQuery(
    `SELECT id FROM loan_payments WHERE transaction_id = ? AND loan_id = ? LIMIT 1`,
    [paymentId, loanApplicationId]
  );
  if (!existingPayment || existingPayment.length === 0) {
    await executeQuery(
      `INSERT INTO loan_payments (loan_id, amount, payment_method, transaction_id, status, payment_date)
       VALUES (?, ?, 'ENACH', ?, 'SUCCESS', NOW())`,
      [loanApplicationId, chargeAmount, paymentId]
    );
  }

  loan.emi_schedule = schedule;

  try {
    const bankReference = await resolveEnachBankReference(paymentId);
    const ledger = await recordEnachLedgerTransaction({
      executeQuery,
      loan,
      paymentId,
      amount: chargeAmount,
      emiNumber,
      bankReference,
      // A successful eNACH charge clears the full presentation-date due, so the ledger type is
      // always a full EMI payment — never misclassified as partial if emi_amount grew meanwhile.
      overrideEmiFullyPaid: emiFullyPaid
    });
    if (ledger.created) {
      console.log(`[eNACH] Ledger transaction created for loan #${loanApplicationId} (${ledger.transactionType})`);
    }
  } catch (ledgerErr) {
    console.error('[eNACH] Failed to create transactions ledger row (non-fatal):', ledgerErr.message);
  }

  const clearance = await evaluateLoanClearanceEligibility({
    executeQuery,
    loan,
    emiSchedule: schedule
  });

  if (clearance.shouldClear) {
    const closedAmount = clearance.amountDue || Number(loan.total_repayable) || 0;
    await executeQuery(
      `UPDATE loan_applications
       SET status = 'cleared', closed_date = CURDATE(), closed_amount = ?, updated_at = NOW()
       WHERE id = ?`,
      [closedAmount, loanApplicationId]
    );
    console.log(
      `[eNACH] Loan #${loanApplicationId} cleared — paid ₹${clearance.totalPaid} / due ₹${clearance.amountDue}`
    );
    try {
      const { runCoolingPeriodCheckAfterLoanClear } = require('../utils/creditLimitCalculator');
      const cooled = await runCoolingPeriodCheckAfterLoanClear(loan.user_id, loanApplicationId);
      if (cooled) {
        console.log(`[eNACH] User ${loan.user_id} moved to cooling period after clearing loan #${loanApplicationId}`);
      }
    } catch (e) {
      console.error('❌ Error checking cooling period after eNACH loan clearance (non-fatal):', e);
    }
  } else if (emiFullyPaid) {
    console.log(
      `[eNACH] EMI #${emiNumber} fully paid for loan #${loanApplicationId}; loan not cleared (${clearance.reason})`
    );
  } else {
    console.log(
      `[eNACH] Partial eNACH ₹${chargeAmount} applied to EMI #${emiNumber} on loan #${loanApplicationId} — EMI still pending`
    );
  }

  return {
    updated: true,
    emiNumber,
    emiFullyPaid,
    loanCleared: clearance.shouldClear,
    clearanceReason: clearance.reason || null,
    totalPaid: clearance.totalPaid,
    amountDue: clearance.amountDue
  };
}

module.exports = {
  chargeSubscription,
  fetchChargeStatus,
  applySuccessfulChargeToLoan
};