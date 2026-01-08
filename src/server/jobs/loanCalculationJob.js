/**
 * Loan Calculation Cron Job
 * 
 * Calculates and updates interest and penalty for all processed loans.
 * Runs every 4 hours as per user requirement.
 * 
 * This job:
 * 1. Finds all loans with processed_at IS NOT NULL that haven't been calculated today
 * 2. Skips loans already calculated today to reduce load
 * 3. Calculates interest from last_calculated_at (or processed_at) to today
 * 4. Calculates penalty if loan is overdue
 * 5. Updates processed_interest and processed_penalty
 * 6. Updates last_calculated_at
 */

const { executeQuery } = require('../config/database');
const cronLogger = require('../services/cronLogger');

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
 * Check if a date is overdue
 */
function isOverdue(dueDateStr, today) {
  const dueDate = new Date(dueDateStr);
  dueDate.setHours(0, 0, 0, 0);
  return today > dueDate;
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
 * Calculate penalty for overdue loan
 * Based on LOAN_CALCULATION_RULEBOOK.md:
 * - Late payment fee: 4% of overdue principal + 18% GST (one-time on first day)
 * - Daily penalty: 0.2% of overdue principal + 18% GST per day (from second day onwards)
 */
function calculatePenalty(principal, daysOverdue, hasLateFee = false) {
  if (daysOverdue <= 0) {
    return 0;
  }

  let penalty = 0;

  // Late payment fee (one-time on first day)
  if (daysOverdue >= 1 && !hasLateFee) {
    const lateFee = principal * 0.04; // 4%
    const lateFeeGST = lateFee * 0.18; // 18% GST
    penalty += lateFee + lateFeeGST;
  }

  // Daily penalty (from second day onwards)
  if (daysOverdue > 1) {
    const dailyPenaltyDays = daysOverdue - 1; // Days after first day
    const dailyPenaltyPerDay = principal * 0.002; // 0.2% per day
    const dailyPenaltyGST = dailyPenaltyPerDay * 0.18; // 18% GST
    const totalDailyPenalty = (dailyPenaltyPerDay + dailyPenaltyGST) * dailyPenaltyDays;
    penalty += totalDailyPenalty;
  }

  return Math.round(penalty * 100) / 100; // Round to 2 decimals
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

    // Get all processed loans (active loans)
    // Skip loans that were already calculated today to reduce load
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
        status
      FROM loan_applications
      WHERE processed_at IS NOT NULL
        AND status IN ('account_manager', 'cleared', 'active')
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
        const lastCalcDate = loan.last_calculated_at 
          ? new Date(loan.last_calculated_at)
          : new Date(loan.processed_at);
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
        const interestForPeriod = Math.round(principal * interestRatePerDay * days * 100) / 100;
        const newInterest = Math.round(((loan.processed_interest || 0) + interestForPeriod) * 100) / 100;

        // Calculate penalty if overdue
        // CRITICAL: Penalties should be calculated from SCRATCH each time based on total days overdue
        // NOT added incrementally (which would cause double-counting)
        let newPenalty = 0;
        const dueDates = parseDueDates(loan.processed_due_date);
        
        if (dueDates.length > 0) {
          // Check if any EMI is overdue
          let maxDaysOverdue = 0;
          for (const dueDateStr of dueDates) {
            if (isOverdue(dueDateStr, today)) {
              const dueDate = new Date(dueDateStr);
              dueDate.setHours(0, 0, 0, 0);
              const daysOverdue = calculateDaysInclusive(dueDate, today);
              maxDaysOverdue = Math.max(maxDaysOverdue, daysOverdue);
            }
          }

          if (maxDaysOverdue > 0) {
            // Calculate total penalty from scratch based on total days overdue
            // Late fee is one-time (already included in calculatePenalty when daysOverdue >= 1)
            newPenalty = calculatePenalty(principal, maxDaysOverdue, false);
            newPenalty = Math.round(newPenalty * 100) / 100;
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

