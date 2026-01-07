const express = require('express');
const { authenticateAdmin } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const { executeQuery, initializeDatabase } = require('../config/database');
const router = express.Router();

// Helper function to convert income_range to approximate monthly income
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

/**
 * Format date to YYYY-MM-DD without timezone conversion
 */
function formatDateLocal(date) {
  // If date is a string or needs parsing, parse it safely to avoid timezone issues
  let d = date;
  if (typeof date === 'string' || !(date instanceof Date)) {
    const tempDate = new Date(date);
    d = new Date(tempDate.getUTCFullYear(), tempDate.getUTCMonth(), tempDate.getUTCDate(), 0, 0, 0, 0);
  } else if (date instanceof Date) {
    // If already a Date object, ensure we're using local values
    d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Get all loan applications with filters and pagination
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    
    const {
      page = 1,
      limit = 20,
      status = 'all',
      search = '',
      sortBy = 'applicationDate',
      sortOrder = 'desc',
      loanType = 'all',
      dateFrom = '',
      dateTo = ''
    } = req.query;

    console.log('🔍 Search request:', { search, status, page, limit });

    // Build the base query with basic JOINs to get essential user data
    let baseQuery = `
      SELECT DISTINCT
        la.id,
        la.application_number as applicationNumber,
        la.user_id as userId,
        la.loan_amount as loanAmount,
        la.loan_purpose as loanType,
        la.tenure_months as tenure,
        la.interest_percent_per_day,
        la.emi_amount as emiAmount,
        la.status,
        la.rejection_reason as rejectionReason,
        la.approved_by as approvedBy,
        la.approved_at as approvedDate,
        la.disbursed_at as disbursedDate,
        la.created_at as applicationDate,
        la.updated_at as updatedAt,
        la.loan_plan_id,
        la.plan_snapshot,
        la.processing_fee,
        la.processing_fee_percent,
        la.fees_breakdown,
        la.disbursal_amount,
        la.total_interest,
        la.interest_percent_per_day,
        la.total_repayable,
        u.first_name,
        u.last_name,
        u.phone as mobile,
        u.email,
        u.kyc_completed,
        u.status as userStatus,
        u.date_of_birth,
        u.gender,
        u.marital_status,
        u.income_range,
        COALESCE(ed.employment_type, '') as employment_type,
        COALESCE(ed.company_name, '') as company_name,
        COALESCE(ed.designation, '') as designation,
        COALESCE(ed.work_experience_years, 0) as work_experience_years,
        0 as credit_score,
        0 as monthly_expenses,
        0 as existing_loans,
        COALESCE(a.city, '') as city,
        COALESCE(a.state, '') as state,
        COALESCE(a.pincode, '') as pincode,
        COALESCE(a.address_line1, '') as address_line1,
        COALESCE(a.address_line2, '') as address_line2,
        COALESCE(lp.plan_code, '') as plan_code,
        COALESCE(lp.plan_name, '') as plan_name,
        la.extension_status,
        la.extension_count
      FROM loan_applications la
      LEFT JOIN users u ON la.user_id = u.id
      LEFT JOIN (
        SELECT ed1.user_id, 
               ed1.employment_type, 
               ed1.company_name, 
               ed1.designation, 
               ed1.work_experience_years
        FROM employment_details ed1
        WHERE ed1.id = (
          SELECT MAX(ed2.id)
          FROM employment_details ed2
          WHERE ed2.user_id = ed1.user_id
        )
      ) ed ON u.id = ed.user_id
      LEFT JOIN (
        SELECT a1.user_id,
               a1.city,
               a1.state,
               a1.pincode,
               a1.address_line1,
               a1.address_line2
        FROM addresses a1
        WHERE a1.is_primary = 1
          AND a1.id = (
            SELECT MAX(a2.id)
            FROM addresses a2
            WHERE a2.user_id = a1.user_id AND a2.is_primary = 1
          )
      ) a ON u.id = a.user_id
      LEFT JOIN loan_plans lp ON la.loan_plan_id = lp.id
    `;

    let whereConditions = [];
    let queryParams = [];

    // Status filter
    if (status && status !== 'all') {
      whereConditions.push('la.status = ?');
      queryParams.push(status);
    }

    // Search filter
    if (search) {
      whereConditions.push(`(
        u.first_name LIKE ? OR 
        u.last_name LIKE ? OR 
        u.phone LIKE ? OR 
        u.email LIKE ? OR 
        la.application_number LIKE ?
      )`);
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Loan type filter
    if (loanType && loanType !== 'all') {
      whereConditions.push('la.loan_purpose = ?');
      queryParams.push(loanType);
    }

    // Date filters
    if (dateFrom) {
      whereConditions.push('DATE(la.created_at) >= ?');
      queryParams.push(dateFrom);
    }
    if (dateTo) {
      whereConditions.push('DATE(la.created_at) <= ?');
      queryParams.push(dateTo);
    }

    // Add WHERE clause if conditions exist
    if (whereConditions.length > 0) {
      baseQuery += ' WHERE ' + whereConditions.join(' AND ');
    }

    // Add ORDER BY clause
    const validSortFields = {
      'applicationDate': 'la.created_at',
      'applicantName': 'u.first_name',
      'loanAmount': 'la.loan_amount',
      'status': 'la.status',
      'cibilScore': 'la.loan_amount' // Use loan amount as proxy since credit_score doesn't exist
    };
    
    const sortField = validSortFields[sortBy] || 'la.created_at';
    const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';
    baseQuery += ` ORDER BY ${sortField} ${sortDirection}`;

    // Get total count for pagination (use DISTINCT count to match the main query)
    let countQuery = `
      SELECT COUNT(DISTINCT la.id) as total
      FROM loan_applications la
      LEFT JOIN users u ON la.user_id = u.id
      LEFT JOIN (
        SELECT ed1.user_id, 
               ed1.employment_type, 
               ed1.company_name, 
               ed1.designation, 
               ed1.work_experience_years
        FROM employment_details ed1
        WHERE ed1.id = (
          SELECT MAX(ed2.id)
          FROM employment_details ed2
          WHERE ed2.user_id = ed1.user_id
        )
      ) ed ON u.id = ed.user_id
      LEFT JOIN (
        SELECT a1.user_id,
               a1.city,
               a1.state,
               a1.pincode,
               a1.address_line1,
               a1.address_line2
        FROM addresses a1
        WHERE a1.is_primary = 1
          AND a1.id = (
            SELECT MAX(a2.id)
            FROM addresses a2
            WHERE a2.user_id = a1.user_id AND a2.is_primary = 1
          )
      ) a ON u.id = a.user_id
      LEFT JOIN loan_plans lp ON la.loan_plan_id = lp.id
    `;
    
    // Add WHERE conditions to count query
    if (whereConditions.length > 0) {
      countQuery += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    const countResult = await executeQuery(countQuery, queryParams);
    const totalApplications = countResult[0] ? countResult[0].total : 0;

    // Add pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    baseQuery += ` LIMIT ${parseInt(limit)} OFFSET ${offset}`;

    // Execute the main query
    console.log('🔍 Executing query with params:', queryParams);
    console.log('🔍 Query:', baseQuery);
    
    let applications;
    try {
      applications = await executeQuery(baseQuery, queryParams);
      console.log('🔍 Query executed successfully, got', applications ? applications.length : 0, 'results');
    } catch (queryError) {
      console.error('❌ Query execution error:', queryError);
      throw queryError;
    }

    // Transform the data to match the expected format
    const applicationsWithUserData = applications.map(app => {
      // Parse fees_breakdown JSON if available
      let feesBreakdown = null;
      if (app.fees_breakdown) {
        try {
          feesBreakdown = typeof app.fees_breakdown === 'string' 
            ? JSON.parse(app.fees_breakdown) 
            : app.fees_breakdown;
        } catch (e) {
          console.error('Error parsing fees_breakdown:', e);
        }
      }
      
      // Generate shorter loan ID format: PLL + 4 digits (last 4 digits of application number or ID)
      const loanIdDigits = app.applicationNumber ? app.applicationNumber.slice(-4) : String(app.id).padStart(4, '0').slice(-4);
      const shortLoanId = `PLL${loanIdDigits}`;

      return {
        id: app.applicationNumber || app.id,
        loanId: app.applicationNumber, // Full application number for reference
        shortLoanId: shortLoanId, // Short format: PLL + 4 digits
        userId: app.userId,
        loanAmount: parseFloat(app.loanAmount) || 0,
        loanType: app.loanType?.toLowerCase() || 'personal',
        status: app.status,
        applicationDate: app.applicationDate,
        tenure: app.tenure || 0,
        interestRate: app.interest_percent_per_day 
          ? parseFloat((app.interest_percent_per_day * 365 * 100).toFixed(2)) 
          : 0,
        emiAmount: app.emiAmount || 0,
        rejectionReason: app.rejectionReason,
        approvedBy: app.approvedBy,
        approvedDate: app.approvedDate,
        disbursedDate: app.disbursedDate,
        updatedAt: app.updatedAt,
        applicantName: `${app.first_name || ''} ${app.last_name || ''}`.trim() || 'Unknown User',
        mobile: app.mobile || '',
        email: app.email || '',
        cibilScore: app.credit_score || 750, // Use actual credit score or default
        monthlyIncome: getMonthlyIncomeFromRange(app.income_range), // Convert income range to value
        employment: app.employment_type || 'Salaried', // Use actual employment type
        company: app.company_name || 'N/A', // Use actual company name
        city: app.city || 'N/A', // Use actual city
        state: app.state || 'N/A', // Use actual state
        pincode: app.pincode || '000000', // Use actual pincode
        assignedManager: 'Unassigned', // This would need to be added to the database
        recoveryOfficer: 'Unassigned', // This would need to be added to the database
        // Additional real data fields
        dateOfBirth: app.date_of_birth,
        gender: app.gender,
        maritalStatus: app.marital_status,
        designation: app.designation,
        workExperience: app.work_experience_years,
        monthlyExpenses: app.monthly_expenses,
        existingLoans: app.existing_loans,
        address: app.address_line1 ? `${app.address_line1}${app.address_line2 ? ', ' + app.address_line2 : ''}` : 'N/A',
        kycCompleted: app.kyc_completed || false,
        userStatus: app.userStatus || 'active',
        // Dynamic fees fields
        processingFee: app.processing_fee ? parseFloat(app.processing_fee) : undefined,
        processingFeePercent: app.processing_fee_percent ? parseFloat(app.processing_fee_percent) : undefined,
        feesBreakdown: feesBreakdown,
        disbursalAmount: app.disbursal_amount ? parseFloat(app.disbursal_amount) : undefined,
        totalInterest: app.total_interest ? parseFloat(app.total_interest) : undefined,
        totalRepayable: app.total_repayable ? parseFloat(app.total_repayable) : undefined,
        // Loan plan information
        loan_plan_id: app.loan_plan_id || null,
        plan_code: app.plan_code || null,
        plan_name: app.plan_name || null,
        plan_snapshot: app.plan_snapshot || null,
        // Extension information
        extension_status: app.extension_status || 'none',
        extension_count: app.extension_count || 0
      };
    });

    // Calculate pagination info
    const totalPages = Math.ceil(totalApplications / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      status: 'success',
      data: {
        applications: applicationsWithUserData,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalApplications,
          hasNextPage,
          hasPrevPage,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch applications'
    });
  }
});

// Get application details
router.get('/:applicationId', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { applicationId } = req.params;
    
    // Get comprehensive application details with all related data
    const applicationQuery = `
      SELECT 
        la.*,
        u.first_name,
        u.last_name,
        u.phone,
        u.email,
        u.date_of_birth,
        u.gender,
        u.marital_status,
        u.kyc_completed,
        u.status as user_status,
        u.income_range,
        ed.employment_type,
        ed.company_name,
        ed.designation,
        ed.work_experience_years,
        fd.credit_score,
        fd.monthly_income,
        fd.monthly_expenses,
        fd.existing_loans,
        a.address_line1,
        a.address_line2,
        a.city,
        a.state,
        a.pincode,
        bd.bank_name,
        bd.account_number,
        bd.ifsc_code,
        bd.account_holder_name,
        bd.account_type
      FROM loan_applications la
      LEFT JOIN users u ON la.user_id = u.id
      LEFT JOIN employment_details ed ON u.id = ed.user_id
      LEFT JOIN addresses a ON u.id = a.user_id AND a.is_primary = 1
      LEFT JOIN bank_details bd ON u.id = bd.user_id AND bd.is_primary = 1
      WHERE la.id = ?
    `;
    
    const applications = await executeQuery(applicationQuery, [applicationId]);
    
    if (applications.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Application not found'
      });
    }
    
    const app = applications[0];
    
    // Get additional related data
    const [documents, references, verificationRecords] = await Promise.all([
      executeQuery('SELECT * FROM verification_records WHERE user_id = ?', [app.user_id]),
      executeQuery('SELECT * FROM references WHERE user_id = ?', [app.user_id]),
      executeQuery('SELECT * FROM verification_records WHERE user_id = ?', [app.user_id])
    ]);
    
    const applicationDetails = {
      id: app.id,
      applicationNumber: app.application_number,
      userId: app.user_id,
      loanAmount: app.loan_amount,
      loanPurpose: app.loan_purpose,
      tenureMonths: app.tenure_months,
      interestRate: app.interest_percent_per_day 
        ? parseFloat((app.interest_percent_per_day * 365 * 100).toFixed(2)) 
        : null,
      emiAmount: app.emi_amount,
      status: app.status,
      rejectionReason: app.rejection_reason,
      approvedBy: app.approved_by,
      approvedAt: app.approved_at,
      disbursedAt: app.disbursed_at,
      createdAt: app.created_at,
      updatedAt: app.updated_at,
      user: {
        id: app.user_id,
        firstName: app.first_name,
        lastName: app.last_name,
        fullName: `${app.first_name || ''} ${app.last_name || ''}`.trim(),
        phone: app.phone,
        email: app.email,
        dateOfBirth: app.date_of_birth,
        gender: app.gender,
        maritalStatus: app.marital_status,
        kycCompleted: app.kyc_completed,
        status: app.user_status
      },
      employment: {
        type: app.employment_type,
        company: app.company_name,
        designation: app.designation,
        monthlySalary: getMonthlyIncomeFromRange(app.income_range),
        workExperienceYears: app.work_experience_years
      },
      financial: {
        creditScore: app.credit_score,
        monthlyIncome: app.monthly_income,
        monthlyExpenses: app.monthly_expenses,
        existingLoans: app.existing_loans
      },
      address: {
        line1: app.address_line1,
        line2: app.address_line2,
        city: app.city,
        state: app.state,
        pincode: app.pincode,
        fullAddress: app.address_line1 ? `${app.address_line1}${app.address_line2 ? ', ' + app.address_line2 : ''}, ${app.city}, ${app.state} - ${app.pincode}` : 'N/A'
      },
      bankDetails: {
        bankName: app.bank_name,
        accountNumber: app.account_number,
        ifscCode: app.ifsc_code,
        accountHolderName: app.account_holder_name,
        accountType: app.account_type
      },
      documents: documents,
      references: references,
      verificationRecords: verificationRecords
    };

    res.json({
      status: 'success',
      data: applicationDetails
    });

  } catch (error) {
    console.error('Get application details error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch application details'
    });
  }
});

