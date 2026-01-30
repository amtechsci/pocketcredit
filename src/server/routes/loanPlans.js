const express = require('express');
const { executeQuery, initializeDatabase } = require('../config/database');
const { requireAuth } = require('../middleware/jwtAuth');
const { calculateCompleteLoanValues, getNextSalaryDate, getSalaryDateForMonth, formatDateToString, calculateDaysBetween } = require('../utils/loanCalculations');
const router = express.Router();

/**
 * GET /api/loan-plans/available - Get available loan plans for current user
 */
router.get('/available', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;

    // Get user details
    const users = await executeQuery(
      'SELECT credit_score, employment_type FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];
    const userCreditScore = user.credit_score || 0;
    const userEmploymentType = user.employment_type || 'salaried';

    // Member tier check removed - plans are now open to all users
    const userTierName = null;

    // Fetch active loan plans
    const plans = await executeQuery(
      'SELECT * FROM loan_plans WHERE is_active = 1 ORDER BY id ASC'
    );

    console.log('Available plans:', plans.length);
    console.log('User credit score:', userCreditScore);
    console.log('User employment type:', userEmploymentType);
    console.log('User tier name:', userTierName);

    // Filter plans based on user eligibility
    const eligiblePlans = plans.filter(plan => {
      console.log(`Checking plan: ${plan.plan_name}`);
      
      // Check employment type
      if (plan.eligible_employment_types && plan.eligible_employment_types.trim()) {
        try {
          let eligibleTypes = plan.eligible_employment_types;
          
          // If it's a string, try to parse it as JSON
          if (typeof eligibleTypes === 'string') {
            eligibleTypes = JSON.parse(eligibleTypes);
          }
          
          console.log(`  Plan eligible_employment_types (parsed):`, eligibleTypes);
          console.log(`  User employment_type:`, userEmploymentType);
          
          if (Array.isArray(eligibleTypes) && eligibleTypes.length > 0) {
            // If user has no employment type, allow plan (for backward compatibility)
            if (!userEmploymentType) {
              console.log(`  ⚠ User has no employment type set, allowing plan`);
            } else if (!eligibleTypes.includes(userEmploymentType)) {
              console.log(`  ✗ Failed employment type check: "${userEmploymentType}" not in [${eligibleTypes.join(', ')}]`);
              return false;
            } else {
              console.log(`  ✓ Employment type check passed: "${userEmploymentType}" is in eligible list`);
            }
          }
        } catch (e) {
          console.log(`  ⚠ Could not parse eligible_employment_types (${e.message}), allowing plan`);
          // If JSON parse fails, allow the plan
        }
      } else {
        console.log(`  ℹ No employment type restrictions (eligible_employment_types is null/empty)`);
      }

      // Member tier check removed - plans are now open to all users

      console.log(`  ✓ Plan eligible`);
      return true;
    });

    console.log('Eligible plans:', eligiblePlans.length);

    res.json({
      success: true,
      data: eligiblePlans,
      debug: {
        total_plans: plans.length,
        eligible_count: eligiblePlans.length,
        user_info: {
          credit_score: userCreditScore,
          employment_type: userEmploymentType,
          tier_name: userTierName
        }
      }
    });
  } catch (error) {
    console.error('Get available plans error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available loan plans',
      error: error.message
    });
  }
});

/**
 * POST /api/loan-plans/calculate - Calculate loan repayment details
 */
