const express = require('express');
const router = express.Router();
const { authenticateAdmin } = require('../middleware/auth');
const { requireAuth } = require('../middleware/jwtAuth');
const { initializeDatabase, executeQuery } = require('../config/database');
const { calculateLoanValues, calculateTotalDays, calculateCompleteLoanValues, calculateInterestDays, getNextSalaryDate, getSalaryDateForMonth } = require('../utils/loanCalculations');
const pdfService = require('../services/pdfService');
const emailService = require('../services/emailService');

/**
 * Format date to YYYY-MM-DD
 */
function formatDateLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * GET /api/kfs/user/:loanId
 * User-facing endpoint to get KFS data for their own loan
 */
router.get('/user/:loanId', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const { loanId } = req.params;
    const userId = req.userId;

    console.log('📄 User fetching KFS for loan ID:', loanId);

    // Verify loan belongs to user
    const loans = await executeQuery(`
      SELECT id, user_id, status FROM loan_applications 
      WHERE id = ? AND user_id = ?
    `, [loanId, userId]);

    if (!loans || loans.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Loan application not found or access denied'
      });
    }

    // Use the same KFS generation logic as admin endpoint
    // Fetch full loan application details including processed data
    const fullLoans = await executeQuery(`
      SELECT 
        la.*,
        la.fees_breakdown,
        la.disbursal_amount,
        la.processed_at,
        la.processed_amount,
        la.processed_interest,
        la.processed_penalty,
        la.processed_p_fee,
        la.processed_post_service_fee,
        la.processed_gst,
        la.processed_due_date,
        la.last_calculated_at,
        la.user_id,
        u.first_name, u.last_name, u.email, u.phone, u.date_of_birth,
        u.gender, u.marital_status
      FROM loan_applications la
      INNER JOIN users u ON la.user_id = u.id
      WHERE la.id = ?
    `, [loanId]);

    if (!fullLoans || fullLoans.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Loan application not found'
      });
    }

    const loan = fullLoans[0];

    // Get address details
    const addresses = await executeQuery(`
      SELECT * FROM addresses 
      WHERE user_id = ? AND is_primary = 1 
      LIMIT 1
    `, [loan.user_id]);

    const address = addresses[0] || {};

    // Get employment details and income range from users
    const employment = await executeQuery(`
      SELECT ed.*, u.income_range 
      FROM employment_details ed
      LEFT JOIN users u ON ed.user_id = u.id
      WHERE ed.user_id = ? 
      LIMIT 1
    `, [loan.user_id]);

    const employmentDetails = employment[0] || {};

    // Get bank details for the loan application
    const bankDetailsQuery = await executeQuery(`
      SELECT bd.* FROM bank_details bd
      INNER JOIN loan_applications la ON la.user_bank_id = bd.id
      WHERE la.id = ?
      LIMIT 1
    `, [loanId]);

    const bankDetails = bankDetailsQuery[0] || null;

    // Convert income_range to approximate monthly income for display
    const getMonthlyIncomeFromRange = (range) => {
      const ranges = {
        '0-15000': 7500,
        '15000-30000': 22500,
        '30000-50000': 40000,
        '50000-75000': 62500,
        '75000-100000': 87500,
        '100000+': 125000
      };
      return ranges[range] || 0;
    };

    const monthlyIncome = getMonthlyIncomeFromRange(employmentDetails.income_range);

    // Get loan plan details
    const loanPlans = await executeQuery(`
      SELECT * FROM loan_plans WHERE id = ?
    `, [loan.loan_plan_id]);

    const loanPlan = loanPlans[0] || {};

    // Prepare loan data for calculation
    const loanData = {
      loan_amount: loan.sanctioned_amount || loan.principal_amount || loan.loan_amount || 0,
      loan_id: loan.id,
      status: loan.status,
      disbursed_at: loan.disbursed_at
    };

    // Prepare plan data for calculation
    const planSnapshot = loan.plan_snapshot ? (typeof loan.plan_snapshot === 'string' ? JSON.parse(loan.plan_snapshot) : loan.plan_snapshot) : loanPlan;
    const defaultRepaymentDays = planSnapshot.repayment_days || planSnapshot.total_duration_days || loanPlan.repayment_days || loanPlan.total_duration_days || 15;

    const planData = {
      plan_id: planSnapshot.plan_id || loanPlan.id || null,
      plan_type: planSnapshot.plan_type || loanPlan.plan_type || 'single',
      repayment_days: defaultRepaymentDays,
      total_duration_days: planSnapshot.total_duration_days || loanPlan.total_duration_days || defaultRepaymentDays,
      emi_count: planSnapshot.emi_count || loanPlan.emi_count || null,
      emi_frequency: planSnapshot.emi_frequency || loanPlan.emi_frequency || null,
      interest_percent_per_day: parseFloat(planSnapshot.interest_percent_per_day || loanPlan.interest_percent_per_day || loan.interest_percent_per_day || 0.001),
      calculate_by_salary_date: planSnapshot.calculate_by_salary_date === 1 || planSnapshot.calculate_by_salary_date === true || loanPlan.calculate_by_salary_date === 1 || false,
      fees: planSnapshot.fees || loanPlan.fees || []
    };

    // Get user data for salary date calculation
    const userResult = await executeQuery(`
      SELECT salary_date FROM users WHERE id = ?
    `, [loan.user_id]);

    const userSalaryDate = userResult[0]?.salary_date || null;

    const userData = {
      user_id: loan.user_id,
      salary_date: userSalaryDate
    };

    // Helper function to parse date without timezone issues
    const parseDateSafe = (dateValue) => {
      if (!dateValue) return new Date();
      const d = new Date(dateValue);
      // Create a new date using UTC values as local values to avoid timezone shift
      return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0);
    };

    // Check if we should use actual exhausted days (for repayment schedule) or planned days (for KFS/Agreement)
    const useActualDays = req.query.useActualDays === 'true' || req.query.useActualDays === true;
    
    // Calculate actual exhausted days from processed_at (for processed loans) or disbursed_at to today (only if requested)
    // Per rulebook: For processed loans, use processed_at as base date
    let actualExhaustedDays = null;
    if (useActualDays && loan.processed_at && ['account_manager', 'cleared', 'active'].includes(loan.status)) {
      // For processed loans, use processed_at as per rulebook
      const processedDate = parseDateSafe(loan.processed_at);
      const currentDate = new Date();
      // Set both dates to midnight for accurate day calculation
      currentDate.setHours(0, 0, 0, 0);
      // Use inclusive counting: Math.ceil((end - start) / msPerDay) + 1
      const diffTime = currentDate.getTime() - processedDate.getTime();
      actualExhaustedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      // Ensure at least 1 day
      if (actualExhaustedDays < 1) {
        actualExhaustedDays = 1;
      }
      const formatDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      console.log(`📅 Using actual exhausted days: ${actualExhaustedDays} (from processed_at ${formatDate(processedDate)} to ${formatDate(currentDate)})`);
    } else if (useActualDays && loan.disbursed_at && ['account_manager', 'cleared', 'active', 'disbursal'].includes(loan.status)) {
      // Fallback to disbursed_at if processed_at not available (shouldn't happen for processed loans)
      const disbursedDate = parseDateSafe(loan.disbursed_at);
      const currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);
      const diffTime = currentDate.getTime() - disbursedDate.getTime();
      actualExhaustedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      if (actualExhaustedDays < 1) {
        actualExhaustedDays = 1;
      }
      console.log(`📅 Using actual exhausted days: ${actualExhaustedDays} (from disbursed_at ${disbursedDate.toISOString().split('T')[0]} to ${currentDate.toISOString().split('T')[0]})`);
    } else {
      console.log(`📅 Using planned repayment days (for KFS/Agreement documents)`);
    }

    // Calculate PLANNED loan term days (for due date calculation) - always use planned term, not exhausted days
    // This should be calculated from the disbursement date (or today if not disbursed) using the plan
    const plannedTermCalculationDate = loan.disbursed_at && ['account_manager', 'cleared', 'active', 'disbursal'].includes(loan.status)
      ? new Date(loan.disbursed_at)  // Use disbursed date for planned term calculation
      : new Date();  // Use today for pending loans
    // Normalize to midnight for consistent date calculations
    plannedTermCalculationDate.setHours(0, 0, 0, 0);
    const plannedTermResult = calculateInterestDays(planData, userData, plannedTermCalculationDate);
    const plannedTermDays = plannedTermResult.days;

    // KFS should show the original planned loan terms for documents, but actual days for repayment schedule
    // Use plan's repayment days calculation (could be fixed days or salary-based) unless useActualDays is true
    const calculationDateForOptions = loan.disbursed_at && ['account_manager', 'cleared', 'active', 'disbursal'].includes(loan.status)
      ? new Date(loan.disbursed_at)  // Use disbursed date for calculation
      : new Date();  // Use today for pending loans
    // Normalize to midnight for consistent date calculations
    calculationDateForOptions.setHours(0, 0, 0, 0);
    const calculationOptions = {
      calculationDate: calculationDateForOptions,
      customDays: actualExhaustedDays  // Only override with actual exhausted days if useActualDays=true
    };

    // For processed loans, use processed_interest from database (updated by cron) instead of recalculating
    // Per rulebook: For processed loans, use processed_* values, not live calculations
    let loanValues;
    if (loan.processed_at && useActualDays) {
      // Use processed data for processed loans
      const processedPrincipal = parseFloat(loan.processed_amount || loanData.loan_amount || 0);
      const processedInterest = parseFloat(loan.processed_interest || 0);
      const processedPenalty = parseFloat(loan.processed_penalty || 0);
      
      // Still calculate fees and other values, but use processed interest
      loanValues = calculateCompleteLoanValues(loanData, planData, userData, calculationOptions);
      
      // Override interest with processed_interest (updated by cron)
      if (loanValues.interest) {
        loanValues.interest.amount = processedInterest;
        // Calculate days from processed_at to today for display
        const processedDate = new Date(loan.processed_at);
        processedDate.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const daysFromProcessed = Math.ceil((today.getTime() - processedDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        loanValues.interest.days = daysFromProcessed;
      }
      
      console.log(`📊 Using processed_interest: ₹${processedInterest} (from database, updated by cron)`);
    } else {
      // Calculate loan values using actual exhausted days (not plan days) for interest calculation
      loanValues = calculateCompleteLoanValues(loanData, planData, userData, calculationOptions);
    }

    // Parse fees breakdown if it's a JSON string
    let feesBreakdown = [];
    if (loan.fees_breakdown) {
      try {
        const parsedFees = typeof loan.fees_breakdown === 'string'
          ? JSON.parse(loan.fees_breakdown)
          : loan.fees_breakdown;


        // Transform old fee structure to new structure
        feesBreakdown = parsedFees.map(fee => {
          // If fee already has application_method, use as-is
          if (fee.application_method) {
            return {
              fee_name: fee.fee_name || fee.name,
              amount: fee.amount,
              application_method: fee.application_method,
              gst_amount: fee.gst_amount,
              total_with_gst: fee.total_with_gst
            };
          }

          // Transform old structure: assume processing fees are deducted from disbursal
          return {
            fee_name: fee.name || 'Processing Fee',
            amount: fee.amount,
            application_method: 'deduct_from_disbursal', // Default for old fees
            gst_amount: fee.gst_amount,
            total_with_gst: fee.total_with_gst
          };
        });

      } catch (e) {
        console.error('Error parsing fees_breakdown:', e);
        feesBreakdown = [];
      }
    }

    // Build KFS data structure (same as admin endpoint)
    const kfsData = {
      company: {
        name: 'Pocket Credit',
        address: '123 Business Street, Mumbai, Maharashtra 400001',
        phone: '+91 9876543210',
        email: 'support@pocketcredit.in',
        website: 'https://pocketcredit.in',
        cin: 'U74999MH2023PTC123456',
        gstin: '27AABCU1234D1Z5',
        rbi_registration: 'B-14.03456',
        registered_office: 'Plot No. 123, Sector 18, Gurugram, Haryana 122015',
        jurisdiction: 'Gurugram, Haryana'
      },
      loan: {
        loan_id: loan.loan_id || loan.application_number || `LOAN${loan.id}`,
        application_number: loan.application_number || loan.loan_id || `LOAN${loan.id}`,
        application_date: loan.created_at ? new Date(loan.created_at).toLocaleDateString('en-IN') : 'N/A',
        sanctioned_amount: loan.sanctioned_amount || loan.principal_amount || loan.loan_amount || 0,
        principal_amount: loan.sanctioned_amount || loan.principal_amount || loan.loan_amount || 0,
        disbursal_amount: loanValues.disbursal?.amount || loan.disbursal_amount || 0,
        disbursed_at: loan.disbursed_at || null,
        status: loan.status, // Include loan status for frontend checks
        processed_at: loan.processed_at || null,
        processed_amount: loan.processed_amount || null,
        processed_interest: loan.processed_interest || null,
        processed_penalty: loan.processed_penalty || null,
        processed_p_fee: loan.processed_p_fee || null,
        processed_post_service_fee: loan.processed_post_service_fee || null,
        processed_gst: loan.processed_gst || null,
        processed_due_date: loan.processed_due_date || null,
        last_calculated_at: loan.last_calculated_at || null,
        loan_term_days: (() => {
          // Calculate loan term days based on EMI count for EMI loans
          const emiCount = planData.emi_count || null;
          if (emiCount && emiCount > 1) {
            // EMI loan: calculate days based on EMI count
            // Formula: 165 + (emi_count - 1) * 30
            // 1 EMI: 165 days, 2 EMI: 195 days, 3 EMI: 225 days, 4 EMI: 255 days, etc.
            return 165 + (emiCount - 1) * 30;
          }
          // Single payment loan: always show 165 days (base + 4 extensions possible)
          return 165;
        })(),
        loan_term_months: Math.ceil((plannedTermDays || loan.loan_term_days || loanPlan.tenure_days || loanPlan.repayment_days || loanPlan.total_duration_days || 0) / 30),
        interest_rate: planData.interest_percent_per_day 
          ? parseFloat((planData.interest_percent_per_day * 365 * 100).toFixed(2)) 
          : (loanPlan.interest_percent_per_day 
            ? parseFloat((loanPlan.interest_percent_per_day * 365 * 100).toFixed(2)) 
            : 0),
        repayment_frequency: loanPlan.repayment_frequency || 'Monthly',
        emi_count: planData.emi_count || null
      },
      borrower: {
        name: `${loan.first_name || ''} ${loan.last_name || ''}`.trim() || 'N/A',
        email: loan.email || 'N/A',
        phone: loan.phone || 'N/A',
        date_of_birth: loan.date_of_birth ? new Date(loan.date_of_birth).toLocaleDateString('en-IN') : 'N/A',
        gender: loan.gender || 'N/A',
        marital_status: loan.marital_status || 'N/A',
        address: {
          line1: address.address_line1 || 'N/A',
          line2: address.address_line2 || '',
          city: address.city || 'N/A',
          state: address.state || 'N/A',
          pincode: address.pincode || 'N/A'
        },
        employment: {
          company_name: employmentDetails.company_name || 'N/A',
          designation: employmentDetails.designation || 'N/A',
          monthly_income: monthlyIncome
        }
      },
      interest: (() => {
        // For multi-EMI loans, calculate total interest from schedule sum (already generated below)
        // This will be updated after schedule is generated
        return {
          rate: planData.interest_percent_per_day 
            ? parseFloat((planData.interest_percent_per_day * 365 * 100).toFixed(2)) 
            : (loanPlan.interest_percent_per_day 
              ? parseFloat((loanPlan.interest_percent_per_day * 365 * 100).toFixed(2)) 
              : 0),
          rate_per_day: planData.interest_percent_per_day || loanPlan.interest_percent_per_day || 0.001,
          type: 'Reducing Balance',
          calculation_method: 'Daily',
          annual_rate: ((planData.interest_percent_per_day || loanPlan.interest_percent_per_day || 0.001) * 365 * 100).toFixed(2),
          days: loanValues.interest?.days || 0,
          amount: loanValues.interest?.amount || 0, // Will be updated below for multi-EMI
          calculation_days: loanValues.interest?.days || 0  // Actual days used for interest calculation
        };
      })(),
      fees: {
        processing_fee: loanValues.totals?.disbursalFee || loanValues.processingFee || 0,
        // Fees are already calculated with EMI multiplication in loanCalculations.js
        total_add_to_total: loanValues.totals?.repayableFee || loanValues.totalAddToTotal || 0,
        gst_on_add_to_total: loanValues.totals?.repayableFeeGST || 0,
        gst: (loanValues.totals?.disbursalFeeGST || 0) + (loanValues.totals?.repayableFeeGST || 0) || loanValues.processingFeeGST || 0,
        // Fees breakdown is already calculated with EMI multiplication in loanCalculations.js
        // and saved to database with correct amounts, so no need to multiply again
        fees_breakdown: feesBreakdown
      },
      calculations: (() => {
        const principal = loanValues.principal || loan.sanctioned_amount || loan.principal_amount || loan.loan_amount || 0;
        const processingFee = loanValues.totals?.disbursalFee || loanValues.processingFee || 0;
        const interest = loanValues.interest?.amount || loanValues.totalInterest || 0;
        const days = loanValues.interest?.days || 0;
        const emiCount = planData.emi_count || 1;
        
        // Totals are already calculated with EMI multiplication in loanCalculations.js
        const disbursalGST = loanValues.totals?.disbursalFeeGST || 0;
        const repayableGST = loanValues.totals?.repayableFeeGST || 0;
        const gst = disbursalGST + repayableGST;
        
        // Repayable fee is already multiplied by EMI count in loanCalculations.js
        const repayableFee = loanValues.totals?.repayableFee || 0;
        
        // Calculate first due date for Multi-EMI loan term calculation
        let firstDueDate;
        if (plannedTermResult.repaymentDate) {
          firstDueDate = new Date(plannedTermResult.repaymentDate);
        } else if (loanValues.interest?.repayment_date) {
          firstDueDate = new Date(loanValues.interest.repayment_date);
        } else {
          const baseDate = loan.disbursed_at ? new Date(loan.disbursed_at) : new Date();
          baseDate.setHours(0, 0, 0, 0);
          firstDueDate = new Date(baseDate);
          firstDueDate.setDate(firstDueDate.getDate() + plannedTermDays);
          firstDueDate.setHours(0, 0, 0, 0);
        }
        firstDueDate.setHours(0, 0, 0, 0);
        
        // For salary-based Multi-EMI loans, ensure firstDueDate matches the salary date
        if (emiCount > 1 && planData.emi_frequency === 'monthly' && planData.calculate_by_salary_date && userData.salary_date) {
          const salaryDate = parseInt(userData.salary_date);
          if (salaryDate >= 1 && salaryDate <= 31) {
            firstDueDate = getSalaryDateForMonth(firstDueDate, salaryDate, 0);
          }
        }
        
        // Calculate actual loan term days for APR calculation
        // For Multi-EMI loans, calculate from disbursement date to last EMI date
        // For single payment loans, use actual interest calculation days
        let loanTermDaysForAPR = days;  // Default: use interest calculation days
        
        if (emiCount > 1) {
          // Generate last EMI date to calculate actual loan term
          const baseDate = loan.disbursed_at ? new Date(loan.disbursed_at) : new Date();
          baseDate.setHours(0, 0, 0, 0);
          
          let lastEmiDate;
          if (planData.emi_frequency === 'monthly' && planData.calculate_by_salary_date && userData.salary_date) {
            const salaryDate = parseInt(userData.salary_date);
            if (salaryDate >= 1 && salaryDate <= 31) {
              // Use firstDueDate as the base (already calculated from plannedTermResult.repaymentDate)
              // Get last EMI date (emiCount - 1 because first is at index 0)
              lastEmiDate = getSalaryDateForMonth(firstDueDate, salaryDate, emiCount - 1);
            } else {
              // Fallback: use firstDueDate + (emiCount - 1) months
              lastEmiDate = new Date(firstDueDate);
              lastEmiDate.setMonth(lastEmiDate.getMonth() + (emiCount - 1));
            }
          } else {
            // For non-salary date Multi-EMI, calculate based on frequency
            const daysPerEmi = {
              daily: 1,
              weekly: 7,
              biweekly: 14,
              monthly: 30
            };
            const daysBetween = daysPerEmi[planData.emi_frequency] || 30;
            lastEmiDate = new Date(firstDueDate);
            if (planData.emi_frequency === 'monthly') {
              lastEmiDate.setMonth(lastEmiDate.getMonth() + (emiCount - 1));
            } else {
              lastEmiDate.setDate(lastEmiDate.getDate() + ((emiCount - 1) * daysBetween));
            }
            lastEmiDate.setHours(0, 0, 0, 0);
          }
          
          // Calculate actual loan term days from disbursement to last EMI
          if (lastEmiDate) {
            loanTermDaysForAPR = Math.ceil((lastEmiDate - baseDate) / (1000 * 60 * 60 * 24)) + 1;
          }
        }
        
        // For Multi-EMI loans, calculate total interest by summing interest for each EMI period
        // Each EMI period has interest calculated on the outstanding principal for that period
        // Define baseDate for debug logging (used for both single and multi-EMI)
        const baseDate = loan.disbursed_at ? new Date(loan.disbursed_at) : new Date();
        baseDate.setHours(0, 0, 0, 0);
        
        // Initialize emiPeriodDetails for debug logging
        let emiPeriodDetails = [];
        
        let interestForAPR = interest;
        if (emiCount > 1) {
          const interestRatePerDay = loanValues.interest?.rate_per_day || planData.interest_percent_per_day || (interest / (principal * days));
          
          // Generate all EMI dates - always recalculate from processed_at for processed loans
          // (stored processed_due_date may have been calculated from disbursed_at, so we recalculate)
          let allEmiDates = [];
          if (planData.emi_frequency === 'monthly' && planData.calculate_by_salary_date && userData.salary_date) {
            const salaryDate = parseInt(userData.salary_date);
            if (salaryDate >= 1 && salaryDate <= 31) {
              // For processed loans, use processed_at as base date (per rulebook)
              // For non-processed loans, use disbursed_at
              let baseDateForEmi;
              if (loan.processed_at) {
                // Extract date portion only to avoid timezone issues
                // Handle both string and Date object formats
                let processedDateStr;
                if (typeof loan.processed_at === 'string') {
                  // Handle MySQL datetime format: "2025-12-25 23:19:50" or ISO format: "2025-12-25T23:19:50.000Z"
                  if (loan.processed_at.includes('T')) {
                    processedDateStr = loan.processed_at.split('T')[0];
                  } else if (loan.processed_at.includes(' ')) {
                    processedDateStr = loan.processed_at.split(' ')[0];
                  } else {
                    processedDateStr = loan.processed_at.substring(0, 10);
                  }
                } else if (loan.processed_at instanceof Date) {
                  processedDateStr = loan.processed_at.toISOString().split('T')[0];
                } else {
                  // Fallback: try to convert to Date first
                  const processedDate = new Date(loan.processed_at);
                  processedDateStr = processedDate.toISOString().split('T')[0];
                }
                // Parse date components directly to avoid timezone issues
                // processedDateStr is in format "YYYY-MM-DD"
                const [year, month, day] = processedDateStr.split('-').map(Number);
                baseDateForEmi = new Date(year, month - 1, day); // month is 0-indexed
                console.log(`📅 Using processed_at as base date for EMI calculation: ${processedDateStr}`);
              } else {
                baseDateForEmi = loan.disbursed_at ? new Date(loan.disbursed_at) : new Date();
              }
              baseDateForEmi.setHours(0, 0, 0, 0);
              let nextSalaryDate = getNextSalaryDate(baseDateForEmi, salaryDate);
              
              // Check if duration is less than minimum days
              const minDuration = planData.repayment_days || 15;
              const daysToNextSalary = Math.ceil((nextSalaryDate.getTime() - baseDateForEmi.getTime()) / (1000 * 60 * 60 * 24)) + 1;
              console.log(`📅 EMI Date Calculation: baseDate=${formatDateLocal(baseDateForEmi)}, nextSalaryDate=${formatDateLocal(nextSalaryDate)}, daysToNextSalary=${daysToNextSalary}, minDuration=${minDuration}`);
              if (daysToNextSalary < minDuration) {
                nextSalaryDate = getSalaryDateForMonth(baseDateForEmi, salaryDate, 1);
                console.log(`📅 Moved to next month due to minimum duration: ${formatDateLocal(nextSalaryDate)}`);
              }
              
              // Generate all EMI dates from the first salary date
              for (let i = 0; i < emiCount; i++) {
                const emiDate = getSalaryDateForMonth(nextSalaryDate, salaryDate, i);
                allEmiDates.push(emiDate);
              }
              console.log(`📅 Generated ${allEmiDates.length} EMI dates: ${allEmiDates.map(d => formatDateLocal(d)).join(', ')}`);
            }
          } else {
            // Calculate first due date for non-salary date plans
            let firstDueDate;
            if (plannedTermResult.repaymentDate) {
              firstDueDate = new Date(plannedTermResult.repaymentDate);
            } else if (loanValues.interest?.repayment_date) {
              firstDueDate = new Date(loanValues.interest.repayment_date);
            } else {
              firstDueDate = new Date(baseDate);
              firstDueDate.setDate(firstDueDate.getDate() + plannedTermDays);
            }
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
          
          // Calculate total interest by summing interest for each EMI period
          if (allEmiDates.length === emiCount) {
            // Calculate principal distribution (handle cases where it doesn't divide evenly)
            // For 3 EMIs: 33.33%, 33.33%, 33.34% (or ₹3,333.33, ₹3,333.33, ₹3,333.34)
            // For 4 EMIs: 25%, 25%, 25%, 25% (or ₹2,500 each)
            const principalPerEmi = Math.floor(principal / emiCount * 100) / 100; // Round to 2 decimals
            const remainder = Math.round((principal - (principalPerEmi * emiCount)) * 100) / 100;
            
            let outstandingPrincipal = principal;
            interestForAPR = 0;
            
            for (let i = 0; i < emiCount; i++) {
              // allEmiDates contains Date objects, ensure we work with Date objects
              const emiDate = allEmiDates[i] instanceof Date ? allEmiDates[i] : new Date(allEmiDates[i]);
              emiDate.setHours(0, 0, 0, 0);
              
              // Calculate days for this EMI period
              // First period (disbursement to first EMI): inclusive, add +1
              // Subsequent periods: start from day AFTER previous EMI date (e.g., 1 Feb if previous was 31 Jan)
              let previousDate;
              if (i === 0) {
                previousDate = new Date(baseDate);
                previousDate.setHours(0, 0, 0, 0);
              } else {
                // Start from day AFTER previous EMI date
                const prevEmiDate = allEmiDates[i - 1] instanceof Date ? allEmiDates[i - 1] : new Date(allEmiDates[i - 1]);
                previousDate = new Date(prevEmiDate);
                previousDate.setDate(previousDate.getDate() + 1);
                previousDate.setHours(0, 0, 0, 0);
              }
              const daysForPeriod = Math.ceil((emiDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
              
              // Calculate principal for this EMI (add remainder to last EMI)
              const principalForThisEmi = i === emiCount - 1 
                ? Math.round((principalPerEmi + remainder) * 100) / 100
                : principalPerEmi;
              
              // Calculate interest for this period on outstanding principal
              const interestForPeriod = Math.round(outstandingPrincipal * interestRatePerDay * daysForPeriod * 100) / 100;
              interestForAPR += interestForPeriod;
              
              // Store period details for debugging
              emiPeriodDetails.push({
                period: i + 1,
                previousDate: previousDate.toISOString().split('T')[0],
                emiDate: emiDate.toISOString().split('T')[0],
                daysForPeriod,
                outstandingPrincipal: outstandingPrincipal.toFixed(2),
                principalForThisEmi: principalForThisEmi.toFixed(2),
                interestForPeriod: interestForPeriod.toFixed(2),
                interestRatePerDay
              });
              
              // Reduce outstanding principal for next period
              outstandingPrincipal = Math.round((outstandingPrincipal - principalForThisEmi) * 100) / 100;
            }
          }
        }
        
        // Calculate APR
        const totalCharges = processingFee + gst + repayableFee + interestForAPR;
        const apr = loanTermDaysForAPR > 0 ? ((totalCharges / principal) / loanTermDaysForAPR) * 36500 : 0;
        
        // Debug: Log APR calculation details
        console.log('APR Calculation Debug (User):', {
          processingFee,
          gst,
          repayableFee,
          interest: interest,
          interestForAPR: interestForAPR,
          totalCharges,
          principal,
          loanTermDaysForAPR,
          interestCalculationDays: days,
          emiCount,
          interestRatePerDay: loanValues.interest?.rate_per_day || planData.interest_percent_per_day || (interest / (principal * days)),
          disbursementDate: baseDate.toISOString().split('T')[0],
          emiPeriodDetails: emiCount > 1 ? emiPeriodDetails : undefined,
          apr: apr.toFixed(2),
          aprCalculation: `((${totalCharges} / ${principal}) / ${loanTermDaysForAPR}) * 36500 = ${apr.toFixed(2)}`
        });
        
        return {
          principal,
          interest: emiCount > 1 ? interestForAPR : interest,
          total_repayable: loanValues.total?.repayable || loanValues.totalRepayableAmount || 0,
          total_amount: loanValues.total?.repayable || loanValues.totalRepayableAmount || 0,
          disbursed_amount: loanValues.disbursal?.amount || loan.disbursal_amount || 0,
          netDisbursalAmount: loanValues.disbursal?.amount || loan.disbursal_amount || 0,
          emi: loanValues.emiAmount || 0,
          apr: parseFloat(apr.toFixed(2))
        };
      })(),
      repayment: (() => {
        const emiCount = planData.emi_count || null;
        const isMultiEmi = emiCount && emiCount > 1;
        
        // Calculate first due date
        let firstDueDate;
        if (plannedTermResult.repaymentDate) {
          firstDueDate = new Date(plannedTermResult.repaymentDate);
        } else if (loanValues.interest?.repayment_date) {
          firstDueDate = new Date(loanValues.interest.repayment_date);
        } else {
          const baseDate = loan.disbursed_at ? new Date(loan.disbursed_at) : new Date();
          baseDate.setHours(0, 0, 0, 0);
          firstDueDate = new Date(baseDate);
          firstDueDate.setDate(firstDueDate.getDate() + plannedTermDays);
          firstDueDate.setHours(0, 0, 0, 0);
        }

        // Generate all EMI dates for Multi-EMI plans
        let allEmiDates = [];
        if (isMultiEmi && planData.emi_frequency === 'monthly' && planData.calculate_by_salary_date && userData.salary_date) {
          const salaryDate = parseInt(userData.salary_date);
          console.log(`📅 EMI Calculation Debug - salaryDate: ${salaryDate}, processed_at: ${loan.processed_at}, disbursed_at: ${loan.disbursed_at}`);
          if (salaryDate >= 1 && salaryDate <= 31) {
            // For processed loans, use processed_at as base date (per rulebook)
            // For non-processed loans, use disbursed_at
            let baseDate;
            if (loan.processed_at) {
              // Extract date portion only to avoid timezone issues
              // Handle both string and Date object formats
              let processedDateStr;
              if (typeof loan.processed_at === 'string') {
                // Handle MySQL datetime format: "2025-12-25 23:19:50" or ISO format: "2025-12-25T23:19:50.000Z"
                if (loan.processed_at.includes('T')) {
                  processedDateStr = loan.processed_at.split('T')[0];
                } else if (loan.processed_at.includes(' ')) {
                  processedDateStr = loan.processed_at.split(' ')[0];
                } else {
                  processedDateStr = loan.processed_at.substring(0, 10);
                }
              } else if (loan.processed_at instanceof Date) {
                processedDateStr = loan.processed_at.toISOString().split('T')[0];
              } else {
                // Fallback: try to convert to Date first
                const processedDate = new Date(loan.processed_at);
                processedDateStr = processedDate.toISOString().split('T')[0];
              }
              // Parse date components directly to avoid timezone issues
              // processedDateStr is in format "YYYY-MM-DD"
              const [year, month, day] = processedDateStr.split('-').map(Number);
              baseDate = new Date(year, month - 1, day); // month is 0-indexed
              console.log(`📅 Using processed_at as base date for EMI calculation: ${processedDateStr} (parsed as ${formatDateLocal(baseDate)})`);
            } else {
              baseDate = loan.disbursed_at ? new Date(loan.disbursed_at) : new Date();
              console.log(`📅 Using disbursed_at as base date: ${formatDateLocal(baseDate)}`);
            }
            baseDate.setHours(0, 0, 0, 0);
            let nextSalaryDate = getNextSalaryDate(baseDate, salaryDate);
            
            // Check if duration is less than minimum days
            const minDuration = planData.repayment_days || 15;
            const daysToNextSalary = Math.ceil((nextSalaryDate.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            console.log(`📅 EMI Date Calculation: baseDate=${formatDateLocal(baseDate)}, nextSalaryDate=${formatDateLocal(nextSalaryDate)}, daysToNextSalary=${daysToNextSalary}, minDuration=${minDuration}`);
            if (daysToNextSalary < minDuration) {
              nextSalaryDate = getSalaryDateForMonth(nextSalaryDate, salaryDate, 1);
              console.log(`📅 Moved to next month due to minimum duration: ${formatDateLocal(nextSalaryDate)}`);
            }
            
            // Generate all EMI dates from the first salary date
            for (let i = 0; i < emiCount; i++) {
              const emiDate = getSalaryDateForMonth(nextSalaryDate, salaryDate, i);
              allEmiDates.push(formatDateLocal(emiDate));
            }
            console.log(`📅 Generated ${allEmiDates.length} EMI dates: ${allEmiDates.join(', ')}`);
          } else {
            console.log(`⚠️ Invalid salary date: ${salaryDate}`);
          }
        } else if (isMultiEmi) {
          // For non-salary date Multi-EMI, calculate based on frequency
          const baseDate = firstDueDate;
          const daysPerEmi = {
            daily: 1,
            weekly: 7,
            biweekly: 14,
            monthly: 30
          };
          const daysBetween = daysPerEmi[planData.emi_frequency] || 30;
          
          for (let i = 0; i < emiCount; i++) {
            const emiDate = new Date(baseDate);
            if (planData.emi_frequency === 'monthly') {
              emiDate.setMonth(emiDate.getMonth() + i);
            } else {
              emiDate.setDate(emiDate.getDate() + (i * daysBetween));
            }
            emiDate.setHours(0, 0, 0, 0);
            allEmiDates.push(formatDateLocal(emiDate));
          }
        } else {
          // Single payment loan
          allEmiDates = [formatDateLocal(firstDueDate)];
        }

        // Generate repayment schedule with all installments
        let schedule = [];
        const principal = loanValues.principal || loan.sanctioned_amount || loan.principal_amount || loan.loan_amount || 0;
        const totalRepayable = loanValues.total?.repayable || loanValues.totalRepayableAmount || 0;
        const interest = loanValues.interest?.amount || loanValues.totalInterest || 0;
        
        if (isMultiEmi && allEmiDates.length === emiCount) {
          // For Multi-EMI loans, generate schedule with all installments
          const interestDays = loanValues.interest?.days || plannedTermDays || 15;
          const interestRatePerDay = loanValues.interest?.rate_per_day || planData.interest_percent_per_day || (interestDays > 0 ? (interest / (principal * interestDays)) : 0.001);
          const principalPerEmi = Math.floor(principal / emiCount * 100) / 100;
          const remainder = Math.round((principal - (principalPerEmi * emiCount)) * 100) / 100;
          const postServiceFeePerEmi = loanValues.totals?.repayableFee || 0;
          const postServiceFeeGSTPerEmi = loanValues.totals?.repayableFeeGST || 0;
          
          let outstandingPrincipal = principal;
          const baseDateForSchedule = loan.disbursed_at ? new Date(loan.disbursed_at) : new Date();
          baseDateForSchedule.setHours(0, 0, 0, 0);
          
          for (let i = 0; i < emiCount; i++) {
            // Get EMI date (handle both Date objects and strings)
            const emiDateStr = allEmiDates[i];
            const emiDate = emiDateStr instanceof Date ? new Date(emiDateStr) : new Date(emiDateStr);
            emiDate.setHours(0, 0, 0, 0);
            
            // Calculate days for this period
            let previousDate;
            if (i === 0) {
              previousDate = new Date(baseDateForSchedule);
            } else {
              const prevEmiDateStr = allEmiDates[i - 1];
              const prevEmiDate = prevEmiDateStr instanceof Date ? new Date(prevEmiDateStr) : new Date(prevEmiDateStr);
              previousDate = new Date(prevEmiDate);
              previousDate.setDate(previousDate.getDate() + 1);
              previousDate.setHours(0, 0, 0, 0);
            }
            
            const daysForPeriod = Math.ceil((emiDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            
            // Calculate principal for this EMI
            const principalForThisEmi = i === emiCount - 1 
              ? Math.round((principalPerEmi + remainder) * 100) / 100
              : principalPerEmi;
            
            // Calculate interest for this period
            const interestForPeriod = Math.round(outstandingPrincipal * interestRatePerDay * daysForPeriod * 100) / 100;
            
            // Calculate installment amount (principal + interest + post service fee + GST)
            const instalmentAmount = Math.round((principalForThisEmi + interestForPeriod + postServiceFeePerEmi + postServiceFeeGSTPerEmi) * 100) / 100;
            
            schedule.push({
              instalment_no: i + 1,
              outstanding_principal: Math.round(outstandingPrincipal * 100) / 100,
              principal: principalForThisEmi,
              interest: interestForPeriod,
              post_service_fee: postServiceFeePerEmi,
              gst_on_post_service_fee: postServiceFeeGSTPerEmi,
              instalment_amount: instalmentAmount,
              due_date: formatDateLocal(emiDate) // Use local date format without timezone conversion
            });
            
            // Reduce outstanding principal for next period
            outstandingPrincipal = Math.round((outstandingPrincipal - principalForThisEmi) * 100) / 100;
          }
        } else {
          // Single payment loan
          const postServiceFee = loanValues.totals?.repayableFee || 0;
          const postServiceFeeGST = loanValues.totals?.repayableFeeGST || 0;
          schedule.push({
            instalment_no: 1,
            outstanding_principal: principal,
            principal: principal,
            interest: interest,
            post_service_fee: postServiceFee,
            gst_on_post_service_fee: postServiceFeeGST,
            instalment_amount: totalRepayable,
            due_date: formatDateLocal(firstDueDate)
          });
        }

        return {
          type: isMultiEmi ? 'EMI' : 'Bullet Payment',
          number_of_instalments: isMultiEmi ? emiCount : 1,
          instalment_amount: isMultiEmi ? schedule[0]?.instalment_amount || (totalRepayable / emiCount) : totalRepayable,
          emi_amount: loanValues.emiAmount || (isMultiEmi ? schedule[0]?.instalment_amount : totalRepayable),
          total_emis: isMultiEmi ? emiCount : 1,
          first_emi_date: schedule.length > 0 ? schedule[0].due_date : (loan.first_emi_date || 'N/A'),
          last_emi_date: schedule.length > 0 ? schedule[schedule.length - 1].due_date : (loan.last_emi_date || 'N/A'),
          first_due_date: schedule.length > 0 ? schedule[0].due_date : formatDateLocal(firstDueDate),
          all_emi_dates: allEmiDates,
          schedule: schedule
        };
      })(),
      penal_charges: {
        late_fee_per_day: loanPlan.late_fee_per_day || 0,
        late_fee_cap: loanPlan.late_fee_cap || 0,
        bounce_charges: loanPlan.bounce_charges || 0
      },
      grievance: {
        name: 'Customer Service',
        phone: '+91 9876543211',
        email: 'compliance@pocketcredit.in'
      },
      digital_loan: {
        cooling_off_period: '3 days',
        lsp_list_url: 'https://pocketcredit.in/lsp',
        payment_method: 'Digital payment through app or payment link'
      },
      additional: {
        loan_transferable: 'Yes',
        co_lending: 'No',
        recovery_clause: '1(X)',
        grievance_clause: '12'
      },
      bank_details: bankDetails ? {
        bank_name: bankDetails.bank_name || 'N/A',
        account_number: bankDetails.account_number || 'N/A',
        ifsc_code: bankDetails.ifsc_code || 'N/A',
        account_holder_name: bankDetails.account_holder_name || 'N/A'
      } : null,
      generated_at: new Date().toISOString(),

      // Signature data (if agreement is signed)
      signature: (() => {
        if (loan.clickwrap_signed_at && loan.clickwrap_webhook_data) {
          try {
            const webhookData = typeof loan.clickwrap_webhook_data === 'string' 
              ? JSON.parse(loan.clickwrap_webhook_data) 
              : loan.clickwrap_webhook_data;
            
            return {
              signed_at: loan.clickwrap_signed_at,
              signers_info: webhookData['signers-info'] || webhookData.signersInfo || []
            };
          } catch (e) {
            console.error('Error parsing clickwrap_webhook_data:', e);
            return null;
          }
        }
        return null;
      })()
    };

    // For multi-EMI loans, update interest amount and total repayable to sum from schedule
    if (kfsData.repayment.schedule && Array.isArray(kfsData.repayment.schedule) && kfsData.repayment.schedule.length > 1) {
      const totalInterestFromSchedule = kfsData.repayment.schedule.reduce((sum, emi) => sum + (emi.interest || 0), 0);
      const totalRepayableFromSchedule = kfsData.repayment.schedule.reduce((sum, emi) => sum + (emi.instalment_amount || 0), 0);
      kfsData.interest.amount = totalInterestFromSchedule;
      kfsData.calculations.total_repayable = totalRepayableFromSchedule;
      kfsData.calculations.total_amount = totalRepayableFromSchedule;
      console.log(`📊 Multi-EMI loan: Updated interest: ₹${totalInterestFromSchedule}, total repayable: ₹${totalRepayableFromSchedule}`);
    }

    console.log('✅ KFS data generated successfully for user');

    // If loan is processed and has PDF, return PDF URL instead of regenerating
    if (loan.processed_at && loan.kfs_pdf_url) {
      const { getPresignedUrl } = require('../services/s3Service');
      try {
        const pdfUrl = await getPresignedUrl(loan.kfs_pdf_url, 7 * 24 * 60 * 60); // 7 days
        return res.json({
          success: true,
          data: kfsData,
          pdf_url: pdfUrl,
          is_processed: true
        });
      } catch (error) {
        console.error('Error getting presigned URL for KFS PDF:', error);
        // Continue with normal response
      }
    }

    res.json({
      success: true,
      data: kfsData
    });

  } catch (error) {
    console.error('❌ Error generating KFS for user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate KFS',
      error: error.message
    });
  }
});

/**
 * GET /api/kfs/:loanId
 * Generate KFS (Key Facts Statement) data for a loan (Admin only)
 */
// Internal helper to check if request is from internal call
const isInternalCall = (req) => {
  return req.headers['x-internal-call'] === 'true' || req.query.internal === 'true';
};

router.get('/:loanId', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { loanId } = req.params;

    console.log('📄 Generating KFS for loan ID:', loanId);

    // Fetch loan application details including dynamic fees
    const loans = await executeQuery(`
      SELECT 
        la.*,
        la.fees_breakdown,
        la.disbursal_amount,
        la.user_id,
        u.first_name, u.last_name, u.email, u.phone, u.date_of_birth,
        u.gender, u.marital_status
      FROM loan_applications la
      INNER JOIN users u ON la.user_id = u.id
      WHERE la.id = ?
    `, [loanId]);

    if (!loans || loans.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Loan application not found'
      });
    }

    const loan = loans[0];

    // Get address details
    const addresses = await executeQuery(`
      SELECT * FROM addresses 
      WHERE user_id = ? AND is_primary = 1 
      LIMIT 1
    `, [loan.user_id]);

    const address = addresses[0] || {};

    // Get employment details and income range from users
    const employment = await executeQuery(`
      SELECT ed.*, u.income_range 
      FROM employment_details ed
      LEFT JOIN users u ON ed.user_id = u.id
      WHERE ed.user_id = ? 
      LIMIT 1
    `, [loan.user_id]);

    const employmentDetails = employment[0] || {};

    // Convert income_range to approximate monthly income for display
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

    // Parse fees breakdown if it's a JSON string (Admin endpoint)
    let feesBreakdown = [];
    if (loan.fees_breakdown) {
      try {
        const parsedFees = typeof loan.fees_breakdown === 'string'
          ? JSON.parse(loan.fees_breakdown)
          : loan.fees_breakdown;


        // Transform old fee structure to new structure
        feesBreakdown = parsedFees.map(fee => {
          // If fee already has application_method, use as-is
          if (fee.application_method) {
            return {
              fee_name: fee.fee_name || fee.name,
              amount: fee.amount,
              application_method: fee.application_method,
              gst_amount: fee.gst_amount,
              total_with_gst: fee.total_with_gst
            };
          }

          // Transform old structure: assume processing fees are deducted from disbursal
          return {
            fee_name: fee.name || 'Processing Fee',
            amount: fee.amount,
            application_method: 'deduct_from_disbursal', // Default for old fees
            gst_amount: fee.gst_amount,
            total_with_gst: fee.total_with_gst
          };
        });

      } catch (e) {
        console.error('Error parsing fees_breakdown:', e);
        feesBreakdown = [];
      }
    }


    // Fetch user data for salary date calculation
    const users = await executeQuery(
      `SELECT id, salary_date FROM users WHERE id = ?`,
      [loan.user_id]
    );

    const userData = users && users.length > 0 ? {
      user_id: users[0].id,
      salary_date: users[0].salary_date
    } : { user_id: null, salary_date: null };

    // Prepare data for centralized calculation
    const principal = parseFloat(loan.loan_amount || 0);

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
    }

    // Ensure fees array exists in plan snapshot
    if (!planSnapshot.fees && feesBreakdown.length > 0) {
      planSnapshot.fees = feesBreakdown.map(fee => ({
        fee_name: fee.fee_name || 'Fee',
        fee_percent: fee.fee_percent || 0,
        application_method: fee.application_method || 'deduct_from_disbursal'
      }));
    }

    const loanData = {
      loan_amount: principal,
      loan_id: loan.id,
      status: loan.status,
      disbursed_at: loan.disbursed_at
    };

    // Ensure planData has all required fields for calculateInterestDays
    // Default repayment_days to 15 if not set (for single payment plans)
    const defaultRepaymentDays = planSnapshot.repayment_days || planSnapshot.total_duration_days || 15;

    const planData = {
      plan_id: planSnapshot.plan_id || null,
      plan_type: planSnapshot.plan_type || 'single',
      repayment_days: defaultRepaymentDays,
      total_duration_days: planSnapshot.total_duration_days || defaultRepaymentDays,
      emi_count: planSnapshot.emi_count || null,
      emi_frequency: planSnapshot.emi_frequency || null,
      interest_percent_per_day: parseFloat(planSnapshot.interest_percent_per_day || loan.interest_percent_per_day || 0.001),
      calculate_by_salary_date: planSnapshot.calculate_by_salary_date === 1 || planSnapshot.calculate_by_salary_date === true || false,
      fees: planSnapshot.fees || []
    };

    // Helper function to parse date without timezone issues
    const parseDateSafe = (dateValue) => {
      if (!dateValue) return new Date();
      const d = new Date(dateValue);
      // Create a new date using UTC values as local values to avoid timezone shift
      return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0);
    };

    // Determine calculation date - use disbursed_at if loan is disbursed, otherwise use today
    const calculationDate = loan.disbursed_at && ['account_manager', 'cleared', 'active'].includes(loan.status)
      ? parseDateSafe(loan.disbursed_at)
      : new Date();
    // Normalize to midnight for consistent date calculations
    calculationDate.setHours(0, 0, 0, 0);

    // Calculate PLANNED loan term days (for due date and loan_term_days) - always use planned term
    const plannedTermCalculationDate = loan.disbursed_at && ['account_manager', 'cleared', 'active'].includes(loan.status)
      ? parseDateSafe(loan.disbursed_at)
      : new Date();
    // Normalize to midnight for consistent date calculations
    plannedTermCalculationDate.setHours(0, 0, 0, 0);
    const plannedTermResult = calculateInterestDays(planData, userData, plannedTermCalculationDate);
    const plannedTermDays = plannedTermResult.days;

    // Use centralized calculation function
    let calculations;
    try {
      calculations = calculateCompleteLoanValues(loanData, planData, userData, {
        calculationDate: calculationDate
      });
    } catch (error) {
      console.error('Error in calculateCompleteLoanValues:', error);
      console.error('Loan Data:', JSON.stringify(loanData, null, 2));
      console.error('Plan Data:', JSON.stringify(planData, null, 2));
      console.error('User Data:', JSON.stringify(userData, null, 2));
      throw error;
    }

    // Extract values for KFS
    // Define emiCount early so it can be used in firstDueDate calculation
    const emiCount = planData.emi_count || 1;
    
    const processingFee = calculations.totals.disbursalFee;
    // For EMI loans, multiply repayable fee GST by EMI count
    const repayableFeeGST = emiCount > 1 
      ? calculations.totals.repayableFeeGST * emiCount 
      : calculations.totals.repayableFeeGST;
    const gst = calculations.totals.disbursalFeeGST + repayableFeeGST;
    const disbAmount = calculations.disbursal.amount;
    const interest = calculations.interest.amount;
    const days = calculations.interest.days;
    const totalRepayable = calculations.total.repayable;

    // Generate first due date from repayment date or calculate using PLANNED term days
    let firstDueDate;
    if (plannedTermResult.repaymentDate) {
      firstDueDate = new Date(plannedTermResult.repaymentDate);
    } else if (calculations.interest.repayment_date) {
      firstDueDate = new Date(calculations.interest.repayment_date);
    } else {
      // Use disbursed date (or today if not disbursed) + planned term days
      const baseDate = loan.disbursed_at ? new Date(loan.disbursed_at) : new Date();
      baseDate.setHours(0, 0, 0, 0);
      firstDueDate = new Date(baseDate);
      firstDueDate.setDate(firstDueDate.getDate() + plannedTermDays);
      firstDueDate.setHours(0, 0, 0, 0);
    }
    firstDueDate.setHours(0, 0, 0, 0);
    
    // For salary-based Multi-EMI loans, ensure firstDueDate matches the salary date
    if (emiCount > 1 && planData.emi_frequency === 'monthly' && planData.calculate_by_salary_date && userData.salary_date) {
      const salaryDate = parseInt(userData.salary_date);
      if (salaryDate >= 1 && salaryDate <= 31) {
        firstDueDate = getSalaryDateForMonth(firstDueDate, salaryDate, 0);
      }
    }

    // Calculate actual loan term days for APR calculation
    // For Multi-EMI loans, calculate from disbursement date to last EMI date
    // For single payment loans, use actual interest calculation days
    let loanTermDaysForAPR = days;  // Default: use interest calculation days
    
    if (emiCount > 1) {
      // Generate last EMI date to calculate actual loan term
      const baseDate = loan.disbursed_at ? new Date(loan.disbursed_at) : new Date();
      baseDate.setHours(0, 0, 0, 0);
      
      let lastEmiDate;
      if (planData.emi_frequency === 'monthly' && planData.calculate_by_salary_date && userData.salary_date) {
        const salaryDate = parseInt(userData.salary_date);
        if (salaryDate >= 1 && salaryDate <= 31) {
          // Use firstDueDate as the base (already calculated from plannedTermResult.repaymentDate)
          // Get last EMI date (emiCount - 1 because first is at index 0)
          lastEmiDate = getSalaryDateForMonth(firstDueDate, salaryDate, emiCount - 1);
        } else {
          // Fallback: use firstDueDate + (emiCount - 1) months
          lastEmiDate = new Date(firstDueDate);
          lastEmiDate.setMonth(lastEmiDate.getMonth() + (emiCount - 1));
        }
      } else {
        // For non-salary date Multi-EMI, calculate based on frequency
        const daysPerEmi = {
          daily: 1,
          weekly: 7,
          biweekly: 14,
          monthly: 30
        };
        const daysBetween = daysPerEmi[planData.emi_frequency] || 30;
        lastEmiDate = new Date(firstDueDate);
        if (planData.emi_frequency === 'monthly') {
          lastEmiDate.setMonth(lastEmiDate.getMonth() + (emiCount - 1));
        } else {
          lastEmiDate.setDate(lastEmiDate.getDate() + ((emiCount - 1) * daysBetween));
        }
        lastEmiDate.setHours(0, 0, 0, 0);
      }
      
      // Calculate actual loan term days from disbursement to last EMI
      if (lastEmiDate) {
        loanTermDaysForAPR = Math.ceil((lastEmiDate - baseDate) / (1000 * 60 * 60 * 24)) + 1;
      }
    }

    // Calculate APR (Annual Percentage Rate)
    // APR = ((All Fees + GST + Interest) / Loan Amount) / Days * 36500
    // For EMI loans, multiply repayable fee by EMI count
    // For Multi-EMI loans, calculate total interest by summing interest for each EMI period
    const repayableFee = emiCount > 1 
      ? calculations.totals.repayableFee * emiCount 
      : calculations.totals.repayableFee;
    
    // For Multi-EMI loans, calculate total interest by summing interest for each EMI period
    // Each EMI period has interest calculated on the outstanding principal for that period
    // Define baseDate for debug logging (used for both single and multi-EMI)
    const baseDate = loan.disbursed_at ? new Date(loan.disbursed_at) : new Date();
    baseDate.setHours(0, 0, 0, 0);
    
    // Initialize emiPeriodDetails for debug logging
    let emiPeriodDetails = [];
    
    let interestForAPR = interest;
    if (emiCount > 1) {
      const interestRatePerDay = calculations.interest.rate_per_day || (interest / (principal * days));
      
      // Generate all EMI dates - recalculate from base date for salary-based loans to ensure accuracy
      let allEmiDates = [];
      if (planData.emi_frequency === 'monthly' && planData.calculate_by_salary_date && userData.salary_date) {
        const salaryDate = parseInt(userData.salary_date);
        if (salaryDate >= 1 && salaryDate <= 31) {
              // For processed loans, use processed_at as base date (per rulebook)
              // For non-processed loans, use disbursed_at
              let baseDateForEmi;
              if (loan.processed_at) {
                // Extract date portion only to avoid timezone issues
                // Handle both string and Date object formats
                let processedDateStr;
                if (typeof loan.processed_at === 'string') {
                  // Handle MySQL datetime format: "2025-12-25 23:19:50" or ISO format: "2025-12-25T23:19:50.000Z"
                  if (loan.processed_at.includes('T')) {
                    processedDateStr = loan.processed_at.split('T')[0];
                  } else if (loan.processed_at.includes(' ')) {
                    processedDateStr = loan.processed_at.split(' ')[0];
                  } else {
                    processedDateStr = loan.processed_at.substring(0, 10);
                  }
                } else if (loan.processed_at instanceof Date) {
                  processedDateStr = loan.processed_at.toISOString().split('T')[0];
                } else {
                  // Fallback: try to convert to Date first
                  const processedDate = new Date(loan.processed_at);
                  processedDateStr = processedDate.toISOString().split('T')[0];
                }
                // Parse date components directly to avoid timezone issues
                // processedDateStr is in format "YYYY-MM-DD"
                const [year, month, day] = processedDateStr.split('-').map(Number);
                baseDateForEmi = new Date(year, month - 1, day); // month is 0-indexed
                console.log(`📅 Using processed_at as base date for EMI calculation: ${processedDateStr}`);
              } else {
                baseDateForEmi = loan.disbursed_at ? new Date(loan.disbursed_at) : new Date();
              }
              baseDateForEmi.setHours(0, 0, 0, 0);
              let nextSalaryDate = getNextSalaryDate(baseDateForEmi, salaryDate);
              
              // Check if duration is less than minimum days
              const minDuration = planData.repayment_days || 15;
              const daysToNextSalary = Math.ceil((nextSalaryDate.getTime() - baseDateForEmi.getTime()) / (1000 * 60 * 60 * 24)) + 1;
              console.log(`📅 EMI Date Calculation: baseDate=${formatDateLocal(baseDateForEmi)}, nextSalaryDate=${formatDateLocal(nextSalaryDate)}, daysToNextSalary=${daysToNextSalary}, minDuration=${minDuration}`);
              if (daysToNextSalary < minDuration) {
                nextSalaryDate = getSalaryDateForMonth(baseDateForEmi, salaryDate, 1);
                console.log(`📅 Moved to next month due to minimum duration: ${formatDateLocal(nextSalaryDate)}`);
              }
          
          // Generate all EMI dates from the first salary date
          for (let i = 0; i < emiCount; i++) {
            const emiDate = getSalaryDateForMonth(nextSalaryDate, salaryDate, i);
            allEmiDates.push(emiDate);
          }
          
          // Debug: Log generated EMI dates
          console.log('📅 Generated EMI Dates:', allEmiDates.map(d => formatDateLocal(d)));
          
          // Update firstDueDate to match the first EMI date for consistency
          firstDueDate = allEmiDates[0];
        }
      } else {
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
      
      // Calculate total interest by summing interest for each EMI period
      if (allEmiDates.length === emiCount) {
        // Calculate principal distribution (handle cases where it doesn't divide evenly)
        // For 3 EMIs: 33.33%, 33.33%, 33.34% (or ₹3,333.33, ₹3,333.33, ₹3,333.34)
        // For 4 EMIs: 25%, 25%, 25%, 25% (or ₹2,500 each)
        const principalPerEmi = Math.floor(principal / emiCount * 100) / 100; // Round to 2 decimals
        const remainder = Math.round((principal - (principalPerEmi * emiCount)) * 100) / 100;
        
        let outstandingPrincipal = principal;
        interestForAPR = 0;
        
        for (let i = 0; i < emiCount; i++) {
          // allEmiDates contains Date objects, ensure we work with Date objects
          const emiDate = allEmiDates[i] instanceof Date ? allEmiDates[i] : new Date(allEmiDates[i]);
          emiDate.setHours(0, 0, 0, 0);
          
          // Calculate days for this EMI period
          // First period (disbursement to first EMI): inclusive, add +1
          // Subsequent periods: start from day AFTER previous EMI date (e.g., 1 Feb if previous was 31 Jan)
          let previousDate;
          if (i === 0) {
            previousDate = new Date(baseDate);
            previousDate.setHours(0, 0, 0, 0);
          } else {
            // Start from day AFTER previous EMI date
            const prevEmiDate = allEmiDates[i - 1] instanceof Date ? allEmiDates[i - 1] : new Date(allEmiDates[i - 1]);
            previousDate = new Date(prevEmiDate);
            previousDate.setDate(previousDate.getDate() + 1);
            previousDate.setHours(0, 0, 0, 0);
          }
          const daysForPeriod = Math.ceil((emiDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          
          // Calculate principal for this EMI (add remainder to last EMI)
          const principalForThisEmi = i === emiCount - 1 
            ? Math.round((principalPerEmi + remainder) * 100) / 100
            : principalPerEmi;
          
          // Calculate interest for this period on outstanding principal
          const interestForPeriod = Math.round(outstandingPrincipal * interestRatePerDay * daysForPeriod * 100) / 100;
          interestForAPR += interestForPeriod;
          
          // Store period details for debugging
          // Note: emiDate is from allEmiDates array which uses corrected dates
          // Use date format for EMI dates
          emiPeriodDetails.push({
            period: i + 1,
            previousDate: formatDateLocal(previousDate),
            emiDate: formatDateLocal(emiDate),
            daysForPeriod,
            outstandingPrincipal: outstandingPrincipal.toFixed(2),
            principalForThisEmi: principalForThisEmi.toFixed(2),
            interestForPeriod: interestForPeriod.toFixed(2),
            interestRatePerDay
          });
          
          // Reduce outstanding principal for next period
          outstandingPrincipal = Math.round((outstandingPrincipal - principalForThisEmi) * 100) / 100;
        }
      }
    }
    
    const totalCharges = processingFee + gst + repayableFee + interestForAPR;
    const apr = loanTermDaysForAPR > 0 ? ((totalCharges / principal) / loanTermDaysForAPR) * 36500 : 0;
    
    // Debug: Log APR calculation details
    console.log('APR Calculation Debug (Admin):', {
      processingFee,
      gst,
      repayableFee,
      interest: interest,
      interestForAPR: interestForAPR,
      totalCharges,
      principal,
      loanTermDaysForAPR,
      interestCalculationDays: days,
      emiCount,
      interestRatePerDay: calculations.interest.rate_per_day || (interest / (principal * days)),
      disbursementDate: baseDate.toISOString().split('T')[0],
      emiPeriodDetails: emiCount > 1 ? emiPeriodDetails : undefined,
      apr: apr.toFixed(2),
      aprCalculation: `((${totalCharges} / ${principal}) / ${loanTermDaysForAPR}) * 36500 = ${apr.toFixed(2)}`
    });

    // Use firstDueDate as dueDate for KFS data
    const dueDate = firstDueDate;

    // Prepare KFS data
    const kfsData = {
      // Company Information
      company: {
        name: 'Pocket Credit Private Limited',
        cin: 'U65999DL2024PTC123456', // Update with actual CIN
        rbi_registration: 'B-14.03456', // Update with actual RBI registration
        registered_office: 'Plot No. 123, Sector 18, Gurugram, Haryana 122015',
        address: 'Plot No. 123, Sector 18, Gurugram, Haryana 122015',
        phone: '+91 9876543210',
        email: 'support@pocketcredit.in',
        website: 'www.pocketcredit.in',
        jurisdiction: 'Gurugram, Haryana'
      },

      // Loan Details
      loan: {
        id: loan.id,
        application_number: loan.application_number,
        type: loan.loan_purpose || 'Personal Loan',
        sanctioned_amount: principal,
        disbursed_amount: disbAmount,
        loan_term_days: (() => {
          // Calculate loan term days based on EMI count for EMI loans
          const emiCount = planData.emi_count || null;
          if (emiCount && emiCount > 1) {
            // EMI loan: calculate days based on EMI count
            // Formula: 165 + (emi_count - 1) * 30
            // 1 EMI: 165 days, 2 EMI: 195 days, 3 EMI: 225 days, 4 EMI: 255 days, etc.
            return 165 + (emiCount - 1) * 30;
          }
          // Single payment loan: always show 165 days (base + 4 extensions possible)
          return 165;
        })(),
        status: loan.status,
        created_at: loan.created_at,
        applied_date: loan.created_at,
        approved_date: loan.approved_at,
        disbursed_date: loan.disbursed_at,
        due_date: formatDateLocal(dueDate),
        emi_count: planData.emi_count || null
      },

      // Borrower Details
      borrower: {
        name: `${loan.first_name} ${loan.last_name || ''}`.trim(),
        father_name: 'N/A', // Column doesn't exist yet
        mother_name: 'N/A', // Column doesn't exist yet
        email: loan.email,
        phone: loan.phone,
        date_of_birth: loan.date_of_birth,
        gender: loan.gender || 'N/A',
        marital_status: loan.marital_status || 'N/A',
        pan_number: 'N/A', // Column doesn't exist yet
        aadhar_number: 'N/A', // Column doesn't exist yet
        address: {
          line1: address.address_line1 || 'N/A',
          line2: address.address_line2 || '',
          city: address.city || 'N/A',
          state: address.state || 'N/A',
          pincode: address.pincode || 'N/A',
          country: address.country || 'India'
        },
        employment: {
          type: employmentDetails.employment_type || 'N/A',
          company: employmentDetails.company_name || 'N/A',
          designation: employmentDetails.designation || 'N/A',
          monthly_income: getMonthlyIncomeFromRange(employmentDetails.income_range)
        }
      },

      // Interest & Charges
      interest: {
        rate_per_day: calculations.interest.rate_per_day,
        rate_type: calculations.interest.calculation_method === 'salary_date' ? 'Salary Date Based' : 'Fixed',
        total_interest: emiCount > 1 ? interestForAPR : interest,
        calculation_days: days
      },

      // Fees & Charges (dynamic fees support with GST)
      fees: {
        processing_fee: processingFee,
        processing_fee_percent: null, // Using dynamic fees
        gst: gst,
        gst_percent: 18,
        total_upfront_charges: processingFee + calculations.totals.disbursalFeeGST,
        fees_breakdown: [
          ...calculations.fees.deductFromDisbursal.map(fee => ({
            fee_name: fee.fee_name,
            fee_percent: fee.fee_percent,
            fee_amount: fee.fee_amount,
            gst_amount: fee.gst_amount,
            total_with_gst: fee.total_with_gst,
            application_method: 'deduct_from_disbursal'
          })),
          ...calculations.fees.addToTotal.map(fee => ({
            // Fee amounts are already multiplied by EMI count in loanCalculations.js
            fee_name: fee.fee_name,
            fee_percent: fee.fee_percent,
            fee_amount: fee.fee_amount,
            gst_amount: fee.gst_amount,
            total_with_gst: fee.total_with_gst,
            application_method: 'add_to_total',
            amount: fee.fee_amount
          }))
        ],
        total_deduct_from_disbursal: calculations.totals.disbursalFee,
        // Totals are already multiplied by EMI count in loanCalculations.js
        total_add_to_total: calculations.totals.repayableFee,
        gst_on_deduct_from_disbursal: calculations.totals.disbursalFeeGST,
        gst_on_add_to_total: calculations.totals.repayableFeeGST
      },

      // Calculations
      calculations: {
        principal: principal,
        processing_fee: processingFee,
        gst: gst,
        disbursed_amount: disbAmount,
        interest: emiCount > 1 ? interestForAPR : interest,
        total_repayable: totalRepayable,
        apr: parseFloat(apr.toFixed(2))
      },

      // Repayment Schedule
      repayment: (() => {
        const emiCount = planData.emi_count || null;
        const isMultiEmi = emiCount && emiCount > 1;
        
        // Generate all EMI dates for Multi-EMI plans
        let allEmiDates = [];
        if (isMultiEmi && planData.emi_frequency === 'monthly' && planData.calculate_by_salary_date && userData.salary_date) {
          const salaryDate = parseInt(userData.salary_date);
          if (salaryDate >= 1 && salaryDate <= 31) {
            // For processed loans, use processed_at as base date (per rulebook)
            // For non-processed loans, use disbursed_at
            let baseDate;
            if (loan.processed_at) {
              // Extract date portion only to avoid timezone issues
              // Handle both string and Date object formats
              let processedDateStr;
                if (typeof loan.processed_at === 'string') {
                  // Handle MySQL datetime format: "2025-12-25 23:19:50" or ISO format: "2025-12-25T23:19:50.000Z"
                  if (loan.processed_at.includes('T')) {
                    processedDateStr = loan.processed_at.split('T')[0];
                  } else if (loan.processed_at.includes(' ')) {
                    processedDateStr = loan.processed_at.split(' ')[0];
                  } else {
                    processedDateStr = loan.processed_at.substring(0, 10);
                  }
                } else if (loan.processed_at instanceof Date) {
                processedDateStr = loan.processed_at.toISOString().split('T')[0];
              } else {
                // Fallback: try to convert to Date first
                const processedDate = new Date(loan.processed_at);
                processedDateStr = processedDate.toISOString().split('T')[0];
              }
              // Parse date components directly to avoid timezone issues
              // processedDateStr is in format "YYYY-MM-DD"
              const [year, month, day] = processedDateStr.split('-').map(Number);
              baseDate = new Date(year, month - 1, day); // month is 0-indexed
              console.log(`📅 Using processed_at as base date for EMI calculation: ${processedDateStr}`);
            } else {
              baseDate = loan.disbursed_at ? new Date(loan.disbursed_at) : new Date();
            }
            baseDate.setHours(0, 0, 0, 0);
            let nextSalaryDate = getNextSalaryDate(baseDate, salaryDate);
            
            // Check if duration is less than minimum days
            const minDuration = planData.repayment_days || 15;
            const daysToNextSalary = Math.ceil((nextSalaryDate.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            console.log(`📅 EMI Date Calculation: baseDate=${formatDateLocal(baseDate)}, nextSalaryDate=${formatDateLocal(nextSalaryDate)}, daysToNextSalary=${daysToNextSalary}, minDuration=${minDuration}`);
            if (daysToNextSalary < minDuration) {
              nextSalaryDate = getSalaryDateForMonth(nextSalaryDate, salaryDate, 1);
              console.log(`📅 Moved to next month due to minimum duration: ${formatDateLocal(nextSalaryDate)}`);
            }
            
            // Generate all EMI dates from the first salary date
            for (let i = 0; i < emiCount; i++) {
              const emiDate = getSalaryDateForMonth(nextSalaryDate, salaryDate, i);
              allEmiDates.push(formatDateLocal(emiDate));
            }
            
            // Debug: Log all generated EMI dates for repayment schedule
            console.log('📅 Repayment Schedule - All EMI Dates:', allEmiDates);
          }
        } else if (isMultiEmi) {
          // For non-salary date Multi-EMI, calculate based on frequency
          const baseDate = dueDate;
          const daysPerEmi = {
            daily: 1,
            weekly: 7,
            biweekly: 14,
            monthly: 30
          };
          const daysBetween = daysPerEmi[planData.emi_frequency] || 30;
          
          for (let i = 0; i < emiCount; i++) {
            const emiDate = new Date(baseDate);
            if (planData.emi_frequency === 'monthly') {
              emiDate.setMonth(emiDate.getMonth() + i);
            } else {
              emiDate.setDate(emiDate.getDate() + (i * daysBetween));
            }
            emiDate.setHours(0, 0, 0, 0);
            allEmiDates.push(formatDateLocal(emiDate));
          }
        } else {
          // Single payment loan
          allEmiDates = [formatDateLocal(dueDate)];
        }

        // Generate repayment schedule with all installments
        let schedule = [];
        
        if (isMultiEmi && allEmiDates.length === emiCount) {
          // For Multi-EMI loans, generate schedule with all installments
          const interestRatePerDay = calculations.interest.rate_per_day || (interest / (principal * days));
          const principalPerEmi = Math.floor(principal / emiCount * 100) / 100;
          const remainder = Math.round((principal - (principalPerEmi * emiCount)) * 100) / 100;
          const postServiceFeePerEmi = calculations.totals.repayableFee || 0;
          const postServiceFeeGSTPerEmi = calculations.totals.repayableFeeGST || 0;
          
          let outstandingPrincipal = principal;
          const baseDateForSchedule = loan.disbursed_at ? new Date(loan.disbursed_at) : new Date();
          baseDateForSchedule.setHours(0, 0, 0, 0);
          
          for (let i = 0; i < emiCount; i++) {
            // Get EMI date (handle both Date objects and strings)
            const emiDateStr = allEmiDates[i];
            const emiDate = emiDateStr instanceof Date ? new Date(emiDateStr) : new Date(emiDateStr);
            emiDate.setHours(0, 0, 0, 0);
            
            // Calculate days for this period
            let previousDate;
            if (i === 0) {
              previousDate = new Date(baseDateForSchedule);
            } else {
              const prevEmiDateStr = allEmiDates[i - 1];
              const prevEmiDate = prevEmiDateStr instanceof Date ? new Date(prevEmiDateStr) : new Date(prevEmiDateStr);
              previousDate = new Date(prevEmiDate);
              previousDate.setDate(previousDate.getDate() + 1);
              previousDate.setHours(0, 0, 0, 0);
            }
            
            const daysForPeriod = Math.ceil((emiDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            
            // Calculate principal for this EMI
            const principalForThisEmi = i === emiCount - 1 
              ? Math.round((principalPerEmi + remainder) * 100) / 100
              : principalPerEmi;
            
            // Calculate interest for this period
            const interestForPeriod = Math.round(outstandingPrincipal * interestRatePerDay * daysForPeriod * 100) / 100;
            
            // Calculate installment amount (principal + interest + post service fee + GST)
            const instalmentAmount = Math.round((principalForThisEmi + interestForPeriod + postServiceFeePerEmi + postServiceFeeGSTPerEmi) * 100) / 100;
            
            schedule.push({
              instalment_no: i + 1,
              outstanding_principal: Math.round(outstandingPrincipal * 100) / 100,
              principal: principalForThisEmi,
              interest: interestForPeriod,
              post_service_fee: postServiceFeePerEmi,
              gst_on_post_service_fee: postServiceFeeGSTPerEmi,
              instalment_amount: instalmentAmount,
              due_date: formatDateLocal(emiDate) // Use local date format without timezone conversion
            });
            
            // Reduce outstanding principal for next period
            outstandingPrincipal = Math.round((outstandingPrincipal - principalForThisEmi) * 100) / 100;
          }
        } else {
          // Single payment loan
          const postServiceFee = calculations.totals.repayableFee || 0;
          const postServiceFeeGST = calculations.totals.repayableFeeGST || 0;
          schedule.push({
            instalment_no: 1,
            outstanding_principal: principal,
            principal: principal,
            interest: interest,
            post_service_fee: postServiceFee,
            gst_on_post_service_fee: postServiceFeeGST,
            instalment_amount: totalRepayable,
            due_date: formatDateLocal(dueDate)
          });
        }

        return {
          type: isMultiEmi ? 'EMI' : 'Bullet Payment',
          number_of_instalments: isMultiEmi ? emiCount : 1,
          instalment_amount: isMultiEmi ? schedule[0]?.instalment_amount || (totalRepayable / emiCount) : totalRepayable,
          first_due_date: schedule.length > 0 ? schedule[0].due_date : formatDateLocal(dueDate),
          all_emi_dates: allEmiDates,
          schedule: schedule
        };
      })(),

      // Penal Charges (with 18% GST)
      penal_charges: {
        late_payment_fee: '4% of overdue principal + 18% GST (one-time on first day)',
        daily_penalty: '0.2% of overdue principal + 18% GST per day (from second day onwards)',
        post_due_interest: `${calculations.interest.rate_per_day}% per day on principal overdue`,
        foreclosure_charges: 'Zero foreclosure charges',
        gst_on_penalties: 18,
        note: 'All penalty charges are subject to 18% GST'
      },

      // Grievance Redressal
      grievance: {
        nodal_officer: {
          name: 'Mr.Kiran',
          phone: '+91 9573794121',
          email: 'Kiran@pocketcredit.in'
        },
        escalation: {
          name: 'Ms. Priya Sharma',
          designation: 'Chief Compliance Officer',
          phone: '+91 9876543211',
          email: 'compliance@pocketcredit.in'
        }
      },

      // Digital Loan Specific
      digital_loan: {
        cooling_off_period: '3 days',
        lsp_list_url: 'https://pocketcredit.in/lsp',
        payment_method: 'Digital payment through app or payment link'
      },

      // Additional Info
      additional: {
        loan_transferable: 'Yes',
        co_lending: 'No',
        recovery_clause: '7',
        grievance_clause: '8.3'
      },

      // Generated metadata
      generated_at: new Date().toISOString(),
      generated_by: req.admin?.id || 'system',

      // Signature data (if agreement is signed)
      signature: (() => {
        if (loan.clickwrap_signed_at && loan.clickwrap_webhook_data) {
          try {
            const webhookData = typeof loan.clickwrap_webhook_data === 'string' 
              ? JSON.parse(loan.clickwrap_webhook_data) 
              : loan.clickwrap_webhook_data;
            
            return {
              signed_at: loan.clickwrap_signed_at,
              signers_info: webhookData['signers-info'] || webhookData.signersInfo || []
            };
          } catch (e) {
            console.error('Error parsing clickwrap_webhook_data:', e);
            return null;
          }
        }
        return null;
      })()
    };

    // For multi-EMI loans, update interest amount and total repayable to sum from schedule
    if (kfsData.repayment.schedule && Array.isArray(kfsData.repayment.schedule) && kfsData.repayment.schedule.length > 1) {
      const totalInterestFromSchedule = kfsData.repayment.schedule.reduce((sum, emi) => sum + (emi.interest || 0), 0);
      const totalRepayableFromSchedule = kfsData.repayment.schedule.reduce((sum, emi) => sum + (emi.instalment_amount || 0), 0);
      kfsData.interest.amount = totalInterestFromSchedule;
      kfsData.calculations.total_repayable = totalRepayableFromSchedule;
      console.log(`📊 Multi-EMI loan: Updated interest: ₹${totalInterestFromSchedule}, total repayable: ₹${totalRepayableFromSchedule}`);
    }

    console.log('✅ KFS data generated successfully');

    // If loan is processed and has PDF, return PDF URL
    if (loan.processed_at && loan.kfs_pdf_url) {
      const { getPresignedUrl } = require('../services/s3Service');
      try {
        const pdfUrl = await getPresignedUrl(loan.kfs_pdf_url, 7 * 24 * 60 * 60); // 7 days
        return res.json({
          success: true,
          data: kfsData,
          pdf_url: pdfUrl,
          is_processed: true
        });
      } catch (error) {
        console.error('Error getting presigned URL for KFS PDF:', error);
        // Continue with normal response
      }
    }

    res.json({
      success: true,
      data: kfsData
    });

  } catch (error) {
    console.error('❌ Error generating KFS:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate KFS',
      error: error.message
    });
  }
});

/**
 * POST /api/kfs/:loanId/generate-pdf
 * Generate and download PDF for KFS
 */
router.post('/:loanId/generate-pdf', authenticateAdmin, async (req, res) => {
  try {
    const { loanId } = req.params;
    const { htmlContent } = req.body;

    if (!htmlContent) {
      return res.status(400).json({
        success: false,
        message: 'HTML content is required'
      });
    }

    console.log('📄 Generating PDF for loan ID:', loanId);

    // Get loan data for filename
    const db = await initializeDatabase();
    const [loans] = await db.execute(
      'SELECT application_number FROM loan_applications WHERE id = ?',
      [loanId]
    );

    if (!loans || loans.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      });
    }

    const applicationNumber = loans[0].application_number;
    const filename = `KFS_${applicationNumber}.pdf`;

    // Generate PDF
    const pdfResult = await pdfService.generateKFSPDF(htmlContent, filename);

    console.log('📤 Sending PDF, size:', pdfResult.buffer.length, 'bytes');

    // Set headers for download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfResult.buffer.length);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Accept-Ranges', 'bytes');

    // Send PDF buffer directly
    res.end(pdfResult.buffer, 'binary');

    console.log('✅ PDF sent successfully');

  } catch (error) {
    console.error('❌ Error generating PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate PDF',
      error: error.message
    });
  }
});

/**
 * POST /api/kfs/:loanId/email-pdf
 * Generate PDF and send via email
 */
router.post('/:loanId/email-pdf', authenticateAdmin, async (req, res) => {
  try {
    const { loanId } = req.params;
    const { htmlContent, recipientEmail, recipientName } = req.body;

    if (!htmlContent) {
      return res.status(400).json({
        success: false,
        message: 'HTML content is required'
      });
    }

    console.log('📧 Generating and emailing PDF for loan ID:', loanId);

    // Get loan data
    const db = await initializeDatabase();
    const [loans] = await db.execute(`
      SELECT 
        la.id, la.application_number, la.loan_amount, la.status,
        u.email, u.first_name, u.last_name
      FROM loan_applications la
      INNER JOIN users u ON la.user_id = u.id
      WHERE la.id = ?
    `, [loanId]);

    if (!loans || loans.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      });
    }

    const loan = loans[0];
    const filename = `KFS_${loan.application_number}.pdf`;

    // Generate PDF
    const pdfResult = await pdfService.generateKFSPDF(htmlContent, filename);

    // Prepare email data
    const emailRecipient = recipientEmail || loan.email;
    const emailName = recipientName || `${loan.first_name} ${loan.last_name}`;

    // Send email
    const emailResult = await emailService.sendKFSEmail({
      loanId: loan.id,
      recipientEmail: emailRecipient,
      recipientName: emailName,
      loanData: {
        application_number: loan.application_number,
        sanctioned_amount: loan.loan_amount,
        loan_term_days: 30, // Default or fetch from plan
        status: loan.status
      },
      pdfBuffer: pdfResult.buffer,
      pdfFilename: filename,
      sentBy: req.admin?.id
    });

    res.json({
      success: true,
      message: 'PDF generated and email sent successfully',
      data: {
        emailSent: true,
        recipientEmail: emailRecipient,
        messageId: emailResult.messageId
      }
    });

    console.log('✅ PDF emailed successfully');

  } catch (error) {
    console.error('❌ Error emailing PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send email',
      error: error.message
    });
  }
});

/**
 * GET /api/kfs/:loanId/email-history
 * Get email history for a loan
 */
router.get('/:loanId/email-history', authenticateAdmin, async (req, res) => {
  try {
    const { loanId } = req.params;

    const history = await emailService.getEmailHistory(loanId);

    res.json({
      success: true,
      data: history
    });

  } catch (error) {
    console.error('❌ Error fetching email history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch email history',
      error: error.message
    });
  }
});

module.exports = router;

