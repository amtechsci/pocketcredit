const express = require('express');
const bcrypt = require('bcryptjs');
const { authenticateAdmin } = require('../middleware/auth');
const { executeQuery, initializeDatabase } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { redistributeOnDeactivate, redistributeOnNewSubAdmin, syncTempAssignmentsForCategory } = require('../services/adminAssignmentService');
const router = express.Router();

const VALID_ADMIN_ROLES = ['superadmin', 'manager', 'officer', 'super_admin', 'master_admin', 'nbfc_admin', 'sub_admin'];
const SUB_ADMIN_CATEGORIES = ['verify_user', 'qa_user', 'account_manager', 'recovery_officer', 'debt_agency', 'follow_up_user'];

// Ensure database is initialized
let dbInitialized = false;
const ensureDbInitialized = async () => {
  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
  }
};

const ADMIN_SELECT_WITH_LEAVE = 'id, name, email, role, sub_admin_category, whitelisted_ip, weekly_off_days, temp_inactive_from, temp_inactive_to, permissions, is_active, last_login, created_at, updated_at';
const ADMIN_SELECT_WITHOUT_LEAVE = 'id, name, email, role, sub_admin_category, whitelisted_ip, permissions, is_active, last_login, created_at, updated_at';

async function getAdminById(id) {
  try {
    const rows = await executeQuery(
      `SELECT ${ADMIN_SELECT_WITH_LEAVE} FROM admins WHERE id = ?`,
      [id]
    );
    return rows[0] || null;
  } catch (err) {
    if (err.errno === 1054 && err.sqlMessage && err.sqlMessage.includes('weekly_off_days')) {
      const rows = await executeQuery(
        `SELECT ${ADMIN_SELECT_WITHOUT_LEAVE} FROM admins WHERE id = ?`,
        [id]
      );
      const row = rows[0] || null;
      if (row) {
        row.weekly_off_days = null;
        row.temp_inactive_from = null;
        row.temp_inactive_to = null;
      }
      return row;
    }
    throw err;
  }
}

// Helper function to log admin activity
const logAdminActivity = async (adminId, action, metadata = {}) => {
  try {
    await ensureDbInitialized();
    const activityId = uuidv4();
    await executeQuery(`
      INSERT INTO activity_logs (id, admin_id, action, type, metadata, timestamp, priority)
      VALUES (?, ?, ?, 'admin_action', ?, NOW(), 'medium')
    `, [
      activityId,
      adminId,
      action,
      JSON.stringify(metadata)
    ]);
  } catch (error) {
    console.error('Failed to log admin activity:', error);
    // Don't fail the request if logging fails
  }
};

/**
 * GET /api/admin/team
 * Get all admin team members (paginated)
 * Requires: superadmin or manager with manage_officers permission
 */
