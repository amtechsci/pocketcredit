const express = require('express');
const { requireAuth } = require('../middleware/jwtAuth');
const { authenticateAdmin } = require('../middleware/auth');
const { executeQuery, initializeDatabase } = require('../config/database');
const {
  checkExtensionEligibility,
  calculateNewDueDate,
  calculateExtensionFees,
  calculateOutstandingBalance,
  MAX_EXTENSIONS
} = require('../utils/extensionCalculations');
const { 
  parseDateToString, 
  getTodayString, 
  formatDateToString,
  calculateDaysBetween,
  getNextSalaryDate,
  getSalaryDateForMonth,
  toDecimal2
} = require('../utils/loanCalculations');

const router = express.Router();
const { approveExtension } = require('../utils/extensionApproval');

/**
 * GET /api/loan-extensions/eligibility/:loanId
 * Check if loan is eligible for extension
 */
router.get('/eligibility/:loanId', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const { loanId } = req.params;
    const userId = req.user.id;

    // Get loan details
    const loans = await executeQuery(`
      SELECT 
        la.*,
        u.salary_date
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

    // Count only APPROVED/COMPLETED extensions (not pending, failed, rejected, etc.)
    const approvedExtensions = await executeQuery(`
      SELECT COUNT(*) as count
      FROM loan_extensions
      WHERE loan_application_id = ? AND status IN ('approved', 'completed')
    `, [loanId]);
    
    const actualExtensionCount = approvedExtensions && approvedExtensions.length > 0 
      ? parseInt(approvedExtensions[0].count) || 0 
      : 0;
    
    // Override extension_count in loan object with actual approved count
    loan.extension_count = actualExtensionCount;

    // Check for pending extension request (both 'pending' and 'pending_payment')
    const pendingExtension = await executeQuery(`
      SELECT id, extension_number, DATE_FORMAT(created_at, '%Y-%m-%d') as created_at, status
      FROM loan_extensions
      WHERE loan_application_id = ? AND (status = 'pending' OR status = 'pending_payment')
      ORDER BY created_at DESC
      LIMIT 1
    `, [loanId]);

    // Check eligibility (now using actual approved extension count)
    const eligibility = checkExtensionEligibility(loan, null, 0);

    // If there's a pending extension, override eligibility
    if (pendingExtension && pendingExtension.length > 0) {
      const extension = pendingExtension[0];
      
      // If status is pending_payment, check for payment order
      let paymentOrder = null;
      if (extension.status === 'pending_payment') {
        const paymentOrders = await executeQuery(`
          SELECT id, order_id, status, amount, 
          DATE_FORMAT(created_at, '%Y-%m-%d') as created_at, 
          DATE_FORMAT(updated_at, '%Y-%m-%d') as updated_at
          FROM payment_orders
          WHERE loan_id = ? AND payment_type = 'extension_fee' AND extension_id = ?
          ORDER BY created_at DESC
          LIMIT 1
        `, [loanId, extension.id]);
        
        if (paymentOrders && paymentOrders.length > 0) {
          paymentOrder = paymentOrders[0];
        }
      }
      
      return res.json({
        success: true,
        data: {
          eligible: false,
          has_pending_request: true,
          pending_extension: {
            id: extension.id,
            extension_number: extension.extension_number,
            requested_at: extension.created_at,
            status: extension.status,
            payment_order: paymentOrder
          },
          reason: extension.status === 'pending_payment' 
            ? 'Extension payment is pending. Please check payment status.'
            : 'A loan extension request is already pending approval',
          extensionWindow: eligibility.extensionWindow
        }
      });
    }

    // If eligible, calculate extension details
    let extensionDetails = null;
    if (eligibility.eligible) {
      try {
        const fees = calculateExtensionFees(loan);
        extensionDetails = {
          extension_fee: fees.extensionFee,
          gst_amount: fees.gstAmount,
          interest_till_date: fees.interestTillDate,
          total_amount: fees.totalExtensionAmount
        };
      } catch (error) {
        console.error('Error calculating extension fees:', error);
        // Continue without extension details
      }
    }

    // Get due date for response
    let dueDate = null;
    if (loan.processed_due_date) {
      try {
        const parsed = typeof loan.processed_due_date === 'string' 
          ? JSON.parse(loan.processed_due_date) 
          : loan.processed_due_date;
        if (Array.isArray(parsed) && parsed.length > 0) {
          dueDate = parsed[0];
        } else if (typeof parsed === 'string') {
          dueDate = parsed.split('T')[0].split(' ')[0];
        }
      } catch (e) {
        if (typeof loan.processed_due_date === 'string') {
          dueDate = loan.processed_due_date.split('T')[0].split(' ')[0];
        }
      }
    }

    res.json({
      success: true,
      data: {
        is_eligible: eligibility.eligible,
        can_extend: eligibility.eligible,
        extension_count: actualExtensionCount, // Use actual approved extension count
        max_extensions: MAX_EXTENSIONS,
        extension_window: eligibility.extensionWindow || {},
        due_date: dueDate,
        is_first_emi: true, // Only first EMI can be extended
        extension_details: extensionDetails
      }
    });
  } catch (error) {
    console.error('Error checking extension eligibility:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check extension eligibility',
      error: error.message
    });
  }
});

/**
 * POST /api/loan-extensions/request
 * Request a loan extension
 */
router.post('/request', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.user.id;
    const { loan_application_id, reason } = req.body;

    if (!loan_application_id) {
      return res.status(400).json({
        success: false,
        message: 'Loan application ID is required'
      });
    }

    // Get loan details with all necessary fields for calculations
    // Note: la.* already includes all columns, so explicit fields are redundant but kept for clarity
    const loans = await executeQuery(`
      SELECT 
        la.*,
        u.salary_date
      FROM loan_applications la
      INNER JOIN users u ON la.user_id = u.id
      WHERE la.id = ? AND la.user_id = ?
    `, [loan_application_id, userId]);

    if (!loans || loans.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      });
    }

    const loan = loans[0];

    console.log(`📋 Extension request for loan ${loan_application_id}:`);
    console.log(`   processed_at: ${loan.processed_at}`);
    console.log(`   processed_due_date: ${loan.processed_due_date}`);
    console.log(`   plan_snapshot exists: ${!!loan.plan_snapshot}`);

    // Check eligibility
    const eligibility = checkExtensionEligibility(loan, null, 0);
    if (!eligibility.eligible) {
      return res.status(400).json({
        success: false,
        message: eligibility.reason || 'Loan is not eligible for extension'
      });
    }

    // Calculate extension number
    const extensionNumber = (loan.extension_count || 0) + 1;
    if (extensionNumber > MAX_EXTENSIONS) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${MAX_EXTENSIONS} extensions already availed`
      });
    }

    // Parse plan snapshot
    const planSnapshot = typeof loan.plan_snapshot === 'string' 
      ? JSON.parse(loan.plan_snapshot) 
      : loan.plan_snapshot;
    
    console.log(`   Plan snapshot parsed: emi_count=${planSnapshot.emi_count}, calculate_by_salary_date=${planSnapshot.calculate_by_salary_date}, repayment_days=${planSnapshot.repayment_days}`);

    // Get original due date(s) - for multi-EMI, get all EMI dates
    let originalDueDate = null;
    let originalEmiDates = null;
    const isMultiEmi = (planSnapshot.emi_count || 1) > 1;
    
    if (loan.processed_due_date) {
      try {
        const parsed = typeof loan.processed_due_date === 'string' 
          ? JSON.parse(loan.processed_due_date) 
          : loan.processed_due_date;
        
        if (Array.isArray(parsed) && parsed.length > 0) {
          originalEmiDates = parsed;
          originalDueDate = isMultiEmi ? parsed[0] : parsed[parsed.length - 1]; // First EMI for multi, last for single
        } else if (typeof parsed === 'string') {
          originalDueDate = parsed.split('T')[0].split(' ')[0];
          if (!isMultiEmi) {
            originalEmiDates = [originalDueDate];
          }
        }
      } catch (e) {
        if (typeof loan.processed_due_date === 'string') {
          originalDueDate = loan.processed_due_date.split('T')[0].split(' ')[0];
          if (!isMultiEmi) {
            originalEmiDates = [originalDueDate];
          }
        }
      }
    }

    // If processed_due_date is null, calculate it from plan snapshot and processed_at
    if (!originalDueDate && loan.processed_at) {
      
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
          // Use plan repayment_days (default 7) for minimum days to first salary date
          const minDuration = planSnapshot.repayment_days || planSnapshot.total_duration_days || 7;
          const firstDueDateStr = formatDateToString(firstDueDate);
          const daysToFirstSalary = calculateDaysBetween(processedAtStr, firstDueDateStr);
          
          if (daysToFirstSalary < minDuration) {
            firstDueDate = getSalaryDateForMonth(firstDueDateStr, salaryDate, 1);
          }
          
          // Generate all EMI dates
          const emiCount = planSnapshot.emi_count || 1;
          originalEmiDates = [];
          for (let i = 0; i < emiCount; i++) {
            const emiDate = getSalaryDateForMonth(firstDueDate, salaryDate, i);
            originalEmiDates.push(formatDateToString(emiDate));
          }
          
          originalDueDate = originalEmiDates[0]; // First EMI for extension
        } else if (!isMultiEmi && usesSalaryDate && salaryDate && salaryDate >= 1 && salaryDate <= 31) {
          // Single payment with salary date
          const nextSalaryDate = getNextSalaryDate(baseDate, salaryDate);
          const minDuration = planSnapshot.repayment_days || 7;
          const nextSalaryDateStr = formatDateToString(nextSalaryDate);
          const daysToSalary = calculateDaysBetween(processedAtStr, nextSalaryDateStr);
          
          if (daysToSalary < minDuration) {
            originalDueDate = formatDateToString(getSalaryDateForMonth(nextSalaryDateStr, salaryDate, 1));
          } else {
            originalDueDate = nextSalaryDateStr;
          }
          originalEmiDates = [originalDueDate];
          console.log(`📅 Calculated single payment due date from plan snapshot: ${originalDueDate}`);
        } else {
          // Fixed days plan
          const repaymentDays = planSnapshot.repayment_days || planSnapshot.total_duration_days || 7;
          const dueDate = new Date(baseDate);
          dueDate.setDate(dueDate.getDate() + repaymentDays);
          dueDate.setHours(0, 0, 0, 0);
          
          if (isMultiEmi) {
            // For multi-EMI fixed days, calculate all EMI dates
            const emiCount = planSnapshot.emi_count || 1;
            const daysPerEmi = { daily: 1, weekly: 7, biweekly: 14, monthly: 30 };
            const emiFrequency = planSnapshot.emi_frequency || 'monthly';
            const daysBetween = daysPerEmi[emiFrequency] || 30;
            
            originalEmiDates = [];
            for (let i = 0; i < emiCount; i++) {
              const emiDate = new Date(baseDate);
              if (emiFrequency === 'monthly') {
                emiDate.setMonth(emiDate.getMonth() + i);
              } else {
                emiDate.setDate(emiDate.getDate() + repaymentDays + (i * daysBetween));
              }
              emiDate.setHours(0, 0, 0, 0);
              originalEmiDates.push(formatDateToString(emiDate));
            }
            originalDueDate = originalEmiDates[0]; // First EMI for extension
          } else {
            originalDueDate = formatDateToString(dueDate);
            originalEmiDates = [originalDueDate];
            console.log(`📅 Calculated single payment due date (fixed days): ${originalDueDate}`);
          }
        }
      }
    }
    
    // Final fallback to processed_at only if we still don't have a due date
    if (!originalDueDate) {
      if (loan.processed_at) {
        originalDueDate = parseDateToString(loan.processed_at);
        if (!originalDueDate && typeof loan.processed_at === 'string') {
          originalDueDate = loan.processed_at.split('T')[0].split(' ')[0];
        }
        originalEmiDates = originalDueDate ? [originalDueDate] : [];
        console.log(`⚠️ Using processed_at as final fallback: Original due date = ${originalDueDate}`);
      } else {
        console.error(`❌ Cannot calculate due date: processed_at is null, processed_due_date is null, and plan snapshot calculation failed`);
        console.error(`   Loan ID: ${loan.id}, processed_at: ${loan.processed_at}, processed_due_date: ${loan.processed_due_date}`);
        console.error(`   Plan snapshot:`, JSON.stringify(planSnapshot, null, 2));
      }
    }

    if (!originalDueDate) {
      return res.status(400).json({
        success: false,
        message: 'Due date not found. Please ensure the loan has been processed.'
      });
    }
    
    console.log(`✅ Extension request - Original due date: ${originalDueDate}, Original EMI dates: ${JSON.stringify(originalEmiDates)}`);

    // Calculate new due date
    const extensionDate = getTodayString();
    const newDueDateResult = calculateNewDueDate(
      loan,
      originalDueDate,
      planSnapshot,
      loan.salary_date,
      originalEmiDates // Pass original EMI dates array
    );

    // Calculate extension fees
    const fees = calculateExtensionFees(loan, extensionDate);

    // CRITICAL: Recalculate interest using the correct principal priority order
    // This ensures we use the correct principal value, not a potentially wrong processed_amount
    // Priority: sanctioned_amount > principal_amount > loan_amount > processed_amount
    const principal = parseFloat(
      loan.sanctioned_amount || 
      loan.principal_amount || 
      loan.loan_amount || 
      loan.processed_amount || 
      0
    );
    
    const processedDateStr = parseDateToString(loan.processed_at);
    
    // Validate principal is reasonable
    if (principal > 0 && principal <= 1000000 && processedDateStr) {
      const interestDays = calculateDaysBetween(processedDateStr, extensionDate);
      const interestRatePerDay = parseFloat(planSnapshot.interest_percent_per_day || loan.processed_interest_percent_per_day || 0.001);
      const recalculatedInterest = toDecimal2(principal * interestRatePerDay * interestDays);
      
      // Override with recalculated interest using correct principal
      fees.interestTillDate = recalculatedInterest;
      fees.interestDays = interestDays; // Store days for logging
      
      // Recalculate total extension amount with correct interest (penalty will be added later)
      fees.totalExtensionAmount = toDecimal2(fees.extensionFee + fees.gstAmount + recalculatedInterest);
      
    } else {
      console.error(`⚠️ ERROR: Cannot recalculate interest - processedDateStr=${processedDateStr}, principal=${principal}`);
    }

    // Calculate penalty if overdue (similar to kfs.js extension letter calculation)
    // IMPORTANT: Always recalculate penalty using late_fee_structure (don't use processed_penalty from database)
    let penaltyAmount = 0;
    let penaltyBase = 0;
    let penaltyGST = 0;
    
    // Helper functions for penalty calculation
    const parseDueDates = (dueDateStr) => {
      if (!dueDateStr) return [];
      try {
        const parsed = typeof dueDateStr === 'string' ? JSON.parse(dueDateStr) : dueDateStr;
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch (e) {
        return typeof dueDateStr === 'string' ? [dueDateStr] : [];
      }
    };
    
    const isOverdue = (dueDateStr, currentDate) => {
      if (!dueDateStr) return false;
      const dueDate = new Date(dueDateStr);
      dueDate.setHours(0, 0, 0, 0);
      currentDate.setHours(0, 0, 0, 0);
      return dueDate < currentDate;
    };
    
    const calculateDaysInclusive = (startDate, endDate) => {
      const msPerDay = 1000 * 60 * 60 * 24;
      return Math.ceil((endDate - startDate) / msPerDay) + 1;
    };
    
    // Parse late_fee_structure from loan
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
      }
    } catch (e) {
      console.error('Error parsing late_fee_structure:', e);
    }
    
    // Calculate penalty using late_fee_structure
    const calculatePenalty = (principal, daysOverdue, lateFeeStructure) => {
      if (daysOverdue <= 0) return { penaltyBase: 0, penaltyGST: 0, penaltyTotal: 0 };
      
      if (!lateFeeStructure || !Array.isArray(lateFeeStructure) || lateFeeStructure.length === 0) {
        return { penaltyBase: 0, penaltyGST: 0, penaltyTotal: 0 };
      }
      
      let penaltyBase = 0;
      
      const sortedTiers = [...lateFeeStructure].sort((a, b) => {
        const orderA = a.tier_order !== undefined ? a.tier_order : (a.days_overdue_start || 0);
        const orderB = b.tier_order !== undefined ? b.tier_order : (b.days_overdue_start || 0);
        return orderA - orderB;
      });
      
      for (const tier of sortedTiers) {
        const startDay = tier.days_overdue_start || 0;
        const endDay = tier.days_overdue_end !== null && tier.days_overdue_end !== undefined 
          ? tier.days_overdue_end 
          : null;
        
        if (daysOverdue < startDay) continue;
        
        const feeValue = parseFloat(tier.fee_value || tier.penalty_percent || 0);
        if (feeValue <= 0) continue;
        
        if (startDay === endDay || (startDay === 1 && endDay === 1)) {
          if (daysOverdue >= startDay) {
            penaltyBase += principal * (feeValue / 100);
          }
        } else if (endDay === null || endDay === undefined) {
          if (daysOverdue >= startDay) {
            const daysInTier = daysOverdue - startDay + 1;
            penaltyBase += principal * (feeValue / 100) * daysInTier;
          }
        } else {
          if (daysOverdue >= startDay) {
            const tierStartDay = startDay;
            const tierEndDay = Math.min(endDay, daysOverdue);
            const daysInTier = Math.max(0, tierEndDay - tierStartDay + 1);
            
            if (daysInTier > 0) {
              penaltyBase += principal * (feeValue / 100) * daysInTier;
            }
          }
        }
      }
      
      const penaltyBaseRounded = toDecimal2(penaltyBase);
      const gstPercent = lateFeeStructure[0]?.gst_percent || 18;
      const penaltyGST = toDecimal2(penaltyBaseRounded * (gstPercent / 100));
      const penaltyTotal = toDecimal2(penaltyBaseRounded + penaltyGST);
      
      return { penaltyBase: penaltyBaseRounded, penaltyGST, penaltyTotal };
    };
    
    // Check if any EMI is overdue
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDates = parseDueDates(loan.processed_due_date);
    if (dueDates.length > 0) {
      let maxDaysOverdue = 0;
      for (const dueDateStr of dueDates) {
        if (isOverdue(dueDateStr, today)) {
          const dueDate = new Date(dueDateStr);
          dueDate.setHours(0, 0, 0, 0);
          const daysOverdueInclusive = calculateDaysInclusive(dueDate, today);
          const daysOverdue = Math.max(1, daysOverdueInclusive - 1); // Exclude today for penalty calculation
          maxDaysOverdue = Math.max(maxDaysOverdue, daysOverdue);
        }
      }
      
      if (maxDaysOverdue > 0) {
        const penaltyCalc = calculatePenalty(principal, maxDaysOverdue, lateFeeStructure);
        penaltyAmount = penaltyCalc.penaltyTotal;
        penaltyBase = penaltyCalc.penaltyBase;
        penaltyGST = penaltyCalc.penaltyGST;
        
        fees.penaltyBase = penaltyBase;
        fees.penaltyGST = penaltyGST;
        fees.penaltyTotal = penaltyAmount;
        
        console.log(`💰 Penalty calculation for Extension (loan #${loan_application_id}):
          Principal: ₹${principal}
          Days Overdue: ${maxDaysOverdue}
          Penalty Base: ₹${penaltyBase}
          Penalty GST (${lateFeeStructure?.[0]?.gst_percent || 18}%): ₹${penaltyGST}
          Penalty Total: ₹${penaltyAmount}`);
      }
    }
    
    // Recalculate total extension amount to include penalty
    fees.totalExtensionAmount = toDecimal2(fees.extensionFee + fees.gstAmount + fees.interestTillDate + penaltyAmount);
    

    // Calculate outstanding balance
    const outstandingBalance = calculateOutstandingBalance(loan);

    // Calculate total tenure days (from disbursement to new due date)
    const disbursementDateStr = parseDateToString(loan.processed_at || loan.disbursed_at);
    const totalTenureDays = disbursementDateStr 
      ? require('../utils/loanCalculations').calculateDaysBetween(disbursementDateStr, newDueDateResult.newDueDate)
      : 0;

    // Insert extension record
    // Note: penalty_base, penalty_gst, and penalty_total columns should be added to the table
    const extensionQuery = `
      INSERT INTO loan_extensions (
        loan_application_id,
        extension_number,
        original_due_date,
        new_due_date,
        extension_fee,
        gst_amount,
        interest_till_date,
        penalty_base,
        penalty_gst,
        penalty_total,
        total_extension_amount,
        extension_period_days,
        total_tenure_days,
        outstanding_balance_before,
        outstanding_balance_after,
        status,
        payment_status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment', 'pending', NOW(), NOW())
    `;

    // For multi-EMI loans, store all EMI dates as JSON string
    // For single payment loans, store single date as string
    const originalDueDateForDB = isMultiEmi && originalEmiDates 
      ? JSON.stringify(originalEmiDates) 
      : originalDueDate;
    const newDueDateForDB = isMultiEmi && newDueDateResult.newEmiDates 
      ? JSON.stringify(newDueDateResult.newEmiDates) 
      : newDueDateResult.newDueDate;

    const extensionValues = [
      loan_application_id,
      extensionNumber,
      originalDueDateForDB,
      newDueDateForDB,
      fees.extensionFee,
      fees.gstAmount,
      fees.interestTillDate,
      penaltyBase,
      penaltyGST,
      penaltyAmount,
      fees.totalExtensionAmount,
      newDueDateResult.extensionPeriodDays,
      totalTenureDays,
      outstandingBalance,
      outstandingBalance, // Outstanding balance remains unchanged
    ];

    const extensionResult = await executeQuery(extensionQuery, extensionValues);
    const extensionId = extensionResult.insertId;

    // Note: Extension is created with 'pending_payment' status
    // User will accept agreement and then proceed to payment
    // No transaction created at request time

    // Update loan application - set extension_status to pending_payment and increment extension_count
    await executeQuery(
      `UPDATE loan_applications 
       SET extension_status = 'pending_payment',
           extension_count = extension_count + 1
       WHERE id = ?`,
      [loan_application_id]
    );

    res.json({
      success: true,
      data: {
        extension_id: extensionId,
        extension_number: extensionNumber,
        extension_fee: fees.extensionFee,
        gst_amount: fees.gstAmount,
        interest_till_date: fees.interestTillDate,
        penalty_base: penaltyBase,
        penalty_gst: penaltyGST,
        penalty_total: penaltyAmount,
        total_amount: fees.totalExtensionAmount,
        original_due_date: originalDueDate,
        new_due_date: newDueDateResult.newDueDate,
        original_emi_dates: originalEmiDates,
        new_emi_dates: newDueDateResult.newEmiDates,
        extension_period_days: newDueDateResult.extensionPeriodDays,
        total_tenure_days: totalTenureDays,
        status: 'pending_payment'
      }
    });
  } catch (error) {
    console.error('Error requesting extension:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to request extension',
      error: error.message
    });
  }
});

