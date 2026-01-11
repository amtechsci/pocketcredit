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
 * Calculate penalty for overdue loan using late_fee_structure
 * IMPORTANT: Always use late_fee_structure from database, not hardcoded values
 */
function calculatePenalty(principal, daysOverdue, lateFeeStructure) {
  if (daysOverdue <= 0) {
    return { penaltyBase: 0, penaltyGST: 0, penaltyTotal: 0 };
  }

  // If no late_fee_structure, return 0 (no penalty)
  if (!lateFeeStructure || !Array.isArray(lateFeeStructure) || lateFeeStructure.length === 0) {
    return { penaltyBase: 0, penaltyGST: 0, penaltyTotal: 0 };
  }

  let penaltyBase = 0;

  // Sort tiers by tier_order or days_overdue_start
  const sortedTiers = [...lateFeeStructure].sort((a, b) => {
    const orderA = a.tier_order !== undefined ? a.tier_order : (a.days_overdue_start || 0);
    const orderB = b.tier_order !== undefined ? b.tier_order : (b.days_overdue_start || 0);
    return orderA - orderB;
  });

  // Calculate penalty based on tiers
  for (const tier of sortedTiers) {
    const startDay = tier.days_overdue_start || 0;
    const endDay = tier.days_overdue_end !== null && tier.days_overdue_end !== undefined 
      ? tier.days_overdue_end 
      : null; // null means unlimited (e.g., Day 121+)
    
    // Skip tiers that haven't started yet
    if (daysOverdue < startDay) continue;
    
    const feeValue = parseFloat(tier.fee_value || tier.penalty_percent || 0);
    if (feeValue <= 0) continue;
    
    if (startDay === endDay || (startDay === 1 && endDay === 1)) {
      // Single day tier (e.g., "Day 1-1"): apply as one-time percentage
      if (daysOverdue >= startDay) {
        penaltyBase += principal * (feeValue / 100);
      }
    } else if (endDay === null || endDay === undefined) {
      // Unlimited tier (e.g., "Day 121+"): apply for all days from startDay onwards
      if (daysOverdue >= startDay) {
        const daysInTier = daysOverdue - startDay + 1;
        penaltyBase += principal * (feeValue / 100) * daysInTier;
      }
    } else {
      // Multi-day tier (e.g., "Day 2-10", "Day 11-120"): calculate for applicable days
      if (daysOverdue >= startDay) {
        const tierStartDay = startDay;
        const tierEndDay = Math.min(endDay, daysOverdue); // Cap at days overdue
        const daysInTier = Math.max(0, tierEndDay - tierStartDay + 1);
        
        if (daysInTier > 0) {
          penaltyBase += principal * (feeValue / 100) * daysInTier;
        }
      }
    }
  }

  const penaltyBaseRounded = Math.round(penaltyBase * 100) / 100;
  const gstPercent = lateFeeStructure[0]?.gst_percent || 18; // Use GST from structure or default 18%
  const penaltyGST = Math.round(penaltyBaseRounded * (gstPercent / 100) * 100) / 100;
  const penaltyTotal = Math.round((penaltyBaseRounded + penaltyGST) * 100) / 100;

  return { penaltyBase: penaltyBaseRounded, penaltyGST, penaltyTotal };
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
        late_fee_structure,
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
          
          // Check if any EMI is overdue
          let maxDaysOverdue = 0;
          for (const dueDateStr of dueDates) {
            if (isOverdue(dueDateStr, today)) {
              const dueDate = new Date(dueDateStr);
              dueDate.setHours(0, 0, 0, 0);
              // Calculate days overdue: if due date is 1st and today is 11th, that's 10 days past due
              // calculateDaysInclusive gives 11 days (1st to 11th inclusive), but for penalty we need exclusive
              // So subtract 1 to get actual days past due (excluding today)
              const daysOverdueInclusive = calculateDaysInclusive(dueDate, today);
              const daysOverdue = Math.max(1, daysOverdueInclusive - 1); // Exclude today for penalty calculation
              maxDaysOverdue = Math.max(maxDaysOverdue, daysOverdue);
            }
          }

          if (maxDaysOverdue > 0) {
            // Calculate total penalty from scratch using late_fee_structure
            const penaltyCalc = calculatePenalty(principal, maxDaysOverdue, lateFeeStructure);
            newPenalty = penaltyCalc.penaltyTotal;
            newPenalty = Math.round(newPenalty * 100) / 100;
            
            await cronLogger.debug(`Loan #${loan.id}: ${maxDaysOverdue} days overdue, Penalty: ₹${penaltyCalc.penaltyBase} + GST ₹${penaltyCalc.penaltyGST} = ₹${newPenalty}`);
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