router.get('/', authenticateAdmin, async (req, res) => {
  // Check permissions manually to allow superadmin
  if (req.admin.role !== 'superadmin' && !req.admin.permissions.includes('manage_officers')) {
    return res.status(403).json({
      status: 'error',
      message: 'Permission denied'
    });
  }
  try {
    await ensureDbInitialized();

    const { page = 1, limit = 50, role, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const selectWithLeave = 'id, name, email, role, sub_admin_category, whitelisted_ip, weekly_off_days, temp_inactive_from, temp_inactive_to, permissions, is_active, last_login, created_at, updated_at';
    const selectWithoutLeave = 'id, name, email, role, sub_admin_category, whitelisted_ip, permissions, is_active, last_login, created_at, updated_at';

    let whereClause = ' WHERE 1=1';
    if (role && role !== 'all') whereClause += ' AND role = ?';
    if (search) whereClause += ' AND (name LIKE ? OR email LIKE ?)';
    const orderLimit = ` ORDER BY created_at DESC LIMIT ${parseInt(limit)} OFFSET ${offset}`;
    const params = [];
    if (role && role !== 'all') params.push(role);
    if (search) {
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }
    const query = `SELECT ${selectWithLeave} FROM admins${whereClause}${orderLimit}`;

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM admins WHERE 1=1';
    const countParams = [];

    if (role && role !== 'all') {
      countQuery += ' AND role = ?';
      countParams.push(role);
    }

    if (search) {
      countQuery += ' AND (name LIKE ? OR email LIKE ?)';
      const searchTerm = `%${search}%`;
      countParams.push(searchTerm, searchTerm);
    }

    let admins;
    let countResult;
    try {
      [admins, countResult] = await Promise.all([
        executeQuery(query, params),
        executeQuery(countQuery, countParams)
      ]);
    } catch (err) {
      if (err.errno === 1054 && err.sqlMessage && err.sqlMessage.includes('weekly_off_days')) {
        const queryFallback = `SELECT ${selectWithoutLeave} FROM admins${whereClause}${orderLimit}`;
        [admins, countResult] = await Promise.all([
          executeQuery(queryFallback, params),
          executeQuery(countQuery, countParams)
        ]);
        admins = (admins || []).map(a => ({ ...a, weekly_off_days: null, temp_inactive_from: null, temp_inactive_to: null }));
      } else {
        throw err;
      }
    }

    const total = countResult[0].total;

    // Transform permissions from JSON
    const transformedAdmins = admins.map(admin => ({
      ...admin,
      permissions: Array.isArray(admin.permissions)
        ? admin.permissions
        : (admin.permissions ? JSON.parse(admin.permissions) : [])
    }));

    res.json({
      status: 'success',
      data: {
        admins: transformedAdmins,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get team members error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch team members'
    });
  }
});

/**
 * POST /api/admin/team/redistribute
 * Manually trigger redistribution of assignments for a sub-admin category.
 * Body: { category: 'verify_user' | 'qa_user' | 'account_manager' | 'recovery_officer' }
 */
router.post('/redistribute', authenticateAdmin, async (req, res) => {
  if (req.admin.role !== 'superadmin' && req.admin.role !== 'super_admin' && !req.admin.permissions?.includes('manage_officers')) {
    return res.status(403).json({
      status: 'error',
      message: 'Permission denied'
    });
  }
  const category = req.body?.category;
  const allowed = ['verify_user', 'qa_user', 'account_manager', 'recovery_officer'];
  if (!category || !allowed.includes(category)) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid or missing category. Use one of: ' + allowed.join(', ')
    });
  }
  try {
    await ensureDbInitialized();
    await redistributeOnNewSubAdmin(category);
    res.json({
      status: 'success',
      message: `Assignments redistributed for ${category}. All active ${category.replace('_', ' ')}s now have a fair share.`
    });
  } catch (err) {
    console.error('Redistribute error:', err);
    res.status(500).json({
      status: 'error',
      message: err.message || 'Failed to redistribute assignments'
    });
  }
});

/**
 * GET /api/admin/team/me
 * Get current admin's profile (for leave settings). Any authenticated admin.
 */
router.get('/me', authenticateAdmin, async (req, res) => {
  try {
    const admin = await getAdminById(req.admin.id);
    if (!admin) {
      return res.status(404).json({ status: 'error', message: 'Admin not found' });
    }
    admin.permissions = Array.isArray(admin.permissions) ? admin.permissions : (admin.permissions ? JSON.parse(admin.permissions) : []);
    res.json({ status: 'success', data: { admin } });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ status: 'error', message: 'Failed to fetch profile' });
  }
});

/**
 * PUT /api/admin/team/me/leave
 * Update current admin's own weekly off and leave date range. Any authenticated sub-admin (except debt_agency).
 */
