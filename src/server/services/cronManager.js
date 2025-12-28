/**
 * Cron Manager - Laravel-style Task Scheduler
 * 
 * Manages all scheduled tasks (cron jobs) in the application.
 * Similar to Laravel's Task Scheduler.
 * 
 * Usage:
 *   const cronManager = require('./services/cronManager');
 *   
 *   cronManager.schedule('0 0 * * *', 'daily-loan-calculation', async () => {
 *     // Your task logic
 *   });
 *   
 *   cronManager.start();
 */

const cron = require('node-cron');
const cronLogger = require('./cronLogger');

class CronManager {
  constructor() {
    this.tasks = new Map();
    this.scheduledTasks = new Map();
    this.isRunning = false;
  }

  /**
   * Schedule a task
   * @param {string} schedule - Cron expression (e.g., '0 0 * * *' for daily at midnight)
   * @param {string} name - Unique name for the task
   * @param {Function} task - Async function to execute
   * @param {Object} options - Additional options
   * @param {boolean} options.enabled - Whether task is enabled (default: true)
   * @param {string} options.timezone - Timezone (default: 'Asia/Kolkata' for IST)
   * @param {boolean} options.runOnInit - Run immediately on start (default: false)
   */
  schedule(schedule, name, task, options = {}) {
    const {
      enabled = true,
      timezone = 'Asia/Kolkata',
      runOnInit = false
    } = options;

    if (this.tasks.has(name)) {
      cronLogger.warn(`Task "${name}" already exists. Overwriting...`).catch(() => {});
    }

    this.tasks.set(name, {
      schedule,
      task,
      enabled,
      timezone,
      runOnInit,
      lastRun: null,
      nextRun: null,
      runCount: 0,
      errorCount: 0,
      lastError: null
    });

    cronLogger.info(`Scheduled task: "${name}"`, { schedule, timezone }).catch(() => {});

    // If manager is already running, schedule immediately
    if (this.isRunning) {
      this._scheduleTask(name);
    }
  }

  /**
   * Schedule a task to run daily at specific time
   * @param {string} time - Time in HH:MM format (e.g., '00:01' for 12:01 AM)
   * @param {string} name - Task name
   * @param {Function} task - Task function
   * @param {Object} options - Options
   */
  daily(time, name, task, options = {}) {
    const [hours, minutes] = time.split(':');
    const schedule = `${minutes} ${hours} * * *`;
    this.schedule(schedule, name, task, options);
  }

  /**
   * Schedule a task to run hourly
   * @param {number} minute - Minute of the hour (0-59)
   * @param {string} name - Task name
   * @param {Function} task - Task function
   * @param {Object} options - Options
   */
  hourly(minute = 0, name, task, options = {}) {
    const schedule = `${minute} * * * *`;
    this.schedule(schedule, name, task, options);
  }

  /**
   * Schedule a task to run every N minutes
   * @param {number} minutes - Interval in minutes
   * @param {string} name - Task name
   * @param {Function} task - Task function
   * @param {Object} options - Options
   */
  everyMinutes(minutes, name, task, options = {}) {
    const schedule = `*/${minutes} * * * *`;
    this.schedule(schedule, name, task, options);
  }

  /**
   * Schedule a task to run every N hours
   * @param {number} hours - Interval in hours
   * @param {string} name - Task name
   * @param {Function} task - Task function
   * @param {Object} options - Options
   */
  everyHours(hours, name, task, options = {}) {
    const schedule = `0 */${hours} * * *`;
    this.schedule(schedule, name, task, options);
  }

  /**
   * Schedule a task to run weekly
   * @param {number} dayOfWeek - Day of week (0-6, 0 = Sunday)
   * @param {string} time - Time in HH:MM format
   * @param {string} name - Task name
   * @param {Function} task - Task function
   * @param {Object} options - Options
   */
  weekly(dayOfWeek, time, name, task, options = {}) {
    const [hours, minutes] = time.split(':');
    const schedule = `${minutes} ${hours} * * ${dayOfWeek}`;
    this.schedule(schedule, name, task, options);
  }

  /**
   * Schedule a task to run monthly
   * @param {number} dayOfMonth - Day of month (1-31)
   * @param {string} time - Time in HH:MM format
   * @param {string} name - Task name
   * @param {Function} task - Task function
   * @param {Object} options - Options
   */
  monthly(dayOfMonth, time, name, task, options = {}) {
    const [hours, minutes] = time.split(':');
    const schedule = `${minutes} ${hours} ${dayOfMonth} * *`;
    this.schedule(schedule, name, task, options);
  }

