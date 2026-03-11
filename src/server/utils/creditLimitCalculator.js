/**
 * Credit Limit Calculator for 2 EMI Products
 *
 * Logic can be hardcoded (fallback) or from credit_limit_rules (DB).
 * When a rule exists for the user (assigned or default), percentage_tiers and caps come from the rule.
 */

const { executeQuery } = require('../config/database');

/** Fallback when no DB rule is available (backward compatibility) */
const DEFAULT_PERCENTAGE_TIERS = [8, 11, 15.2, 20.9, 28, 32.1];
const DEFAULT_MAX_REGULAR_CAP = 45600;
const DEFAULT_PREMIUM_LIMIT = 150000;
const DEFAULT_PREMIUM_TENURE = 24;
const DEFAULT_FIRST_TIME_PERCENTAGE = 8;

/**
 * Helper function to convert income_range to approximate monthly income
 */
const getMonthlyIncomeFromRange = (range) => {
  if (!range) return 0;
  const rangeMap = {
    '1k-20k': 10000,
    '20k-30k': 25000,
    '30k-40k': 35000,
    'above-40k': 50000
  };
  return rangeMap[range] || 0;
};

/**
 * Get credit limit rule for user. If user has credit_limit_rule_id set and rule is active, use it; else use default rule.
 * @param {number} userId - User ID
 * @returns {Promise<object|null>} Rule row with parsed percentage_tiers array, or null (caller uses hardcoded defaults)
 */
async function getCreditLimitRuleForUser(userId) {
  try {
    let ruleId = null;
    try {
      const userRow = await executeQuery(
        'SELECT credit_limit_rule_id FROM users WHERE id = ? LIMIT 1',
        [userId]
      );
      if (userRow && userRow.length > 0 && userRow[0].credit_limit_rule_id != null) {
        ruleId = parseInt(userRow[0].credit_limit_rule_id, 10);
      }
    } catch (e) {
      // Column may not exist yet
      return null;
    }

    let rule = null;
    if (ruleId) {
      const rows = await executeQuery(
        'SELECT * FROM credit_limit_rules WHERE id = ? AND is_active = 1 LIMIT 1',
        [ruleId]
      );
      rule = rows && rows.length > 0 ? rows[0] : null;
    }
    if (!rule) {
      const rows = await executeQuery(
        'SELECT * FROM credit_limit_rules WHERE is_default = 1 AND is_active = 1 LIMIT 1'
      );
      rule = rows && rows.length > 0 ? rows[0] : null;
    }
    if (!rule) return null;

    const calculationMode = rule.calculation_mode || 'percentage';

    let tiers = DEFAULT_PERCENTAGE_TIERS;
    if (rule.percentage_tiers) {
      const raw = rule.percentage_tiers;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(n => typeof n === 'number')) {
        tiers = parsed;
      }
    }

    let fixedTiers = null;
    if (rule.fixed_amount_tiers) {
      const raw = rule.fixed_amount_tiers;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(n => typeof n === 'number')) {
        fixedTiers = parsed;
      }
    }

    return {
      ...rule,
      calculation_mode: calculationMode,
      percentage_tiers: tiers,
      fixed_amount_tiers: fixedTiers,
      max_regular_cap: parseFloat(rule.max_regular_cap) || DEFAULT_MAX_REGULAR_CAP,
      premium_limit: rule.premium_limit != null ? parseFloat(rule.premium_limit) : null,
      premium_tenure_months: rule.premium_tenure_months != null ? parseInt(rule.premium_tenure_months, 10) : null,
      first_time_percentage: parseFloat(rule.first_time_percentage) || DEFAULT_FIRST_TIME_PERCENTAGE,
      triggers_cooling_period: rule.triggers_cooling_period === 1 || rule.triggers_cooling_period === true,
      block_after_tier: rule.block_after_tier != null ? parseInt(rule.block_after_tier, 10) : null,
      salary_min: rule.salary_min != null ? parseFloat(rule.salary_min) : null,
      salary_max: rule.salary_max != null ? parseFloat(rule.salary_max) : null,
      auto_assign: rule.auto_assign === 1 || rule.auto_assign === true
    };
  } catch (err) {
    console.warn(`[CreditLimit] getCreditLimitRuleForUser(${userId}) failed, using defaults:`, err.message);
    return null;
  }
}

