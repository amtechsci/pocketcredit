const { executeQuery, initializeDatabase } = require('../config/database');
const {
  chargeSubscription,
  fetchChargeStatus,
  applySuccessfulChargeToLoan
} = require('./enachChargeService');

const AUTO_DEBIT_ENABLED = String(process.env.ENACH_AUTO_DEBIT_ENABLED || 'false').toLowerCase() === 'true';
const AUTO_DEBIT_DRY_RUN = String(process.env.ENACH_AUTO_DEBIT_DRY_RUN || 'false').toLowerCase() === 'true';

// After any non-SKIPPED presentation attempt, do not re-present the same EMI for this many days
const COOLDOWN_DAYS = 3;

// ─── Date helpers ────────────────────────────────────────────────────────────

/**
 * Returns the current date in IST (Asia/Kolkata, UTC+5:30) as 'YYYY-MM-DD'.
 * Using explicit offset avoids relying on system TZ which can be UTC in containers.
 */
function getTodayISTDateStr() {
  const now = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000; // UTC+5:30
  const istDate = new Date(now.getTime() + istOffsetMs);
  return istDate.toISOString().slice(0, 10);
}

function normalizeDateOnly(value) {
  if (!value) return null;
  return String(value).split('T')[0].split(' ')[0];
}

// ─── Schedule / EMI helpers ───────────────────────────────────────────────────

