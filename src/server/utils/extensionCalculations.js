/**
 * Extension Calculation Utilities
 * Handles loan extension eligibility, fee calculations, and date calculations
 * Uses decimal.js for precise financial calculations
 */

const Decimal = require('decimal.js');
const { 
  parseDateToString, 
  getTodayString, 
  calculateDaysBetween,
  getNextSalaryDate,
  getSalaryDateForMonth,
  formatDateToString,
  parseDateComponents,
  toDecimal2
} = require('./loanCalculations');

// Financial Constants - Use Decimal for precision
const EXTENSION_FEE_RATE = new Decimal(0.21); // 21% of principal
const GST_RATE = new Decimal(0.18); // 18% GST
const MAX_EXTENSIONS = 4;
const EXTENSION_WINDOW_BEFORE = 5; // Days before due date
const EXTENSION_WINDOW_AFTER = 15; // Days after due date

/**
 * Check if loan is eligible for extension
 * @param {Object} loan - Loan application object
 * @param {string} currentDate - Current date in YYYY-MM-DD format (optional, defaults to today)
 * @param {number} emiIndex - EMI index (0 for first EMI, null for single payment)
 * @returns {Object} Eligibility result with {eligible, reason, extensionWindow}
 */
function checkExtensionEligibility(loan, currentDate = null, emiIndex = null) {
  // Default to today if not provided
  if (!currentDate) {
    currentDate = getTodayString();
  }

  // Check if loan is processed
  if (!loan.processed_at) {
    return {
      eligible: false,
      reason: 'Loan must be processed before extension can be requested'
    };
  }

  // Check extension count
  const extensionCount = loan.extension_count || 0;
  if (extensionCount >= MAX_EXTENSIONS) {
    return {
      eligible: false,
      reason: `Maximum ${MAX_EXTENSIONS} extensions already availed`
    };
  }

  // Check if there's a pending extension
  if (loan.extension_status === 'pending') {
    return {
      eligible: false,
      reason: 'A pending extension request already exists'
    };
  }

  // Get due date
  let dueDateStr = null;
  
  // For multi-EMI loans, only first EMI can be extended
  if (emiIndex !== null && emiIndex !== 0) {
    return {
      eligible: false,
      reason: 'Only the first EMI can be extended'
    };
  }

  // Parse processed_due_date (can be JSON array for multi-EMI or single date)
  if (loan.processed_due_date) {
    try {
      // Try parsing as JSON array first
      const parsed = typeof loan.processed_due_date === 'string' 
        ? JSON.parse(loan.processed_due_date) 
        : loan.processed_due_date;
      
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Multi-EMI: use first EMI date
        dueDateStr = parsed[0];
      } else if (typeof parsed === 'string' && /^\d{4}-\d{2}-\d{2}/.test(parsed)) {
        // Single date string
        dueDateStr = parsed.split('T')[0].split(' ')[0];
      }
    } catch (e) {
      // If parsing fails, try as direct string
      if (typeof loan.processed_due_date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(loan.processed_due_date)) {
        dueDateStr = loan.processed_due_date.split('T')[0].split(' ')[0];
      }
    }
  }

  if (!dueDateStr) {
    return {
      eligible: false,
      reason: 'Due date not found'
    };
  }

  // Check extension window (D-5 to D+15)
  const dueDateComponents = parseDateComponents(dueDateStr);
  if (!dueDateComponents) {
    return {
      eligible: false,
      reason: 'Invalid due date format'
    };
  }

  const dueDate = new Date(dueDateComponents.year, dueDateComponents.month, dueDateComponents.day);
  const currentDateComponents = parseDateComponents(currentDate);
  if (!currentDateComponents) {
    return {
      eligible: false,
      reason: 'Invalid current date format'
    };
  }
  const currentDateObj = new Date(currentDateComponents.year, currentDateComponents.month, currentDateComponents.day);

  // Calculate days until due date
  const daysUntilDue = Math.ceil((dueDate.getTime() - currentDateObj.getTime()) / (1000 * 60 * 60 * 24));

  // Extension window: D-5 to D+15
  // D-5 = 5 days BEFORE due date = +5 days until due (positive = future)
  // D+15 = 15 days AFTER due date = -15 days until due (negative = overdue)
  const windowStart = -EXTENSION_WINDOW_AFTER; // -15 (15 days after due = overdue)
  const windowEnd = EXTENSION_WINDOW_BEFORE; // +5 (5 days before due = future)

  const isWithinWindow = daysUntilDue >= windowStart && daysUntilDue <= windowEnd;

  // Calculate window dates for response
  const windowStartDate = new Date(dueDate);
  windowStartDate.setDate(windowStartDate.getDate() - EXTENSION_WINDOW_BEFORE);
  const windowEndDate = new Date(dueDate);
  windowEndDate.setDate(windowEndDate.getDate() + EXTENSION_WINDOW_AFTER);

  if (!isWithinWindow) {
    let reason;
    if (daysUntilDue > windowEnd) {
      reason = `Extension window opens on ${formatDateToString(windowStartDate)}`;
    } else {
      reason = `Extension window expired on ${formatDateToString(windowEndDate)}`;
    }
    return {
      eligible: false,
      reason,
      extensionWindow: {
        start_date: formatDateToString(windowStartDate),
        end_date: formatDateToString(windowEndDate),
        current_date: currentDate,
        is_within_window: false
      }
    };
  }

  return {
    eligible: true,
    extensionWindow: {
      start_date: formatDateToString(windowStartDate),
      end_date: formatDateToString(windowEndDate),
      current_date: currentDate,
      is_within_window: true
    }
  };
}