/**
 * Calculate credit limit based on number of 2 EMI loans disbursed
 * @param {number} userId - User ID
 * @param {number} monthlySalary - Monthly salary (if not provided, will fetch from user profile)
 * @param {number} currentLimit - Current credit limit (if not provided, will fetch from database)
 * @returns {Promise<{newLimit: number, loanCount: number, percentage: number, isMaxReached: boolean, showPremiumLimit: boolean}>}
 */
async function calculateCreditLimitFor2EMI(userId, monthlySalary = null, currentLimit = null) {
  try {
    // Get user's current limit if not provided
    if (currentLimit === null) {
      const userLimitQuery = `SELECT loan_limit FROM users WHERE id = ?`;
      const userLimitResult = await executeQuery(userLimitQuery, [userId]);
      currentLimit = userLimitResult && userLimitResult.length > 0
        ? parseFloat(userLimitResult[0].loan_limit) || 0
        : 0;
    }

    // Get user's salary if not provided
    let salary = monthlySalary;
    if (!salary) {
      const userQuery = `
        SELECT u.income_range, u.monthly_net_income
        FROM users u
        WHERE u.id = ?
        LIMIT 1
      `;
      const users = await executeQuery(userQuery, [userId]);

      if (users && users.length > 0) {
        const user = users[0];
        // Priority: monthly_net_income from users table, then income_range
        salary = user.monthly_net_income || getMonthlyIncomeFromRange(user.income_range) || 0;
      }
    }

    if (!salary || salary <= 0) {
      console.warn(`[CreditLimit] No valid salary found for user ${userId}`);
      return {
        newLimit: 0,
        loanCount: 0,
        percentage: 0,
        salary: 0,
        currentLimit: currentLimit,
        isMaxReached: false,
        showPremiumLimit: false
      };
    }

    // Count number of ALL loans that have been disbursed (any loan type)
    // Status should be 'account_manager' (disbursed) or 'cleared' (fully repaid)
    const loanCountQuery = `
      SELECT COUNT(*) as count
      FROM loan_applications
      WHERE user_id = ?
        AND status IN ('account_manager', 'cleared')
        AND disbursed_at IS NOT NULL
    `;

    const loanCountResult = await executeQuery(loanCountQuery, [userId]);
    const loanCount = loanCountResult && loanCountResult.length > 0
      ? parseInt(loanCountResult[0].count) || 0
      : 0;

    const rule = await getCreditLimitRuleForUser(userId);
    const calculationMode = rule ? rule.calculation_mode : 'percentage';
    const blockAfterTier = rule ? rule.block_after_tier : null;

    // block_after_tier: block only AFTER the Nth loan, not AT the Nth loan.
    // The Nth loan (loanCount == blockAfterTier) still gets a limit calculation.
    // Cooling period is triggered separately when the Nth loan is CLEARED.
    if (blockAfterTier != null && loanCount > blockAfterTier) {
      console.log(`[CreditLimit] User ${userId}: block_after_tier=${blockAfterTier}, loanCount=${loanCount} - profile should be blocked`);
      return {
        newLimit: 0,
        loanCount,
        percentage: 0,
        salary,
        currentLimit,
        calculatedLimit: 0,
        isMaxReached: true,
        showPremiumLimit: false,
        premiumLimit: null,
        premiumTenure: null,
        blocked: true,
        blockAfterTier
      };
    }

    // ----- Fixed-amount mode -----
    if (calculationMode === 'fixed' && rule && rule.fixed_amount_tiers && rule.fixed_amount_tiers.length > 0) {
      const fixedTiers = rule.fixed_amount_tiers;
      const tierIndex = Math.min(loanCount, fixedTiers.length - 1);
      const newLimit = fixedTiers[tierIndex];
      const isLastTier = tierIndex >= fixedTiers.length - 1;

      console.log(`[CreditLimit] User ${userId} [fixed]: Salary=₹${salary}, Disbursed=${loanCount}, TierIndex=${tierIndex}, Limit=₹${newLimit}, LastTier=${isLastTier}`);

      return {
        newLimit,
        loanCount,
        percentage: 0,
        salary,
        currentLimit,
        calculatedLimit: newLimit,
        isMaxReached: isLastTier,
        showPremiumLimit: false,
        premiumLimit: null,
        premiumTenure: null,
        blocked: false,
        blockAfterTier
      };
    }

    // ----- Percentage mode (default / existing logic) -----
    const percentageMultipliers = rule ? rule.percentage_tiers : DEFAULT_PERCENTAGE_TIERS;
    const maxRegularCap = rule ? rule.max_regular_cap : DEFAULT_MAX_REGULAR_CAP;
    const premiumLimit = rule ? rule.premium_limit : DEFAULT_PREMIUM_LIMIT;
    const premiumTenure = rule ? rule.premium_tenure_months : DEFAULT_PREMIUM_TENURE;
    const lastTierPercentage = percentageMultipliers[percentageMultipliers.length - 1];

    const nextPercentageIndex = Math.min(loanCount, percentageMultipliers.length - 1);
    const nextPercentage = percentageMultipliers[nextPercentageIndex];

    const calculatedLimitByPercentageExact = Math.round((salary * nextPercentage) / 100);
    const calculatedLimitByPercentage = Math.floor(calculatedLimitByPercentageExact / 100) * 100;

    const calculatedLimit = Math.max(currentLimit, calculatedLimitByPercentage);

    const isMaxPercentageReached = nextPercentage >= lastTierPercentage;
    const wouldCrossMaxLimit = premiumLimit != null && calculatedLimitByPercentageExact > maxRegularCap;
    const showPremiumLimit = premiumLimit != null && (isMaxPercentageReached || wouldCrossMaxLimit);

    let newLimit;
    if (showPremiumLimit) {
      newLimit = premiumLimit;
    } else {
      newLimit = Math.min(calculatedLimit, maxRegularCap);
    }

    console.log(`[CreditLimit] User ${userId} [pct]: Salary=₹${salary}, Current=₹${currentLimit}, Disbursed=${loanCount}, Pct=${nextPercentage}%, Exact=₹${calculatedLimitByPercentageExact}, Rounded=₹${calculatedLimitByPercentage}, Final=₹${newLimit}, Premium=${showPremiumLimit}`);

    return {
      newLimit,
      loanCount,
      percentage: nextPercentage,
      salary,
      currentLimit,
      calculatedLimit: calculatedLimitByPercentage,
      isMaxReached: isMaxPercentageReached,
      showPremiumLimit: showPremiumLimit,
      premiumLimit: showPremiumLimit ? premiumLimit : null,
      premiumTenure: showPremiumLimit ? premiumTenure : null,
      blocked: false,
      blockAfterTier
    };

  } catch (error) {
    console.error(`[CreditLimit] Error calculating credit limit for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Update user's credit limit in the database
 * @param {number} userId - User ID
 * @param {number} newLimit - New credit limit amount
 * @returns {Promise<boolean>}
 */
async function updateUserCreditLimit(userId, newLimit) {
  try {
    // Check if loan_limit column exists in users table
    const updateQuery = `
      UPDATE users 
      SET loan_limit = ?, updated_at = NOW()
      WHERE id = ?
    `;

    await executeQuery(updateQuery, [newLimit, userId]);
    console.log(`[CreditLimit] Updated credit limit for user ${userId} to ₹${newLimit}`);
    return true;

  } catch (error) {
    console.error(`[CreditLimit] Error updating credit limit for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Store pending credit limit increase (requires user acceptance)
 * @param {number} userId - User ID
 * @param {number} newLimit - New credit limit amount
 * @param {object} limitData - Additional limit data (percentage, loanCount, etc.)
 * @returns {Promise<boolean>}
 */
async function storePendingCreditLimit(userId, newLimit, limitData = {}) {
  try {
    // Table should exist in database

    // Delete any existing pending limit for this user
    await executeQuery(
      `DELETE FROM pending_credit_limits WHERE user_id = ? AND status = 'pending'`,
      [userId]
    );

    // Insert new pending limit
    const insertQuery = `
      INSERT INTO pending_credit_limits 
      (user_id, new_limit, current_limit, percentage, loan_count, salary, is_premium_limit, premium_tenure, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `;

    await executeQuery(insertQuery, [
      userId,
      newLimit,
      limitData.currentLimit || 0,
      limitData.percentage || null,
      limitData.loanCount || null,
      limitData.salary || null,
      limitData.showPremiumLimit ? 1 : 0,
      limitData.premiumTenure || null
    ]);

    console.log(`[CreditLimit] Stored pending credit limit for user ${userId}: ₹${newLimit}`);
    return true;

  } catch (error) {
    console.error(`[CreditLimit] Error storing pending credit limit for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Get pending credit limit for a user
 * @param {number} userId - User ID
 * @returns {Promise<object|null>}
 */
async function getPendingCreditLimit(userId) {
  try {
    // Table should exist in database

    const query = `
      SELECT * FROM pending_credit_limits
      WHERE user_id = ? AND status = 'pending'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await executeQuery(query, [userId]);
    return result && result.length > 0 ? result[0] : null;

  } catch (error) {
    // Table might not exist or other error, return null silently
    // Error is already logged by database layer, no need to log again
    return null;
  }
}

/**
 * Accept pending credit limit
 * @param {number} userId - User ID
 * @param {number} pendingLimitId - Pending limit ID
 * @returns {Promise<boolean>}
 */
async function acceptPendingCreditLimit(userId, pendingLimitId) {
  try {
    // Get pending limit
    const pendingQuery = `SELECT * FROM pending_credit_limits WHERE id = ? AND user_id = ? AND status = 'pending'`;
    const pending = await executeQuery(pendingQuery, [pendingLimitId, userId]);

    if (!pending || pending.length === 0) {
      throw new Error('Pending credit limit not found');
    }

    const pendingLimit = pending[0];

    // Table should exist in database

    // Store history BEFORE updating the limit
    const increaseAmount = parseFloat(pendingLimit.new_limit) - parseFloat(pendingLimit.current_limit);
    await executeQuery(
      `INSERT INTO credit_limit_history 
       (user_id, old_limit, new_limit, increase_amount, percentage, loan_count, salary, is_premium_limit, premium_tenure, pending_limit_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        pendingLimit.current_limit,
        pendingLimit.new_limit,
        increaseAmount,
        pendingLimit.percentage || null,
        pendingLimit.loan_count || null,
        pendingLimit.salary || null,
        pendingLimit.is_premium_limit || 0,
        pendingLimit.premium_tenure || null,
        pendingLimitId
      ]
    );

    // Update user's credit limit
    await updateUserCreditLimit(userId, pendingLimit.new_limit);

    // Delete any existing 'accepted' records for this user to avoid unique constraint violation
    // The unique constraint is on (user_id, status) where status='accepted'
    await executeQuery(
      `DELETE FROM pending_credit_limits 
       WHERE user_id = ? AND status = 'accepted'`,
      [userId]
    );

    // Mark pending limit as accepted
    await executeQuery(
      `UPDATE pending_credit_limits 
       SET status = 'accepted', accepted_at = NOW() 
       WHERE id = ?`,
      [pendingLimitId]
    );

    console.log(`[CreditLimit] User ${userId} accepted credit limit increase from ₹${pendingLimit.current_limit} to ₹${pendingLimit.new_limit} (history stored)`);
    return true;

  } catch (error) {
    console.error(`[CreditLimit] Error accepting pending credit limit:`, error);
    throw error;
  }
}

/**
 * Reject pending credit limit
 * @param {number} userId - User ID
 * @param {number} pendingLimitId - Pending limit ID
 * @returns {Promise<boolean>}
 */
async function rejectPendingCreditLimit(userId, pendingLimitId) {
  try {
    await executeQuery(
      `UPDATE pending_credit_limits 
       SET status = 'rejected', rejected_at = NOW() 
       WHERE id = ? AND user_id = ? AND status = 'pending'`,
      [pendingLimitId, userId]
    );

    console.log(`[CreditLimit] User ${userId} rejected credit limit increase`);
    return true;

  } catch (error) {
    console.error(`[CreditLimit] Error rejecting pending credit limit:`, error);
    throw error;
  }
}

/**
 * Get credit limit history for a user
 * @param {number} userId - User ID
 * @param {number} limit - Number of records to return (default: 10)
 * @returns {Promise<Array>}
 */
async function getCreditLimitHistory(userId, limit = 10) {
  try {
    // Table should exist in database

    const query = `
      SELECT 
        id,
        old_limit,
        new_limit,
        increase_amount,
        percentage,
        loan_count,
        salary,
        is_premium_limit,
        premium_tenure,
        created_at
      FROM credit_limit_history
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `;

    const result = await executeQuery(query, [userId, limit]);
    return result || [];

  } catch (error) {
    console.error(`[CreditLimit] Error fetching credit limit history for user ${userId}:`, error);
    // Return empty array on error instead of throwing
    return [];
  }
}

/**
 * Adjust first-time loan amount to 8% of salary when salary is updated
 * This applies only to users applying for their first 2 EMI loan
 * @param {number} userId - User ID
 * @param {number} monthlySalary - Updated monthly salary
 * @returns {Promise<{adjusted: boolean, loanId: number|null, oldAmount: number|null, newAmount: number|null}>}
 */
async function adjustFirstTimeLoanAmount(userId, monthlySalary) {
  try {
    if (!monthlySalary || monthlySalary <= 0) {
      return { adjusted: false, loanId: null, oldAmount: null, newAmount: null };
    }

    const rule = await getCreditLimitRuleForUser(userId);
    const calculationMode = rule ? rule.calculation_mode : 'percentage';
    const firstTimePct = rule ? rule.first_time_percentage : DEFAULT_FIRST_TIME_PERCENTAGE;
    const maxRegularCap = rule ? rule.max_regular_cap : DEFAULT_MAX_REGULAR_CAP;

    // Check if user has any disbursed 2 EMI loans
    // If they have disbursed 2 EMI loans, this is not their first loan
    const disbursed2EMILoans = await executeQuery(`
      SELECT COUNT(*) as count
      FROM loan_applications
      WHERE user_id = ?
        AND status IN ('account_manager', 'cleared')
        AND disbursed_at IS NOT NULL
        AND JSON_EXTRACT(plan_snapshot, '$.emi_count') = 2
        AND JSON_EXTRACT(plan_snapshot, '$.plan_type') = 'multi_emi'
    `, [userId]);

    const hasDisbursed2EMILoans = disbursed2EMILoans && disbursed2EMILoans.length > 0
      ? parseInt(disbursed2EMILoans[0].count) > 0
      : false;

    // If user already has disbursed 2 EMI loans, don't adjust
    if (hasDisbursed2EMILoans) {
      console.log(`[CreditLimit] User ${userId} has disbursed 2 EMI loans - skipping first-time adjustment`);
      return { adjusted: false, loanId: null, oldAmount: null, newAmount: null };
    }

    // Find pending/submitted 2 EMI loan applications (not yet disbursed)
    const pendingLoans = await executeQuery(`
      SELECT id, loan_amount, plan_snapshot
      FROM loan_applications
      WHERE user_id = ?
        AND status IN ('submitted', 'under_review', 'follow_up', 'disbursement_ready', 'ready_for_disbursement', 'ready_to_repeat_disbursal')
        AND processed_at IS NULL
        AND JSON_EXTRACT(plan_snapshot, '$.emi_count') = 2
        AND JSON_EXTRACT(plan_snapshot, '$.plan_type') = 'multi_emi'
      ORDER BY created_at DESC
      LIMIT 1
    `, [userId]);

    if (!pendingLoans || pendingLoans.length === 0) {
      console.log(`[CreditLimit] User ${userId} has no pending 2 EMI loan applications - skipping adjustment`);
      return { adjusted: false, loanId: null, oldAmount: null, newAmount: null };
    }

    const pendingLoan = pendingLoans[0];
    const currentLoanAmount = parseFloat(pendingLoan.loan_amount) || 0;

    let newLoanAmount;
    if (calculationMode === 'fixed' && rule && rule.fixed_amount_tiers && rule.fixed_amount_tiers.length > 0) {
      newLoanAmount = rule.fixed_amount_tiers[0];
    } else {
      const firstTimeAmount = Math.round((monthlySalary * firstTimePct) / 100);
      newLoanAmount = Math.min(firstTimeAmount, maxRegularCap);
    }

    if (Math.abs(newLoanAmount - currentLoanAmount) < 0.01) {
      console.log(`[CreditLimit] Loan amount already at target (₹${newLoanAmount}) - no adjustment needed`);
      return { adjusted: false, loanId: pendingLoan.id, oldAmount: currentLoanAmount, newAmount: newLoanAmount };
    }

    // Update loan amount in loan_applications
    await executeQuery(
      `UPDATE loan_applications 
       SET loan_amount = ?, updated_at = NOW() 
       WHERE id = ?`,
      [newLoanAmount, pendingLoan.id]
    );

    // Recalculate all calculated fields when loan_amount changes
    const { getLoanCalculation } = require('./loanCalculations');
    let updateFields = [];
    let updateValues = [];
    
    try {
      const calculation = await getLoanCalculation(pendingLoan.id);
      
      if (calculation) {
        // Get disbursal amount (getLoanCalculation uses calculateLoanValues which returns disbAmount)
        const disbursalAmount = calculation.disbAmount || calculation.disbursal?.amount || calculation.disbursalAmount || newLoanAmount;
        
        // Get processing fee (sum of disbursal fees + GST)
        const processingFee = ((calculation.totals?.disbursalFee || 0) + (calculation.totals?.disbursalFeeGST || 0)) || calculation.processingFee || 0;
        
        // Get total interest
        const totalInterest = calculation.interest?.amount || calculation.interest || 0;
        
        // Get total repayable
        const totalRepayable = calculation.total?.repayable || calculation.totalRepayable || newLoanAmount;
        
        // Update all calculated fields
        updateFields.push('disbursal_amount = ?');
        updateFields.push('processing_fee = ?');
        updateFields.push('total_interest = ?');
        updateFields.push('total_repayable = ?');
        
        updateValues.push(disbursalAmount);
        updateValues.push(processingFee);
        updateValues.push(totalInterest);
        updateValues.push(totalRepayable);
        
        // Update fees_breakdown if available
        if (calculation.fees) {
          const allFees = [
            ...(calculation.fees.deductFromDisbursal || []),
            ...(calculation.fees.addToTotal || [])
          ];
          if (allFees.length > 0) {
            const feesBreakdown = allFees.map(fee => ({
              fee_name: fee.fee_name,
              fee_amount: fee.fee_amount,
              gst_amount: fee.gst_amount,
              fee_percent: fee.fee_percent,
              total_with_gst: fee.total_with_gst,
              application_method: fee.application_method || 'deduct_from_disbursal'
            }));
            updateFields.push('fees_breakdown = ?');
            updateValues.push(JSON.stringify(feesBreakdown));
          }
        }
        
        // Update all fields
        updateValues.push(pendingLoan.id);
        await executeQuery(
          `UPDATE loan_applications 
           SET ${updateFields.join(', ')}, updated_at = NOW() 
           WHERE id = ?`,
          updateValues
        );
      }
    } catch (calcError) {
      console.error(`[CreditLimit] Failed to recalculate fields for loan ${pendingLoan.id}:`, calcError);
      // Continue - loan amount update already succeeded
    }

    // ALSO update user's loan_limit in users table
    // This is the credit limit that determines how much the user can borrow
    await executeQuery(
      `UPDATE users 
       SET loan_limit = ?, updated_at = NOW() 
       WHERE id = ?`,
      [newLoanAmount, userId]
    );

    const modeDesc = calculationMode === 'fixed' ? `fixed tier[0]` : `${firstTimePct}% of ₹${monthlySalary} salary`;
    console.log(`[CreditLimit] Adjusted first-time loan amount for user ${userId}: ₹${currentLoanAmount} → ₹${newLoanAmount} (${modeDesc})`);
    console.log(`[CreditLimit] Also updated user ${userId} loan_limit to ₹${newLoanAmount}`);

    return {
      adjusted: true,
      loanId: pendingLoan.id,
      oldAmount: currentLoanAmount,
      newAmount: newLoanAmount,
      limitUpdated: true
    };

  } catch (error) {
    console.error(`[CreditLimit] Error adjusting first-time loan amount for user ${userId}:`, error);
    // Don't throw error - salary update should still succeed even if loan adjustment fails
    return { adjusted: false, loanId: null, oldAmount: null, newAmount: null, error: error.message };
  }
}

/**
 * Check if user should be marked in cooling period
 * This triggers when:
 * 1. User reaches 6th loan (32.1% = ₹1,50,000 premium limit)
 * 2. User's limit reaches or exceeds ₹45,600 (max regular limit threshold)
 * @param {number} userId - User ID
 * @param {number} loanId - Loan ID that was just cleared (optional, for logging)
 * @param {object} creditLimitData - Credit limit calculation data (optional)
 * @returns {Promise<boolean>} - Returns true if user was marked in cooling period
 */
async function checkAndMarkCoolingPeriod(userId, loanId = null, creditLimitData = null) {
  try {
    const rule = await getCreditLimitRuleForUser(userId);
    if (rule && !rule.triggers_cooling_period) {
      return false;
    }
    const premiumLimit = rule ? rule.premium_limit : DEFAULT_PREMIUM_LIMIT;
    const maxRegularCap = rule ? rule.max_regular_cap : DEFAULT_MAX_REGULAR_CAP;
    const blockAfterTier = rule ? rule.block_after_tier : null;

    let shouldMarkCoolingPeriod = false;
    let coolingPeriodReason = '';

    // block_after_tier takes priority: if the returned data says blocked, honour it
    if (creditLimitData && creditLimitData.blocked) {
      shouldMarkCoolingPeriod = true;
      coolingPeriodReason = `completed ${creditLimitData.loanCount} loans (block_after_tier=${blockAfterTier})`;
      console.log(`[CreditLimit] User ${userId} blocked by block_after_tier (${blockAfterTier}) - will mark in cooling period`);
    }

    // Also check block_after_tier directly via loan count when no creditLimitData
    if (!shouldMarkCoolingPeriod && blockAfterTier != null) {
      const countResult = await executeQuery(
        `SELECT COUNT(*) as cnt FROM loan_applications WHERE user_id = ? AND status IN ('account_manager','cleared') AND disbursed_at IS NOT NULL`,
        [userId]
      );
      const clearedCount = countResult && countResult.length > 0 ? parseInt(countResult[0].cnt) || 0 : 0;
      if (clearedCount >= blockAfterTier) {
        shouldMarkCoolingPeriod = true;
        coolingPeriodReason = `completed ${clearedCount} loans (block_after_tier=${blockAfterTier})`;
        console.log(`[CreditLimit] User ${userId} loan count ${clearedCount} >= block_after_tier ${blockAfterTier} - will mark in cooling period`);
      }
    }

    // Existing premium / max-cap checks (only for percentage mode without block_after_tier)
    if (!shouldMarkCoolingPeriod && creditLimitData && blockAfterTier == null) {
      if (premiumLimit != null && creditLimitData.newLimit === premiumLimit && creditLimitData.premiumLimit === premiumLimit) {
        shouldMarkCoolingPeriod = true;
        coolingPeriodReason = `reached premium limit (₹${premiumLimit.toLocaleString('en-IN')})`;
        console.log(`[CreditLimit] User ${userId} reached premium limit - will mark in cooling period`);
      } else if (premiumLimit != null && creditLimitData.newLimit >= maxRegularCap && creditLimitData.newLimit < premiumLimit) {
        shouldMarkCoolingPeriod = true;
        coolingPeriodReason = `reached maximum regular limit (₹${creditLimitData.newLimit.toLocaleString('en-IN')})`;
        console.log(`[CreditLimit] User ${userId} reached maximum regular limit (₹${creditLimitData.newLimit}) - will mark in cooling period`);
      } else if (premiumLimit != null && creditLimitData.calculatedLimit != null && creditLimitData.calculatedLimit >= maxRegularCap && creditLimitData.newLimit < premiumLimit) {
        shouldMarkCoolingPeriod = true;
        coolingPeriodReason = `calculated limit crossed threshold (₹${creditLimitData.calculatedLimit.toLocaleString('en-IN')})`;
        console.log(`[CreditLimit] User ${userId} calculated limit crossed threshold (₹${creditLimitData.calculatedLimit}) - will mark in cooling period`);
      }
    }

    if (!shouldMarkCoolingPeriod && blockAfterTier == null && loanId) {
      const loanQuery = `
        SELECT id, user_id, loan_amount, status, plan_snapshot
        FROM loan_applications
        WHERE id = ? AND user_id = ? AND status = 'cleared'
      `;
      const loans = await executeQuery(loanQuery, [loanId, userId]);

      if (loans && loans.length > 0) {
        const loan = loans[0];
        const loanAmount = parseFloat(loan.loan_amount) || 0;

        if (premiumLimit != null && loanAmount === premiumLimit) {
          try {
            const planSnapshot = typeof loan.plan_snapshot === 'string'
              ? JSON.parse(loan.plan_snapshot)
              : loan.plan_snapshot;
            const emiCount = planSnapshot?.emi_count || 0;
            const planType = planSnapshot?.plan_type || '';
            const premiumTenure = rule ? rule.premium_tenure_months : DEFAULT_PREMIUM_TENURE;
            if (emiCount === premiumTenure || (planType === 'multi_emi' && emiCount >= premiumTenure)) {
              shouldMarkCoolingPeriod = true;
            }
          } catch (parseError) {
            shouldMarkCoolingPeriod = true;
          }
        }
      }
    }

    if (shouldMarkCoolingPeriod) {
      await executeQuery(
        `UPDATE users 
         SET status = 'on_hold', 
             hold_until_date = NULL, 
             application_hold_reason = 'Your Profile is under cooling period. We will let you know once you are eligible.',
             updated_at = NOW() 
         WHERE id = ?`,
        [userId]
      );

      console.log(`[CreditLimit] User ${userId} marked in cooling period - ${coolingPeriodReason || 'limit reached'}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`[CreditLimit] Error checking cooling period for user ${userId}:`, error);
    return false;
  }
}

/**
 * Auto-assign a credit limit rule to a user based on salary.
 * Only assigns if user does not already have a rule and a matching auto_assign rule exists.
 * @param {number} userId
 * @param {number} salary - Monthly salary (rupees)
 * @returns {Promise<{assigned: boolean, ruleId: number|null, ruleName: string|null}>}
 */
async function autoAssignCreditLimitRule(userId, salary) {
  try {
    if (!userId || !salary || salary <= 0) {
      return { assigned: false, ruleId: null, ruleName: null };
    }

    let currentRuleId = null;
    try {
      const userRow = await executeQuery(
        'SELECT credit_limit_rule_id FROM users WHERE id = ? LIMIT 1',
        [userId]
      );
      if (userRow && userRow.length > 0) {
        currentRuleId = userRow[0].credit_limit_rule_id;
      }
    } catch (e) {
      return { assigned: false, ruleId: null, ruleName: null };
    }

    if (currentRuleId != null) {
      console.log(`[CreditLimit] User ${userId} already has credit_limit_rule_id=${currentRuleId}, skipping auto-assign`);
      return { assigned: false, ruleId: currentRuleId, ruleName: null };
    }

    const matchingRules = await executeQuery(
      `SELECT id, rule_name, rule_code
       FROM credit_limit_rules
       WHERE auto_assign = 1
         AND is_active = 1
         AND (salary_min IS NULL OR salary_min <= ?)
         AND (salary_max IS NULL OR salary_max >= ?)
       ORDER BY sort_order ASC
       LIMIT 1`,
      [salary, salary]
    );

    if (!matchingRules || matchingRules.length === 0) {
      console.log(`[CreditLimit] No matching auto_assign rule for user ${userId} with salary ₹${salary}`);
      return { assigned: false, ruleId: null, ruleName: null };
    }

    const matched = matchingRules[0];
    await executeQuery(
      'UPDATE users SET credit_limit_rule_id = ?, updated_at = NOW() WHERE id = ?',
      [matched.id, userId]
    );

    console.log(`[CreditLimit] Auto-assigned rule "${matched.rule_name}" (id=${matched.id}) to user ${userId} (salary=₹${salary})`);
    return { assigned: true, ruleId: matched.id, ruleName: matched.rule_name };
  } catch (err) {
    console.error(`[CreditLimit] autoAssignCreditLimitRule(${userId}) failed:`, err.message);
    return { assigned: false, ruleId: null, ruleName: null };
  }
}

module.exports = {
  calculateCreditLimitFor2EMI,
  updateUserCreditLimit,
  storePendingCreditLimit,
  getPendingCreditLimit,
  acceptPendingCreditLimit,
  rejectPendingCreditLimit,
  getCreditLimitRuleForUser,
  getCreditLimitHistory,
  getMonthlyIncomeFromRange,
  adjustFirstTimeLoanAmount,
  checkAndMarkCoolingPeriod,
  autoAssignCreditLimitRule
};

