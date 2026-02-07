/**
 * Cron Job: Update Overdue Loans
 * 
 * This job runs daily to automatically move loans from 'account_manager' status
 * to 'overdue' status when DPD (Days Past Due) > 5 (i.e., DPD >= 6)
 * 
 * DPD Calculation:
 * - DPD = Current Date - Due Date
 * - If DPD > 5, loan should be marked as overdue
 */

const { executeQuery, initializeDatabase } = require('../config/database');
const cronLogger = require('../services/cronLogger');

async function updateOverdueLoans() {
  const startTime = Date.now();
  let updatedCount = 0;
  let errorCount = 0;

  try {
    await initializeDatabase();
    cronLogger.info('Starting overdue loans update job').catch(() => {});

    // Find all loans in 'account_manager' status that have DPD > 5
    // DPD = Current Date - Due Date (processed_due_date)
    const query = `
      SELECT 
        la.id,
        la.application_number,
        la.user_id,
        la.processed_due_date,
        la.status,
        DATEDIFF(CURDATE(), la.processed_due_date) as dpd
      FROM loan_applications la
      WHERE la.status = 'account_manager'
        AND la.processed_due_date IS NOT NULL
        AND DATEDIFF(CURDATE(), la.processed_due_date) > 5
      ORDER BY la.id
    `;

    const loans = await executeQuery(query, []);

    if (!loans || loans.length === 0) {
      cronLogger.info('No loans found to update to overdue status').catch(() => {});
      return { success: true, updatedCount: 0, errorCount: 0 };
    }

    cronLogger.info(`Found ${loans.length} loan(s) to update to overdue status`).catch(() => {});

    // Update each loan to 'overdue' status
    for (const loan of loans) {
      try {
        const updateQuery = `
          UPDATE loan_applications
          SET status = 'overdue',
              updated_at = NOW()
          WHERE id = ?
        `;

        await executeQuery(updateQuery, [loan.id]);

        try {
          const { assignRecoveryOfficerForLoan } = require('../services/adminAssignmentService');
          await assignRecoveryOfficerForLoan(loan.id);
        } catch (assignErr) {
          console.error('Assign recovery officer for overdue loan failed:', assignErr);
        }

        updatedCount++;
        cronLogger.info(`Updated loan #${loan.id} (${loan.application_number}) to overdue status (DPD: ${loan.dpd})`).catch(() => {});

      } catch (error) {
        errorCount++;
        cronLogger.error(`Error updating loan #${loan.id} to overdue: ${error.message}`, error).catch(() => {});
        console.error(`Error updating loan #${loan.id} to overdue:`, error);
      }
    }

    const duration = Date.now() - startTime;
    cronLogger.info(`Overdue loans update job completed: ${updatedCount} updated, ${errorCount} errors, ${duration}ms`).catch(() => {});

    return {
      success: true,
      updatedCount,
      errorCount,
      duration
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    cronLogger.error(`Overdue loans update job failed: ${error.message}`, error).catch(() => {});
    console.error('Overdue loans update job failed:', error);

    return {
      success: false,
      updatedCount,
      errorCount,
      duration,
      error: error.message
    };
  }
}

// Run if called directly (for testing)
if (require.main === module) {
  updateOverdueLoans()
    .then((result) => {
      console.log('Job completed:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Job failed:', error);
      process.exit(1);
    });
}

module.exports = { updateOverdueLoans };
