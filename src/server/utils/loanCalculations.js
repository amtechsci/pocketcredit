/**
 * Loan Calculation Utilities
 * Centralized calculation logic for loan amounts, interest, and fees
 */

/**
 * Calculate total days from disbursement date to today (inclusive)
 * @param {string|Date} disbursedDate - The date when loan was disbursed
 * @returns {number} Total number of days (inclusive)
 */
function calculateTotalDays(disbursedDate) {
  if (!disbursedDate) {
    return 0;
  }

  // Get only the date part, ignore time
  const startDate = new Date(disbursedDate);
  startDate.setHours(0, 0, 0, 0);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Calculate difference in days
  const diffInMs = today - startDate;
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  
  // Add 1 to include both start and end date (inclusive counting)
  return diffInDays + 1;
}

/**
 * Calculate all loan values based on principal, fees, and days
 * @param {Object} loanData - Loan data object
 * @param {number} loanData.loan_amount - Principal loan amount
 * @param {number} loanData.processing_fee_percent - Processing fee percentage
 * @param {number} loanData.interest_percent_per_day - Daily interest percentage
 * @param {number} days - Number of days for interest calculation
 * @returns {Object} Calculated values
 */
function calculateLoanValues(loanData, days) {
  // Parse values to ensure they're numbers
  const principal = parseFloat(loanData.loan_amount || 0);
  const pfPercent = parseFloat(loanData.processing_fee_percent || 0);
  const interestPercentPerDay = parseFloat(loanData.interest_percent_per_day || 0);
  
  // Validate inputs
  if (principal <= 0) {
    throw new Error('Invalid principal amount');
  }
  
  if (days < 0) {
    throw new Error('Days cannot be negative');
  }
  
  // Calculate processing fee (deducted from principal)
  const processingFee = (principal * pfPercent) / 100;
  
  // Calculate disbursement amount (what user actually receives)
  // User receives: Principal - Processing Fee
  const disbAmount = principal - processingFee;
  
  // Calculate interest on principal amount
  // Interest = Principal × Interest Rate (decimal) × Days
  // Note: interest_percent_per_day is already in decimal format (e.g., 0.001 = 0.1% per day)
  const interest = principal * interestPercentPerDay * days;
  
  // Calculate total amount to be repaid
  // User repays: Principal + Interest (Processing fee already deducted upfront)
  const totalAmount = principal + interest;
  
  return {
    principal: parseFloat(principal.toFixed(2)),
    processingFee: parseFloat(processingFee.toFixed(2)),
    processingFeePercent: pfPercent,
    disbAmount: parseFloat(disbAmount.toFixed(2)),
    interest: parseFloat(interest.toFixed(2)),
    interestPercentPerDay: interestPercentPerDay,
    days: days,
    totalAmount: parseFloat(totalAmount.toFixed(2)),
    totalRepayable: parseFloat(totalAmount.toFixed(2))
  };
}

/**
 * Get loan calculation by loan ID
 * @param {Object} db - Database connection
 * @param {number} loanId - Loan application ID
 * @param {number} customDays - Optional: Custom days for calculation (if not provided, uses plan days or actual days)
 * @returns {Promise<Object>} Calculated loan values
 */
async function getLoanCalculation(db, loanId, customDays = null) {
  try {
    // Fetch loan data from database
    const [loans] = await db.execute(
      `SELECT 
        id,
        loan_amount,
        processing_fee_percent,
        interest_percent_per_day,
        status,
        disbursed_at,
        plan_snapshot
      FROM loan_applications 
      WHERE id = ?`,
      [loanId]
    );
    
    if (!loans || loans.length === 0) {
      throw new Error('Loan not found');
    }
    
    const loan = loans[0];
    
    // Determine days for calculation
    let days = customDays;
    
    if (days === null) {
      // If loan is running (disbursed), calculate actual days
      if (loan.disbursed_at && ['account_manager', 'cleared', 'active'].includes(loan.status)) {
        days = calculateTotalDays(loan.disbursed_at);
      } else {
        // For applied loans, use plan days
        if (loan.plan_snapshot) {
          try {
            const planData = typeof loan.plan_snapshot === 'string' 
              ? JSON.parse(loan.plan_snapshot) 
              : loan.plan_snapshot;
            days = planData.repayment_days || 15; // Default to 15 days
          } catch (e) {
            days = 15; // Default fallback
          }
        } else {
          days = 15; // Default fallback
        }
      }
    }
    
    // Calculate all values
    const calculations = calculateLoanValues(loan, days);
    
    return {
      success: true,
      loanId: loan.id,
      status: loan.status,
      ...calculations
    };
    
  } catch (error) {
    console.error('Error calculating loan values:', error);
    throw error;
  }
}

/**
 * Update loan calculation fields in database
 * @param {Object} db - Database connection
 * @param {number} loanId - Loan application ID
 * @param {Object} updates - Fields to update
 * @param {number} updates.processing_fee_percent - Processing fee percentage
 * @param {number} updates.interest_percent_per_day - Daily interest percentage
 * @returns {Promise<Object>} Updated calculation
 */
async function updateLoanCalculation(db, loanId, updates) {
  try {
    // Validate inputs
    if (updates.processing_fee_percent !== undefined) {
      const pfPercent = parseFloat(updates.processing_fee_percent);
      if (isNaN(pfPercent) || pfPercent < 0 || pfPercent > 100) {
        throw new Error('Invalid processing fee percentage');
      }
    }
    
    if (updates.interest_percent_per_day !== undefined) {
      const intPercent = parseFloat(updates.interest_percent_per_day);
      if (isNaN(intPercent) || intPercent < 0) {
        throw new Error('Invalid interest percentage');
      }
    }
    
    // Build update query
    const updateFields = [];
    const updateValues = [];
    
    if (updates.processing_fee_percent !== undefined) {
      updateFields.push('processing_fee_percent = ?');
      updateValues.push(parseFloat(updates.processing_fee_percent));
    }
    
    if (updates.interest_percent_per_day !== undefined) {
      updateFields.push('interest_percent_per_day = ?');
      updateValues.push(parseFloat(updates.interest_percent_per_day));
    }
    
    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }
    
    updateFields.push('updated_at = NOW()');
    updateValues.push(loanId);
    
    // Update database
    await db.execute(
      `UPDATE loan_applications 
       SET ${updateFields.join(', ')} 
       WHERE id = ?`,
      updateValues
    );
    
    // Recalculate and update derived fields
    const calculation = await getLoanCalculation(db, loanId);
    
    // Update calculated fields
    await db.execute(
      `UPDATE loan_applications 
       SET 
         processing_fee = ?,
         total_interest = ?,
         total_repayable = ?,
         updated_at = NOW()
       WHERE id = ?`,
      [
        calculation.processingFee,
        calculation.interest,
        calculation.totalRepayable,
        loanId
      ]
    );
    
    return {
      success: true,
      message: 'Loan calculation updated successfully',
      calculation
    };
    
  } catch (error) {
    console.error('Error updating loan calculation:', error);
    throw error;
  }
}

module.exports = {
  calculateLoanValues,
  calculateTotalDays,
  calculateLoanValues,
  getLoanCalculation,
  updateLoanCalculation
};

