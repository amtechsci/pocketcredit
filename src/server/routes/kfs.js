const express = require('express');
const router = express.Router();
const { authenticateAdmin } = require('../middleware/auth');
const { requireAuth } = require('../middleware/jwtAuth');
const { initializeDatabase, executeQuery } = require('../config/database');
const { calculateLoanValues, calculateTotalDays, calculateCompleteLoanValues, calculateInterestDays, getNextSalaryDate, getSalaryDateForMonth, parseDateToString, getTodayString, calculateDaysBetween, formatDateToString } = require('../utils/loanCalculations');
const pdfService = require('../services/pdfService');
const emailService = require('../services/emailService');
const { uploadGeneratedPDF } = require('../services/s3Service');

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
    // Use DATE() function to extract date portion directly from MySQL (avoids timezone conversion)
    const fullLoans = await executeQuery(`
      SELECT 
        la.*,
        DATE(la.processed_at) as processed_at_date,
        DATE(la.disbursed_at) as disbursed_at_date,
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
        la.emi_schedule,
        la.last_calculated_at,
        la.user_id,
        u.first_name, u.last_name, u.email, u.personal_email, u.official_email, u.phone, u.date_of_birth,
        u.gender, u.marital_status, u.pan_number
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

    // Get KYC verification data for masked Aadhar number
    let maskedAadharNumber = 'N/A';
    try {
      const kycVerifications = await executeQuery(`
        SELECT verification_data 
        FROM kyc_verifications 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT 1
      `, [loan.user_id]);

      if (kycVerifications && kycVerifications.length > 0) {
        const verificationData = kycVerifications[0].verification_data;
        let kycData = typeof verificationData === 'string' ? JSON.parse(verificationData) : verificationData;
        
        // Try to get masked Aadhar from various possible locations in the JSON structure
        maskedAadharNumber = kycData?.kycData?.maskedAdharNumber || 
                             kycData?.maskedAdharNumber || 
                             kycData?.masked_adhar_number ||
                             kycData?.uid ||
                             'N/A';
      }
    } catch (kycError) {
      console.error('Error fetching KYC verification for Aadhar:', kycError);
      // Continue with 'N/A' if KYC data not found
    }

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
    // Try to get bank details from user_bank_id first, then fallback to primary bank details
    let bankDetails = null;
    try {
      if (loan.user_bank_id) {
    const bankDetailsQuery = await executeQuery(`
      SELECT bd.* FROM bank_details bd
          WHERE bd.id = ?
      LIMIT 1
        `, [loan.user_bank_id]);
        bankDetails = bankDetailsQuery && bankDetailsQuery.length > 0 ? bankDetailsQuery[0] : null;
      }
      
      // If no bank details from user_bank_id, try to get primary bank details
      if (!bankDetails) {
        const primaryBankQuery = await executeQuery(`
          SELECT bd.* FROM bank_details bd
          WHERE bd.user_id = ? AND bd.is_primary = 1
          LIMIT 1
        `, [loan.user_id]);
        bankDetails = primaryBankQuery && primaryBankQuery.length > 0 ? primaryBankQuery[0] : null;
      }
    } catch (bankError) {
      console.error('Error fetching bank details:', bankError);
      // Continue without bank details - set to null
      bankDetails = null;
    }

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

    // Parse fees_breakdown for user endpoint (early parsing for fee validation)
    let userFeesBreakdown = [];
    if (loan.fees_breakdown) {
      try {
        const parsedFees = typeof loan.fees_breakdown === 'string'
          ? JSON.parse(loan.fees_breakdown)
          : loan.fees_breakdown;
        userFeesBreakdown = parsedFees.map(fee => ({
          fee_name: fee.fee_name || fee.name,
          fee_percent: fee.fee_percent || fee.percent,
          amount: fee.amount,
          application_method: fee.application_method
        }));
      } catch (e) {
        console.error('Error parsing fees_breakdown:', e);
        userFeesBreakdown = [];
      }
    }

    // Get fees from planSnapshot or loanPlan, and fix application_method
    let fees = planSnapshot.fees || loanPlan.fees || [];
    const principal = loan.sanctioned_amount || loan.principal_amount || loan.loan_amount || 0;

    // If fees are missing or empty, try to populate from fees_breakdown or loan_plan_fees
    if (!fees || !Array.isArray(fees) || fees.length === 0) {
      if (userFeesBreakdown && userFeesBreakdown.length > 0) {
        fees = userFeesBreakdown.map(fee => {
          let feePercent = fee.fee_percent || fee.percent;
          if (!feePercent && fee.amount && principal > 0) {
            feePercent = (fee.amount / principal) * 100;
          }
          return {
            fee_name: fee.fee_name || fee.name || 'Fee',
            fee_percent: feePercent || 0,
            application_method: fee.application_method || 'deduct_from_disbursal'
          };
        });
      } else if (loan.loan_plan_id) {
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
            fees = planFees.map(pf => ({
              fee_name: pf.fee_name || 'Fee',
              fee_percent: parseFloat(pf.fee_percent || 0),
              application_method: pf.application_method || 'deduct_from_disbursal'
            }));
          }
        } catch (feeError) {
          console.error(`Error fetching fees from loan_plan_fees for loan #${loanId}:`, feeError);
        }
      }
    } else {
      // Fees exist but may be missing application_method - fix them
      const feesNeedFixing = fees.some(fee => !fee.application_method);
      if (feesNeedFixing) {
        if (userFeesBreakdown && userFeesBreakdown.length > 0) {
          fees = fees.map(fee => {
            const matchingFee = userFeesBreakdown.find(bf => 
              (bf.fee_name === fee.fee_name || bf.name === fee.fee_name)
            );
            let feePercent = fee.fee_percent;
            if (!feePercent && matchingFee?.amount && principal > 0) {
              feePercent = (matchingFee.amount / principal) * 100;
            }
            return {
              ...fee,
              fee_percent: feePercent || fee.fee_percent || 0,
              application_method: fee.application_method || matchingFee?.application_method || 'deduct_from_disbursal'
            };
          });
        } else if (loan.loan_plan_id) {
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
              fees = fees.map(fee => {
                const matchingFee = planFees.find(pf => pf.fee_name === fee.fee_name);
                return {
                  ...fee,
                  application_method: fee.application_method || matchingFee?.application_method || 'deduct_from_disbursal'
                };
              });
            }
          } catch (feeError) {
            console.error(`Error fetching fees from loan_plan_fees for loan #${loanId}:`, feeError);
          }
        }
      }
      
      // Validate and correct application_method based on fee name
      fees = fees.map(fee => {
        const feeNameLower = fee.fee_name?.toLowerCase() || '';
        let correctMethod = fee.application_method;
        
        if (feeNameLower.includes('post service')) {
          if (fee.application_method !== 'add_to_total') {
            correctMethod = 'add_to_total';
          }
        } else {
          if (!fee.application_method || fee.application_method !== 'deduct_from_disbursal') {
            correctMethod = 'deduct_from_disbursal';
          }
        }
        
        return {
          ...fee,
          application_method: correctMethod
        };
      });
    }

    const planData = {
      plan_id: planSnapshot.plan_id || loanPlan.id || null,
      plan_type: planSnapshot.plan_type || loanPlan.plan_type || 'single',
      repayment_days: defaultRepaymentDays,
      total_duration_days: planSnapshot.total_duration_days || loanPlan.total_duration_days || defaultRepaymentDays,
      emi_count: planSnapshot.emi_count || loanPlan.emi_count || null,
      emi_frequency: planSnapshot.emi_frequency || loanPlan.emi_frequency || null,
      interest_percent_per_day: parseFloat(planSnapshot.interest_percent_per_day || loanPlan.interest_percent_per_day || loan.interest_percent_per_day || 0.001),
      calculate_by_salary_date: planSnapshot.calculate_by_salary_date === 1 || planSnapshot.calculate_by_salary_date === true || loanPlan.calculate_by_salary_date === 1 || false,
      fees: fees
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
    // Use string-based date calculation to avoid timezone conversion
    let actualExhaustedDays = null;
    if (useActualDays && loan.processed_at && ['account_manager', 'cleared', 'active'].includes(loan.status)) {
      // For processed loans, use processed_at as per rulebook
      const processedDateStr = parseDateToString(loan.processed_at);
      const currentDateStr = getTodayString();
      if (processedDateStr) {
        actualExhaustedDays = calculateDaysBetween(processedDateStr, currentDateStr);
        // Ensure at least 1 day
        if (actualExhaustedDays < 1) {
        actualExhaustedDays = 1;
      }
        console.log(`📅 Using actual exhausted days: ${actualExhaustedDays} (from processed_at ${processedDateStr} to ${currentDateStr})`);
      }
    } else if (useActualDays && loan.disbursed_at && ['account_manager', 'cleared', 'active', 'disbursal'].includes(loan.status)) {
      // Fallback to disbursed_at if processed_at not available (shouldn't happen for processed loans)
      const disbursedDateStr = parseDateToString(loan.disbursed_at);
      const currentDateStr = getTodayString();
      if (disbursedDateStr) {
        actualExhaustedDays = calculateDaysBetween(disbursedDateStr, currentDateStr);
        if (actualExhaustedDays < 1) {
          actualExhaustedDays = 1;
        }
        console.log(`📅 Using actual exhausted days: ${actualExhaustedDays} (from disbursed_at ${disbursedDateStr} to ${currentDateStr})`);
      }
    } else {
      console.log(`📅 Using planned repayment days (for KFS/Agreement documents)`);
    }

    // Calculate PLANNED loan term days (for due date calculation) - always use planned term, not exhausted days
    // This should be calculated from the disbursement date (or today if not disbursed) using the plan
    // Use string-based date parsing to avoid timezone conversion
    const plannedTermCalculationDateStr = loan.disbursed_at && ['account_manager', 'cleared', 'active', 'disbursal'].includes(loan.status)
      ? parseDateToString(loan.disbursed_at)  // Use disbursed date for planned term calculation (as string)
      : getTodayString();  // Use today for pending loans
    const plannedTermResult = calculateInterestDays(planData, userData, plannedTermCalculationDateStr);
    const plannedTermDays = plannedTermResult.days;

    // KFS should show the original planned loan terms for documents, but actual days for repayment schedule
    // IMPORTANT: For "Pay on Due Date" total amount, we need planned term days, not exhausted days
    // useActualDays should only affect the repayment schedule display, not the total amount calculation
    // Use string-based date parsing to avoid timezone conversion
    // For processed loans, use processed_at; otherwise use disbursed_at
    let calculationDateForOptionsStr;
    if (loan.processed_at && ['account_manager', 'cleared'].includes(loan.status)) {
      // For processed loans, use processed_at_date (from SQL DATE() function) to avoid timezone issues
      // MySQL DATE() returns as Date object, so we need to parse it using UTC getters
      if (loan.processed_at_date) {
        if (typeof loan.processed_at_date === 'string') {
          calculationDateForOptionsStr = loan.processed_at_date;
        } else if (loan.processed_at_date instanceof Date) {
          // MySQL DATE() returns as Date object - use UTC getters to avoid timezone conversion
          const year = loan.processed_at_date.getUTCFullYear();
          const month = String(loan.processed_at_date.getUTCMonth() + 1).padStart(2, '0');
          const day = String(loan.processed_at_date.getUTCDate()).padStart(2, '0');
          calculationDateForOptionsStr = `${year}-${month}-${day}`;
        } else {
          calculationDateForOptionsStr = parseDateToString(loan.processed_at) || getTodayString();
        }
      } else {
        calculationDateForOptionsStr = parseDateToString(loan.processed_at) || getTodayString();
      }
    } else {
      calculationDateForOptionsStr = getTodayString();  // Use today for pending loans
    }
    const calculationOptions = {
      calculationDate: calculationDateForOptionsStr,  // Pass string, not Date object
      // DON'T use customDays (actualExhaustedDays) for total amount calculation
      // This ensures "Pay on Due Date" uses planned term days (41 days), not exhausted days (1-2 days)
      // customDays: null  // Let it calculate using planned term days
    };

    // For processed loans, use processed_interest from database (updated by cron) if available
    // If processed_interest is null, calculate it using the correct date handling
    // Per rulebook: For processed loans, use processed_* values, not live calculations
    let loanValues;
    if (loan.processed_at && useActualDays) {
      // Use processed data for processed loans
      const processedPrincipal = parseFloat(loan.processed_amount || loanData.loan_amount || 0);
      const processedInterest = loan.processed_interest !== null && loan.processed_interest !== undefined 
        ? parseFloat(loan.processed_interest) 
        : null; // Don't default to 0, use null to indicate it should be calculated
      const processedPenalty = parseFloat(loan.processed_penalty || 0);
      
      // Calculate loan values (this will calculate interest correctly with fixed date handling)
      loanValues = calculateCompleteLoanValues(loanData, planData, userData, calculationOptions);
      
      // IMPORTANT: For "Pay on Due Date" total amount, we MUST keep planned term days (41 days)
      // Don't override interest.days with exhausted days - that would cause wrong total amount
      // Exhausted days are only for display, not for total amount calculation
      if (loanValues.interest) {
        // Calculate days from processed_at to today for display only
        const processedDateStr = parseDateToString(loan.processed_at);
        const todayStr = getTodayString();
        const daysFromProcessed = processedDateStr ? calculateDaysBetween(processedDateStr, todayStr) : 1;
        
        // Store exhausted days for display, but DON'T override interest.days (keep planned term days)
        loanValues.interest.exhaustedDays = daysFromProcessed;
        
        // Only use processed_interest if it exists and is valid, but keep planned term days
        if (processedInterest !== null && processedInterest > 0) {
          // For display: show processed_interest, but total amount should still use planned term interest
          console.log(`📊 processed_interest: ₹${processedInterest} (exhausted days: ${daysFromProcessed}), but total uses planned term: ₹${loanValues.interest.amount} (${loanValues.interest.days} days)`);
        } else {
          // processed_interest is null, use calculated interest with planned term days
          console.log(`📊 Using calculated interest with planned term days: ₹${loanValues.interest.amount} (${loanValues.interest.days} days), exhausted days: ${daysFromProcessed}`);
        }
        // CRITICAL: Don't override loanValues.interest.days - keep planned term days for total amount calculation
      }
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
    // Extract baseDate as string for interest calculation and schedule generation (avoids timezone issues)
    // This needs to be at a high scope so it's accessible in both calculations and schedule sections
    let baseDateStr;
    if (loan.processed_at && ['account_manager', 'cleared'].includes(loan.status)) {
      // Use processed_at_date if available (from SQL DATE() - no timezone conversion)
      if (loan.processed_at_date) {
        if (typeof loan.processed_at_date === 'string') {
          baseDateStr = loan.processed_at_date;
        } else if (loan.processed_at_date instanceof Date) {
          const year = loan.processed_at_date.getUTCFullYear();
          const month = String(loan.processed_at_date.getUTCMonth() + 1).padStart(2, '0');
          const day = String(loan.processed_at_date.getUTCDate()).padStart(2, '0');
          baseDateStr = `${year}-${month}-${day}`;
        } else {
          baseDateStr = parseDateToString(loan.processed_at) || getTodayString();
        }
      } else {
        baseDateStr = parseDateToString(loan.processed_at) || getTodayString();
      }
    } else {
      if (loan.disbursed_at_date) {
        if (typeof loan.disbursed_at_date === 'string') {
          baseDateStr = loan.disbursed_at_date;
        } else if (loan.disbursed_at_date instanceof Date) {
          const year = loan.disbursed_at_date.getUTCFullYear();
          const month = String(loan.disbursed_at_date.getUTCMonth() + 1).padStart(2, '0');
          const day = String(loan.disbursed_at_date.getUTCDate()).padStart(2, '0');
          baseDateStr = `${year}-${month}-${day}`;
        } else {
          baseDateStr = parseDateToString(loan.disbursed_at) || getTodayString();
        }
      } else {
        baseDateStr = parseDateToString(loan.disbursed_at) || getTodayString();
      }
    }
    
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
        email: loan.personal_email || loan.official_email || loan.email || 'N/A',
        phone: loan.phone || 'N/A',
        date_of_birth: loan.date_of_birth ? new Date(loan.date_of_birth).toLocaleDateString('en-IN') : 'N/A',
        gender: loan.gender || 'N/A',
        marital_status: loan.marital_status || 'N/A',
        pan_number: loan.pan_number || 'N/A',
        aadhar_number: maskedAadharNumber,
        pan: loan.pan_number || 'N/A',
        aadhar: maskedAadharNumber,
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
        // For processed loans, use processed_at as base date; otherwise use disbursed_at
        // This must match the base date used for EMI date generation
        let baseDate;
        if (loan.processed_at && ['account_manager', 'cleared'].includes(loan.status)) {
          // Use processed_at_date if available (from SQL DATE() function), otherwise parse
          // MySQL DATE() returns as Date object, so we need to handle both string and Date
          if (loan.processed_at_date) {
            if (typeof loan.processed_at_date === 'string') {
              const [year, month, day] = loan.processed_at_date.split('-').map(Number);
              baseDate = new Date(year, month - 1, day);
            } else if (loan.processed_at_date instanceof Date) {
              // MySQL DATE() returns as Date object - extract UTC components and create Date in UTC
              // This ensures the Date represents the same calendar date regardless of server timezone
              const year = loan.processed_at_date.getUTCFullYear();
              const month = loan.processed_at_date.getUTCMonth();
              const day = loan.processed_at_date.getUTCDate();
              // Use Date.UTC() to create Date in UTC, matching the original date
              baseDate = new Date(Date.UTC(year, month, day));
            } else {
              const processedDateStr = parseDateToString(loan.processed_at);
              if (processedDateStr) {
                const [year, month, day] = processedDateStr.split('-').map(Number);
                baseDate = new Date(year, month - 1, day);
              } else {
                baseDate = loan.disbursed_at ? new Date(loan.disbursed_at) : new Date();
              }
            }
          } else {
            const processedDateStr = parseDateToString(loan.processed_at);
            if (processedDateStr) {
              const [year, month, day] = processedDateStr.split('-').map(Number);
              baseDate = new Date(year, month - 1, day);
            } else {
              baseDate = loan.disbursed_at ? new Date(loan.disbursed_at) : new Date();
            }
          }
        } else {
          baseDate = loan.disbursed_at ? new Date(loan.disbursed_at) : new Date();
        }
        if (baseDate && !isNaN(baseDate.getTime())) {
        baseDate.setHours(0, 0, 0, 0);
        } else {
          baseDate = new Date();
          baseDate.setHours(0, 0, 0, 0);
        }
        
        // baseDateStr is already defined at higher scope (before kfsData object)
        // No need to redefine it here
        
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
              
              // Convert to string for accurate day calculation (no timezone issues)
              const emiDateStr = formatDateToString(emiDate) || parseDateToString(emiDate);
              
          // Calculate days for this EMI period using string-based calculation
          // First period (disbursement to first EMI): inclusive
              // Subsequent periods: start from day AFTER previous EMI date (e.g., 1 Feb if previous was 31 Jan)
          let previousDateStr;
              if (i === 0) {
            // Use baseDateStr (disbursement/processed date as string) directly
            // This avoids any timezone conversion issues
            previousDateStr = baseDateStr || getTodayString();
              } else {
                // Start from day AFTER previous EMI date
            const prevEmiDate = allEmiDates[i - 1] instanceof Date ? allEmiDates[i - 1] : new Date(allEmiDates[i - 1]);
            const prevEmiDateStr = formatDateToString(prevEmiDate) || parseDateToString(prevEmiDate);
                if (prevEmiDateStr) {
                  // Parse date string and add 1 day
                  const [year, month, day] = prevEmiDateStr.split('-').map(Number);
                  const nextDate = new Date(year, month - 1, day + 1);
                  previousDateStr = formatDateToString(nextDate);
                } else {
                  previousDateStr = getTodayString();
                }
              }
              
              // Use calculateDaysBetween for accurate calendar day calculation (inclusive)
              const daysForPeriod = calculateDaysBetween(previousDateStr, emiDateStr);
              
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
                previousDate: previousDateStr,
                emiDate: emiDateStr,
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
      // Use baseDateStr directly to avoid timezone conversion
      disbursementDate: baseDateStr || getTodayString(),
          emiPeriodDetails: emiCount > 1 ? emiPeriodDetails : undefined,
          apr: apr.toFixed(2),
          aprCalculation: `((${totalCharges} / ${principal}) / ${loanTermDaysForAPR}) * 36500 = ${apr.toFixed(2)}`
        });
        
        // For single payment loans, ensure total_amount includes fees correctly (not multiplied by EMI count)
        // Check if this is actually a single payment loan by checking plan type
        const planType = planData.plan_type || planSnapshot?.plan_type || (emiCount > 1 ? 'multi_emi' : 'single');
        const isActuallySinglePayment = planType === 'single' || (!emiCount || emiCount <= 1);
        
        let totalAmount = loanValues.total?.repayable || loanValues.totalRepayableAmount || 0;
        
        // If it's a single payment loan but emi_count > 1, fees were incorrectly multiplied
        // Recalculate: principal + interest + base post service fee (NOT multiplied) + GST
        if (isActuallySinglePayment && emiCount > 1) {
          console.log(`⚠️ Detected single payment loan with emi_count=${emiCount}. Recalculating total_amount to fix fee multiplication...`);
          const principalForCalc = loanValues.principal || loan.sanctioned_amount || loan.principal_amount || loan.loan_amount || 0;
          // For single payment, always use base interest (not interestForAPR which is for multi-EMI)
          const interestForCalc = interest;
          // For single payment, use base repayable fee (divide by emiCount to undo multiplication)
          const baseRepayableFee = loanValues.totals?.repayableFee ? (loanValues.totals.repayableFee / emiCount) : 0;
          const baseRepayableFeeGST = loanValues.totals?.repayableFeeGST ? (loanValues.totals.repayableFeeGST / emiCount) : 0;
          totalAmount = Math.round((principalForCalc + interestForCalc + baseRepayableFee + baseRepayableFeeGST) * 100) / 100;
          console.log(`✅ Recalculated total_amount for single payment: ₹${totalAmount.toFixed(2)} (Principal: ₹${principalForCalc}, Interest: ₹${interestForCalc}, Fee: ₹${baseRepayableFee}, GST: ₹${baseRepayableFeeGST}, Previous: ₹${loanValues.total?.repayable || 0})`);
        }
        
        return {
          principal,
          interest: emiCount > 1 ? interestForAPR : interest,
          total_repayable: totalAmount,
          total_amount: totalAmount,
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
        // PRIORITY: For processed loans, use processed_due_date if available (it's the source of truth)
        let allEmiDates = [];
        
        // PRIORITY 1: Check if loan is processed and has processed_due_date
        if (loan.processed_at && loan.processed_due_date) {
          try {
            console.log(`📅 Attempting to use processed_due_date: ${loan.processed_due_date}`);
            // processed_due_date can be JSON array for multi-EMI or single date string
            const parsedDueDate = typeof loan.processed_due_date === 'string' 
              ? JSON.parse(loan.processed_due_date) 
              : loan.processed_due_date;
            
            console.log(`📅 Parsed processed_due_date:`, parsedDueDate);
            
            if (Array.isArray(parsedDueDate) && parsedDueDate.length > 0) {
              // Multi-EMI: Use dates from processed_due_date directly
              allEmiDates = parsedDueDate.map(date => {
                // Ensure date is in YYYY-MM-DD format
                if (typeof date === 'string') {
                  return date.split('T')[0].split(' ')[0];
                }
                return date;
              });
              console.log(`✅ Using processed_due_date for EMI dates: ${allEmiDates.join(', ')}`);
            } else if (typeof parsedDueDate === 'string') {
              // Single payment: Use single date
              allEmiDates = [parsedDueDate.split('T')[0].split(' ')[0]];
              console.log(`✅ Using processed_due_date for single payment: ${allEmiDates[0]}`);
            }
          } catch (e) {
            console.error('❌ Error parsing processed_due_date:', e, loan.processed_due_date);
            // Fall through to emi_schedule or calculation below
          }
        }
        
        // PRIORITY 2: If processed_due_date not available, try emi_schedule
        if (allEmiDates.length === 0 && loan.emi_schedule) {
          try {
            console.log(`📅 Attempting to use emi_schedule: ${loan.emi_schedule}`);
            const parsedEmiSchedule = typeof loan.emi_schedule === 'string' 
              ? JSON.parse(loan.emi_schedule) 
              : loan.emi_schedule;
            
            if (Array.isArray(parsedEmiSchedule) && parsedEmiSchedule.length > 0) {
              // Extract due dates from emi_schedule
              allEmiDates = parsedEmiSchedule
                .map(emi => emi.due_date)
                .filter(date => date) // Remove null/undefined
                .map(date => {
                  // Ensure date is in YYYY-MM-DD format
                  if (typeof date === 'string') {
                    return date.split('T')[0].split(' ')[0];
                  }
                  return date;
                });
              
              if (allEmiDates.length > 0) {
                console.log(`✅ Using emi_schedule for EMI dates: ${allEmiDates.join(', ')}`);
              }
            }
          } catch (e) {
            console.error('❌ Error parsing emi_schedule:', e, loan.emi_schedule);
            // Fall through to calculation below
          }
        }
        
        // If allEmiDates is still empty, calculate from plan data
        if (allEmiDates.length === 0 && isMultiEmi && planData.emi_frequency === 'monthly' && planData.calculate_by_salary_date && userData.salary_date) {
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
        } else if (allEmiDates.length === 0 && isMultiEmi) {
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
        } else if (allEmiDates.length === 0) {
          // Single payment loan
          allEmiDates = [formatDateLocal(firstDueDate)];
        }

        // Generate repayment schedule with all installments
        let schedule = [];
        const principal = loanValues.principal || loan.sanctioned_amount || loan.principal_amount || loan.loan_amount || 0;
        let totalRepayable = loanValues.total?.repayable || loanValues.totalRepayableAmount || 0;
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
          // For processed loans, use processed_at as base date; otherwise use disbursed_at
          // This must match the base date used for EMI date generation and interest calculation
          // Use baseDateStr (already calculated above) for schedule generation to avoid timezone issues
          const baseDateStrForSchedule = baseDateStr || getTodayString();
          
          for (let i = 0; i < emiCount; i++) {
            // Get EMI date (handle both Date objects and strings)
            const emiDateStr = allEmiDates[i];
            const emiDate = emiDateStr instanceof Date ? new Date(emiDateStr) : new Date(emiDateStr);
            emiDate.setHours(0, 0, 0, 0);
            
            // Convert to string for accurate day calculation (no timezone issues)
            const emiDateStrFormatted = formatDateToString(emiDate) || parseDateToString(emiDate);
            
            // Calculate days for this period using string-based calculation
            let previousDateStr;
            if (i === 0) {
              // Use baseDateStrForSchedule directly to avoid timezone conversion
              previousDateStr = baseDateStrForSchedule;
            } else {
              // Start from day AFTER previous EMI date
              const prevEmiDateStr = allEmiDates[i - 1];
              const prevEmiDate = prevEmiDateStr instanceof Date ? new Date(prevEmiDateStr) : new Date(prevEmiDateStr);
              const prevEmiDateStrFormatted = formatDateToString(prevEmiDate) || parseDateToString(prevEmiDate);
              if (prevEmiDateStrFormatted) {
                // Parse date string and add 1 day
                const [year, month, day] = prevEmiDateStrFormatted.split('-').map(Number);
                const nextDate = new Date(year, month - 1, day + 1);
                previousDateStr = formatDateToString(nextDate);
              } else {
                previousDateStr = getTodayString();
              }
            }
            
            // Use calculateDaysBetween for accurate calendar day calculation (inclusive)
            const daysForPeriod = calculateDaysBetween(previousDateStr, emiDateStrFormatted);
            
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
          // Check if this is actually a single payment loan with incorrect emi_count
          const planType = planData.plan_type || planSnapshot?.plan_type || (emiCount > 1 ? 'multi_emi' : 'single');
          const isActuallySinglePayment = planType === 'single' || (!emiCount || emiCount <= 1);
          
          // For single payment loans, use base fees (not multiplied by EMI count)
          let postServiceFee = loanValues.totals?.repayableFee || 0;
          let postServiceFeeGST = loanValues.totals?.repayableFeeGST || 0;
          
          // If fees were incorrectly multiplied (single payment with emi_count > 1), divide back
          if (isActuallySinglePayment && emiCount > 1) {
            postServiceFee = postServiceFee / emiCount;
            postServiceFeeGST = postServiceFeeGST / emiCount;
            // Recalculate instalment_amount with corrected fees
            const principalForInst = loanValues.principal || loan.sanctioned_amount || loan.principal_amount || loan.loan_amount || 0;
            const interestForInst = interest; // Use single payment interest
            totalRepayable = Math.round((principalForInst + interestForInst + postServiceFee + postServiceFeeGST) * 100) / 100;
          }
          
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
      // Use processed_at date for processed loans, otherwise disbursed_at or today
      // Format as YYYY-MM-DD string to avoid timezone conversion
      generated_at: (() => {
        if (loan.processed_at && ['account_manager', 'cleared'].includes(loan.status)) {
          return loan.processed_at_date || parseDateToString(loan.processed_at) || getTodayString();
        } else if (loan.disbursed_at && ['account_manager', 'cleared', 'active'].includes(loan.status)) {
          return loan.disbursed_at_date || parseDateToString(loan.disbursed_at) || getTodayString();
        }
        return getTodayString();
      })(),

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

/**
 * GET /api/kfs/user/:loanId/extension-letter
 * Get extension letter data for a loan (User accessible)
 * NOTE: This route must be BEFORE /:loanId/extension-letter to avoid route conflicts
 */
router.get('/user/:loanId/extension-letter', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const { loanId } = req.params;
    const userId = req.userId;

    console.log('📄 Generating extension letter for user, loan ID:', loanId);

    // Get loan details - verify user owns this loan
    const loans = await executeQuery(`
      SELECT 
        la.*,
        DATE(la.disbursed_at) as disbursed_at_date,
        la.processed_due_date,
        u.first_name, u.last_name, u.email, u.personal_email, u.official_email, 
        u.phone, u.date_of_birth, u.gender, u.marital_status, u.pan_number,
        u.salary_date
      FROM loan_applications la
      INNER JOIN users u ON la.user_id = u.id
      WHERE la.id = ? AND la.user_id = ?
    `, [loanId, userId]);

    if (!loans || loans.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Loan application not found'
      });
    }

    const loan = loans[0];

    // Reuse the same logic as admin endpoint (lines 1455-2087)
    // We'll call a helper function to avoid code duplication
    // For now, let's inline it but we can refactor later
    
    // Get principal amount and plan snapshot for calculations
    const principal = parseFloat(loan.processed_amount || loan.sanctioned_amount || loan.loan_amount || 0);
    
    if (principal <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid loan principal amount'
      });
    }

    // Get existing extensions to determine extension number
    const existingExtensions = await executeQuery(`
      SELECT * FROM transactions 
      WHERE loan_application_id = ? 
      AND transaction_type LIKE 'loan_extension%'
      ORDER BY created_at ASC
    `, [loanId]);

    // Determine extension number (1st, 2nd, 3rd, 4th)
    const extensionNumberFromType = existingExtensions.length + 1;

    // Limit to maximum 4 extensions
    if (extensionNumberFromType > 4) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 4 extensions allowed per loan'
      });
    }

    // Parse plan snapshot
    let planSnapshot = {};
    try {
      planSnapshot = typeof loan.plan_snapshot === 'string'
        ? JSON.parse(loan.plan_snapshot)
        : loan.plan_snapshot || {};
    } catch (e) {
      console.error('Error parsing plan_snapshot:', e);
    }

    // Calculate original due date and all EMI dates (same logic as admin endpoint)
    // This is a simplified version - full implementation would copy lines 1608-2087
    // For now, let's use the extension calculations utility
    
    const { calculateExtensionFees, calculateNewDueDate, calculateOutstandingBalance } = require('../utils/extensionCalculations');
    
    // Get original due date from processed_due_date
    let originalDueDate = null;
    let allOriginalEmiDates = [];
    let isMultiEmi = false;
    
    if (loan.processed_due_date) {
      try {
        const parsed = typeof loan.processed_due_date === 'string' 
          ? JSON.parse(loan.processed_due_date) 
          : loan.processed_due_date;
        
        if (Array.isArray(parsed) && parsed.length > 0) {
          isMultiEmi = true;
          allOriginalEmiDates = parsed;
          originalDueDate = parsed[0]; // First EMI for extension
        } else if (typeof parsed === 'string') {
          originalDueDate = parsed.split('T')[0].split(' ')[0];
          allOriginalEmiDates = [originalDueDate];
        }
      } catch (e) {
        if (typeof loan.processed_due_date === 'string') {
          originalDueDate = loan.processed_due_date.split('T')[0].split(' ')[0];
          allOriginalEmiDates = [originalDueDate];
        }
      }
    }
    
    // If processed_due_date is null, calculate it from plan snapshot and processed_at
    if (!originalDueDate && loan.processed_at) {
      console.log(`📅 processed_due_date is null, calculating from plan snapshot and processed_at`);
      
      const emiCount = parseInt(planSnapshot.emi_count || 0) || 1;
      isMultiEmi = emiCount > 1;
      const usesSalaryDate = planSnapshot.calculate_by_salary_date === 1 || planSnapshot.calculate_by_salary_date === true;
      const salaryDate = loan.salary_date ? parseInt(loan.salary_date) : null;
      
      // Parse processed_at to get base date
      const processedAtStr = parseDateToString(loan.processed_at);
      if (processedAtStr) {
        const baseDate = new Date(processedAtStr);
        baseDate.setHours(0, 0, 0, 0);
        
        if (isMultiEmi && usesSalaryDate && salaryDate && salaryDate >= 1 && salaryDate <= 31) {
          // Multi-EMI with salary date: Calculate all EMI dates
          let firstDueDate = getNextSalaryDate(baseDate, salaryDate);
          const minDuration = planSnapshot.repayment_days || 15;
          const firstDueDateStr = formatDateToString(firstDueDate);
          const daysToFirstSalary = calculateDaysBetween(processedAtStr, firstDueDateStr);
          
          if (daysToFirstSalary < minDuration) {
            firstDueDate = getSalaryDateForMonth(firstDueDateStr, salaryDate, 1);
          }
          
          // Generate all EMI dates
          for (let i = 0; i < emiCount; i++) {
            const emiDate = getSalaryDateForMonth(firstDueDate, salaryDate, i);
            allOriginalEmiDates.push(formatDateToString(emiDate));
          }
          
          originalDueDate = allOriginalEmiDates[0]; // First EMI for extension
          console.log(`📅 Calculated ${allOriginalEmiDates.length} EMI dates from plan snapshot: ${allOriginalEmiDates.join(', ')}, original due date (first EMI) = ${originalDueDate}`);
        } else if (!isMultiEmi && usesSalaryDate && salaryDate && salaryDate >= 1 && salaryDate <= 31) {
          // Single payment with salary date
          const nextSalaryDate = getNextSalaryDate(baseDate, salaryDate);
          const minDuration = planSnapshot.repayment_days || 15;
          const nextSalaryDateStr = formatDateToString(nextSalaryDate);
          const daysToSalary = calculateDaysBetween(processedAtStr, nextSalaryDateStr);
          
          if (daysToSalary < minDuration) {
            originalDueDate = formatDateToString(getSalaryDateForMonth(nextSalaryDateStr, salaryDate, 1));
          } else {
            originalDueDate = nextSalaryDateStr;
          }
          allOriginalEmiDates = [originalDueDate];
          console.log(`📅 Calculated single payment due date from plan snapshot: ${originalDueDate}`);
        } else {
          // Fixed days plan
          const repaymentDays = planSnapshot.repayment_days || planSnapshot.total_duration_days || 15;
          const dueDate = new Date(baseDate);
          dueDate.setDate(dueDate.getDate() + repaymentDays);
          dueDate.setHours(0, 0, 0, 0);
          
          if (isMultiEmi) {
            // For multi-EMI fixed days, calculate all EMI dates
            const daysPerEmi = { daily: 1, weekly: 7, biweekly: 14, monthly: 30 };
            const emiFrequency = planSnapshot.emi_frequency || 'monthly';
            const daysBetween = daysPerEmi[emiFrequency] || 30;
            
            for (let i = 0; i < emiCount; i++) {
              const emiDate = new Date(baseDate);
              if (emiFrequency === 'monthly') {
                emiDate.setMonth(emiDate.getMonth() + i);
              } else {
                emiDate.setDate(emiDate.getDate() + repaymentDays + (i * daysBetween));
              }
              emiDate.setHours(0, 0, 0, 0);
              allOriginalEmiDates.push(formatDateToString(emiDate));
            }
            originalDueDate = allOriginalEmiDates[0]; // First EMI for extension
            console.log(`📅 Calculated ${allOriginalEmiDates.length} EMI dates (fixed days): ${allOriginalEmiDates.join(', ')}, original due date (first EMI) = ${originalDueDate}`);
          } else {
            originalDueDate = formatDateToString(dueDate);
            allOriginalEmiDates = [originalDueDate];
            console.log(`📅 Calculated single payment due date (fixed days): ${originalDueDate}`);
          }
        }
      }
    }
    
    // Final fallback to processed_at only if we still don't have a due date
    if (!originalDueDate) {
      originalDueDate = parseDateToString(loan.processed_at) || loan.processed_at;
      allOriginalEmiDates = [originalDueDate];
      console.log(`⚠️ Using processed_at as final fallback: Original due date = ${originalDueDate}`);
    }
    
    if (!originalDueDate) {
      return res.status(400).json({
        success: false,
        message: 'Original due date not found'
      });
    }

    // Calculate extension fees and new due date using utility functions
    const fees = calculateExtensionFees(loan);
    const newDueDateResult = calculateNewDueDate(loan, originalDueDate, planSnapshot, loan.salary_date, allOriginalEmiDates);
    const outstandingBalance = calculateOutstandingBalance(loan);

    // Calculate total tenure days (from disbursement to new due date)
    const disbursementDateStr = parseDateToString(loan.disbursed_at || loan.processed_at);
    const newDueDateStr = newDueDateResult.newDueDate;
    let totalTenureDays = 0;
    if (disbursementDateStr && newDueDateStr) {
      totalTenureDays = calculateDaysBetween(disbursementDateStr, newDueDateStr);
    }

    // Get address details
    const addresses = await executeQuery(`
      SELECT * FROM addresses 
      WHERE user_id = ? AND is_primary = 1 
      LIMIT 1
    `, [loan.user_id]);
    const address = addresses[0] || {};

    // Prepare extension letter data
    const extensionLetterData = {
      company: {
        name: 'SPHEETI FINTECH PRIVATE LIMITED',
        cin: 'U65929MH2018PTC306088',
        rbi_registration: 'N-13.02361',
        address: 'Mahadev Compound Gala No. A7, Dhobi Ghat Road, Ulhasnagar MUMBAI, MAHARASHTRA, 421001'
      },
      loan: {
        id: loan.id,
        application_number: loan.application_number,
        sanctioned_amount: principal,
        disbursed_at: loan.disbursed_at,
        processed_due_date: loan.processed_due_date
      },
      borrower: {
        name: `${loan.first_name || ''} ${loan.last_name || ''}`.trim(),
        first_name: loan.first_name,
        last_name: loan.last_name,
        email: loan.email,
        phone: loan.phone,
        pan_number: loan.pan_number,
        address: address
      },
      extension: {
        extension_number: extensionNumberFromType,
        extension_availed_date: formatDateLocal(new Date()),
        extension_period_till: newDueDateResult.newDueDate,
        extension_fee: fees.extensionFee,
        gst_amount: fees.gstAmount,
        interest_till_date: fees.interestTillDate,
        penalty: 0,
        total_extension_amount: fees.totalExtensionAmount,
        original_due_date: originalDueDate,
        new_due_date: newDueDateResult.newDueDate,
        extension_period_days: newDueDateResult.extensionPeriodDays,
        outstanding_loan_balance: outstandingBalance,
        outstanding_loan_balance_after_extension: outstandingBalance,
        total_tenure_days: totalTenureDays,
        ...(isMultiEmi && newDueDateResult.newEmiDates ? {
          original_emi_dates: allOriginalEmiDates,
          new_emi_dates: newDueDateResult.newEmiDates
        } : {})
      },
      generated_at: new Date().toISOString()
    };

    res.json({
      success: true,
      data: extensionLetterData
    });

  } catch (error) {
    console.error('❌ Error generating extension letter for user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate extension letter',
      error: error.message
    });
  }
});

