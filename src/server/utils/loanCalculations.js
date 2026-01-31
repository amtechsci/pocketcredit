/**
 * Loan Calculation Utilities
 * Centralized calculation logic for loan amounts, interest, and fees
 * Uses decimal.js for precise financial calculations
 */

const Decimal = require('decimal.js');

// Financial Constants - Centralized
const GST_RATE = new Decimal(0.18); // 18% GST
const EXTENSION_FEE_RATE = new Decimal(0.21); // 21% of principal (for extensions)

/**
 * Ensure monetary value has exactly 2 decimal places (rounds to nearest cent)
 * For loan applications, all monetary values should have 2 decimal places
 * Uses Decimal for precision
 * @param {number|string|Decimal} value - Numeric value to format
 * @returns {number} Value with exactly 2 decimal places
 */
function toDecimal2(value) {
  if (value === null || value === undefined) {
    return 0;
  }
  try {
    const decimal = new Decimal(value);
    if (decimal.isNaN()) {
      return 0;
    }
    // Round to 2 decimal places and convert to number
    return parseFloat(decimal.toFixed(2));
  } catch (e) {
    return 0;
  }
}

/**
 * Convert Decimal to number with 2 decimal places (for API responses)
 * @param {Decimal} value - Decimal value
 * @returns {number} Number with 2 decimal places
 */
function decimalToNumber(value) {
  if (!value || !(value instanceof Decimal)) {
    return 0;
  }
  return parseFloat(value.toFixed(2));
}

/**
 * Convert Decimal to string with 2 decimal places (for API responses)
 * @param {Decimal} value - Decimal value
 * @returns {string} String with 2 decimal places
 */
function decimalToString(value) {
  if (!value || !(value instanceof Decimal)) {
    return '0.00';
  }
  return value.toFixed(2);
}

/**
 * Parse MySQL datetime string or Date object to YYYY-MM-DD format (no timezone conversion)
 * @param {string|Date} dateValue - Date value from MySQL or Date object
 * @returns {string|null} Date string in YYYY-MM-DD format, or null if invalid
 */