/**
 * POST /api/loan-extensions/:extensionId/accept-agreement
 * Accept extension agreement (no status change needed since extension is created with 'pending_payment')
 * This endpoint is kept for compatibility but doesn't change status
 */
router.post('/:extensionId/accept-agreement', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const { extensionId } = req.params;
    const userId = req.user.id;

    // Get extension details
    const extensions = await executeQuery(`
      SELECT 
        le.*,
        la.id as loan_id,
        la.user_id
      FROM loan_extensions le
      INNER JOIN loan_applications la ON le.loan_application_id = la.id
      WHERE le.id = ? AND la.user_id = ?
    `, [extensionId, userId]);

    if (!extensions || extensions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Extension request not found'
      });
    }

    const extension = extensions[0];

    // Check if extension is in pending_payment status
    if (extension.status !== 'pending_payment') {
      return res.status(400).json({
        success: false,
        message: `Extension request is ${extension.status}. Agreement can only be accepted for pending_payment requests.`
      });
    }

    // No status change needed - extension is already in 'pending_payment' status
    // Just return success to proceed to payment

    res.json({
      success: true,
      message: 'Extension agreement accepted successfully',
      data: {
        extension_id: extensionId,
        status: 'pending_payment'
      }
    });
  } catch (error) {
    console.error('Error accepting extension agreement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept extension agreement',
      error: error.message
    });
  }
});

