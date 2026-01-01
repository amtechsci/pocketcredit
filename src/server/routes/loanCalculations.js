const express = require('express');
const router = express.Router();
const { authenticateAdmin } = require('../middleware/auth');
const { initializeDatabase } = require('../config/database');
const {
  calculateTotalDays,
  calculateLoanValues,
  calculateCompleteLoanValues,
  getLoanCalculation,
  updateLoanCalculation
} = require('../utils/loanCalculations');
const { executeQuery } = require('../config/database');

/**
 * GET /api/loan-calculations/:loanId
 * Get complete calculated values for a loan using centralized function
 * Query params:
 *   - customDays: Optional custom days for calculation
 *   - calculationDate: Optional date to calculate from (ISO format)
 */
router.get('/:loanId', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const loanId = parseInt(req.params.loanId);
    const customDays = req.query.customDays ? parseInt(req.query.customDays) : null;
    const calculationDate = req.query.calculationDate ? new Date(req.query.calculationDate) : null;
    
    console.log(`📊 Fetching loan calculation for loan ID: ${loanId}`);
    
    if (isNaN(loanId)) {
      console.error(`❌ Invalid loan ID: ${req.params.loanId}`);
      return res.status(400).json({
        success: false,
        message: 'Invalid loan ID'
      });
    }
    
    // Fetch loan data
    const loans = await executeQuery(
      `SELECT 
        id, loan_amount, status, disbursed_at, plan_snapshot,
        interest_percent_per_day, fees_breakdown, user_id
      FROM loan_applications 
      WHERE id = ?`,
      [loanId]
    );
    
    if (!loans || loans.length === 0) {
      console.error(`❌ Loan not found: ${loanId}`);
      return res.status(404).json({
        success: false,
        message: `Loan with ID ${loanId} not found`
      });
    }
    
    console.log(`✅ Loan found: ${loanId}, status: ${loans[0].status}`);
    
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
    
    // If no plan snapshot, try to get plan from fees_breakdown or use defaults
    if (!planSnapshot) {
      // Try to get plan from fees_breakdown
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
    
    const options = {
      customDays: customDays,
      calculationDate: calculationDate
    };
    
    // Calculate using centralized function
    const calculation = calculateCompleteLoanValues(loanData, planData, userData, options);
    
    // For multi-EMI loans, recalculate interest by summing from each EMI period
    if (planData.emi_count && planData.emi_count > 1) {
      const principal = calculation.principal;
      const emiCount = planData.emi_count;
      const interestRatePerDay = calculation.interest.rate_per_day;
      
      // Generate EMI dates to calculate interest per period
      const { getNextSalaryDate, getSalaryDateForMonth } = require('../utils/loanCalculations');
      
      let allEmiDates = [];
      let baseDate;
      if (loan.disbursed_at) {
        // Parse date to avoid timezone issues
        try {
          const d = new Date(loan.disbursed_at);
          if (isNaN(d.getTime())) {
            throw new Error('Invalid date');
          }
          // Create a new date using UTC values as local values
          baseDate = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0);
        } catch (e) {
          console.error('Error parsing disbursed_at date:', e);
          baseDate = new Date();
          baseDate.setHours(0, 0, 0, 0);
        }
      } else {
        baseDate = new Date();
        baseDate.setHours(0, 0, 0, 0);
      }
      
      console.log(`📅 Base Date (Disbursed): ${baseDate.getFullYear()}-${String(baseDate.getMonth()+1).padStart(2,'0')}-${String(baseDate.getDate()).padStart(2,'0')}`);
      
      if (planData.emi_frequency === 'monthly' && planData.calculate_by_salary_date && userData.salary_date) {
        const salaryDate = parseInt(userData.salary_date);
        if (salaryDate >= 1 && salaryDate <= 31) {
          let nextSalaryDate = getNextSalaryDate(baseDate, salaryDate);
          const minDuration = planData.repayment_days || 15;
          const daysToNextSalary = Math.ceil((nextSalaryDate.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          if (daysToNextSalary < minDuration) {
            nextSalaryDate = getSalaryDateForMonth(nextSalaryDate, salaryDate, 1);
          }
          for (let i = 0; i < emiCount; i++) {
            const emiDate = getSalaryDateForMonth(nextSalaryDate, salaryDate, i);
            emiDate.setHours(0, 0, 0, 0); // Normalize to midnight
            allEmiDates.push(emiDate);
          }
          const formatDateLocal = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
          console.log(`📅 EMI Dates: ${allEmiDates.map(formatDateLocal).join(', ')}`);
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
          const emiDate = new Date(allEmiDates[i]);
          emiDate.setHours(0, 0, 0, 0);
          
          let previousDate;
          if (i === 0) {
            previousDate = new Date(baseDate);
            previousDate.setHours(0, 0, 0, 0);
          } else {
            previousDate = new Date(allEmiDates[i - 1]);
            previousDate.setHours(0, 0, 0, 0);
            previousDate.setDate(previousDate.getDate() + 1);
          }
          
          // Calculate days difference (inclusive of both start and end dates)
          const msPerDay = 1000 * 60 * 60 * 24;
          const daysDiff = Math.round((emiDate.getTime() - previousDate.getTime()) / msPerDay);
          const daysForPeriod = daysDiff + 1; // +1 for inclusive counting
          const principalForThisEmi = i === emiCount - 1 
            ? Math.round((principalPerEmi + remainder) * 100) / 100
            : principalPerEmi;
          
          const interestForPeriod = Math.round(outstandingPrincipal * interestRatePerDay * daysForPeriod * 100) / 100;
          totalInterest += interestForPeriod;
          
          const formatDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
          console.log(`📊 EMI ${i + 1}: ${formatDate(previousDate)} to ${formatDate(emiDate)} = ${daysForPeriod} days, Outstanding ₹${outstandingPrincipal}, Interest ₹${interestForPeriod}`);
          
          // Add to schedule
          const instalmentAmount = Math.round((principalForThisEmi + interestForPeriod) * 100) / 100;
          schedule.push({
            emi_number: i + 1,
            due_date: formatDate(emiDate),
            principal: principalForThisEmi,
            interest: interestForPeriod,
            instalment_amount: instalmentAmount,
            days: daysForPeriod
          });
          
          outstandingPrincipal = Math.round((outstandingPrincipal - principalForThisEmi) * 100) / 100;
        }
        
        console.log(`✅ Total Interest (sum of all EMI periods): ₹${totalInterest}`);
        
        // Update interest and total repayable
        calculation.interest.amount = totalInterest;
        
        console.log(`💰 Calculation breakdown:`);
        console.log(`   Principal: ₹${principal}`);
        console.log(`   Total Interest: ₹${totalInterest}`);
        console.log(`   Repayable Fee: ₹${calculation.totals.repayableFee}`);
        console.log(`   Repayable Fee GST: ₹${calculation.totals.repayableFeeGST}`);
        
        calculation.total.repayable = principal + totalInterest + calculation.totals.repayableFee + calculation.totals.repayableFeeGST;
        calculation.total.breakdown = `Principal (₹${principal.toFixed(2)}) + Interest (₹${totalInterest.toFixed(2)}) + Repayable Fees (₹${(calculation.totals.repayableFee + calculation.totals.repayableFeeGST).toFixed(2)}) = ₹${calculation.total.repayable.toFixed(2)}`;
        
        console.log(`   💵 Total Repayable: ₹${calculation.total.repayable}`);
        
        // Add repayment schedule to calculation
        if (!calculation.repayment) {
          calculation.repayment = {};
        }
        calculation.repayment.schedule = schedule;
        
        console.log(`📊 Multi-EMI loan ${loanId}: Recalculated with ${schedule.length} EMI periods`);
      }
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

