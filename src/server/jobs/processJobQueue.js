/**
 * Process job queue - runs on a schedule and sends queued SMS (e.g. account manager assigned)
 * so the API doesn't block on 100–1000 messages.
 */

const cronLogger = require('../services/cronLogger');
const { processAccManagerAssignedSmsBatch } = require('../services/jobQueueService');

async function runProcessJobQueue() {
  const start = Date.now();
  try {
    const result = await processAccManagerAssignedSmsBatch();
    if (result.processed > 0 || result.failed > 0) {
      await cronLogger.info(
        `Job queue: acc_manager_assigned_sms batch done in ${Date.now() - start}ms`,
        { processed: result.processed, failed: result.failed }
      );
    }
    return { success: true, ...result, duration: Date.now() - start };
  } catch (err) {
    await cronLogger.error(`Job queue: ${err.message}`, err);
    return { success: false, error: err.message, duration: Date.now() - start };
  }
}

module.exports = { runProcessJobQueue };
