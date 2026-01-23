/**
 * Credit Limit Calculator for 2 EMI Products
 * 
 * Logic:
 * - Max limit: ₹45,600
 * - Progressive limits based on number of 2 EMI loans disbursed:
 *   1st loan: 8% × salary
 *   2nd loan: 11% × salary
 *   3rd loan: 15.2% × salary
 *   4th loan: 20.9% × salary
 *   5th loan: 28% × salary
 *   6th loan: 32.1% × salary
 */

const { executeQuery } = require('../config/database');

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
        SELECT u.income_range, ed.monthly_income
        FROM users u
        LEFT JOIN employment_details ed ON u.id = ed.user_id AND ed.is_active = 1
        WHERE u.id = ?
        ORDER BY ed.created_at DESC
        LIMIT 1
      `;
      const users = await executeQuery(userQuery, [userId]);

      if (users && users.length > 0) {
        const user = users[0];
        // Try to get from employment_details first, then from income_range
        salary = user.monthly_income || getMonthlyIncomeFromRange(user.income_range) || 0;
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

    // Count number of 2 EMI loans that have been disbursed
    // Status should be 'account_manager' (disbursed) or 'cleared' (fully repaid)
    const loanCountQuery = `
      SELECT COUNT(*) as count
      FROM loan_applications
      WHERE user_id = ?
        AND status IN ('account_manager', 'cleared')
        AND disbursed_at IS NOT NULL
        AND JSON_EXTRACT(plan_snapshot, '$.emi_count') = 2
        AND JSON_EXTRACT(plan_snapshot, '$.plan_type') = 'multi_emi'
    `;

    const loanCountResult = await executeQuery(loanCountQuery, [userId]);
    const loanCount = loanCountResult && loanCountResult.length > 0
      ? parseInt(loanCountResult[0].count) || 0
      : 0;

    // Define percentage multipliers for each loan number
    // After 1st loan: 11%, After 2nd loan: 15.2%, After 3rd loan: 20.9%, 
    // After 4th loan: 28%, After 5th loan: 32.1%, After 6th loan: Premium (₹1,50,000)
    const percentageMultipliers = [8, 11, 15.2, 20.9, 28, 32.1];

    // loanCount = number of 2 EMI loans already disbursed (including current one being disbursed)
    // After 1st loan disbursed (loanCount = 1), next limit is 11% (index 1)
    // After 2nd loan disbursed (loanCount = 2), next limit is 15.2% (index 2)
    // etc.
    // Next limit percentage index = loanCount (not loanCount - 1)
    const nextPercentageIndex = Math.min(loanCount, percentageMultipliers.length - 1);
    const nextPercentage = percentageMultipliers[nextPercentageIndex];

    // Calculate next limit based on next percentage tier
    const calculatedLimitByPercentage = Math.round((salary * nextPercentage) / 100);

    // Next limit should be based on current limit AND next percentage calculation
    // Use whichever is higher: current limit or calculated next limit
    const calculatedLimit = Math.max(currentLimit, calculatedLimitByPercentage);

    // Check if max percentage (32.1%) is reached for NEXT limit
    const isMaxPercentageReached = nextPercentage >= 32.1;

    // Check if next limit (based on percentage calculation) would cross ₹45,600
    // This check should be based on the calculated percentage limit, not the max of current and calculated
    // because premium limit should trigger when the progression-based limit crosses ₹45,600
    const wouldCrossMaxLimit = calculatedLimitByPercentage > 45600;

    // If max percentage reached OR would cross ₹45,600, show premium limit of ₹1,50,000
    const showPremiumLimit = isMaxPercentageReached || wouldCrossMaxLimit;

    let newLimit;
    if (showPremiumLimit) {
      newLimit = 150000; // Premium limit
    } else {
      // Apply maximum cap of ₹45,600 for regular limits
      newLimit = Math.min(calculatedLimit, 45600);
    }

    console.log(`[CreditLimit] User ${userId}: Salary=₹${salary}, Current Limit=₹${currentLimit}, 2EMI Loans=${loanCount}, Next Percentage=${nextPercentage}%, Calculated=₹${calculatedLimitByPercentage}, Final Limit=₹${newLimit}, Premium=${showPremiumLimit}`);

    return {
      newLimit,
      loanCount,
      percentage: nextPercentage, // Next percentage tier
      salary,
      currentLimit,
      calculatedLimit: calculatedLimitByPercentage,
      isMaxReached: isMaxPercentageReached,
      showPremiumLimit: showPremiumLimit,
      premiumLimit: showPremiumLimit ? 150000 : null,
      premiumTenure: showPremiumLimit ? 24 : null
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
    // Check if pending_credit_limit table exists, if not create it
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS pending_credit_limits (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        new_limit DECIMAL(12,2) NOT NULL,
        current_limit DECIMAL(12,2) NOT NULL,
        percentage DECIMAL(5,2),
        loan_count INT,
        salary DECIMAL(12,2),
        is_premium_limit TINYINT(1) DEFAULT 0,
        premium_tenure INT,
        status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        accepted_at TIMESTAMP NULL,
        rejected_at TIMESTAMP NULL,
        UNIQUE KEY unique_pending_limit (user_id, status),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;

    await executeQuery(createTableQuery);

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
    // Ensure table exists first
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS pending_credit_limits (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        new_limit DECIMAL(12,2) NOT NULL,
        current_limit DECIMAL(12,2) NOT NULL,
        percentage DECIMAL(5,2),
        loan_count INT,
        salary DECIMAL(12,2),
        is_premium_limit TINYINT(1) DEFAULT 0,
        premium_tenure INT,
        status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        accepted_at TIMESTAMP NULL,
        rejected_at TIMESTAMP NULL,
        UNIQUE KEY unique_pending_limit (user_id, status),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;

    await executeQuery(createTableQuery);

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

    // Update user's credit limit
    await updateUserCreditLimit(userId, pendingLimit.new_limit);

    // Mark pending limit as accepted
    await executeQuery(
      `UPDATE pending_credit_limits 
       SET status = 'accepted', accepted_at = NOW() 
       WHERE id = ?`,
      [pendingLimitId]
    );

    console.log(`[CreditLimit] User ${userId} accepted credit limit increase to ₹${pendingLimit.new_limit}`);
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

    // Calculate 8% of salary
    const eightPercentOfSalary = Math.round((monthlySalary * 8) / 100);

    // Apply maximum cap of ₹45,600
    const newLoanAmount = Math.min(eightPercentOfSalary, 45600);

    // Only adjust if the new amount is different from current amount
    if (Math.abs(newLoanAmount - currentLoanAmount) < 0.01) {
      console.log(`[CreditLimit] Loan amount already at 8% of salary (₹${newLoanAmount}) - no adjustment needed`);
      return { adjusted: false, loanId: pendingLoan.id, oldAmount: currentLoanAmount, newAmount: newLoanAmount };
    }

    // Update loan amount in loan_applications
    await executeQuery(
      `UPDATE loan_applications 
       SET loan_amount = ?, updated_at = NOW() 
       WHERE id = ?`,
      [newLoanAmount, pendingLoan.id]
    );

    // ALSO update user's loan_limit in users table
    // This is the credit limit that determines how much the user can borrow
    await executeQuery(
      `UPDATE users 
       SET loan_limit = ?, updated_at = NOW() 
       WHERE id = ?`,
      [newLoanAmount, userId]
    );

    console.log(`[CreditLimit] Adjusted first-time loan amount for user ${userId}: ₹${currentLoanAmount} → ₹${newLoanAmount} (8% of ₹${monthlySalary} salary)`);
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
 * Check if user should be marked in cooling period after clearing a premium loan (₹1,50,000)
 * @param {number} userId - User ID
 * @param {number} loanId - Loan ID that was just cleared
 * @returns {Promise<boolean>} - Returns true if user was marked in cooling period
 */
async function checkAndMarkCoolingPeriod(userId, loanId) {
  try {
    // Get the cleared loan details
    const loanQuery = `
      SELECT id, user_id, loan_amount, status, plan_snapshot
      FROM loan_applications
      WHERE id = ? AND user_id = ? AND status = 'cleared'
    `;
    const loans = await executeQuery(loanQuery, [loanId, userId]);

    if (!loans || loans.length === 0) {
      return false;
    }

    const loan = loans[0];
    const loanAmount = parseFloat(loan.loan_amount) || 0;

    // Check if this is a premium loan (₹1,50,000) with 24 EMIs
    let isPremiumLoan = false;
    if (loanAmount === 150000) {
      // Check if it's a 2 EMI product with premium tenure (24 EMIs)
      try {
        const planSnapshot = typeof loan.plan_snapshot === 'string'
          ? JSON.parse(loan.plan_snapshot)
          : loan.plan_snapshot;

        const emiCount = planSnapshot?.emi_count || 0;
        const planType = planSnapshot?.plan_type || '';

        // Premium loan: ₹1,50,000 with 24 EMIs
        if (emiCount === 24 || (planType === 'multi_emi' && emiCount >= 24)) {
          isPremiumLoan = true;
        }
      } catch (parseError) {
        // If plan_snapshot parsing fails, check by amount only
        // ₹1,50,000 loans are premium by default
        isPremiumLoan = true;
      }
    }

    if (isPremiumLoan) {
      // Mark user in cooling period
      await executeQuery(
        `UPDATE users 
         SET status = 'on_hold', 
             hold_until_date = NULL, 
             application_hold_reason = 'Your Profile is under cooling period. We will let you know once you are eligible.',
             updated_at = NOW() 
         WHERE id = ?`,
        [userId]
      );

      console.log(`[CreditLimit] User ${userId} marked in cooling period after clearing premium loan (₹1,50,000)`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`[CreditLimit] Error checking cooling period for user ${userId}:`, error);
    return false;
  }
}

module.exports = {
  calculateCreditLimitFor2EMI,
  updateUserCreditLimit,
  storePendingCreditLimit,
  getPendingCreditLimit,
  acceptPendingCreditLimit,
  rejectPendingCreditLimit,
  getMonthlyIncomeFromRange,
  adjustFirstTimeLoanAmount,
  checkAndMarkCoolingPeriod
};