// Update application status
router.put('/:applicationId/status', authenticateAdmin, validate(schemas.updateApplicationStatus), async (req, res) => {
  try {
    await initializeDatabase();
    
    const { applicationId } = req.params;
    const { status, reason, assignedManager, recoveryOfficer } = req.validatedData;

    // Check if application exists and get full data
    const applicationResult = await executeQuery(
      `SELECT id, user_id, status, loan_amount, plan_snapshot, interest_percent_per_day, 
       fees_breakdown, processed_at, disbursal_amount FROM loan_applications WHERE id = ?`, 
      [applicationId]
    );
    
    if (applicationResult.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Application not found'
      });
    }

    const loan = applicationResult[0];

    // Prevent status changes to pre-processing statuses if loan is already processed
    // Once processed, loan can only move to: account_manager, cleared, active, closed, defaulted
    const preProcessingStatuses = ['submitted', 'under_review', 'disbursement_ready', 'ready_for_disbursement'];
    if (loan.processed_at && preProcessingStatuses.includes(status)) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot change loan status to a pre-processing status after loan has been processed. Loan is frozen at processing time.'
      });
    }

    // Build update query
    let updateQuery = 'UPDATE loan_applications SET status = ?, updated_at = NOW()';
    let updateParams = [status];

    if (reason) {
      updateQuery += ', rejection_reason = ?';
      updateParams.push(reason);
    }

    // Add status-specific timestamps
    if (status === 'approved') {
      updateQuery += ', approved_at = NOW()';
    } else if (status === 'rejected') {
      updateQuery += ', rejected_at = NOW()';
    } else if (status === 'account_manager') {
      // When status changes to account_manager, set processed_at and save calculated values
      if (!loan.processed_at) {
        const { getLoanCalculation } = require('../utils/loanCalculations');
        
        // Get loan calculation
        let calculatedValues = null;
        try {
          calculatedValues = await getLoanCalculation(parseInt(applicationId));
          console.log(`📊 Got loan calculation for loan #${applicationId}`);
        } catch (calcError) {
          console.error(`❌ Error getting loan calculation:`, calcError);
        }

        // Calculate values to save
        const processedAmount = calculatedValues?.disbursal?.amount || loan.disbursal_amount || null;
        const exhaustedPeriodDays = 1; // At processing time, it's day 1 (inclusive counting)
        const pFee = calculatedValues?.totals?.disbursalFee || loan.processing_fee || null;
        const postServiceFee = calculatedValues?.totals?.repayableFee || null;
        const gst = (calculatedValues?.totals?.disbursalFeeGST || 0) + (calculatedValues?.totals?.repayableFeeGST || 0);
        const interest = calculatedValues?.interest?.amount || loan.total_interest || null;
        const penalty = 0; // No penalty at processing time
        
        // Calculate processed_due_date - single date for single payment, JSON array for multi-EMI
        let processedDueDate = null;
        try {
          // Parse plan snapshot to check if it's multi-EMI
          let planSnapshot = {};
          try {
            planSnapshot = typeof loan.plan_snapshot === 'string'
              ? JSON.parse(loan.plan_snapshot)
              : loan.plan_snapshot || {};
          } catch (e) {
            console.error('Error parsing plan_snapshot:', e);
          }
          
          const emiCount = planSnapshot.emi_count || null;
          const isMultiEmi = emiCount && emiCount > 1;
          
          if (isMultiEmi) {
            // Multi-EMI: Generate all EMI dates and store as JSON array
            const { getNextSalaryDate, getSalaryDateForMonth } = require('../utils/loanCalculations');
            const { executeQuery: execQuery } = require('../config/database');
            
            // Get user salary date
            const userResult = await execQuery('SELECT salary_date FROM users WHERE id = ?', [loan.user_id]);
            const userSalaryDate = userResult[0]?.salary_date || null;
            
            // Calculate base date (disbursement date or today)
            const baseDate = loan.disbursed_at ? new Date(loan.disbursed_at) : new Date();
            baseDate.setHours(0, 0, 0, 0);
            
            // Generate all EMI dates
            const allEmiDates = [];
            
            if (planSnapshot.emi_frequency === 'monthly' && planSnapshot.calculate_by_salary_date && userSalaryDate) {
              // Salary-based monthly EMIs
              const salaryDate = parseInt(userSalaryDate);
              if (salaryDate >= 1 && salaryDate <= 31) {
                let nextSalaryDate = getNextSalaryDate(baseDate, salaryDate);
                
                // Check if duration is less than minimum days
                const minDuration = planSnapshot.repayment_days || 15;
                const daysToNextSalary = Math.ceil((nextSalaryDate - baseDate) / (1000 * 60 * 60 * 24)) + 1;
                if (daysToNextSalary < minDuration) {
                  nextSalaryDate = getSalaryDateForMonth(baseDate, salaryDate, 1);
                }
                
                // Ensure nextSalaryDate matches the salary date exactly
                const firstEmiYear = nextSalaryDate.getFullYear();
                const firstEmiMonth = nextSalaryDate.getMonth();
                let correctedFirstEmiDate = new Date(firstEmiYear, firstEmiMonth, salaryDate);
                correctedFirstEmiDate.setHours(0, 0, 0, 0);
                if (correctedFirstEmiDate.getDate() !== salaryDate) {
                  const lastDay = new Date(firstEmiYear, firstEmiMonth + 1, 0).getDate();
                  correctedFirstEmiDate = new Date(firstEmiYear, firstEmiMonth, Math.min(salaryDate, lastDay));
                  correctedFirstEmiDate.setHours(0, 0, 0, 0);
                }
                nextSalaryDate = correctedFirstEmiDate;
                
                // Generate all EMI dates
                for (let i = 0; i < emiCount; i++) {
                  const emiDate = getSalaryDateForMonth(nextSalaryDate, salaryDate, i);
                  allEmiDates.push(formatDateLocal(emiDate)); // Store as YYYY-MM-DD without timezone conversion
                }
              }
            } else {
              // Non-salary-based EMIs
              const firstDueDate = calculatedValues?.interest?.repayment_date 
                ? new Date(calculatedValues.interest.repayment_date)
                : (() => {
                    const dueDate = new Date(baseDate);
                    dueDate.setDate(dueDate.getDate() + (planSnapshot.repayment_days || 15));
                    dueDate.setHours(0, 0, 0, 0);
                    return dueDate;
                  })();
              
              const daysPerEmi = { daily: 1, weekly: 7, biweekly: 14, monthly: 30 };
              const daysBetween = daysPerEmi[planSnapshot.emi_frequency] || 30;
              
              for (let i = 0; i < emiCount; i++) {
                const emiDate = new Date(firstDueDate);
                if (planSnapshot.emi_frequency === 'monthly') {
                  emiDate.setMonth(emiDate.getMonth() + i);
                } else {
                  emiDate.setDate(emiDate.getDate() + (i * daysBetween));
                }
                emiDate.setHours(0, 0, 0, 0);
                allEmiDates.push(formatDateLocal(emiDate)); // Store as YYYY-MM-DD without timezone conversion
              }
            }
            
            // Store as JSON array for multi-EMI
            processedDueDate = JSON.stringify(allEmiDates);
          } else {
            // Single payment: Calculate from plan snapshot and processed_at
            const { getNextSalaryDate, getSalaryDateForMonth, formatDateToString, calculateDaysBetween, parseDateToString } = require('../utils/loanCalculations');
            
            // Get user salary date
            const userResult = await executeQuery('SELECT salary_date FROM users WHERE id = ?', [loan.user_id]);
            const userSalaryDate = userResult[0]?.salary_date || null;
            
            // Calculate base date (use processed_at if available, otherwise disbursed_at or today)
            const baseDate = loan.processed_at 
              ? new Date(loan.processed_at) 
              : (loan.disbursed_at ? new Date(loan.disbursed_at) : new Date());
            baseDate.setHours(0, 0, 0, 0);
            const baseDateStr = formatDateToString(baseDate);
            
            // Try to get from calculatedValues first
            if (calculatedValues?.interest?.repayment_date) {
              processedDueDate = formatDateLocal(calculatedValues.interest.repayment_date);
              console.log(`📅 Single payment loan ${loan.id}: Due date = ${processedDueDate} (from repayment_date)`);
            } else {
              // Calculate from plan snapshot
              const usesSalaryDate = planSnapshot.calculate_by_salary_date === 1 || planSnapshot.calculate_by_salary_date === true;
              const salaryDate = userSalaryDate ? parseInt(userSalaryDate) : null;
              
              if (usesSalaryDate && salaryDate && salaryDate >= 1 && salaryDate <= 31) {
                // Salary-date-based calculation
                const nextSalaryDate = getNextSalaryDate(baseDateStr, salaryDate);
                const minDuration = planSnapshot.repayment_days || planSnapshot.total_duration_days || 15;
                const nextSalaryDateStr = formatDateToString(nextSalaryDate);
                const daysToSalary = calculateDaysBetween(baseDateStr, nextSalaryDateStr);
                
                if (daysToSalary < minDuration) {
                  // Extend to next month's salary date
                  processedDueDate = formatDateToString(getSalaryDateForMonth(nextSalaryDateStr, salaryDate, 1));
                } else {
                  processedDueDate = nextSalaryDateStr;
                }
                console.log(`📅 Single payment loan ${loan.id}: Due date = ${processedDueDate} (salary-date-based, base: ${baseDateStr}, salary date: ${salaryDate})`);
              } else {
                // Fixed days calculation
                const repaymentDays = planSnapshot.repayment_days || planSnapshot.total_duration_days || 15;
                const dueDate = new Date(baseDate);
                dueDate.setDate(dueDate.getDate() + repaymentDays);
                dueDate.setHours(0, 0, 0, 0);
                processedDueDate = formatDateToString(dueDate);
                console.log(`📅 Single payment loan ${loan.id}: Due date = ${processedDueDate} (fixed days: ${repaymentDays}, base: ${baseDateStr})`);
              }
            }
          }
        } catch (dueDateError) {
          console.error('Error calculating processed_due_date:', dueDateError);
          // Fallback to single date
          processedDueDate = calculatedValues?.interest?.repayment_date 
            ? formatDateLocal(calculatedValues.interest.repayment_date)
            : null;
        }
        
        const dueDate = processedDueDate; // Use the calculated processedDueDate

        updateQuery += `, processed_at = NOW(), 
          processed_amount = ?,
          exhausted_period_days = ?,
          processed_p_fee = ?,
          processed_post_service_fee = ?,
          processed_gst = ?,
          processed_interest = ?,
          processed_penalty = ?,
          processed_due_date = ?,
          disbursed_at = COALESCE(disbursed_at, NOW())`;
        
        updateParams.push(
          processedAmount,
          exhaustedPeriodDays,
          pFee,
          postServiceFee,
          gst || null,
          interest,
          penalty,
          processedDueDate
        );
        
        console.log(`✅ Saving calculated values for loan #${applicationId} when changing to account_manager`);
      } else {
        console.log(`⚠️ Loan #${applicationId} already processed, skipping calculation save`);
      }
    }

    updateQuery += ' WHERE id = ?';
    updateParams.push(applicationId);

    await executeQuery(updateQuery, updateParams);

    // Update partner leads if status changed to account_manager and loan is disbursed
    if (status === 'account_manager') {
      try {
        const updatedLoan = await executeQuery(
          `SELECT id, loan_amount, disbursal_amount, disbursed_at FROM loan_applications WHERE id = ?`,
          [applicationId]
        );
        
        if (updatedLoan && updatedLoan.length > 0 && updatedLoan[0].disbursed_at) {
          const { updateLeadPayout } = require('../services/partnerPayoutService');
          const partnerLeads = await executeQuery(
            `SELECT id FROM partner_leads WHERE loan_application_id = ? LIMIT 1`,
            [applicationId]
          );
          
          if (partnerLeads && partnerLeads.length > 0) {
            const disbursalAmount = updatedLoan[0].disbursal_amount || updatedLoan[0].loan_amount;
            const disbursedAt = new Date(updatedLoan[0].disbursed_at);
            await updateLeadPayout(
              partnerLeads[0].id,
              disbursalAmount,
              disbursedAt
            );
            console.log(`✅ Updated partner lead payout for lead ${partnerLeads[0].id} (from admin status update)`);
          }
        }
      } catch (partnerError) {
        console.error('Error updating partner lead payout:', partnerError);
        // Don't fail the status update if partner update fails
      }
    }

    res.json({
      status: 'success',
      message: 'Application status updated successfully',
      data: { applicationId, status }
    });

  } catch (error) {
    console.error('Update application status error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update application status'
    });
  }
});