/**
 * POST /api/loan-extensions/:extensionId/payment
 * Create payment order for extension fee
 */
router.post('/:extensionId/payment', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const { extensionId } = req.params;
    const userId = req.user.id;

    // Get extension details
    const extensions = await executeQuery(`
      SELECT 
        le.*,
        la.id as loan_id,
        la.user_id,
        la.application_number,
        u.phone,
        u.email,
        u.personal_email,
        u.official_email,
        u.first_name,
        u.last_name
      FROM loan_extensions le
      INNER JOIN loan_applications la ON le.loan_application_id = la.id
      INNER JOIN users u ON la.user_id = u.id
      WHERE le.id = ? AND la.user_id = ?
    `, [extensionId, userId]);

    if (!extensions || extensions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Extension request not found'
      });
    }

    const extension = extensions[0];

    // Check if extension is in pending_payment status
    if (extension.status !== 'pending_payment') {
      return res.status(400).json({
        success: false,
        message: `Extension request is ${extension.status}. Payment can only be made for pending_payment requests.`
      });
    }

    // Get email - use personal_email, official_email, or email (in that priority order)
    const customerEmail = extension.personal_email || extension.official_email || extension.email || 'user@example.com';
    
    // Get customer name
    const customerName = extension.first_name && extension.last_name 
      ? `${extension.first_name} ${extension.last_name}`.trim()
      : (extension.first_name || extension.last_name || 'Customer');

    // Generate unique order ID
    const orderId = `EXT_${extension.application_number}_${extension.extension_number}_${Date.now()}`;
    console.log(`[Extension Payment] Generated order ID: ${orderId} for extension ${extensionId}`);

    // Import cashfree payment service
    const cashfreePayment = require('../services/cashfreePayment');

    // Create Cashfree order
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const backendUrl = process.env.BACKEND_URL || process.env.APP_URL || 'http://localhost:3001';
    const returnUrl = `${frontendUrl}/payment/return?orderId=${orderId}`;
    const notifyUrl = `${backendUrl}/api/payment/webhook`;

    console.log(`[Extension Payment] Creating Cashfree order:`, {
      orderId,
      amount: extension.total_extension_amount,
      customerName,
      customerEmail,
      customerPhone: extension.phone || '9999999999',
      returnUrl,
      notifyUrl
    });

    const orderResult = await cashfreePayment.createOrder({
      orderId,
      amount: extension.total_extension_amount,
      customerName: customerName,
      customerEmail: customerEmail,
      customerPhone: extension.phone || '9999999999',
      returnUrl,
      notifyUrl
    });

    if (!orderResult.success) {
      console.error('[Extension Payment] Cashfree order creation failed:', orderResult.error);
      return res.status(500).json({
        success: false,
        message: orderResult.error || 'Failed to create payment order',
        error: orderResult.error
      });
    }

    const paymentSessionId = orderResult.data?.payment_session_id;
    if (!paymentSessionId) {
      console.error('[Extension Payment] No payment session ID in response');
      return res.status(500).json({
        success: false,
        message: 'Failed to get payment session from gateway'
      });
    }

    // Clean the session ID
    const cleanSessionId = paymentSessionId
      .trim()
      .split(/\s+/)[0]
      .replace(/[^a-zA-Z0-9_\-]/g, '')
      .replace(/paymentpayment$/i, '');

    if (!cleanSessionId.startsWith('session_')) {
      return res.status(500).json({
        success: false,
        message: 'Invalid payment session received. Please try again.'
      });
    }

    // Create payment order in database
    try {
      await executeQuery(`
        INSERT INTO payment_orders (
          order_id, 
          loan_id, 
          extension_id,
          user_id, 
          amount, 
          payment_type,
          status, 
          payment_session_id, 
          cashfree_response,
          created_at
        ) VALUES (?, ?, ?, ?, ?, 'extension_fee', 'PENDING', ?, ?, NOW())
      `, [
        orderId,
        extension.loan_id,
        extensionId,
        userId,
        extension.total_extension_amount,
        cleanSessionId,
        JSON.stringify(orderResult.data)
      ]);
      console.log(`[Extension Payment] Payment order created in DB: ${orderId}`);
    } catch (insertError) {
      console.error('[Extension Payment] Failed to insert payment order:', insertError);
      if (!insertError.message || !insertError.message.includes('Duplicate entry')) {
        throw insertError;
      }
      console.log(`[Extension Payment] Order ${orderId} already exists, continuing...`);
    }

    // Get checkout URL
    const checkoutUrl = cashfreePayment.getCheckoutUrl(orderResult.data);

    console.log('✅ Extension payment order created:', { 
      orderId, 
      checkoutUrl,
      extensionId,
      environment: cashfreePayment.isProduction ? 'PRODUCTION' : 'SANDBOX'
    });

    res.json({
      success: true,
      data: {
        orderId,
        paymentSessionId: cleanSessionId,
        checkoutUrl,
        extension_id: extensionId,
        amount: extension.total_extension_amount
      }
    });

  } catch (error) {
    console.error('❌ Error creating extension payment order:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create payment order',
      error: error.message
    });
  }
});