function parseDateToString(dateValue) {
  if (!dateValue) return null;

  // If already a string, extract date portion directly (no timezone conversion)
  if (typeof dateValue === 'string') {
    // Handle MySQL datetime format: "2025-12-15 15:00:00"
    if (dateValue.includes(' ')) {
      return dateValue.split(' ')[0];
    }
    // Handle ISO format: "2025-12-15T15:00:00.000Z"
    if (dateValue.includes('T')) {
      return dateValue.split('T')[0];
    }
    // Already YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      return dateValue;
    }
  }

  // If Date object, extract date components
  // Since server is in IST and MySQL stores dates in IST, use local date components
  // This matches the calendar date as stored in MySQL
  if (dateValue instanceof Date) {
    // Check if date is valid
    if (isNaN(dateValue.getTime())) {
      return null;
    }

    // Use local date components (server is in IST, so this matches MySQL calendar date)
    // This is correct because:
    // 1. MySQL stores "2026-01-01 15:00:00" in IST
    // 2. Server is in IST timezone
    // 3. Date object created from MySQL datetime will have local time representation
    // 4. getFullYear(), getMonth(), getDate() return local date components
    const year = dateValue.getFullYear();
    const month = String(dateValue.getMonth() + 1).padStart(2, '0');
    const day = String(dateValue.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return null;
}

/**
 * Get today's date as YYYY-MM-DD string (no timezone conversion)
 * @returns {string} Today's date in YYYY-MM-DD format
 */
function getTodayString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Convert a date value (Date object, string, or Date-like) to YYYY-MM-DD string format
 * @param {any} dateValue - Date value that could be Date object, string, or null
 * @returns {string|null} Date in YYYY-MM-DD format or null
 */
function normalizeDateToString(dateValue) {
  if (!dateValue) return null;
  
  // If it's already a string in YYYY-MM-DD format, return it
  if (typeof dateValue === 'string') {
    // Check if it's already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      return dateValue;
    }
    // Try to parse it as a date
    const date = new Date(dateValue);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return null;
  }
  
  // If it's a Date object
  if (dateValue instanceof Date) {
    if (isNaN(dateValue.getTime())) return null;
    const year = dateValue.getFullYear();
    const month = String(dateValue.getMonth() + 1).padStart(2, '0');
    const day = String(dateValue.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  return null;
}

/**
 * Calculate calendar day difference between two dates (inclusive)
 * @param {string} startDateStr - Start date in YYYY-MM-DD format
 * @param {string} endDateStr - End date in YYYY-MM-DD format
 * @returns {number} Number of days (inclusive, both start and end count)
 */
function calculateDaysBetween(startDateStr, endDateStr) {
  if (!startDateStr || !endDateStr) return 0;
  
  // Ensure both are strings
  if (typeof startDateStr !== 'string' || typeof endDateStr !== 'string') {
    console.error('calculateDaysBetween: Invalid input types', { startDateStr, endDateStr });
    return 0;
  }

  // Parse date strings to components
  const [startYear, startMonth, startDay] = startDateStr.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDateStr.split('-').map(Number);

  // Create Date objects from components (no timezone conversion)
  const startDate = new Date(startYear, startMonth - 1, startDay);
  const endDate = new Date(endYear, endMonth - 1, endDay);

  // Calculate difference in milliseconds
  const diffInMs = endDate - startDate;
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  // Add 1 for inclusive counting (both start and end dates count)
  return diffInDays + 1;
}

/**
 * Parse YYYY-MM-DD string to Date object components (for calendar arithmetic only)
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {Object|null} Object with {year, month, day} or null if invalid
 */
function parseDateComponents(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;

  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  return {
    year: parseInt(match[1], 10),
    month: parseInt(match[2], 10) - 1, // JavaScript months are 0-indexed
    day: parseInt(match[3], 10)
  };
}

/**
 * Format Date object to YYYY-MM-DD string (using local components, no timezone conversion)
 * @param {Date} date - Date object
 * @returns {string} Date string in YYYY-MM-DD format
 */
function formatDateToString(date) {
  if (!date || !(date instanceof Date)) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculate total days from disbursement date to today (inclusive)
 * @param {string|Date} disbursedDate - The date when loan was disbursed
 * @returns {number} Total number of days (inclusive)
 */
function calculateTotalDays(disbursedDate) {
  if (!disbursedDate) {
    return 0;
  }

  // Parse to YYYY-MM-DD string (no timezone conversion)
  const startDateStr = parseDateToString(disbursedDate);
  if (!startDateStr) {
    return 0;
  }

  // Get today as YYYY-MM-DD string
  const todayStr = getTodayString();

  // Calculate calendar day difference (inclusive)
  return calculateDaysBetween(startDateStr, todayStr);
}

/**
 * Get next valid salary date based on target day
 * @param {string|Date} startDate - Starting date (YYYY-MM-DD string or Date object)
 * @param {number} targetDay - Day of month (1-31)
 * @returns {Date} Next valid salary date (Date object for calendar arithmetic)
 */
function getNextSalaryDate(startDate, targetDay) {
  // Parse start date to components (no timezone conversion)
  let startDateStr;
  if (typeof startDate === 'string') {
    startDateStr = startDate;
  } else if (startDate instanceof Date) {
    startDateStr = formatDateToString(startDate);
  } else {
    startDateStr = getTodayString();
  }

  const startComponents = parseDateComponents(startDateStr);
  if (!startComponents) {
    // Fallback to today if parsing fails
    startDateStr = getTodayString();
    const todayComponents = parseDateComponents(startDateStr);
    if (!todayComponents) {
      // Ultimate fallback - use current date
      const today = new Date();
      startComponents = {
        year: today.getFullYear(),
        month: today.getMonth(),
        day: today.getDate()
      };
    } else {
      startComponents = todayComponents;
    }
  }

  let year = startComponents.year;
  let month = startComponents.month; // Already 0-indexed
  let day = targetDay;

  // Create date for this month's salary date (using local timezone, no conversion)
  let salaryDate = new Date(year, month, day);
  const startDateObj = new Date(startComponents.year, startComponents.month, startComponents.day);

  // If salary date has passed or is today, move to next month
  if (salaryDate <= startDateObj) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
    salaryDate = new Date(year, month, day);
  }

  // Handle edge case: if day doesn't exist in month (e.g., Feb 31), use last day of month
  if (salaryDate.getDate() !== day) {
    const lastDay = new Date(year, month + 1, 0).getDate();
    salaryDate = new Date(year, month, Math.min(day, lastDay));
  }

  return salaryDate;
}

/**
 * Get salary date for a specific month offset from start date
 * @param {string|Date} startDate - Starting date (YYYY-MM-DD string or Date object)
 * @param {number} targetDay - Day of month (1-31)
 * @param {number} monthOffset - Number of months to add (0 = current month, 1 = next month, etc.)
 * @returns {Date} Salary date for the specified month (Date object for calendar arithmetic)
 */
function getSalaryDateForMonth(startDate, targetDay, monthOffset = 0) {
  // Parse start date to components (no timezone conversion)
  let startDateStr;
  if (typeof startDate === 'string') {
    startDateStr = startDate;
  } else if (startDate instanceof Date) {
    startDateStr = formatDateToString(startDate);
  } else {
    startDateStr = getTodayString();
  }

  const startComponents = parseDateComponents(startDateStr);
  if (!startComponents) {
    // Fallback to today if parsing fails
    startDateStr = getTodayString();
    const todayComponents = parseDateComponents(startDateStr);
    if (!todayComponents) {
      // Ultimate fallback - use current date
      const today = new Date();
      startComponents = {
        year: today.getFullYear(),
        month: today.getMonth(),
        day: today.getDate()
      };
    } else {
      startComponents = todayComponents;
    }
  }

  let year = startComponents.year;
  let month = startComponents.month + monthOffset; // Already 0-indexed

  // Handle year rollover
  while (month > 11) {
    month -= 12;
    year += 1;
  }
  while (month < 0) {
    month += 12;
    year -= 1;
  }

  // Try to create date with target day (using local timezone, no conversion)
  let salaryDate = new Date(year, month, targetDay);

  // Handle edge case: if day doesn't exist in month (e.g., Feb 31), use last day of month
  if (salaryDate.getDate() !== targetDay) {
    const lastDay = new Date(year, month + 1, 0).getDate();
    salaryDate = new Date(year, month, Math.min(targetDay, lastDay));
  }

  return salaryDate;
}

/**
 * Calculate days for interest based on plan type and salary date
 * @param {Object} planData - Plan data
 * @param {Object} userData - User data
 * @param {string|Date} calculationDate - Date to calculate from (YYYY-MM-DD string or Date, default: today)
 * @returns {Object} Days calculation result
 */
function calculateInterestDays(planData, userData, calculationDate = null) {
  // Parse calculation date to YYYY-MM-DD string (no timezone conversion)
  let todayStr;
  if (calculationDate) {
    todayStr = parseDateToString(calculationDate);
  }
  if (!todayStr) {
    todayStr = getTodayString();
  }

  // Convert to Date object for calendar arithmetic (using parsed components)
  const todayComponents = parseDateComponents(todayStr);
  if (!todayComponents) {
    todayStr = getTodayString();
    const fallbackComponents = parseDateComponents(todayStr);
    const today = new Date(fallbackComponents.year, fallbackComponents.month, fallbackComponents.day);
    return calculateInterestDays(planData, userData, formatDateToString(today));
  }
  const today = new Date(todayComponents.year, todayComponents.month, todayComponents.day);

  let days = planData.repayment_days || planData.total_duration_days || 15;
  let calculationMethod = 'fixed';
  let repaymentDate = null;

  // If plan uses salary date calculation
  if (planData.calculate_by_salary_date && userData.salary_date) {
    const salaryDate = parseInt(userData.salary_date);

    if (salaryDate >= 1 && salaryDate <= 31) {
      if (planData.plan_type === 'single') {
        // Single payment plan: calculate to next salary date or extend if duration is less
        let nextSalaryDate = getNextSalaryDate(todayStr, salaryDate);

        // Calculate days from today to next salary date (INCLUSIVE)
        // Start day is counted as day 1
        // Example: Dec 14 to Jan 4 = 22 days (Dec 14 is day 1)
        const nextSalaryDateStr = formatDateToString(nextSalaryDate);
        let daysToNextSalary = calculateDaysBetween(todayStr, nextSalaryDateStr);

        // If days to next salary date is less than required duration, extend to following month
        if (daysToNextSalary < days) {
          // Keep adding months until we reach or exceed the required duration
          let targetSalaryDate = nextSalaryDate;
          let daysToTarget = daysToNextSalary;

          while (daysToTarget < days) {
            // Move to next month
            const targetYear = targetSalaryDate.getFullYear();
            const targetMonth = targetSalaryDate.getMonth() + 1;
            const nextMonthStart = new Date(targetYear, targetMonth, 1);
            const nextMonthStartStr = formatDateToString(nextMonthStart);

            targetSalaryDate = getNextSalaryDate(nextMonthStartStr, salaryDate);
            const targetSalaryDateStr = formatDateToString(targetSalaryDate);
            daysToTarget = calculateDaysBetween(todayStr, targetSalaryDateStr);
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
        let nextSalaryDate = getNextSalaryDate(todayStr, salaryDate);

        // Calculate days from today to next salary date (INCLUSIVE)
        const nextSalaryDateStr = formatDateToString(nextSalaryDate);
        let daysToNextSalary = calculateDaysBetween(todayStr, nextSalaryDateStr);

        // If days to next salary date is less than required duration (minimum days), extend to following month
        if (daysToNextSalary < days) {
          // Move to next month's salary date
          nextSalaryDate = getSalaryDateForMonth(todayStr, salaryDate, 1);
          const nextSalaryDateStr2 = formatDateToString(nextSalaryDate);
          daysToNextSalary = calculateDaysBetween(todayStr, nextSalaryDateStr2);
        }

        // For Multi-EMI, the repayment date is the first EMI date
        // Ensure the repayment date matches the salary date exactly
        // If nextSalaryDate doesn't match the target salary day, correct it
        if (nextSalaryDate.getDate() !== salaryDate) {
          // Recalculate to ensure we get the exact salary date in the same month
          const targetYear = nextSalaryDate.getFullYear();
          const targetMonth = nextSalaryDate.getMonth();
          nextSalaryDate = new Date(targetYear, targetMonth, salaryDate);

          // Handle edge case: if day doesn't exist in month (e.g., Feb 31), use last day
          if (nextSalaryDate.getDate() !== salaryDate) {
            const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
            nextSalaryDate = new Date(targetYear, targetMonth, Math.min(salaryDate, lastDay));
          }

          // Recalculate days after correction
          const nextSalaryDateStr3 = formatDateToString(nextSalaryDate);
          daysToNextSalary = calculateDaysBetween(todayStr, nextSalaryDateStr3);
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
 * Uses Decimal for precise financial calculations
 * @param {Object} loanData - Loan data object
 * @param {number} loanData.loan_amount - Principal loan amount
 * @param {number} loanData.processing_fee_percent - Processing fee percentage
 * @param {number} loanData.interest_percent_per_day - Daily interest percentage
 * @param {number} days - Number of days for interest calculation
 * @returns {Object} Calculated values (all as numbers with 2 decimal places)
 */
function calculateLoanValues(loanData, days) {
  // Parse values to Decimal for precision
  const principal = new Decimal(loanData.loan_amount || 0);
  const pfPercent = new Decimal(loanData.processing_fee_percent || 0);
  const interestPercentPerDay = new Decimal(loanData.interest_percent_per_day || 0);

  // Validate inputs
  if (principal.lte(0)) {
    throw new Error('Invalid principal amount');
  }

  if (days < 0) {
    throw new Error('Days cannot be negative');
  }

  // Calculate processing fee (deducted from principal)
  // Processing Fee = Principal × Processing Fee Percent / 100
  const processingFee = principal.mul(pfPercent).div(100);

  // Calculate disbursement amount (what user actually receives)
  // User receives: Principal - Processing Fee
  const disbAmount = principal.minus(processingFee);

  // Calculate interest on principal amount
  // Interest = Principal × Interest Rate (decimal) × Days
  // Note: interest_percent_per_day is already in decimal format (e.g., 0.001 = 0.1% per day)
  const interest = principal.mul(interestPercentPerDay).mul(days);

  // Calculate total amount to be repaid
  // User repays: Principal + Interest (Processing fee already deducted upfront)
  const totalAmount = principal.plus(interest);

  return {
    principal: decimalToNumber(principal),
    processingFee: decimalToNumber(processingFee),
    processingFeePercent: parseFloat(pfPercent.toString()),
    disbAmount: decimalToNumber(disbAmount),
    interest: decimalToNumber(interest),
    interestPercentPerDay: parseFloat(interestPercentPerDay.toString()),
    days: days,
    totalAmount: decimalToNumber(totalAmount),
    totalRepayable: decimalToNumber(totalAmount)
  };
}

/**
 * Get loan calculation by loan ID
 * @param {number|Object} loanIdOrDb - Loan application ID (number) OR legacy db connection (for backward compatibility)
 * @param {number} [loanIdParam] - Loan application ID (only if first param is db)
 * @param {number} [customDays] - Optional: Custom days for calculation (if not provided, uses plan days or actual days)
 * @returns {Promise<Object>} Calculated loan values
 */
async function getLoanCalculation(loanIdOrDb, loanIdParam, customDays = null) {
  // Import executeQuery for database access
  const { executeQuery } = require('../config/database');

  // Handle both new signature (loanId) and legacy signature (db, loanId)
  let loanId;
  let days = customDays;

  if (typeof loanIdOrDb === 'number') {
    // New signature: getLoanCalculation(loanId, customDays)
    loanId = loanIdOrDb;
    days = loanIdParam !== undefined ? loanIdParam : null;
  } else {
    // Legacy signature: getLoanCalculation(db, loanId, customDays)
    loanId = loanIdParam;
  }

  try {
    // Fetch loan data from database using executeQuery
    const loans = await executeQuery(
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
    
    // For account_manager/cleared loans, also calculate interestTillToday and exhaustedDays
    // This matches the logic in the API endpoint /loan-calculations/:loanId
    if (loan.disbursed_at && ['account_manager', 'cleared', 'active'].includes(loan.status)) {
      // Get processed_at or disbursed_at as base date (fetch full loan data)
      const fullLoanQuery = await executeQuery(
        `SELECT 
          DATE(processed_at) as processed_at_date,
          DATE(disbursed_at) as disbursed_at_date,
          processed_at,
          disbursed_at,
          processed_amount,
          loan_amount
        FROM loan_applications 
        WHERE id = ?`,
        [loanId]
      );
      
      if (fullLoanQuery && fullLoanQuery.length > 0) {
        const loanData = fullLoanQuery[0];
        // PRIORITY: Use processed_at_date (from SQL DATE() function - already local date)
        let baseDateStr = normalizeDateToString(loanData.processed_at_date);
        if (!baseDateStr && loanData.processed_at) {
          // Parse processed_at to YYYY-MM-DD string
          baseDateStr = normalizeDateToString(loanData.processed_at);
        }
        
        // FALLBACK: Use disbursed_at_date
        if (!baseDateStr) {
          baseDateStr = normalizeDateToString(loanData.disbursed_at_date);
          if (!baseDateStr && loanData.disbursed_at) {
            baseDateStr = normalizeDateToString(loanData.disbursed_at);
          }
        }
        
        if (baseDateStr) {
          const todayStr = getTodayString();
          // Use inclusive counting (same day = 1 day)
          let exhaustedDays = calculateDaysBetween(baseDateStr, todayStr);
          exhaustedDays = Math.max(0, exhaustedDays);
          
          // Calculate interest till today
          const principal = calculations.principal || parseFloat(loanData.processed_amount || loanData.loan_amount || loan.loan_amount || 0);
          const ratePerDay = calculations.interestPercentPerDay || parseFloat(loan.interest_percent_per_day || 0.001);
          
          // Ensure at least 1 day if same day (exhaustedDays = 0 means same day = 1 day for interest)
          const daysForInterest = exhaustedDays === 0 ? 1 : exhaustedDays;
          
          if (principal > 0 && ratePerDay > 0 && daysForInterest > 0) {
            const interestTillToday = toDecimal2(principal * ratePerDay * daysForInterest);
            
            // Convert interest from number to object structure (matching API endpoint format)
            // calculateLoanValues returns interest as a number, but we need it as an object
            if (typeof calculations.interest === 'number') {
              calculations.interest = {
                amount: calculations.interest,
                rate_per_day: ratePerDay,
                days: calculations.days || days,
                exhaustedDays: exhaustedDays,
                interestTillToday: interestTillToday
              };
            } else if (calculations.interest && typeof calculations.interest === 'object') {
              // Already an object, just add the new fields
              calculations.interest.exhaustedDays = exhaustedDays;
              calculations.interest.interestTillToday = interestTillToday;
              if (!calculations.interest.rate_per_day) {
                calculations.interest.rate_per_day = ratePerDay;
              }
            } else {
              // Create new interest object
              calculations.interest = {
                amount: calculations.interest || 0,
                rate_per_day: ratePerDay,
                days: calculations.days || days,
                exhaustedDays: exhaustedDays,
                interestTillToday: interestTillToday
              };
            }
            
            console.log(`[getLoanCalculation] ✅ Calculated interestTillToday: principal=${principal}, ratePerDay=${ratePerDay}, exhaustedDays=${exhaustedDays}, daysForInterest=${daysForInterest}, interestTillToday=${interestTillToday}`);
          }
        }
      }
    }

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
 * @param {number|Object} loanIdOrDb - Loan application ID (number) OR legacy db connection (for backward compatibility)
 * @param {number|Object} loanIdOrUpdates - Loan application ID (if first param is db) OR updates object
 * @param {Object} [updatesParam] - Fields to update (only if first param is db)
 * @param {number} updatesParam.processing_fee_percent - Processing fee percentage
 * @param {number} updatesParam.interest_percent_per_day - Daily interest percentage
 * @returns {Promise<Object>} Updated calculation
 */
async function updateLoanCalculation(loanIdOrDb, loanIdOrUpdates, updatesParam) {
  // Import executeQuery for database access
  const { executeQuery } = require('../config/database');

  // Handle both new signature (loanId, updates) and legacy signature (db, loanId, updates)
  let loanId;
  let updates;

  if (typeof loanIdOrDb === 'number') {
    // New signature: updateLoanCalculation(loanId, updates)
    loanId = loanIdOrDb;
    updates = loanIdOrUpdates;
  } else {
    // Legacy signature: updateLoanCalculation(db, loanId, updates)
    loanId = loanIdOrUpdates;
    updates = updatesParam;
  }

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

    // Update database using executeQuery
    await executeQuery(
      `UPDATE loan_applications 
       SET ${updateFields.join(', ')} 
       WHERE id = ?`,
      updateValues
    );

    // Recalculate and update derived fields (now using new signature)
    const calculation = await getLoanCalculation(loanId);

    // Update calculated fields
    await executeQuery(
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
  // Validate inputs - use Decimal for precision
  const principal = new Decimal(loanData.loan_amount || 0);
  if (principal.lte(0)) {
    throw new Error('Invalid principal amount');
  }

  const interestPercentPerDay = new Decimal(planData.interest_percent_per_day || 0);
  if (interestPercentPerDay.lt(0)) {
    throw new Error('Invalid interest rate');
  }

  // Parse fees
  const fees = planData.fees || [];
  const deductFromDisbursal = [];
  const addToTotal = [];

  // Use Decimal for all fee calculations
  let totalDisbursalFee = new Decimal(0); // Sum of fee amounts (without GST)
  let totalDisbursalFeeGST = new Decimal(0); // Sum of GST on deduct fees
  let totalRepayableFee = new Decimal(0); // Sum of fee amounts (without GST)
  let totalRepayableFeeGST = new Decimal(0); // Sum of GST on add fees

  // Get EMI count and determine if this is a multi-EMI loan
  const emiCount = parseInt(planData.emi_count) || 1;
  // FIXED: Check plan_type instead of emiCount to correctly identify multi-EMI loans
  const planType = planData.plan_type || 'single';
  const isMultiEmi = planType === 'multi_emi';

  // Calculate each fee with GST using Decimal
  fees.forEach(fee => {
    const feePercent = new Decimal(fee.fee_percent || 0);
    // Fee Amount = Principal × Fee Percent / 100
    const feeAmount = principal.mul(feePercent).div(100);
    // GST Amount = Fee Amount × GST Rate
    const gstAmount = feeAmount.mul(GST_RATE);
    // Total with GST = Fee Amount + GST Amount
    const totalWithGST = feeAmount.plus(gstAmount);

    const feeDetail = {
      fee_name: fee.fee_name || 'Unknown Fee',
      fee_percent: parseFloat(feePercent.toString()),
      fee_amount: decimalToNumber(feeAmount),
      gst_amount: decimalToNumber(gstAmount),
      total_with_gst: decimalToNumber(totalWithGST)
    };

    if (fee.application_method === 'deduct_from_disbursal') {
      deductFromDisbursal.push(feeDetail);
      totalDisbursalFee = totalDisbursalFee.plus(feeAmount);
      totalDisbursalFeeGST = totalDisbursalFeeGST.plus(gstAmount);
    } else if (fee.application_method === 'add_to_total') {
      // Only multiply fees for actual multi-EMI loans (plan_type === 'multi_emi')
      const multiplier = isMultiEmi ? emiCount : 1;
      const multipliedFeeAmount = feeAmount.mul(multiplier);
      const multipliedGstAmount = gstAmount.mul(multiplier);
      const multipliedTotalWithGST = totalWithGST.mul(multiplier);

      addToTotal.push({
        ...feeDetail,
        fee_amount: decimalToNumber(multipliedFeeAmount),
        gst_amount: decimalToNumber(multipliedGstAmount),
        total_with_gst: decimalToNumber(multipliedTotalWithGST),
        base_fee_amount: decimalToNumber(feeAmount),
        emi_count: emiCount
      });
      totalRepayableFee = totalRepayableFee.plus(multipliedFeeAmount);
      totalRepayableFeeGST = totalRepayableFeeGST.plus(multipliedGstAmount);
    }
  });

  // Calculate totals using Decimal
  const totalDisbursalDeduction = totalDisbursalFee.plus(totalDisbursalFeeGST);
  const totalRepayableAddition = totalRepayableFee.plus(totalRepayableFeeGST);

  // Calculate disbursal amount
  const disbursalAmount = principal.minus(totalDisbursalDeduction);

  // Calculate interest days
  let daysResult;
  if (options.customDays !== undefined && options.customDays !== null) {
    daysResult = {
      days: options.customDays,
      calculationMethod: 'custom',
      repaymentDate: null
    };
  } else {
    // Parse calculation date to string (no timezone conversion)
    const calcDateStr = options.calculationDate ? parseDateToString(options.calculationDate) : null;
    daysResult = calculateInterestDays(planData, userData, calcDateStr || getTodayString());
  }

  const { days, calculationMethod, repaymentDate } = daysResult;

  // Calculate interest on principal using Decimal
  // Interest = Principal × Interest Rate Per Day × Days
  const interest = principal.mul(interestPercentPerDay).mul(days);

  // Calculate total repayable using Decimal
  const totalRepayable = principal.plus(interest).plus(totalRepayableAddition);

  // Build calculation explanation strings
  const principalNum = decimalToNumber(principal);
  const disbursalDeductionNum = decimalToNumber(totalDisbursalDeduction);
  const disbursalAmountNum = decimalToNumber(disbursalAmount);
  const interestNum = decimalToNumber(interest);
  const repayableAdditionNum = decimalToNumber(totalRepayableAddition);
  const totalRepayableNum = decimalToNumber(totalRepayable);

  const disbursalCalculation = `Principal (₹${principalNum.toFixed(2)}) - Deduct Fees (₹${disbursalDeductionNum.toFixed(2)}) = ₹${disbursalAmountNum.toFixed(2)}`;
  const totalBreakdown = `Principal (₹${principalNum.toFixed(2)}) + Interest (₹${interestNum.toFixed(2)}) + Repayable Fees (₹${repayableAdditionNum.toFixed(2)}) = ₹${totalRepayableNum.toFixed(2)}`;

  // Format calculation date (no timezone conversion)
  const calculationDateStr = options.calculationDate ? parseDateToString(options.calculationDate) : getTodayString();

  // Format repayment date (no timezone conversion)
  const repaymentDateStr = repaymentDate ? formatDateToString(repaymentDate) : null;

  return {
    principal: principalNum,
    fees: {
      deductFromDisbursal: deductFromDisbursal,
      addToTotal: addToTotal
    },
    totals: {
      disbursalFee: decimalToNumber(totalDisbursalFee),
      disbursalFeeGST: decimalToNumber(totalDisbursalFeeGST),
      repayableFee: decimalToNumber(totalRepayableFee),
      repayableFeeGST: decimalToNumber(totalRepayableFeeGST),
      totalDisbursalDeduction: disbursalDeductionNum,
      totalRepayableAddition: repayableAdditionNum
    },
    disbursal: {
      amount: disbursalAmountNum,
      calculation: disbursalCalculation
    },
    interest: {
      amount: interestNum,
      days: days,
      rate_per_day: parseFloat(interestPercentPerDay.toString()),
      calculation_method: calculationMethod,
      calculation_date: calculationDateStr,
      repayment_date: repaymentDateStr
    },
    total: {
      repayable: totalRepayableNum,
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
  calculateInterestDays,
  // Helper functions for string-based date handling
  parseDateToString,
  getTodayString,
  calculateDaysBetween,
  parseDateComponents,
  formatDateToString,
  // Monetary formatting
  toDecimal2,
  // Decimal utilities
  decimalToNumber,
  decimalToString,
  // Financial constants (exported as numbers for compatibility)
  GST_RATE: parseFloat(GST_RATE.toString()),
  EXTENSION_FEE_RATE: parseFloat(EXTENSION_FEE_RATE.toString())
};