/**
 * POST /api/kfs/user/:loanId/extension-letter/send-email
 * Send extension letter to user's email (User accessible)
 * NOTE: This route must be BEFORE /:loanId/extension-letter to avoid route conflicts
 */
router.post('/user/:loanId/extension-letter/send-email', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const { loanId } = req.params;
    const userId = req.userId;
    const { htmlContent } = req.body; // HTML content from frontend

    console.log('📧 Sending extension letter email for loan ID:', loanId);

    if (!htmlContent) {
      return res.status(400).json({
        success: false,
        message: 'HTML content is required'
      });
    }

    // Verify user owns the loan
    const loans = await executeQuery(`
      SELECT 
        la.*,
        u.first_name, u.last_name, u.email, u.personal_email, u.official_email
      FROM loan_applications la
      INNER JOIN users u ON la.user_id = u.id
      WHERE la.id = ? AND la.user_id = ?
    `, [loanId, userId]);

    if (!loans || loans.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      });
    }

    const loan = loans[0];

    // Generate PDF from HTML content
    const filename = `Extension_Letter_${loan.application_number}.pdf`;
    const pdfResult = await pdfService.generateKFSPDF(htmlContent, filename);

    // Get recipient email
    const recipientEmail = loan.personal_email || loan.official_email || loan.email;
    const recipientName = `${loan.first_name || ''} ${loan.last_name || ''}`.trim() || 'User';

    if (!recipientEmail) {
      return res.status(400).json({
        success: false,
        message: 'User email not found'
      });
    }

    // Send email with PDF attachment
    const emailResult = await emailService.sendExtensionLetterEmail({
      loanId: loan.id,
      recipientEmail: recipientEmail,
      recipientName: recipientName,
      loanData: {
        application_number: loan.application_number,
        loan_amount: loan.loan_amount
      },
      pdfBuffer: pdfResult.buffer,
      pdfFilename: filename,
      sentBy: userId
    });

    res.json({
      success: true,
      message: 'Extension letter sent to email successfully',
      data: {
        recipientEmail: recipientEmail,
        messageId: emailResult.messageId
      }
    });

  } catch (error) {
    console.error('❌ Error sending extension letter email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send extension letter email',
      error: error.message
    });
  }
});

