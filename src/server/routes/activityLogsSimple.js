const express = require('express');
const { executeQuery, initializeDatabase } = require('../config/database');
const router = express.Router();

// Get recent activities - fetch real data
router.get('/recent', async (req, res) => {
  try {
    console.log('🔍 Fetching recent activities from database...');
    
    const { limit = 10 } = req.query;
    
    // Initialize database connection
    await initializeDatabase();
    
    // Check if activity_logs table exists
    const tableCheck = await executeQuery(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'activity_logs'
    `);
    
    if (tableCheck[0].count === 0) {
      console.log('⚠️ activity_logs table does not exist, returning mock data');
      
      // Return mock data if table doesn't exist
      const mockActivities = [
        {
          id: '1',
          timestamp: new Date().toISOString(),
          type: 'system_event',
          action: 'GET /admin/dashboard',
          priority: 'high',
          metadata: { method: 'GET', path: '/admin/dashboard' },
          user: null,
          admin: null,
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla/5.0...'
        }
      ];
      
      return res.json({
        status: 'success',
        data: mockActivities
      });
    }
    
    // Fetch real data from database
    const activities = await executeQuery(`
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
        admin.name as admin_name,
        admin.email as admin_email
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN admins admin ON al.admin_id = admin.id
      ORDER BY al.timestamp DESC 
      LIMIT ${parseInt(limit)}
    `);
    
    console.log(`✅ Found ${activities.length} activities in database`);
    if (activities.length > 0) {
      console.log('📋 Sample activity:', {
        id: activities[0].id,
        type: activities[0].type,
        action: activities[0].action,
        metadata: activities[0].metadata,
        metadataType: typeof activities[0].metadata
      });
    }
    
    // Transform the data
    const transformedActivities = activities.map(activity => {
      // Handle metadata parsing safely
      let metadata = {};
      if (activity.metadata) {
        try {
          // If it's already an object, use it directly
          if (typeof activity.metadata === 'object') {
            metadata = activity.metadata;
          } else {
            // If it's a string, parse it
            metadata = JSON.parse(activity.metadata);
          }
        } catch (error) {
          console.warn('Failed to parse metadata:', activity.metadata, error);
          metadata = {};
        }
      }

      return {
        id: activity.id,
        timestamp: activity.timestamp,
        type: activity.type,
        action: activity.action,
        priority: activity.priority,
        metadata: metadata,
        user: activity.user_id ? {
          id: activity.user_id,
          name: `${activity.user_first_name || ''} ${activity.user_last_name || ''}`.trim() || 'Unknown User',
          email: activity.user_email
        } : null,
        admin: activity.admin_id ? {
          id: activity.admin_id,
          name: activity.admin_name || 'Unknown Admin',
          email: activity.admin_email
        } : null,
        ipAddress: activity.ip_address,
        userAgent: activity.user_agent
      };
    });

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

// Get activity statistics - fetch real data
router.get('/stats', async (req, res) => {
  try {
    console.log('🔍 Fetching activity statistics from database...');
    
    // Initialize database connection
    await initializeDatabase();
    
    // Check if activity_logs table exists
    const tableCheck = await executeQuery(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'activity_logs'
    `);
    
    if (tableCheck[0].count === 0) {
      console.log('⚠️ activity_logs table does not exist, returning mock stats');
      return res.json({
        status: 'success',
        data: {
          total: 0,
          today: 0,
          thisWeek: 0,
          thisMonth: 0
        }
      });
    }
    
    // Get real statistics
    const totalResult = await executeQuery('SELECT COUNT(*) as total FROM activity_logs');
    const todayResult = await executeQuery(`
      SELECT COUNT(*) as today 
      FROM activity_logs 
      WHERE DATE(timestamp) = CURDATE()
    `);
    const weekResult = await executeQuery(`
      SELECT COUNT(*) as thisWeek 
      FROM activity_logs 
      WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `);
    const monthResult = await executeQuery(`
      SELECT COUNT(*) as thisMonth 
      FROM activity_logs 
      WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);
    
    res.json({
      status: 'success',
      data: {
        total: totalResult[0].total,
        today: todayResult[0].today,
        thisWeek: weekResult[0].thisWeek,
        thisMonth: monthResult[0].thisMonth
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching activity stats:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch activity stats',
      error: error.message
    });
  }
});

// Get activity types - simplified version
router.get('/types', (req, res) => {
  try {
    res.json({
      status: 'success',
      data: [
        'system_event',
        'user_action',
        'admin_action',
        'api_call',
        'error'
      ]
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
