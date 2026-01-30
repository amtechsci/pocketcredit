const express = require('express');
const router = express.Router();
const { authenticateAdmin } = require('../middleware/auth');
const { requireAuth } = require('../middleware/jwtAuth');
const { initializeDatabase } = require('../config/database');
const {
  calculateTotalDays,
  calculateLoanValues,
  calculateCompleteLoanValues,
  getLoanCalculation,
  updateLoanCalculation,
  getNextSalaryDate,
  getSalaryDateForMonth,
  calculateDaysBetween,
  formatDateToString,
  getTodayString,
  parseDateToString,
  toDecimal2
} = require('../utils/loanCalculations');
const { executeQuery } = require('../config/database');

/**
 * Middleware to allow both admin and user access
 * Users can only access their own loans, admins can access any loan
 */
const authenticateLoanAccess = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'pocket-credit-secret-key-2025';
    
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    await initializeDatabase();

    // Check if admin
    const admins = await executeQuery(
      'SELECT id, is_active FROM admins WHERE id = ?',
      [decoded.id]
    );

    if (admins.length > 0 && admins[0].is_active) {
      // Admin access - allow access to any loan
      req.admin = { id: admins[0].id };
      return next();
    }

    // Check if user
    const users = await executeQuery(
      'SELECT id, status FROM users WHERE id = ?',
      [decoded.id]
    );

    if (users.length > 0 && (users[0].status === 'active' || users[0].status === 'on_hold')) {
      // User access - verify loan belongs to user
      const loanId = parseInt(req.params.loanId);
      if (isNaN(loanId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid loan ID'
        });
      }

      const loans = await executeQuery(
        'SELECT user_id FROM loan_applications WHERE id = ?',
        [loanId]
      );

      if (!loans || loans.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Loan not found'
        });
      }

      if (loans[0].user_id !== users[0].id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only access your own loans.'
        });
      }

      req.user = users[0];
      req.userId = users[0].id;
      return next();
    }

    // Neither admin nor valid user
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

/**
 * GET /api/loan-calculations/:loanId
 * Get complete calculated values for a loan using centralized function
 * Accessible to both admin and users (users can only access their own loans)
 * Query params:
 *   - customDays: Optional custom days for calculation
 *   - calculationDate: Optional date to calculate from (YYYY-MM-DD format)
 */