/**
 * Calculate new due date after extension
 * @param {Object} loan - Loan application object
 * @param {string} originalDueDate - Original due date in YYYY-MM-DD format (first EMI for multi-EMI)
 * @param {Object} planSnapshot - Plan snapshot from loan
 * @param {number} userSalaryDate - User's salary date (1-31)
 * @param {Array} originalEmiDates - Original EMI dates array (for multi-EMI loans)
 * @returns {Object} {newDueDate, newEmiDates, extensionPeriodDays}
 */
function calculateNewDueDate(loan, originalDueDate, planSnapshot, userSalaryDate = null, originalEmiDates = null) {
  const isMultiEmi = (planSnapshot.emi_count || 1) > 1;
  const calculateBySalaryDate = planSnapshot.calculate_by_salary_date === 1 || planSnapshot.calculate_by_salary_date === true;
  const isFixedDays = !calculateBySalaryDate;

  let newDueDateStr = null;
  let newEmiDates = null;
  let extensionPeriodDays = 0;

  // Parse original due date
  const originalDueDateComponents = parseDateComponents(originalDueDate);
  if (!originalDueDateComponents) {
    throw new Error('Invalid original due date format');
  }
  const originalDueDateObj = new Date(originalDueDateComponents.year, originalDueDateComponents.month, originalDueDateComponents.day);

  if (isMultiEmi) {
    // Multi-EMI loan: Shift all EMI dates
    newEmiDates = [];
    const emiCount = planSnapshot.emi_count || 1;

    // Get original EMI dates - use provided array or parse from loan
    let originalEmiDatesArray = originalEmiDates;
    if (!originalEmiDatesArray || !Array.isArray(originalEmiDatesArray)) {
      if (loan.processed_due_date) {
        try {
          const parsed = typeof loan.processed_due_date === 'string' 
            ? JSON.parse(loan.processed_due_date) 
            : loan.processed_due_date;
          if (Array.isArray(parsed)) {
            originalEmiDatesArray = parsed;
          } else {
            originalEmiDatesArray = [originalDueDate];
          }
        } catch (e) {
          // Fallback: generate from original due date
          originalEmiDatesArray = [originalDueDate];
        }
      } else {
        originalEmiDatesArray = [originalDueDate];
      }
    }

    if (calculateBySalaryDate && userSalaryDate) {
      // Salary date based: Shift each EMI to next month's salary date
      const salaryDate = parseInt(userSalaryDate);
      if (salaryDate >= 1 && salaryDate <= 31) {
        for (let i = 0; i < emiCount; i++) {
          const originalEmiDate = originalEmiDatesArray[i] || originalDueDate;
          const originalEmiComponents = parseDateComponents(originalEmiDate);
          if (originalEmiComponents) {
            const originalEmiDateObj = new Date(originalEmiComponents.year, originalEmiComponents.month, originalEmiComponents.day);
            // Get next month's salary date from this EMI date
            const newEmiDateObj = getSalaryDateForMonth(originalEmiDateObj, salaryDate, 1);
            newEmiDates.push(formatDateToString(newEmiDateObj));
          }
        }
        // Extension period for salary date based multi-EMI: gap between first and second NEW EMI
        // According to business logic: Extension Period = gap between first and second NEW EMI dates
        if (newEmiDates.length >= 2) {
          extensionPeriodDays = calculateDaysBetween(newEmiDates[0], newEmiDates[1]);
        } else {
          // Fallback: calculate from original EMI dates if new dates not available
          if (originalEmiDatesArray && originalEmiDatesArray.length >= 2) {
            extensionPeriodDays = calculateDaysBetween(originalEmiDatesArray[0], originalEmiDatesArray[1]);
          } else {
            extensionPeriodDays = 28; // Default to 28 days for monthly
          }
        }
        newDueDateStr = newEmiDates[newEmiDates.length - 1]; // Last EMI date
      }
    } else {
      // Fixed days: Add 15 days to each EMI date
      const fixedExtensionDays = 15;
      for (let i = 0; i < emiCount; i++) {
        const originalEmiDate = originalEmiDatesArray[i] || originalDueDate;
        const originalEmiComponents = parseDateComponents(originalEmiDate);
        if (originalEmiComponents) {
          const newEmiDateObj = new Date(originalEmiComponents.year, originalEmiComponents.month, originalEmiComponents.day);
          newEmiDateObj.setDate(newEmiDateObj.getDate() + fixedExtensionDays);
          newEmiDates.push(formatDateToString(newEmiDateObj));
        }
      }
      extensionPeriodDays = fixedExtensionDays;
      newDueDateStr = newEmiDates[newEmiDates.length - 1]; // Last EMI date
    }
  } else {
    // Single payment loan
    if (calculateBySalaryDate && userSalaryDate) {
      // Salary date based: Shift to next month's salary date
      const salaryDate = parseInt(userSalaryDate);
      if (salaryDate >= 1 && salaryDate <= 31) {
        const newDueDateObj = getSalaryDateForMonth(originalDueDateObj, salaryDate, 1);
        newDueDateStr = formatDateToString(newDueDateObj);
        extensionPeriodDays = calculateDaysBetween(originalDueDate, newDueDateStr);
      }
    } else {
      // Fixed days: Add 15 days
      const fixedExtensionDays = 15;
      const newDueDateObj = new Date(originalDueDateObj);
      newDueDateObj.setDate(newDueDateObj.getDate() + fixedExtensionDays);
      newDueDateStr = formatDateToString(newDueDateObj);
      extensionPeriodDays = fixedExtensionDays;
    }
  }

  if (!newDueDateStr) {
    throw new Error('Failed to calculate new due date');
  }

  return {
    newDueDate: newDueDateStr,
    newEmiDates: newEmiDates,
    extensionPeriodDays: extensionPeriodDays
  };
}

