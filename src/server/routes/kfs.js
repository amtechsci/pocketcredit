const express = require('express');
const router = express.Router();
const { authenticateAdmin } = require('../middleware/auth');
const { requireAuth } = require('../middleware/jwtAuth');
const { initializeDatabase, executeQuery } = require('../config/database');
const { calculateLoanValues, calculateTotalDays, calculateCompleteLoanValues } = require('../utils/loanCalculations');
const pdfService = require('../services/pdfService');
const emailService = require('../services/emailService');

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
    // Fetch full loan application details
    const fullLoans = await executeQuery(`
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
    const userData = {
      user_id: loan.user_id,
      salary_date: loan.salary_date || null
    };
    
    // For repayment schedule: calculate interest based on actual days elapsed from disbursed date
    // If loan has been disbursed, use actual days from disbursed_at to today
    let calculationOptions = {};
    if (loan.disbursed_at && ['account_manager', 'cleared', 'active', 'disbursal'].includes(loan.status)) {
      // Calculate actual days from disbursed date to today (inclusive)
      const actualDays = calculateTotalDays(loan.disbursed_at);
      calculationOptions = {
        customDays: actualDays,
        calculationDate: new Date() // Use today as calculation date
      };
      console.log(`📅 Loan disbursed on ${loan.disbursed_at}, calculating interest for ${actualDays} days (from disbursed date to today)`);
    }
    
    // Calculate loan values with actual days if disbursed, otherwise use plan days
    const loanValues = calculateCompleteLoanValues(loanData, planData, userData, calculationOptions);
    
    // Parse fees breakdown if it's a JSON string
    let feesBreakdown = [];
    if (loan.fees_breakdown) {
      try {
        feesBreakdown = typeof loan.fees_breakdown === 'string' 
          ? JSON.parse(loan.fees_breakdown) 
          : loan.fees_breakdown;
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
        loan_term_days: loan.loan_term_days || loanPlan.tenure_days || loanPlan.repayment_days || loanPlan.total_duration_days || 0,
        loan_term_months: Math.ceil((loan.loan_term_days || loanPlan.tenure_days || loanPlan.repayment_days || loanPlan.total_duration_days || 0) / 30),
        interest_rate: loan.interest_rate || loanPlan.base_interest_rate || 0,
        repayment_frequency: loanPlan.repayment_frequency || 'Monthly'
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
      interest: {
        rate: loan.interest_rate || loanPlan.base_interest_rate || 0,
        rate_per_day: planData.interest_percent_per_day || loanPlan.interest_percent_per_day || 0.001,
        type: 'Reducing Balance',
        calculation_method: 'Daily',
        annual_rate: ((planData.interest_percent_per_day || loanPlan.interest_percent_per_day || 0.001) * 365 * 100).toFixed(2),
        days: loanValues.interest?.days || 0,
        amount: loanValues.interest?.amount || 0
      },
      fees: {
        processing_fee: loanValues.totals?.disbursalFee || loanValues.processingFee || 0,
        gst: (loanValues.totals?.disbursalFeeGST || 0) + (loanValues.totals?.repayableFeeGST || 0) || loanValues.processingFeeGST || 0,
        total_add_to_total: loanValues.totals?.repayableFee || loanValues.totalAddToTotal || 0,
        fees_breakdown: feesBreakdown
      },
      calculations: {
        principal: loanValues.principal || loan.sanctioned_amount || loan.principal_amount || loan.loan_amount || 0,
        interest: loanValues.interest?.amount || loanValues.totalInterest || 0,
        total_repayable: loanValues.total?.repayable || loanValues.totalRepayableAmount || 0,
        total_amount: loanValues.total?.repayable || loanValues.totalRepayableAmount || 0,
        disbursed_amount: loanValues.disbursal?.amount || loan.disbursal_amount || 0,
        netDisbursalAmount: loanValues.disbursal?.amount || loan.disbursal_amount || 0,
        emi: loanValues.emiAmount || 0
      },
      repayment: {
        emi_amount: loanValues.emiAmount || 0,
        total_emis: Math.ceil((loan.loan_term_days || loanPlan.tenure_days || 0) / 30),
        first_emi_date: loan.first_emi_date || 'N/A',
        last_emi_date: loan.last_emi_date || 'N/A'
      },
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
      generated_at: new Date().toISOString()
    };
    
    console.log('✅ KFS data generated successfully for user');
    
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
    
    // Parse fees breakdown if available
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
    
    // Determine calculation date - use disbursed_at if loan is disbursed, otherwise use today
    const calculationDate = loan.disbursed_at && ['account_manager', 'cleared', 'active'].includes(loan.status)
      ? new Date(loan.disbursed_at)
      : new Date();
    
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
    const processingFee = calculations.totals.disbursalFee;
    const gst = calculations.totals.disbursalFeeGST + calculations.totals.repayableFeeGST;
    const disbAmount = calculations.disbursal.amount;
    const interest = calculations.interest.amount;
    const days = calculations.interest.days;
    const totalRepayable = calculations.total.repayable;
    
    // Calculate APR (Annual Percentage Rate)
    // APR = ((All Fees + GST + Interest) / Loan Amount) / Days * 36500
    const totalCharges = processingFee + gst + calculations.totals.repayableFee + interest;
    const apr = days > 0 ? ((totalCharges / principal) / days) * 36500 : 0;
    
    // Generate due date from repayment date or calculate
    let dueDate;
    if (calculations.interest.repayment_date) {
      dueDate = new Date(calculations.interest.repayment_date);
    } else {
      const today = new Date();
      dueDate = new Date(today);
      dueDate.setDate(today.getDate() + days);
    }
    
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
        loan_term_days: days,
        status: loan.status,
        created_at: loan.created_at,
        applied_date: loan.created_at,
        approved_date: loan.approved_at,
        disbursed_date: loan.disbursed_at,
        due_date: dueDate.toISOString()
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
        total_interest: interest,
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
            fee_name: fee.fee_name,
            fee_percent: fee.fee_percent,
            fee_amount: fee.fee_amount,
            gst_amount: fee.gst_amount,
            total_with_gst: fee.total_with_gst,
            application_method: 'add_to_total'
          }))
        ],
        total_deduct_from_disbursal: calculations.totals.disbursalFee,
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
        interest: interest,
        total_repayable: totalRepayable,
        apr: parseFloat(apr.toFixed(2))
      },
      
      // Repayment Schedule
      repayment: {
        type: 'Bullet Payment',
        number_of_instalments: 1,
        instalment_amount: totalRepayable,
        first_due_date: dueDate.toISOString(),
        schedule: [
          {
            instalment_no: 1,
            outstanding_principal: principal,
            principal: principal,
            interest: interest,
            instalment_amount: totalRepayable,
            due_date: dueDate.toISOString()
          }
        ]
      },
      
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
          name: 'Mr. Rajesh Kumar',
          phone: '+91 9876543210',
          email: 'grievance@pocketcredit.in'
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
        recovery_clause: '1(X)',
        grievance_clause: '12'
      },
      
      // Generated metadata
      generated_at: new Date().toISOString(),
      generated_by: req.admin?.id || 'system'
    };
    
    console.log('✅ KFS data generated successfully');
    
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

