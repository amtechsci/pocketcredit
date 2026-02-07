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
 * Get active sub-admins of a category, ordered by created_at (for round-robin).
 */
async function getActiveSubAdmins(category) {
  await ensureDb();
  const rows = await executeQuery(
    `SELECT id, created_at FROM admins
     WHERE role = 'sub_admin' AND sub_admin_category = ? AND is_active = 1
     ORDER BY created_at ASC`,
    [category]
  );
  return rows;
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

  const affected = await executeQuery(
    `SELECT id FROM loan_applications WHERE ${col} = ? ${statusFilter}`,
    [adminId]
  );
  if (affected.length === 0) return;

  for (let i = 0; i < affected.length; i++) {
    const targetAdminId = activeIds[i % activeIds.length];
    await executeQuery(
      `UPDATE loan_applications SET ${col} = ? WHERE id = ?`,
      [targetAdminId, affected[i].id]
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
  redistributeOnDeactivate
};
