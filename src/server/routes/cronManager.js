/**
 * Cron Manager Admin Routes
 * 
 * Provides admin endpoints to view and manage cron jobs
 */

const express = require('express');
const { authenticateAdmin } = require('../middleware/auth');
const cronManager = require('../services/cronManager');

const router = express.Router();

/**
 * GET /api/admin/cron/status
 * Get status of all cron jobs
 */
router.get('/status', authenticateAdmin, async (req, res) => {
  try {
    const tasks = cronManager.getAllTasksStatus();
    
    res.json({
      success: true,
      data: {
        isRunning: cronManager.isRunning,
        totalTasks: tasks.length,
        tasks: tasks
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get cron status',
      error: error.message
    });
  }
});

/**
 * GET /api/admin/cron/task/:name
 * Get status of a specific cron job
 */
router.get('/task/:name', authenticateAdmin, async (req, res) => {
  try {
    const { name } = req.params;
    const taskStatus = cronManager.getTaskStatus(name);
    
    if (!taskStatus) {
      return res.status(404).json({
        success: false,
        message: `Task "${name}" not found`
      });
    }
    
    res.json({
      success: true,
      data: taskStatus
    });
  } catch (error) {
    console.error('Error getting task status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get task status',
      error: error.message
    });
  }
});

  /**
   * POST /api/admin/cron/task/:name/run
   * Manually run a cron job
   */
  router.post('/task/:name/run', authenticateAdmin, async (req, res) => {
    try {
      const { name } = req.params;
      
      await cronManager.run(name);
      
      res.json({
        success: true,
        message: `Task "${name}" executed successfully`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Failed to run task: ${error.message}`
      });
    }
  });

  /**
   * POST /api/admin/cron/task/:name/enable
   * Enable a cron job
   */
  router.post('/task/:name/enable', authenticateAdmin, async (req, res) => {
    try {
      const { name } = req.params;
      await cronManager.enable(name);
      
      res.json({
        success: true,
        message: `Task "${name}" enabled`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Failed to enable task: ${error.message}`
      });
    }
  });

  /**
   * POST /api/admin/cron/task/:name/disable
   * Disable a cron job
   */
  router.post('/task/:name/disable', authenticateAdmin, async (req, res) => {
    try {
      const { name } = req.params;
      await cronManager.disable(name);
      
      res.json({
        success: true,
        message: `Task "${name}" disabled`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Failed to disable task: ${error.message}`
      });
    }
  });

module.exports = router;