  /**
   * Internal method to schedule a task with node-cron
   */
  _scheduleTask(name) {
    const taskConfig = this.tasks.get(name);
    if (!taskConfig) {
      cronLogger.error(`Task "${name}" not found`).catch(() => {});
      return;
    }

    if (!taskConfig.enabled) {
      cronLogger.info(`Task "${name}" is disabled`).catch(() => {});
      return;
    }

    // Remove existing scheduled task if any
    if (this.scheduledTasks.has(name)) {
      this.scheduledTasks.get(name).stop();
      this.scheduledTasks.delete(name);
    }

    // Create new cron task
    const cronTask = cron.schedule(
      taskConfig.schedule,
      async () => {
        await this._executeTask(name);
      },
      {
        scheduled: true,
        timezone: taskConfig.timezone
      }
    );

    this.scheduledTasks.set(name, cronTask);

    // Calculate next run time
    this._calculateNextRun(name);

    // Run on init if requested
    if (taskConfig.runOnInit) {
      cronLogger.info(`Running task "${name}" on init...`).catch(() => {});
      setImmediate(() => this._executeTask(name));
    }
  }

  /**
   * Execute a task
   */
  async _executeTask(name) {
    const taskConfig = this.tasks.get(name);
    if (!taskConfig) {
      return;
    }

    const startTime = Date.now();
    await cronLogger.taskStart(name, taskConfig.schedule);

    try {
      await taskConfig.task();
      
      const duration = Date.now() - startTime;
      taskConfig.lastRun = new Date();
      taskConfig.runCount++;
      this._calculateNextRun(name);

      await cronLogger.taskComplete(name, duration, {
        runCount: taskConfig.runCount,
        errorCount: taskConfig.errorCount
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      taskConfig.lastError = {
        message: error.message,
        stack: error.stack,
        timestamp: new Date()
      };
      taskConfig.errorCount++;

      await cronLogger.taskError(name, error, duration);
    }
  }

  /**
   * Calculate next run time for a task
   */
  _calculateNextRun(name) {
    const taskConfig = this.tasks.get(name);
    if (!taskConfig) return;

    // Simple calculation - node-cron doesn't provide next run directly
    // This is a placeholder - you might want to use a library like 'cron-parser'
    // For now, we'll just note that it's scheduled
    taskConfig.nextRun = 'Scheduled';
  }

  /**
   * Start the cron manager
   */
  async start() {
    if (this.isRunning) {
      cronLogger.warn('Cron manager is already running');
      return;
    }

    await cronLogger.info('Starting Cron Manager...', { totalTasks: this.tasks.size });

    // Schedule all tasks
    for (const [name] of this.tasks) {
      this._scheduleTask(name);
    }

    this.isRunning = true;
    await cronLogger.info('Cron Manager started', { totalTasks: this.tasks.size });
  }

  /**
   * Stop the cron manager
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    await cronLogger.info('Stopping Cron Manager...');

    // Stop all scheduled tasks
    for (const [name, cronTask] of this.scheduledTasks) {
      cronTask.stop();
      await cronLogger.info(`Stopped task: "${name}"`);
    }

    this.scheduledTasks.clear();
    this.isRunning = false;
    await cronLogger.info('Cron Manager stopped');
  }

  /**
   * Get task status
   */
  getTaskStatus(name) {
    const taskConfig = this.tasks.get(name);
    if (!taskConfig) {
      return null;
    }

    return {
      name,
      schedule: taskConfig.schedule,
      enabled: taskConfig.enabled,
      timezone: taskConfig.timezone,
      lastRun: taskConfig.lastRun,
      nextRun: taskConfig.nextRun,
      runCount: taskConfig.runCount,
      errorCount: taskConfig.errorCount,
      lastError: taskConfig.lastError
    };
  }

  /**
   * Get all tasks status
   */
  getAllTasksStatus() {
    const status = [];
    for (const [name] of this.tasks) {
      status.push(this.getTaskStatus(name));
    }
    return status;
  }

  /**
   * Enable a task
   */
  async enable(name) {
    const taskConfig = this.tasks.get(name);
    if (taskConfig) {
      taskConfig.enabled = true;
      if (this.isRunning) {
        this._scheduleTask(name);
      }
      await cronLogger.info(`Task "${name}" enabled`);
    }
  }

  /**
   * Disable a task
   */
  async disable(name) {
    const taskConfig = this.tasks.get(name);
    if (taskConfig) {
      taskConfig.enabled = false;
      if (this.scheduledTasks.has(name)) {
        this.scheduledTasks.get(name).stop();
        this.scheduledTasks.delete(name);
      }
      await cronLogger.info(`Task "${name}" disabled`);
    }
  }

  /**
   * Run a task manually
   */
  async run(name) {
    const taskConfig = this.tasks.get(name);
    if (!taskConfig) {
      throw new Error(`Task "${name}" not found`);
    }

    if (!taskConfig.enabled) {
      throw new Error(`Task "${name}" is disabled`);
    }

    await cronLogger.info(`Manually running task: "${name}"`);
    await this._executeTask(name);
  }
}

// Export singleton instance
const cronManager = new CronManager();

module.exports = cronManager;

