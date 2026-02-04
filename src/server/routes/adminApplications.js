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
        DATE_FORMAT(la.approved_at, '%Y-%m-%d') as approvedDate,
        DATE_FORMAT(la.disbursed_at, '%Y-%m-%d') as disbursedDate,
        DATE_FORMAT(la.created_at, '%Y-%m-%d') as applicationDate,
        DATE_FORMAT(la.updated_at, '%Y-%m-%d') as updatedAt,
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
      
      // Special handling for cleared status: only show cleared loans where user has no current active loan
      if (status === 'cleared') {
        whereConditions.push(`NOT EXISTS (
          SELECT 1 
          FROM loan_applications la2 
          WHERE la2.user_id = la.user_id 
            AND la2.id != la.id
            AND la2.status NOT IN ('cleared', 'rejected', 'cancelled')
        )`);
      }
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
      'applicationDate': 'applicationDate',
      'applicantName': 'u.first_name',
      'loanAmount': 'la.loan_amount',
      'status': 'la.status',
      'cibilScore': 'la.loan_amount' // Use loan amount as proxy since credit_score doesn't exist
    };
    
    const sortField = validSortFields[sortBy] || 'applicationDate';
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
    let applications;
    try {
      applications = await executeQuery(baseQuery, queryParams);
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

    // Block status changes for loans in account_manager status
    // Loans in account_manager status cannot be changed to: not_process, re_process, delete, cancel, process, hold
    if (loan.status === 'account_manager') {
      const blockedStatuses = ['submitted', 'under_review', 'follow_up', 'rejected', 'cancelled', 'disbursal', 'ready_for_disbursement'];
      if (blockedStatuses.includes(status)) {
        return res.status(400).json({
          status: 'error',
          message: `Cannot change loan status from account_manager to "${status}". Loans in account_manager status cannot be modified.`
        });
      }
    }

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
        const processedAmount = calculatedValues?.disbursal?.amount || loan.disbursal_amount || loan.loan_amount || 0;
        const exhaustedPeriodDays = 1; // At processing time, it's day 1 (inclusive counting)
        const pFee = calculatedValues?.totals?.disbursalFee || loan.processing_fee || 0;
        const postServiceFee = calculatedValues?.totals?.repayableFee || 0;
        const gst = (calculatedValues?.totals?.disbursalFeeGST || 0) + (calculatedValues?.totals?.repayableFeeGST || 0);
        const interest = calculatedValues?.interest?.amount || loan.total_interest || 0;
        const penalty = 0; // No penalty at processing time
        
        // Validate processedAmount - it should never be null or 0 for account_manager loans
        if (!processedAmount || processedAmount <= 0) {
          console.error(`❌ ERROR: processedAmount is invalid (${processedAmount}) for loan #${applicationId}. Cannot create EMI schedule.`);
          return res.status(400).json({
            success: false,
            message: 'Cannot move loan to account_manager status: Invalid loan amount. Please ensure the loan has a valid disbursal amount or loan amount.'
          });
        }
        
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
            
            // Calculate base date (processed_at for processed loans, otherwise disbursed_at or today)
            // Parse date as string first to avoid timezone conversion
            const { parseDateToString } = require('../utils/loanCalculations');
            let baseDate;
            // For processed loans, use processed_at as base date (per rulebook)
            if (loan.processed_at && ['account_manager', 'cleared'].includes(loan.status)) {
              const dateStr = parseDateToString(loan.processed_at);
              if (dateStr) {
                const [year, month, day] = dateStr.split('-').map(Number);
                baseDate = new Date(year, month - 1, day);
              } else {
                baseDate = new Date();
              }
            } else if (loan.disbursed_at) {
              const dateStr = parseDateToString(loan.disbursed_at);
              if (dateStr) {
                const [year, month, day] = dateStr.split('-').map(Number);
                baseDate = new Date(year, month - 1, day);
              } else {
                baseDate = new Date();
              }
            } else {
              baseDate = new Date();
            }
            baseDate.setHours(0, 0, 0, 0);
            
            // Generate all EMI dates
            const allEmiDates = [];
            
            console.log(`[EMI Date Calc] Loan #${applicationId}: emi_frequency=${planSnapshot.emi_frequency}, calculate_by_salary_date=${planSnapshot.calculate_by_salary_date}, userSalaryDate=${userSalaryDate}`);
            
            if (planSnapshot.emi_frequency === 'monthly' && planSnapshot.calculate_by_salary_date && userSalaryDate) {
              // Salary-based monthly EMIs
              const salaryDate = parseInt(userSalaryDate);
              if (salaryDate >= 1 && salaryDate <= 31) {
                let nextSalaryDate = getNextSalaryDate(baseDate, salaryDate);
                
                // Check if duration is less than minimum days (must be at least this many days till first EMI)
                // For EMI loans, enforce minimum 30 days regardless of plan setting
                const minDuration = Math.max(planSnapshot.repayment_days || 0, 30);
                const daysToNextSalary = Math.ceil((nextSalaryDate - baseDate) / (1000 * 60 * 60 * 24)) + 1;
                
                console.log(`[EMI Date Calc] Loan #${applicationId}: baseDate=${formatDateLocal(baseDate)}, nextSalaryDate=${formatDateLocal(nextSalaryDate)}, daysToNextSalary=${daysToNextSalary}, minDuration=${minDuration}`);
                
                if (daysToNextSalary < minDuration) {
                  console.log(`[EMI Date Calc] Loan #${applicationId}: Skipping to next month (${daysToNextSalary} < ${minDuration})`);
                  nextSalaryDate = getSalaryDateForMonth(nextSalaryDate, salaryDate, 1);
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
                console.log(`[EMI Date Calc] Loan #${applicationId}: Generated salary-based EMI dates: ${JSON.stringify(allEmiDates)}`);
              } else {
                console.warn(`⚠️ Invalid salary date (${userSalaryDate}) for loan #${applicationId}, will fall back to non-salary calculation`);
              }
            } else {
              console.log(`[EMI Date Calc] Loan #${applicationId}: Not using salary-based calculation (emi_frequency=${planSnapshot.emi_frequency}, calculate_by_salary_date=${planSnapshot.calculate_by_salary_date})`);
            }
            
            // If salary-based calculation didn't generate dates, use non-salary method with min duration check
            if (allEmiDates.length === 0 && emiCount > 1) {
              console.log(`[EMI Date Calc] Loan #${applicationId}: Using fallback method for EMI dates`);
              
              // Get the calculated repayment date, but apply min duration check
              let firstDueDate = calculatedValues?.interest?.repayment_date 
                ? new Date(calculatedValues.interest.repayment_date)
                : (() => {
                    const dueDate = new Date(baseDate);
                    dueDate.setDate(dueDate.getDate() + (planSnapshot.repayment_days || 30));
                    dueDate.setHours(0, 0, 0, 0);
                    return dueDate;
                  })();
              
              // Apply minimum duration check for fallback method too
              // For EMI loans, enforce minimum 30 days regardless of plan setting
              const minDuration = Math.max(planSnapshot.repayment_days || 0, 30);
              const daysToFirstDue = Math.ceil((firstDueDate - baseDate) / (1000 * 60 * 60 * 24)) + 1;
              if (daysToFirstDue < minDuration) {
                // Push to next month
                firstDueDate.setMonth(firstDueDate.getMonth() + 1);
                console.log(`[EMI Date Calc] Loan #${applicationId}: Fallback - pushed firstDueDate to next month (${daysToFirstDue} < ${minDuration})`);
              }
              
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
                allEmiDates.push(formatDateLocal(emiDate));
              }
            }
            
            // Fallback: If EMI dates weren't generated, use default calculation
            if (allEmiDates.length === 0 && emiCount > 1) {
              console.warn(`⚠️ EMI dates not generated by primary method, using fallback for loan #${applicationId}`);
              const fallbackDueDate = new Date(baseDate);
              fallbackDueDate.setDate(fallbackDueDate.getDate() + (planSnapshot.repayment_days || 15));
              fallbackDueDate.setHours(0, 0, 0, 0);
              const daysPerEmi = { daily: 1, weekly: 7, biweekly: 14, monthly: 30 };
              const daysBetween = daysPerEmi[planSnapshot.emi_frequency] || 30;
              
              for (let i = 0; i < emiCount; i++) {
                const emiDate = new Date(fallbackDueDate);
                if (planSnapshot.emi_frequency === 'monthly') {
                  emiDate.setMonth(emiDate.getMonth() + i);
                } else {
                  emiDate.setDate(emiDate.getDate() + (i * daysBetween));
                }
                emiDate.setHours(0, 0, 0, 0);
                allEmiDates.push(formatDateLocal(emiDate));
              }
            }
            
            // Validate EMI dates were generated
            if (!allEmiDates || allEmiDates.length !== emiCount) {
              console.error(`❌ ERROR: Failed to generate EMI dates for loan #${applicationId}. Expected ${emiCount} dates but got ${allEmiDates?.length || 0}`);
              return res.status(400).json({
                success: false,
                message: `Cannot create EMI schedule: Failed to generate ${emiCount} EMI dates. Please check loan plan configuration.`
              });
            }
            
            // Store as JSON array for multi-EMI
            processedDueDate = JSON.stringify(allEmiDates);
            console.log(`[EMI Date Calc] Loan #${applicationId}: Final processed_due_date = ${processedDueDate}`);
            
            // Create emi_schedule with dates, amounts, and status using REDUCING BALANCE method
            const { formatDateToString, calculateDaysBetween, getTodayString, toDecimal2 } = require('../utils/loanCalculations');
            const emiSchedule = [];
            
            // Validate processedAmount is valid before calculation
            if (!processedAmount || processedAmount <= 0 || isNaN(processedAmount)) {
              console.error(`❌ ERROR: Invalid processedAmount (${processedAmount}) for loan #${applicationId} EMI calculation`);
              return res.status(400).json({
                success: false,
                message: 'Cannot create EMI schedule: Invalid processed amount. Please ensure the loan has a valid disbursal amount.'
              });
            }
            
            const principalPerEmi = toDecimal2(Math.floor(processedAmount / emiCount * 100) / 100);
            const remainder = toDecimal2(processedAmount - (principalPerEmi * emiCount));
            
            // Calculate per-EMI fees (post service fee and GST are already total amounts)
            // IMPORTANT: postServiceFee and repayableFeeGST are TOTAL amounts, need to divide by emiCount for per-EMI
            // NOTE: Only use repayableFeeGST for EMI calculations, NOT disbursalFeeGST (which is deducted upfront)
            const totalRepayableFeeGST = calculatedValues?.totals?.repayableFeeGST || 0;
            const postServiceFeePerEmi = toDecimal2((postServiceFee || 0) / emiCount);
            const postServiceFeeGSTPerEmi = toDecimal2(totalRepayableFeeGST / emiCount);
            
            // Get interest rate per day
            const interestRatePerDay = parseFloat(loan.interest_percent_per_day || 0.001);
            
            // Log EMI calculation inputs for debugging
            
            // Calculate base date for interest calculation (processed_at takes priority over disbursed_at)
            // Parse date as string first to avoid timezone conversion
            // parseDateToString and getTodayString are already imported above
            let interestBaseDate;
            if (loan.processed_at) {
              const dateStr = parseDateToString(loan.processed_at);
              if (dateStr) {
                const [year, month, day] = dateStr.split('-').map(Number);
                interestBaseDate = new Date(year, month - 1, day);
              } else {
                interestBaseDate = baseDate;
              }
            } else {
              interestBaseDate = baseDate;
            }
            interestBaseDate.setHours(0, 0, 0, 0);
            const baseDateStr = formatDateToString(interestBaseDate) || getTodayString();
            
            // Track outstanding principal for reducing balance calculation
            let outstandingPrincipal = processedAmount;
            
            // Calculate EMI amounts using reducing balance method
            for (let i = 0; i < emiCount; i++) {
              const emiDateStr = allEmiDates[i];
              
              // Calculate days for this period
              let previousDateStr;
              if (i === 0) {
                // First EMI: from base date (processed_at/disbursed_at) to first EMI date
                previousDateStr = baseDateStr;
              } else {
                // Subsequent EMIs: from day AFTER previous EMI date to current EMI date
                const prevEmiDateStr = allEmiDates[i - 1];
                const [prevYear, prevMonth, prevDay] = prevEmiDateStr.split('-').map(Number);
                const prevDueDate = new Date(prevYear, prevMonth - 1, prevDay);
                prevDueDate.setDate(prevDueDate.getDate() + 1); // Add 1 day (inclusive counting)
                previousDateStr = formatDateToString(prevDueDate);
              }
              
              // Calculate days between dates (inclusive)
              const daysForPeriod = calculateDaysBetween(previousDateStr, emiDateStr);
              
              // Calculate principal for this EMI (last EMI gets remainder)
              const principalForThisEmi = i === emiCount - 1
                ? toDecimal2(principalPerEmi + remainder)
                : principalPerEmi;
              
              // Calculate interest for this period on reducing balance
              const interestForPeriod = toDecimal2(outstandingPrincipal * interestRatePerDay * daysForPeriod);
              
              // Calculate EMI amount: principal + interest + post service fee + GST
              const emiAmount = toDecimal2(principalForThisEmi + interestForPeriod + postServiceFeePerEmi + postServiceFeeGSTPerEmi);
              
              // Reduce outstanding principal for next EMI
              outstandingPrincipal = toDecimal2(outstandingPrincipal - principalForThisEmi);
              
              emiSchedule.push({
                emi_number: i + 1,
                instalment_no: i + 1,
                due_date: emiDateStr,
                emi_amount: emiAmount,
                status: 'pending'
              });
              
            }
            
            // Update emi_schedule in the update query
            updateQuery += `, emi_schedule = ?`;
            updateParams.push(JSON.stringify(emiSchedule));
          } else {
            // Single payment: Calculate from plan snapshot and processed_at
            const { getNextSalaryDate, getSalaryDateForMonth, formatDateToString, calculateDaysBetween, parseDateToString } = require('../utils/loanCalculations');
            
            // Get user salary date
            const userResult = await executeQuery('SELECT salary_date FROM users WHERE id = ?', [loan.user_id]);
            const userSalaryDate = userResult[0]?.salary_date || null;
            
            // Calculate base date (use processed_at if available, otherwise disbursed_at or today)
            // Parse date as string first to avoid timezone conversion
            let baseDate;
            if (loan.processed_at) {
              const dateStr = parseDateToString(loan.processed_at);
              if (dateStr) {
                const [year, month, day] = dateStr.split('-').map(Number);
                baseDate = new Date(year, month - 1, day);
              } else {
                baseDate = new Date();
              }
            } else if (loan.disbursed_at) {
              const dateStr = parseDateToString(loan.disbursed_at);
              if (dateStr) {
                const [year, month, day] = dateStr.split('-').map(Number);
                baseDate = new Date(year, month - 1, day);
              } else {
                baseDate = new Date();
              }
            } else {
              baseDate = new Date();
            }
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
            
            // Create emi_schedule for single payment loan
            // NOTE: Only use repayableFeeGST for repayment amount, NOT disbursalFeeGST (which is deducted upfront)
            const repayableFeeGST = calculatedValues?.totals?.repayableFeeGST || 0;
            const totalAmount = (processedAmount || 0) + (interest || 0) + (postServiceFee || 0) + (repayableFeeGST || 0);
            const emiScheduleForSingle = [{
              emi_number: 1,
              instalment_no: 1,
              due_date: processedDueDate,
              emi_amount: totalAmount,
              status: 'pending'
            }];
            
            updateQuery += `, emi_schedule = ?`;
            updateParams.push(JSON.stringify(emiScheduleForSingle));
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
            // Parse date as string first to avoid timezone conversion
            const { parseDateToString } = require('../utils/loanCalculations');
            let disbursedAt;
            if (updatedLoan[0].disbursed_at) {
              const dateStr = parseDateToString(updatedLoan[0].disbursed_at);
              if (dateStr) {
                const [year, month, day] = dateStr.split('-').map(Number);
                disbursedAt = new Date(year, month - 1, day);
              } else {
                disbursedAt = new Date();
              }
            } else {
              disbursedAt = new Date();
            }
            disbursedAt.setHours(0, 0, 0, 0);
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

    // Send NOC email if status changed to cleared
    if (status === 'cleared') {
      try {
        const emailService = require('../services/emailService');
        const pdfService = require('../services/pdfService');
        
        // Get loan details for NOC
        const loanDetails = await executeQuery(`
          SELECT 
            la.*,
            u.first_name, u.last_name, u.email, u.personal_email, u.official_email, 
            u.phone, u.date_of_birth, u.gender, u.marital_status, u.pan_number
          FROM loan_applications la
          INNER JOIN users u ON la.user_id = u.id
          WHERE la.id = ?
        `, [applicationId]);
        
        if (loanDetails && loanDetails.length > 0) {
          const loanDetail = loanDetails[0];
          const recipientEmail = loanDetail.personal_email || loanDetail.official_email || loanDetail.email;
          const recipientName = `${loanDetail.first_name || ''} ${loanDetail.last_name || ''}`.trim() || 'User';
          
          if (recipientEmail) {
            // Generate NOC HTML
            const formatDate = (dateString) => {
              if (!dateString || dateString === 'N/A') return 'N/A';
              try {
                if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
                  const [year, month, day] = dateString.split('-');
                  return `${day}-${month}-${year}`;
                }
                if (typeof dateString === 'string' && dateString.includes('T')) {
                  const datePart = dateString.split('T')[0];
                  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
                    const [year, month, day] = datePart.split('-');
                    return `${day}-${month}-${year}`;
                  }
                }
                if (typeof dateString === 'string' && dateString.includes(' ')) {
                  const datePart = dateString.split(' ')[0];
                  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
                    const [year, month, day] = datePart.split('-');
                    return `${day}-${month}-${year}`;
                  }
                }
                const date = new Date(dateString);
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const year = date.getFullYear();
                return `${day}-${month}-${year}`;
              } catch {
                return dateString;
              }
            };
            
            const borrowerName = recipientName;
            const applicationNumber = loanDetail.application_number || applicationId;
            const shortLoanId = applicationNumber && applicationNumber !== 'N/A' 
              ? `PLL${String(applicationNumber).slice(-4)}`
              : `PLL${String(applicationId).padStart(4, '0').slice(-4)}`;
            const todayDate = formatDate(new Date().toISOString());
            
            const htmlContent = `
              <div style="font-family: 'Times New Roman', Times, serif; font-size: 11pt; line-height: 1.6; background-color: white;">
                <div style="padding: 32px;">
                  <div style="text-align: center; margin-bottom: 16px; border-bottom: 1px solid #000; padding-bottom: 8px;">
                    <h2 style="font-weight: bold; margin-bottom: 4px; font-size: 14pt;">
                      SPHEETI FINTECH PRIVATE LIMITED
                    </h2>
                    <p style="font-size: 12px; margin-bottom: 4px;">
                      CIN: U65929MH2018PTC306088 | RBI Registration no: N-13.02361
                    </p>
                    <p style="font-size: 12px; margin-bottom: 8px;">
                      Mahadev Compound Gala No. A7, Dhobi Ghat Road, Ulhasnagar MUMBAI, MAHARASHTRA, 421001
                    </p>
                  </div>
                  <div style="text-align: center; margin-bottom: 24px;">
                    <h1 style="font-weight: bold; font-size: 13pt; text-transform: uppercase;">
                      NO DUES CERTIFICATE
                    </h1>
                  </div>
                  <div style="margin-bottom: 16px;">
                    <p style="font-size: 12px;"><strong>Date :</strong> ${todayDate}</p>
                  </div>
                  <div style="margin-bottom: 16px;">
                    <p style="font-size: 12px;"><strong>Name of the Customer:</strong> ${borrowerName}</p>
                  </div>
                  <div style="margin-bottom: 16px;">
                    <p style="font-size: 12px;"><strong>Sub: No Dues Certificate for Loan ID - ${shortLoanId}</strong></p>
                  </div>
                  <div style="margin-bottom: 16px;">
                    <p style="font-weight: bold;">Dear Sir/Madam,</p>
                  </div>
                  <div style="margin-bottom: 24px; text-align: justify;">
                    <p>This letter is to confirm that Spheeti Fintech Private Limited has received payment for the aforesaid loan ID and no amount is outstanding and payable by you to the Company under the aforesaid loan ID.</p>
                  </div>
                  <div style="margin-top: 32px;">
                    <p style="margin-bottom: 4px; font-weight: bold;">Thanking you,</p>
                    <p style="font-weight: bold;">On behalf of Spheeti Fintech Private Limited</p>
                  </div>
                </div>
              </div>
            `;
            
            // Generate PDF
            const filename = `No_Dues_Certificate_${applicationNumber}.pdf`;
            const pdfResult = await pdfService.generateKFSPDF(htmlContent, filename);
            let pdfBuffer = Buffer.isBuffer(pdfResult) ? pdfResult : (pdfResult.buffer || pdfResult);
            if (!Buffer.isBuffer(pdfBuffer) && pdfBuffer instanceof Uint8Array) {
              pdfBuffer = Buffer.from(pdfBuffer);
            }
            
            // Send email
            await emailService.sendNOCEmail({
              loanId: parseInt(applicationId),
              recipientEmail: recipientEmail,
              recipientName: recipientName,
              loanData: {
                application_number: applicationNumber,
                loan_amount: loanDetail.loan_amount || loanDetail.sanctioned_amount || 0
              },
              pdfBuffer: pdfBuffer,
              pdfFilename: filename,
              sentBy: req.admin?.id || null
            });
            
            console.log(`✅ NOC email sent successfully to ${recipientEmail} for loan #${applicationId} (admin status update)`);
          }
        }
      } catch (nocEmailError) {
        console.error('❌ Error sending NOC email (non-fatal):', nocEmailError);
        // Don't fail - email failure shouldn't block status update
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
      repeatDisbursalApplications: statusCounts['repeat_disbursal'] || 0,
      readyToRepeatDisbursalApplications: statusCounts['ready_to_repeat_disbursal'] || 0,
      accountManagerApplications: statusCounts['account_manager'] || 0,
      overdueApplications: statusCounts['overdue'] || 0,
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

// Export applications to Excel (CSV format that Excel can open)
router.get('/export/excel', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    
    const {
      status = 'all',
      loanType = 'all',
      search = '',
      dateFrom = '',
      dateTo = ''
    } = req.query;

    // Build the same query as the main GET endpoint but without pagination
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
        la.processing_fee,
        la.processing_fee_percent,
        la.disbursal_amount,
        la.total_interest,
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
        u.pan_number,
        COALESCE(ed.employment_type, '') as employment_type,
        COALESCE(ed.company_name, '') as company_name,
        COALESCE(ed.designation, '') as designation,
        COALESCE(ed.work_experience_years, 0) as work_experience_years,
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
      
      // Special handling for cleared status: only show cleared loans where user has no current active loan
      if (status === 'cleared') {
        whereConditions.push(`NOT EXISTS (
          SELECT 1 
          FROM loan_applications la2 
          WHERE la2.user_id = la.user_id 
            AND la2.id != la.id
            AND la2.status NOT IN ('cleared', 'rejected', 'cancelled')
        )`);
      }
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

    // Order by application date descending (use alias since SELECT DISTINCT requires it)
    baseQuery += ' ORDER BY applicationDate DESC';

    // Execute query
    const applications = await executeQuery(baseQuery, queryParams);

    // Transform data for export
    const exportData = applications.map(app => {
      const applicantName = `${app.first_name || ''} ${app.last_name || ''}`.trim() || 'Unknown User';
      const address = app.address_line1 ? `${app.address_line1}${app.address_line2 ? ', ' + app.address_line2 : ''}` : '';
      
      return {
        'Application ID': app.applicationNumber || app.id,
        'Applicant Name': applicantName,
        'Mobile': app.mobile || '',
        'Email': app.email || '',
        'PAN Number': app.pan_number || '',
        'Date of Birth': app.date_of_birth || '',
        'Gender': app.gender || '',
        'Marital Status': app.marital_status || '',
        'Loan Amount': parseFloat(app.loanAmount) || 0,
        'Loan Type': app.loanType || '',
        'Tenure (Months)': app.tenure || 0,
        'Interest Rate (% per day)': app.interest_percent_per_day ? parseFloat(app.interest_percent_per_day) : 0,
        'EMI Amount': app.emiAmount ? parseFloat(app.emiAmount) : 0,
        'Status': app.status || '',
        'Application Date': app.applicationDate ? formatDateLocal(app.applicationDate) : '',
        'Approved Date': app.approvedDate ? formatDateLocal(app.approvedDate) : '',
        'Disbursed Date': app.disbursedDate ? formatDateLocal(app.disbursedDate) : '',
        'Processing Fee': app.processing_fee ? parseFloat(app.processing_fee) : 0,
        'Processing Fee %': app.processing_fee_percent ? parseFloat(app.processing_fee_percent) : 0,
        'Disbursal Amount': app.disbursal_amount ? parseFloat(app.disbursal_amount) : 0,
        'Total Interest': app.total_interest ? parseFloat(app.total_interest) : 0,
        'Total Repayable': app.total_repayable ? parseFloat(app.total_repayable) : 0,
        'Monthly Income Range': app.income_range || '',
        'Employment Type': app.employment_type || '',
        'Company Name': app.company_name || '',
        'Designation': app.designation || '',
        'Work Experience (Years)': app.work_experience_years || 0,
        'Address Line 1': app.address_line1 || '',
        'Address Line 2': app.address_line2 || '',
        'City': app.city || '',
        'State': app.state || '',
        'Pincode': app.pincode || '',
        'Plan Code': app.plan_code || '',
        'Plan Name': app.plan_name || '',
        'KYC Completed': app.kyc_completed ? 'Yes' : 'No',
        'User Status': app.userStatus || '',
        'Extension Status': app.extension_status || 'none',
        'Extension Count': app.extension_count || 0,
        'Rejection Reason': app.rejectionReason || '',
        'Updated At': app.updatedAt ? formatDateLocal(app.updatedAt) : ''
      };
    });

    // Convert to CSV (Excel-compatible)
    if (exportData.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'No applications found to export'
      });
    }

    const headers = Object.keys(exportData[0]);
    const csvRows = exportData.map(row => 
      headers.map(header => {
        const value = row[header];
        // Escape quotes and wrap in quotes if contains comma, newline, or quote
        if (value === null || value === undefined) return '""';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      })
    );

    const csvContent = [
      headers.join(','),
      ...csvRows.map(row => row.join(','))
    ].join('\n');

    // Add BOM for Excel UTF-8 support
    const BOM = '\uFEFF';
    const excelContent = BOM + csvContent;

    // Generate filename with status
    const statusLabel = status === 'all' ? 'All' : status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const filename = `loan_applications_${statusLabel}_${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(excelContent);

  } catch (error) {
    console.error('Export applications error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to export applications'
    });
  }
});

module.exports = router;
