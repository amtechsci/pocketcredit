const cronLogger = require('../services/cronLogger');
const {
  runDueDateAutoDebit,
  recheckPendingAutoDebitCharges
} = require('../services/enachAutoDebitService');

/**
 * @param {object} [options]
 * @param {boolean} [options.forceDryRun] - When true runs in dry-run mode regardless of env
 * @param {boolean} [options.forceRun]    - When true bypasses ENACH_AUTO_DEBIT_ENABLED=false
 */
async function runAutoEnachDueDateJob(options = {}) {
  const start = Date.now();
  try {
    const result = await runDueDateAutoDebit(options);
    await cronLogger.info(
      `Auto eNACH due-date job completed in ${Date.now() - start}ms` +
      (result.dryRun ? ' [DRY RUN]' : ''),
      result
    );
    return { success: true, ...result, duration: Date.now() - start };
  } catch (error) {
    await cronLogger.error(`Auto eNACH due-date job failed: ${error.message}`, error);
    return { success: false, error: error.message, duration: Date.now() - start };
  }
}

/**
 * @param {object} [options]
 * @param {boolean} [options.forceRun] - When true bypasses ENACH_AUTO_DEBIT_ENABLED / DRY_RUN (admin manual trigger)
 */
async function runAutoEnachPendingRecheckJob(options = {}) {
  const start = Date.now();
  try {
    const result = await recheckPendingAutoDebitCharges(options);
    await cronLogger.info(`Auto eNACH pending recheck completed in ${Date.now() - start}ms`, result);
    return { success: true, ...result, duration: Date.now() - start };
  } catch (error) {
    await cronLogger.error(`Auto eNACH pending recheck failed: ${error.message}`, error);
    return { success: false, error: error.message, duration: Date.now() - start };
  }
}

module.exports = {
  runAutoEnachDueDateJob,
  runAutoEnachPendingRecheckJob
};
