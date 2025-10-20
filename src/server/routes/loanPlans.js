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

    // Get user's member tier (if assigned)
    const userTiers = await executeQuery(
      'SELECT tier_name FROM member_tiers WHERE id = (SELECT member_tier_id FROM users WHERE id = ?)',
      [userId]
    );
    const userTierName = userTiers.length > 0 ? userTiers[0].tier_name : null;

    // Fetch active loan plans
    const plans = await executeQuery(
      'SELECT * FROM loan_plans WHERE is_active = 1 ORDER BY plan_order ASC'
    );

    console.log('Available plans:', plans.length);
    console.log('User credit score:', userCreditScore);
    console.log('User employment type:', userEmploymentType);
    console.log('User tier name:', userTierName);

    // Filter plans based on user eligibility
    const eligiblePlans = plans.filter(plan => {
      console.log(`Checking plan: ${plan.plan_name}`);
      
      // Check credit score
      if (plan.min_credit_score && userCreditScore < plan.min_credit_score) {
        console.log(`  ✗ Failed credit score check: ${userCreditScore} < ${plan.min_credit_score}`);
        return false;
      }

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

      // Check member tier - only if plan has tier restrictions AND user has a tier
      if (plan.eligible_member_tiers) {
        try {
          const eligibleTiers = JSON.parse(plan.eligible_member_tiers);
          // Only filter if there are actual tier restrictions
          if (Array.isArray(eligibleTiers) && eligibleTiers.length > 0) {
            // If user has no tier, they can't access tier-restricted plans
            if (!userTierName) {
              console.log(`  ⚠ Plan has tier restrictions but user has no tier assigned`);
              // For now, allow access if plan doesn't have strict tier requirements
            } else if (!eligibleTiers.includes(userTierName)) {
              console.log(`  ✗ Failed tier check: ${userTierName} not in`, eligibleTiers);
              return false;
            }
          }
        } catch (e) {
          console.log(`  ⚠ Could not parse eligible_member_tiers`);
          // If JSON parse fails, skip this check
        }
      }

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

    // Get user's member tier for interest and processing fee rates
    const users = await executeQuery(
      `SELECT u.*, mt.processing_fee_percent, mt.interest_percent_per_day, mt.tier_name
       FROM users u
       LEFT JOIN member_tiers mt ON u.member_tier_id = mt.id
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
    
    // Use default rates if user doesn't have a tier assigned
    const processingFeePercent = user.processing_fee_percent || 10; // Default 10% (Bronze tier)
    const interestPercentPerDay = user.interest_percent_per_day || 0.001; // Default 0.001 (0.1% per day)

    const loanAmount = parseFloat(loan_amount);
    
    // Calculate processing fee (deducted from principal upfront)
    const processingFee = Math.round((loanAmount * processingFeePercent) / 100);

    // Calculate interest based on plan duration
    // Interest = Principal × Interest Rate (decimal) × Days
    // Note: interestPercentPerDay is already in decimal format (e.g., 0.001 = 0.1% per day)
    const totalDays = plan.total_duration_days || plan.repayment_days || 15;
    const totalInterest = Math.round(loanAmount * interestPercentPerDay * totalDays);

    // Calculate total repayable (Principal + Interest)
    // Processing fee is deducted upfront, not added to repayment
    const totalRepayable = loanAmount + totalInterest;

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

      for (let i = 0; i < plan.emi_count; i++) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + (daysBetweenEmis * (i + 1)));
        
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
      dueDate.setDate(dueDate.getDate() + plan.repayment_days);
      
      emiDetails = {
        repayment_date: dueDate.toISOString().split('T')[0],
        repayment_days: plan.repayment_days
      };
    }

    // Get late fee structure for user's tier
    let lateFeeStructure = [];
    if (user.member_tier_id) {
      lateFeeStructure = await executeQuery(
        'SELECT tier_name, days_overdue_start, days_overdue_end, fee_type, fee_value FROM late_fee_tiers WHERE member_tier_id = ? ORDER BY tier_order ASC',
        [user.member_tier_id]
      );
    }

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
          processing_fee_percent: processingFeePercent,
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

