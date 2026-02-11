/**
 * Job queue service - database-backed queue for background work.
 * Use for bulk SMS (e.g. account manager assigned) so the request returns immediately.
 */

const { executeQuery, initializeDatabase } = require('../config/database');

const JOB_TYPE_ACC_MANAGER_SMS = 'acc_manager_assigned_sms';
const DEFAULT_BATCH_SIZE = 50;
const MAX_ATTEMPTS = 3;

/**
 * Enqueue a single job.
 * @param {string} type - Job type (e.g. acc_manager_assigned_sms)
 * @param {object} payload - JSON-serializable payload
 * @returns {Promise<number>} Insert id (or null if table missing)
 */
async function enqueue(type, payload) {
  try {
    await initializeDatabase();
    const payloadJson = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const result = await executeQuery(
      `INSERT INTO job_queue (type, payload, status, max_attempts) VALUES (?, ?, 'pending', ?)`,
      [type, payloadJson, MAX_ATTEMPTS]
    );
    return result && result.insertId ? result.insertId : null;
  } catch (err) {
    if (err.errno === 1146) {
      // Table doesn't exist - migration not run
      console.warn('job_queue table missing; run migration 006_job_queue.sql. Skipping enqueue.');
      return null;
    }
    console.error('job_queue enqueue error:', err.message);
    throw err;
  }
}

/**
 * Enqueue multiple jobs in one insert (efficient for bulk).
 * @param {string} type - Job type
 * @param {Array<object>} payloads - Array of payloads
 * @returns {Promise<number>} Number of rows inserted (or 0 if table missing)
 */
async function enqueueMany(type, payloads) {
  if (!payloads || payloads.length === 0) return 0;
  try {
    await initializeDatabase();
    const values = payloads.map(p => {
      const payloadJson = typeof p === 'string' ? p : JSON.stringify(p);
      return [type, payloadJson, 'pending', MAX_ATTEMPTS];
    });
    const placeholders = values.map(() => '(?, ?, ?, ?)').join(',');
    const flat = values.flat();
    const sql = `INSERT INTO job_queue (type, payload, status, max_attempts) VALUES ${placeholders}`;
    const result = await executeQuery(sql, flat);
    return result && result.affectedRows ? result.affectedRows : 0;
  } catch (err) {
    if (err.errno === 1146) {
      console.warn('job_queue table missing; run migration 006_job_queue.sql. Skipping enqueueMany.');
      return 0;
    }
    console.error('job_queue enqueueMany error:', err.message);
    throw err;
  }
}

/**
 * Fetch next pending jobs and mark them as processing.
 * @param {string} type - Job type
 * @param {number} limit - Max jobs to take
 * @returns {Promise<Array<{id: number, payload: object}>>}
 */
async function claimPending(type, limit = DEFAULT_BATCH_SIZE) {
  await initializeDatabase();
  // MySQL has issues with placeholders in LIMIT; inline validated integer instead.
  const limitInt = Number.isFinite(Number(limit)) ? Math.max(1, Number(limit)) : DEFAULT_BATCH_SIZE;
  const rows = await executeQuery(
    `SELECT id, payload FROM job_queue
     WHERE type = ? AND status = 'pending' AND attempts < max_attempts
     ORDER BY id ASC LIMIT ${limitInt}`,
    [type]
  );
  if (!rows || rows.length === 0) return [];
  const ids = rows.map(r => r.id);
  const placeholders = ids.map(() => '?').join(',');
  await executeQuery(
    `UPDATE job_queue SET status = 'processing', attempts = attempts + 1 WHERE id IN (${placeholders})`,
    ids
  );
  return rows.map(r => ({
    id: r.id,
    payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload
  }));
}

/**
 * Mark a job as done or failed.
 */
async function markDone(jobId) {
  await executeQuery(
    `UPDATE job_queue SET status = 'done', processed_at = NOW() WHERE id = ?`,
    [jobId]
  );
}

async function markFailed(jobId, errorMessage) {
  await executeQuery(
    `UPDATE job_queue SET status = 'failed', processed_at = NOW(), error_message = ? WHERE id = ?`,
    [errorMessage ? String(errorMessage).slice(0, 2000) : null, jobId]
  );
}

/**
 * Process one batch of acc_manager_assigned_sms jobs.
 * Calls the actual SMS sender for each job; used by the cron worker.
 * @returns {Promise<{ processed: number, failed: number }>}
 */
async function processAccManagerAssignedSmsBatch() {
  const jobs = await claimPending(JOB_TYPE_ACC_MANAGER_SMS, DEFAULT_BATCH_SIZE);
  if (jobs.length === 0) return { processed: 0, failed: 0 };

  const { sendAccountManagerAssignedSms } = require('./adminAssignmentService');
  let processed = 0;
  let failed = 0;

  for (const job of jobs) {
    const { userId, loanId, adminId } = job.payload || {};
    try {
      await sendAccountManagerAssignedSms(userId, loanId, adminId);
      await markDone(job.id);
      processed++;
    } catch (err) {
      console.error(`job_queue acc_manager_sms job ${job.id} error:`, err.message);
      await markFailed(job.id, err.message);
      failed++;
    }
  }

  return { processed, failed };
}

module.exports = {
  enqueue,
  enqueueMany,
  claimPending,
  markDone,
  markFailed,
  processAccManagerAssignedSmsBatch,
  JOB_TYPE_ACC_MANAGER_SMS,
  DEFAULT_BATCH_SIZE
};
