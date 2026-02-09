/**
 * Cron Job: Sync temp assignments (leave cover)
 *
 * Runs daily so that when an admin's leave date range ends, their temp_assigned_*
 * is cleared and loans show back under them. Also applies when weekly off / date
 * range starts (admins on leave get temp cover assigned).
 */

const { syncTempAssignmentsForCategory } = require('../services/adminAssignmentService');
const cronLogger = require('../services/cronLogger');

const CATEGORIES = ['verify_user', 'qa_user', 'account_manager', 'recovery_officer'];

async function runSyncTempAssignments() {
  try {
    for (const category of CATEGORIES) {
      await syncTempAssignmentsForCategory(category);
    }
    await cronLogger.info('Sync temp assignments job completed').catch(() => {});
  } catch (err) {
    await cronLogger.error('Sync temp assignments job failed: ' + err.message, err).catch(() => {});
  }
}

module.exports = { runSyncTempAssignments };