/**
 * Calculate extension fees and charges
 * @param {Object} loan - Loan application object
 * @param {string} extensionDate - Date of extension request in YYYY-MM-DD format
 * @returns {Object} Extension fee details
 */
function calculateExtensionFees(loan, extensionDate = null) {
  if (!extensionDate) {
    extensionDate = getTodayString();
  }

  // Get post service fee
  let postServiceFee = 0;
  
  // Try to get from processed_post_service_fee first
  // IMPORTANT: processed_post_service_fee is ALWAYS stored as TOTAL (already multiplied by EMI count)
  // This is set during loan processing from calculatedValues.totals.repayableFee
  if (loan.processed_post_service_fee) {
    postServiceFee = parseFloat(loan.processed_post_service_fee) || 0;
    // No multiplication needed - it's already the total fee
    console.log(`📊 Using processed_post_service_fee: ₹${postServiceFee} (already total for all EMIs)`);
  } else {
    // Fallback: Get from fees_breakdown
    // Note: fees_breakdown stores the already-multiplied total for add_to_total fees
    try {
      const feesBreakdown = typeof loan.fees_breakdown === 'string' 
        ? JSON.parse(loan.fees_breakdown) 
        : loan.fees_breakdown;
      
      if (Array.isArray(feesBreakdown)) {
        const postServiceFeeEntry = feesBreakdown.find(f => 
          (f.name?.toLowerCase().includes('post service') || 
           f.fee_name?.toLowerCase().includes('post service')) &&
          f.application_method === 'add_to_total'
        );
        
        if (postServiceFeeEntry) {
          // fees_breakdown stores the total fee (already multiplied by EMI count for multi-EMI)
          postServiceFee = parseFloat(postServiceFeeEntry.amount || postServiceFeeEntry.fee_amount || 0);
          console.log(`📊 Using fees_breakdown post service fee: ₹${postServiceFee} (total for all EMIs)`);
        }
      }
    } catch (e) {
      console.error('Error parsing fees_breakdown:', e);
    }
  }

  // Get principal amount - try multiple field names
  const principal = parseFloat(
    loan.processed_amount || 
    loan.sanctioned_amount || 
    loan.loan_amount || 
    loan.principal_amount || 
    0
  );
  
  console.log(`💰 Extension Fee Calculation Debug:
    processed_amount: ${loan.processed_amount}
    sanctioned_amount: ${loan.sanctioned_amount}
    loan_amount: ${loan.loan_amount}
    principal_amount: ${loan.principal_amount}
    Final Principal: ₹${principal}`);
  
  if (principal === 0) {
    console.error('⚠️ WARNING: Principal is 0! Extension fee calculation will be incorrect.');
  }
  
  // Calculate extension fee (21% of principal) using Decimal
  const principalDecimal = new Decimal(principal);
  const extensionFee = principalDecimal.mul(EXTENSION_FEE_RATE);

  // Calculate GST (18% of extension fee) using Decimal
  const gstAmount = extensionFee.mul(GST_RATE);

  // Calculate interest till date
  const processedDateStr = parseDateToString(loan.processed_at);
  if (!processedDateStr) {
    console.error('⚠️ ERROR: processed_at is missing or invalid:', loan.processed_at);
    throw new Error('Invalid processed_at date');
  }

  // Interest calculation: from processed_at to extensionDate (inclusive)
  const interestDays = calculateDaysBetween(processedDateStr, extensionDate);
  const interestRatePerDay = new Decimal(loan.processed_interest_percent_per_day || loan.interest_percent_per_day || 0.001);
  // Interest = Principal × Interest Rate Per Day × Days
  const interestTillDate = principalDecimal.mul(interestRatePerDay).mul(interestDays);
  
  const extensionFeeNum = toDecimal2(extensionFee);
  const gstAmountNum = toDecimal2(gstAmount);
  const interestTillDateNum = toDecimal2(interestTillDate);
  
  console.log(`📊 Extension Fee Details:
    Principal: ₹${principal}
    Extension Fee (21%): ₹${extensionFeeNum}
    GST (18%): ₹${gstAmountNum}
    Interest Days: ${interestDays} (from ${processedDateStr} to ${extensionDate})
    Interest Rate Per Day: ${interestRatePerDay.toString()}
    Interest Till Date: ₹${interestTillDateNum}`);

  // Total extension amount using Decimal
  const totalExtensionAmount = extensionFee.plus(gstAmount).plus(interestTillDate);

  console.log(`✅ Final Extension Payment: ₹${totalExtensionAmount} (Fee: ₹${extensionFee} + GST: ₹${gstAmount} + Interest: ₹${interestTillDate})`);

  return {
    extensionFee: toDecimal2(extensionFee),
    gstAmount: toDecimal2(gstAmount),
    interestTillDate: toDecimal2(interestTillDate),
    totalExtensionAmount: toDecimal2(totalExtensionAmount),
    postServiceFee, // For reference
    interestDays
  };
}