/**
 * Helper function to create extension payment order
 * @param {number} extensionId - Extension ID
 * @param {Object} extension - Extension object with all details
 * @param {number} userId - User ID
 * @returns {Promise<Object>} Payment order creation result
 */
async function createExtensionPaymentOrder(extensionId, extension, userId) {
  try {
    // Get email - use personal_email, official_email, or email (in that priority order)
    const customerEmail = extension.personal_email || extension.official_email || extension.email || 'user@example.com';
    
    // Get customer name
    const customerName = extension.first_name && extension.last_name 
      ? `${extension.first_name} ${extension.last_name}`.trim()
      : (extension.first_name || extension.last_name || 'Customer');

    // Generate unique order ID
    const orderId = `EXT_${extension.application_number}_${extension.extension_number}_${Date.now()}`;
    console.log(`[Extension Payment] Generated order ID: ${orderId} for extension ${extensionId}`);

    // Import cashfree payment service
    const cashfreePayment = require('../services/cashfreePayment');

    // Create Cashfree order
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const backendUrl = process.env.BACKEND_URL || process.env.APP_URL || 'http://localhost:3001';
    const returnUrl = `${frontendUrl}/payment/return?orderId=${orderId}`;
    const notifyUrl = `${backendUrl}/api/payment/webhook`;

    const orderResult = await cashfreePayment.createOrder({
      orderId,
      amount: extension.total_extension_amount,
      customerName: customerName,
      customerEmail: customerEmail,
      customerPhone: extension.phone || '9999999999',
      returnUrl,
      notifyUrl
    });

    if (!orderResult.success) {
      return {
        success: false,
        error: orderResult.error || 'Failed to create payment order'
      };
    }

    const paymentSessionId = orderResult.data?.payment_session_id;
    if (!paymentSessionId) {
      return {
        success: false,
        error: 'Failed to get payment session from gateway'
      };
    }

    // Clean the session ID
    const cleanSessionId = paymentSessionId
      .trim()
      .split(/\s+/)[0]
      .replace(/[^a-zA-Z0-9_\-]/g, '')
      .replace(/paymentpayment$/i, '');

    if (!cleanSessionId.startsWith('session_')) {
      return {
        success: false,
        error: 'Invalid payment session received'
      };
    }

    // Create payment order in database
    try {
      await executeQuery(`
        INSERT INTO payment_orders (
          order_id, 
          loan_id, 
          extension_id,
          user_id, 
          amount, 
          payment_type,
          status, 
          payment_session_id, 
          cashfree_response,
          created_at
        ) VALUES (?, ?, ?, ?, ?, 'extension_fee', 'PENDING', ?, ?, NOW())
      `, [
        orderId,
        extension.loan_id,
        extensionId,
        userId,
        extension.total_extension_amount,
        cleanSessionId,
        JSON.stringify(orderResult.data)
      ]);
      console.log(`[Extension Payment] Payment order created in DB: ${orderId}`);
    } catch (insertError) {
      console.error('[Extension Payment] Failed to insert payment order:', insertError);
      if (!insertError.message || !insertError.message.includes('Duplicate entry')) {
        throw insertError;
      }
      console.log(`[Extension Payment] Order ${orderId} already exists, continuing...`);
    }

    // Get checkout URL
    const checkoutUrl = cashfreePayment.getCheckoutUrl(orderResult.data);

    return {
      success: true,
      data: {
        orderId,
        paymentSessionId: cleanSessionId,
        checkoutUrl,
        extension_id: extensionId,
        amount: extension.total_extension_amount
      }
    };
  } catch (error) {
    console.error('❌ Error creating extension payment order:', error);
    return {
      success: false,
      error: error.message || 'Failed to create payment order'
    };
  }
}

