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
  parseDateToString
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
        plan_snapshot,
        interest_percent_per_day, fees_breakdown, user_id, loan_plan_id
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
    } else {
      console.log(`✅ Loan #${loanId} has ${planData.fees.length} fee(s):`, planData.fees.map(f => f.fee_name).join(', '));
      console.log(`📋 Fee details before calculation:`, JSON.stringify(planData.fees, null, 2));
      console.log(`📋 planData being passed:`, {
        fees: planData.fees,
        feesLength: planData.fees.length,
        feeNames: planData.fees.map(f => f.fee_name),
        feePercents: planData.fees.map(f => f.fee_percent),
        applicationMethods: planData.fees.map(f => f.application_method)
      });
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
    
    // Debug: Log calculation result fees
    console.log(`🔍 Calculation result fees for loan #${loanId}:`, {
      deductFromDisbursal: calculation.fees?.deductFromDisbursal?.length || 0,
      addToTotal: calculation.fees?.addToTotal?.length || 0,
      totals: calculation.totals
    });
    
    // For multi-EMI loans, recalculate interest by summing from each EMI period
    if (planData.emi_count && planData.emi_count > 1) {
      const principal = calculation.principal;
      const emiCount = planData.emi_count;
      const interestRatePerDay = calculation.interest.rate_per_day;
      
      // Generate EMI dates to calculate interest per period
      let allEmiDates = [];
      let baseDate;
      
      // For processed loans (account_manager status), use processed_at as base date for interest calculation
      // Otherwise use disbursed_at or current date
      const isProcessed = loan.processed_at && ['account_manager', 'cleared'].includes(loan.status);
      // Prioritize processed_at_date (from SQL DATE() - no timezone conversion) over processed_at Date object
      const dateSource = isProcessed 
        ? (loan.processed_at_date || loan.processed_at)
        : (loan.disbursed_at_date || loan.disbursed_at || null);
      
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
      
      // Parse base date to string, then convert to Date for calendar arithmetic
      let baseDateStr = null;
      if (dateSource) {
        baseDateStr = parseDateToStr(dateSource);
      }
      if (!baseDateStr) {
        const today = new Date();
        baseDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      }
      
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
      }
      
      // Calculate interest for each EMI period on reducing balance
      if (allEmiDates.length === emiCount) {
        const principalPerEmi = Math.floor(principal / emiCount * 100) / 100;
        const remainder = Math.round((principal - (principalPerEmi * emiCount)) * 100) / 100;
        
        let outstandingPrincipal = principal;
        let totalInterest = 0;
        const schedule = [];
        
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
            ? Math.round((principalPerEmi + remainder) * 100) / 100
            : principalPerEmi;
          
          const interestForPeriod = Math.round(outstandingPrincipal * interestRatePerDay * daysForPeriod * 100) / 100;
          totalInterest += interestForPeriod;
          
          // Add to schedule
          const instalmentAmount = Math.round((principalForThisEmi + interestForPeriod) * 100) / 100;
          schedule.push({
            emi_number: i + 1,
            due_date: emiDateStr,
            principal: principalForThisEmi,
            interest: interestForPeriod,
            instalment_amount: instalmentAmount,
            days: daysForPeriod
          });
          
          outstandingPrincipal = Math.round((outstandingPrincipal - principalForThisEmi) * 100) / 100;
        }
        
        // Update interest and total repayable
        calculation.interest.amount = totalInterest;
        calculation.total.repayable = principal + totalInterest + calculation.totals.repayableFee + calculation.totals.repayableFeeGST;
        calculation.total.breakdown = `Principal (₹${principal.toFixed(2)}) + Interest (₹${totalInterest.toFixed(2)}) + Repayable Fees (₹${(calculation.totals.repayableFee + calculation.totals.repayableFeeGST).toFixed(2)}) = ₹${calculation.total.repayable.toFixed(2)}`;
        
        // Add repayment schedule to calculation
        if (!calculation.repayment) {
          calculation.repayment = {};
        }
        calculation.repayment.schedule = schedule;
      }
    }
    
    // Calculate exhausted days and interest till today for preclose calculation
    // For processed loans, use processed_at; otherwise use disbursed_at
    let exhaustedDays = 0;
    let interestTillToday = 0;
    
    const isProcessed = loan.processed_at && ['account_manager', 'cleared'].includes(loan.status);
    // Get base date - prefer processed_at_date (from SQL DATE() function) to avoid timezone issues
    const dateSource = isProcessed 
      ? (loan.processed_at_date || loan.processed_at)
      : (loan.disbursed_at_date || loan.disbursed_at);
    
    // Normalize date to YYYY-MM-DD string using parseDateToString (handles Date objects, strings, etc.)
    const baseDateStr = parseDateToString(dateSource);
    
    if (baseDateStr) {
      const todayStr = getTodayString();
      exhaustedDays = calculateDaysBetween(baseDateStr, todayStr);
      
      // Calculate interest till today using exhausted days
      if (calculation.interest && calculation.interest.rate_per_day && calculation.principal) {
        interestTillToday = Math.round(calculation.principal * calculation.interest.rate_per_day * exhaustedDays * 100) / 100;
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