// Update loan application amount (principal amount)
router.put('/:applicationId/amount', authenticateAdmin, async (req, res) => {
  try {
    console.log('💰 Update loan amount request received:', req.params.applicationId, req.body);
    await initializeDatabase();
    const { applicationId } = req.params;
    const { loan_amount, principalAmount } = req.body;

    const amount = loan_amount || principalAmount;

    if (!amount || isNaN(parseFloat(amount))) {
      return res.status(400).json({
        status: 'error',
        message: 'Valid loan amount is required'
      });
    }

    // Check if application exists and if it's already processed
    const applicationResult = await executeQuery('SELECT id, user_id, processed_at FROM loan_applications WHERE id = ?', [applicationId]);
    if (applicationResult.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Application not found'
      });
    }

    // Prevent amount changes if loan is already processed
    if (applicationResult[0].processed_at) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot change loan amount after loan has been processed. Loan amount is frozen at processing time.'
      });
    }

    // Update loan amount
    await executeQuery(
      'UPDATE loan_applications SET loan_amount = ?, updated_at = NOW() WHERE id = ?',
      [parseFloat(amount), applicationId]
    );

    console.log('✅ Loan amount updated successfully');
    res.json({
      status: 'success',
      message: 'Loan amount updated successfully',
      data: { applicationId, loan_amount: parseFloat(amount) }
    });

  } catch (error) {
    console.error('Update loan amount error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update loan amount'
    });
  }
});

