/**
 * Loan Calculation Cron Job
 * 
 * Calculates and updates interest and penalty for active loans.
 * Runs every 4 hours as per user requirement.
 * 
 * This job:
 * 1. Finds all loans with status 'account_manager' that haven't been calculated today
 * 2. Skips loans already calculated today to reduce load
 * 3. Calculates interest from last_calculated_at (or processed_at) to today
 * 4. Calculates penalty if loan is overdue
 * 5. Updates processed_interest and processed_penalty
 * 6. Updates last_calculated_at
 * 
 * Note: Only processes 'account_manager' status loans. 'cleared' loans are fully paid
 * and don't need interest/penalty calculation.
 */

const { executeQuery } = require('../config/database');
const cronLogger = require('../services/cronLogger');
const { toDecimal2, parseDateToString, calculateAggregatedOverduePenalty } = require('../utils/loanCalculations');

/**
 * Parse due dates from processed_due_date field
 * Handles both single date string and JSON array
 */
function parseDueDates(processedDueDate) {
  if (!processedDueDate) {
    return [];
  }

  try {
    // Try parsing as JSON first
    const parsed = typeof processedDueDate === 'string' 
      ? JSON.parse(processedDueDate) 
      : processedDueDate;
    
    // Convert to array if single date
    if (!Array.isArray(parsed)) {
      return [parsed];
    }
    
    return parsed;
  } catch (e) {
    // If not JSON, treat as single date string
    return [processedDueDate];
  }
}

/**
 * Calculate days between two dates (inclusive)
 */
function calculateDaysInclusive(startDate, endDate) {
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);
  return Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Main loan calculation job
 */
async function calculateLoanInterestAndPenalty() {
  try {
    await cronLogger.info('Starting loan calculation job (runs every 4 hours)...');
    const startTime = Date.now();

    // Get current date (IST - server time is IST)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all processed loans with account_manager status only
    // Skip loans that were already calculated today to reduce load
    // Note: 'cleared' loans are fully paid, no need to calculate interest/penalty
    const processedLoans = await executeQuery(`
      SELECT 
        id,
        user_id,
        processed_at,
        processed_amount,
        processed_due_date,
        processed_interest,
        processed_penalty,
        last_calculated_at,
        plan_snapshot,
        late_fee_structure,
        status
      FROM loan_applications
      WHERE processed_at IS NOT NULL
        AND status = 'account_manager'
        AND (
          last_calculated_at IS NULL 
          OR DATE(last_calculated_at) < DATE(NOW())
        )
      ORDER BY id ASC
    `);

    await cronLogger.info(`Found ${processedLoans.length} processed loans to calculate`);

    let successCount = 0;
    let errorCount = 0;

    for (const loan of processedLoans) {
      try {
        // Determine calculation start date
        // Parse date as string first to avoid timezone conversion
        let lastCalcDate;
        const dateSource = loan.last_calculated_at || loan.processed_at;
        if (dateSource) {
          const dateStr = parseDateToString(dateSource);
          if (dateStr) {
            const [year, month, day] = dateStr.split('-').map(Number);
            lastCalcDate = new Date(year, month - 1, day);
          } else {
            lastCalcDate = new Date();
          }
        } else {
          lastCalcDate = new Date();
        }
        lastCalcDate.setHours(0, 0, 0, 0);

        // Calculate days (inclusive)
        const days = calculateDaysInclusive(lastCalcDate, today);

        if (days <= 0) {
          await cronLogger.debug(`Skipping loan #${loan.id} - no days to calculate (already up to date)`);
          continue;
        }

        // Get interest rate from plan snapshot
        let planSnapshot = {};
        try {
          planSnapshot = typeof loan.plan_snapshot === 'string'
            ? JSON.parse(loan.plan_snapshot)
            : loan.plan_snapshot || {};
        } catch (e) {
          await cronLogger.error(`Error parsing plan_snapshot for loan #${loan.id}`, e);
          errorCount++;
          continue;
        }

        const interestRatePerDay = parseFloat(planSnapshot.interest_percent_per_day || 0.001);
        const principal = parseFloat(loan.processed_amount || 0);

        if (principal <= 0) {
          await cronLogger.debug(`Skipping loan #${loan.id} - invalid principal amount`);
          continue;
        }

        // Calculate interest for the period
        const interestForPeriod = toDecimal2(principal * interestRatePerDay * days);
        const newInterest = toDecimal2((loan.processed_interest || 0) + interestForPeriod);

        // Calculate penalty if overdue
        // CRITICAL: Penalties should be calculated from SCRATCH each time based on total days overdue
        // NOT added incrementally (which would cause double-counting)
        // IMPORTANT: Use late_fee_structure from database, not hardcoded values
        let newPenalty = 0;
        const dueDates = parseDueDates(loan.processed_due_date);
        
        if (dueDates.length > 0) {
          // Parse late_fee_structure from loan or plan snapshot
          let lateFeeStructure = null;
          try {
            if (loan.late_fee_structure) {
              lateFeeStructure = typeof loan.late_fee_structure === 'string' 
                ? JSON.parse(loan.late_fee_structure) 
                : loan.late_fee_structure;
            } else if (planSnapshot && planSnapshot.late_fee_structure) {
              lateFeeStructure = typeof planSnapshot.late_fee_structure === 'string'
                ? JSON.parse(planSnapshot.late_fee_structure)
                : planSnapshot.late_fee_structure;
            }
          } catch (e) {
            await cronLogger.error(`Error parsing late_fee_structure for loan #${loan.id}`, e);
          }
          
          const penaltyCalc = calculateAggregatedOverduePenalty(principal, dueDates, today, lateFeeStructure);
          newPenalty = toDecimal2(penaltyCalc.penaltyTotal);
          if (penaltyCalc.penaltyTotal > 0) {
            await cronLogger.debug(`Loan #${loan.id}: overdue instalment(s), Penalty: ₹${penaltyCalc.penaltyBase} + GST ₹${penaltyCalc.penaltyGST} = ₹${newPenalty}`);
          }
        }

        // Update loan with new calculations
        await executeQuery(`
          UPDATE loan_applications
          SET 
            processed_interest = ?,
            processed_penalty = ?,
            last_calculated_at = NOW(),
            updated_at = NOW()
          WHERE id = ?
        `, [newInterest, newPenalty, loan.id]);

        successCount++;
        
        if (successCount % 10 === 0) {
          await cronLogger.debug(`Processed ${successCount} loans...`);
        }

      } catch (error) {
        await cronLogger.error(`Error calculating loan #${loan.id}`, error);
        errorCount++;
      }
    }

    const duration = Date.now() - startTime;
    await cronLogger.info('Loan calculation job completed', {
      totalLoans: processedLoans.length,
      success: successCount,
      errors: errorCount,
      skipped: processedLoans.length - successCount - errorCount,
      duration: `${duration}ms`
    });

  } catch (error) {
    await cronLogger.error('Fatal error in loan calculation job', error);
    throw error;
  }
}

module.exports = {
  calculateLoanInterestAndPenalty
};