/**
 * GET /api/kfs/:loanId/extension-letter
 * Get extension letter data for a loan
 * Requires extension transaction ID or extension number
 * NOTE: This route must be BEFORE /:loanId to avoid route conflicts
 */
router.get('/:loanId/extension-letter', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { loanId } = req.params;
    const { transactionId, extensionNumber } = req.query;

    console.log('📄 Generating extension letter for loan ID:', loanId, 'transactionId:', transactionId, 'extensionNumber:', extensionNumber);

    // Get loan details including user salary date
    // NOTE: processed_due_date is TEXT and can contain JSON array for multi-EMI loans
    // Don't use DATE() function on it as it will fail for JSON arrays
    const loans = await executeQuery(`
      SELECT 
        la.*,
        DATE(la.disbursed_at) as disbursed_at_date,
        la.processed_due_date,
        u.first_name, u.last_name, u.email, u.personal_email, u.official_email, 
        u.phone, u.date_of_birth, u.gender, u.marital_status, u.pan_number,
        u.salary_date
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

    // Get principal amount and plan snapshot for calculations
    const principal = parseFloat(loan.processed_amount || loan.sanctioned_amount || loan.loan_amount || 0);
    
    if (principal <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid loan principal amount'
      });
    }

    // Get existing extensions to determine extension number
    const existingExtensions = await executeQuery(`
      SELECT * FROM transactions 
      WHERE loan_application_id = ? 
      AND transaction_type LIKE 'loan_extension%'
      ORDER BY created_at ASC
    `, [loanId]);

    // Determine extension number (1st, 2nd, 3rd, 4th)
    let extensionNumberFromType = existingExtensions.length + 1;
    if (extensionNumber) {
      extensionNumberFromType = parseInt(extensionNumber);
    } else if (transactionId) {
      // If transactionId provided, find the extension number from that transaction
      const specificTransaction = await executeQuery(`
        SELECT transaction_type FROM transactions 
        WHERE id = ? AND loan_application_id = ?
      `, [transactionId, loanId]);
      
      if (specificTransaction && specificTransaction.length > 0) {
        const txType = specificTransaction[0].transaction_type;
        if (txType === 'loan_extension_1st') extensionNumberFromType = 1;
        else if (txType === 'loan_extension_2nd') extensionNumberFromType = 2;
        else if (txType === 'loan_extension_3rd') extensionNumberFromType = 3;
        else if (txType === 'loan_extension_4th') extensionNumberFromType = 4;
      }
    }

    // Limit to maximum 4 extensions
    if (extensionNumberFromType > 4) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 4 extensions allowed per loan'
      });
    }

    console.log(`📊 Extension number: ${extensionNumberFromType} (${existingExtensions.length} existing extensions)`);

    // Get plan snapshot early (needed for calculating due date if processed_due_date is null)
    let planSnapshot = {};
    try {
      planSnapshot = typeof loan.plan_snapshot === 'string'
        ? JSON.parse(loan.plan_snapshot)
        : loan.plan_snapshot || {};
    } catch (e) {
      console.error('Error parsing plan_snapshot:', e);
    }

    // Calculate original due date (before any extensions)
    // For multi-EMI loans, processed_due_date is a JSON array of EMI dates
    // We need to get the LAST EMI date as the original due date
    let originalDueDate = null;
    
    if (loan.processed_due_date) {
      try {
        // Try to parse as JSON array (for multi-EMI loans)
        const parsedDueDate = typeof loan.processed_due_date === 'string' 
          ? JSON.parse(loan.processed_due_date) 
          : loan.processed_due_date;
        
        if (Array.isArray(parsedDueDate) && parsedDueDate.length > 0) {
          // Multi-EMI loan: use the LAST EMI date as original due date
          originalDueDate = parsedDueDate[parsedDueDate.length - 1];
          console.log(`📅 Multi-EMI loan: Original due date (last EMI) = ${originalDueDate} from EMI dates:`, parsedDueDate);
        } else if (typeof parsedDueDate === 'string') {
          // Single payment loan: use the single date
          originalDueDate = parsedDueDate;
          console.log(`📅 Single payment loan: Original due date = ${originalDueDate}`);
        }
      } catch (e) {
        // If parsing fails, treat as single date string
        originalDueDate = loan.processed_due_date;
        console.log(`📅 Parsed as single date string: Original due date = ${originalDueDate}`);
      }
    }
    
    // For multi-EMI loans, we need to get all EMI dates and shift them all forward
    let allOriginalEmiDates = [];
    let isMultiEmi = false;
    
    if (loan.processed_due_date) {
      try {
        const parsedDueDate = typeof loan.processed_due_date === 'string' 
          ? JSON.parse(loan.processed_due_date) 
          : loan.processed_due_date;
        
        if (Array.isArray(parsedDueDate) && parsedDueDate.length > 0) {
          isMultiEmi = true;
          allOriginalEmiDates = parsedDueDate;
          originalDueDate = parsedDueDate[parsedDueDate.length - 1]; // Last EMI date
          console.log(`📅 Multi-EMI loan: Found ${parsedDueDate.length} EMI dates, original due date (last EMI) = ${originalDueDate}`);
        }
      } catch (e) {
        // If parsing fails, treat as single date
      }
    }
    
    // If processed_due_date is null, calculate it from plan snapshot and processed_at
    // This is the same logic used when processing the loan
    if (!originalDueDate && loan.processed_at) {
      console.log(`📅 processed_due_date is null, calculating from plan snapshot and processed_at`);
      
      // Get plan snapshot if not already parsed
      if (!planSnapshot || Object.keys(planSnapshot).length === 0) {
        try {
          planSnapshot = typeof loan.plan_snapshot === 'string'
            ? JSON.parse(loan.plan_snapshot)
            : loan.plan_snapshot || {};
        } catch (e) {
          console.error('Error parsing plan_snapshot:', e);
          planSnapshot = {};
        }
      }
      
      const emiCount = parseInt(planSnapshot.emi_count || 0) || 1;
      isMultiEmi = emiCount > 1;
      const usesSalaryDate = planSnapshot.calculate_by_salary_date === 1 || planSnapshot.calculate_by_salary_date === true;
      const salaryDate = loan.salary_date ? parseInt(loan.salary_date) : null;
      
      // Parse processed_at to get base date
      const processedAtStr = parseDateToString(loan.processed_at);
      if (processedAtStr) {
        const baseDate = new Date(processedAtStr);
        baseDate.setHours(0, 0, 0, 0);
        
        if (isMultiEmi && usesSalaryDate && salaryDate && salaryDate >= 1 && salaryDate <= 31) {
          // Multi-EMI with salary date: Calculate all EMI dates
          let firstDueDate = getNextSalaryDate(baseDate, salaryDate);
          const minDuration = planSnapshot.repayment_days || 15;
          const firstDueDateStr = formatDateToString(firstDueDate);
          const daysToFirstSalary = calculateDaysBetween(processedAtStr, firstDueDateStr);
          
          if (daysToFirstSalary < minDuration) {
            firstDueDate = getSalaryDateForMonth(firstDueDateStr, salaryDate, 1);
          }
          
          // Generate all EMI dates
          for (let i = 0; i < emiCount; i++) {
            const emiDate = getSalaryDateForMonth(firstDueDate, salaryDate, i);
            allOriginalEmiDates.push(formatDateToString(emiDate));
          }
          
          originalDueDate = allOriginalEmiDates[allOriginalEmiDates.length - 1];
          console.log(`📅 Calculated ${allOriginalEmiDates.length} EMI dates from plan snapshot: ${allOriginalEmiDates.join(', ')}, original due date = ${originalDueDate}`);
        } else if (!isMultiEmi && usesSalaryDate && salaryDate && salaryDate >= 1 && salaryDate <= 31) {
          // Single payment with salary date
          const nextSalaryDate = getNextSalaryDate(baseDate, salaryDate);
          const minDuration = planSnapshot.repayment_days || 15;
          const nextSalaryDateStr = formatDateToString(nextSalaryDate);
          const daysToSalary = calculateDaysBetween(processedAtStr, nextSalaryDateStr);
          
          if (daysToSalary < minDuration) {
            originalDueDate = formatDateToString(getSalaryDateForMonth(nextSalaryDateStr, salaryDate, 1));
          } else {
            originalDueDate = nextSalaryDateStr;
          }
          console.log(`📅 Calculated single payment due date from plan snapshot: ${originalDueDate}`);
        } else {
          // Fixed days plan
          const repaymentDays = planSnapshot.repayment_days || planSnapshot.total_duration_days || 15;
          const dueDate = new Date(baseDate);
          dueDate.setDate(dueDate.getDate() + repaymentDays);
          dueDate.setHours(0, 0, 0, 0);
          
          if (isMultiEmi) {
            // For multi-EMI fixed days, calculate all EMI dates
            const daysPerEmi = { daily: 1, weekly: 7, biweekly: 14, monthly: 30 };
            const emiFrequency = planSnapshot.emi_frequency || 'monthly';
            const daysBetween = daysPerEmi[emiFrequency] || 30;
            
            for (let i = 0; i < emiCount; i++) {
              const emiDate = new Date(baseDate);
              if (emiFrequency === 'monthly') {
                emiDate.setMonth(emiDate.getMonth() + i);
              } else {
                emiDate.setDate(emiDate.getDate() + repaymentDays + (i * daysBetween));
              }
              emiDate.setHours(0, 0, 0, 0);
              allOriginalEmiDates.push(formatDateToString(emiDate));
            }
            originalDueDate = allOriginalEmiDates[allOriginalEmiDates.length - 1];
            console.log(`📅 Calculated ${allOriginalEmiDates.length} EMI dates (fixed days): ${allOriginalEmiDates.join(', ')}, original due date = ${originalDueDate}`);
          } else {
            originalDueDate = formatDateToString(dueDate);
            console.log(`📅 Calculated single payment due date (fixed days): ${originalDueDate}`);
          }
        }
      }
    }
    
    // Final fallback to processed_at only if we still don't have a due date
    if (!originalDueDate) {
      originalDueDate = parseDateToString(loan.processed_at) || loan.processed_at;
      console.log(`⚠️ Using processed_at as final fallback: Original due date = ${originalDueDate}`);
    }
    
    // Get current due date (after all previous extensions)
    // Use the calculated originalDueDate (which might have been calculated from plan snapshot)
    let currentDueDate = originalDueDate;
    let allCurrentEmiDates = isMultiEmi && allOriginalEmiDates.length > 0 ? [...allOriginalEmiDates] : [];
    
    if (existingExtensions && existingExtensions.length > 0) {
      // Get the latest extension's new due date
      const latestExtension = existingExtensions[existingExtensions.length - 1];
      if (latestExtension.description) {
        try {
          const desc = typeof latestExtension.description === 'string' 
            ? JSON.parse(latestExtension.description) 
            : latestExtension.description;
          
          // For multi-EMI, check if extension stored all new EMI dates
          if (isMultiEmi && desc.new_emi_dates && Array.isArray(desc.new_emi_dates)) {
            allCurrentEmiDates = desc.new_emi_dates;
            currentDueDate = desc.new_emi_dates[desc.new_emi_dates.length - 1];
          } else {
            currentDueDate = desc.new_due_date || desc.extension_period_till || currentDueDate;
          }
        } catch (e) {
          // If parsing fails, use current due date
        }
      }
    }

    // Get plan snapshot to check if it uses salary date calculation
    // (May have been parsed earlier when calculating originalDueDate from plan snapshot)
    if (!planSnapshot || Object.keys(planSnapshot).length === 0) {
      try {
        planSnapshot = typeof loan.plan_snapshot === 'string'
          ? JSON.parse(loan.plan_snapshot)
          : loan.plan_snapshot || {};
      } catch (e) {
        console.error('Error parsing plan_snapshot:', e);
        planSnapshot = {};
      }
    }
    
    const usesSalaryDate = planSnapshot.calculate_by_salary_date === 1 || planSnapshot.calculate_by_salary_date === true;
    const salaryDate = loan.salary_date ? parseInt(loan.salary_date) : null;
    
    console.log(`📅 Extension calculation method: ${usesSalaryDate ? 'Salary Date Based' : 'Fixed Days'}`);
    if (usesSalaryDate && salaryDate) {
      console.log(`   Salary Date: ${salaryDate}`);
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const currentDueDateObj = currentDueDate ? new Date(currentDueDate) : today;
    currentDueDateObj.setHours(0, 0, 0, 0);
    
    let newDueDate;
    let allNewEmiDates = [];
    let extensionPeriodDays = 15; // Default for fixed days
    
    // Calculate new due date based on plan type
    if (usesSalaryDate && salaryDate && salaryDate >= 1 && salaryDate <= 31) {
      // Salary Date Based Plan: Shift to next month's salary date
      if (isMultiEmi && allCurrentEmiDates.length > 0) {
        // Multi-EMI: Each EMI date shifts to next month's salary date
        allNewEmiDates = allCurrentEmiDates.map(emiDate => {
          const emiDateObj = new Date(emiDate);
          emiDateObj.setHours(0, 0, 0, 0);
          // Get next month's salary date from this EMI date
          const nextMonthSalaryDate = getSalaryDateForMonth(emiDateObj, salaryDate, 1);
          return formatDateLocal(nextMonthSalaryDate);
        });
        // New due date is the last new EMI date
        if (allNewEmiDates.length > 0) {
          newDueDate = new Date(allNewEmiDates[allNewEmiDates.length - 1]);
          newDueDate.setHours(0, 0, 0, 0);
        }
        console.log(`📅 Multi-EMI extension (Salary Date): Shifting ${allCurrentEmiDates.length} EMI dates to next month's salary date`);
        console.log(`   Original EMI dates: ${allCurrentEmiDates.join(', ')}`);
        console.log(`   New EMI dates: ${allNewEmiDates.join(', ')}`);
      } else {
        // Single payment: Shift to next month's salary date from current due date
        const nextMonthSalaryDate = getSalaryDateForMonth(currentDueDateObj, salaryDate, 1);
        newDueDate = nextMonthSalaryDate;
        newDueDate.setHours(0, 0, 0, 0);
        console.log(`📅 Single payment extension (Salary Date): ${formatDateLocal(currentDueDateObj)} → ${formatDateLocal(newDueDate)}`);
      }
    } else {
      // Fixed Days Plan: Original Due Date + 15 days (always, regardless of today's date)
      if (isMultiEmi && allCurrentEmiDates.length > 0) {
        // Multi-EMI: All EMI dates shift forward by 15 days
        allNewEmiDates = allCurrentEmiDates.map(emiDate => {
          const emiDateObj = new Date(emiDate);
          emiDateObj.setHours(0, 0, 0, 0);
          const newEmiDate = new Date(emiDateObj);
          newEmiDate.setDate(newEmiDate.getDate() + extensionPeriodDays);
          return formatDateLocal(newEmiDate);
        });
        // New due date is the last new EMI date
        if (allNewEmiDates.length > 0) {
          newDueDate = new Date(allNewEmiDates[allNewEmiDates.length - 1]);
          newDueDate.setHours(0, 0, 0, 0);
        }
        console.log(`📅 Multi-EMI extension (Fixed Days): Shifting ${allCurrentEmiDates.length} EMI dates forward by ${extensionPeriodDays} days`);
        console.log(`   Original EMI dates: ${allCurrentEmiDates.join(', ')}`);
        console.log(`   New EMI dates: ${allNewEmiDates.join(', ')}`);
      } else {
        // Single payment: Original Due Date + 15 days (always, regardless of today)
        newDueDate = new Date(currentDueDateObj);
        newDueDate.setDate(newDueDate.getDate() + extensionPeriodDays);
        newDueDate.setHours(0, 0, 0, 0);
        console.log(`📅 Single payment extension (Fixed Days): ${formatDateLocal(currentDueDateObj)} + ${extensionPeriodDays} days = ${formatDateLocal(newDueDate)}`);
      }
    }
    
    const extensionPeriodTill = formatDateLocal(newDueDate);

    // Calculate extension fee: 21% of principal
    const extensionFeePercent = 0.21; // 21%
    const extensionFee = Math.round(principal * extensionFeePercent * 100) / 100;

    // Calculate GST: 18% of extension fee
    const GST_RATE = 0.18; // 18% GST
    const gstAmount = Math.round(extensionFee * GST_RATE * 100) / 100;

    // Calculate interest till date
    // Interest should be calculated from processed_at date to today
    // processed_at date is day 1, so days = (today - processed_at) + 1
    let interestTillDate = 0;
    
    // Get interest rate from plan snapshot (already parsed above)
    const interestRatePerDay = parseFloat(planSnapshot.interest_percent_per_day || 0.001); // Default 0.1% per day
    
    // Use processed_at as the start date (processed_at is day 1)
    // If processed_at is not available, use disbursed_at or created_at
    let processedDate;
    if (loan.processed_at) {
      processedDate = new Date(loan.processed_at);
    } else if (loan.disbursed_at) {
      processedDate = new Date(loan.disbursed_at);
    } else {
      processedDate = new Date(loan.created_at);
    }
    
    // Normalize dates to start of day (ignore time)
    processedDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    // Calculate days from processed_at to today (inclusive counting)
    // processed_at date is day 1, so: days = (today - processed_at) + 1
    // Use the same calculation as cron job: Math.ceil((end - start) / msPerDay) + 1
    const msPerDay = 1000 * 60 * 60 * 24;
    const days = Math.ceil((today - processedDate) / msPerDay) + 1;
    
    // Ensure days is at least 1 (if processed_at is today, days = 1)
    const finalDays = Math.max(1, days);
    
    // Calculate total interest from processed_at to today: Principal × Interest Rate Per Day × Days
    interestTillDate = Math.round(principal * interestRatePerDay * finalDays * 100) / 100;
    
    console.log(`💰 Interest calculation:
      Principal: ₹${principal}
      Interest Rate Per Day: ${interestRatePerDay} (${(interestRatePerDay * 100).toFixed(4)}%)
      Processed Date: ${formatDateLocal(processedDate)} (Day 1)
      Today: ${formatDateLocal(today)}
      Raw Days Calculation: ${(today - processedDate) / msPerDay}
      Days: ${finalDays} (inclusive, processed_at is day 1)
      Interest Calculation: ₹${principal} × ${interestRatePerDay} × ${finalDays} = ₹${principal * interestRatePerDay * finalDays}
      Interest Till Date (rounded): ₹${interestTillDate}`);

    // Calculate total extension amount: Extension Fee + GST + Interest Till Date
    // This is what user pays NOW for the extension (transactional charge)
    const totalExtensionAmount = Math.round((extensionFee + gstAmount + interestTillDate) * 100) / 100;

    // Calculate outstanding loan balance CORRECTLY
    // Outstanding Balance = Principal + Post Service Fee + GST on Post Service Fee
    // Extension charges (extension fee, GST on extension fee, interest till date) are NOT part of outstanding balance
    // They are settled separately when user pays for extension
    
    // Get EMI count to determine if this is a multi-EMI loan
    const emiCount = parseInt(planSnapshot.emi_count || 0) || (isMultiEmi && allOriginalEmiDates.length > 0 ? allOriginalEmiDates.length : 1);
    const isMultiEmiLoan = emiCount > 1;
    
    console.log(`📊 Loan type: ${isMultiEmiLoan ? `Multi-EMI (${emiCount} EMIs)` : 'Single Payment'}`);
    
    // Get post service fee from processed values
    // IMPORTANT: For multi-EMI loans, processed_post_service_fee is the BASE fee per EMI (needs multiplication)
    // For single payment loans, processed_post_service_fee is the total fee
    let postServiceFee = parseFloat(loan.processed_post_service_fee || 0);
    // Track if we got base fee (per EMI) or total fee
    // For multi-EMI loans, processed_post_service_fee is typically base fee
    let isBaseFee = isMultiEmiLoan && postServiceFee > 0; // If multi-EMI and we have processed_post_service_fee, it's base
    
    // If processed_post_service_fee is 0 or missing, try to get from fees_breakdown
    if (postServiceFee === 0 && loan.fees_breakdown) {
      try {
        const feesBreakdown = typeof loan.fees_breakdown === 'string' 
          ? JSON.parse(loan.fees_breakdown) 
          : loan.fees_breakdown;
        
        if (Array.isArray(feesBreakdown)) {
          // Find post service fee in fees_breakdown
          const postServiceFeeObj = feesBreakdown.find(fee => 
            (fee.fee_name && fee.fee_name.toLowerCase().includes('post service')) ||
            (fee.name && fee.name.toLowerCase().includes('post service'))
          );
          
          if (postServiceFeeObj) {
            // Use fee_amount if available, otherwise calculate from principal and fee_percent
            if (postServiceFeeObj.base_fee_amount) {
              // Prefer base_fee_amount if available (for multi-EMI loans)
              postServiceFee = parseFloat(postServiceFeeObj.base_fee_amount);
              isBaseFee = true;
              console.log(`📊 Found base post service fee from fees_breakdown.base_fee_amount: ₹${postServiceFee} (base per EMI)`);
            } else if (postServiceFeeObj.fee_amount) {
              // Use fee_amount, but check if it's base or total
              postServiceFee = parseFloat(postServiceFeeObj.fee_amount);
              // For multi-EMI loans, if there's no base_fee_amount, fee_amount might already be total
              // But if it's a reasonable single-EMI amount, it might be base
              isBaseFee = false; // Default to false (assume total), will check later
              console.log(`📊 Found post service fee from fees_breakdown.fee_amount: ₹${postServiceFee} (checking if base or total)`);
            } else if (postServiceFeeObj.fee_percent && principal > 0) {
              postServiceFee = Math.round((principal * parseFloat(postServiceFeeObj.fee_percent) / 100) * 100) / 100;
              isBaseFee = true; // Calculated from percent is always base per EMI
              console.log(`📊 Calculated post service fee from fees_breakdown.fee_percent: ₹${postServiceFee} (base per EMI)`);
            }
          }
        }
      } catch (e) {
        console.error('Error parsing fees_breakdown for post service fee:', e);
      }
    }
    
    // If still 0, try to calculate from plan snapshot fees
    if (postServiceFee === 0 && planSnapshot.fees && Array.isArray(planSnapshot.fees)) {
      const postServiceFeeObj = planSnapshot.fees.find(fee => 
        fee.fee_name && fee.fee_name.toLowerCase().includes('post service') &&
        fee.application_method === 'add_to_total'
      );
      
      if (postServiceFeeObj && postServiceFeeObj.fee_percent && principal > 0) {
        postServiceFee = Math.round((principal * parseFloat(postServiceFeeObj.fee_percent) / 100) * 100) / 100;
        isBaseFee = true; // This is base fee per EMI
        console.log(`📊 Calculated post service fee from plan snapshot: ₹${postServiceFee} (${postServiceFeeObj.fee_percent}% of ₹${principal}) - base per EMI`);
      }
    }
    
    // For multi-EMI loans, multiply post service fee by EMI count
    // processed_post_service_fee stores BASE fee per EMI for multi-EMI loans
    // fees_breakdown might have base_fee_amount (base) or fee_amount (total)
    // plan snapshot fees are always base (per EMI)
    if (isMultiEmiLoan && isBaseFee && postServiceFee > 0) {
      // We have base fee - multiply by EMI count
      const basePostServiceFee = postServiceFee;
      postServiceFee = Math.round(postServiceFee * emiCount * 100) / 100;
      console.log(`📊 Multi-EMI loan: Multiplying post service fee by EMI count: ₹${basePostServiceFee} × ${emiCount} = ₹${postServiceFee}`);
    } else if (isMultiEmiLoan && !isBaseFee && postServiceFee > 0) {
      // We got it from fees_breakdown.fee_amount (without base_fee_amount)
      // Check if it seems like it's already total or base
      // If base_fee_amount was available, we would have used it and set isBaseFee = true
      // So if we're here, fee_amount might already be total, but let's check
      const feePercentOfPrincipal = (postServiceFee / principal) * 100;
      // If it's in the typical range for a single EMI fee (5-15% of principal), it's probably base
      if (feePercentOfPrincipal >= 5 && feePercentOfPrincipal <= 15) {
        // Looks like base fee per EMI - multiply
        const basePostServiceFee = postServiceFee;
        postServiceFee = Math.round(postServiceFee * emiCount * 100) / 100;
        console.log(`📊 Multi-EMI loan: Detected base fee from fees_breakdown (${feePercentOfPrincipal.toFixed(2)}% of principal), multiplying: ₹${basePostServiceFee} × ${emiCount} = ₹${postServiceFee}`);
      } else {
        console.log(`📊 Multi-EMI loan: Post service fee from fees_breakdown appears to already be total (${feePercentOfPrincipal.toFixed(2)}% of principal), not multiplying`);
      }
    }
    
    // Calculate GST on Post Service Fee (18% of post service fee)
    // Note: processed_gst is total GST (on both processing fee and post service fee)
    // But outstanding balance only includes GST on post service fee
    const GST_RATE_FOR_FEES = 0.18; // 18% GST
    const postServiceFeeGST = Math.round(postServiceFee * GST_RATE_FOR_FEES * 100) / 100;
    
    // Outstanding balance BEFORE extension = Principal + Post Service Fee + GST on Post Service Fee
    const outstandingLoanBalance = Math.round((principal + postServiceFee + postServiceFeeGST) * 100) / 100;
    
    console.log(`💰 Outstanding Balance Calculation:
      Principal: ₹${principal}
      Post Service Fee: ₹${postServiceFee}
      Post Service Fee GST (18%): ₹${postServiceFeeGST}
      Outstanding Balance: ₹${outstandingLoanBalance}`);
    
    // Outstanding balance AFTER extension remains the SAME (extension is date shift, not balance mutation)
    // Extension payment is a separate transactional charge, not added to outstanding
    const outstandingLoanBalanceAfterExtension = outstandingLoanBalance;

    // Calculate extension period according to business logic:
    // For single payment: Extension Period = New Due Date - Original Due Date (before any extensions)
    // For multi-EMI salary date-based: Extension Period = Gap between first and second EMI (e.g., 28 days)
    // For multi-EMI fixed days: Extension Period = 15 days (fixed)
    const originalDueDateObj = originalDueDate ? new Date(originalDueDate) : new Date(loan.processed_at);
    originalDueDateObj.setHours(0, 0, 0, 0);
    const newDueDateObj = new Date(newDueDate);
    newDueDateObj.setHours(0, 0, 0, 0);
    
    let extensionPeriodDaysCalculated;
    if (isMultiEmi && allOriginalEmiDates.length > 0) {
      if (usesSalaryDate && allOriginalEmiDates.length >= 2) {
        // For salary date-based multi-EMI: Extension Period = Gap between first and second EMI
        const firstEmiDate = new Date(allOriginalEmiDates[0]);
        firstEmiDate.setHours(0, 0, 0, 0);
        const secondEmiDate = new Date(allOriginalEmiDates[1]);
        secondEmiDate.setHours(0, 0, 0, 0);
        extensionPeriodDaysCalculated = Math.ceil((secondEmiDate - firstEmiDate) / (1000 * 60 * 60 * 24));
        console.log(`📅 Multi-EMI salary date-based: Extension period = gap between first and second EMI: ${formatDateLocal(firstEmiDate)} to ${formatDateLocal(secondEmiDate)} = ${extensionPeriodDaysCalculated} days`);
      } else {
        // For fixed days multi-EMI: Extension Period = 15 days (fixed)
        extensionPeriodDaysCalculated = 15;
        console.log(`📅 Multi-EMI fixed days: Extension period = 15 days (fixed)`);
      }
    } else {
      // For single payment: Extension Period = New Due Date - Original Due Date
      extensionPeriodDaysCalculated = Math.ceil((newDueDateObj - originalDueDateObj) / (1000 * 60 * 60 * 24));
    }
    
    // Ensure extension period is at least 1 day
    const finalExtensionPeriodDays = Math.max(1, extensionPeriodDaysCalculated);

    // Calculate total tenure days (from disbursement to new due date)
    // Use parseDateToString and calculateDaysBetween for consistent inclusive day counting
    const disbursementDateStr = parseDateToString(loan.disbursed_at || loan.processed_at);
    const newDueDateStr = parseDateToString(newDueDate);
    
    // Create disbursementDateObj for console.log (always needed)
    const disbursementDateObj = loan.disbursed_at ? new Date(loan.disbursed_at) : new Date(loan.processed_at);
    disbursementDateObj.setHours(0, 0, 0, 0);
    
    let totalTenureDays = 0;
    if (disbursementDateStr && newDueDateStr) {
      // Use calculateDaysBetween for inclusive day counting (both start and end dates count)
      totalTenureDays = calculateDaysBetween(disbursementDateStr, newDueDateStr);
      console.log(`📅 Total tenure calculation: ${disbursementDateStr} to ${newDueDateStr} = ${totalTenureDays} days (inclusive)`);
    } else {
      // Fallback to old calculation if date parsing fails
      totalTenureDays = Math.ceil((newDueDateObj - disbursementDateObj) / (1000 * 60 * 60 * 24)) + 1;
      console.log(`⚠️ Using fallback total tenure calculation: ${totalTenureDays} days`);
    }

    console.log(`📅 Extension Period & Total Tenure Calculation:
      Original Due Date (before any extensions): ${formatDateLocal(originalDueDateObj)}
      ${isMultiEmi ? `Original EMI Dates: ${allOriginalEmiDates.join(', ')}` : ''}
      ${isMultiEmi ? `New EMI Dates: ${allNewEmiDates.join(', ')}` : ''}
      New Due Date (after this extension): ${formatDateLocal(newDueDateObj)}
      Extension Period: ${finalExtensionPeriodDays} days ${isMultiEmi ? '(fixed 15 days for multi-EMI)' : '(New Due Date - Original Due Date for single payment)'}
      Disbursement Date: ${formatDateLocal(disbursementDateObj)}
      Total Tenure: ${totalTenureDays} days (from disbursement to new due date)`);

    console.log(`💰 Extension calculation:
      Principal: ₹${principal}
      Post Service Fee: ₹${postServiceFee}
      Post Service Fee GST: ₹${postServiceFeeGST}
      Outstanding Balance (Principal + Post Service Fee + GST): ₹${outstandingLoanBalance}
      Extension Fee (21%): ₹${extensionFee}
      GST (18% of extension fee): ₹${gstAmount}
      Interest Till Date: ₹${interestTillDate}
      Total Extension Payment (transactional charge): ₹${totalExtensionAmount}
      Outstanding Balance After Extension: ₹${outstandingLoanBalanceAfterExtension} (UNCHANGED - extension is date shift, not balance mutation)
      Total Tenure Days: ${totalTenureDays}`);

    // Get address details
    const addresses = await executeQuery(`
      SELECT * FROM addresses 
      WHERE user_id = ? AND is_primary = 1 
      LIMIT 1
    `, [loan.user_id]);
    const address = addresses[0] || {};

    // Get company details (same as KFS)
    const companyData = {
      name: 'SPHEETI FINTECH PRIVATE LIMITED',
      cin: 'U65929MH2018PTC306088',
      rbi_registration: 'N-13.02361',
      address: 'Mahadev Compound Gala No. A7, Dhobi Ghat Road, Ulhasnagar MUMBAI, MAHARASHTRA, 421001'
    };

    // Prepare extension letter data
    const extensionLetterData = {
      company: companyData,
      loan: {
        id: loan.id,
        application_number: loan.application_number,
        sanctioned_amount: loan.sanctioned_amount || loan.loan_amount || loan.principal_amount || 0,
        disbursed_at: loan.disbursed_at,
        processed_due_date: loan.processed_due_date
      },
      borrower: {
        name: `${loan.first_name || ''} ${loan.last_name || ''}`.trim(),
        first_name: loan.first_name,
        last_name: loan.last_name,
        email: loan.email,
        phone: loan.phone,
        pan_number: loan.pan_number,
        address: address
      },
      extension: {
        extension_number: extensionNumberFromType,
        extension_availed_date: formatDateLocal(today),
        extension_period_till: extensionPeriodTill,
        extension_fee: extensionFee,
        gst_amount: gstAmount,
        interest_till_date: interestTillDate,
        penalty: 0, // No penalty for extension
        total_extension_amount: totalExtensionAmount,
        original_due_date: parseDateToString(originalDueDate) || originalDueDate,
        new_due_date: extensionPeriodTill,
        extension_period_days: finalExtensionPeriodDays, // Days added by this extension (15 days for multi-EMI, calculated for single payment)
        outstanding_loan_balance: outstandingLoanBalance,
        outstanding_loan_balance_after_extension: outstandingLoanBalanceAfterExtension,
        total_tenure_days: totalTenureDays, // Total tenure from disbursement to new due date
        // For multi-EMI loans, include all new EMI dates
        ...(isMultiEmi && allNewEmiDates.length > 0 ? {
          original_emi_dates: allOriginalEmiDates,
          new_emi_dates: allNewEmiDates
        } : {}),
        reason: 'Loan tenure extended as per borrower request.'
      },
      generated_at: new Date().toISOString()
    };

    res.json({
      success: true,
      data: extensionLetterData
    });

  } catch (error) {
    console.error('❌ Error generating extension letter:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate extension letter',
      error: error.message
    });
  }
});