/**
 * Calculate outstanding loan balance (Principal + Post Service Fee + GST on Post Service Fee)
 * @param {Object} loan - Loan application object
 * @returns {number} Outstanding loan balance
 */
function calculateOutstandingBalance(loan) {
  const principal = parseFloat(loan.processed_amount || loan.sanctioned_amount || loan.loan_amount || loan.principal_amount || 0);
  
  // Get post service fee (total, already multiplied by EMI count if multi-EMI)
  let postServiceFee = 0;
  
  // Parse plan snapshot to get EMI count
  const planSnapshot = typeof loan.plan_snapshot === 'string' 
    ? JSON.parse(loan.plan_snapshot) 
    : loan.plan_snapshot;
  const emiCount = planSnapshot?.emi_count || 1;
  
  console.log(`[Outstanding Balance] Debug: principal=${principal}, emiCount=${emiCount}, processed_post_service_fee=${loan.processed_post_service_fee}`);
  
  if (loan.processed_post_service_fee) {
    postServiceFee = parseFloat(loan.processed_post_service_fee) || 0;
    
    // VALIDATION: If postServiceFee seems unreasonably high (more than 10x principal), it's likely wrong
    // This can happen if the fee was stored incorrectly or if it's a percentage that was calculated wrong
    if (postServiceFee > principal * 10 && principal > 0) {
      console.warn(`[Outstanding Balance] ⚠️ WARNING: postServiceFee (₹${postServiceFee}) is more than 10x principal (₹${principal}). This seems incorrect. Recalculating from fees_breakdown...`);
      postServiceFee = 0; // Reset and recalculate from fees_breakdown
    } else {
      // For multi-EMI, check if processed_post_service_fee is per EMI or total
      if (emiCount > 1) {
        try {
          const feesBreakdown = typeof loan.fees_breakdown === 'string' 
            ? JSON.parse(loan.fees_breakdown) 
            : loan.fees_breakdown;
          
          if (Array.isArray(feesBreakdown)) {
            const postServiceFeeEntry = feesBreakdown.find(f => 
              f.name?.toLowerCase().includes('post service') || 
              f.fee_name?.toLowerCase().includes('post service')
            );
            
            // If application_method is NOT 'add_to_total', it means it's per EMI, so multiply
            if (postServiceFeeEntry && postServiceFeeEntry.application_method !== 'add_to_total') {
              postServiceFee = postServiceFee * emiCount;
            }
            // If application_method is 'add_to_total', processed_post_service_fee is already total
          }
        } catch (e) {
          console.error('Error parsing fees_breakdown for outstanding balance:', e);
          // If parsing fails, assume processed_post_service_fee is total for multi-EMI
        }
      }
    }
  }
  
  // If postServiceFee is still 0 or seems wrong, try to get from fees_breakdown
  if (postServiceFee === 0 || (postServiceFee > principal * 10 && principal > 0)) {
    // Fallback to fees_breakdown if processed_post_service_fee is not available or seems wrong
    try {
      const feesBreakdown = typeof loan.fees_breakdown === 'string' 
        ? JSON.parse(loan.fees_breakdown) 
        : loan.fees_breakdown;
      
      if (Array.isArray(feesBreakdown)) {
        const postServiceFeeEntry = feesBreakdown.find(f => 
          f.name?.toLowerCase().includes('post service') || 
          f.fee_name?.toLowerCase().includes('post service')
        );
        
        if (postServiceFeeEntry) {
          const feeFromBreakdown = parseFloat(postServiceFeeEntry.amount || postServiceFeeEntry.fee_amount || 0);
          
          // Validate: fee should be reasonable (not more than 50% of principal for small loans, or reasonable percentage)
          if (feeFromBreakdown > 0 && (principal === 0 || feeFromBreakdown <= principal * 0.5)) {
            postServiceFee = feeFromBreakdown;
            
            // For multi-EMI, if application_method is NOT 'add_to_total', multiply by EMI count
            if (emiCount > 1 && postServiceFeeEntry.application_method !== 'add_to_total') {
              postServiceFee = postServiceFee * emiCount;
            }
            
            console.log(`[Outstanding Balance] ✅ Using fee from fees_breakdown: ₹${feeFromBreakdown}${emiCount > 1 ? ` × ${emiCount} = ₹${postServiceFee}` : ''}`);
          } else {
            console.warn(`[Outstanding Balance] ⚠️ Fee from breakdown (₹${feeFromBreakdown}) seems unreasonable for principal (₹${principal}). Using 0.`);
            postServiceFee = 0;
          }
        }
      }
    } catch (e) {
      console.error('Error parsing fees_breakdown for outstanding balance:', e);
    }
  }

  // Calculate GST on post service fee (18% of post service fee) using Decimal
  const postServiceFeeDecimal = new Decimal(postServiceFee);
  const principalDecimal = new Decimal(principal);
  const postServiceFeeGST = postServiceFeeDecimal.mul(GST_RATE);

  // Outstanding balance = Principal + Post Service Fee + GST on Post Service Fee
  const outstandingBalance = principalDecimal.plus(postServiceFeeDecimal).plus(postServiceFeeGST);

  const postServiceFeeGSTNum = toDecimal2(postServiceFeeGST);
  const outstandingBalanceNum = toDecimal2(outstandingBalance);
  
  console.log(`📊 Outstanding Balance Calculation:
    Principal: ₹${principal}
    Post Service Fee: ₹${postServiceFee} (${emiCount > 1 ? `total for ${emiCount} EMIs` : 'single payment'})
    GST on Post Service Fee (18%): ₹${postServiceFeeGSTNum}
    Outstanding Balance: ₹${outstandingBalanceNum}`);

  return outstandingBalanceNum;
}

module.exports = {
  checkExtensionEligibility,
  calculateNewDueDate,
  calculateExtensionFees,
  calculateOutstandingBalance,
  MAX_EXTENSIONS,
  EXTENSION_WINDOW_BEFORE,
  EXTENSION_WINDOW_AFTER
};