// Assign application to manager
router.put('/:applicationId/assign', authenticateAdmin, validate(schemas.assignApplication), async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { assignedManager, recoveryOfficer } = req.validatedData;

    const application = LoanApplication.findById(applicationId);
    if (!application) {
      return res.status(404).json({
        status: 'error',
        message: 'Application not found'
      });
    }

    const updateData = {
      assignedManager,
      recoveryOfficer,
      updatedAt: new Date().toISOString()
    };

    const updatedApplication = LoanApplication.update(applicationId, updateData);

    res.json({
      status: 'success',
      message: 'Application assigned successfully',
      data: updatedApplication
    });

  } catch (error) {
    console.error('Assign application error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to assign application'
    });
  }
});

// Assign/Update loan plan for an existing loan application
router.put('/:applicationId/loan-plan', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { applicationId } = req.params;
    const { plan_id } = req.body;

    if (!plan_id) {
      return res.status(400).json({
        status: 'error',
        message: 'Plan ID is required'
      });
    }

    // Verify loan application exists and check if processed
    const applications = await executeQuery(
      'SELECT id, user_id, processed_at FROM loan_applications WHERE id = ?',
      [applicationId]
    );

    if (applications.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Loan application not found'
      });
    }

    // Prevent plan changes if loan is already processed
    if (applications[0].processed_at) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot change loan plan after loan has been processed (disbursed). Loan plan is frozen at processing time.'
      });
    }

    // Verify plan exists and is active
    const plans = await executeQuery(
      'SELECT * FROM loan_plans WHERE id = ? AND is_active = 1',
      [plan_id]
    );

    if (plans.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Loan plan not found or inactive'
      });
    }

    const plan = plans[0];

    // Fetch plan fees
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

    // Create plan snapshot
    const planSnapshot = {
      plan_id: plan.id,
      plan_name: plan.plan_name,
      plan_code: plan.plan_code,
      plan_type: plan.plan_type,
      repayment_days: plan.repayment_days,
      total_duration_days: plan.total_duration_days,
      interest_percent_per_day: parseFloat(plan.interest_percent_per_day || 0.001),
      calculate_by_salary_date: plan.calculate_by_salary_date === 1 || plan.calculate_by_salary_date === true,
      emi_count: plan.emi_count,
      emi_frequency: plan.emi_frequency,
      allow_extension: plan.allow_extension === 1 || plan.allow_extension === true,
      extension_show_from_days: plan.extension_show_from_days,
      extension_show_till_days: plan.extension_show_till_days,
      max_extensions: plan.max_extensions || null,
      fees: planFees.map(pf => ({
        fee_name: pf.fee_name,
        fee_percent: parseFloat(pf.fee_percent),
        application_method: pf.application_method
      }))
    };

    // Update loan application with plan snapshot AND loan_plan_id
    await executeQuery(
      `UPDATE loan_applications 
       SET loan_plan_id = ?, plan_snapshot = ?, updated_at = NOW() 
       WHERE id = ?`,
      [plan_id, JSON.stringify(planSnapshot), applicationId]
    );

    res.json({
      status: 'success',
      message: 'Loan plan assigned successfully',
      data: {
        application_id: applicationId,
        plan_id: plan.id,
        plan_code: plan.plan_code,
        plan_name: plan.plan_name
      }
    });

  } catch (error) {
    console.error('Assign loan plan error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to assign loan plan'
    });
  }
});