function parseSchedule(emiSchedule) {
  if (!emiSchedule) return [];
  if (Array.isArray(emiSchedule)) return emiSchedule;
  try {
    const parsed = JSON.parse(emiSchedule);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

/**
 * Walks the EMI schedule and returns the FIRST unpaid EMI whose due date is
 * strictly before todayStr (i.e. DPD ≥ 1).  Only EMI 1 is returned even when
 * multiple EMIs are overdue — caller must clear EMI 1 before EMI 2 is surfaced.
 */
function getFirstOverdueEmi(schedule, todayStr) {
  if (!Array.isArray(schedule) || schedule.length === 0) return null;

  for (let i = 0; i < schedule.length; i++) {
    const emi = schedule[i] || {};
    const status = String(emi.status || '').toLowerCase();
    if (status === 'paid') continue;

    const dueDate = normalizeDateOnly(emi.due_date || emi.dueDate);
    if (!dueDate) continue;

    // DPD >= 1 ↔ due_date is strictly before today
    if (dueDate < todayStr) {
      // Full EMI due = the penalty-inclusive "Total" shown on the repayment page.
      // loanCalculations.js persists that in `emi_amount` (base EMI + penalty_total + DPD interest
      // + GST), while `instalment_amount` is DELIBERATELY kept as the penalty-FREE base EMI so it
      // stays stable (see loanCalculations.js ~1097-1128). eNACH must collect the full outstanding,
      // so read `emi_amount` first and only fall back to the base instalment when it is absent.
      // (Reading instalment_amount first was the bug: it charged base-only, e.g. ₹3,588.6 instead
      // of the ₹4,198.68 total, which then got recorded as a part_payment.)
      const fullDue = Number(emi.emi_amount || emi.instalment_amount || emi.amount || 0);
      // Subtract any amount already partially paid so we charge only what is still outstanding.
      // paid_amount is set in the stored emi_schedule by applyPaymentToEmi when a partial payment
      // is recorded. Charging the full amount would over-collect from the user.
      const alreadyPaid = Number(emi.paid_amount || 0);
      const remaining = Math.max(0, Math.round((fullDue - alreadyPaid) * 100) / 100);
      const baseAmount = remaining > 0 ? remaining : fullDue;

      return {
        emiNumber: Number(emi.emi_number || emi.instalment_no || i + 1),
        dueDate,
        baseAmount,
        // principal is used for penalty calc; fall back to fullDue if absent
        emiPrincipal: Number(emi.principal || emi.instalment_amount || emi.emi_amount || emi.amount || 0)
      };
    }
  }
  return null;
}

/**
 * Returns the amount to present for this EMI.
 *
 * `overdueEmi.baseAmount` already holds the full outstanding for the EMI — the penalty-inclusive
 * `emi_amount` (base EMI + penalty_total + DPD interest + GST) minus any `paid_amount` — as read by
 * `getFirstOverdueEmi`. `getEligibleLoansForToday` refreshes penalties via the loan-calculation
 * recompute first, so `emi_amount` is current (not stale) at charge time and matches the repayment
 * page "Total". We must NOT add another tier-penalty on top — that would double-count.
 *
 * `penalty` is always 0: the components are baked into emi_amount, not stored separately, so we
 * cannot (and must not) re-derive them here.
 */
function computePresentationAmount(overdueEmi) {
  const total = Math.round(overdueEmi.baseAmount * 100) / 100;
  return { total, penalty: 0 };
}

/**
 * Adds `days` to a 'YYYY-MM-DD' string and returns a 'YYYY-MM-DD' string (UTC-safe).
 */
function addDaysToDateStr(dateStr, days) {
  const d = new Date(`${String(dateStr).split('T')[0].split(' ')[0]}T00:00:00Z`);
  if (isNaN(d)) return dateStr;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Extracts an EMI's full penalty-inclusive due from a computeLoanCalculationResponseData() result.
 * In the in-memory calc response, `instalment_amount` on each repayment.schedule row is the full
 * due (base EMI + penalty_total + DPD interest), unlike the persisted schedule where that field is
 * the stable base.
 */
function emiFullDueFromCalcData(calcData, emiNumber) {
  const schedule = calcData && calcData.repayment && Array.isArray(calcData.repayment.schedule)
    ? calcData.repayment.schedule
    : [];
  const entry = schedule.find(
    (e) => Number(e.emi_number || e.instalment_no) === Number(emiNumber)
  );
  return entry ? Number(entry.instalment_amount || 0) : null;
}

// ─── DB schema setup & migration ─────────────────────────────────────────────

async function ensureAutoDebitRunsTable() {
  // Create table for new installations (includes presentation_date + penalty_amount)
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS enach_auto_debit_runs (
      id BIGINT NOT NULL AUTO_INCREMENT,
      loan_application_id INT NOT NULL,
      user_id INT NOT NULL,
      db_subscription_id INT NOT NULL,
      subscription_id VARCHAR(100) DEFAULT NULL,
      payment_id VARCHAR(150) DEFAULT NULL,
      emi_number INT NOT NULL,
      due_date DATE NOT NULL,
      presentation_date DATE NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      penalty_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
      trigger_source VARCHAR(30) NOT NULL DEFAULT 'CRON',
      request_data JSON DEFAULT NULL,
      response_data JSON DEFAULT NULL,
      last_error TEXT,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_loan_emi_presentation (loan_application_id, emi_number, presentation_date),
      KEY idx_status_created_at (status, created_at),
      KEY idx_subscription_payment (subscription_id, payment_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // ── Additive migrations for existing tables ──────────────────────────────
  // All checks use information_schema so we never run an ALTER that will fail
  // (avoids noisy "Duplicate column" / "Can't DROP" errors in the query log).

  const colRows = await executeQuery(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'enach_auto_debit_runs'
       AND COLUMN_NAME IN ('presentation_date', 'penalty_amount')`
  );
  const existingCols = new Set((colRows || []).map((r) => r.COLUMN_NAME));

  if (!existingCols.has('presentation_date')) {
    await executeQuery(`
      ALTER TABLE enach_auto_debit_runs
      ADD COLUMN presentation_date DATE NOT NULL DEFAULT '2000-01-01'
    `);
    console.log('[eNACH] Migration: added presentation_date column');
  }

  if (!existingCols.has('penalty_amount')) {
    await executeQuery(`
      ALTER TABLE enach_auto_debit_runs
      ADD COLUMN penalty_amount DECIMAL(12,2) NOT NULL DEFAULT 0
    `);
    console.log('[eNACH] Migration: added penalty_amount column');
  }

  const idxRows = await executeQuery(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'enach_auto_debit_runs'
       AND INDEX_NAME IN ('uq_loan_emi_due', 'uq_loan_emi_presentation')
     GROUP BY INDEX_NAME`
  );
  const existingIdx = new Set((idxRows || []).map((r) => r.INDEX_NAME));

  if (existingIdx.has('uq_loan_emi_due')) {
    await executeQuery(`ALTER TABLE enach_auto_debit_runs DROP INDEX uq_loan_emi_due`);
    console.log('[eNACH] Migration: dropped old uq_loan_emi_due index');
  }

  if (!existingIdx.has('uq_loan_emi_presentation')) {
    await executeQuery(`
      ALTER TABLE enach_auto_debit_runs
      ADD UNIQUE KEY uq_loan_emi_presentation (loan_application_id, emi_number, presentation_date)
    `);
    console.log('[eNACH] Migration: added uq_loan_emi_presentation index');
  }
}

// ─── Candidate selection ──────────────────────────────────────────────────────

async function getEligibleLoansForToday(todayStr) {
  const rows = await executeQuery(
    `SELECT
      la.id AS loan_application_id,
      la.user_id,
      la.application_number,
      la.emi_schedule,
      la.plan_snapshot,
      la.late_fee_structure,
      la.loan_plan_id,
      u.salary_date,
      es.id AS db_subscription_id,
      es.subscription_id,
      es.cf_subscription_id,
      es.status AS subscription_status,
      es.mandate_status
    FROM loan_applications la
    JOIN users u ON u.id = la.user_id
    JOIN enach_subscriptions es ON es.loan_application_id = la.id
    JOIN (
      SELECT loan_application_id, MAX(id) AS max_id
      FROM enach_subscriptions
      GROUP BY loan_application_id
    ) latest ON latest.max_id = es.id
    WHERE la.status = 'account_manager'
      AND la.emi_schedule IS NOT NULL
      AND (
        es.status IN ('ACTIVE', 'AUTHENTICATED')
        OR es.mandate_status IN ('APPROVED', 'ACTIVE')
      )`
  );

  const result = [];

  for (const row of rows || []) {
    let schedule = parseSchedule(row.emi_schedule);

    // Cheap pre-filter: only loans that already have an unpaid overdue EMI are candidates.
    // (Penalty/DPD amounts on the stored schedule may be stale here — penalty is only baked into
    //  emi_amount when getLoanCalculation runs — so we refresh below before computing the charge.)
    if (!getFirstOverdueEmi(schedule, todayStr)) continue;

    // Refresh penalty + DPD interest so we present the FULL current outstanding (base + penalty +
    // DPD interest + GST) — the same "Total" shown on the repayment page — rather than a stale or
    // base-only amount. computeLoanCalculationResponseData recomputes and PERSISTS the penalty-
    // inclusive emi_amount (while preserving paid_amount) back into loan_applications.emi_schedule.
    // Without this, an EMI presented before any repayment-page load is charged at the base EMI only
    // and later shows up as a part_payment once the penalty is finally materialised.
    try {
      const { computeLoanCalculationResponseData } = require('../routes/loanCalculations');
      await computeLoanCalculationResponseData(row.loan_application_id);
      const refreshed = await executeQuery(
        `SELECT emi_schedule FROM loan_applications WHERE id = ? LIMIT 1`,
        [row.loan_application_id]
      );
      if (refreshed && refreshed[0] && refreshed[0].emi_schedule) {
        schedule = parseSchedule(refreshed[0].emi_schedule);
      }
    } catch (refreshErr) {
      console.error(
        `[eNACH] Penalty refresh failed for loan ${row.loan_application_id} — falling back to stored amounts: ${refreshErr.message}`
      );
    }

    // Find the first unpaid EMI with DPD >= 1 (now using the refreshed, penalty-inclusive schedule)
    const overdueEmi = getFirstOverdueEmi(schedule, todayStr);
    if (!overdueEmi) continue;
    if (!Number.isFinite(overdueEmi.baseAmount) || overdueEmi.baseAmount <= 0) continue;

    // Calculate DPD (days since EMI due date, using IST calendar dates)
    const daysOverdue = Math.ceil(
      (new Date(todayStr).getTime() - new Date(overdueEmi.dueDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Today's full penalty-inclusive due for this EMI (just refreshed/persisted above).
    const todayEmiEntry = (Array.isArray(schedule) ? schedule : []).find(
      (e) => Number(e.emi_number || e.instalment_no) === Number(overdueEmi.emiNumber)
    );
    const todayFullDue = todayEmiEntry
      ? Number(todayEmiEntry.emi_amount || todayEmiEntry.instalment_amount || 0)
      : overdueEmi.baseAmount;

    // One-day settlement buffer: eNACH settles 1–2 days after presentation while penalty/DPD keeps
    // accruing. We present TODAY's outstanding + ONE day of accrual so the debited amount still covers
    // the EMI when the charge settles. The buffer is the same engine's "as of tomorrow" due minus
    // today's due (persist:false so this forward-dated what-if never touches the stored schedule).
    let oneDayAccrual = 0;
    try {
      const { computeLoanCalculationResponseData } = require('../routes/loanCalculations');
      const tomorrowStr = addDaysToDateStr(todayStr, 1);
      const tomorrowData = await computeLoanCalculationResponseData(row.loan_application_id, {
        recalcAsOfDate: tomorrowStr,
        persist: false
      });
      const tomorrowFullDue = emiFullDueFromCalcData(tomorrowData, overdueEmi.emiNumber);
      if (Number.isFinite(tomorrowFullDue) && Number.isFinite(todayFullDue) && tomorrowFullDue > todayFullDue) {
        oneDayAccrual = Math.round((tomorrowFullDue - todayFullDue) * 100) / 100;
      }
    } catch (bufferErr) {
      console.error(
        `[eNACH] One-day buffer calc failed for loan ${row.loan_application_id} — presenting today's due only: ${bufferErr.message}`
      );
    }

    // Amount = today's remaining outstanding (see computePresentationAmount) + one-day buffer.
    const { total: baseToday, penalty } = computePresentationAmount(overdueEmi);
    const presentationAmount = Math.round((baseToday + oneDayAccrual) * 100) / 100;

    result.push({
      ...row,
      dueEmi: {
        ...overdueEmi,
        amount: presentationAmount,
        penaltyAmount: penalty,
        // One day of penalty + DPD accrual, carried so the success-side check can accept the EMI as
        // fully paid when the live due has grown by up to a day during the settlement window.
        dailyAccrual: oneDayAccrual,
        daysOverdue
      }
    });
  }

  return result;
}

// ─── Run management (per-day idempotency) ────────────────────────────────────

/**
 * Ensures we don't over-present the same EMI:
 *  1. Any SUCCESS run (any date) → skip; EMI is already paid via NACH.
 *  2. Any non-SKIPPED run within the last COOLDOWN_DAYS → skip; 3-day cooldown.
 *  3. Today's run already exists (PENDING/SUCCESS) → skip; in-flight or done.
 *  4. Otherwise insert a fresh PENDING row for today and return its id.
 *
 * Returns { skip: true, reason, lastRunDate? } or { skip: false, runId }.
 */
async function getOrCreatePresentationRun(candidate, presentationDateStr) {
  // 1. Already paid via NACH on any previous day?
  const successRuns = await executeQuery(
    `SELECT id FROM enach_auto_debit_runs
     WHERE loan_application_id = ? AND emi_number = ? AND status = 'SUCCESS'
     LIMIT 1`,
    [candidate.loan_application_id, candidate.dueEmi.emiNumber]
  );
  if (successRuns && successRuns.length > 0) {
    return { skip: true, reason: 'already_paid' };
  }

  // 2. 3-day cooldown — was this EMI presented (non-SKIPPED) within the last COOLDOWN_DAYS?
  const recentRuns = await executeQuery(
    `SELECT id, status, presentation_date
     FROM enach_auto_debit_runs
     WHERE loan_application_id = ? AND emi_number = ?
       AND status NOT IN ('SKIPPED')
       AND presentation_date >= DATE_SUB(?, INTERVAL ? DAY)
     ORDER BY presentation_date DESC
     LIMIT 1`,
    [candidate.loan_application_id, candidate.dueEmi.emiNumber, presentationDateStr, COOLDOWN_DAYS]
  );
  if (recentRuns && recentRuns.length > 0) {
    const last = recentRuns[0];
    // Allow if the only recent run is today itself (handled in step 3 below)
    if (last.presentation_date !== presentationDateStr) {
      return { skip: true, reason: `cooldown_${COOLDOWN_DAYS}d`, lastRunDate: last.presentation_date };
    }
  }

  // 3. Already presented today?
  const todayRuns = await executeQuery(
    `SELECT id, status FROM enach_auto_debit_runs
     WHERE loan_application_id = ? AND emi_number = ? AND presentation_date = ?
     LIMIT 1`,
    [candidate.loan_application_id, candidate.dueEmi.emiNumber, presentationDateStr]
  );
  if (todayRuns && todayRuns.length > 0) {
    const existing = todayRuns[0];
    return { skip: true, reason: `already_${existing.status.toLowerCase()}_today` };
  }

  // 4. Insert a new run for today.
  // request_data carries daily_accrual so the (later) pending-recheck can apply the same one-day
  // tolerance when crediting the settled charge against the by-then-grown live due.
  const requestData = JSON.stringify({
    daily_accrual: candidate.dueEmi.dailyAccrual || 0,
    days_overdue: candidate.dueEmi.daysOverdue || 0
  });
  const insertResult = await executeQuery(
    `INSERT INTO enach_auto_debit_runs
     (loan_application_id, user_id, db_subscription_id, subscription_id,
      emi_number, due_date, presentation_date, amount, penalty_amount,
      status, trigger_source, request_data, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 'CRON', ?, NOW())`,
    [
      candidate.loan_application_id,
      candidate.user_id,
      candidate.db_subscription_id,
      candidate.subscription_id || candidate.cf_subscription_id || null,
      candidate.dueEmi.emiNumber,
      candidate.dueEmi.dueDate,
      presentationDateStr,
      candidate.dueEmi.amount,
      candidate.dueEmi.penaltyAmount || 0,
      requestData
    ]
  );

  return { skip: false, runId: insertResult.insertId };
}

async function updateRunById(runId, updates) {
  const fields = [];
  const params = [];

  if (updates.status) { fields.push('status = ?'); params.push(updates.status); }
  if (updates.subscriptionId !== undefined) { fields.push('subscription_id = ?'); params.push(updates.subscriptionId); }
  if (updates.paymentId !== undefined) { fields.push('payment_id = ?'); params.push(updates.paymentId); }
  if (updates.requestData !== undefined) { fields.push('request_data = ?'); params.push(JSON.stringify(updates.requestData || {})); }
  if (updates.responseData !== undefined) { fields.push('response_data = ?'); params.push(JSON.stringify(updates.responseData || {})); }
  if (updates.lastError !== undefined) { fields.push('last_error = ?'); params.push(updates.lastError); }
  if (fields.length === 0) return;

  fields.push('updated_at = NOW()');
  params.push(runId);

  await executeQuery(
    `UPDATE enach_auto_debit_runs SET ${fields.join(', ')} WHERE id = ?`,
    params
  );
}

// ─── Main debit runner ────────────────────────────────────────────────────────

/**
 * Core function called by all cron triggers and admin manual runs.
 *   • Daily at 18:59 IST  (DPD ≥ 1 + salary-date presentations)
 *   • 1st of month at 04:00 IST
 *   • 5th of month at 04:00 IST
 *   • Admin manual trigger (with optional forceDryRun override)
 *
 * Logic:
 *   1. Finds all active loans with an unpaid overdue EMI (DPD ≥ 1).
 *   2. Applies Case 1 / Case 2 naturally: `getFirstOverdueEmi` always returns
 *      the OLDEST unpaid EMI, so EMI 2 is never presented while EMI 1 is pending.
 *   3. Computes full outstanding (base instalment + accrued penalty) for the EMI.
 *   4. Enforces COOLDOWN_DAYS between consecutive presentations of the same EMI.
 *   5. Charges the mandate for the full outstanding amount.
 *
 * @param {object} options
 * @param {boolean} [options.forceDryRun] - When true, overrides env and runs in dry-run mode (no real charges)
 * @param {boolean} [options.forceRun]    - When true, bypasses ENACH_AUTO_DEBIT_ENABLED=false (admin manual trigger)
 */
async function runDueDateAutoDebit({ forceDryRun = false, forceRun = false } = {}) {
  await initializeDatabase();
  await ensureAutoDebitRunsTable();

  const isDryRun = forceDryRun || AUTO_DEBIT_DRY_RUN;

  // Scheduled cron respects the env flag; admin manual trigger (forceRun/forceDryRun) bypasses it
  if (!AUTO_DEBIT_ENABLED && !forceDryRun && !forceRun) {
    return { enabled: false, dryRun: isDryRun, scanned: 0, attempted: 0, success: 0, pending: 0, failed: 0, skipped: 0 };
  }

  const todayStr = getTodayISTDateStr();
  const candidates = await getEligibleLoansForToday(todayStr);

  let attempted = 0;
  let success = 0;
  let pending = 0;
  let failed = 0;
  let skipped = 0;
  const skippedDetails = [];
  const attemptedDetails = [];

  for (const candidate of candidates) {
    const { skip, reason, lastRunDate, runId } = await getOrCreatePresentationRun(candidate, todayStr);

    if (skip) {
      console.log(
        `[eNACH] Skipping loan ${candidate.loan_application_id} EMI ${candidate.dueEmi.emiNumber}: ${reason}${lastRunDate ? ` (last run: ${lastRunDate})` : ''}`
      );
      skipped++;
      skippedDetails.push({ loan_application_id: candidate.loan_application_id, emi_number: candidate.dueEmi.emiNumber, reason, lastRunDate });
      continue;
    }

    if (isDryRun) {
      await updateRunById(runId, {
        status: 'SKIPPED',
        requestData: { mode: 'DRY_RUN', amount: candidate.dueEmi.amount, penalty: candidate.dueEmi.penaltyAmount, dpd: candidate.dueEmi.daysOverdue }
      });
      skipped++;
      skippedDetails.push({ loan_application_id: candidate.loan_application_id, emi_number: candidate.dueEmi.emiNumber, reason: 'dry_run', amount: candidate.dueEmi.amount, dpd: candidate.dueEmi.daysOverdue });
      continue;
    }

    attempted++;

    const chargeResult = await chargeSubscription({
      userId: candidate.user_id,
      dbSubscriptionId: candidate.db_subscription_id,
      amount: candidate.dueEmi.amount,
      source: 'cron'
    });

    const chargeStatus = String(chargeResult.status || '').toUpperCase();
    const detail = {
      loan_application_id: candidate.loan_application_id,
      application_number: candidate.application_number,
      emi_number: candidate.dueEmi.emiNumber,
      due_date: candidate.dueEmi.dueDate,
      dpd: candidate.dueEmi.daysOverdue,
      amount: candidate.dueEmi.amount,
      penalty: candidate.dueEmi.penaltyAmount
    };

    if (!chargeResult.success || chargeStatus === 'FAILED') {
      failed++;
      await updateRunById(runId, {
        status: 'FAILED',
        subscriptionId: chargeResult.subscriptionId || null,
        paymentId: chargeResult.paymentId || null,
        requestData: { amount: candidate.dueEmi.amount, penalty: candidate.dueEmi.penaltyAmount, dpd: candidate.dueEmi.daysOverdue, daily_accrual: candidate.dueEmi.dailyAccrual || 0 },
        responseData: chargeResult.response || {},
        lastError: chargeResult.error || 'Charge request failed'
      });
      attemptedDetails.push({ ...detail, status: 'FAILED', error: chargeResult.error });
      continue;
    }

    if (chargeStatus === 'SUCCESS') {
      await applySuccessfulChargeToLoan({
        loanApplicationId: candidate.loan_application_id,
        paymentId: chargeResult.paymentId,
        amount: candidate.dueEmi.amount,
        // Allow up to one day of accrual shortfall vs the live due (charge carried a one-day buffer)
        dueTolerance: candidate.dueEmi.dailyAccrual || 0
      });
      success++;
      await updateRunById(runId, {
        status: 'SUCCESS',
        subscriptionId: chargeResult.subscriptionId || null,
        paymentId: chargeResult.paymentId || null,
        requestData: { amount: candidate.dueEmi.amount, penalty: candidate.dueEmi.penaltyAmount, dpd: candidate.dueEmi.daysOverdue, daily_accrual: candidate.dueEmi.dailyAccrual || 0 },
        responseData: chargeResult.response || {}
      });
      attemptedDetails.push({ ...detail, status: 'SUCCESS', paymentId: chargeResult.paymentId });
    } else {
      // PENDING — Cashfree accepted but not yet settled; recheck job will follow up
      pending++;
      await updateRunById(runId, {
        status: 'PENDING',
        subscriptionId: chargeResult.subscriptionId || null,
        paymentId: chargeResult.paymentId || null,
        requestData: { amount: candidate.dueEmi.amount, penalty: candidate.dueEmi.penaltyAmount, dpd: candidate.dueEmi.daysOverdue, daily_accrual: candidate.dueEmi.dailyAccrual || 0 },
        responseData: chargeResult.response || {}
      });
      attemptedDetails.push({ ...detail, status: 'PENDING', paymentId: chargeResult.paymentId });
    }
  }

  return {
    enabled: AUTO_DEBIT_ENABLED,
    dryRun: isDryRun,
    presentationDate: todayStr,
    cooldownDays: COOLDOWN_DAYS,
    scanned: candidates.length,
    attempted,
    success,
    pending,
    failed,
    skipped,
    attempts: attemptedDetails,
    skippedDetails
  };
}

// ─── Pending-charge recheck ───────────────────────────────────────────────────

async function recheckPendingAutoDebitCharges({ forceRun = false } = {}) {
  await initializeDatabase();
  await ensureAutoDebitRunsTable();

  if ((!AUTO_DEBIT_ENABLED || AUTO_DEBIT_DRY_RUN) && !forceRun) {
    return { enabled: AUTO_DEBIT_ENABLED, dryRun: AUTO_DEBIT_DRY_RUN, scanned: 0, success: 0, failed: 0, stillPending: 0 };
  }

  const pendingRuns = await executeQuery(
    `SELECT *
     FROM enach_auto_debit_runs
     WHERE status = 'PENDING'
     ORDER BY created_at ASC
     LIMIT 100`
  );

  let success = 0;
  let failed = 0;
  let stillPending = 0;

  for (const run of pendingRuns || []) {
    if (!run.subscription_id || !run.payment_id) {
      await executeQuery(
        `UPDATE enach_auto_debit_runs
         SET status = 'FAILED', last_error = 'Missing subscription_id/payment_id', updated_at = NOW()
         WHERE id = ?`,
        [run.id]
      );
      failed++;
      continue;
    }

    try {
      const payment = await fetchChargeStatus(run.subscription_id, run.payment_id);
      const paymentStatus = String(payment.payment_status || '').toUpperCase();

      if (paymentStatus === 'SUCCESS') {
        // This charge was presented 1–2 days ago with a one-day buffer; allow the same one-day
        // accrual tolerance now that the live due may have grown during the settlement window.
        let runDailyAccrual = 0;
        try {
          const rd = run.request_data
            ? (typeof run.request_data === 'string' ? JSON.parse(run.request_data) : run.request_data)
            : null;
          runDailyAccrual = Number(rd && rd.daily_accrual) || 0;
        } catch (_) { /* no stored accrual → strict coverage */ }

        await applySuccessfulChargeToLoan({
          loanApplicationId: run.loan_application_id,
          paymentId: run.payment_id,
          amount: run.amount,
          dueTolerance: runDailyAccrual
        });
        await executeQuery(
          `UPDATE enach_auto_debit_runs
           SET status = 'SUCCESS', response_data = ?, last_error = NULL, updated_at = NOW()
           WHERE id = ?`,
          [JSON.stringify(payment), run.id]
        );
        success++;
      } else if (paymentStatus === 'FAILED') {
        await executeQuery(
          `UPDATE enach_auto_debit_runs
           SET status = 'FAILED', response_data = ?, last_error = ?, updated_at = NOW()
           WHERE id = ?`,
          [JSON.stringify(payment), payment.payment_message || 'Charge failed', run.id]
        );
        failed++;
      } else {
        await executeQuery(
          `UPDATE enach_auto_debit_runs
           SET response_data = ?, updated_at = NOW()
           WHERE id = ?`,
          [JSON.stringify(payment), run.id]
        );
        stillPending++;
      }
    } catch (error) {
      await executeQuery(
        `UPDATE enach_auto_debit_runs
         SET last_error = ?, updated_at = NOW()
         WHERE id = ?`,
        [error.message, run.id]
      );
      stillPending++;
    }
  }

  return {
    enabled: true,
    dryRun: false,
    scanned: (pendingRuns || []).length,
    success,
    failed,
    stillPending
  };
}

module.exports = {
  runDueDateAutoDebit,
  recheckPendingAutoDebitCharges,
  ensureAutoDebitRunsTable
};
