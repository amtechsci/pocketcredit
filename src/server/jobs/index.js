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

