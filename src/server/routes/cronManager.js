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
   * Body (optional): { dryRun: boolean } — for eNACH debit tasks only, dry run without charging
   *
   * eNACH debit tasks bypass ENACH_AUTO_DEBIT_ENABLED when triggered from admin (same as /cron/enach/run).
   */
  router.post('/task/:name/run', authenticateAdmin, async (req, res) => {
    try {
      const { name } = req.params;
      const dryRun = req.body && req.body.dryRun === true;

      const ENACH_DEBIT_TASKS = [
        'auto-enach-dpd-daily',
        'auto-enach-monthly-1st',
        'auto-enach-monthly-5th'
      ];

      if (ENACH_DEBIT_TASKS.includes(name)) {
        const { runAutoEnachDueDateJob } = require('../jobs/autoEnachDueDateJob');
        const result = await runAutoEnachDueDateJob({
          forceDryRun: dryRun,
          forceRun: !dryRun
        });
        return res.json({
          success: true,
          message: `Task "${name}" completed`,
          result
        });
      }

      if (name === 'auto-enach-pending-recheck') {
        const { runAutoEnachPendingRecheckJob } = require('../jobs/autoEnachDueDateJob');
        const result = await runAutoEnachPendingRecheckJob({ forceRun: true });
        return res.json({
          success: true,
          message: `Task "${name}" completed`,
          result
        });
      }

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
   * POST /api/admin/cron/enach/run
   * Manually trigger the eNACH auto-debit job with optional dry-run override.
   * Body: { dryRun: boolean }
   */
  router.post('/enach/run', authenticateAdmin, async (req, res) => {
    try {
      const dryRun = req.body && req.body.dryRun === true;
      const { runAutoEnachDueDateJob } = require('../jobs/autoEnachDueDateJob');
      // forceRun: true so admin live trigger works even when ENACH_AUTO_DEBIT_ENABLED=false
      const result = await runAutoEnachDueDateJob({ forceDryRun: dryRun, forceRun: !dryRun });
      res.json({
        success: true,
        dryRun,
        message: dryRun
          ? `eNACH dry run complete — ${result.scanned} loan(s) scanned, ${result.skipped} skipped`
          : `eNACH run complete — ${result.attempted} attempted, ${result.success} success, ${result.pending} pending, ${result.failed} failed`,
        result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `eNACH run failed: ${error.message}`
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

/**
 * GET /api/admin/cron/logs
 * Get list of available log files
 */
router.get('/logs', authenticateAdmin, async (req, res) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    const logDir = path.join(__dirname, '../log');
    
    // Get all log files
    const files = await fs.readdir(logDir);
    const logFiles = files
      .filter(file => file.startsWith('cron_') && file.endsWith('.log'))
      .map(file => {
        // Extract date from filename: cron_YYYYMMDD.log
        const dateStr = file.replace('cron_', '').replace('.log', '');
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        const date = new Date(`${year}-${month}-${day}`);
        
        return {
          filename: file,
          date: `${year}-${month}-${day}`,
          displayDate: date.toLocaleDateString('en-IN', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
          })
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date)); // Sort by date descending
    
    res.json({
      success: true,
      data: logFiles
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get log files',
      error: error.message
    });
  }
});

/**
 * GET /api/admin/cron/logs/:date
 * Get log entries for a specific date (YYYY-MM-DD format)
 */
router.get('/logs/:date', authenticateAdmin, async (req, res) => {
  try {
    const { date } = req.params;
    const fs = require('fs').promises;
    const path = require('path');
    const logDir = path.join(__dirname, '../log');
    
    // Convert YYYY-MM-DD to YYYYMMDD
    const dateStr = date.replace(/-/g, '');
    const logFilePath = path.join(logDir, `cron_${dateStr}.log`);
    
    try {
      const logContent = await fs.readFile(logFilePath, 'utf8');
      const lines = logContent.trim().split('\n').filter(line => line.trim());
      
      // Parse JSON log entries
      const entries = lines.map((line, index) => {
        try {
          return JSON.parse(line);
        } catch (e) {
          return {
            timestamp: new Date().toISOString(),
            level: 'INFO',
            message: line,
            parseError: true
          };
        }
      });
      
      res.json({
        success: true,
        data: {
          date,
          entries,
          totalEntries: entries.length
        }
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.json({
          success: true,
          data: {
            date,
            entries: [],
            totalEntries: 0
          }
        });
      }
      throw error;
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to read log file',
      error: error.message
    });
  }
});

/**
 * DELETE /api/admin/cron/logs
 * Delete old log files
 * Query params:
 *   - days: Delete logs older than N days (default: 30)
 *   - date: Delete logs for specific date (YYYY-MM-DD)
 */
router.delete('/logs', authenticateAdmin, async (req, res) => {
  try {
    const { days, date } = req.query;
    const fs = require('fs').promises;
    const path = require('path');
    const logDir = path.join(__dirname, '../log');
    
    let deletedFiles = [];
    
    if (date) {
      // Delete specific date log
      const dateStr = date.replace(/-/g, '');
      const logFilePath = path.join(logDir, `cron_${dateStr}.log`);
      
      try {
        await fs.unlink(logFilePath);
        deletedFiles.push(`cron_${dateStr}.log`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
    } else {
      // Delete logs older than N days
      const daysToKeep = parseInt(days) || 30;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      const files = await fs.readdir(logDir);
      const logFiles = files.filter(file => file.startsWith('cron_') && file.endsWith('.log'));
      
      for (const file of logFiles) {
        // Extract date from filename
        const dateStr = file.replace('cron_', '').replace('.log', '');
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        const fileDate = new Date(`${year}-${month}-${day}`);
        
        if (fileDate < cutoffDate) {
          const logFilePath = path.join(logDir, file);
          await fs.unlink(logFilePath);
          deletedFiles.push(file);
        }
      }
    }
    
    res.json({
      success: true,
      message: `Deleted ${deletedFiles.length} log file(s)`,
      data: {
        deletedFiles,
        count: deletedFiles.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete log files',
      error: error.message
    });
  }
});

module.exports = router;