/**
 * POST /api/loan-extensions/:extensionId/check-payment
 * Check payment status for pending_payment extension and complete if paid
 */
router.post('/:extensionId/check-payment', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const { extensionId } = req.params;
    const userId = req.user.id;

    // Get extension details with user info for payment order creation
    const extensions = await executeQuery(`
      SELECT 
        le.*,
        la.id as loan_id,
        la.user_id,
        la.application_number,
        u.phone,
        u.email,
        u.personal_email,
        u.official_email,
        u.first_name,
        u.last_name
      FROM loan_extensions le
      INNER JOIN loan_applications la ON le.loan_application_id = la.id
      INNER JOIN users u ON la.user_id = u.id
      WHERE le.id = ? AND la.user_id = ?
    `, [extensionId, userId]);

    if (!extensions || extensions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Extension request not found'
      });
    }

    const extension = extensions[0];

    // Only allow checking for pending_payment extensions
    if (extension.status !== 'pending_payment') {
      return res.status(400).json({
        success: false,
        message: `Extension status is ${extension.status}. Payment check is only available for pending_payment extensions.`
      });
    }

    // Find payment order for this extension
    const paymentOrders = await executeQuery(`
      SELECT id, order_id, status, amount, payment_session_id, cashfree_response, 
      DATE_FORMAT(created_at, '%Y-%m-%d') as created_at, 
      DATE_FORMAT(updated_at, '%Y-%m-%d') as updated_at
      FROM payment_orders
      WHERE loan_id = ? AND payment_type = 'extension_fee' AND extension_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `, [extension.loan_id, extensionId]);

    if (!paymentOrders || paymentOrders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Payment order not found for this extension'
      });
    }

    const paymentOrder = paymentOrders[0];
    const orderId = paymentOrder.order_id;
    
    // Check if order is expired (Cashfree orders expire after 30 minutes)
    // Use 25 minutes as threshold to be safe (create new order before expiry)
    // For time calculations, we need full datetime, but ensure consistent timezone handling
    // Since we're calculating time difference, both timestamps should be in same timezone context
    const orderCreatedAt = paymentOrder.created_at ? new Date(paymentOrder.created_at) : new Date();
    const now = new Date();
    // Calculate difference in milliseconds, then convert to minutes
    // Both dates are in server timezone (IST), so difference calculation is accurate
    const minutesSinceCreation = (now - orderCreatedAt) / (1000 * 60);
    const isExpired = minutesSinceCreation > 25; // Create new order if older than 25 minutes (before 30 min expiry)

    // Check Cashfree API for current payment status
    const cashfreePayment = require('../services/cashfreePayment');
    const cashfreeStatus = await cashfreePayment.getOrderStatus(orderId);

    let currentStatus = paymentOrder.status;
    let paymentReceived = false;
    let cashfreeOrderStatus = null;

    if (cashfreeStatus.success && cashfreeStatus.data) {
      cashfreeOrderStatus = cashfreeStatus.data.order_status || 
                           cashfreeStatus.data.order?.order_status;
      paymentReceived = cashfreeStatus.paymentReceived || (cashfreeOrderStatus === 'PAID');
      
      // Update database status if Cashfree shows PAID
      if (paymentReceived && paymentOrder.status === 'PENDING') {
        console.log(`🔄 Updating payment order ${orderId} status from PENDING to PAID`);
        await executeQuery(
          `UPDATE payment_orders SET status = 'PAID', updated_at = NOW() WHERE order_id = ?`,
          [orderId]
        );
        currentStatus = 'PAID';
      }
    }

    // If payment is PAID, complete the extension
    if (currentStatus === 'PAID' || paymentReceived) {
      // Check if extension is already approved (to avoid duplicate processing)
      const currentExtension = await executeQuery(
        'SELECT status FROM loan_extensions WHERE id = ?',
        [extensionId]
      );

      if (currentExtension && currentExtension.length > 0 && 
          currentExtension[0].status === 'pending_payment') {
        // Check if transaction already exists to avoid duplicates
        const existingTransaction = await executeQuery(
          `SELECT id FROM transactions WHERE reference_number = ? AND loan_application_id = ? AND transaction_type LIKE 'loan_extension_%'`,
          [orderId, extension.loan_id]
        );

        if (existingTransaction.length === 0) {
          // Complete the extension by approving it
          try {
            const { approveExtension } = require('../utils/extensionApproval');
            const approvalResult = await approveExtension(
              extensionId,
              orderId, // Use orderId as reference number
              null // No admin ID for auto-approval from payment check
            );

            console.log('✅ Extension auto-approved via payment check:', approvalResult);

            return res.json({
              success: true,
              data: {
                status: 'completed',
                message: 'Extension payment verified and extension approved successfully',
                payment_status: 'PAID',
                extension_approved: true,
                approval_result: approvalResult
              }
            });
          } catch (approvalError) {
            console.error('❌ Error auto-approving extension:', approvalError);
            return res.status(500).json({
              success: false,
              message: 'Payment is PAID but failed to approve extension. Please contact support.',
              error: approvalError.message,
              payment_status: 'PAID'
            });
          }
        } else {
          // Transaction already exists, extension might be in process
          return res.json({
            success: true,
            data: {
              status: 'processing',
              message: 'Extension is being processed. Please wait.',
              payment_status: 'PAID'
            }
          });
        }
      } else {
        // Extension already processed
        return res.json({
          success: true,
          data: {
            status: 'already_processed',
            message: 'Extension has already been processed',
            payment_status: 'PAID',
            extension_status: currentExtension[0].status
          }
        });
      }
    } else if (currentStatus === 'PENDING' || cashfreeOrderStatus === 'ACTIVE') {
      // Payment is still pending
      // If expired or can't get valid session, delete old order and create new one
      if (isExpired || cashfreeOrderStatus === 'EXPIRED') {
        // Delete expired payment order
        try {
          await executeQuery(
            `UPDATE payment_orders SET status = 'EXPIRED', updated_at = NOW() WHERE order_id = ?`,
            [orderId]
          );
          console.log(`🗑️ Marked expired payment order ${orderId} as EXPIRED`);
        } catch (e) {
          console.error('Error updating expired payment order:', e);
        }
        
        // Create new payment order directly
        try {
          const userId = req.user.id;
          const newOrderResponse = await createExtensionPaymentOrder(extensionId, extension, userId);
          
          if (newOrderResponse.success && newOrderResponse.data.paymentSessionId) {
            return res.json({
              success: true,
              data: {
                status: 'pending',
                message: 'New payment order created. Opening payment gateway...',
                payment_status: 'PENDING',
                order_id: newOrderResponse.data.orderId,
                paymentSessionId: newOrderResponse.data.paymentSessionId,
                checkoutUrl: newOrderResponse.data.checkoutUrl, // Keep for fallback
                useSdk: true // Flag to use SDK instead of redirect
              }
            });
          }
        } catch (e) {
          console.error('Error creating new payment order:', e);
        }
        
        // If creation failed, return flag to create new order
        return res.json({
          success: true,
          data: {
            status: 'expired',
            message: 'Payment order has expired. Please create a new payment order.',
            payment_status: 'EXPIRED',
            order_id: orderId,
                createNewOrder: true
          }
        });
      } else {
        // Order is still valid (not expired), try to get checkout URL from stored response
        let checkoutUrl = null;
        let paymentSessionId = paymentOrder.payment_session_id;
        
        try {
          const cashfreeResponse = paymentOrder.cashfree_response 
            ? JSON.parse(paymentOrder.cashfree_response) 
            : null;
          
          if (cashfreeResponse && (cashfreeResponse.payment_link || cashfreeResponse.payment_session_id)) {
            checkoutUrl = cashfreePayment.getCheckoutUrl(cashfreeResponse);
          }
        } catch (e) {
          console.error('Error getting checkout URL from stored response:', e);
        }
        
        // If we can't get checkout URL, delete old order and create new one
        if (!checkoutUrl) {
          // Delete invalid payment order
          try {
            await executeQuery(
              `UPDATE payment_orders SET status = 'FAILED', updated_at = NOW() WHERE order_id = ?`,
              [orderId]
            );
            console.log(`🗑️ Marked invalid payment order ${orderId} as FAILED`);
          } catch (e) {
            console.error('Error updating invalid payment order:', e);
          }
          
          // Create new payment order directly
          try {
            const userId = req.user.id;
            const newOrderResponse = await createExtensionPaymentOrder(extensionId, extension, userId);
            
            if (newOrderResponse.success && newOrderResponse.data.paymentSessionId) {
              return res.json({
                success: true,
                data: {
                  status: 'pending',
                  message: 'New payment order created. Opening payment gateway...',
                  payment_status: 'PENDING',
                  order_id: newOrderResponse.data.orderId,
                  paymentSessionId: newOrderResponse.data.paymentSessionId,
                  checkoutUrl: newOrderResponse.data.checkoutUrl, // Keep for fallback
                  use_sdk: true // Flag to use SDK instead of redirect
                }
              });
            }
          } catch (e) {
            console.error('Error creating new payment order:', e);
          }
          
          return res.json({
            success: true,
            data: {
              status: 'pending',
              message: 'Unable to retrieve payment session. Creating a new payment order...',
              payment_status: 'PENDING',
              order_id: orderId,
                createNewOrder: true
            }
          });
        }
        
        // If we have a valid payment session ID, return it for SDK use
        if (paymentSessionId && paymentSessionId.startsWith('session_')) {
          return res.json({
            success: true,
            data: {
              status: 'pending',
              message: 'Your payment transaction is still pending. Opening payment gateway...',
              payment_status: 'PENDING',
              order_id: orderId,
              paymentSessionId: paymentSessionId,
              checkoutUrl: checkoutUrl, // Keep for fallback
              use_sdk: true // Flag to use SDK instead of redirect
            }
          });
        }
        
        // Fallback: if we have checkout URL but no valid session ID, try redirect
        return res.json({
          success: true,
          data: {
            status: 'pending',
            message: 'Your payment transaction is still pending. Redirecting to payment gateway...',
            payment_status: 'PENDING',
            order_id: orderId,
            checkoutUrl: checkoutUrl,
            redirectToPayment: true
          }
        });
      }
    } else if (currentStatus === 'FAILED' || cashfreeOrderStatus === 'EXPIRED') {
      // Payment failed or expired
      return res.json({
        success: true,
        data: {
          status: 'failed',
          message: 'Payment transaction has failed or expired. Please create a new payment order.',
          payment_status: 'FAILED',
          order_id: orderId,
                createNewOrder: true
        }
      });
    } else {
      // Unknown status
      return res.json({
        success: true,
        data: {
          status: 'unknown',
          message: `Payment status is ${currentStatus}. Please try again later or contact support.`,
          payment_status: currentStatus,
          cashfree_status: cashfreeOrderStatus,
          order_id: orderId
        }
      });
    }

  } catch (error) {
    console.error('❌ Error checking extension payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check payment status',
      error: error.message
    });
  }
});

