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
const { runProcessJobQueue } = require('./processJobQueue');
const { runAutoEnachDueDateJob, runAutoEnachPendingRecheckJob } = require('./autoEnachDueDateJob');

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

  // Job queue worker - process queued SMS (e.g. account manager assigned) every minute
  cronManager.everyMinutes(1, 'process-job-queue', async () => {
    await runProcessJobQueue();
  }, {
    timezone: 'Asia/Kolkata',
    runOnInit: false
  });

  // SMS Notification Job
  // Ensure OneXtel API keys are configured in .env
  cronManager.everyMinutes(1, 'sms-notifications', async () => {
    await runSMSNotificationJob();
  }, {
    timezone: 'Asia/Kolkata', // IST
    runOnInit: false // Don't run on server start
  });

  // ── Auto eNACH mandate presentation ──────────────────────────────────────
  // Controlled by ENACH_AUTO_DEBIT_ENABLED and ENACH_AUTO_DEBIT_DRY_RUN
  //
  // Presentation rules:
  //   • Eligibility : DPD ≥ 1 on an active loan with a valid mandate
  //   • EMI order   : always present EMI 1 until cleared, then EMI 2 (Case 1 / Case 2)
  //   • Amount      : full outstanding = base instalment + accrued penalty for that EMI
  //   • Idempotency : one presentation attempt per EMI per IST calendar day
  //
  // Four scheduled windows (all IST / Asia/Kolkata):
  //   1. Every day at 18:59  – catches DPD = 1 on due-date day + salary-date customers
  //   2. 1st of month 04:00  – early morning window on 1st of month
  //   3. 5th of month 04:00  – early morning window on 5th of month

  // Window 1: daily at 18:59 IST
  cronManager.daily('18:59', 'auto-enach-dpd-daily', async () => {
    await runAutoEnachDueDateJob();
  }, {
    timezone: 'Asia/Kolkata',
    runOnInit: false
  });

  // Window 2: 1st of every month at 04:00 IST
  cronManager.monthly(1, '04:00', 'auto-enach-monthly-1st', async () => {
    await runAutoEnachDueDateJob();
  }, {
    timezone: 'Asia/Kolkata',
    runOnInit: false
  });

  // Window 3: 5th of every month at 04:00 IST
  cronManager.monthly(5, '04:00', 'auto-enach-monthly-5th', async () => {
    await runAutoEnachDueDateJob();
  }, {
    timezone: 'Asia/Kolkata',
    runOnInit: false
  });

  // Recheck pending eNACH charges and settle successful ones (every 20 min)
  cronManager.everyMinutes(20, 'auto-enach-pending-recheck', async () => {
    await runAutoEnachPendingRecheckJob();
  }, {
    timezone: 'Asia/Kolkata',
    runOnInit: false
  });

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