// Get application statistics
router.get('/stats/overview', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    
    // Get total applications
    const totalResult = await executeQuery('SELECT COUNT(*) as total FROM loan_applications');
    const total = totalResult[0].total;
    
    // Get status breakdown
    const statusResult = await executeQuery(`
      SELECT 
        status,
        COUNT(*) as count
      FROM loan_applications 
      GROUP BY status
    `);
    
    const statusCounts = {};
    statusResult.forEach(row => {
      statusCounts[row.status] = row.count;
    });
    
    // Get loan type breakdown
    const typeResult = await executeQuery(`
      SELECT 
        loan_purpose,
        COUNT(*) as count
      FROM loan_applications 
      GROUP BY loan_purpose
    `);
    
    const typeCounts = {};
    typeResult.forEach(row => {
      typeCounts[row.loan_purpose] = row.count;
    });
    
    // Get total and average amounts
    const amountResult = await executeQuery(`
      SELECT 
        SUM(loan_amount) as totalAmount,
        AVG(loan_amount) as averageAmount
      FROM loan_applications
    `);
    
    const stats = {
      // Frontend expected field names
      totalApplications: total,
      submittedApplications: statusCounts['submitted'] || 0,
      pendingApplications: statusCounts['under_review'] || 0,
      followUpApplications: statusCounts['follow_up'] || 0,
      rejectedApplications: statusCounts['rejected'] || 0,
      disbursalApplications: statusCounts['disbursal'] || 0,
      readyForDisbursementApplications: statusCounts['ready_for_disbursement'] || 0,
      accountManagerApplications: statusCounts['account_manager'] || 0,
      clearedApplications: statusCounts['cleared'] || 0,
      newApplications: statusCounts['submitted'] || 0, // New applications are typically submitted
      
      // Legacy field names for backward compatibility
      total: total,
      applied: statusCounts['applied'] || 0,
      underReview: statusCounts['under_review'] || 0,
      approved: statusCounts['follow_up'] || 0,
      rejected: statusCounts['rejected'] || 0,
      pendingDocuments: statusCounts['pending_documents'] || 0,
      personalLoans: typeCounts['Personal'] || 0,
      businessLoans: typeCounts['Business'] || 0,
      totalAmount: parseFloat(amountResult[0].totalAmount) || 0,
      averageAmount: parseFloat(amountResult[0].averageAmount) || 0
    };

    res.json({
      status: 'success',
      data: stats
    });

  } catch (error) {
    console.error('Get application stats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch application statistics'
    });
  }
});