/**
 * GET /api/loan-extensions/history/:loanId
 * Get extension history for a loan
 */
router.get('/history/:loanId', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const { loanId } = req.params;
    const userId = req.user.id;

    // Verify loan belongs to user
    const loans = await executeQuery(
      'SELECT id FROM loan_applications WHERE id = ? AND user_id = ?',
      [loanId, userId]
    );

    if (!loans || loans.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      });
    }

    // Get extension history
    const extensions = await executeQuery(`
      SELECT 
        id,
        extension_number,
        created_at as requested_at,
        status,
        original_due_date,
        new_due_date,
        extension_fee,
        gst_amount,
        interest_till_date,
        total_extension_amount,
        extension_period_days,
        created_at as approved_at
      FROM loan_extensions
      WHERE loan_application_id = ?
      ORDER BY extension_number ASC
    `, [loanId]);

    // Get loan extension count
    const loan = await executeQuery(
      'SELECT extension_count FROM loan_applications WHERE id = ?',
      [loanId]
    );
    const extensionCount = loan[0]?.extension_count || 0;

    res.json({
      success: true,
      data: {
        extensions: extensions.map(ext => ({
          ...ext
        })),
        total_extensions: extensionCount,
        remaining_extensions: MAX_EXTENSIONS - extensionCount
      }
    });
  } catch (error) {
    console.error('Error getting extension history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get extension history',
      error: error.message
    });
  }
});