/**
 * POST /api/kfs/:loanId/extension-letter/generate-pdf
 * Generate and download PDF for Extension Letter
 * NOTE: This route must be BEFORE /:loanId to avoid route conflicts
 */
router.post('/:loanId/extension-letter/generate-pdf', authenticateAdmin, async (req, res) => {
  try {
    const { loanId } = req.params;
    const { htmlContent, transactionId, extensionNumber } = req.body;

    if (!htmlContent) {
      return res.status(400).json({
        success: false,
        message: 'HTML content is required'
      });
    }

    if (!loanId) {
      return res.status(400).json({
        success: false,
        message: 'Loan ID is required'
      });
    }

    console.log('📄 Generating Extension Letter PDF for loan ID:', loanId);

    // Get loan data for filename
    let applicationNumber = null;
    let extensionNum = 1;
    try {
      const db = await initializeDatabase();
      
      // Get application number
      const [loans] = await db.execute(
        'SELECT application_number FROM loan_applications WHERE id = ?',
        [loanId]
      );

      if (!loans || loans.length === 0 || !loans[0]) {
        return res.status(404).json({
          success: false,
          message: 'Loan not found'
        });
      }

      applicationNumber = loans[0].application_number || `LOAN_${loanId}`;

      // Get extension number from transaction
      if (transactionId) {
        const [transactions] = await db.execute(
          'SELECT transaction_type FROM transactions WHERE id = ? AND loan_application_id = ?',
          [transactionId, loanId]
        );
        if (transactions && transactions.length > 0) {
          const txType = transactions[0].transaction_type;
          if (txType === 'loan_extension_1st') extensionNum = 1;
          else if (txType === 'loan_extension_2nd') extensionNum = 2;
          else if (txType === 'loan_extension_3rd') extensionNum = 3;
          else if (txType === 'loan_extension_4th') extensionNum = 4;
        }
      } else if (extensionNumber) {
        extensionNum = parseInt(extensionNumber) || 1;
      }
    } catch (dbError) {
      console.error('❌ Database error:', dbError);
      applicationNumber = `LOAN_${loanId}`;
    }

    const ordinals = ['', '1st', '2nd', '3rd', '4th'];
    const filename = `Loan_Tenure_Extension_${ordinals[extensionNum] || extensionNum}_${applicationNumber}.pdf`;

    // Validate PDF service is available
    if (!pdfService) {
      console.error('❌ PDF service is not available');
      return res.status(500).json({
        success: false,
        message: 'PDF service not initialized'
      });
    }

    // Generate PDF
    let pdfResult;
    try {
      if (typeof htmlContent !== 'string' || htmlContent.trim().length === 0) {
        throw new Error('Invalid HTML content provided');
      }

      console.log('📄 Starting Extension Letter PDF generation, HTML length:', htmlContent.length);
      pdfResult = await pdfService.generateKFSPDF(htmlContent, filename);
      
      if (!pdfResult) {
        throw new Error('PDF generation returned null or undefined');
      }
      
      let pdfBuffer;
      if (Buffer.isBuffer(pdfResult)) {
        pdfBuffer = pdfResult;
      } else if (pdfResult.buffer) {
        pdfBuffer = pdfResult.buffer;
      } else {
        throw new Error('PDF generation returned invalid result structure');
      }
      
      if (!Buffer.isBuffer(pdfBuffer)) {
        if (pdfBuffer instanceof Uint8Array || pdfBuffer.constructor?.name === 'Uint8Array') {
          pdfBuffer = Buffer.from(pdfBuffer);
        } else {
          throw new Error('PDF generation returned invalid buffer type');
        }
      }
      
      pdfResult.buffer = pdfBuffer;
      console.log('✅ Extension Letter PDF generated successfully, buffer size:', pdfBuffer.length);
    } catch (pdfError) {
      console.error('❌ Extension Letter PDF generation error:', pdfError);
      if (!res.headersSent) {
        return res.status(500).json({
          success: false,
          message: 'Failed to generate PDF',
          error: pdfError.message || 'PDF generation failed'
        });
      }
      return;
    }

    console.log('📤 Sending Extension Letter PDF, size:', pdfResult.buffer.length, 'bytes');

    // Set headers for download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfResult.buffer.length);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Accept-Ranges', 'bytes');

    // Send PDF buffer directly
    res.end(pdfResult.buffer, 'binary');

    console.log('✅ Extension Letter PDF sent successfully');

  } catch (error) {
    console.error('❌ Error generating Extension Letter PDF:', error);
    
    if (!res.headersSent) {
      const accepts = req.headers.accept || '';
      if (accepts.includes('application/json')) {
        res.status(500).json({
          success: false,
          message: 'Failed to generate Extension Letter PDF',
          error: error.message || 'Unknown error occurred'
        });
      } else {
        res.status(500).setHeader('Content-Type', 'text/plain');
        res.send(`Error generating Extension Letter PDF: ${error.message || 'Unknown error occurred'}`);
      }
    }
  }
});

