const express = require('express');
const { authenticateAdmin } = require('../middleware/auth');
const { executeQuery, initializeDatabase } = require('../config/database');
const router = express.Router();

// Test endpoint
router.get('/test', (req, res) => {
  res.json({
    status: 'success',
    message: 'Activity logs route is working',
    timestamp: new Date().toISOString()
  });
});

// Get recent activities
router.get('/recent', async (req, res) => {
  try {
    await initializeDatabase();
    
    const {
      limit = 10,
      type = 'all',
      userId = null,
      adminId = null,
      priority = 'all',
      startDate = null,
      endDate = null
    } = req.query;

    console.log('🔍 Fetching recent activities:', { limit, type, userId, adminId, priority });

    // Build query
    let query = `
      SELECT 
        al.id,
        al.timestamp,
        al.type,
        al.user_id,
        al.admin_id,
        al.action,
        al.metadata,
        al.priority,
        al.ip_address,
        al.user_agent,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        u.email as user_email,
        admin.first_name as admin_first_name,
        admin.last_name as admin_last_name,
        admin.email as admin_email
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN admins admin ON al.admin_id = admin.id
    `;

    const whereConditions = [];
    const queryParams = [];

    // Type filter
    if (type && type !== 'all') {
      whereConditions.push('al.type = ?');
      queryParams.push(type);
    }

    // User filter
    if (userId) {
      whereConditions.push('al.user_id = ?');
      queryParams.push(userId);
    }

    // Admin filter
    if (adminId) {
      whereConditions.push('al.admin_id = ?');
      queryParams.push(adminId);
    }

    // Priority filter
    if (priority && priority !== 'all') {
      whereConditions.push('al.priority = ?');
      queryParams.push(priority);
    }

    // Date filters
    if (startDate) {
      whereConditions.push('al.timestamp >= ?');
      queryParams.push(startDate);
    }

    if (endDate) {
      whereConditions.push('al.timestamp <= ?');
      queryParams.push(endDate);
    }

    // Add WHERE clause
    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }

    // Add ORDER BY and LIMIT
    query += ' ORDER BY al.timestamp DESC LIMIT ?';
    queryParams.push(parseInt(limit));

    console.log('🔍 Executing activities query:', query);
    console.log('🔍 Query params:', queryParams);

    const activities = await executeQuery(query, queryParams);

    // Transform the data
    const transformedActivities = activities.map(activity => ({
      id: activity.id,
      timestamp: activity.timestamp,
      type: activity.type,
      action: activity.action,
      metadata: activity.metadata ? JSON.parse(activity.metadata) : {},
      priority: activity.priority,
      user: activity.user_id ? {
        id: activity.user_id,
        name: `${activity.user_first_name || ''} ${activity.user_last_name || ''}`.trim(),
        email: activity.user_email
      } : null,
      admin: activity.admin_id ? {
        id: activity.admin_id,
        name: `${activity.admin_first_name || ''} ${activity.admin_last_name || ''}`.trim(),
        email: activity.admin_email
      } : null,
      ipAddress: activity.ip_address,
      userAgent: activity.user_agent
    }));

    res.json({
      status: 'success',
      data: transformedActivities
    });

  } catch (error) {
    console.error('❌ Error fetching recent activities:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch recent activities',
      error: error.message
    });
  }
});

// Get activity statistics
router.get('/stats', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    
    const { period = '24h' } = req.query;
    
    // Calculate time range
    const now = new Date();
    let startTime;
    
    switch (period) {
      case '1h':
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Get activity statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as total_activities,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT admin_id) as unique_admins,
        COUNT(CASE WHEN type = 'user_registration' THEN 1 END) as user_registrations,
        COUNT(CASE WHEN type = 'loan_application_created' THEN 1 END) as loan_applications,
        COUNT(CASE WHEN type = 'loan_application_approved' THEN 1 END) as loan_approvals,
        COUNT(CASE WHEN type = 'loan_application_rejected' THEN 1 END) as loan_rejections,
        COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority_activities,
        COUNT(CASE WHEN priority = 'critical' THEN 1 END) as critical_activities
      FROM activity_logs 
      WHERE timestamp >= ?
    `;

    const stats = await executeQuery(statsQuery, [startTime]);

    // Get activity types breakdown
    const typesQuery = `
      SELECT 
        type,
        COUNT(*) as count
      FROM activity_logs 
      WHERE timestamp >= ?
      GROUP BY type
      ORDER BY count DESC
    `;

    const types = await executeQuery(typesQuery, [startTime]);

    res.json({
      status: 'success',
      data: {
        period,
        startTime,
        endTime: now,
        ...stats[0],
        activityTypes: types
      }
    });

  } catch (error) {
    console.error('❌ Error fetching activity stats:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch activity statistics'
    });
  }
});

// Get activity types
router.get('/types', authenticateAdmin, async (req, res) => {
  try {
    const activityTypes = {
      USER_REGISTRATION: 'user_registration',
      USER_LOGIN: 'user_login',
      USER_LOGOUT: 'user_logout',
      LOAN_APPLICATION_CREATED: 'loan_application_created',
      LOAN_APPLICATION_UPDATED: 'loan_application_updated',
      LOAN_APPLICATION_APPROVED: 'loan_application_approved',
      LOAN_APPLICATION_REJECTED: 'loan_application_rejected',
      LOAN_APPLICATION_DISBURSED: 'loan_application_disbursed',
      DOCUMENT_UPLOADED: 'document_uploaded',
      DOCUMENT_VERIFIED: 'document_verified',
      DOCUMENT_REJECTED: 'document_rejected',
      KYC_COMPLETED: 'kyc_completed',
      KYC_FAILED: 'kyc_failed',
      PAYMENT_MADE: 'payment_made',
      PAYMENT_FAILED: 'payment_failed',
      ADMIN_LOGIN: 'admin_login',
      ADMIN_ACTION: 'admin_action',
      SYSTEM_EVENT: 'system_event'
    };

    res.json({
      status: 'success',
      data: activityTypes
    });

  } catch (error) {
    console.error('❌ Error fetching activity types:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch activity types'
    });
  }
});

module.exports = router;
