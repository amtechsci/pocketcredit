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

function parsePlanSnapshot(planSnapshot) {
  if (!planSnapshot) return null;
  if (typeof planSnapshot === 'object') return planSnapshot;
  try {
    return JSON.parse(planSnapshot);
  } catch (e) {
    return null;
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
      return {
        emiNumber: Number(emi.emi_number || emi.instalment_no || i + 1),
        dueDate,
        baseAmount: Number(emi.instalment_amount || emi.emi_amount || emi.amount || 0),
        // principal is used for penalty calc; fall back to baseAmount if absent
        emiPrincipal: Number(emi.principal || emi.instalment_amount || emi.emi_amount || emi.amount || 0)
      };
    }
  }
  return null;
}

// ─── Penalty calculation ──────────────────────────────────────────────────────

/**
 * Replicates the same tier-based penalty logic used in loanCalculations.js.
 * Returns the total penalty amount (base + GST) for daysOverdue days past due.
 *
 * @param {number} emiPrincipal  - principal portion of the EMI
 * @param {number} daysOverdue   - how many days past the due date
 * @param {Array}  lateFeeStructure - array of tier objects from plan_snapshot
 */
function computeEmiPenalty(emiPrincipal, daysOverdue, lateFeeStructure) {
  if (
    !daysOverdue || daysOverdue <= 0 ||
    !Array.isArray(lateFeeStructure) || lateFeeStructure.length === 0 ||
    !emiPrincipal || emiPrincipal <= 0
  ) {
    return 0;
  }

  const sortedTiers = [...lateFeeStructure].sort((a, b) => {
    const oA = a.tier_order !== undefined ? a.tier_order : (a.days_overdue_start || 0);
    const oB = b.tier_order !== undefined ? b.tier_order : (b.days_overdue_start || 0);
    return oA - oB;
  });

  let penaltyBase = 0;

  for (const tier of sortedTiers) {
    const startDay = tier.days_overdue_start || 0;
    const endDay = (tier.days_overdue_end !== null && tier.days_overdue_end !== undefined)
      ? tier.days_overdue_end : null;

    if (daysOverdue < startDay) continue;

    const feeValue = parseFloat(tier.fee_value || tier.penalty_percent || 0);
    if (feeValue <= 0) continue;

    let tierPenalty = 0;

    if (startDay === endDay || (startDay === 1 && endDay === 1)) {
      // One-time flat penalty on day startDay
      tierPenalty = emiPrincipal * (feeValue / 100);
    } else if (endDay === null) {
      // Open-ended tier: accrues every day from startDay
      const daysInTier = daysOverdue - startDay + 1;
      tierPenalty = emiPrincipal * (feeValue / 100) * daysInTier;
    } else {
      // Bounded tier
      const tierEndDay = Math.min(endDay, daysOverdue);
      const daysInTier = Math.max(0, tierEndDay - startDay + 1);
      tierPenalty = emiPrincipal * (feeValue / 100) * daysInTier;
    }

    penaltyBase += tierPenalty;
  }

  const gstPercent = lateFeeStructure[0]?.gst_percent || 18;
  const penaltyGST = penaltyBase * (gstPercent / 100);
  return Math.round((penaltyBase + penaltyGST) * 100) / 100;
}

/**
 * Returns the full outstanding amount to present for this EMI:
 *   base instalment amount  +  accrued penalty (based on DPD and late_fee_structure)
 */
function computePresentationAmount(overdueEmi, daysOverdue, lateFeeStructure) {
  const penalty = computeEmiPenalty(overdueEmi.emiPrincipal, daysOverdue, lateFeeStructure);
  const total = Math.round((overdueEmi.baseAmount + penalty) * 100) / 100;
  return { total, penalty };
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
    const schedule = parseSchedule(row.emi_schedule);

    // Find the first unpaid EMI with DPD >= 1
    const overdueEmi = getFirstOverdueEmi(schedule, todayStr);
    if (!overdueEmi) continue;
    if (!Number.isFinite(overdueEmi.baseAmount) || overdueEmi.baseAmount <= 0) continue;

    // Resolve late_fee_structure: prefer loan column, then plan_snapshot
    let lateFeeStructure = null;
    try {
      if (row.late_fee_structure) {
        lateFeeStructure = typeof row.late_fee_structure === 'string'
          ? JSON.parse(row.late_fee_structure)
          : row.late_fee_structure;
      } else {
        const snapshot = parsePlanSnapshot(row.plan_snapshot);
        if (snapshot && snapshot.late_fee_structure) {
          lateFeeStructure = typeof snapshot.late_fee_structure === 'string'
            ? JSON.parse(snapshot.late_fee_structure)
            : snapshot.late_fee_structure;
        }
      }
    } catch (_) {
      lateFeeStructure = null;
    }

    // Calculate DPD (days since EMI due date, using IST calendar dates)
    const daysOverdue = Math.ceil(
      (new Date(todayStr).getTime() - new Date(overdueEmi.dueDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Full outstanding = base instalment + accrued penalty
    const { total: presentationAmount, penalty } = computePresentationAmount(
      overdueEmi, daysOverdue, lateFeeStructure
    );

    result.push({
      ...row,
      dueEmi: {
        ...overdueEmi,
        amount: presentationAmount,
        penaltyAmount: penalty,
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

  // 4. Insert a new run for today
  const insertResult = await executeQuery(
    `INSERT INTO enach_auto_debit_runs
     (loan_application_id, user_id, db_subscription_id, subscription_id,
      emi_number, due_date, presentation_date, amount, penalty_amount,
      status, trigger_source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 'CRON', NOW())`,
    [
      candidate.loan_application_id,
      candidate.user_id,
      candidate.db_subscription_id,
      candidate.subscription_id || candidate.cf_subscription_id || null,
      candidate.dueEmi.emiNumber,
      candidate.dueEmi.dueDate,
      presentationDateStr,
      candidate.dueEmi.amount,
      candidate.dueEmi.penaltyAmount || 0
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
 * @param {boolean} [options.forceDryRun] - When true, overrides env and runs in dry-run mode
 */
async function runDueDateAutoDebit({ forceDryRun = false } = {}) {
  await initializeDatabase();
  await ensureAutoDebitRunsTable();

  const isDryRun = forceDryRun || AUTO_DEBIT_DRY_RUN;

  if (!AUTO_DEBIT_ENABLED && !forceDryRun) {
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
        requestData: { amount: candidate.dueEmi.amount, penalty: candidate.dueEmi.penaltyAmount, dpd: candidate.dueEmi.daysOverdue },
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
        amount: candidate.dueEmi.amount
      });
      success++;
      await updateRunById(runId, {
        status: 'SUCCESS',
        subscriptionId: chargeResult.subscriptionId || null,
        paymentId: chargeResult.paymentId || null,
        requestData: { amount: candidate.dueEmi.amount, penalty: candidate.dueEmi.penaltyAmount, dpd: candidate.dueEmi.daysOverdue },
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
        requestData: { amount: candidate.dueEmi.amount, penalty: candidate.dueEmi.penaltyAmount, dpd: candidate.dueEmi.daysOverdue },
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

async function recheckPendingAutoDebitCharges() {
  await initializeDatabase();
  await ensureAutoDebitRunsTable();

  if (!AUTO_DEBIT_ENABLED || AUTO_DEBIT_DRY_RUN) {
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
        await applySuccessfulChargeToLoan({
          loanApplicationId: run.loan_application_id,
          paymentId: run.payment_id,
          amount: run.amount
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
