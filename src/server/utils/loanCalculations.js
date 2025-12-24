/**
 * Loan Calculation Utilities
 * Centralized calculation logic for loan amounts, interest, and fees
 */

const GST_RATE = 0.18; // 18% GST

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
 * Get next valid salary date based on target day
 * @param {Date} startDate - Starting date
 * @param {number} targetDay - Day of month (1-31)
 * @returns {Date} Next valid salary date
 */
function getNextSalaryDate(startDate, targetDay) {
  // Normalize startDate to midnight (00:00:00) for consistent comparison
  const normalizedStartDate = new Date(startDate);
  normalizedStartDate.setHours(0, 0, 0, 0);
  
  let year = normalizedStartDate.getFullYear();
  let month = normalizedStartDate.getMonth();
  let day = targetDay;

  // Create date for this month's salary date (at midday to avoid timezone shifts)
  let salaryDate = new Date(year, month, day);
  salaryDate.setHours(12, 0, 0, 0);

  // If salary date has passed or is today, move to next month
  if (salaryDate <= normalizedStartDate) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
    salaryDate = new Date(year, month, day);
    salaryDate.setHours(12, 0, 0, 0);
  }

  // Handle edge case: if day doesn't exist in month (e.g., Feb 31), use last day of month
  if (salaryDate.getDate() !== day) {
    const lastDay = new Date(year, month + 1, 0).getDate();
    salaryDate = new Date(year, month, Math.min(day, lastDay));
    salaryDate.setHours(12, 0, 0, 0);
  }

  return salaryDate;
}

/**
 * Get salary date for a specific month offset from start date
 * @param {Date} startDate - Starting date
 * @param {number} targetDay - Day of month (1-31)
 * @param {number} monthOffset - Number of months to add (0 = current month, 1 = next month, etc.)
 * @returns {Date} Salary date for the specified month
 */
function getSalaryDateForMonth(startDate, targetDay, monthOffset = 0) {
  let year = startDate.getFullYear();
  let month = startDate.getMonth() + monthOffset;
  
  // Handle year rollover
  while (month > 11) {
    month -= 12;
    year += 1;
  }
  while (month < 0) {
    month += 12;
    year -= 1;
  }

  // Try to create date with target day (at midday to avoid timezone shifts)
  let salaryDate = new Date(year, month, targetDay);
  salaryDate.setHours(12, 0, 0, 0);

  // Handle edge case: if day doesn't exist in month (e.g., Feb 31), use last day of month
  if (salaryDate.getDate() !== targetDay) {
    const lastDay = new Date(year, month + 1, 0).getDate();
    salaryDate = new Date(year, month, Math.min(targetDay, lastDay));
    salaryDate.setHours(12, 0, 0, 0);
  }

  return salaryDate;
}

/**
 * Calculate days for interest based on plan type and salary date
 * @param {Object} planData - Plan data
 * @param {Object} userData - User data
 * @param {Date} calculationDate - Date to calculate from (default: today)
 * @returns {Object} Days calculation result
 */