router.put('/me/leave', authenticateAdmin, async (req, res) => {
  if (req.admin.role !== 'sub_admin' || req.admin.sub_admin_category === 'debt_agency') {
    return res.status(403).json({
      status: 'error',
      message: 'Only sub-admins (except Debt Agency) can set leave'
    });
  }
  const { weekly_off_days: weeklyOffDays, temp_inactive_from: tempInactiveFrom, temp_inactive_to: tempInactiveTo } = req.body;
  try {
    await ensureDbInitialized();
    const updates = [];
    const params = [];
    if (weeklyOffDays !== undefined) {
      const val = Array.isArray(weeklyOffDays) ? weeklyOffDays.filter(d => d !== '' && d != null).join(',') : (weeklyOffDays === '' || weeklyOffDays == null ? null : String(weeklyOffDays));
      updates.push('weekly_off_days = ?');
      params.push(val || null);
    }
    if (tempInactiveFrom !== undefined) {
      updates.push('temp_inactive_from = ?');
      params.push(tempInactiveFrom === '' || tempInactiveFrom == null ? null : tempInactiveFrom);
    }
    if (tempInactiveTo !== undefined) {
      updates.push('temp_inactive_to = ?');
      params.push(tempInactiveTo === '' || tempInactiveTo == null ? null : tempInactiveTo);
    }
    if (updates.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No leave fields to update' });
    }
    params.push(req.admin.id);
    await executeQuery(
      `UPDATE admins SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );
    const category = req.admin.sub_admin_category;
    if (category) {
      try {
        await syncTempAssignmentsForCategory(category);
      } catch (e) {
        console.error('Sync temp assignments on self leave update failed:', e);
      }
    }
    const admin = await getAdminById(req.admin.id);
    admin.permissions = Array.isArray(admin.permissions) ? admin.permissions : (admin.permissions ? JSON.parse(admin.permissions) : []);
    res.json({
      status: 'success',
      message: 'Leave settings updated',
      data: { admin }
    });
  } catch (err) {
    console.error('Update my leave error:', err);
    res.status(500).json({ status: 'error', message: err.message || 'Failed to update leave' });
  }
});

/**
 * GET /api/admin/team/stats
 * Get team statistics
 */
router.get('/stats', authenticateAdmin, async (req, res) => {
  // Check permissions manually to allow superadmin
  if (req.admin.role !== 'superadmin' && !req.admin.permissions.includes('manage_officers')) {
    return res.status(403).json({
      status: 'error',
      message: 'Permission denied'
    });
  }
  try {
    await ensureDbInitialized();

    const [totalResult, superadminResult, managerResult, officerResult, activeResult] = await Promise.all([
      executeQuery('SELECT COUNT(*) as count FROM admins'),
      executeQuery('SELECT COUNT(*) as count FROM admins WHERE role = ?', ['superadmin']),
      executeQuery('SELECT COUNT(*) as count FROM admins WHERE role = ?', ['manager']),
      executeQuery('SELECT COUNT(*) as count FROM admins WHERE role = ?', ['officer']),
      executeQuery('SELECT COUNT(*) as count FROM admins WHERE is_active = 1')
    ]);

    res.json({
      status: 'success',
      data: {
        total: totalResult[0].count,
        superadmin: superadminResult[0].count,
        manager: managerResult[0].count,
        officer: officerResult[0].count,
        active: activeResult[0].count,
        inactive: totalResult[0].count - activeResult[0].count
      }
    });
  } catch (error) {
    console.error('Get team stats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch team statistics'
    });
  }
});

/**
 * GET /api/admin/team/:id
 * Get single admin team member details
 */
router.get('/:id', authenticateAdmin, async (req, res) => {
  // Check permissions manually to allow superadmin
  if (req.admin.role !== 'superadmin' && !req.admin.permissions.includes('manage_officers')) {
    return res.status(403).json({
      status: 'error',
      message: 'Permission denied'
    });
  }
  try {
    await ensureDbInitialized();
    const { id } = req.params;

    const admin = await getAdminById(id);
    if (!admin) {
      return res.status(404).json({
        status: 'error',
        message: 'Admin not found'
      });
    }
    admin.permissions = Array.isArray(admin.permissions)
      ? admin.permissions
      : (admin.permissions ? JSON.parse(admin.permissions) : []);

    res.json({
      status: 'success',
      data: { admin }
    });
  } catch (error) {
    console.error('Get admin details error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch admin details'
    });
  }
});

/**
 * GET /api/admin/team/:id/activity
 * Get activity log for a specific admin
 */
router.get('/:id/activity', authenticateAdmin, async (req, res) => {
  // Check permissions manually to allow superadmin
  if (req.admin.role !== 'superadmin' && !req.admin.permissions.includes('manage_officers')) {
    return res.status(403).json({
      status: 'error',
      message: 'Permission denied'
    });
  }
  try {
    await ensureDbInitialized();
    const { id } = req.params;
    const { limit = 50 } = req.query;

    // Check if admin exists
    const admins = await executeQuery('SELECT id FROM admins WHERE id = ?', [id]);
    if (admins.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Admin not found'
      });
    }

    // Get activity logs
    // Note: LIMIT must be an integer in the query string, not a placeholder
    const activities = await executeQuery(`
      SELECT 
        id, action, type, metadata, timestamp, priority, ip_address, user_agent
      FROM activity_logs
      WHERE admin_id = ?
      ORDER BY timestamp DESC
      LIMIT ${parseInt(limit)}
    `, [id]);

    // Parse metadata
    const transformedActivities = activities.map(activity => ({
      ...activity,
      metadata: typeof activity.metadata === 'string'
        ? JSON.parse(activity.metadata || '{}')
        : (activity.metadata || {})
    }));

    // Get statistics
    const [todayResult, weekResult, monthResult] = await Promise.all([
      executeQuery(`
        SELECT COUNT(*) as count FROM activity_logs 
        WHERE admin_id = ? AND DATE(timestamp) = CURDATE()
      `, [id]),
      executeQuery(`
        SELECT COUNT(*) as count FROM activity_logs 
        WHERE admin_id = ? AND timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      `, [id]),
      executeQuery(`
        SELECT COUNT(*) as count FROM activity_logs 
        WHERE admin_id = ? AND timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      `, [id])
    ]);

    res.json({
      status: 'success',
      data: {
        activities: transformedActivities,
        stats: {
          today: todayResult[0].count,
          week: weekResult[0].count,
          month: monthResult[0].count
        }
      }
    });
  } catch (error) {
    console.error('Get admin activity error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch admin activity'
    });
  }
});

/**
 * POST /api/admin/team
 * Create new admin team member
 * Requires: superadmin only (managers can't create other admins)
 */
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    await ensureDbInitialized();

    // Only superadmin can create admins
    if (req.admin.role !== 'superadmin') {
      return res.status(403).json({
        status: 'error',
        message: 'Only superadmin can create team members'
      });
    }

    const { name, email, password, role, permissions, phone, department, sub_admin_category, whitelisted_ip } = req.body;

    // Validate required fields
    if (!name || !email || !password || !role) {
      return res.status(400).json({
        status: 'error',
        message: 'Name, email, password, and role are required'
      });
    }

    // Validate role
    if (!VALID_ADMIN_ROLES.includes(role)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid role. Must be one of: ' + VALID_ADMIN_ROLES.join(', ')
      });
    }

    if (role === 'sub_admin') {
      if (!sub_admin_category || !SUB_ADMIN_CATEGORIES.includes(sub_admin_category)) {
        return res.status(400).json({
          status: 'error',
          message: 'Sub-admin requires sub_admin_category: ' + SUB_ADMIN_CATEGORIES.join(', ')
        });
      }
    }

    // Check if email already exists
    const existingAdmins = await executeQuery(
      'SELECT id FROM admins WHERE email = ?',
      [email.toLowerCase()]
    );

    if (existingAdmins.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Email already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Determine permissions based on role if not provided
    let finalPermissions = permissions;
    if (!finalPermissions || finalPermissions.length === 0) {
      if (role === 'superadmin' || role === 'super_admin') {
        finalPermissions = ['*'];
      } else if (role === 'manager' || role === 'master_admin') {
        finalPermissions = ['approve_loans', 'reject_loans', 'view_users', 'edit_loans', 'manage_officers', 'view_analytics'];
      } else if (role === 'sub_admin') {
        finalPermissions = ['view_loans', 'view_users'];
      } else {
        finalPermissions = ['view_loans', 'view_users', 'add_notes', 'follow_up'];
      }
    }

    const subCategory = role === 'sub_admin' ? sub_admin_category : null;
    const allowedIp = role === 'sub_admin' && sub_admin_category === 'debt_agency' ? (whitelisted_ip || null) : null;

    // Create admin (omit phone/department if your admins table does not have these columns)
    const adminId = uuidv4();
    await executeQuery(`
      INSERT INTO admins (id, name, email, password, role, sub_admin_category, whitelisted_ip, permissions, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
    `, [
      adminId,
      name,
      email.toLowerCase(),
      hashedPassword,
      role,
      subCategory,
      allowedIp,
      JSON.stringify(finalPermissions)
    ]);

    // When a new sub-admin joins, redistribute existing assignments so the new person gets a share
    if (role === 'sub_admin' && subCategory && subCategory !== 'debt_agency') {
      try {
        await redistributeOnNewSubAdmin(subCategory);
      } catch (redistErr) {
        console.error('Redistribution on new sub-admin failed:', redistErr);
      }
    }

    // Log activity
    await logAdminActivity(req.admin.id, 'created_admin', {
      admin_id: adminId,
      name,
      email,
      role,
      department
    });

    // Get created admin
    const newAdmin = await getAdminById(adminId);
    newAdmin.permissions = Array.isArray(newAdmin.permissions)
      ? newAdmin.permissions
      : JSON.parse(newAdmin.permissions || '[]');

    res.status(201).json({
      status: 'success',
      message: 'Team member created successfully',
      data: { admin: newAdmin }
    });
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create team member'
    });
  }
});

/**
 * PUT /api/admin/team/:id
 * Update admin team member
 */
router.put('/:id', authenticateAdmin, async (req, res) => {
  // Check permissions manually to allow superadmin
  if (req.admin.role !== 'superadmin' && !req.admin.permissions.includes('manage_officers')) {
    return res.status(403).json({
      status: 'error',
      message: 'Permission denied'
    });
  }
  try {
    await ensureDbInitialized();
    const { id } = req.params;

    // Only superadmin/super_admin can edit other superadmins or managers
    const targetAdmins = await executeQuery('SELECT role, sub_admin_category, is_active FROM admins WHERE id = ?', [id]);
    if (targetAdmins.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Admin not found'
      });
    }

    const targetRole = targetAdmins[0].role;
    const targetCategory = targetAdmins[0].sub_admin_category;
    const isSuperAdmin = req.admin.role === 'superadmin' || req.admin.role === 'super_admin';
    if ((['superadmin', 'super_admin', 'manager', 'master_admin'].includes(targetRole)) && !isSuperAdmin) {
      return res.status(403).json({
        status: 'error',
        message: 'Only super admin can edit other admins and managers'
      });
    }

    const { name, email, role, permissions, phone, department, is_active, sub_admin_category, whitelisted_ip, weekly_off_days: weeklyOffDays, temp_inactive_from: tempInactiveFrom, temp_inactive_to: tempInactiveTo } = req.body;

    // Build update query dynamically
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }

    if (email !== undefined) {
      // Check if email already exists (excluding current admin)
      const existingAdmins = await executeQuery(
        'SELECT id FROM admins WHERE email = ? AND id != ?',
        [email.toLowerCase(), id]
      );

      if (existingAdmins.length > 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Email already exists'
        });
      }

      updates.push('email = ?');
      params.push(email.toLowerCase());
    }

    // Omit phone/department - not all schemas have these columns on admins
    // if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
    // if (department !== undefined) { updates.push('department = ?'); params.push(department); }

    if (role !== undefined) {
      if (!isSuperAdmin) {
        return res.status(403).json({
          status: 'error',
          message: 'Only super admin can change roles'
        });
      }
      if (!VALID_ADMIN_ROLES.includes(role)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid role. Must be one of: ' + VALID_ADMIN_ROLES.join(', ')
        });
      }
      if (role === 'sub_admin' && (!sub_admin_category || !SUB_ADMIN_CATEGORIES.includes(sub_admin_category))) {
        return res.status(400).json({
          status: 'error',
          message: 'Sub-admin requires sub_admin_category: ' + SUB_ADMIN_CATEGORIES.join(', ')
        });
      }
      updates.push('role = ?');
      params.push(role);
      if (role === 'sub_admin') {
        updates.push('sub_admin_category = ?');
        params.push(sub_admin_category);
      } else {
        updates.push('sub_admin_category = NULL');
        updates.push('whitelisted_ip = NULL');
      }
    }

    if (sub_admin_category !== undefined && (req.body.role === 'sub_admin' || targetRole === 'sub_admin')) {
      if (!updates.some(u => u.includes('sub_admin_category'))) {
        updates.push('sub_admin_category = ?');
        params.push(SUB_ADMIN_CATEGORIES.includes(sub_admin_category) ? sub_admin_category : null);
      }
    }
    if (whitelisted_ip !== undefined) {
      if (!updates.some(u => u.includes('whitelisted_ip'))) {
        updates.push('whitelisted_ip = ?');
        params.push(whitelisted_ip || null);
      }
    }

    if (permissions !== undefined) {
      updates.push('permissions = ?');
      params.push(JSON.stringify(permissions));
    }

    const wasActive = !!targetAdmins[0].is_active;
    if (is_active !== undefined) {
      if (!isSuperAdmin) {
        return res.status(403).json({
          status: 'error',
          message: 'Only super admin can activate/deactivate accounts'
        });
      }
      updates.push('is_active = ?');
      params.push(is_active ? 1 : 0);
    }

    // Temporary inactive (leave): weekly off and/or date range
    if (weeklyOffDays !== undefined) {
      const val = Array.isArray(weeklyOffDays) ? weeklyOffDays.filter(d => d !== '' && d != null).join(',') : (weeklyOffDays === '' || weeklyOffDays == null ? null : String(weeklyOffDays));
      updates.push('weekly_off_days = ?');
      params.push(val || null);
    }
    if (tempInactiveFrom !== undefined) {
      updates.push('temp_inactive_from = ?');
      params.push(tempInactiveFrom === '' || tempInactiveFrom == null ? null : tempInactiveFrom);
    }
    if (tempInactiveTo !== undefined) {
      updates.push('temp_inactive_to = ?');
      params.push(tempInactiveTo === '' || tempInactiveTo == null ? null : tempInactiveTo);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No fields to update'
      });
    }

    updates.push('updated_at = NOW()');
    params.push(id);

    try {
      await executeQuery(
        `UPDATE admins SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    } catch (updateErr) {
      if (updateErr.errno === 1054 && updateErr.sqlMessage && updateErr.sqlMessage.includes('weekly_off_days')) {
        const leaveKeys = ['weekly_off_days', 'temp_inactive_from', 'temp_inactive_to'];
        const updatesNoLeave = updates.filter(u => !leaveKeys.some(k => u.startsWith(k + ' =')));
        const paramIndicesToDrop = [];
        updates.forEach((u, i) => { if (leaveKeys.some(k => u.startsWith(k + ' ='))) paramIndicesToDrop.push(i); });
        const paramsNoLeave = params.filter((_, i) => !paramIndicesToDrop.includes(i));
        await executeQuery(
          `UPDATE admins SET ${updatesNoLeave.join(', ')} WHERE id = ?`,
          paramsNoLeave
        );
      } else {
        throw updateErr;
      }
    }

    // When deactivating a sub-admin, redistribute their assigned IDs to other active sub-admins
    if (is_active === false && wasActive && targetRole === 'sub_admin' && targetCategory) {
      try {
        await redistributeOnDeactivate(id, targetCategory);
      } catch (redistErr) {
        console.error('Redistribution on deactivate failed:', redistErr);
      }
    }

    // When leave (temp inactive) settings change: sync temp assignments only (no permanent reassign).
    // Admins on leave get temp_assigned_* set on their loans; when back, temp_assigned is cleared.
    const leaveFieldsUpdated = weeklyOffDays !== undefined || tempInactiveFrom !== undefined || tempInactiveTo !== undefined;
    if (leaveFieldsUpdated && targetRole === 'sub_admin' && targetCategory && targetCategory !== 'debt_agency') {
      try {
        await syncTempAssignmentsForCategory(targetCategory);
      } catch (err) {
        console.error('Sync temp assignments on leave update failed:', err);
      }
    }

    // Log activity
    await logAdminActivity(req.admin.id, 'updated_admin', {
      admin_id: id,
      updates: Object.keys(req.body)
    });

    // Get updated admin
    const updatedAdmin = await getAdminById(id);
    updatedAdmin.permissions = Array.isArray(updatedAdmin.permissions)
      ? updatedAdmin.permissions
      : JSON.parse(updatedAdmin.permissions || '[]');

    res.json({
      status: 'success',
      message: 'Team member updated successfully',
      data: { admin: updatedAdmin }
    });
  } catch (error) {
    console.error('Update admin error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update team member'
    });
  }
});