/**
 * GET /api/kfs/:loanId
 * Admin endpoint to get KFS data for a loan
 */
router.get('/:loanId', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { loanId } = req.params;

    console.log('📄 Generating KFS for loan ID:', loanId);

    // Fetch loan application details including dynamic fees
    // Use DATE() function to extract date portion directly from MySQL (avoids timezone conversion)
    const loans = await executeQuery(`
      SELECT 
        la.*,
        DATE(la.processed_at) as processed_at_date,
        DATE(la.disbursed_at) as disbursed_at_date,
        la.fees_breakdown,
        la.disbursal_amount,
        la.processed_due_date,
        la.emi_schedule,
        la.user_id,
        la.user_bank_id,
        u.first_name, u.last_name, u.email, u.personal_email, u.official_email, u.phone, u.date_of_birth,
        u.gender, u.marital_status, u.pan_number
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

    // Get KYC verification data for masked Aadhar number
    let maskedAadharNumber = 'N/A';
    try {
      const kycVerifications = await executeQuery(`
        SELECT verification_data 
        FROM kyc_verifications 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT 1
      `, [loan.user_id]);

      if (kycVerifications && kycVerifications.length > 0) {
        const verificationData = kycVerifications[0].verification_data;
        let kycData = typeof verificationData === 'string' ? JSON.parse(verificationData) : verificationData;
        
        // Try to get masked Aadhar from various possible locations in the JSON structure
        maskedAadharNumber = kycData?.kycData?.maskedAdharNumber || 
                             kycData?.maskedAdharNumber || 
                             kycData?.masked_adhar_number ||
                             kycData?.uid ||
                             'N/A';
      }
    } catch (kycError) {
      console.error('Error fetching KYC verification for Aadhar:', kycError);
      // Continue with 'N/A' if KYC data not found
    }

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
    // Try to get bank details from user_bank_id first, then fallback to primary bank details
    let bankDetails = null;
    try {
      if (loan.user_bank_id) {
        const bankDetailsQuery = await executeQuery(`
          SELECT bd.* FROM bank_details bd
          WHERE bd.id = ?
          LIMIT 1
        `, [loan.user_bank_id]);
        bankDetails = bankDetailsQuery && bankDetailsQuery.length > 0 ? bankDetailsQuery[0] : null;
      }
      
      // If no bank details from user_bank_id, try to get primary bank details
      if (!bankDetails) {
        const primaryBankQuery = await executeQuery(`
          SELECT bd.* FROM bank_details bd
          WHERE bd.user_id = ? AND bd.is_primary = 1
          LIMIT 1
        `, [loan.user_id]);
        bankDetails = primaryBankQuery && primaryBankQuery.length > 0 ? primaryBankQuery[0] : null;
      }
    } catch (bankError) {
      console.error('Error fetching bank details:', bankError);
      // Continue without bank details - set to null
      bankDetails = null;
    }

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

    // Ensure fees array exists in plan snapshot and fix application_method
    if (!planSnapshot.fees || !Array.isArray(planSnapshot.fees) || planSnapshot.fees.length === 0) {
      // Fees are missing or empty - try to populate from fees_breakdown or loan_plan_fees
      if (feesBreakdown && feesBreakdown.length > 0) {
        planSnapshot.fees = feesBreakdown.map(fee => {
          // Calculate fee_percent from amount if not provided
          let feePercent = fee.fee_percent || fee.percent;
          if (!feePercent && fee.amount && principal > 0) {
            feePercent = (fee.amount / principal) * 100;
          }
          return {
            fee_name: fee.fee_name || fee.name || 'Fee',
            fee_percent: feePercent || 0,
        application_method: fee.application_method || 'deduct_from_disbursal'
          };
        });
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
          } else {
            planSnapshot.fees = [];
          }
        } catch (feeError) {
          console.error(`Error fetching fees from loan_plan_fees for loan #${loanId}:`, feeError);
          planSnapshot.fees = [];
        }
      } else {
        planSnapshot.fees = [];
      }
    } else {
      // Fees exist but may be missing application_method or have wrong value - fix them
      const feesNeedFixing = planSnapshot.fees.some(fee => !fee.application_method);
      if (feesNeedFixing) {
        // Try to get application_method from fees_breakdown by matching fee_name
        if (feesBreakdown && feesBreakdown.length > 0) {
          planSnapshot.fees = planSnapshot.fees.map(fee => {
            const matchingFee = feesBreakdown.find(bf => 
              (bf.fee_name === fee.fee_name || bf.name === fee.fee_name)
            );
            // Calculate fee_percent from amount if not provided
            let feePercent = fee.fee_percent;
            if (!feePercent && matchingFee?.amount && principal > 0) {
              feePercent = (matchingFee.amount / principal) * 100;
            }
            return {
              ...fee,
              fee_percent: feePercent || fee.fee_percent || 0,
              application_method: fee.application_method || matchingFee?.application_method || 'deduct_from_disbursal'
            };
          });
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
            }
          } catch (feeError) {
            console.error(`Error fetching fees from loan_plan_fees for loan #${loanId}:`, feeError);
          }
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
            correctMethod = 'add_to_total';
          }
        } else {
          // Other fees (like "processing fee") should be "deduct_from_disbursal"
          if (!fee.application_method || fee.application_method !== 'deduct_from_disbursal') {
            correctMethod = 'deduct_from_disbursal';
          }
        }
        
        return {
          ...fee,
          application_method: correctMethod
        };
      });
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

    // Determine calculation date - use processed_at for processed loans, otherwise disbursed_at
    // This matches the loan-calculations endpoint behavior
    // Use string-based date parsing to avoid timezone conversion
    let calculationDateStr = null;
    if (loan.processed_at && ['account_manager', 'cleared'].includes(loan.status)) {
      // For processed loans, use processed_at_date (from SQL DATE() function) to avoid timezone issues
      // MySQL DATE() returns as Date object, so we need to parse it using UTC getters
      if (loan.processed_at_date) {
        if (typeof loan.processed_at_date === 'string') {
          calculationDateStr = loan.processed_at_date;
        } else if (loan.processed_at_date instanceof Date) {
          const year = loan.processed_at_date.getUTCFullYear();
          const month = String(loan.processed_at_date.getUTCMonth() + 1).padStart(2, '0');
          const day = String(loan.processed_at_date.getUTCDate()).padStart(2, '0');
          calculationDateStr = `${year}-${month}-${day}`;
        } else {
          calculationDateStr = parseDateToString(loan.processed_at);
        }
      } else {
        calculationDateStr = parseDateToString(loan.processed_at);
      }
    } else if (loan.disbursed_at && ['account_manager', 'cleared', 'active'].includes(loan.status)) {
      // MySQL DATE() returns as Date object, so we need to parse it using UTC getters
      if (loan.disbursed_at_date) {
        if (typeof loan.disbursed_at_date === 'string') {
          calculationDateStr = loan.disbursed_at_date;
        } else if (loan.disbursed_at_date instanceof Date) {
          const year = loan.disbursed_at_date.getUTCFullYear();
          const month = String(loan.disbursed_at_date.getUTCMonth() + 1).padStart(2, '0');
          const day = String(loan.disbursed_at_date.getUTCDate()).padStart(2, '0');
          calculationDateStr = `${year}-${month}-${day}`;
        } else {
          calculationDateStr = parseDateToString(loan.disbursed_at);
        }
      } else {
        calculationDateStr = parseDateToString(loan.disbursed_at);
      }
    } else {
      calculationDateStr = getTodayString();
    }

    // Calculate PLANNED loan term days (for due date and loan_term_days) - always use planned term
    // Use processed_at for processed loans, otherwise disbursed_at
    // Use string-based date parsing to avoid timezone conversion
    let plannedTermCalculationDateStr = null;
    if (loan.processed_at && ['account_manager', 'cleared'].includes(loan.status)) {
      // For processed loans, use processed_at_date (from SQL DATE() function) as base date
      // MySQL DATE() returns as Date object, so we need to parse it using UTC getters
      if (loan.processed_at_date) {
        if (typeof loan.processed_at_date === 'string') {
          plannedTermCalculationDateStr = loan.processed_at_date;
        } else if (loan.processed_at_date instanceof Date) {
          const year = loan.processed_at_date.getUTCFullYear();
          const month = String(loan.processed_at_date.getUTCMonth() + 1).padStart(2, '0');
          const day = String(loan.processed_at_date.getUTCDate()).padStart(2, '0');
          plannedTermCalculationDateStr = `${year}-${month}-${day}`;
        } else {
          plannedTermCalculationDateStr = parseDateToString(loan.processed_at);
        }
      } else {
        plannedTermCalculationDateStr = parseDateToString(loan.processed_at);
      }
    } else if (loan.disbursed_at && ['account_manager', 'cleared', 'active'].includes(loan.status)) {
      // MySQL DATE() returns as Date object, so we need to parse it using UTC getters
      if (loan.disbursed_at_date) {
        if (typeof loan.disbursed_at_date === 'string') {
          plannedTermCalculationDateStr = loan.disbursed_at_date;
        } else if (loan.disbursed_at_date instanceof Date) {
          const year = loan.disbursed_at_date.getUTCFullYear();
          const month = String(loan.disbursed_at_date.getUTCMonth() + 1).padStart(2, '0');
          const day = String(loan.disbursed_at_date.getUTCDate()).padStart(2, '0');
          plannedTermCalculationDateStr = `${year}-${month}-${day}`;
        } else {
          plannedTermCalculationDateStr = parseDateToString(loan.disbursed_at);
        }
      } else {
        plannedTermCalculationDateStr = parseDateToString(loan.disbursed_at);
      }
    } else {
      plannedTermCalculationDateStr = getTodayString();
    }
    const plannedTermResult = calculateInterestDays(planData, userData, plannedTermCalculationDateStr);
    const plannedTermDays = plannedTermResult.days;

    // Use centralized calculation function
    let calculations;
    try {
      calculations = calculateCompleteLoanValues(loanData, planData, userData, {
        calculationDate: calculationDateStr  // Pass string, not Date object
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
    // For processed loans, use processed_at as base date; otherwise use disbursed_at
    // This must match the base date used for EMI date generation
    // Extract date as string first to avoid timezone issues, then convert to Date only when needed
    let baseDateStr;
    if (loan.processed_at && ['account_manager', 'cleared'].includes(loan.status)) {
      // Use processed_at_date if available (from SQL DATE() function), otherwise parse
      // MySQL DATE() returns as Date object, so we need to handle both string and Date
      if (loan.processed_at_date) {
        if (typeof loan.processed_at_date === 'string') {
          baseDateStr = loan.processed_at_date;
        } else if (loan.processed_at_date instanceof Date) {
          // MySQL DATE() returns as Date object - extract UTC components as string
          const year = loan.processed_at_date.getUTCFullYear();
          const month = String(loan.processed_at_date.getUTCMonth() + 1).padStart(2, '0');
          const day = String(loan.processed_at_date.getUTCDate()).padStart(2, '0');
          baseDateStr = `${year}-${month}-${day}`;
        } else {
          baseDateStr = parseDateToString(loan.processed_at) || getTodayString();
        }
      } else {
        baseDateStr = parseDateToString(loan.processed_at) || getTodayString();
      }
    } else {
      if (loan.disbursed_at_date) {
        if (typeof loan.disbursed_at_date === 'string') {
          baseDateStr = loan.disbursed_at_date;
        } else if (loan.disbursed_at_date instanceof Date) {
          const year = loan.disbursed_at_date.getUTCFullYear();
          const month = String(loan.disbursed_at_date.getUTCMonth() + 1).padStart(2, '0');
          const day = String(loan.disbursed_at_date.getUTCDate()).padStart(2, '0');
          baseDateStr = `${year}-${month}-${day}`;
        } else {
          baseDateStr = parseDateToString(loan.disbursed_at) || getTodayString();
        }
      } else {
        baseDateStr = parseDateToString(loan.disbursed_at) || getTodayString();
      }
    }
    
    // Convert string to Date for calendar arithmetic (using parsed components to avoid timezone shift)
    const [year, month, day] = baseDateStr.split('-').map(Number);
    const baseDate = new Date(year, month - 1, day);
    baseDate.setHours(0, 0, 0, 0);
    
    // Initialize emiPeriodDetails for debug logging
    let emiPeriodDetails = [];
    
    let interestForAPR = interest;
    if (emiCount > 1) {
      const interestRatePerDay = calculations.interest.rate_per_day || (interest / (principal * days));
      
      // Generate all EMI dates
      // PRIORITY: For processed loans, use processed_due_date if available (it's the source of truth)
      let allEmiDates = [];
      
      // PRIORITY 1: Check if loan is processed and has processed_due_date
      if (loan.processed_at && loan.processed_due_date) {
        try {
          console.log(`📅 [Admin] Attempting to use processed_due_date: ${loan.processed_due_date}`);
          const parsedDueDate = typeof loan.processed_due_date === 'string' 
            ? JSON.parse(loan.processed_due_date) 
            : loan.processed_due_date;
          
          console.log(`📅 [Admin] Parsed processed_due_date:`, parsedDueDate);
          
          if (Array.isArray(parsedDueDate) && parsedDueDate.length > 0) {
            allEmiDates = parsedDueDate.map(date => {
              if (typeof date === 'string') {
                return date.split('T')[0].split(' ')[0];
              }
              return date;
            });
            console.log(`✅ [Admin] Using processed_due_date for EMI dates: ${allEmiDates.join(', ')}`);
          } else if (typeof parsedDueDate === 'string') {
            allEmiDates = [parsedDueDate.split('T')[0].split(' ')[0]];
            console.log(`✅ [Admin] Using processed_due_date for single payment: ${allEmiDates[0]}`);
          }
        } catch (e) {
          console.error('❌ [Admin] Error parsing processed_due_date:', e, loan.processed_due_date);
        }
      }
      
      // PRIORITY 2: If processed_due_date not available, try emi_schedule
      if (allEmiDates.length === 0 && loan.emi_schedule) {
        try {
          console.log(`📅 [Admin] Attempting to use emi_schedule: ${loan.emi_schedule}`);
          const parsedEmiSchedule = typeof loan.emi_schedule === 'string' 
            ? JSON.parse(loan.emi_schedule) 
            : loan.emi_schedule;
          
          if (Array.isArray(parsedEmiSchedule) && parsedEmiSchedule.length > 0) {
            allEmiDates = parsedEmiSchedule
              .map(emi => emi.due_date)
              .filter(date => date)
              .map(date => {
                if (typeof date === 'string') {
                  return date.split('T')[0].split(' ')[0];
                }
                return date;
              });
            
            if (allEmiDates.length > 0) {
              console.log(`✅ [Admin] Using emi_schedule for EMI dates: ${allEmiDates.join(', ')}`);
            }
          }
        } catch (e) {
          console.error('❌ [Admin] Error parsing emi_schedule:', e, loan.emi_schedule);
        }
      }
      
      // PRIORITY 3: If allEmiDates is still empty, calculate from plan data
      if (allEmiDates.length === 0 && planData.emi_frequency === 'monthly' && planData.calculate_by_salary_date && userData.salary_date) {
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
            allEmiDates.push(formatDateLocal(emiDate));
          }
          
          // Debug: Log generated EMI dates
          console.log('📅 [Admin] Generated EMI Dates:', allEmiDates);
          
          // Update firstDueDate to match the first EMI date for consistency
          if (allEmiDates.length > 0) {
            const [y, m, d] = allEmiDates[0].split('-').map(Number);
            firstDueDate = new Date(y, m - 1, d);
          }
        }
      } else if (allEmiDates.length === 0) {
        // For non-salary date Multi-EMI, calculate based on frequency
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
          // allEmiDates contains date strings (YYYY-MM-DD), use directly
          const emiDateStr = allEmiDates[i];
          
          // Calculate days for this EMI period using string-based calculation
          // First period (disbursement to first EMI): inclusive
          // Subsequent periods: start from day AFTER previous EMI date (e.g., 1 Feb if previous was 31 Jan)
          let previousDateStr;
          if (i === 0) {
            // Use baseDateStr (disbursement/processed date as string) directly
            // This avoids any timezone conversion issues
            previousDateStr = baseDateStr || getTodayString();
          } else {
            // Start from day AFTER previous EMI date
            const prevEmiDateStr = allEmiDates[i - 1];
            if (prevEmiDateStr) {
              // Parse date string and add 1 day
              const [year, month, day] = prevEmiDateStr.split('-').map(Number);
              const nextDate = new Date(year, month - 1, day + 1);
              previousDateStr = formatDateToString(nextDate);
            } else {
              previousDateStr = getTodayString();
            }
          }
          
          // Use calculateDaysBetween for accurate calendar day calculation (inclusive)
          const daysForPeriod = calculateDaysBetween(previousDateStr, emiDateStr);
          
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
            previousDate: previousDateStr,
            emiDate: emiDateStr,
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
      disbursementDate: baseDateStr || getTodayString(),
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
        email: loan.personal_email || loan.official_email || loan.email || 'N/A',
        phone: loan.phone || 'N/A',
        date_of_birth: loan.date_of_birth,
        gender: loan.gender || 'N/A',
        marital_status: loan.marital_status || 'N/A',
        pan_number: loan.pan_number || 'N/A',
        aadhar_number: maskedAadharNumber,
        pan: loan.pan_number || 'N/A',
        aadhar: maskedAadharNumber,
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
          // For processed loans, use processed_at as base date; otherwise use disbursed_at
          // This must match the base date used for EMI date generation and interest calculation
          // Use baseDateStr (already calculated above) for schedule generation to avoid timezone issues
          const baseDateStrForSchedule = baseDateStr || getTodayString();
          
          for (let i = 0; i < emiCount; i++) {
            // Get EMI date (allEmiDates contains date strings in YYYY-MM-DD format)
            const emiDateStr = allEmiDates[i];
            
            // Calculate days for this period using string-based calculation
            let previousDateStr;
            if (i === 0) {
              // Use baseDateStrForSchedule directly to avoid timezone conversion
              previousDateStr = baseDateStrForSchedule;
            } else {
              // Start from day AFTER previous EMI date
              const prevEmiDateStr = allEmiDates[i - 1];
              if (prevEmiDateStr) {
                // Parse date string and add 1 day
                const [year, month, day] = prevEmiDateStr.split('-').map(Number);
                const nextDate = new Date(year, month - 1, day + 1);
                previousDateStr = formatDateToString(nextDate);
              } else {
                previousDateStr = getTodayString();
              }
            }
            
            // Use calculateDaysBetween for accurate calendar day calculation (inclusive)
            const daysForPeriod = calculateDaysBetween(previousDateStr, emiDateStr);
            
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
              due_date: emiDateStr // Use date string directly (already in YYYY-MM-DD format)
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

      // Bank Details
      bank_details: bankDetails ? {
        bank_name: bankDetails.bank_name || 'N/A',
        account_number: bankDetails.account_number || 'N/A',
        ifsc_code: bankDetails.ifsc_code || 'N/A',
        account_holder_name: bankDetails.account_holder_name || 'N/A'
      } : null,

      // Generated metadata
      // Use processed_at date for processed loans, otherwise disbursed_at or today
      // Format as YYYY-MM-DD string to avoid timezone conversion
      generated_at: (() => {
        if (loan.processed_at && ['account_manager', 'cleared'].includes(loan.status)) {
          return loan.processed_at_date || parseDateToString(loan.processed_at) || getTodayString();
        } else if (loan.disbursed_at && ['account_manager', 'cleared', 'active'].includes(loan.status)) {
          return loan.disbursed_at_date || parseDateToString(loan.disbursed_at) || getTodayString();
        }
        return getTodayString();
      })(),
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

    if (!loanId) {
      return res.status(400).json({
        success: false,
        message: 'Loan ID is required'
      });
    }

    console.log('📄 Generating PDF for loan ID:', loanId);

    // Get loan data for filename
    let applicationNumber = null;
    try {
    const db = await initializeDatabase();
    const [loans] = await db.execute(
      'SELECT application_number FROM loan_applications WHERE id = ?',
      [loanId]
    );

      if (!loans || loans.length === 0 || !loans[0]) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      });
    }

      applicationNumber = loans[0].application_number || `LOAN_${loanId}`;
    } catch (dbError) {
      console.error('❌ Database error:', dbError);
      // Use fallback filename if DB query fails
      applicationNumber = `LOAN_${loanId}`;
    }

    const filename = `KFS_${applicationNumber}.pdf`;

    // Validate PDF service is available
    if (!pdfService) {
      console.error('❌ PDF service is not available');
      return res.status(500).json({
        success: false,
        message: 'PDF service not initialized'
      });
    }

    // Generate PDF
    let pdfResult;
    try {
      // Validate HTML content
      if (typeof htmlContent !== 'string' || htmlContent.trim().length === 0) {
        throw new Error('Invalid HTML content provided');
      }

      console.log('📄 Starting PDF generation, HTML length:', htmlContent.length);
      console.log('📄 HTML preview (first 200 chars):', htmlContent.substring(0, 200));
      
      pdfResult = await pdfService.generateKFSPDF(htmlContent, filename);
      
      if (!pdfResult) {
        throw new Error('PDF generation returned null or undefined');
      }
      
      // Debug: Log the structure of pdfResult
      console.log('📊 pdfResult type:', typeof pdfResult);
      console.log('📊 pdfResult keys:', Object.keys(pdfResult || {}));
      console.log('📊 pdfResult.buffer type:', typeof pdfResult.buffer);
      console.log('📊 pdfResult.buffer is Buffer?', Buffer.isBuffer(pdfResult.buffer));
      
      // Check if pdfResult is a Buffer (direct return) or an object with buffer property
      let pdfBuffer;
      if (Buffer.isBuffer(pdfResult)) {
        // Direct buffer return
        pdfBuffer = pdfResult;
        console.log('📊 Using direct buffer return');
      } else if (pdfResult.buffer) {
        // Object with buffer property
        pdfBuffer = pdfResult.buffer;
        console.log('📊 Using buffer from object property');
      } else {
        console.error('❌ pdfResult structure:', JSON.stringify(Object.keys(pdfResult || {})));
        throw new Error('PDF generation returned invalid result structure');
      }
      
      // Validate buffer
      if (!pdfBuffer) {
        console.error('❌ pdfBuffer is null or undefined');
        throw new Error('PDF generation returned null buffer');
      }
      
      // Puppeteer returns Uint8Array, not Buffer - convert it
      if (!Buffer.isBuffer(pdfBuffer)) {
        // Check if it's a Uint8Array (which Puppeteer returns)
        if (pdfBuffer instanceof Uint8Array || pdfBuffer.constructor?.name === 'Uint8Array') {
          console.log('📊 Converting Uint8Array to Buffer');
          pdfBuffer = Buffer.from(pdfBuffer);
        } else {
          console.error('❌ Invalid buffer type:', typeof pdfBuffer, 'Is Buffer?', Buffer.isBuffer(pdfBuffer));
          console.error('❌ pdfBuffer constructor:', pdfBuffer?.constructor?.name);
          throw new Error('PDF generation returned invalid buffer type');
        }
      }
      
      // Update pdfResult to have the buffer for consistency
      pdfResult.buffer = pdfBuffer;

      console.log('✅ PDF generated successfully, buffer size:', pdfBuffer.length);
    } catch (pdfError) {
      console.error('❌ PDF generation error:', pdfError);
      console.error('Error details:', {
        message: pdfError.message,
        stack: pdfError.stack,
        name: pdfError.name,
        cause: pdfError.cause
      });
      
      // Ensure we haven't sent headers yet
      if (!res.headersSent) {
        // Since frontend uses responseType: 'blob', we need to send error in a way that can be parsed
        // But for now, send JSON and let frontend handle it
        return res.status(500).json({
          success: false,
          message: 'Failed to generate PDF',
          error: pdfError.message || 'PDF generation failed',
          details: process.env.NODE_ENV === 'development' ? pdfError.stack : undefined
        });
      } else {
        console.error('⚠️ Cannot send error response - headers already sent');
      }
      return;
    }

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
    console.error('Error stack:', error.stack);
    
    // Check if response has already been sent
    if (!res.headersSent) {
      // Since frontend expects blob, send error as text/plain or JSON
      // But first check if client accepts JSON
      const accepts = req.headers.accept || '';
      
      if (accepts.includes('application/json')) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate PDF',
          error: error.message || 'Unknown error occurred'
    });
      } else {
        // Send as plain text error message
        res.status(500).setHeader('Content-Type', 'text/plain');
        res.send(`Error generating PDF: ${error.message || 'Unknown error occurred'}`);
      }
    } else {
      console.error('⚠️ Response already sent, cannot send error response');
    }
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