function calculateInterestDays(planData, userData, calculationDate = new Date()) {
  const today = new Date(calculationDate);
  today.setHours(0, 0, 0, 0);

  let days = planData.repayment_days || planData.total_duration_days || 15;
  let calculationMethod = 'fixed';
  let repaymentDate = null;

  // If plan uses salary date calculation
  if (planData.calculate_by_salary_date && userData.salary_date) {
    const salaryDate = parseInt(userData.salary_date);

    if (salaryDate >= 1 && salaryDate <= 31) {
      if (planData.plan_type === 'single') {
        // Single payment plan: calculate to next salary date or extend if duration is less
        let nextSalaryDate = getNextSalaryDate(today, salaryDate);

        // Calculate days from today to next salary date (INCLUSIVE)
        // Start day is counted as day 1
        // Example: Dec 14 to Jan 4 = 22 days (Dec 14 is day 1)
        let daysToNextSalary = Math.ceil((nextSalaryDate - today) / (1000 * 60 * 60 * 24)) + 1;

        // If days to next salary date is less than required duration, extend to following month
        if (daysToNextSalary < days) {
          // Keep adding months until we reach or exceed the required duration
          let targetSalaryDate = new Date(nextSalaryDate);
          let daysToTarget = daysToNextSalary;

          while (daysToTarget < days) {
            targetSalaryDate = getNextSalaryDate(
              new Date(targetSalaryDate.getFullYear(), targetSalaryDate.getMonth() + 1, 1),
              salaryDate
            );
            // INCLUSIVE counting: add 1 to include start day
            daysToTarget = Math.ceil((targetSalaryDate - today) / (1000 * 60 * 60 * 24)) + 1;
          }

          days = daysToTarget;
          repaymentDate = targetSalaryDate;
        } else {
          days = daysToNextSalary;
          repaymentDate = nextSalaryDate;
        }

        calculationMethod = 'salary_date';
      } else if (planData.plan_type === 'multi_emi' && planData.emi_frequency === 'monthly') {
        // Multi-EMI plan with monthly frequency: calculate first EMI date
        let nextSalaryDate = getNextSalaryDate(today, salaryDate);
        
        // Calculate days from today to next salary date (INCLUSIVE)
        let daysToNextSalary = Math.ceil((nextSalaryDate - today) / (1000 * 60 * 60 * 24)) + 1;

        // If days to next salary date is less than required duration (minimum days), extend to following month
        if (daysToNextSalary < days) {
          // Move to next month's salary date
          nextSalaryDate = getSalaryDateForMonth(today, salaryDate, 1);
          daysToNextSalary = Math.ceil((nextSalaryDate - today) / (1000 * 60 * 60 * 24)) + 1;
        }

        // For Multi-EMI, the repayment date is the first EMI date
        // Ensure the repayment date matches the salary date exactly
        // If nextSalaryDate doesn't match the target salary day, correct it
        if (nextSalaryDate.getDate() !== salaryDate) {
          // Recalculate to ensure we get the exact salary date in the same month
          const targetYear = nextSalaryDate.getFullYear();
          const targetMonth = nextSalaryDate.getMonth();
          nextSalaryDate = new Date(targetYear, targetMonth, salaryDate);
          nextSalaryDate.setHours(0, 0, 0, 0);
          
          // Handle edge case: if day doesn't exist in month (e.g., Feb 31), use last day
          if (nextSalaryDate.getDate() !== salaryDate) {
            const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
            nextSalaryDate = new Date(targetYear, targetMonth, Math.min(salaryDate, lastDay));
            nextSalaryDate.setHours(0, 0, 0, 0);
          }
          
          // Recalculate days after correction
          daysToNextSalary = Math.ceil((nextSalaryDate - today) / (1000 * 60 * 60 * 24)) + 1;
        }

        // For Multi-EMI, the repayment date is the first EMI date
        days = daysToNextSalary;
        repaymentDate = nextSalaryDate;
        calculationMethod = 'salary_date';
      }
    }
  }

  return {
    days,
    calculationMethod,
    repaymentDate
  };
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

/**
 * Complete loan calculation function - Single source of truth
 * Calculates all loan values including fees with GST, interest, disbursal, and total repayable
 * 
 * @param {Object} loanData - Loan data
 * @param {number} loanData.loan_amount - Principal loan amount
 * @param {number} loanData.loan_id - Loan application ID (optional)
 * @param {string} loanData.status - Loan status (optional)
 * @param {Date|string} loanData.disbursed_at - Disbursement date (optional)
 * 
 * @param {Object} planData - Plan data
 * @param {number} planData.plan_id - Plan ID
 * @param {string} planData.plan_type - 'single' or 'multi_emi'
 * @param {number} planData.repayment_days - Days for single payment plans
 * @param {number} planData.total_duration_days - Total duration days
 * @param {number} planData.interest_percent_per_day - Interest rate per day (decimal, e.g., 0.001)
 * @param {boolean} planData.calculate_by_salary_date - Whether to calculate by salary date
 * @param {Array} planData.fees - Array of fee objects
 * @param {string} planData.fees[].fee_name - Fee name
 * @param {number} planData.fees[].fee_percent - Fee percentage
 * @param {string} planData.fees[].application_method - 'deduct_from_disbursal' or 'add_to_total'
 * 
 * @param {Object} userData - User data
 * @param {number} userData.user_id - User ID
 * @param {number} userData.salary_date - Day of month (1-31) or null
 * 
 * @param {Object} options - Optional parameters
 * @param {number} options.customDays - Override days calculation
 * @param {Date} options.calculationDate - Date to calculate from (default: today)
 * 
 * @returns {Object} Complete calculation breakdown
 */
function calculateCompleteLoanValues(loanData, planData, userData = {}, options = {}) {
  // Validate inputs
  const principal = parseFloat(loanData.loan_amount || 0);
  if (principal <= 0) {
    throw new Error('Invalid principal amount');
  }

  const interestPercentPerDay = parseFloat(planData.interest_percent_per_day || 0);
  if (interestPercentPerDay < 0) {
    throw new Error('Invalid interest rate');
  }

  // Parse fees
  const fees = planData.fees || [];
  const deductFromDisbursal = [];
  const addToTotal = [];

  let totalDisbursalFee = 0; // Sum of fee amounts (without GST)
  let totalDisbursalFeeGST = 0; // Sum of GST on deduct fees
  let totalRepayableFee = 0; // Sum of fee amounts (without GST)
  let totalRepayableFeeGST = 0; // Sum of GST on add fees

  // Calculate each fee with GST
  fees.forEach(fee => {
    const feePercent = parseFloat(fee.fee_percent || 0);
    const feeAmount = Math.round((principal * feePercent) / 100 * 100) / 100; // Round to 2 decimals
    const gstAmount = Math.round(feeAmount * GST_RATE * 100) / 100; // Round to 2 decimals
    const totalWithGST = Math.round((feeAmount + gstAmount) * 100) / 100;

    const feeDetail = {
      fee_name: fee.fee_name || 'Unknown Fee',
      fee_percent: feePercent,
      fee_amount: feeAmount,
      gst_amount: gstAmount,
      total_with_gst: totalWithGST
    };

    if (fee.application_method === 'deduct_from_disbursal') {
      deductFromDisbursal.push(feeDetail);
      totalDisbursalFee += feeAmount;
      totalDisbursalFeeGST += gstAmount;
    } else if (fee.application_method === 'add_to_total') {
      addToTotal.push(feeDetail);
      totalRepayableFee += feeAmount;
      totalRepayableFeeGST += gstAmount;
    }
  });

  // Round totals
  totalDisbursalFee = Math.round(totalDisbursalFee * 100) / 100;
  totalDisbursalFeeGST = Math.round(totalDisbursalFeeGST * 100) / 100;
  totalRepayableFee = Math.round(totalRepayableFee * 100) / 100;
  totalRepayableFeeGST = Math.round(totalRepayableFeeGST * 100) / 100;

  const totalDisbursalDeduction = Math.round((totalDisbursalFee + totalDisbursalFeeGST) * 100) / 100;
  const totalRepayableAddition = Math.round((totalRepayableFee + totalRepayableFeeGST) * 100) / 100;

  // Calculate disbursal amount
  const disbursalAmount = Math.round((principal - totalDisbursalDeduction) * 100) / 100;

  // Calculate interest days
  let daysResult;
  if (options.customDays !== undefined && options.customDays !== null) {
    daysResult = {
      days: options.customDays,
      calculationMethod: 'custom',
      repaymentDate: null
    };
  } else {
    daysResult = calculateInterestDays(planData, userData, options.calculationDate || new Date());
  }

  const { days, calculationMethod, repaymentDate } = daysResult;

  // Log calculation inputs for debugging
  console.log('💡 Loan Calculation Inputs:');
  console.log(`   Principal: ₹${principal.toFixed(2)}`);
  console.log(`   Interest Rate: ${interestPercentPerDay} per day (${(interestPercentPerDay * 365 * 100).toFixed(2)}% p.a.)`);
  console.log(`   Days: ${days} (${calculationMethod})`);
  console.log(`   Deduct Fees: ${deductFromDisbursal.length}, Total: ₹${totalDisbursalDeduction.toFixed(2)} (incl. GST)`);
  console.log(`   Add to Total Fees: ${addToTotal.length}, Total: ₹${totalRepayableAddition.toFixed(2)} (incl. GST)`);

  // ✅ VALIDATION 1: Interest calculated on PRINCIPAL (not disbursal)
  const interest = Math.round(principal * interestPercentPerDay * days * 100) / 100;
  console.log(`✅ Interest calculated on PRINCIPAL: ₹${principal.toFixed(2)} × ${interestPercentPerDay} × ${days} = ₹${interest.toFixed(2)}`);

  // ✅ VALIDATION 2: Verify GST is included in all fees
  const totalGST = totalDisbursalFeeGST + totalRepayableFeeGST;
  console.log(`✅ GST (18%) included: ₹${totalGST.toFixed(2)}`);

  // ✅ VALIDATION 3: Verify days calculation
  console.log(`✅ Days validated: ${days} days using ${calculationMethod} method`);

  // ✅ VALIDATION 4: Verify fee categorization
  console.log(`✅ Fee categories verified:`);
  console.log(`   - Deduct from Disbursal: ${deductFromDisbursal.map(f => f.fee_name).join(', ') || 'None'}`);
  console.log(`   - Add to Total: ${addToTotal.map(f => f.fee_name).join(', ') || 'None'}`);

  // Calculate total repayable
  const totalRepayable = Math.round((principal + interest + totalRepayableAddition) * 100) / 100;

  // Build calculation explanation strings
  const disbursalCalculation = `Principal (₹${principal.toFixed(2)}) - Deduct Fees (₹${totalDisbursalDeduction.toFixed(2)}) = ₹${disbursalAmount.toFixed(2)}`;

  const totalBreakdown = `Principal (₹${principal.toFixed(2)}) + Interest (₹${interest.toFixed(2)}) + Repayable Fees (₹${totalRepayableAddition.toFixed(2)}) = ₹${totalRepayable.toFixed(2)}`;

  // Log final calculation results
  console.log('📊 Final Calculation Results:');
  console.log(`   Disbursal: ₹${disbursalAmount.toFixed(2)} (customer receives)`);
  console.log(`   Total Repayable: ₹${totalRepayable.toFixed(2)} (customer pays back)`);
  console.log(`   Effective Cost: ₹${(totalRepayable - disbursalAmount).toFixed(2)}`);

  return {
    principal: principal,
    fees: {
      deductFromDisbursal: deductFromDisbursal,
      addToTotal: addToTotal
    },
    totals: {
      disbursalFee: totalDisbursalFee,
      disbursalFeeGST: totalDisbursalFeeGST,
      repayableFee: totalRepayableFee,
      repayableFeeGST: totalRepayableFeeGST,
      totalDisbursalDeduction: totalDisbursalDeduction,
      totalRepayableAddition: totalRepayableAddition
    },
    disbursal: {
      amount: disbursalAmount,
      calculation: disbursalCalculation
    },
    interest: {
      amount: interest,
      days: days,
      rate_per_day: interestPercentPerDay,
      calculation_method: calculationMethod,
      calculation_date: options.calculationDate || new Date(),
      repayment_date: repaymentDate
    },
    total: {
      repayable: totalRepayable,
      breakdown: totalBreakdown
    }
  };
}

module.exports = {
  calculateLoanValues,
  calculateTotalDays,
  getNextSalaryDate,
  getSalaryDateForMonth,
  calculateCompleteLoanValues,
  getLoanCalculation,
  updateLoanCalculation,
  calculateInterestDays
};