// Export applications
router.get('/export/csv', authenticateAdmin, async (req, res) => {
  try {
    const { status = 'all', loanType = 'all' } = req.query;
    
    let applications = LoanApplication.findAll();
    
    // Apply filters
    if (status !== 'all') {
      applications = applications.filter(app => app.status === status);
    }
    if (loanType !== 'all') {
      applications = applications.filter(app => app.loanType === loanType);
    }

    // Get user data for each application
    const applicationsWithUserData = applications.map(app => {
      const user = User.findById(app.userId);
      return {
        ...app,
        applicantName: user ? user.name : 'Unknown User',
        mobile: user ? user.mobile : '',
        email: user ? user.email : '',
        cibilScore: user ? user.creditScore : 0,
        monthlyIncome: user ? user.personalInfo?.monthlyIncome || 0 : 0,
        employment: user ? user.personalInfo?.employment || '' : '',
        company: user ? user.personalInfo?.company || '' : '',
        city: user ? user.personalInfo?.city || '' : '',
        state: user ? user.personalInfo?.state || '' : '',
        pincode: user ? user.personalInfo?.pincode || '' : ''
      };
    });

    // Convert to CSV
    const csvHeaders = [
      'ID', 'Applicant Name', 'Mobile', 'Email', 'Loan Amount', 'Loan Type',
      'Status', 'Application Date', 'Assigned Manager', 'Recovery Officer',
      'Cibil Score', 'Monthly Income', 'Employment', 'Company', 'City', 'State', 'Pincode'
    ];

    const csvRows = applicationsWithUserData.map(app => [
      app.id,
      app.applicantName,
      app.mobile,
      app.email,
      app.loanAmount,
      app.loanType,
      app.status,
      app.applicationDate,
      app.assignedManager,
      app.recoveryOfficer,
      app.cibilScore,
      app.monthlyIncome,
      app.employment,
      app.company,
      app.city,
      app.state,
      app.pincode
    ]);

    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=loan_applications.csv');
    res.send(csvContent);

  } catch (error) {
    console.error('Export applications error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to export applications'
    });
  }
});

module.exports = router;
