/**
 * Jobs Index - Register all cron jobs here
 * 
 * This file imports and registers all scheduled jobs with the cron manager.
 * Similar to Laravel's app/Console/Kernel.php
 */

const cronManager = require('../services/cronManager');
const cronLogger = require('../services/cronLogger');
const { calculateLoanInterestAndPenalty } = require('./loanCalculationJob');
const { updateOverdueLoans } = require('./updateOverdueLoans');
const { runSMSNotificationJob } = require('./smsNotificationJob');
const { runSyncTempAssignments } = require('./syncTempAssignmentsJob');

/**
 * Register all scheduled jobs
 * 
 * This function should be called during server startup
 */
async function registerJobs() {
  await cronLogger.info('Registering scheduled jobs...');

  // Loan Calculation Job - Runs every 4 hours
  // Skips loans that were already calculated today to reduce load
  cronManager.everyHours(4, 'loan-calculation', async () => {
    await calculateLoanInterestAndPenalty();
  }, {
    timezone: 'Asia/Kolkata', // IST
    runOnInit: false // Don't run on server start
  });

  // Overdue Loans Update Job - Runs daily at 00:01 IST
  // Moves loans from 'account_manager' to 'overdue' status when DPD > 5
  cronManager.daily('00:01', 'update-overdue-loans', async () => {
    await updateOverdueLoans();
  }, {
    timezone: 'Asia/Kolkata', // IST
    runOnInit: false // Don't run on server start
  });

  // Sync temp assignments (leave cover) - daily at 00:05 IST
  // Clears temp_assigned when leave date range ends; applies temp cover when on leave
  cronManager.daily('00:05', 'sync-temp-assignments', async () => {
    await runSyncTempAssignments();
  }, {
    timezone: 'Asia/Kolkata', // IST
    runOnInit: false
  });

  // SMS Notification Job - DISABLED (OneXtel API authentication needs configuration)
  // Uncomment when SMS API is properly configured
  // cronManager.everyMinutes(1, 'sms-notifications', async () => {
  //   await runSMSNotificationJob();
  // }, {
  //   timezone: 'Asia/Kolkata', // IST
  //   runOnInit: false // Don't run on server start
  // });

  // Add more jobs here as needed
  // Example:
  // cronManager.hourly(0, 'hourly-task', async () => {
  //   // Your hourly task
  // });
  
  // cronManager.everyMinutes(15, 'quarterly-task', async () => {
  //   // Your task that runs every 15 minutes
  // });

  await cronLogger.info(`Registered ${cronManager.tasks.size} scheduled job(s)`);
}

module.exports = {
  registerJobs
};