router.post('/calculate', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;
    const { loan_amount, plan_id } = req.body;

    if (!loan_amount || !plan_id) {
      return res.status(400).json({
        success: false,
        message: 'loan_amount and plan_id are required'
      });
    }

    // Get loan plan
    const plans = await executeQuery(
      'SELECT * FROM loan_plans WHERE id = ? AND is_active = 1',
      [plan_id]
    );

    if (plans.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Loan plan not found or inactive'
      });
    }

    const plan = plans[0];

    // Get user's salary date and basic info
    const users = await executeQuery(
      `SELECT u.*
       FROM users u
       WHERE u.id = ?`,
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];
    
    // Use interest rate from plan, or default if not set
    const interestPercentPerDay = plan.interest_percent_per_day ? parseFloat(plan.interest_percent_per_day) : 0.001;

    const loanAmount = parseFloat(loan_amount);
    
    // Fetch fees assigned to this loan plan
    const planFees = await executeQuery(
      `SELECT 
        lpf.fee_percent,
        ft.fee_name,
        ft.application_method,
        ft.description
       FROM loan_plan_fees lpf
       INNER JOIN fee_types ft ON lpf.fee_type_id = ft.id
       WHERE lpf.loan_plan_id = ? AND ft.is_active = 1
       ORDER BY ft.fee_name ASC`,
      [plan_id]
    );
    
    // Prepare fees array for centralized calculation
    const fees = planFees.length > 0 
      ? planFees.map(pf => ({
          fee_name: pf.fee_name,
          fee_percent: parseFloat(pf.fee_percent),
          application_method: pf.application_method
        }))
      : [{
          fee_name: 'Processing Fee',
          fee_percent: 10,
          application_method: 'deduct_from_disbursal'
        }];
    
    // Prepare data for centralized calculation
    const loanData = {
      loan_amount: loanAmount,
      loan_id: null, // Preview calculation, no loan ID yet
      status: 'preview',
      disbursed_at: null
    };
    
    const planData = {
      plan_id: plan.id,
      plan_type: plan.plan_type,
      repayment_days: plan.repayment_days || null,
      total_duration_days: plan.total_duration_days || plan.repayment_days || null,
      interest_percent_per_day: parseFloat(plan.interest_percent_per_day || 0.001),
      calculate_by_salary_date: plan.calculate_by_salary_date === 1 || plan.calculate_by_salary_date === true,
      emi_count: plan.emi_count || null,
      emi_frequency: plan.emi_frequency || null,
      fees: fees
    };
    
    const userData = {
      user_id: user.id,
      salary_date: user.salary_date
    };
    
    // Use centralized calculation function
    const calculations = calculateCompleteLoanValues(loanData, planData, userData, {
      calculationDate: new Date() // Use today for preview
    });
    
    // Extract values for response
    const disbursalAmount = calculations.disbursal.amount;
    const totalRepayable = calculations.total.repayable;
    const totalInterest = calculations.interest.amount;
    const totalDays = calculations.interest.days;
    
    // Format fees for backward compatibility
    const formattedFees = calculations.fees.deductFromDisbursal.concat(calculations.fees.addToTotal).map(fee => ({
      fee_name: fee.fee_name,
      fee_percent: fee.fee_percent.toString(),
      application_method: fee.application_method,
      fee_amount: fee.fee_amount,
      gst_amount: fee.gst_amount,
      total_with_gst: fee.total_with_gst
    }));
    
    // For backward compatibility
    const processingFee = calculations.totals.disbursalFee;

    // Calculate EMI details if multi-EMI plan
    let emiDetails = null;
    if (plan.plan_type === 'multi_emi') {
      const emiAmount = Math.round(totalRepayable / plan.emi_count);
      const lastEmiAmount = totalRepayable - (emiAmount * (plan.emi_count - 1));

      // Generate EMI schedule
      const emiSchedule = [];
      const daysPerEmi = {
        daily: 1,
        weekly: 7,
        biweekly: 14,
        monthly: 30
      };
      const daysBetweenEmis = daysPerEmi[plan.emi_frequency];

      // Determine start date for EMI schedule
      let startDate = new Date();
      startDate.setHours(0, 0, 0, 0); // Normalize to start of day
      
      // Check if calculate_by_salary_date is enabled (handle both boolean and integer values)
      const useSalaryDate = plan.calculate_by_salary_date === 1 || plan.calculate_by_salary_date === true;
      
      console.log(`📅 [EMI Schedule] User salary_date: ${user.salary_date}, Plan calculate_by_salary_date: ${plan.calculate_by_salary_date} (useSalaryDate: ${useSalaryDate}), emi_frequency: ${plan.emi_frequency}`);
      
      // If calculate_by_salary_date is enabled and user has salary date, start from next salary date
      if (useSalaryDate && user.salary_date && plan.emi_frequency === 'monthly') {
        const salaryDate = parseInt(user.salary_date);
        if (salaryDate >= 1 && salaryDate <= 31) {
          // Get next salary date
          let nextSalaryDate = getNextSalaryDate(startDate, salaryDate);
          
          // Calculate days from start date to next salary date (INCLUSIVE) using accurate calculation
          const startDateStr = formatDateToString(startDate);
          const nextSalaryDateStr = formatDateToString(nextSalaryDate);
          let daysToNextSalary = calculateDaysBetween(startDateStr, nextSalaryDateStr);
          
          // If duration (repayment_days) is set and days to next salary is less than duration, extend to next month
          const minDuration = plan.repayment_days || 15;
          console.log(`📅 [EMI Schedule] Next salary date: ${nextSalaryDate.toISOString()}, daysToNextSalary: ${daysToNextSalary}, minDuration: ${minDuration}`);
          
          if (daysToNextSalary < minDuration) {
            // Move to next month's salary date
            nextSalaryDate = getSalaryDateForMonth(startDate, salaryDate, 1);
            const extendedDateStr = formatDateToString(nextSalaryDate);
            const extendedDays = calculateDaysBetween(startDateStr, extendedDateStr);
            console.log(`📅 [EMI Schedule] Extended to next month: ${nextSalaryDate.toISOString()}, extendedDays: ${extendedDays}`);
          }
          
          startDate = nextSalaryDate;
        }
      } else if (useSalaryDate && user.salary_date) {
        // For non-monthly frequencies, just use next salary date as starting point
        const salaryDate = parseInt(user.salary_date);
        if (salaryDate >= 1 && salaryDate <= 31) {
          startDate = getNextSalaryDate(startDate, salaryDate);
        }
      }
      
      console.log(`📅 [EMI Schedule] Final startDate for EMI generation: ${startDate.toISOString()}`);

      // Generate EMI schedule starting from startDate
      for (let i = 0; i < plan.emi_count; i++) {
        let dueDate;
        
        // Calculate due date based on EMI frequency
        if (plan.emi_frequency === 'daily') {
          dueDate = new Date(startDate);
          dueDate.setDate(dueDate.getDate() + i);
        } else if (plan.emi_frequency === 'weekly') {
          dueDate = new Date(startDate);
          dueDate.setDate(dueDate.getDate() + (i * 7));
        } else if (plan.emi_frequency === 'biweekly') {
          dueDate = new Date(startDate);
          dueDate.setDate(dueDate.getDate() + (i * 14));
        } else if (plan.emi_frequency === 'monthly') {
          // For monthly with salary date, use getSalaryDateForMonth to handle edge cases
          if (useSalaryDate && user.salary_date) {
            const salaryDate = parseInt(user.salary_date);
            if (salaryDate >= 1 && salaryDate <= 31) {
              // Get salary date for the i-th month from startDate
              dueDate = getSalaryDateForMonth(startDate, salaryDate, i);
            } else {
              dueDate = new Date(startDate);
              dueDate.setMonth(dueDate.getMonth() + i);
            }
          } else {
            dueDate = new Date(startDate);
            dueDate.setMonth(dueDate.getMonth() + i);
          }
        } else {
          dueDate = new Date(startDate);
        }
        
        // Use local date formatting to avoid timezone issues with toISOString()
        const year = dueDate.getFullYear();
        const month = String(dueDate.getMonth() + 1).padStart(2, '0');
        const day = String(dueDate.getDate()).padStart(2, '0');
        const dueDateStr = `${year}-${month}-${day}`;
        
        emiSchedule.push({
          emi_number: i + 1,
          emi_amount: i === plan.emi_count - 1 ? lastEmiAmount : emiAmount,
          due_date: dueDateStr,
          status: 'pending'
        });
      }

      emiDetails = {
        emi_amount: emiAmount,
        last_emi_amount: lastEmiAmount,
        emi_count: plan.emi_count,
        emi_frequency: plan.emi_frequency,
        schedule: emiSchedule
      };
    } else {
      // Single payment plan - use repayment date from calculation
      const repaymentDate = calculations.interest.repayment_date 
        ? new Date(calculations.interest.repayment_date)
        : new Date();
      
      emiDetails = {
        repayment_date: repaymentDate.toISOString().split('T')[0],
        repayment_days: totalDays
      };
    }

    // Get late penalty structure for the loan plan
    const latePenalties = await executeQuery(
      'SELECT days_overdue_start, days_overdue_end, penalty_percent, tier_order FROM late_penalty_tiers WHERE loan_plan_id = ? ORDER BY tier_order ASC',
      [plan.id]
    );
    
    const lateFeeStructure = latePenalties.map((lp) => {
      const penaltyPercent = parseFloat(lp.penalty_percent);
      const gstPercent = 18; // 18% GST on penalty
      const totalPercent = penaltyPercent + (penaltyPercent * gstPercent / 100);
      
      return {
        tier_name: `Day ${lp.days_overdue_start}${lp.days_overdue_end ? `-${lp.days_overdue_end}` : '+'}`,
        days_overdue_start: lp.days_overdue_start,
        days_overdue_end: lp.days_overdue_end,
        fee_type: 'percentage',
        fee_value: lp.penalty_percent,
        gst_percent: gstPercent,
        total_percent_with_gst: totalPercent
      };
    });

    res.json({
      success: true,
      data: {
        plan: {
          id: plan.id,
          name: plan.plan_name,
          code: plan.plan_code,
          type: plan.plan_type,
          duration_days: totalDays
        },
        loan_amount: loanAmount,
        processing_fee: processingFee,
        interest: totalInterest,
        total_repayable: totalRepayable,
        emi_details: emiDetails,
        late_fee_structure: lateFeeStructure,
        breakdown: {
          principal: loanAmount,
          processing_fee: processingFee,
          fees: formattedFees.map(f => ({
            name: f.fee_name,
            percent: parseFloat(f.fee_percent),
            application_method: f.application_method,
            amount: f.fee_amount,
            gst_amount: f.gst_amount,
            total_with_gst: f.total_with_gst
          })),
          total_deduct_from_disbursal: calculations.totals.disbursalFee + calculations.totals.disbursalFeeGST,
          total_add_to_total: calculations.totals.repayableFee + calculations.totals.repayableFeeGST,
          disbursal_amount: disbursalAmount,
          interest: totalInterest,
          interest_rate: `${(calculations.interest.rate_per_day * 100).toFixed(4)}% per day for ${totalDays} days`,
          interest_percent_per_day: calculations.interest.rate_per_day,
          total: totalRepayable
        }
      }
    });
  } catch (error) {
    console.error('Calculate loan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate loan details'
    });
  }
});

module.exports = router;