router.get('/:loanId', authenticateLoanAccess, async (req, res) => {
  try {
    await initializeDatabase();
    const loanId = parseInt(req.params.loanId);
    const customDays = req.query.customDays ? parseInt(req.query.customDays) : null;
    // Keep calculationDate as string - don't convert to Date object (avoids timezone conversion)
    const calculationDate = req.query.calculationDate || null;
    
    if (isNaN(loanId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid loan ID'
      });
    }
    
    // Fetch loan data
    // Use DATE() function to extract date portion directly from MySQL (avoids timezone conversion)
    const loans = await executeQuery(
      `SELECT 
        id, loan_amount, status, 
        DATE(disbursed_at) as disbursed_at_date, disbursed_at,
        DATE(processed_at) as processed_at_date, processed_at,
        DATE(last_extension_date) as last_extension_date_date, last_extension_date,
        extension_count,
        processed_due_date, plan_snapshot, emi_schedule,
        interest_percent_per_day, fees_breakdown, user_id, loan_plan_id,
        late_fee_structure
      FROM loan_applications 
      WHERE id = ?`,
      [loanId]
    );
    
    if (!loans || loans.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Loan with ID ${loanId} not found`
      });
    }
    const loan = loans[0];
    
    // Parse plan snapshot
    let planSnapshot = null;
    if (loan.plan_snapshot) {
      try {
        planSnapshot = typeof loan.plan_snapshot === 'string' 
          ? JSON.parse(loan.plan_snapshot) 
          : loan.plan_snapshot;
      } catch (e) {
        console.error('Error parsing plan_snapshot:', e);
      }
    }
    
    // Parse fees_breakdown
    let feesBreakdown = [];
    if (loan.fees_breakdown) {
      try {
        feesBreakdown = typeof loan.fees_breakdown === 'string' 
          ? JSON.parse(loan.fees_breakdown) 
          : loan.fees_breakdown;
      } catch (e) {
        console.error('Error parsing fees_breakdown:', e);
      }
    }
    
    // If no plan snapshot, create one from fees_breakdown or use defaults
    if (!planSnapshot) {
      planSnapshot = {
        plan_type: 'single',
        repayment_days: 15,
        interest_percent_per_day: parseFloat(loan.interest_percent_per_day || 0.001),
        calculate_by_salary_date: false,
        fees: feesBreakdown.map(fee => ({
          fee_name: fee.fee_name || 'Fee',
          fee_percent: fee.fee_percent || 0,
          application_method: fee.application_method || 'deduct_from_disbursal'
        }))
      };
    } else {
      // Plan snapshot exists, but check if fees are missing, empty, or missing application_method
      if (!planSnapshot.fees || !Array.isArray(planSnapshot.fees) || planSnapshot.fees.length === 0) {
        // Fees are missing or empty - try to populate from fees_breakdown or loan_plan_fees
        if (feesBreakdown && feesBreakdown.length > 0) {
          // Use fees from fees_breakdown
          planSnapshot.fees = feesBreakdown.map(fee => ({
            fee_name: fee.fee_name || fee.name || 'Fee',
            fee_percent: fee.fee_percent || fee.percent || 0,
            application_method: fee.application_method || 'deduct_from_disbursal'
          }));
        } else if (loan.loan_plan_id) {
          // Try to fetch fees from loan_plan_fees table
          try {
            const planFees = await executeQuery(
              `SELECT 
                lpf.fee_percent,
                ft.fee_name,
                ft.application_method
              FROM loan_plan_fees lpf
              INNER JOIN fee_types ft ON lpf.fee_type_id = ft.id
              WHERE lpf.loan_plan_id = ? AND ft.is_active = 1
              ORDER BY ft.fee_name ASC`,
              [loan.loan_plan_id]
            );
            
            if (planFees && planFees.length > 0) {
              planSnapshot.fees = planFees.map(pf => ({
                fee_name: pf.fee_name || 'Fee',
                fee_percent: parseFloat(pf.fee_percent || 0),
                application_method: pf.application_method || 'deduct_from_disbursal'
              }));
              console.log(`✅ Fetched ${planSnapshot.fees.length} fee(s) from loan_plan_fees for loan #${loanId}`);
            } else {
              planSnapshot.fees = [];
            }
          } catch (feeError) {
            console.error(`Error fetching fees from loan_plan_fees for loan #${loanId}:`, feeError);
            planSnapshot.fees = [];
          }
        } else {
          // Ensure fees is at least an empty array
          planSnapshot.fees = planSnapshot.fees || [];
        }
      } else {
        // Fees exist but may be missing application_method - fix them
        const feesNeedFixing = planSnapshot.fees.some(fee => !fee.application_method);
        if (feesNeedFixing) {
          console.log(`⚠️ Loan #${loanId} fees exist but missing application_method. Attempting to fix...`);
          
          // Try to get application_method from fees_breakdown by matching fee_name
          if (feesBreakdown && feesBreakdown.length > 0) {
            planSnapshot.fees = planSnapshot.fees.map(fee => {
              const matchingFee = feesBreakdown.find(bf => 
                (bf.fee_name === fee.fee_name || bf.name === fee.fee_name)
              );
              return {
                ...fee,
                application_method: fee.application_method || matchingFee?.application_method || 'deduct_from_disbursal'
              };
            });
            console.log(`✅ Fixed application_method for fees from fees_breakdown`);
          } else if (loan.loan_plan_id) {
            // Try to fetch from loan_plan_fees table
            try {
              const planFees = await executeQuery(
                `SELECT 
                  lpf.fee_percent,
                  ft.fee_name,
                  ft.application_method
                FROM loan_plan_fees lpf
                INNER JOIN fee_types ft ON lpf.fee_type_id = ft.id
                WHERE lpf.loan_plan_id = ? AND ft.is_active = 1
                ORDER BY ft.fee_name ASC`,
                [loan.loan_plan_id]
              );
              
              if (planFees && planFees.length > 0) {
                planSnapshot.fees = planSnapshot.fees.map(fee => {
                  const matchingFee = planFees.find(pf => pf.fee_name === fee.fee_name);
                  return {
                    ...fee,
                    application_method: fee.application_method || matchingFee?.application_method || 'deduct_from_disbursal'
                  };
                });
                console.log(`✅ Fixed application_method for fees from loan_plan_fees`);
              }
            } catch (feeError) {
              console.error(`Error fetching fees from loan_plan_fees for loan #${loanId}:`, feeError);
            }
          }
          
          // Validate and correct application_method based on fee name (even if already set)
          // This ensures "post service fee" is always "add_to_total" regardless of what's in fees_breakdown
          planSnapshot.fees = planSnapshot.fees.map(fee => {
            const feeNameLower = fee.fee_name?.toLowerCase() || '';
            let correctMethod = fee.application_method;
            
            // Validate: "post service fee" should always be "add_to_total"
            if (feeNameLower.includes('post service')) {
              if (fee.application_method !== 'add_to_total') {
                console.log(`⚠️ Correcting application_method for "${fee.fee_name}": ${fee.application_method} → add_to_total`);
                correctMethod = 'add_to_total';
              }
            } else {
              // Other fees (like "processing fee") should be "deduct_from_disbursal"
              if (!fee.application_method || fee.application_method !== 'deduct_from_disbursal') {
                console.log(`⚠️ Correcting application_method for "${fee.fee_name}": ${fee.application_method || 'missing'} → deduct_from_disbursal`);
                correctMethod = 'deduct_from_disbursal';
              }
            }
            
            return {
              ...fee,
              application_method: correctMethod
            };
          });
        } else {
          // Fees exist and have application_method, but validate them anyway
          planSnapshot.fees = planSnapshot.fees.map(fee => {
            const feeNameLower = fee.fee_name?.toLowerCase() || '';
            
            // Validate: "post service fee" should always be "add_to_total"
            if (feeNameLower.includes('post service')) {
              if (fee.application_method !== 'add_to_total') {
                console.log(`⚠️ Correcting application_method for "${fee.fee_name}": ${fee.application_method} → add_to_total`);
                return {
                  ...fee,
                  application_method: 'add_to_total'
                };
              }
            }
            
            return fee;
          });
        }
      }
    }
    
    // Fetch user data
    const users = await executeQuery(
      `SELECT id, salary_date FROM users WHERE id = (SELECT user_id FROM loan_applications WHERE id = ?)`,
      [loanId]
    );
    
    const userData = users && users.length > 0 ? {
      user_id: users[0].id,
      salary_date: users[0].salary_date
    } : { user_id: null, salary_date: null };
    
    // Prepare data for calculation
    const loanData = {
      loan_amount: parseFloat(loan.loan_amount || 0),
      loan_id: loan.id,
      status: loan.status,
      disbursed_at: loan.disbursed_at
    };
    
    const planData = {
      plan_id: planSnapshot.plan_id || null,
      plan_type: planSnapshot.plan_type || 'single',
      repayment_days: planSnapshot.repayment_days || null,
      total_duration_days: planSnapshot.total_duration_days || planSnapshot.repayment_days || null,
      interest_percent_per_day: parseFloat(planSnapshot.interest_percent_per_day || loan.interest_percent_per_day || 0.001),
      calculate_by_salary_date: planSnapshot.calculate_by_salary_date === 1 || planSnapshot.calculate_by_salary_date === true,
      emi_count: planSnapshot.emi_count || null,
      emi_frequency: planSnapshot.emi_frequency || null,
      fees: planSnapshot.fees || []
    };
    
    // Debug logging for fees
    if (!planData.fees || planData.fees.length === 0) {
      console.warn(`⚠️ Loan #${loanId} has no fees in planData. planSnapshot.fees:`, planSnapshot.fees, 'feesBreakdown:', feesBreakdown);
    }
    
    // For processed loans, use processed_at as calculation date (not current date)
    // This ensures interest calculation starts from the actual processing date
    // Always convert to YYYY-MM-DD string format to avoid timezone issues and ensure consistent format
    let finalCalculationDate = null;
    
    // Helper function to parse date to YYYY-MM-DD string (no timezone conversion)
    const parseDateToStr = (dateValue) => {
      if (!dateValue) return null;
      if (typeof dateValue === 'string') {
        if (dateValue.includes('T')) return dateValue.split('T')[0];
        if (dateValue.includes(' ')) return dateValue.split(' ')[0];
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return dateValue;
      }
      if (dateValue instanceof Date) {
        // Use UTC getters to avoid local timezone issues when converting Date object to string
        const year = dateValue.getUTCFullYear();
        const month = String(dateValue.getUTCMonth() + 1).padStart(2, '0');
        const day = String(dateValue.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      return null;
    };
    
    // Convert query parameter calculationDate to YYYY-MM-DD string if provided
    if (calculationDate) {
      finalCalculationDate = parseDateToStr(calculationDate);
    }
    
    // For processed loans, use processed_at if no calculationDate was provided
    // Prefer processed_at_date (from SQL DATE() function) to avoid timezone issues
    if (!finalCalculationDate && loan.processed_at && ['account_manager', 'cleared'].includes(loan.status)) {
      // Use processed_at_date if available (from SQL DATE() function - no timezone conversion)
      if (loan.processed_at_date) {
        finalCalculationDate = loan.processed_at_date;
      } else {
        finalCalculationDate = parseDateToStr(loan.processed_at);
      }
      if (!finalCalculationDate) {
        console.error('Invalid date format from processed_at. Expected YYYY-MM-DD, got:', loan.processed_at);
      }
    }
    
    const options = {
      customDays: customDays,
      calculationDate: finalCalculationDate // Pass string, not Date object
    };
    
    // Calculate using centralized function
    const calculation = calculateCompleteLoanValues(loanData, planData, userData, options);
    
    // For multi-EMI loans, recalculate interest by summing from each EMI period
    if (planData.emi_count && planData.emi_count > 1) {
      const principal = calculation.principal;
      const emiCount = planData.emi_count;
      const interestRatePerDay = calculation.interest.rate_per_day;
      
      // For loans in account_manager status, ALWAYS trust stored data (emi_schedule and processed_due_date)
      // DO NOT recalculate - use what's in the database as source of truth
      const isAccountManager = loan.processed_at && ['account_manager', 'cleared'].includes(loan.status);
      let allEmiDates = [];
      let baseDate;
      
      // Helper function to parse date to YYYY-MM-DD string (no timezone conversion)
      const parseDateToStr = (dateValue) => {
        if (!dateValue) return null;
        if (typeof dateValue === 'string') {
          if (dateValue.includes('T')) return dateValue.split('T')[0];
          if (dateValue.includes(' ')) return dateValue.split(' ')[0];
          if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return dateValue;
        }
        if (dateValue instanceof Date) {
          // Use UTC getters to avoid local timezone issues when converting Date object to string
          const year = dateValue.getUTCFullYear();
          const month = String(dateValue.getUTCMonth() + 1).padStart(2, '0');
          const day = String(dateValue.getUTCDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
        return null;
      };
      
      if (isAccountManager) {
        // CRITICAL: For account_manager loans, ALWAYS trust stored data - don't recalculate
        // PRIORITY 1: Use emi_schedule (source of truth - updated on processing and extension)
        if (loan.emi_schedule) {
          try {
            const emiScheduleArray = typeof loan.emi_schedule === 'string' 
              ? JSON.parse(loan.emi_schedule) 
              : loan.emi_schedule;
            
            if (Array.isArray(emiScheduleArray) && emiScheduleArray.length > 0) {
              allEmiDates = emiScheduleArray
                .map(emi => {
                  const dateStr = emi.due_date || emi.dueDate || null;
                  if (!dateStr) return null;
                  const parsed = parseDateToStr(dateStr);
                  return parsed ? new Date(parsed) : null;
                })
                .filter(date => date !== null);
              
              if (allEmiDates.length > 0) {
                // Using emi_schedule dates
              }
            }
          } catch (e) {
            console.error('❌ [Loan Calculations] Error parsing emi_schedule for account_manager loan:', e);
          }
        }
        
        // PRIORITY 2: Fallback to processed_due_date if emi_schedule didn't work
        if (allEmiDates.length !== emiCount && loan.processed_due_date) {
          try {
            const parsedDueDate = typeof loan.processed_due_date === 'string' 
              ? JSON.parse(loan.processed_due_date) 
              : loan.processed_due_date;
            
            if (Array.isArray(parsedDueDate) && parsedDueDate.length > 0) {
              allEmiDates = parsedDueDate.map(date => {
                const dateStr = typeof date === 'string' ? date.split('T')[0].split(' ')[0] : parseDateToStr(date);
                return dateStr ? new Date(dateStr) : null;
              }).filter(date => date !== null);
              console.log(`✅ [Loan Calculations] Using processed_due_date for EMI dates: ${allEmiDates.length} dates`);
            } else if (typeof parsedDueDate === 'string') {
              const dateStr = parsedDueDate.split('T')[0].split(' ')[0];
              if (dateStr) {
                allEmiDates = [new Date(dateStr)];
                console.log(`✅ [Loan Calculations] Using processed_due_date for single payment: ${dateStr}`);
              }
            }
          } catch (e) {
            console.error('❌ [Loan Calculations] Error parsing processed_due_date:', e, loan.processed_due_date);
          }
        }
        
        if (allEmiDates.length === 0) {
          console.warn(`⚠️ [Loan Calculations] No stored dates found for account_manager loan - this should not happen!`);
        }
      } else {
        // For non-account_manager loans, use stored data if available, otherwise recalculate
        // PRIORITY 1: Check processed_due_date first (for processed loans with extensions)
        if (loan.processed_due_date) {
          try {
            const parsedDueDate = typeof loan.processed_due_date === 'string' 
              ? JSON.parse(loan.processed_due_date) 
              : loan.processed_due_date;
            
            if (Array.isArray(parsedDueDate) && parsedDueDate.length > 0) {
              allEmiDates = parsedDueDate.map(date => {
                const dateStr = typeof date === 'string' ? date.split('T')[0].split(' ')[0] : parseDateToStr(date);
                return dateStr ? new Date(dateStr) : null;
              }).filter(date => date !== null);
              console.log(`✅ [Loan Calculations] Using processed_due_date for EMI dates: ${allEmiDates.length} dates`);
            } else if (typeof parsedDueDate === 'string') {
              const dateStr = parsedDueDate.split('T')[0].split(' ')[0];
              if (dateStr) {
                allEmiDates = [new Date(dateStr)];
                console.log(`✅ [Loan Calculations] Using processed_due_date for single payment: ${dateStr}`);
              }
            }
          } catch (e) {
            console.error('❌ [Loan Calculations] Error parsing processed_due_date:', e, loan.processed_due_date);
          }
        }
        
        // PRIORITY 2: Check emi_schedule if processed_due_date didn't work
        if (allEmiDates.length !== emiCount && loan.emi_schedule) {
          try {
            const emiScheduleArray = typeof loan.emi_schedule === 'string' 
              ? JSON.parse(loan.emi_schedule) 
              : loan.emi_schedule;
            
            if (Array.isArray(emiScheduleArray) && emiScheduleArray.length > 0) {
              allEmiDates = emiScheduleArray
                .map(emi => {
                  const dateStr = emi.due_date || emi.dueDate || null;
                  if (!dateStr) return null;
                  const parsed = parseDateToStr(dateStr);
                  return parsed ? new Date(parsed) : null;
                })
                .filter(date => date !== null);
              
              if (allEmiDates.length === emiCount) {
                // Using emi_schedule due_date
              } else {
                allEmiDates = []; // Reset if count doesn't match
                console.warn(`⚠️ [Loan Calculations] emi_schedule has ${emiScheduleArray.length} entries but expected ${emiCount}, will recalculate`);
              }
            }
          } catch (e) {
            console.error('❌ [Loan Calculations] Error parsing emi_schedule:', e);
          }
        }
      }
      
      // Determine baseDateStr for interest calculation (needed even when using stored dates)
      // For processed loans (account_manager status), use processed_at as base date for interest calculation
      // Otherwise use disbursed_at or current date
      const isProcessed = loan.processed_at && ['account_manager', 'cleared'].includes(loan.status);
      const dateSource = isProcessed 
        ? (loan.processed_at_date || loan.processed_at)
        : (loan.disbursed_at_date || loan.disbursed_at || null);
      
      let baseDateStr = null;
      if (dateSource) {
        baseDateStr = parseDateToStr(dateSource);
      }
      if (!baseDateStr) {
        const today = new Date();
        baseDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      }
      
      // PRIORITY 3: Recalculate from processed_at/disbursed_at (ONLY for non-account_manager loans or if stored dates missing)
      if (!isAccountManager && allEmiDates.length !== emiCount) {
        
        // Convert to Date object for calendar arithmetic (using parsed components)
        const [baseYear, baseMonth, baseDay] = baseDateStr.split('-').map(Number);
        baseDate = new Date(baseYear, baseMonth - 1, baseDay);
        
        if (planData.emi_frequency === 'monthly' && planData.calculate_by_salary_date && userData.salary_date) {
          const salaryDate = parseInt(userData.salary_date);
          if (salaryDate >= 1 && salaryDate <= 31) {
            let nextSalaryDate = getNextSalaryDate(baseDateStr, salaryDate);
            const minDuration = planData.repayment_days || 15;
            const nextSalaryDateStr = formatDateToString(nextSalaryDate);
            let daysToNextSalary = calculateDaysBetween(baseDateStr, nextSalaryDateStr);
            if (daysToNextSalary < minDuration) {
              nextSalaryDate = getSalaryDateForMonth(nextSalaryDateStr, salaryDate, 1);
            }
            const firstEmiDateStr = formatDateToString(nextSalaryDate);
            for (let i = 0; i < emiCount; i++) {
              const emiDate = getSalaryDateForMonth(firstEmiDateStr, salaryDate, i);
              allEmiDates.push(emiDate);
            }
          }
        } else {
          // Non-salary-date EMI calculation
          // Calculate first due date
          let firstDueDate = new Date(baseDate);
          firstDueDate.setDate(firstDueDate.getDate() + (planData.repayment_days || 15));
          firstDueDate.setHours(0, 0, 0, 0);
          
          const daysPerEmi = {
            daily: 1,
            weekly: 7,
            biweekly: 14,
            monthly: 30
          };
          const daysBetween = daysPerEmi[planData.emi_frequency] || 30;
          
          for (let i = 0; i < emiCount; i++) {
            const emiDate = new Date(firstDueDate);
            if (planData.emi_frequency === 'monthly') {
              emiDate.setMonth(emiDate.getMonth() + i);
            } else {
              emiDate.setDate(emiDate.getDate() + (i * daysBetween));
            }
            emiDate.setHours(0, 0, 0, 0);
            allEmiDates.push(emiDate);
          }
        }
      } else if (isAccountManager && allEmiDates.length === emiCount) {
        // Using stored dates for account_manager loan - ensure baseDateStr is set for interest calculation
      } else if (isAccountManager && allEmiDates.length !== emiCount) {
        // Account_manager loan but stored dates missing - this is an error condition
        console.error(`❌ [Loan Calculations] CRITICAL: Account_manager loan missing stored dates! Expected ${emiCount} EMIs but found ${allEmiDates.length} dates.`);
        console.error(`❌ [Loan Calculations] emi_schedule: ${loan.emi_schedule ? 'exists' : 'missing'}, processed_due_date: ${loan.processed_due_date ? 'exists' : 'missing'}`);
        // Still need to have dates for calculation, so fallback to recalculation (but log as error)
        console.warn(`⚠️ [Loan Calculations] Falling back to recalculation for account_manager loan (data integrity issue)`);
        
        // Convert to Date object for calendar arithmetic (using parsed components)
        const [baseYear, baseMonth, baseDay] = baseDateStr.split('-').map(Number);
        baseDate = new Date(baseYear, baseMonth - 1, baseDay);
        
        // Recalculate as fallback (but this should not happen in normal operation)
        if (planData.emi_frequency === 'monthly' && planData.calculate_by_salary_date && userData.salary_date) {
          const salaryDate = parseInt(userData.salary_date);
          if (salaryDate >= 1 && salaryDate <= 31) {
            let nextSalaryDate = getNextSalaryDate(baseDateStr, salaryDate);
            const minDuration = planData.repayment_days || 15;
            const nextSalaryDateStr = formatDateToString(nextSalaryDate);
            let daysToNextSalary = calculateDaysBetween(baseDateStr, nextSalaryDateStr);
            if (daysToNextSalary < minDuration) {
              nextSalaryDate = getSalaryDateForMonth(nextSalaryDateStr, salaryDate, 1);
            }
            const firstEmiDateStr = formatDateToString(nextSalaryDate);
            for (let i = 0; i < emiCount; i++) {
              const emiDate = getSalaryDateForMonth(firstEmiDateStr, salaryDate, i);
              allEmiDates.push(emiDate);
            }
          }
        } else {
          let firstDueDate = new Date(baseDate);
          firstDueDate.setDate(firstDueDate.getDate() + (planData.repayment_days || 15));
          firstDueDate.setHours(0, 0, 0, 0);
          
          const daysPerEmi = { daily: 1, weekly: 7, biweekly: 14, monthly: 30 };
          const daysBetween = daysPerEmi[planData.emi_frequency] || 30;
          
          for (let i = 0; i < emiCount; i++) {
            const emiDate = new Date(firstDueDate);
            if (planData.emi_frequency === 'monthly') {
              emiDate.setMonth(emiDate.getMonth() + i);
            } else {
              emiDate.setDate(emiDate.getDate() + (i * daysBetween));
            }
            emiDate.setHours(0, 0, 0, 0);
            allEmiDates.push(emiDate);
          }
        }
      }
      
      // Calculate interest for each EMI period on reducing balance
      // For account_manager loans, use emi_amount from emi_schedule (source of truth)
      if (allEmiDates.length === emiCount) {
        let schedule = [];
        
        // Always recalculate EMI amounts to ensure correct post service fee + GST inclusion
        // For account_manager loans, we'll preserve stored status and dates but recalculate amounts
        const principalPerEmi = toDecimal2(Math.floor(principal / emiCount * 100) / 100);
        const remainder = toDecimal2(principal - (principalPerEmi * emiCount));
        
        // IMPORTANT: totals.repayableFee is ALREADY multiplied by emiCount in calculateCompleteLoanValues
        // So we need to divide by emiCount to get the per-EMI fee
        // CRITICAL: Only use repayableFeeGST for EMI calculations, NOT disbursalFeeGST (which is deducted upfront)
        const totalRepayableFee = calculation.totals.repayableFee || 0;
        const totalRepayableFeeGST = calculation.totals.repayableFeeGST || 0;
        const postServiceFeePerEmi = toDecimal2(totalRepayableFee / emiCount);
        const postServiceFeeGSTPerEmi = toDecimal2(totalRepayableFeeGST / emiCount);
        
        // Get stored EMI schedule to preserve status and dates if available
        let storedEmiSchedule = null;
        if (loan.emi_schedule) {
          try {
            storedEmiSchedule = typeof loan.emi_schedule === 'string' 
              ? JSON.parse(loan.emi_schedule) 
              : loan.emi_schedule;
          } catch (e) {
            console.warn('⚠️ [Loan Calculations] Could not parse stored emi_schedule, will recalculate:', e);
          }
        }
        
        // Parse late_fee_structure for penalty calculation
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
          } else if (loan.loan_plan_id) {
            // Fallback: Fetch from late_penalty_tiers table if not in loan_applications
            try {
              const penaltyTiers = await executeQuery(
                `SELECT days_overdue_start, days_overdue_end, penalty_percent, tier_order 
                 FROM late_penalty_tiers 
                 WHERE loan_plan_id = ? 
                 ORDER BY tier_order ASC, days_overdue_start ASC`,
                [loan.loan_plan_id]
              );
              
              if (penaltyTiers && penaltyTiers.length > 0) {
                lateFeeStructure = penaltyTiers.map((tier) => {
                  const penaltyPercent = parseFloat(tier.penalty_percent);
                  const gstPercent = 18;
                  const totalPercent = penaltyPercent + (penaltyPercent * gstPercent / 100);
                  
                  return {
                    tier_name: `Day ${tier.days_overdue_start}${tier.days_overdue_end ? `-${tier.days_overdue_end}` : '+'}`,
                    days_overdue_start: tier.days_overdue_start,
                    days_overdue_end: tier.days_overdue_end,
                    fee_type: 'percentage',
                    fee_value: tier.penalty_percent.toString(),
                    gst_percent: gstPercent,
                    total_percent_with_gst: totalPercent,
                    tier_order: tier.tier_order
                  };
                });
                // Fetched late_fee_structure from late_penalty_tiers
              }
            } catch (fetchError) {
              console.error('⚠️ [Loan Calculations] Error fetching late_fee_structure from late_penalty_tiers:', fetchError);
            }
          }
          
          if (!lateFeeStructure || !Array.isArray(lateFeeStructure) || lateFeeStructure.length === 0) {
            console.warn(`⚠️ [Loan Calculations] No late_fee_structure found for loan #${loanId} (loan_plan_id: ${loan.loan_plan_id})`);
          }
        } catch (e) {
          console.error('⚠️ [Loan Calculations] Error parsing late_fee_structure:', e);
        }
        
        // Function to calculate penalty for an EMI based on days overdue
        const calculateEmiPenalty = (emiPrincipal, daysOverdue, lateFeeStructure) => {
          if (daysOverdue <= 0 || !lateFeeStructure || !Array.isArray(lateFeeStructure) || lateFeeStructure.length === 0) {
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
              : null;
            
            if (daysOverdue < startDay) continue;
            
            const feeValue = parseFloat(tier.fee_value || tier.penalty_percent || 0);
            if (feeValue <= 0) continue;
            
            let tierPenalty = 0;
            
            if (startDay === endDay || (startDay === 1 && endDay === 1)) {
              // Single day tier (e.g., "Day 1-1"): apply as one-time percentage
              if (daysOverdue >= startDay) {
                tierPenalty = emiPrincipal * (feeValue / 100);
              }
            } else if (endDay === null || endDay === undefined) {
              // Unlimited tier (e.g., "Day 121+"): apply for all days from startDay onwards
              if (daysOverdue >= startDay) {
                const daysInTier = daysOverdue - startDay + 1;
                tierPenalty = emiPrincipal * (feeValue / 100) * daysInTier;
              }
            } else {
              // Multi-day tier (e.g., "Day 2-10", "Day 11-120"): calculate for applicable days
              if (daysOverdue >= startDay) {
                const tierStartDay = startDay;
                const tierEndDay = Math.min(endDay, daysOverdue);
                const daysInTier = Math.max(0, tierEndDay - tierStartDay + 1);
                
                if (daysInTier > 0) {
                  tierPenalty = emiPrincipal * (feeValue / 100) * daysInTier;
                }
              }
            }
            
            penaltyBase += tierPenalty;
          }
          
          const penaltyBaseRounded = toDecimal2(penaltyBase);
          const gstPercent = lateFeeStructure[0]?.gst_percent || 18;
          const penaltyGST = toDecimal2(penaltyBaseRounded * (gstPercent / 100));
          const penaltyTotal = toDecimal2(penaltyBaseRounded + penaltyGST);
          
          return { penaltyBase: penaltyBaseRounded, penaltyGST, penaltyTotal };
        };
        
        let outstandingPrincipal = principal;
        let totalInterest = 0;
        
        for (let i = 0; i < emiCount; i++) {
          const emiDate = allEmiDates[i];
          const emiDateStr = formatDateToString(emiDate);
          
          let previousDateStr;
          if (i === 0) {
            previousDateStr = baseDateStr;
          } else {
            const prevEmiDate = allEmiDates[i - 1];
            const prevEmiDateStr = formatDateToString(prevEmiDate);
            // Add 1 day to previous date for inclusive counting
            const prevDate = new Date(prevEmiDate);
            prevDate.setDate(prevDate.getDate() + 1);
            previousDateStr = formatDateToString(prevDate);
          }
          
          // Calculate days difference (inclusive counting: both start and end dates count)
          const daysForPeriod = calculateDaysBetween(previousDateStr, emiDateStr);
          
          const principalForThisEmi = i === emiCount - 1 
            ? toDecimal2(principalPerEmi + remainder)
            : principalPerEmi;
          
          const interestForPeriod = toDecimal2(outstandingPrincipal * interestRatePerDay * daysForPeriod);
          totalInterest += interestForPeriod;
          
          // Calculate penalty if EMI is overdue
          // Use string-based date comparison to avoid timezone issues
          const todayStr = getTodayString();
          let penaltyAmount = 0;
          let penaltyBase = 0;
          let penaltyGST = 0;
          
          // Check if EMI is overdue by comparing date strings (YYYY-MM-DD format)
          if (emiDateStr < todayStr) {
            // EMI is overdue - calculate days overdue (exclusive, not including today)
            const daysOverdueInclusive = calculateDaysBetween(emiDateStr, todayStr);
            const daysOverdue = Math.max(1, daysOverdueInclusive - 1); // Exclude today for penalty calculation
            
            // Calculate penalty based on LOAN PRINCIPAL (not EMI principal)
            // Penalty is calculated on the full loan amount, not per-EMI principal
            if (lateFeeStructure && Array.isArray(lateFeeStructure) && lateFeeStructure.length > 0) {
              const penaltyCalc = calculateEmiPenalty(principal, daysOverdue, lateFeeStructure);
              penaltyAmount = penaltyCalc.penaltyTotal;
              penaltyBase = penaltyCalc.penaltyBase;
              penaltyGST = penaltyCalc.penaltyGST;
              
              // Penalty calculated for overdue EMI
            } else {
              console.warn(`⚠️ [EMI Penalty] EMI #${i + 1} is overdue but no late_fee_structure found`);
            }
          }
          
          // Calculate installment amount (principal + interest + post service fee + GST + penalty)
          // CRITICAL: Include post service fee + GST in each EMI
          // Penalty is added to overdue EMIs
          const baseAmount = principalForThisEmi + interestForPeriod + postServiceFeePerEmi + postServiceFeeGSTPerEmi;
          const instalmentAmount = toDecimal2(baseAmount + penaltyAmount);
          
          // Preserve stored status if available (for account_manager loans with payment tracking)
          let emiStatus = 'pending';
          if (storedEmiSchedule && Array.isArray(storedEmiSchedule)) {
            const storedEmi = storedEmiSchedule.find(e => 
              (e.emi_number === i + 1 || e.instalment_no === i + 1)
            ) || storedEmiSchedule[i];
            if (storedEmi && storedEmi.status) {
              emiStatus = storedEmi.status;
            }
          }
          
          schedule.push({
            emi_number: i + 1,
            instalment_no: i + 1, // Add instalment_no for consistency with kfs.js
            due_date: emiDateStr,
            principal: principalForThisEmi,
            interest: interestForPeriod,
            post_service_fee: postServiceFeePerEmi,
            gst_on_post_service_fee: postServiceFeeGSTPerEmi,
            penalty_base: penaltyBase,
            penalty_gst: penaltyGST,
            penalty_total: penaltyAmount,
            instalment_amount: instalmentAmount,
            days: daysForPeriod,
            status: emiStatus
          });
          
          outstandingPrincipal = toDecimal2(outstandingPrincipal - principalForThisEmi);
        }
        
        // Update interest and total repayable (always recalculate for accuracy)
        calculation.interest.amount = totalInterest;
        
        // Ensure calculation.total exists before setting properties
        if (!calculation.total) {
          calculation.total = {};
        }
        
        calculation.total.repayable = principal + totalInterest + calculation.totals.repayableFee + calculation.totals.repayableFeeGST;
        calculation.total.breakdown = `Principal (₹${principal.toFixed(2)}) + Interest (₹${totalInterest.toFixed(2)}) + Repayable Fees (₹${(calculation.totals.repayableFee + calculation.totals.repayableFeeGST).toFixed(2)}) = ₹${calculation.total.repayable.toFixed(2)}`;
        
        // Also set total_amount and total_repayable for compatibility
        calculation.total_amount = calculation.total.repayable;
        calculation.total_repayable = calculation.total.repayable;
        
        // Add repayment schedule to calculation
        if (!calculation.repayment) {
          calculation.repayment = {};
        }
        
        // Always merge status from emi_schedule to preserve payment tracking
        // emi_schedule is the source of truth for payment status (updated when payments are made)
        // This applies to both account_manager and non-account_manager loans
        try {
          let emiScheduleArray = null;
          if (loan.emi_schedule) {
            emiScheduleArray = typeof loan.emi_schedule === 'string' 
              ? JSON.parse(loan.emi_schedule) 
              : loan.emi_schedule;
          }
          
          if (Array.isArray(emiScheduleArray) && emiScheduleArray.length > 0) {
            // Merge status from emi_schedule into repayment schedule
            schedule = schedule.map((instalment, index) => {
              // Match by instalment_no or emi_number (both are 1-indexed)
              const instalmentNo = instalment.instalment_no || instalment.emi_number || index + 1;
              const emiFromSchedule = emiScheduleArray.find((emi) => 
                (emi.instalment_no === instalmentNo || emi.emi_number === instalmentNo)
              ) || emiScheduleArray[index];
              
              // Use status from emi_schedule if available, otherwise keep existing status
              if (emiFromSchedule && emiFromSchedule.status) {
                return {
                  ...instalment,
                  status: emiFromSchedule.status // 'paid' or 'pending'
                };
              }
              // If no status in emi_schedule, keep existing status or default to pending
              return {
                ...instalment,
                status: instalment.status || 'pending'
              };
            });
            console.log(`✅ Merged EMI status from emi_schedule into repayment schedule (account_manager: ${isAccountManager})`);
          } else {
            // No emi_schedule found, ensure all have status (keep existing or set to pending)
            schedule = schedule.map((instalment) => ({
              ...instalment,
              status: instalment.status || 'pending'
            }));
          }
        } catch (emiScheduleError) {
          console.error('❌ Error merging emi_schedule status:', emiScheduleError);
          // If error, ensure all have status (keep existing or set to pending)
          schedule = schedule.map((instalment) => ({
            ...instalment,
            status: instalment.status || 'pending'
          }));
        }
        // Note: For account_manager loans, status was already preserved during recalculation above
        
        calculation.repayment.schedule = schedule;
        
        // Update stored values in database for account_manager AND repeat_disbursal loans to fix incorrect stored values
        // This ensures existing loans with wrong stored values get corrected automatically
        // CRITICAL: Update ALL stored calculation values (emi_schedule, fees_breakdown, disbursal_amount) based on current loan_amount
        const isRepeatDisbursal = loan.status === 'repeat_disbursal' || loan.status === 'ready_to_repeat_disbursal';
        if (isAccountManager || isRepeatDisbursal) {
          try {
            // Recalculate fees_breakdown with correct values based on current loan_amount
            // Combine deduct_from_disbursal and add_to_total fees
            const allFees = [
              ...(calculation.fees?.deductFromDisbursal || []),
              ...(calculation.fees?.addToTotal || [])
            ];
            const updatedFeesBreakdown = allFees.map(fee => ({
              fee_name: fee.fee_name,
              fee_amount: fee.fee_amount,
              gst_amount: fee.gst_amount,
              fee_percent: fee.fee_percent,
              total_with_gst: fee.total_with_gst
            }));
            
            // Prepare update values
            const updateFields = [];
            const updateValues = [];
            
            // For multi-EMI loans, update emi_schedule
            // Note: Penalty is calculated dynamically based on how overdue the EMI is, so it's not stored
            // The schedule returned to frontend will include penalty, but stored format keeps it minimal
            if (schedule && schedule.length > 0) {
              const updatedEmiSchedule = schedule.map((instalment) => ({
                emi_number: instalment.emi_number,
                instalment_no: instalment.instalment_no,
                due_date: instalment.due_date,
                emi_amount: instalment.instalment_amount, // EMI amount includes penalty if overdue
                status: instalment.status || 'pending'
              }));
              updateFields.push('emi_schedule = ?');
              updateValues.push(JSON.stringify(updatedEmiSchedule));
            }
            
            // Always update fees_breakdown, disbursal_amount, and total_repayable
            updateFields.push('fees_breakdown = ?');
            updateFields.push('disbursal_amount = ?');
            updateFields.push('total_repayable = ?');
            updateValues.push(JSON.stringify(updatedFeesBreakdown));
            updateValues.push(calculation.disbursal.amount);
            updateValues.push(calculation.total.repayable);
            updateValues.push(loanId); // For WHERE clause
            
            // Update stored calculation values in database
            const { executeQuery: execQuery } = require('../config/database');
            await execQuery(
              `UPDATE loan_applications 
               SET ${updateFields.join(', ')}, updated_at = NOW() 
               WHERE id = ?`,
              updateValues
            );
            
          } catch (updateError) {
            // Don't fail the request if update fails, just log the error
            console.error(`⚠️ [Loan Calculations] Failed to update stored values for loan #${loanId}:`, updateError);
          }
        }
      }
    }
    
    // Ensure calculation.total exists and is set correctly (fallback for single payment loans or edge cases)
    if (!calculation.total) {
      calculation.total = {};
    }
    
    // Ensure total.repayable is always set (fallback for single payment loans or edge cases)
    if (!calculation.total || !calculation.total.repayable || calculation.total.repayable === 0) {
      if (!calculation.total) {
        calculation.total = {};
      }
      
      const principal = calculation.principal || parseFloat(loan.loan_amount || 0);
      const interest = calculation.interest?.amount || 0;
      const repayableFee = calculation.totals?.repayableFee || 0;
      const repayableFeeGST = calculation.totals?.repayableFeeGST || 0;
      
      calculation.total.repayable = principal + interest + repayableFee + repayableFeeGST;
      calculation.total.breakdown = `Principal (₹${principal.toFixed(2)}) + Interest (₹${interest.toFixed(2)}) + Repayable Fees (₹${(repayableFee + repayableFeeGST).toFixed(2)}) = ₹${calculation.total.repayable.toFixed(2)}`;
    }
    
    // Ensure compatibility fields are always set
    if (!calculation.total_amount || calculation.total_amount === 0) {
      calculation.total_amount = calculation.total.repayable;
    }
    if (!calculation.total_repayable || calculation.total_repayable === 0) {
      calculation.total_repayable = calculation.total.repayable;
    }
    
    // Debug: Log final total values
    
    // Calculate exhausted days and interest till today for preclose calculation
    // PRIORITY: last_extension_date + next day (if extension exists)
    // FALLBACK: processed_at (if no extension)
    let exhaustedDays = 0;
    let interestTillToday = 0;
    
    // Determine base date for interest calculation
    // PRIORITY 1: Use last_extension_date + 1 day (next day after extension) if extension exists
    // PRIORITY 2: Use processed_at if it exists (regardless of status)
    // FALLBACK: Use disbursed_at if processed_at is not available
    let baseDateStr = null;
    
    if (loan.last_extension_date && loan.extension_count > 0) {
      // Extension exists - use last_extension_date + 1 day (next day after extension)
      const lastExtensionDateStr = parseDateToString(loan.last_extension_date_date || loan.last_extension_date);
      if (lastExtensionDateStr) {
        // Add 1 day to last_extension_date to get "next day"
        const [year, month, day] = lastExtensionDateStr.split('-').map(Number);
        const nextDayDate = new Date(year, month - 1, day);
        nextDayDate.setDate(nextDayDate.getDate() + 1);
        baseDateStr = formatDateToString(nextDayDate);
        // Using last_extension_date + 1 day
      }
    }
    
    // PRIORITY 2: Use processed_at + 1 day if it exists (interest starts the day after processing)
    if (!baseDateStr && loan.processed_at) {
      const processedDateStr = parseDateToString(loan.processed_at_date || loan.processed_at);
      if (processedDateStr) {
        // Add 1 day to processed_at - interest starts accruing from the day AFTER processing
        const [year, month, day] = processedDateStr.split('-').map(Number);
        const nextDayDate = new Date(year, month - 1, day);
        nextDayDate.setDate(nextDayDate.getDate() + 1);
        baseDateStr = formatDateToString(nextDayDate);
      }
    }
    
    // FALLBACK: Use disbursed_at if processed_at is not available
    if (!baseDateStr) {
      baseDateStr = parseDateToString(loan.disbursed_at_date || loan.disbursed_at);
    }
    
    // Calculate exhausted days from base date to today
    if (baseDateStr) {
      const todayStr = getTodayString();
      exhaustedDays = calculateDaysBetween(baseDateStr, todayStr);
      
      // Calculate interest till today using exhausted days
      if (calculation.interest && calculation.interest.rate_per_day && calculation.principal) {
        interestTillToday = toDecimal2(calculation.principal * calculation.interest.rate_per_day * exhaustedDays);
      }
    }
    
    // Add exhausted days and interest till today to response
    if (calculation.interest) {
      calculation.interest.exhaustedDays = exhaustedDays;
      calculation.interest.interestTillToday = interestTillToday;
    }
    
    res.json({
      success: true,
      data: {
        loan_id: loanId,
        ...calculation
      }
    });
    
  } catch (error) {
    console.error('Error getting loan calculation:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to calculate loan values'
    });
  }
});

