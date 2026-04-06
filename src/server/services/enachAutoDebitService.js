const { executeQuery, initializeDatabase } = require('../config/database');
const {
  chargeSubscription,
  fetchChargeStatus,
  applySuccessfulChargeToLoan
} = require('./enachChargeService');

const AUTO_DEBIT_ENABLED = String(process.env.ENACH_AUTO_DEBIT_ENABLED || 'false').toLowerCase() === 'true';
const AUTO_DEBIT_DRY_RUN = String(process.env.ENACH_AUTO_DEBIT_DRY_RUN || 'false').toLowerCase() === 'true';

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

function normalizeDateOnly(value) {
  if (!value) return null;
  return String(value).split('T')[0].split(' ')[0];
}

function getTodayDateStr() {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

function getDueEmiForToday(schedule, todayStr) {
  if (!Array.isArray(schedule) || schedule.length === 0) return null;
  for (let i = 0; i < schedule.length; i++) {
    const emi = schedule[i] || {};
    const status = String(emi.status || '').toLowerCase();
    const dueDate = normalizeDateOnly(emi.due_date || emi.dueDate);
    if (status !== 'paid' && dueDate === todayStr) {
      const amount = Number(emi.instalment_amount || emi.emi_amount || emi.amount || 0);
      return {
        emiNumber: Number(emi.emi_number || emi.instalment_no || i + 1),
        dueDate,
        amount
      };
    }
  }
  return null;
}

async function ensureAutoDebitRunsTable() {
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
      amount DECIMAL(12,2) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
      trigger_source VARCHAR(30) NOT NULL DEFAULT 'CRON',
      request_data JSON DEFAULT NULL,
      response_data JSON DEFAULT NULL,
      last_error TEXT,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_loan_emi_due (loan_application_id, emi_number, due_date),
      KEY idx_status_created_at (status, created_at),
      KEY idx_subscription_payment (subscription_id, payment_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function getEligibleLoansForToday(todayStr) {
  const rows = await executeQuery(
    `SELECT
      la.id AS loan_application_id,
      la.user_id,
      la.application_number,
      la.emi_schedule,
      es.id AS db_subscription_id,
      es.subscription_id,
      es.cf_subscription_id,
      es.status AS subscription_status,
      es.mandate_status
    FROM loan_applications la
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
    const dueEmi = getDueEmiForToday(schedule, todayStr);
    if (!dueEmi) continue;
    if (!Number.isFinite(dueEmi.amount) || dueEmi.amount <= 0) continue;
    result.push({
      ...row,
      dueEmi
    });
  }
  return result;
}

async function createRunIfNotExists(candidate) {
  const insertResult = await executeQuery(
    `INSERT INTO enach_auto_debit_runs
    (loan_application_id, user_id, db_subscription_id, subscription_id, emi_number, due_date, amount, status, trigger_source, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', 'CRON', NOW())
    ON DUPLICATE KEY UPDATE id = id`,
    [
      candidate.loan_application_id,
      candidate.user_id,
      candidate.db_subscription_id,
      candidate.subscription_id || candidate.cf_subscription_id || null,
      candidate.dueEmi.emiNumber,
      candidate.dueEmi.dueDate,
      candidate.dueEmi.amount
    ]
  );

  return Boolean(insertResult && insertResult.insertId);
}

async function updateRunByUnique(candidate, updates) {
  const fields = [];
  const params = [];

  if (updates.status) {
    fields.push('status = ?');
    params.push(updates.status);
  }
  if (updates.subscriptionId !== undefined) {
    fields.push('subscription_id = ?');
    params.push(updates.subscriptionId);
  }
  if (updates.paymentId !== undefined) {
    fields.push('payment_id = ?');
    params.push(updates.paymentId);
  }
  if (updates.requestData !== undefined) {
    fields.push('request_data = ?');
    params.push(JSON.stringify(updates.requestData || {}));
  }
  if (updates.responseData !== undefined) {
    fields.push('response_data = ?');
    params.push(JSON.stringify(updates.responseData || {}));
  }
  if (updates.lastError !== undefined) {
    fields.push('last_error = ?');
    params.push(updates.lastError);
  }

  if (fields.length === 0) return;
  fields.push('updated_at = NOW()');

  params.push(candidate.loan_application_id, candidate.dueEmi.emiNumber, candidate.dueEmi.dueDate);

  await executeQuery(
    `UPDATE enach_auto_debit_runs
     SET ${fields.join(', ')}
     WHERE loan_application_id = ? AND emi_number = ? AND due_date = ?`,
    params
  );
}

async function runDueDateAutoDebit() {
  await initializeDatabase();
  await ensureAutoDebitRunsTable();

  if (!AUTO_DEBIT_ENABLED) {
    return { enabled: false, dryRun: AUTO_DEBIT_DRY_RUN, scanned: 0, attempted: 0, success: 0, pending: 0, failed: 0, skipped: 0 };
  }

  const todayStr = getTodayDateStr();
  const candidates = await getEligibleLoansForToday(todayStr);

  let attempted = 0;
  let success = 0;
  let pending = 0;
  let failed = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    const created = await createRunIfNotExists(candidate);
    if (!created) {
      skipped++;
      continue;
    }

    if (AUTO_DEBIT_DRY_RUN) {
      await updateRunByUnique(candidate, {
        status: 'SKIPPED',
        requestData: {
          mode: 'DRY_RUN',
          amount: candidate.dueEmi.amount
        }
      });
      skipped++;
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
    if (!chargeResult.success || chargeStatus === 'FAILED') {
      failed++;
      await updateRunByUnique(candidate, {
        status: 'FAILED',
        subscriptionId: chargeResult.subscriptionId || null,
        paymentId: chargeResult.paymentId || null,
        requestData: { amount: candidate.dueEmi.amount },
        responseData: chargeResult.response || {},
        lastError: chargeResult.error || 'Charge request failed'
      });
      continue;
    }

    if (chargeStatus === 'SUCCESS') {
      await applySuccessfulChargeToLoan({
        loanApplicationId: candidate.loan_application_id,
        paymentId: chargeResult.paymentId,
        amount: candidate.dueEmi.amount
      });
      success++;
      await updateRunByUnique(candidate, {
        status: 'SUCCESS',
        subscriptionId: chargeResult.subscriptionId || null,
        paymentId: chargeResult.paymentId || null,
        requestData: { amount: candidate.dueEmi.amount },
        responseData: chargeResult.response || {}
      });
    } else {
      pending++;
      await updateRunByUnique(candidate, {
        status: 'PENDING',
        subscriptionId: chargeResult.subscriptionId || null,
        paymentId: chargeResult.paymentId || null,
        requestData: { amount: candidate.dueEmi.amount },
        responseData: chargeResult.response || {}
      });
    }
  }

  return {
    enabled: true,
    dryRun: AUTO_DEBIT_DRY_RUN,
    scanned: candidates.length,
    attempted,
    success,
    pending,
    failed,
    skipped
  };
}

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
    scanned: pendingRuns.length,
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