/**
 * PATCH /api/admin/team/:id/status
 * Toggle admin account status (activate/deactivate)
 */
router.patch('/:id/status', authenticateAdmin, async (req, res) => {
  try {
    await ensureDbInitialized();
    const { id } = req.params;

    if (req.admin.role !== 'superadmin' && req.admin.role !== 'super_admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Only super admin can change account status'
      });
    }

    if (id === req.admin.id) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot change your own account status'
      });
    }

    const admins = await executeQuery('SELECT is_active, role, sub_admin_category FROM admins WHERE id = ?', [id]);
    if (admins.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Admin not found'
      });
    }

    const wasActive = !!admins[0].is_active;
    const targetRole = admins[0].role;
    const targetCategory = admins[0].sub_admin_category;
    const newStatus = !wasActive;

    await executeQuery(
      'UPDATE admins SET is_active = ?, updated_at = NOW() WHERE id = ?',
      [newStatus ? 1 : 0, id]
    );

    if (!newStatus && targetRole === 'sub_admin' && targetCategory) {
      try {
        await redistributeOnDeactivate(id, targetCategory);
      } catch (redistErr) {
        console.error('Redistribution on deactivate failed:', redistErr);
      }
    }

    // Log activity
    await logAdminActivity(req.admin.id, newStatus ? 'activated_admin' : 'deactivated_admin', {
      admin_id: id
    });

    res.json({
      status: 'success',
      message: `Team member ${newStatus ? 'activated' : 'deactivated'} successfully`,
      data: { is_active: newStatus }
    });
  } catch (error) {
    console.error('Toggle admin status error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update account status'
    });
  }
});