/**
 * GET /api/admin/loan-extensions/pending
 * Get all pending extension requests (Admin only)
 */
router.get('/pending', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { page = 1, limit = 20, status = 'pending' } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;
    
    console.log('📥 Admin fetching pending extensions:', { page: pageNum, limit: limitNum, status, offset });

    // Get pending extensions with loan and user details
    // Note: LIMIT and OFFSET must be integers in the query string, not placeholders
    const extensions = await executeQuery(`
      SELECT 
        le.id,
        le.loan_application_id,
        la.application_number,
        le.extension_number,
        le.created_at as requested_at,
        le.original_due_date,
        le.new_due_date,
        le.extension_fee,
        le.gst_amount,
        le.interest_till_date,
        le.total_extension_amount,
        le.extension_period_days,
        le.outstanding_balance_before,
        le.status,
        u.id as user_id,
        u.first_name,
        u.last_name,
        u.phone,
        u.email
      FROM loan_extensions le
      INNER JOIN loan_applications la ON le.loan_application_id = la.id
      INNER JOIN users u ON la.user_id = u.id
      WHERE le.status = ?
      ORDER BY le.created_at DESC
      LIMIT ${limitNum} OFFSET ${offset}
    `, [status]);

    // Get total count
    const countResult = await executeQuery(
      'SELECT COUNT(*) as total FROM loan_extensions WHERE status = ?',
      [status]
    );
    const total = countResult[0]?.total || 0;

    const responseData = {
      success: true,
      data: {
        extensions: extensions.map(ext => ({
          ...ext,
          loan_application_number: ext.application_number,
          user_name: `${ext.first_name} ${ext.last_name || ''}`.trim()
        })),
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          total_pages: Math.ceil(total / parseInt(limit))
        }
      }
    };

    console.log('📤 Sending response with', responseData.data.extensions.length, 'extensions');
    res.json(responseData);
  } catch (error) {
    console.error('Error getting pending extensions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get pending extensions',
      error: error.message
    });
  }
});