/**
 * POST /api/kfs/:loanId/generate-and-save
 * Generate KFS PDF, upload to S3, save URL, and send email
 * No e-signature needed - just PDF generation and storage
 */
router.post('/:loanId/generate-and-save', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const { loanId } = req.params;
    const userId = req.userId;
    const { htmlContent } = req.body;

    console.log('📄 Generating KFS PDF for loan ID:', loanId, 'User ID:', userId);

    // Verify loan belongs to user
    const loans = await executeQuery(`
      SELECT 
        la.id, la.user_id, la.application_number, la.loan_amount, la.status,
        u.email, u.first_name, u.last_name, u.personal_email, u.official_email
      FROM loan_applications la
      INNER JOIN users u ON la.user_id = u.id
      WHERE la.id = ? AND la.user_id = ?
    `, [loanId, userId]);

    if (!loans || loans.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Loan application not found or access denied'
      });
    }

    const loan = loans[0];

    if (!htmlContent) {
      return res.status(400).json({
        success: false,
        message: 'HTML content is required to generate PDF'
      });
    }

    // Generate PDF
    const filename = `KFS_${loan.application_number}.pdf`;
    console.log('📄 Generating KFS PDF:', filename);
    
    let pdfResult;
    try {
      pdfResult = await pdfService.generateKFSPDF(htmlContent, filename);
      console.log('✅ PDF generated successfully, size:', pdfResult.buffer.length, 'bytes');
    } catch (pdfError) {
      console.error('❌ Error generating PDF:', pdfError);
      return res.status(500).json({
        success: false,
        message: 'Failed to generate PDF: ' + pdfError.message
      });
    }

    // Upload to S3
    console.log('📤 Uploading KFS PDF to S3...');
    let s3Key = null;
    try {
      const uploadResult = await uploadGeneratedPDF(
        pdfResult.buffer,
        filename,
        userId,
        'kfs'
      );
      
      if (uploadResult.success) {
        s3Key = uploadResult.key;
        console.log('✅ KFS PDF uploaded to S3:', s3Key);
      } else {
        console.error('❌ Failed to upload KFS PDF to S3:', uploadResult.error);
        return res.status(500).json({
          success: false,
          message: 'Failed to upload PDF to S3: ' + (uploadResult.error || 'Unknown error')
        });
      }
    } catch (s3Error) {
      console.error('❌ Error uploading KFS PDF to S3:', s3Error);
      return res.status(500).json({
        success: false,
        message: 'Failed to upload PDF to S3: ' + s3Error.message
      });
    }

    // Save S3 key to database
    console.log('💾 Saving KFS PDF URL to database...');
    try {
      await executeQuery(
        `UPDATE loan_applications 
         SET kfs_pdf_url = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [s3Key, loanId]
      );
      console.log('✅ KFS PDF URL saved to database');
    } catch (dbError) {
      console.error('❌ Error saving KFS PDF URL to database:', dbError);
      // Continue anyway - we still want to send email
    }

    // Send email with PDF attachment
    console.log('📧 Sending KFS email...');
    try {
      const recipientEmail = loan.personal_email || loan.official_email || loan.email;
      const recipientName = `${loan.first_name || ''} ${loan.last_name || ''}`.trim() || 'User';

      if (recipientEmail) {
        await emailService.sendKFSEmail({
          loanId: loan.id,
          recipientEmail: recipientEmail,
          recipientName: recipientName,
          loanData: {
            application_number: loan.application_number,
            sanctioned_amount: loan.loan_amount,
            loan_term_days: 30, // Default - could be fetched from plan
            status: loan.status
          },
          pdfBuffer: pdfResult.buffer,
          pdfFilename: filename,
          sentBy: userId // User ID who triggered it
        });
        console.log('✅ KFS email sent successfully to:', recipientEmail);
      } else {
        console.warn('⚠️ No email address found for user, skipping email');
      }
    } catch (emailError) {
      console.error('❌ Error sending KFS email (non-fatal):', emailError.message);
      // Continue - email failure shouldn't block the process
    }

    res.json({
      success: true,
      message: 'KFS PDF generated, saved to S3, and email sent successfully',
      data: {
        s3Key: s3Key,
        filename: filename,
        pdfSize: pdfResult.buffer.length,
        emailSent: !!loan.email || !!loan.personal_email || !!loan.official_email
      }
    });

  } catch (error) {
    console.error('❌ Error in generate-and-save KFS:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate and save KFS: ' + error.message
    });
  }
});

/**
 * DUPLICATE ROUTES REMOVED - These routes are now defined earlier in the file (before /:loanId)
 * GET /:loanId/extension-letter is at line 1355
 * POST /:loanId/extension-letter/generate-pdf is at line 1551
 */

module.exports = router;

