const express = require('express');
const { executeQuery, initializeDatabase } = require('../config/database');
const { requireAuth } = require('../middleware/jwtAuth');
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
    let fees = [];
    let totalDeductFromDisbursal = 0;
    let totalAddToTotal = 0;
    
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
    
    if (planFees.length > 0) {
      // Use fees assigned to the plan
      for (const planFee of planFees) {
        const feePercent = parseFloat(planFee.fee_percent);
        const feeAmount = Math.round((loanAmount * feePercent) / 100);
        
        fees.push({
          fee_name: planFee.fee_name,
          fee_percent: feePercent.toString(),
          application_method: planFee.application_method,
          fee_amount: feeAmount
        });
        
        if (planFee.application_method === 'deduct_from_disbursal') {
          totalDeductFromDisbursal += feeAmount;
        } else if (planFee.application_method === 'add_to_total') {
          totalAddToTotal += feeAmount;
        }
      }
    } else {
      // Fallback: Use default processing fee if no fees assigned
      totalDeductFromDisbursal = Math.round((loanAmount * 10) / 100); // Default 10%
      fees = [{
        fee_name: 'Processing Fee',
        fee_percent: '10',
        application_method: 'deduct_from_disbursal',
        fee_amount: totalDeductFromDisbursal
      }];
    }
    
    // Calculate total fees for display
    const processingFee = totalDeductFromDisbursal; // For backward compatibility

    // Calculate repayment days based on plan settings
    let totalDays = plan.total_duration_days || plan.repayment_days || 15;
    let actualRepaymentDays = plan.repayment_days || 15;
    
    // If plan is configured to calculate by salary date, adjust repayment days
    // For single payment plans, this adjusts the repayment date
    // For multi-EMI plans, this will be used to set the first EMI date
    if (plan.calculate_by_salary_date === 1 && user.salary_date) {
      // Only adjust repayment days for single payment plans
      if (plan.plan_type === 'single') {
        const salaryDate = parseInt(user.salary_date);
        if (salaryDate >= 1 && salaryDate <= 31) {
          const today = new Date();
          today.setHours(0, 0, 0, 0); // Normalize to start of day
          
          // Helper function to get next valid salary date
          const getNextSalaryDate = (startDate, targetDay) => {
            let year = startDate.getFullYear();
            let month = startDate.getMonth();
            let day = targetDay;
            
            // Create date for this month's salary date
            let salaryDate = new Date(year, month, day);
            
            // If salary date has passed or is today, move to next month
            if (salaryDate <= startDate) {
              month += 1;
              if (month > 11) {
                month = 0;
                year += 1;
              }
              salaryDate = new Date(year, month, day);
            }
            
            // Handle edge case: if day doesn't exist in month (e.g., Feb 31), use last day of month
            if (salaryDate.getDate() !== day) {
              // Get last day of the month
              const lastDay = new Date(year, month + 1, 0).getDate();
              salaryDate = new Date(year, month, Math.min(day, lastDay));
            }
            
            return salaryDate;
          };
          
          // Calculate next salary date
          let nextSalaryDate = getNextSalaryDate(today, salaryDate);
          
          // Calculate days from today to next salary date
          let daysToNextSalary = Math.ceil((nextSalaryDate - today) / (1000 * 60 * 60 * 24));
          
          // If days to next salary date is less than required duration, extend to following month
          if (daysToNextSalary < actualRepaymentDays) {
            // Keep adding months until we reach or exceed the required duration
            let targetSalaryDate = new Date(nextSalaryDate);
            let daysToTarget = daysToNextSalary;
            
            while (daysToTarget < actualRepaymentDays) {
              targetSalaryDate = getNextSalaryDate(
                new Date(targetSalaryDate.getFullYear(), targetSalaryDate.getMonth() + 1, 1),
                salaryDate
              );
              daysToTarget = Math.ceil((targetSalaryDate - today) / (1000 * 60 * 60 * 24));
            }
            
            totalDays = daysToTarget;
            actualRepaymentDays = daysToTarget;
          } else {
            totalDays = daysToNextSalary;
            actualRepaymentDays = daysToNextSalary;
          }
        } else {
          // Invalid salary date, use default
          console.warn(`Invalid salary date for user ${userId}: ${user.salary_date}`);
          totalDays = 30;
          actualRepaymentDays = 30;
        }
      }
      // For multi-EMI plans, salary date logic is handled in the EMI schedule generation below
    } else if (plan.plan_type === 'single' && plan.calculate_by_salary_date === 1 && !user.salary_date) {
      // If calculate by salary date is enabled but user has no salary date, use default 30 days
      totalDays = 30;
      actualRepaymentDays = 30;
    }

    // Calculate interest based on plan duration
    // Interest = Principal × Interest Rate (decimal) × Days
    // Note: interestPercentPerDay is already in decimal format (e.g., 0.001 = 0.1% per day)
    const totalInterest = Math.round(loanAmount * interestPercentPerDay * totalDays);

    // Calculate total repayable (Principal + Interest + Fees that add to total)
    // Fees with 'deduct_from_disbursal' are deducted upfront, not added to repayment
    // Fees with 'add_to_total' are added to the total repayable amount
    const totalRepayable = loanAmount + totalInterest + totalAddToTotal;
    
    // Calculate disbursal amount (loan amount minus fees that deduct from disbursal)
    const disbursalAmount = loanAmount - totalDeductFromDisbursal;

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
      
      // If calculate_by_salary_date is enabled and user has salary date, start from next salary date
      if (plan.calculate_by_salary_date === 1 && user.salary_date) {
        const salaryDate = parseInt(user.salary_date);
        if (salaryDate >= 1 && salaryDate <= 31) {
          // Helper function to get next valid salary date
          const getNextSalaryDate = (startDate, targetDay) => {
            let year = startDate.getFullYear();
            let month = startDate.getMonth();
            let day = targetDay;
            
            // Create date for this month's salary date
            let salaryDate = new Date(year, month, day);
            
            // If salary date has passed or is today, move to next month
            if (salaryDate <= startDate) {
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
          };
          
          // Get next salary date as the start date for first EMI
          startDate = getNextSalaryDate(startDate, salaryDate);
        }
      }

      // Generate EMI schedule starting from startDate
      for (let i = 0; i < plan.emi_count; i++) {
        const dueDate = new Date(startDate);
        
        // Calculate due date based on EMI frequency
        if (plan.emi_frequency === 'daily') {
          dueDate.setDate(dueDate.getDate() + i);
        } else if (plan.emi_frequency === 'weekly') {
          dueDate.setDate(dueDate.getDate() + (i * 7));
        } else if (plan.emi_frequency === 'biweekly') {
          dueDate.setDate(dueDate.getDate() + (i * 14));
        } else if (plan.emi_frequency === 'monthly') {
          // For monthly, add months and adjust to salary date
          dueDate.setMonth(dueDate.getMonth() + i);
          if (plan.calculate_by_salary_date === 1 && user.salary_date) {
            const salaryDate = parseInt(user.salary_date);
            if (salaryDate >= 1 && salaryDate <= 31) {
              // Set to the salary date of that month
              const lastDay = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0).getDate();
              dueDate.setDate(Math.min(salaryDate, lastDay));
            }
          }
        }
        
        emiSchedule.push({
          emi_number: i + 1,
          emi_amount: i === plan.emi_count - 1 ? lastEmiAmount : emiAmount,
          due_date: dueDate.toISOString().split('T')[0],
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
      // Single payment plan
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + actualRepaymentDays);
      
      emiDetails = {
        repayment_date: dueDate.toISOString().split('T')[0],
        repayment_days: actualRepaymentDays
      };
    }

    // Get late penalty structure for the loan plan
    const latePenalties = await executeQuery(
      'SELECT days_overdue_start, days_overdue_end, penalty_percent, tier_order FROM late_penalty_tiers WHERE loan_plan_id = ? ORDER BY tier_order ASC',
      [plan.id]
    );
    
    const lateFeeStructure = latePenalties.map((lp) => ({
      tier_name: `Day ${lp.days_overdue_start}${lp.days_overdue_end ? `-${lp.days_overdue_end}` : '+'}`,
      days_overdue_start: lp.days_overdue_start,
      days_overdue_end: lp.days_overdue_end,
      fee_type: 'percentage',
      fee_value: lp.penalty_percent
    }));

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
        fees: fees.map(f => ({
          name: f.fee_name,
          percent: parseFloat(f.fee_percent),
          application_method: f.application_method,
          amount: f.application_method === 'deduct_from_disbursal' 
            ? Math.round((loanAmount * parseFloat(f.fee_percent)) / 100)
            : Math.round((loanAmount * parseFloat(f.fee_percent)) / 100)
        })),
        total_deduct_from_disbursal: totalDeductFromDisbursal,
        total_add_to_total: totalAddToTotal,
        disbursal_amount: disbursalAmount,
          interest: totalInterest,
          interest_rate: `${interestPercentPerDay}% per day for ${totalDays} days`,
          interest_percent_per_day: interestPercentPerDay, // Add raw numeric value
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