/**
 * PUT /api/loan-calculations/:loanId
 * Update loan calculation parameters (PF%, Interest%)
 * Body:
 *   - processing_fee_percent: number
 *   - interest_percent_per_day: number
 */
router.put('/:loanId', authenticateAdmin, async (req, res) => {
  try {
    const db = await initializeDatabase();
    const loanId = parseInt(req.params.loanId);
    const { processing_fee_percent, interest_percent_per_day } = req.body;
    
    if (isNaN(loanId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid loan ID'
      });
    }
    
    // Check if loan is already processed
    const [loans] = await db.execute(
      'SELECT processed_at FROM loan_applications WHERE id = ?',
      [loanId]
    );
    
    if (!loans || loans.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      });
    }
    
    // Prevent calculation parameter changes if loan is already processed
    if (loans[0].processed_at) {
      return res.status(400).json({
        success: false,
        message: 'Cannot update calculation parameters after loan has been processed. Parameters are frozen at processing time.'
      });
    }
    
    const updates = {};
    
    if (processing_fee_percent !== undefined) {
      updates.processing_fee_percent = processing_fee_percent;
    }
    
    if (interest_percent_per_day !== undefined) {
      updates.interest_percent_per_day = interest_percent_per_day;
    }
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }
    
    const result = await updateLoanCalculation(db, loanId, updates);
    
    res.json(result);
    
  } catch (error) {
    console.error('Error updating loan calculation:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update loan calculation'
    });
  }
});

