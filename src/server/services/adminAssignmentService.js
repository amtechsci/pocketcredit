/**
 * Admin assignment service: round-robin and split logic for verify user,
 * account manager, and recovery officer. Redistribution on deactivation.
 */
const { executeQuery, initializeDatabase } = require('../config/database');

let dbInitialized = false;
const ensureDb = async () => {
  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
  }
};

/**
 * Check if an admin is currently temporarily inactive (weekly off or date-range leave).
 *
 * - weekly_off_days: comma-separated 0-6 (0=Sunday .. 6=Saturday).
 * - temp_inactive_from / temp_inactive_to: leave date range (inclusive).
 *
 * Uses the server's local calendar date (no explicit timezone conversion).
 * Also supports open-ended ranges:
 *   - from + NULL to  => on leave from "from" onwards
 *   - NULL from + to  => on leave until "to"
 */
function isAdminTempInactiveToday(row) {
  // Use local server date (YYYY-MM-DD) and day-of-week (0-6)
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun, 6=Sat
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`; // YYYY-MM-DD

  if (row.weekly_off_days) {
    const days = String(row.weekly_off_days)
      .split(',')
      .map(d => parseInt(d.trim(), 10))
      .filter(n => !Number.isNaN(n));
    if (days.includes(dayOfWeek)) return true;
  }

  if (row.temp_inactive_from || row.temp_inactive_to) {
    const from = row.temp_inactive_from ? String(row.temp_inactive_from).slice(0, 10) : null;
    const to = row.temp_inactive_to ? String(row.temp_inactive_to).slice(0, 10) : null;

    if (from && to) {
      if (todayStr >= from && todayStr <= to) return true;
    } else if (from && !to) {
      // Open-ended from date
      if (todayStr >= from) return true;
    } else if (!from && to) {
      // Open-ended to date
      if (todayStr <= to) return true;
    }
  }

  return false;
}

/**
 * Get active sub-admins of a category, ordered by created_at (for round-robin).
 * Excludes admins who are temporarily inactive today (weekly off or on leave date range).
 */
async function getActiveSubAdmins(category) {
  await ensureDb();
  let rows;
  try {
    rows = await executeQuery(
      `SELECT id, created_at, weekly_off_days, temp_inactive_from, temp_inactive_to FROM admins
       WHERE role = 'sub_admin' AND sub_admin_category = ? AND is_active = 1
       ORDER BY created_at ASC`,
      [category]
    );
  } catch (err) {
    if (err.errno === 1054 && err.sqlMessage && err.sqlMessage.includes('weekly_off_days')) {
      rows = await executeQuery(
        `SELECT id, created_at FROM admins
         WHERE role = 'sub_admin' AND sub_admin_category = ? AND is_active = 1
         ORDER BY created_at ASC`,
        [category]
      );
      rows = (rows || []).map(r => ({ ...r, weekly_off_days: null, temp_inactive_from: null, temp_inactive_to: null }));
    } else {
      throw err;
    }
  }
  return rows.filter(r => !isAdminTempInactiveToday(r));
}

/** Temp assignment column names (for leave cover). */
const tempCols = {
  verify_user: 'temp_assigned_verify_admin_id',
  qa_user: 'temp_assigned_qa_admin_id',
  account_manager: 'temp_assigned_account_manager_id',
  recovery_officer: 'temp_assigned_recovery_officer_id',
  debt_agency: null
};

/**
 * Get all sub-admins of a category with leave info (for sync).
 */
async function getAllSubAdminsWithLeaveInfo(category) {
  await ensureDb();
  try {
    return await executeQuery(
      `SELECT id, created_at, weekly_off_days, temp_inactive_from, temp_inactive_to FROM admins
       WHERE role = 'sub_admin' AND sub_admin_category = ? AND is_active = 1
       ORDER BY created_at ASC`,
      [category]
    );
  } catch (err) {
    if (err.errno === 1054 && err.sqlMessage && err.sqlMessage.includes('weekly_off_days')) {
      const rows = await executeQuery(
        `SELECT id, created_at FROM admins
         WHERE role = 'sub_admin' AND sub_admin_category = ? AND is_active = 1
         ORDER BY created_at ASC`,
        [category]
      );
      return (rows || []).map(r => ({ ...r, weekly_off_days: null, temp_inactive_from: null, temp_inactive_to: null }));
    }
    throw err;
  }
}

/**
 * Sync temp assignments for a category: when an admin is on leave today, their loans get
 * temp_assigned_*_id set to another active admin; when they're back, temp_assigned is cleared.
 * Permanent assigned_*_id is never changed here.
 */
async function syncTempAssignmentsForCategory(category) {
  await ensureDb();
  const assignedCols = {
    verify_user: 'assigned_verify_admin_id',
    qa_user: 'assigned_qa_admin_id',
    account_manager: 'assigned_account_manager_id',
    recovery_officer: 'assigned_recovery_officer_id',
    debt_agency: null
  };
  const assignedCol = assignedCols[category];
  const tempCol = tempCols[category];
  if (!assignedCol || !tempCol) return;

  const statusFilter = category === 'verify_user'
    ? ` AND status IN ('submitted','under_review','follow_up','disbursal','ready_for_disbursement')`
    : category === 'qa_user'
      ? ` AND status = 'qa_verification'`
      : category === 'account_manager'
        ? ` AND status = 'account_manager'`
        : ` AND status = 'overdue'`;

  const allAdmins = await getAllSubAdminsWithLeaveInfo(category);
  const activeToday = await getActiveSubAdmins(category);
  const activeIds = activeToday.map(a => a.id);

  for (const admin of allAdmins) {
    const loans = await executeQuery(
      `SELECT id FROM loan_applications WHERE ${assignedCol} = ? ${statusFilter} ORDER BY id`,
      [admin.id]
    );
    if (loans.length === 0) continue;

    if (isAdminTempInactiveToday(admin)) {
      if (activeIds.length === 0) {
        await executeQuery(
          `UPDATE loan_applications SET ${tempCol} = NULL WHERE ${assignedCol} = ? ${statusFilter}`,
          [admin.id]
        );
        continue;
      }
      for (let i = 0; i < loans.length; i++) {
        const tempAdminId = activeIds[i % activeIds.length];
        await executeQuery(
          `UPDATE loan_applications SET ${tempCol} = ? WHERE id = ?`,
          [tempAdminId, loans[i].id]
        );
      }
    } else {
      await executeQuery(
        `UPDATE loan_applications SET ${tempCol} = NULL WHERE ${assignedCol} = ? ${statusFilter}`,
        [admin.id]
      );
    }
  }
}

/**
 * Assign next verify user (round-robin). When only one, assign to that one.
 * When multiple: ID 1 -> sub-admin 1, ID 2 -> sub-admin 2, ID 3 -> sub-admin 1, ...
 */
async function getNextVerifyAdminId() {
  const admins = await getActiveSubAdmins('verify_user');
  if (admins.length === 0) return null;
  if (admins.length === 1) return admins[0].id;

  const counts = await executeQuery(
    `SELECT assigned_verify_admin_id, COUNT(*) as c FROM loan_applications
     WHERE status IN ('submitted','under_review','follow_up','disbursal','ready_for_disbursement')
       AND assigned_verify_admin_id IS NOT NULL
     GROUP BY assigned_verify_admin_id`
  );
  const countByAdmin = {};
  admins.forEach(a => { countByAdmin[a.id] = 0; });
  counts.forEach(r => { countByAdmin[r.assigned_verify_admin_id] = Number(r.c); });

  let minId = admins[0].id;
  let minCount = countByAdmin[minId] ?? 0;
  for (let i = 1; i < admins.length; i++) {
    const id = admins[i].id;
    const c = countByAdmin[id] ?? 0;
    if (c < minCount) {
      minCount = c;
      minId = id;
    }
  }
  return minId;
}

/**
 * Assign next account manager by PCID (user_id) count: split so each has ~ equal distinct user_ids.
 * New loans for an already-assigned PCID stay with same account manager.
 */
async function getNextAccountManagerId(existingUserId) {
  const admins = await getActiveSubAdmins('account_manager');
  if (admins.length === 0) return null;
  if (admins.length === 1) return admins[0].id;

  if (existingUserId != null) {
    const existing = await executeQuery(
      `SELECT assigned_account_manager_id FROM loan_applications
       WHERE user_id = ? AND status = 'account_manager' AND assigned_account_manager_id IS NOT NULL
       LIMIT 1`,
      [existingUserId]
    );
    if (existing.length > 0) return existing[0].assigned_account_manager_id;
  }

  const counts = await executeQuery(
    `SELECT assigned_account_manager_id, COUNT(DISTINCT user_id) as c FROM loan_applications
     WHERE status = 'account_manager' AND assigned_account_manager_id IS NOT NULL
     GROUP BY assigned_account_manager_id`
  );
  const countByAdmin = {};
  admins.forEach(a => { countByAdmin[a.id] = 0; });
  counts.forEach(r => { countByAdmin[r.assigned_account_manager_id] = Number(r.c); });

  let minId = admins[0].id;
  let minCount = countByAdmin[minId] ?? 0;
  for (let i = 1; i < admins.length; i++) {
    const id = admins[i].id;
    const c = countByAdmin[id] ?? 0;
    if (c < minCount) {
      minCount = c;
      minId = id;
    }
  }
  return minId;
}

/**
 * Assign next QA user (round-robin, same logic as verify user).
 */
async function getNextQAAdminId() {
  const admins = await getActiveSubAdmins('qa_user');
  if (admins.length === 0) return null;
  if (admins.length === 1) return admins[0].id;
  const counts = await executeQuery(
    `SELECT assigned_qa_admin_id, COUNT(*) as c FROM loan_applications
     WHERE status = 'qa_verification' AND assigned_qa_admin_id IS NOT NULL
     GROUP BY assigned_qa_admin_id`
  );
  const countByAdmin = {};
  admins.forEach(a => { countByAdmin[a.id] = 0; });
  counts.forEach(r => { countByAdmin[r.assigned_qa_admin_id] = Number(r.c); });
  let minId = admins[0].id;
  let minCount = countByAdmin[minId] ?? 0;
  for (let i = 1; i < admins.length; i++) {
    const id = admins[i].id;
    const c = countByAdmin[id] ?? 0;
    if (c < minCount) { minCount = c; minId = id; }
  }
  return minId;
}

/**
 * Assign next recovery officer (by overdue loan count).
 */
async function getNextRecoveryOfficerId() {
  const admins = await getActiveSubAdmins('recovery_officer');
  if (admins.length === 0) return null;
  if (admins.length === 1) return admins[0].id;

  const counts = await executeQuery(
    `SELECT assigned_recovery_officer_id, COUNT(*) as c FROM loan_applications
     WHERE status = 'overdue' AND assigned_recovery_officer_id IS NOT NULL
     GROUP BY assigned_recovery_officer_id`
  );
  const countByAdmin = {};
  admins.forEach(a => { countByAdmin[a.id] = 0; });
  counts.forEach(r => { countByAdmin[r.assigned_recovery_officer_id] = Number(r.c); });

  let minId = admins[0].id;
  let minCount = countByAdmin[minId] ?? 0;
  for (let i = 1; i < admins.length; i++) {
    const id = admins[i].id;
    const c = countByAdmin[id] ?? 0;
    if (c < minCount) {
      minCount = c;
      minId = id;
    }
  }
  return minId;
}

/**
 * Assign verify user when loan status becomes submitted (or when first submitted).
 */
async function assignVerifyUserForLoan(loanId) {
  const adminId = await getNextVerifyAdminId();
  if (!adminId) return;
  await ensureDb();
  await executeQuery(
    'UPDATE loan_applications SET assigned_verify_admin_id = ? WHERE id = ?',
    [adminId, loanId]
  );
}

/**
 * Send SMS to user when an account manager is assigned (uses event template acc_manager_assigned).
 * Non-blocking: logs errors but does not throw.
 */
async function sendAccountManagerAssignedSms(userId, loanId, adminId) {
  if (!userId || !adminId) return;
  try {
    const { triggerEventSMS } = require('../utils/eventSmsTrigger');
    const admins = await executeQuery(
      'SELECT name, phone FROM admins WHERE id = ?',
      [adminId]
    );
    const acc_manager_name = admins?.[0]?.name || 'Account Manager';
    const acc_manager_phone = admins?.[0]?.phone || '';
    await triggerEventSMS('acc_manager_assigned', {
      userId,
      loanId: loanId || null,
      variables: { acc_manager_name, acc_manager_phone }
    });
  } catch (err) {
    console.error('Send account manager assigned SMS (non-fatal):', err.message);
  }
}

/**
 * Assign account manager when loan status becomes account_manager (by PCID).
 */
async function assignAccountManagerForLoan(loanId, userId) {
  const adminId = await getNextAccountManagerId(userId);
  if (!adminId) return;
  await ensureDb();
  await executeQuery(
    'UPDATE loan_applications SET assigned_account_manager_id = ? WHERE id = ?',
    [adminId, loanId]
  );
  const jobQueue = require('./jobQueueService');
  jobQueue.enqueue(jobQueue.JOB_TYPE_ACC_MANAGER_SMS, { userId, loanId, adminId }).catch(err => console.error('Enqueue acc_manager_sms:', err.message));
}

/**
 * Assign QA user when loan status becomes qa_verification.
 */
async function assignQAUserForLoan(loanId) {
  const adminId = await getNextQAAdminId();
  if (!adminId) return;
  await ensureDb();
  await executeQuery(
    'UPDATE loan_applications SET assigned_qa_admin_id = ? WHERE id = ?',
    [adminId, loanId]
  );
}

/**
 * Assign recovery officer when loan status becomes overdue.
 */
async function assignRecoveryOfficerForLoan(loanId) {
  const adminId = await getNextRecoveryOfficerId();
  if (!adminId) return;
  await ensureDb();
  await executeQuery(
    'UPDATE loan_applications SET assigned_recovery_officer_id = ? WHERE id = ?',
    [adminId, loanId]
  );
}

/**
 * Redistribute assignments when a sub-admin is deactivated.
 * Split equally among remaining active sub-admins of same category.
 */
async function redistributeOnDeactivate(adminId, category) {
  await ensureDb();
  const active = await getActiveSubAdmins(category);
  const activeIds = active.map(a => a.id).filter(id => id !== adminId);
  if (activeIds.length === 0) return;

  const columns = {
    verify_user: 'assigned_verify_admin_id',
    qa_user: 'assigned_qa_admin_id',
    account_manager: 'assigned_account_manager_id',
    recovery_officer: 'assigned_recovery_officer_id',
    debt_agency: null
  };
  const col = columns[category];
  if (!col) return;

  const statusFilter = category === 'verify_user'
    ? ` AND status IN ('submitted','under_review','follow_up','disbursal','ready_for_disbursement')`
    : category === 'qa_user'
      ? ` AND status = 'qa_verification'`
      : category === 'account_manager'
        ? ` AND status = 'account_manager'`
        : ` AND status = 'overdue'`;

  const selectCols = category === 'account_manager' ? 'id, user_id' : 'id';
  const affected = await executeQuery(
    `SELECT ${selectCols} FROM loan_applications WHERE ${col} = ? ${statusFilter}`,
    [adminId]
  );
  if (affected.length === 0) return;

  const userToSms = {}; // userId -> { loanId, adminId } for account_manager SMS (one per user)
  for (let i = 0; i < affected.length; i++) {
    const targetAdminId = activeIds[i % activeIds.length];
    const row = affected[i];
    await executeQuery(
      `UPDATE loan_applications SET ${col} = ? WHERE id = ?`,
      [targetAdminId, row.id]
    );
    if (category === 'account_manager' && row.user_id) {
      userToSms[row.user_id] = { loanId: row.id, adminId: targetAdminId };
    }
  }
  const jobQueue = require('./jobQueueService');
  const payloads = Object.entries(userToSms).map(([uid, v]) => ({ userId: uid, loanId: v.loanId, adminId: v.adminId }));
  if (payloads.length > 0) {
    jobQueue.enqueueMany(jobQueue.JOB_TYPE_ACC_MANAGER_SMS, payloads).catch(err => console.error('Enqueue acc_manager_sms bulk:', err.message));
  }
}

/**
 * Redistribute all assignments when a new sub-admin joins.
 * Re-splits existing assigned IDs evenly across all active sub-admins (including the new one).
 */
async function redistributeOnNewSubAdmin(category) {
  await ensureDb();
  const active = await getActiveSubAdmins(category);
  if (active.length === 0) return;

  const columns = {
    verify_user: 'assigned_verify_admin_id',
    qa_user: 'assigned_qa_admin_id',
    account_manager: 'assigned_account_manager_id',
    recovery_officer: 'assigned_recovery_officer_id',
    debt_agency: null
  };
  const col = columns[category];
  if (!col) return;

  const statusFilter = category === 'verify_user'
    ? ` AND status IN ('submitted','under_review','follow_up','disbursal','ready_for_disbursement')`
    : category === 'qa_user'
      ? ` AND status = 'qa_verification'`
      : category === 'account_manager'
        ? ` AND status = 'account_manager'`
        : ` AND status = 'overdue'`;

  const activeIds = active.map(a => a.id);

  if (category === 'account_manager') {
    // Redistribute by PCID (user_id): include ALL loans in account_manager status (assigned + unassigned)
    // so a newly created account manager gets a fair share of existing and unassigned users
    const rows = await executeQuery(
      `SELECT id, user_id FROM loan_applications WHERE status = 'account_manager' ORDER BY user_id, id`
    );
    if (rows.length === 0) return;
    const userToAdminIndex = {};
    const userToLoanAndAdmin = {}; // one loan + new admin per user for SMS
    let adminIndex = 0;
    for (const row of rows) {
      const uid = row.user_id;
      if (userToAdminIndex[uid] === undefined) {
        userToAdminIndex[uid] = adminIndex % activeIds.length;
        adminIndex++;
      }
      const targetAdminId = activeIds[userToAdminIndex[uid]];
      await executeQuery(
        `UPDATE loan_applications SET ${col} = ? WHERE id = ?`,
        [targetAdminId, row.id]
      );
      userToLoanAndAdmin[uid] = { loanId: row.id, adminId: targetAdminId };
    }
    const jobQueue = require('./jobQueueService');
    const payloads = Object.entries(userToLoanAndAdmin).map(([uid, v]) => ({ userId: uid, loanId: v.loanId, adminId: v.adminId }));
    if (payloads.length > 0) {
      jobQueue.enqueueMany(jobQueue.JOB_TYPE_ACC_MANAGER_SMS, payloads).catch(err => console.error('Enqueue acc_manager_sms bulk:', err.message));
    }
    return;
  }

  // verify_user, qa_user, recovery_officer: include ALL loans in the relevant status (assigned + unassigned)
  // so a newly created sub-admin gets a fair share
  const rows = await executeQuery(
    `SELECT id FROM loan_applications WHERE 1=1 ${statusFilter} ORDER BY id`
  );
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i++) {
    const targetAdminId = activeIds[i % activeIds.length];
    await executeQuery(
      `UPDATE loan_applications SET ${col} = ? WHERE id = ?`,
      [targetAdminId, rows[i].id]
    );
  }
}

module.exports = {
  getActiveSubAdmins,
  getNextVerifyAdminId,
  getNextQAAdminId,
  getNextAccountManagerId,
  getNextRecoveryOfficerId,
  assignVerifyUserForLoan,
  assignQAUserForLoan,
  assignAccountManagerForLoan,
  assignRecoveryOfficerForLoan,
  redistributeOnDeactivate,
  redistributeOnNewSubAdmin,
  syncTempAssignmentsForCategory,
  sendAccountManagerAssignedSms
};
