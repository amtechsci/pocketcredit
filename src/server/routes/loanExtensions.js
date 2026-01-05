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
  getSalaryDateForMonth
} = require('../utils/loanCalculations');

const router = express.Router();

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

    // Check for pending extension request
    const pendingExtension = await executeQuery(`
      SELECT id, extension_number, created_at, status
      FROM loan_extensions
      WHERE loan_application_id = ? AND status = 'pending'
      ORDER BY created_at DESC
      LIMIT 1
    `, [loanId]);

    // Check eligibility
    const eligibility = checkExtensionEligibility(loan, null, 0);

    // If there's a pending extension, override eligibility
    if (pendingExtension && pendingExtension.length > 0) {
      return res.json({
        success: true,
        data: {
          eligible: false,
          has_pending_request: true,
          pending_extension: {
            id: pendingExtension[0].id,
            extension_number: pendingExtension[0].extension_number,
            requested_at: pendingExtension[0].created_at,
            status: pendingExtension[0].status
          },
          reason: 'A loan extension request is already pending approval',
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
        extension_count: loan.extension_count || 0,
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
      console.log(`📅 processed_due_date is null, calculating from plan snapshot and processed_at`);
      
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
          const emiCount = planSnapshot.emi_count || 1;
          originalEmiDates = [];
          for (let i = 0; i < emiCount; i++) {
            const emiDate = getSalaryDateForMonth(firstDueDate, salaryDate, i);
            originalEmiDates.push(formatDateToString(emiDate));
          }
          
          originalDueDate = originalEmiDates[0]; // First EMI for extension
          console.log(`📅 Calculated ${originalEmiDates.length} EMI dates from plan snapshot: ${originalEmiDates.join(', ')}, original due date (first EMI) = ${originalDueDate}`);
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
          originalEmiDates = [originalDueDate];
          console.log(`📅 Calculated single payment due date from plan snapshot: ${originalDueDate}`);
        } else {
          // Fixed days plan
          const repaymentDays = planSnapshot.repayment_days || planSnapshot.total_duration_days || 15;
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
            console.log(`📅 Calculated ${originalEmiDates.length} EMI dates (fixed days): ${originalEmiDates.join(', ')}, original due date (first EMI) = ${originalDueDate}`);
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

    // Calculate outstanding balance
    const outstandingBalance = calculateOutstandingBalance(loan);

    // Calculate total tenure days (from disbursement to new due date)
    const disbursementDateStr = parseDateToString(loan.processed_at || loan.disbursed_at);
    const totalTenureDays = disbursementDateStr 
      ? require('../utils/loanCalculations').calculateDaysBetween(disbursementDateStr, newDueDateResult.newDueDate)
      : 0;

    // Insert extension record
    // Note: Using only essential columns that are most likely to exist
    // If table structure is different, we'll need to run the migration
    const extensionQuery = `
      INSERT INTO loan_extensions (
        loan_application_id,
        extension_number,
        original_due_date,
        new_due_date,
        extension_fee,
        gst_amount,
        interest_till_date,
        total_extension_amount,
        extension_period_days,
        total_tenure_days,
        outstanding_balance_before,
        outstanding_balance_after,
        status,
        payment_status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', NOW(), NOW())
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
      fees.totalExtensionAmount,
      newDueDateResult.extensionPeriodDays,
      totalTenureDays,
      outstandingBalance,
      outstandingBalance, // Outstanding balance remains unchanged
    ];

    const extensionResult = await executeQuery(extensionQuery, extensionValues);
    const extensionId = extensionResult.insertId;

    // Note: Transaction will be created by admin when approving the extension
    // No transaction created at request time

    // Update loan application - set extension_status to pending and increment extension_count
    await executeQuery(
      `UPDATE loan_applications 
       SET extension_status = 'pending',
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
        total_amount: fees.totalExtensionAmount,
        original_due_date: originalDueDate,
        new_due_date: newDueDateResult.newDueDate,
        original_emi_dates: originalEmiDates,
        new_emi_dates: newDueDateResult.newEmiDates,
        extension_period_days: newDueDateResult.extensionPeriodDays,
        total_tenure_days: totalTenureDays,
        status: 'pending'
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

    console.log('📊 Found extensions:', extensions.length);
    console.log('📊 Extensions data:', JSON.stringify(extensions, null, 2));

    // Get total count
    const countResult = await executeQuery(
      'SELECT COUNT(*) as total FROM loan_extensions WHERE status = ?',
      [status]
    );
    const total = countResult[0]?.total || 0;

    console.log('📊 Total pending extensions:', total);

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

    // Get extension details with user info
    const extensions = await executeQuery(`
      SELECT 
        le.*,
        la.id as loan_id,
        la.user_id,
        la.processed_due_date,
        la.extension_count,
        la.plan_snapshot,
        la.emi_schedule,
        la.interest_paid
      FROM loan_extensions le
      INNER JOIN loan_applications la ON le.loan_application_id = la.id
      WHERE le.id = ?
    `, [extensionId]);

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

    // Determine transaction type based on extension number
    const transactionType = `loan_extension_${extension.extension_number === 1 ? '1st' : extension.extension_number === 2 ? '2nd' : extension.extension_number === 3 ? '3rd' : '4th'}`;

    // Create transaction automatically
    const transactionQuery = `
      INSERT INTO transactions (
        user_id, 
        loan_application_id, 
        transaction_type, 
        amount, 
        description, 
        reference_number,
        transaction_date, 
        status, 
        created_by, 
        created_at, 
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURDATE(), 'completed', ?, NOW(), NOW())
    `;

    const transactionDescription = `Loan Extension #${extension.extension_number} - Extension Fee: ₹${extension.extension_fee}, GST: ₹${extension.gst_amount}, Interest: ₹${extension.interest_till_date}`;
    
    const transactionValues = [
      extension.user_id,
      extension.loan_application_id,
      transactionType,
      extension.total_extension_amount,
      transactionDescription,
      reference_number || `EXT-${extension.loan_application_id}-${extension.extension_number}-${Date.now()}`,
      adminId
    ];

    const transactionResult = await executeQuery(transactionQuery, transactionValues);
    const paymentTransactionId = transactionResult.insertId;

    console.log(`✅ Created transaction ${paymentTransactionId} for extension ${extensionId}`);

    // Update extension status
    // Note: Using minimal table structure - only update columns that exist
    await executeQuery(
      `UPDATE loan_extensions 
       SET status = 'approved',
           payment_status = 'paid',
           updated_at = NOW()
       WHERE id = ?`,
      [extensionId]
    );
    
    console.log(`✅ Updated extension ${extensionId} status to approved. Transaction ID: ${paymentTransactionId}`);

    // Update loan application
    const newExtensionCount = (extension.extension_count || 0) + 1;
    const newDueDate = extension.new_due_date;
    
    // Parse newDueDate - it can be a JSON array for multi-EMI or a single date string
    let lastExtensionDueDate = null; // For DATE column - use last date from array or single date
    let updatedProcessedDueDate = newDueDate; // For TEXT column - can store JSON array
    
    try {
      // Check if newDueDate is a JSON array
      if (typeof newDueDate === 'string' && newDueDate.startsWith('[')) {
        const dateArray = JSON.parse(newDueDate);
        if (Array.isArray(dateArray) && dateArray.length > 0) {
          // For multi-EMI: use the last date for last_extension_due_date (DATE column)
          lastExtensionDueDate = dateArray[dateArray.length - 1];
          // Keep full JSON array for processed_due_date (TEXT column)
          updatedProcessedDueDate = newDueDate;
        } else {
          // Fallback to single date
          lastExtensionDueDate = newDueDate;
        }
      } else {
        // Single date string
        lastExtensionDueDate = newDueDate;
        updatedProcessedDueDate = newDueDate;
      }
    } catch (parseError) {
      // If parsing fails, treat as single date
      console.warn('Could not parse newDueDate as JSON, treating as single date:', parseError);
      lastExtensionDueDate = newDueDate;
      updatedProcessedDueDate = newDueDate;
    }

    // Update interest_paid: Add interest_till_date from extension
    const currentInterestPaid = parseFloat(extension.interest_paid || 0);
    const interestTillDate = parseFloat(extension.interest_till_date || 0);
    const updatedInterestPaid = currentInterestPaid + interestTillDate;
    
    console.log(`💰 Updating interest_paid: ${currentInterestPaid} + ${interestTillDate} = ${updatedInterestPaid}`);

    // Update emi_schedule with new due dates
    let updatedEmiSchedule = extension.emi_schedule;
    try {
      // Parse current emi_schedule
      let emiScheduleArray = null;
      if (extension.emi_schedule) {
        emiScheduleArray = typeof extension.emi_schedule === 'string' 
          ? JSON.parse(extension.emi_schedule) 
          : extension.emi_schedule;
      }

      // Parse new_due_date (can be JSON array for multi-EMI or single date)
      let newDueDates = [];
      if (typeof newDueDate === 'string' && newDueDate.startsWith('[')) {
        newDueDates = JSON.parse(newDueDate);
      } else {
        newDueDates = [newDueDate];
      }

      // Update emi_schedule if it exists and we have new dates
      if (Array.isArray(emiScheduleArray) && emiScheduleArray.length > 0 && newDueDates.length > 0) {
        // Update each EMI's due_date with corresponding new date
        emiScheduleArray = emiScheduleArray.map((emi, index) => {
          if (index < newDueDates.length) {
            return {
              ...emi,
              due_date: newDueDates[index]
            };
          }
          return emi;
        });
        updatedEmiSchedule = JSON.stringify(emiScheduleArray);
        console.log(`📅 Updated emi_schedule with new due dates: ${newDueDates.join(', ')}`);
      } else if (newDueDates.length > 0) {
        // If emi_schedule doesn't exist but we have new dates, create a basic schedule
        // This is a fallback - ideally emi_schedule should already exist
        console.warn(`⚠️ emi_schedule not found, creating basic schedule with dates: ${newDueDates.join(', ')}`);
        const basicSchedule = newDueDates.map((date, index) => ({
          emi_number: index + 1,
          due_date: date,
          status: 'pending'
        }));
        updatedEmiSchedule = JSON.stringify(basicSchedule);
      }
    } catch (scheduleError) {
      console.error('❌ Error updating emi_schedule:', scheduleError);
      // Continue without updating emi_schedule if there's an error
    }

    // Update loan application
    // last_extension_due_date is DATE type - must be single date
    // processed_due_date is TEXT type - can store JSON array
    // interest_paid: Add interest_till_date
    // emi_schedule: Update with new due dates
    const updateParams = [
      newExtensionCount,
      lastExtensionDueDate,
      updatedProcessedDueDate,
      updatedInterestPaid
    ];
    
    let updateQuery = `
      UPDATE loan_applications 
      SET extension_count = ?,
          extension_status = 'approved',
          last_extension_date = CURDATE(),
          last_extension_due_date = ?,
          processed_due_date = ?,
          interest_paid = ?`;
    
    // Only update emi_schedule if it was changed
    if (updatedEmiSchedule !== extension.emi_schedule && updatedEmiSchedule !== null) {
      updateQuery += `,
          emi_schedule = ?`;
      updateParams.push(updatedEmiSchedule);
    }
    
    updateQuery += `,
          updated_at = NOW()
      WHERE id = ?`;
    
    updateParams.push(extension.loan_application_id);
    
    await executeQuery(updateQuery, updateParams);
    
    console.log(`✅ Updated loan application ${extension.loan_application_id}: extension_count=${newExtensionCount}, last_extension_due_date=${lastExtensionDueDate}, interest_paid=${updatedInterestPaid}`);

    res.json({
      success: true,
      message: 'Extension approved successfully. Transaction created automatically.',
      data: {
        extension_id: extensionId,
        extension_number: extension.extension_number,
        new_due_date: newDueDate,
        new_emi_dates: null,
        transaction_id: paymentTransactionId
      }
    });
  } catch (error) {
    console.error('Error approving extension:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve extension',
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

