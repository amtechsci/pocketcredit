/**
 * Extension Calculation Utilities
 * Handles loan extension eligibility, fee calculations, and date calculations
 */

const { 
  parseDateToString, 
  getTodayString, 
  calculateDaysBetween,
  getNextSalaryDate,
  getSalaryDateForMonth,
  formatDateToString,
  parseDateComponents
} = require('./loanCalculations');

const EXTENSION_FEE_RATE = 0.21; // 21% of principal
const GST_RATE = 0.18; // 18% GST
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
  const windowStart = -EXTENSION_WINDOW_BEFORE; // 5 days before
  const windowEnd = EXTENSION_WINDOW_AFTER; // 15 days after

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
  if (loan.processed_post_service_fee) {
    postServiceFee = parseFloat(loan.processed_post_service_fee) || 0;
    
    // For multi-EMI loans, processed_post_service_fee might be per EMI
    // Check if we need to multiply by EMI count
    const planSnapshot = typeof loan.plan_snapshot === 'string' 
      ? JSON.parse(loan.plan_snapshot) 
      : loan.plan_snapshot;
    const emiCount = planSnapshot?.emi_count || 1;
    
    // If it's a multi-EMI loan and the fee seems like a base fee, multiply
    // We'll check fees_breakdown to determine if it's total or per EMI
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
          
          if (postServiceFeeEntry) {
            // Check if it's add_to_total (total fee) or per EMI
            // If application_method is add_to_total, it's already total
            // Otherwise, it might be per EMI
            const applicationMethod = postServiceFeeEntry.application_method;
            if (applicationMethod !== 'add_to_total') {
              // Likely per EMI, multiply
              postServiceFee = postServiceFee * emiCount;
            }
          }
        }
      } catch (e) {
        // If parsing fails, assume it's total fee
      }
    }
  } else {
    // Fallback: Get from fees_breakdown or plan_snapshot
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
          postServiceFee = parseFloat(postServiceFeeEntry.amount || postServiceFeeEntry.fee_amount || 0);
          
          // For multi-EMI, if it's add_to_total, it's already total
          // Otherwise, multiply by EMI count
          const planSnapshot = typeof loan.plan_snapshot === 'string' 
            ? JSON.parse(loan.plan_snapshot) 
            : loan.plan_snapshot;
          const emiCount = planSnapshot?.emi_count || 1;
          
          if (emiCount > 1 && postServiceFeeEntry.application_method !== 'add_to_total') {
            postServiceFee = postServiceFee * emiCount;
          }
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
  
  // Calculate extension fee (21% of principal)
  const extensionFee = Math.round(principal * EXTENSION_FEE_RATE * 100) / 100;

  // Calculate GST (18% of extension fee)
  const gstAmount = Math.round(extensionFee * GST_RATE * 100) / 100;

  // Calculate interest till date
  const processedDateStr = parseDateToString(loan.processed_at);
  if (!processedDateStr) {
    console.error('⚠️ ERROR: processed_at is missing or invalid:', loan.processed_at);
    throw new Error('Invalid processed_at date');
  }

  // Interest calculation: from processed_at to extensionDate (inclusive)
  const interestDays = calculateDaysBetween(processedDateStr, extensionDate);
  const interestRatePerDay = parseFloat(loan.processed_interest_percent_per_day || loan.interest_percent_per_day || 0.001);
  const interestTillDate = Math.round(principal * interestRatePerDay * interestDays * 100) / 100;
  
  console.log(`📊 Extension Fee Details:
    Principal: ₹${principal}
    Extension Fee (21%): ₹${extensionFee}
    GST (18%): ₹${gstAmount}
    Interest Days: ${interestDays} (from ${processedDateStr} to ${extensionDate})
    Interest Rate Per Day: ${interestRatePerDay}
    Interest Till Date: ₹${interestTillDate}`);

  // Total extension amount
  const totalExtensionAmount = Math.round((extensionFee + gstAmount + interestTillDate) * 100) / 100;

  console.log(`✅ Final Extension Payment: ₹${totalExtensionAmount} (Fee: ₹${extensionFee} + GST: ₹${gstAmount} + Interest: ₹${interestTillDate})`);

  return {
    extensionFee,
    gstAmount,
    interestTillDate,
    totalExtensionAmount,
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
  const principal = parseFloat(loan.processed_amount || loan.sanctioned_amount || loan.loan_amount || 0);
  
  // Get post service fee (total, already multiplied by EMI count if multi-EMI)
  let postServiceFee = 0;
  
  // Parse plan snapshot to get EMI count
  const planSnapshot = typeof loan.plan_snapshot === 'string' 
    ? JSON.parse(loan.plan_snapshot) 
    : loan.plan_snapshot;
  const emiCount = planSnapshot?.emi_count || 1;
  
  if (loan.processed_post_service_fee) {
    postServiceFee = parseFloat(loan.processed_post_service_fee) || 0;
    
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
  } else {
    // Fallback to fees_breakdown if processed_post_service_fee is not available
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
          postServiceFee = parseFloat(postServiceFeeEntry.amount || postServiceFeeEntry.fee_amount || 0);
          
          // For multi-EMI, if application_method is NOT 'add_to_total', multiply by EMI count
          if (emiCount > 1 && postServiceFeeEntry.application_method !== 'add_to_total') {
            postServiceFee = postServiceFee * emiCount;
          }
        }
      }
    } catch (e) {
      console.error('Error parsing fees_breakdown for outstanding balance:', e);
    }
  }

  // Calculate GST on post service fee (18% of post service fee)
  const postServiceFeeGST = Math.round(postServiceFee * GST_RATE * 100) / 100;

  // Outstanding balance = Principal + Post Service Fee + GST on Post Service Fee
  const outstandingBalance = Math.round((principal + postServiceFee + postServiceFeeGST) * 100) / 100;

  console.log(`📊 Outstanding Balance Calculation:
    Principal: ₹${principal}
    Post Service Fee: ₹${postServiceFee} (${emiCount > 1 ? `total for ${emiCount} EMIs` : 'single payment'})
    GST on Post Service Fee (18%): ₹${postServiceFeeGST}
    Outstanding Balance: ₹${outstandingBalance}`);

  return outstandingBalance;
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