/**
 * POST /api/admin/loan-extensions/:extensionId/approve
 * Approve an extension request (Admin only)
 */
router.post('/:extensionId/approve', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { extensionId } = req.params;
    const adminId = req.admin.id;
    const { reference_number } = req.body; // Optional UTR/reference number

    // Use reusable approval function
    const result = await approveExtension(extensionId, reference_number, adminId);

    res.json({
      success: true,
      message: 'Extension approved successfully. Transaction created automatically.',
      data: {
        extension_id: result.extension_id,
        extension_number: result.extension_number,
        new_due_date: result.new_due_date,
        transaction_id: result.transaction_id
      }
    });
  } catch (error) {
    console.error('Error approving extension:', error);
    const statusCode = error.message.includes('not found') ? 404 : 
                       error.message.includes('already') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to approve extension',
      error: error.message
    });
  }
});

/**
 * POST /api/admin/loan-extensions/:extensionId/reject
 * Reject an extension request (Admin only)
 */
router.post('/:extensionId/reject', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { extensionId } = req.params;
    const adminId = req.admin.id;
    const { rejection_reason } = req.body;

    // Get extension details
    const extensions = await executeQuery(
      'SELECT * FROM loan_extensions WHERE id = ?',
      [extensionId]
    );

    if (!extensions || extensions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Extension request not found'
      });
    }

    const extension = extensions[0];

    if (extension.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Extension request is already ${extension.status}`
      });
    }

    // Update extension status
    await executeQuery(
      `UPDATE loan_extensions 
       SET status = 'rejected',
           approved_at = NOW(),
           approved_by_admin_id = ?,
           rejection_reason = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [adminId, rejection_reason || null, extensionId]
    );

    // Update loan application
    await executeQuery(
      `UPDATE loan_applications 
       SET extension_status = 'rejected',
           updated_at = NOW()
       WHERE id = ?`,
      [extension.loan_application_id]
    );

    // Update transaction status if exists
    if (extension.payment_transaction_id) {
      await executeQuery(
        'UPDATE transactions SET status = "cancelled" WHERE id = ?',
        [extension.payment_transaction_id]
      );
    }

    res.json({
      success: true,
      message: 'Extension rejected successfully'
    });
  } catch (error) {
    console.error('Error rejecting extension:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject extension',
      error: error.message
    });
  }
});

module.exports = router;

