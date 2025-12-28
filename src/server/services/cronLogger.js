/**
 * Cron Logger - File-based logging for cron jobs
 * 
 * Logs all cron job activities to date-based log files
 * Format: log/cron_YYYYMMDD.log
 */

const fs = require('fs').promises;
const path = require('path');

class CronLogger {
  constructor() {
    this.logDir = path.join(__dirname, '../../log');
    this.ensureLogDirectory();
  }

  /**
   * Ensure log directory exists
   */
  async ensureLogDirectory() {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      // Directory might already exist, ignore error
    }
  }

  /**
   * Get today's log file path
   */
  getLogFilePath() {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
    return path.join(this.logDir, `cron_${dateStr}.log`);
  }

  /**
   * Format log message with timestamp
   */
  formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...(data && { data })
    };
    return JSON.stringify(logEntry) + '\n';
  }

  /**
   * Write log to file
   */
  async writeLog(level, message, data = null) {
    try {
      await this.ensureLogDirectory();
      const logFilePath = this.getLogFilePath();
      const logEntry = this.formatMessage(level, message, data);
      await fs.appendFile(logFilePath, logEntry, 'utf8');
    } catch (error) {
      // Fallback to console if file write fails
      console.error(`[CRON LOGGER ERROR] Failed to write log:`, error.message);
      console.log(`[${level}] ${message}`, data || '');
    }
  }

  /**
   * Log info message
   */
  async info(message, data = null) {
    await this.writeLog('INFO', message, data);
  }

  /**
   * Log warning message
   */
  async warn(message, data = null) {
    await this.writeLog('WARN', message, data);
  }

  /**
   * Log error message
   */
  async error(message, error = null) {
    const errorData = error ? {
      message: error.message,
      stack: error.stack
    } : null;
    await this.writeLog('ERROR', message, errorData);
  }

  /**
   * Log debug message
   */
  async debug(message, data = null) {
    await this.writeLog('DEBUG', message, data);
  }

  /**
   * Log task start
   */
  async taskStart(taskName, schedule) {
    await this.info(`Task started: "${taskName}"`, { schedule });
  }

  /**
   * Log task completion
   */
  async taskComplete(taskName, duration, stats = null) {
    await this.info(`Task completed: "${taskName}"`, {
      duration: `${duration}ms`,
      ...stats
    });
  }

  /**
   * Log task error
   */
  async taskError(taskName, error, duration = null) {
    await this.error(`Task failed: "${taskName}"`, {
      error: error.message,
      stack: error.stack,
      duration: duration ? `${duration}ms` : null
    });
  }
}

// Export singleton instance
const cronLogger = new CronLogger();

module.exports = cronLogger;

