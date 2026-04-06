const cronLogger = require('../services/cronLogger');
const {
  runDueDateAutoDebit,
  recheckPendingAutoDebitCharges
} = require('../services/enachAutoDebitService');

async function runAutoEnachDueDateJob() {
  const start = Date.now();
  try {
    const result = await runDueDateAutoDebit();
    await cronLogger.info(`Auto eNACH due-date job completed in ${Date.now() - start}ms`, result);
    return { success: true, ...result, duration: Date.now() - start };
  } catch (error) {
    await cronLogger.error(`Auto eNACH due-date job failed: ${error.message}`, error);
    return { success: false, error: error.message, duration: Date.now() - start };
  }
}

async function runAutoEnachPendingRecheckJob() {
  const start = Date.now();
  try {
    const result = await recheckPendingAutoDebitCharges();
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