/**
 * POST /api/loan-calculations/calculate
 * Calculate loan values without saving (for preview)
 * Body:
 *   - loan_amount: number
 *   - processing_fee_percent: number
 *   - interest_percent_per_day: number
 *   - days: number
 */
router.post('/calculate', authenticateAdmin, async (req, res) => {
  try {
    const { loan_amount, processing_fee_percent, interest_percent_per_day, days } = req.body;
    
    // Validate inputs
    if (!loan_amount || !processing_fee_percent || !interest_percent_per_day || !days) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }
    
    const loanData = {
      loan_amount: parseFloat(loan_amount),
      processing_fee_percent: parseFloat(processing_fee_percent),
      interest_percent_per_day: parseFloat(interest_percent_per_day)
    };
    
    const calculation = calculateLoanValues(loanData, parseInt(days));
    
    res.json({
      success: true,
      data: calculation
    });
    
  } catch (error) {
    console.error('Error calculating loan values:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to calculate loan values'
    });
  }
});

/**
 * GET /api/loan-calculations/:loanId/days
 * Get total days since disbursement
 */
router.get('/:loanId/days', authenticateAdmin, async (req, res) => {
  try {
    const db = await initializeDatabase();
    const loanId = parseInt(req.params.loanId);
    
    if (isNaN(loanId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid loan ID'
      });
    }
    
    const [loans] = await db.execute(
      'SELECT disbursed_at, status FROM loan_applications WHERE id = ?',
      [loanId]
    );
    
    if (!loans || loans.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      });
    }
    
    const loan = loans[0];
    
    if (!loan.disbursed_at) {
      return res.json({
        success: true,
        data: {
          disbursed: false,
          days: 0,
          message: 'Loan not yet disbursed'
        }
      });
    }
    
    const days = calculateTotalDays(loan.disbursed_at);
    
    res.json({
      success: true,
      data: {
        disbursed: true,
        disbursed_at: loan.disbursed_at,
        days: days,
        status: loan.status
      }
    });
    
  } catch (error) {
    console.error('Error calculating days:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to calculate days'
    });
  }
});

module.exports = router;