/**
 * PUT /api/admin/team/:id/password
 * Reset admin team member password (admin-to-admin)
 * Only super admins (including super_admin/master_admin) are allowed to use this.
 * This route does NOT require the current password and should be used carefully.
 */
router.put('/:id/password', authenticateAdmin, async (req, res) => {
  try {
    await ensureDbInitialized();
    const { id } = req.params;
    const { newPassword } = req.body || {};

    // Only super-level admins can reset passwords
    if (
      req.admin.role !== 'superadmin' &&
      req.admin.role !== 'super_admin' &&
      req.admin.role !== 'master_admin'
    ) {
      return res.status(403).json({
        status: 'error',
        message: 'Only super admin can reset team member passwords'
      });
    }

    // Encourage admins to use their own "change password" flow instead
    if (id === req.admin.id) {
      return res.status(400).json({
        status: 'error',
        message: 'Use the Change Password option to update your own password'
      });
    }

    if (!newPassword || typeof newPassword !== 'string') {
      return res.status(400).json({
        status: 'error',
        message: 'New password is required'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        status: 'error',
        message: 'New password must be at least 8 characters long'
      });
    }

    const admins = await executeQuery(
      'SELECT id, email, name FROM admins WHERE id = ?',
      [id]
    );

    if (admins.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Admin not found'
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await executeQuery(
      'UPDATE admins SET password = ?, updated_at = NOW() WHERE id = ?',
      [hashedPassword, id]
    );

    // Log activity for audit trail (do not log the password)
    await logAdminActivity(req.admin.id, 'reset_admin_password', {
      admin_id: id,
      target_email: admins[0].email,
      target_name: admins[0].name
    });

    res.json({
      status: 'success',
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Reset admin password error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to reset password'
    });
  }
});

/**
 * PUT /api/admin/team/:id/permissions
 * Update admin permissions
 */
router.put('/:id/permissions', authenticateAdmin, async (req, res) => {
  try {
    await ensureDbInitialized();
    const { id } = req.params;
    const { permissions } = req.body;

    // Only superadmin can change permissions
    if (req.admin.role !== 'superadmin') {
      return res.status(403).json({
        status: 'error',
        message: 'Only superadmin can change permissions'
      });
    }

    if (!Array.isArray(permissions)) {
      return res.status(400).json({
        status: 'error',
        message: 'Permissions must be an array'
      });
    }

    const admins = await executeQuery('SELECT id FROM admins WHERE id = ?', [id]);
    if (admins.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Admin not found'
      });
    }

    await executeQuery(
      'UPDATE admins SET permissions = ?, updated_at = NOW() WHERE id = ?',
      [JSON.stringify(permissions), id]
    );

    // Log activity
    await logAdminActivity(req.admin.id, 'updated_admin_permissions', {
      admin_id: id,
      permissions
    });

    res.json({
      status: 'success',
      message: 'Permissions updated successfully'
    });
  } catch (error) {
    console.error('Update permissions error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update permissions'
    });
  }
});

/**
 * DELETE /api/admin/team/:id
 * Delete admin team member
 */
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    await ensureDbInitialized();
    const { id } = req.params;

    // Only superadmin can delete admins
    if (req.admin.role !== 'superadmin') {
      return res.status(403).json({
        status: 'error',
        message: 'Only superadmin can delete team members'
      });
    }

    // Can't delete yourself
    if (id === req.admin.id) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot delete your own account'
      });
    }

    const admins = await executeQuery('SELECT id, name, email FROM admins WHERE id = ?', [id]);
    if (admins.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Admin not found'
      });
    }

    // Delete admin (CASCADE will handle related records in admin_login_history)
    await executeQuery('DELETE FROM admins WHERE id = ?', [id]);

    // Log activity
    await logAdminActivity(req.admin.id, 'deleted_admin', {
      admin_id: id,
      name: admins[0].name,
      email: admins[0].email
    });

    res.json({
      status: 'success',
      message: 'Team member deleted successfully'
    });
  } catch (error) {
    console.error('Delete admin error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete team member'
    });
  }
});

module.exports = router;

