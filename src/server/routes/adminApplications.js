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

/**
 * Format date as DDMMYYYY for CSV export so leading zeros are preserved (e.g. 01111998)
 */
function formatDateDDMMYYYY(date) {
  if (!date) return '';
  const d = typeof date === 'string' || !(date instanceof Date) ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}${month}${year}`;
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

    // Enforce status by role: sub-admins and NBFC only see allowed statuses (backend permission)
    const subCategory = req.admin?.sub_admin_category;
    let effectiveStatus = status;
    if (req.admin?.role === 'nbfc_admin') {
      const nbfcAllowed = ['overdue', 'ready_for_disbursement', 'ready_to_repeat_disbursal'];
      effectiveStatus = (status && nbfcAllowed.includes(status)) ? status : 'ready_for_disbursement';
    } else if (req.admin?.role === 'sub_admin' && subCategory) {
      const allowedByCategory = {
        verify_user: ['submitted', 'under_review', 'follow_up', 'disbursal', 'ready_for_disbursement'],
        qa_user: ['disbursal', 'ready_for_disbursement'],
        account_manager: ['account_manager'],
        recovery_officer: ['overdue'],
        debt_agency: ['overdue'],
        follow_up_user: ['submitted', 'follow_up', 'disbursal']
      };
      const allowed = allowedByCategory[subCategory];
      if (allowed && (!status || status === 'all' || !allowed.includes(status))) {
        effectiveStatus = 'all';
      }
    }

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
        la.extension_count,
        la.assigned_verify_admin_id,
        la.temp_assigned_verify_admin_id,
        la.assigned_qa_admin_id,
        la.temp_assigned_qa_admin_id,
        la.assigned_account_manager_id,
        la.temp_assigned_account_manager_id,
        la.assigned_recovery_officer_id,
        la.temp_assigned_recovery_officer_id,
        la.assigned_follow_up_admin_id,
        la.temp_assigned_follow_up_admin_id,
        av.name as verify_user_name,
        avt.name as temp_verify_user_name,
        am.name as acc_manager_name,
        amt.name as temp_acc_manager_name,
        ar.name as recovery_officer_name,
        art.name as temp_recovery_officer_name,
        af.name as follow_up_user_name,
        aft.name as temp_follow_up_user_name
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
      LEFT JOIN admins av ON la.assigned_verify_admin_id COLLATE utf8mb4_unicode_ci = av.id
      LEFT JOIN admins avt ON la.temp_assigned_verify_admin_id COLLATE utf8mb4_unicode_ci = avt.id
      LEFT JOIN admins am ON la.assigned_account_manager_id COLLATE utf8mb4_unicode_ci = am.id
      LEFT JOIN admins amt ON la.temp_assigned_account_manager_id COLLATE utf8mb4_unicode_ci = amt.id
      LEFT JOIN admins ar ON la.assigned_recovery_officer_id COLLATE utf8mb4_unicode_ci = ar.id
      LEFT JOIN admins art ON la.temp_assigned_recovery_officer_id COLLATE utf8mb4_unicode_ci = art.id
      LEFT JOIN admins af ON la.assigned_follow_up_admin_id COLLATE utf8mb4_unicode_ci = af.id
      LEFT JOIN admins aft ON la.temp_assigned_follow_up_admin_id COLLATE utf8mb4_unicode_ci = aft.id
    `;

    let whereConditions = [];
    let queryParams = [];

    // Exclude users moved to TVR from all status tabs (Submitted, Under Review, etc.)
    whereConditions.push('(COALESCE(u.moved_to_tvr, 0) = 0)');

    // Status filter (use effectiveStatus so sub_admin/nbfc_admin cannot see disallowed statuses)
    if (effectiveStatus && effectiveStatus !== 'all') {
      whereConditions.push('la.status = ?');
      queryParams.push(effectiveStatus);
      
      // Special handling for cleared status: only show cleared loans where user has no current active loan
      if (effectiveStatus === 'cleared') {
        whereConditions.push(`NOT EXISTS (
          SELECT 1 
          FROM loan_applications la2 
          WHERE la2.user_id = la.user_id 
            AND la2.id != la.id
            AND la2.status NOT IN ('cleared', 'rejected', 'cancelled')
        )`);
      }
    }

    // Search filter (name, phone, email, application_number, and loan ID e.g. PLL267 or 267)
    if (search) {
      const searchTerm = `%${search}%`;
      const trimmed = String(search).trim();
      const pllMatch = trimmed.match(/^pll(\d+)$/i);
      const loanIdBySearch = pllMatch ? parseInt(pllMatch[1], 10) : (/^\d+$/.test(trimmed) ? parseInt(trimmed, 10) : null);
      if (loanIdBySearch != null) {
        whereConditions.push(`(
          u.first_name LIKE ? OR
          u.last_name LIKE ? OR
          u.phone LIKE ? OR
          u.email LIKE ? OR
          la.application_number LIKE ? OR
          la.id = ?
        )`);
        queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, loanIdBySearch);
      } else {
        whereConditions.push(`(
          u.first_name LIKE ? OR
          u.last_name LIKE ? OR
          u.phone LIKE ? OR
          u.email LIKE ? OR
          la.application_number LIKE ?
        )`);
        queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
      }
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

    // Sub-admin: restrict to assigned applications and allowed statuses
    if (req.admin?.role === 'sub_admin' && subCategory) {
      const adminId = req.admin.id;
      if (subCategory === 'verify_user') {
        whereConditions.push('(la.assigned_verify_admin_id = ? OR la.temp_assigned_verify_admin_id = ?)');
        queryParams.push(adminId, adminId);
        if (!effectiveStatus || effectiveStatus === 'all') {
          whereConditions.push("la.status IN ('submitted','under_review','follow_up','disbursal','ready_for_disbursement')");
        }
      } else if (subCategory === 'qa_user') {
        whereConditions.push('(la.assigned_qa_admin_id = ? OR la.temp_assigned_qa_admin_id = ?)');
        queryParams.push(adminId, adminId);
        whereConditions.push("la.status IN ('disbursal','ready_for_disbursement')");
      } else if (subCategory === 'account_manager') {
        whereConditions.push('(la.assigned_account_manager_id = ? OR la.temp_assigned_account_manager_id = ?)');
        queryParams.push(adminId, adminId);
        whereConditions.push("la.status IN ('account_manager')");
      } else if (subCategory === 'recovery_officer') {
        whereConditions.push('(la.assigned_recovery_officer_id = ? OR la.temp_assigned_recovery_officer_id = ?)');
        queryParams.push(adminId, adminId);
        whereConditions.push("la.status = 'overdue'");
      } else if (subCategory === 'follow_up_user') {
        // For disbursal tab: show all disbursal loans (not assigned, as QA/verify move them)
        if (effectiveStatus !== 'disbursal') {
          whereConditions.push('(la.assigned_follow_up_admin_id = ? OR la.temp_assigned_follow_up_admin_id = ?)');
          queryParams.push(adminId, adminId);
        }
        if (!effectiveStatus || effectiveStatus === 'all') {
          whereConditions.push("la.status IN ('submitted','under_review','follow_up','disbursal')");
        }
      } else if (subCategory === 'debt_agency') {
        whereConditions.push("la.status = 'overdue'");
      }
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

    // For sub-admin: determine assignment type (primary = my assign, temp = temp assign)
    const adminId = req.admin?.id;
    const subCat = req.admin?.sub_admin_category;
    const assignedCol = subCat === 'verify_user' ? 'assigned_verify_admin_id' : subCat === 'qa_user' ? 'assigned_qa_admin_id' : subCat === 'account_manager' ? 'assigned_account_manager_id' : subCat === 'recovery_officer' ? 'assigned_recovery_officer_id' : subCat === 'follow_up_user' ? 'assigned_follow_up_admin_id' : null;
    const tempCol = subCat === 'verify_user' ? 'temp_assigned_verify_admin_id' : subCat === 'qa_user' ? 'temp_assigned_qa_admin_id' : subCat === 'account_manager' ? 'temp_assigned_account_manager_id' : subCat === 'recovery_officer' ? 'temp_assigned_recovery_officer_id' : subCat === 'follow_up_user' ? 'temp_assigned_follow_up_admin_id' : null;

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
      
      // Loan ID: PLL + loan_application.id (unique)
      const shortLoanId = `PLL${app.id}`;

      let assignmentType = null;
      if (req.admin?.role === 'sub_admin' && adminId && assignedCol && tempCol) {
        if (app[assignedCol] === adminId) assignmentType = 'primary';
        else if (app[tempCol] === adminId) assignmentType = 'temp';
      }

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
        assignedManager: (() => {
          const name = app.temp_acc_manager_name || app.acc_manager_name;
          return name || 'N/A';
        })(),
        recoveryOfficer: (() => {
          const name = app.temp_recovery_officer_name || app.recovery_officer_name;
          return name || 'N/A';
        })(),
        subAdminAssignments: (() => {
          const verifyName = (app.temp_verify_user_name || app.verify_user_name) || 'N/A';
          const accManagerName = (app.temp_acc_manager_name || app.acc_manager_name) || 'N/A';
          const recoveryName = (app.temp_recovery_officer_name || app.recovery_officer_name) || 'N/A';
          const followUpName = (app.temp_follow_up_user_name || app.follow_up_user_name) || 'N/A';
          const isOverdue = app.status === 'overdue';
          return { verifyUserName: verifyName, accManagerName, recoveryOfficerName: recoveryName, followUpUserName: followUpName, isOverdue };
        })(),
        assignmentType: assignmentType,
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

// Get TVR IDs (users moved to TVR) — must be before /:applicationId to avoid being swallowed
router.get('/tvr-ids', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();

    const {
      page = 1,
      limit = 50,
      search = ''
    } = req.query;

    const numLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 500);
    const numPage = Math.max(parseInt(page, 10) || 1, 1);
    const offset = (numPage - 1) * numLimit;

    let whereConditions = ['u.moved_to_tvr = 1'];
    let queryParams = [];

    if (search) {
      whereConditions.push(`(
        u.phone LIKE ? OR 
        u.email LIKE ? OR 
        CONCAT(u.first_name, ' ', u.last_name) LIKE ? OR
        u.pan_number LIKE ?
      )`);
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    // Count total for pagination (same WHERE, no LIMIT)
    const countQuery = `
      SELECT COUNT(*) as total
      FROM users u
      WHERE ${whereConditions.join(' AND ')}
    `;
    const countResult = await executeQuery(countQuery, queryParams);
    const total = countResult[0] ? Number(countResult[0].total) : 0;

    // LIMIT/OFFSET inlined (validated integers) — some MySQL setups reject them as bound params
    const dataQuery = `
      SELECT
        u.id as userId,
        u.phone as mobile,
        u.email,
        CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as userName,
        u.pan_number as panNumber,
        u.moved_to_tvr_at as movedToTvrAt,
        u.moved_to_tvr_by as movedToTvrBy,
        a.name as movedByAdminName,
        la.id as latestLoanId,
        la.application_number as latestApplicationNumber,
        la.status as latestLoanStatus,
        la.loan_amount as latestLoanAmount,
        DATE_FORMAT(la.created_at, '%Y-%m-%d') as latestLoanDate
      FROM users u
      LEFT JOIN admins a ON u.moved_to_tvr_by COLLATE utf8mb4_unicode_ci = a.id
      LEFT JOIN loan_applications la ON u.id = la.user_id 
        AND la.id = (
          SELECT MAX(id) 
          FROM loan_applications 
          WHERE user_id = u.id
        )
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY u.moved_to_tvr_at DESC
      LIMIT ${numLimit} OFFSET ${offset}
    `;

    const tvrUsers = await executeQuery(dataQuery, queryParams);

    res.json({
      status: 'success',
      data: {
        users: tvrUsers || [],
        pagination: {
          page: numPage,
          limit: numLimit,
          total,
          totalPages: Math.ceil(total / numLimit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching TVR IDs:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch TVR IDs'
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
            
            if (planSnapshot.emi_frequency === 'monthly' && planSnapshot.calculate_by_salary_date && userSalaryDate) {
              // Salary-based monthly EMIs
              const salaryDate = parseInt(userSalaryDate);
              if (salaryDate >= 1 && salaryDate <= 31) {
                let nextSalaryDate = getNextSalaryDate(baseDate, salaryDate);
                
                // Check if duration is less than minimum days (must be at least this many days till first EMI)
                // For EMI loans, enforce minimum 30 days regardless of plan setting
                const minDuration = Math.max(planSnapshot.repayment_days || 0, 30);
                const daysToNextSalary = Math.ceil((nextSalaryDate - baseDate) / (1000 * 60 * 60 * 24)) + 1;
                
                if (daysToNextSalary < minDuration) {
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
              }
            }
            
            // If salary-based calculation didn't generate dates, use non-salary method with min duration check
            if (allEmiDates.length === 0 && emiCount > 1) {
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
              } else {
                // Fixed days calculation
                const repaymentDays = planSnapshot.repayment_days || planSnapshot.total_duration_days || 15;
                const dueDate = new Date(baseDate);
                dueDate.setDate(dueDate.getDate() + repaymentDays);
                dueDate.setHours(0, 0, 0, 0);
                processedDueDate = formatDateToString(dueDate);
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
        
      } else {
      }
    }

    updateQuery += ' WHERE id = ?';
    updateParams.push(applicationId);

    await executeQuery(updateQuery, updateParams);

    // Assign account manager when status changes to account_manager (by PCID)
    if (status === 'account_manager') {
      try {
        const { assignAccountManagerForLoan } = require('../services/adminAssignmentService');
        await assignAccountManagerForLoan(applicationId, loan.user_id);
      } catch (err) {
        console.error('Assign account manager for loan failed:', err);
      }
    }

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
            const shortLoanId = `PLL${applicationId}`;
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

    // Recalculate all calculated fields when loan_amount changes
    const { getLoanCalculation } = require('../utils/loanCalculations');
    let updateFields = ['loan_amount = ?'];
    let updateValues = [parseFloat(amount)];
    
    try {
      // Temporarily update loan_amount to get correct calculation
      await executeQuery(
        'UPDATE loan_applications SET loan_amount = ? WHERE id = ?',
        [parseFloat(amount), applicationId]
      );
      
      // Get recalculated values
      const calculation = await getLoanCalculation(parseInt(applicationId));
      
      if (calculation) {
        // Get disbursal amount (getLoanCalculation uses calculateLoanValues which returns disbAmount)
        const disbursalAmount = calculation.disbAmount || calculation.disbursal?.amount || calculation.disbursalAmount || parseFloat(amount);
        
        // Get processing fee (sum of disbursal fees + GST)
        const processingFee = ((calculation.totals?.disbursalFee || 0) + (calculation.totals?.disbursalFeeGST || 0)) || calculation.processingFee || 0;
        
        // Get total interest
        const totalInterest = calculation.interest?.amount || calculation.interest || 0;
        
        // Get total repayable
        const totalRepayable = calculation.total?.repayable || calculation.totalRepayable || parseFloat(amount);
        
        // Update all calculated fields
        updateFields.push('disbursal_amount = ?');
        updateFields.push('processing_fee = ?');
        updateFields.push('total_interest = ?');
        updateFields.push('total_repayable = ?');
        
        updateValues.push(disbursalAmount);
        updateValues.push(processingFee);
        updateValues.push(totalInterest);
        updateValues.push(totalRepayable);
        
        // Update fees_breakdown if available
        if (calculation.fees) {
          const allFees = [
            ...(calculation.fees.deductFromDisbursal || []),
            ...(calculation.fees.addToTotal || [])
          ];
          if (allFees.length > 0) {
            const feesBreakdown = allFees.map(fee => ({
              fee_name: fee.fee_name,
              fee_amount: fee.fee_amount,
              gst_amount: fee.gst_amount,
              fee_percent: fee.fee_percent,
              total_with_gst: fee.total_with_gst,
              application_method: fee.application_method || 'deduct_from_disbursal'
            }));
            updateFields.push('fees_breakdown = ?');
            updateValues.push(JSON.stringify(feesBreakdown));
          }
        }
      }
    } catch (calcError) {
      console.error(`Failed to recalculate fields for loan ${applicationId}:`, calcError);
      // Continue with just loan_amount update
    }

    // Update all fields
    updateValues.push(applicationId);
    await executeQuery(
      `UPDATE loan_applications SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      updateValues
    );

    res.json({
      status: 'success',
      message: 'Loan amount updated successfully',
      data: { 
        applicationId, 
        loan_amount: parseFloat(amount),
        disbursal_amount: disbursalAmount
      }
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

// Get application statistics (for sub_admins: only assigned-to-me counts; for nbfc_admin: only allowed statuses)
router.get('/stats/overview', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();

    const role = req.admin?.role;
    const isSubAdmin = role === 'sub_admin';
    const isNbfcAdmin = role === 'nbfc_admin';
    const subCat = req.admin?.sub_admin_category;
    const adminId = req.admin?.id;

    const nbfcAllowedStatuses = ['overdue', 'ready_for_disbursement', 'ready_to_repeat_disbursal'];
    const subAdminAllowedByCategory = {
      verify_user: ['submitted', 'under_review', 'follow_up', 'disbursal', 'ready_for_disbursement'],
      qa_user: ['disbursal', 'ready_for_disbursement'],
      account_manager: ['account_manager'],
      recovery_officer: ['overdue'],
      follow_up_user: ['submitted', 'under_review', 'follow_up', 'disbursal'],
      debt_agency: ['overdue']
    };

    let total = 0;
    let statusCounts = {};
    let typeCounts = {};
    let amountResult = [{ totalAmount: 0, averageAmount: 0 }];

    if (isNbfcAdmin) {
      // NBFC: only counts for allowed statuses (no assignment filter), exclude TVR users
      const statusResult = await executeQuery(
        `SELECT la.status, COUNT(*) as count FROM loan_applications la
         INNER JOIN users u ON la.user_id = u.id
         WHERE la.status IN (?, ?, ?) AND (COALESCE(u.moved_to_tvr, 0) = 0)
         GROUP BY la.status`,
        ['overdue', 'ready_for_disbursement', 'ready_to_repeat_disbursal']
      );
      statusResult.forEach(row => {
        statusCounts[row.status] = row.count;
        total += Number(row.count);
      });
      const amountRows = await executeQuery(
        `SELECT SUM(la.loan_amount) as totalAmount, AVG(la.loan_amount) as averageAmount
         FROM loan_applications la INNER JOIN users u ON la.user_id = u.id
         WHERE la.status IN (?, ?, ?) AND (COALESCE(u.moved_to_tvr, 0) = 0)`,
        ['overdue', 'ready_for_disbursement', 'ready_to_repeat_disbursal']
      );
      amountResult = amountRows.length ? amountRows : [{ totalAmount: 0, averageAmount: 0 }];
    } else if (isSubAdmin && subCat && adminId) {
      // Sub-admin: return only assigned counts for allowed statuses (or for debt_agency, total overdue), exclude TVR users
      if (subCat === 'debt_agency') {
        const overdueResult = await executeQuery(
          `SELECT COUNT(*) as total FROM loan_applications la INNER JOIN users u ON la.user_id = u.id WHERE la.status = 'overdue' AND (COALESCE(u.moved_to_tvr, 0) = 0)`
        );
        total = overdueResult[0]?.total || 0;
        statusCounts = { overdue: total };
      } else {
        const assignedCol = subCat === 'verify_user' ? 'assigned_verify_admin_id' : subCat === 'qa_user' ? 'assigned_qa_admin_id' : subCat === 'account_manager' ? 'assigned_account_manager_id' : subCat === 'recovery_officer' ? 'assigned_recovery_officer_id' : subCat === 'follow_up_user' ? 'assigned_follow_up_admin_id' : null;
        const tempCol = subCat === 'verify_user' ? 'temp_assigned_verify_admin_id' : subCat === 'qa_user' ? 'temp_assigned_qa_admin_id' : subCat === 'account_manager' ? 'temp_assigned_account_manager_id' : subCat === 'recovery_officer' ? 'temp_assigned_recovery_officer_id' : subCat === 'follow_up_user' ? 'temp_assigned_follow_up_admin_id' : null;
        const allowed = subAdminAllowedByCategory[subCat];
        if (assignedCol && tempCol && Array.isArray(allowed)) {
          // Follow-up user: disbursal loans are not assigned; get submitted/follow_up only with assignment, then add all disbursal
          const statusesForAssignment = subCat === 'follow_up_user' ? allowed.filter(s => s !== 'disbursal') : allowed;
          const placeholders = statusesForAssignment.map(() => '?').join(',');
          const statusResult = statusesForAssignment.length > 0 ? await executeQuery(
            `SELECT la.status, COUNT(*) as count FROM loan_applications la
             INNER JOIN users u ON la.user_id = u.id
             WHERE (la.${assignedCol} = ? OR la.${tempCol} = ?) AND la.status IN (${placeholders}) AND (COALESCE(u.moved_to_tvr, 0) = 0)
             GROUP BY la.status`,
            [adminId, adminId, ...statusesForAssignment]
          ) : [];
          statusResult.forEach(row => {
            statusCounts[row.status] = row.count;
            total += Number(row.count);
          });
          if (subCat === 'follow_up_user' && allowed.includes('disbursal')) {
            const [disbRows] = await executeQuery(
              `SELECT COUNT(*) as c FROM loan_applications la
               INNER JOIN users u ON la.user_id = u.id
               WHERE la.status = 'disbursal' AND (COALESCE(u.moved_to_tvr, 0) = 0)`,
              []
            );
            statusCounts['disbursal'] = disbRows?.[0]?.c || 0;
            total += Number(statusCounts['disbursal']);
          }
        }
      }
    } else {
      // Full admin: global counts, exclude TVR users
      const totalResult = await executeQuery(
        `SELECT COUNT(*) as total FROM loan_applications la INNER JOIN users u ON la.user_id = u.id WHERE (COALESCE(u.moved_to_tvr, 0) = 0)`
      );
      total = totalResult[0].total;

      const statusResult = await executeQuery(`
        SELECT la.status, COUNT(*) as count
        FROM loan_applications la
        INNER JOIN users u ON la.user_id = u.id
        WHERE (COALESCE(u.moved_to_tvr, 0) = 0)
        GROUP BY la.status
      `);
      statusResult.forEach(row => {
        statusCounts[row.status] = row.count;
      });

      const typeResult = await executeQuery(`
        SELECT la.loan_purpose, COUNT(*) as count
        FROM loan_applications la
        INNER JOIN users u ON la.user_id = u.id
        WHERE (COALESCE(u.moved_to_tvr, 0) = 0)
        GROUP BY la.loan_purpose
      `);
      typeResult.forEach(row => {
        typeCounts[row.loan_purpose] = row.count;
      });

      amountResult = await executeQuery(`
        SELECT SUM(la.loan_amount) as totalAmount, AVG(la.loan_amount) as averageAmount
        FROM loan_applications la
        INNER JOIN users u ON la.user_id = u.id
        WHERE (COALESCE(u.moved_to_tvr, 0) = 0)
      `);
    }

    const stats = {
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
      newApplications: statusCounts['submitted'] || 0,
      total: total,
      applied: statusCounts['applied'] || 0,
      underReview: statusCounts['under_review'] || 0,
      approved: statusCounts['follow_up'] || 0,
      rejected: statusCounts['rejected'] || 0,
      pendingDocuments: statusCounts['pending_documents'] || 0,
      personalLoans: typeCounts['Personal'] || 0,
      businessLoans: typeCounts['Business'] || 0,
      totalAmount: parseFloat(amountResult[0]?.totalAmount) || 0,
      averageAmount: parseFloat(amountResult[0]?.averageAmount) || 0
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

    // Enforce status by role (same as list endpoint)
    const exportSubCategory = req.admin?.sub_admin_category;
    let effectiveStatus = status;
    if (req.admin?.role === 'nbfc_admin') {
      const nbfcAllowed = ['overdue', 'ready_for_disbursement', 'ready_to_repeat_disbursal'];
      effectiveStatus = (status && nbfcAllowed.includes(status)) ? status : 'ready_for_disbursement';
    } else     if (req.admin?.role === 'sub_admin' && exportSubCategory) {
      const allowedByCategory = {
        verify_user: ['submitted', 'under_review', 'follow_up', 'disbursal', 'ready_for_disbursement'],
        qa_user: ['disbursal', 'ready_for_disbursement'],
        account_manager: ['account_manager'],
        recovery_officer: ['overdue'],
        debt_agency: ['overdue'],
        follow_up_user: ['submitted', 'follow_up', 'disbursal']
      };
      const allowed = allowedByCategory[exportSubCategory];
      if (allowed && (!status || status === 'all' || !allowed.includes(status))) {
        effectiveStatus = 'all';
      }
    }

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

    // Exclude users moved to TVR from export
    whereConditions.push('(COALESCE(u.moved_to_tvr, 0) = 0)');

    // Status filter (use effectiveStatus for permission enforcement)
    if (effectiveStatus && effectiveStatus !== 'all') {
      whereConditions.push('la.status = ?');
      queryParams.push(effectiveStatus);
      
      if (effectiveStatus === 'cleared') {
        whereConditions.push(`NOT EXISTS (
          SELECT 1 
          FROM loan_applications la2 
          WHERE la2.user_id = la.user_id 
            AND la2.id != la.id
            AND la2.status NOT IN ('cleared', 'rejected', 'cancelled')
        )`);
      }
    }

    // Search filter (name, phone, email, application_number, and loan ID e.g. PLL267 or 267)
    if (search) {
      const searchTerm = `%${search}%`;
      const trimmed = String(search).trim();
      const pllMatch = trimmed.match(/^pll(\d+)$/i);
      const loanIdBySearch = pllMatch ? parseInt(pllMatch[1], 10) : (/^\d+$/.test(trimmed) ? parseInt(trimmed, 10) : null);
      if (loanIdBySearch != null) {
        whereConditions.push(`(
          u.first_name LIKE ? OR
          u.last_name LIKE ? OR
          u.phone LIKE ? OR
          u.email LIKE ? OR
          la.application_number LIKE ? OR
          la.id = ?
        )`);
        queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, loanIdBySearch);
      } else {
        whereConditions.push(`(
          u.first_name LIKE ? OR
          u.last_name LIKE ? OR
          u.phone LIKE ? OR
          u.email LIKE ? OR
          la.application_number LIKE ?
        )`);
        queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
      }
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

    // Sub-admin: restrict to assigned applications and allowed statuses (same as list endpoint)
    if (req.admin?.role === 'sub_admin' && exportSubCategory) {
      const adminId = req.admin.id;
      if (exportSubCategory === 'verify_user') {
        whereConditions.push('(la.assigned_verify_admin_id = ? OR la.temp_assigned_verify_admin_id = ?)');
        queryParams.push(adminId, adminId);
        if (!effectiveStatus || effectiveStatus === 'all') {
          whereConditions.push("la.status IN ('submitted','under_review','follow_up','disbursal','ready_for_disbursement')");
        }
      } else if (exportSubCategory === 'qa_user') {
        whereConditions.push('(la.assigned_qa_admin_id = ? OR la.temp_assigned_qa_admin_id = ?)');
        queryParams.push(adminId, adminId);
        whereConditions.push("la.status IN ('disbursal','ready_for_disbursement')");
      } else if (exportSubCategory === 'account_manager') {
        whereConditions.push('(la.assigned_account_manager_id = ? OR la.temp_assigned_account_manager_id = ?)');
        queryParams.push(adminId, adminId);
        whereConditions.push("la.status IN ('account_manager')");
      } else if (exportSubCategory === 'recovery_officer') {
        whereConditions.push('(la.assigned_recovery_officer_id = ? OR la.temp_assigned_recovery_officer_id = ?)');
        queryParams.push(adminId, adminId);
        whereConditions.push("la.status = 'overdue'");
      } else if (exportSubCategory === 'follow_up_user') {
        if (effectiveStatus !== 'disbursal') {
          whereConditions.push('(la.assigned_follow_up_admin_id = ? OR la.temp_assigned_follow_up_admin_id = ?)');
          queryParams.push(adminId, adminId);
        }
        if (!effectiveStatus || effectiveStatus === 'all') {
          whereConditions.push("la.status IN ('submitted','under_review','follow_up','disbursal')");
        }
      } else if (exportSubCategory === 'debt_agency') {
        whereConditions.push("la.status = 'overdue'");
      }
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
      const shortLoanId = `PLL${app.id}`;

      return {
        'Application ID': shortLoanId,
        'Applicant Name': applicantName,
        'Mobile': app.mobile || '',
        'Email': app.email || '',
        'PAN Number': app.pan_number || '',
        'Date of Birth': app.date_of_birth ? formatDateDDMMYYYY(app.date_of_birth) : '',
        'Gender': app.gender || '',
        'Marital Status': app.marital_status || '',
        'Loan Amount': parseFloat(app.loanAmount) || 0,
        'Loan Type': app.loanType || '',
        'Tenure (Months)': app.tenure || 0,
        'Interest Rate (% per day)': app.interest_percent_per_day ? parseFloat(app.interest_percent_per_day) : 0,
        'EMI Amount': app.emiAmount ? parseFloat(app.emiAmount) : 0,
        'Status': app.status || '',
        'Application Date': app.applicationDate ? formatDateDDMMYYYY(app.applicationDate) : '',
        'Approved Date': app.approvedDate ? formatDateDDMMYYYY(app.approvedDate) : '',
        'Disbursed Date': app.disbursedDate ? formatDateDDMMYYYY(app.disbursedDate) : '',
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
        'Updated At': app.updatedAt ? formatDateDDMMYYYY(app.updatedAt) : ''
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
    const dateHeaders = new Set(['Date of Birth', 'Application Date', 'Approved Date', 'Disbursed Date', 'Updated At']);
    const csvRows = exportData.map(row =>
      headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return '""';
        let stringValue = String(value);
        const isDateColumn = dateHeaders.has(header);
        if (isDateColumn && stringValue.length > 0) {
          stringValue = '\t' + stringValue;
        }
        if (isDateColumn || stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
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

// Export IDFC Bank Excel (.xlsx) for disbursement
router.get('/export/idfc-bank-csv', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    
    const { status } = req.query;
    
    // Only allow ready_for_disbursement and ready_to_repeat_disbursal
    if (status !== 'ready_for_disbursement' && status !== 'ready_to_repeat_disbursal') {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid status. Only ready_for_disbursement and ready_to_repeat_disbursal are allowed.'
      });
    }

    // Enforce status by role
    const exportSubCategory = req.admin?.sub_admin_category;
    let effectiveStatus = status;
    if (req.admin?.role === 'nbfc_admin') {
      const nbfcAllowed = ['ready_for_disbursement', 'ready_to_repeat_disbursal'];
      if (!nbfcAllowed.includes(status)) {
        effectiveStatus = 'ready_for_disbursement';
      }
    } else if (req.admin?.role === 'sub_admin' && exportSubCategory) {
      const allowedByCategory = {
        verify_user: ['ready_for_disbursement'],
        qa_user: ['ready_for_disbursement'],
        account_manager: ['ready_to_repeat_disbursal']
      };
      const allowed = allowedByCategory[exportSubCategory];
      if (allowed && !allowed.includes(status)) {
        return res.status(403).json({
          status: 'error',
          message: 'You do not have permission to export this status'
        });
      }
    }

    // Get loans with the specified status
    const loansQuery = `
      SELECT DISTINCT
        la.id,
        la.application_number as applicationNumber,
        la.user_id as userId,
        la.loan_amount as loanAmount,
        la.status,
        u.first_name,
        u.last_name,
        u.email,
        u.personal_email,
        u.official_email,
        ub.id as bank_id,
        ub.account_number,
        ub.ifsc_code,
        ub.bank_name,
        ub.account_holder_name
      FROM loan_applications la
      INNER JOIN users u ON la.user_id = u.id
      LEFT JOIN bank_details ub ON u.id = ub.user_id AND ub.is_primary = 1
      WHERE la.status = ? AND (COALESCE(u.moved_to_tvr, 0) = 0)
      ORDER BY la.id ASC
    `;

    const loans = await executeQuery(loansQuery, [effectiveStatus]);

    if (!loans || loans.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'No loans found for export'
      });
    }

    // Use full calculation (plan fees + GST) so disbursal amount matches UI (e.g. PLL306: 6010.56 not 7200)
    const { getFullLoanCalculation, getLoanCalculation } = require('../utils/loanCalculations');
    const XLSX = require('xlsx');

    const DEBIT_ACCOUNT_NUMBER = '10050210822';
    const today = new Date();
    const transactionDate = today.toLocaleDateString('en-GB'); // DD/MM/YYYY

    // Excel headers
    const headers = [
      'Beneficiary Name',
      'Beneficiary Account Number',
      'IFSC',
      'Transaction Type',
      'Debit Account Number',
      'Transaction Date',
      'Amount',
      'Currency',
      'Beneficiary Email ID',
      'Remarks',
      'Custom Header – 1',
      'Custom Header – 2',
      'Custom Header – 3',
      'Custom Header – 4',
      'Custom Header – 5'
    ];

    const rows = [];

    // Process each loan
    for (const loan of loans) {
      // Skip loans without bank details
      if (!loan.account_number || !loan.ifsc_code) {
        console.warn(`Skipping loan ${loan.id} - missing bank details`);
        continue;
      }

      // Get disbursal amount from full calculation (plan fees + GST) so it matches UI
      let disbursalAmount = loan.loanAmount;
      try {
        const fullCalc = await getFullLoanCalculation(loan.id);
        if (fullCalc && fullCalc.disbursal?.amount != null) {
          disbursalAmount = fullCalc.disbursal.amount;
        } else {
          const calculation = await getLoanCalculation(loan.id);
          if (calculation?.disbAmount != null) disbursalAmount = calculation.disbAmount;
          else if (calculation?.disbursal?.amount != null) disbursalAmount = calculation.disbursal.amount;
          else if (calculation?.disbursalAmount != null) disbursalAmount = calculation.disbursalAmount;
        }
      } catch (error) {
        console.error(`Failed to get loan calculation for loan ${loan.id} (PLL${loan.id}):`, error);
      }

      // Get bank details
      const beneficiaryName = loan.account_holder_name || 
                            `${loan.first_name || ''} ${loan.last_name || ''}`.trim() || 
                            'N/A';
      const beneficiaryAccountNumber = loan.account_number || '';
      const ifsc = loan.ifsc_code || '';
      const bankName = loan.bank_name || '';
      const transactionType = bankName.toUpperCase().includes('IDFC') ? 'IFT' : 'NEFT';
      // Use priority: personal_email > official_email > email (same as other parts of the system)
      const email = loan.personal_email || loan.official_email || loan.email || '';
      const remarks = `PLL${loan.id}`;

      // Build Excel row
      rows.push([
        beneficiaryName,
        beneficiaryAccountNumber,
        ifsc,
        transactionType,
        DEBIT_ACCOUNT_NUMBER,
        transactionDate, // Excel will preserve date format
        typeof disbursalAmount === 'number' ? disbursalAmount : parseFloat(disbursalAmount) || 0,
        'INR',
        email,
        remarks,
        '', // Custom Header – 1
        '', // Custom Header – 2
        '', // Custom Header – 3
        '', // Custom Header – 4
        ''  // Custom Header – 5
      ]);
    }

    // Check if we have any valid rows
    if (rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'No loans with valid bank details found for export'
      });
    }

    // Create workbook and worksheet
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    
    // Set column widths for better readability
    const columnWidths = [
      { wch: 25 }, // Beneficiary Name
      { wch: 20 }, // Beneficiary Account Number
      { wch: 12 }, // IFSC
      { wch: 15 }, // Transaction Type
      { wch: 18 }, // Debit Account Number
      { wch: 15 }, // Transaction Date
      { wch: 12 }, // Amount
      { wch: 10 }, // Currency
      { wch: 30 }, // Beneficiary Email ID
      { wch: 12 }, // Remarks
      { wch: 15 }, // Custom Header – 1
      { wch: 15 }, // Custom Header – 2
      { wch: 15 }, // Custom Header – 3
      { wch: 15 }, // Custom Header – 4
      { wch: 15 }  // Custom Header – 5
    ];
    worksheet['!cols'] = columnWidths;

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'IDFC Payout');

    // Generate Excel file buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const statusLabel = effectiveStatus === 'ready_for_disbursement' 
      ? 'ready_for_disbursement' 
      : 'ready_to_repeat_disbursal';
    const filename = `idfc_payout_${statusLabel}_${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(excelBuffer);

  } catch (error) {
    console.error('Export IDFC Bank Excel error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to export IDFC Bank Excel',
      error: error.message
    });
  }
});

// Fix/recalculate disbursal_amount for loans (admin utility endpoint)
router.post('/fix-disbursal-amounts', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { loanIds, status, recalculateAll } = req.body;

    // Only allow super_admin or admin roles
    if (req.admin?.role !== 'admin' && req.admin?.role !== 'super_admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Only admins can fix disbursal amounts'
      });
    }

    const { getLoanCalculation } = require('../utils/loanCalculations');
    let loansToFix = [];

    if (recalculateAll) {
      // Recalculate all loans that are not yet processed
      const query = `
        SELECT id, loan_amount, disbursal_amount, processing_fee, total_interest, total_repayable, status, processed_at
        FROM loan_applications
        WHERE processed_at IS NULL
        ORDER BY id ASC
      `;
      loansToFix = await executeQuery(query);
    } else if (loanIds && Array.isArray(loanIds) && loanIds.length > 0) {
      // Fix specific loan IDs
      const placeholders = loanIds.map(() => '?').join(',');
      const query = `
        SELECT id, loan_amount, disbursal_amount, processing_fee, total_interest, total_repayable, status, processed_at
        FROM loan_applications
        WHERE id IN (${placeholders})
      `;
      loansToFix = await executeQuery(query, loanIds);
    } else if (status) {
      // Fix loans with specific status
      const query = `
        SELECT id, loan_amount, disbursal_amount, processing_fee, total_interest, total_repayable, status, processed_at
        FROM loan_applications
        WHERE status = ? AND processed_at IS NULL
        ORDER BY id ASC
      `;
      loansToFix = await executeQuery(query, [status]);
    } else {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide loanIds array, status, or set recalculateAll=true'
      });
    }

    if (loansToFix.length === 0) {
      return res.json({
        status: 'success',
        message: 'No loans found to fix',
        data: { fixed: 0, failed: 0, skipped: 0 }
      });
    }

    const results = {
      fixed: 0,
      failed: 0,
      skipped: 0,
      details: []
    };

    for (const loan of loansToFix) {
      // Skip if already processed
      if (loan.processed_at) {
        results.skipped++;
        results.details.push({
          loanId: loan.id,
          status: 'skipped',
          reason: 'Loan already processed'
        });
        continue;
      }

      try {
        // Get recalculated values
        const calculation = await getLoanCalculation(loan.id);
        
        if (!calculation) {
          results.skipped++;
          results.details.push({
            loanId: loan.id,
            status: 'skipped',
            reason: 'Could not get calculation'
          });
          continue;
        }

        // Get all calculated values (getLoanCalculation uses calculateLoanValues which returns disbAmount)
        const newDisbursalAmount = calculation.disbAmount || calculation.disbursal?.amount || calculation.disbursalAmount || loan.loan_amount;
        const newProcessingFee = ((calculation.totals?.disbursalFee || 0) + (calculation.totals?.disbursalFeeGST || 0)) || calculation.processingFee || 0;
        const newTotalInterest = calculation.interest?.amount || calculation.interest || 0;
        const newTotalRepayable = calculation.total?.repayable || calculation.totalRepayable || loan.loan_amount;

        // Check if any values need updating
        const oldDisbursalAmount = parseFloat(loan.disbursal_amount) || loan.loan_amount;
        const oldProcessingFee = parseFloat(loan.processing_fee) || 0;
        const oldTotalInterest = parseFloat(loan.total_interest) || 0;
        const oldTotalRepayable = parseFloat(loan.total_repayable) || loan.loan_amount;

        const needsUpdate = 
          Math.abs(newDisbursalAmount - oldDisbursalAmount) > 0.01 ||
          Math.abs(newProcessingFee - oldProcessingFee) > 0.01 ||
          Math.abs(newTotalInterest - oldTotalInterest) > 0.01 ||
          Math.abs(newTotalRepayable - oldTotalRepayable) > 0.01;

        if (needsUpdate) {
          const updateFields = [];
          const updateValues = [];
          
          updateFields.push('disbursal_amount = ?');
          updateFields.push('processing_fee = ?');
          updateFields.push('total_interest = ?');
          updateFields.push('total_repayable = ?');
          
          updateValues.push(newDisbursalAmount);
          updateValues.push(newProcessingFee);
          updateValues.push(newTotalInterest);
          updateValues.push(newTotalRepayable);
          
          // Update fees_breakdown if available
          if (calculation.fees) {
            const allFees = [
              ...(calculation.fees.deductFromDisbursal || []),
              ...(calculation.fees.addToTotal || [])
            ];
            if (allFees.length > 0) {
              const feesBreakdown = allFees.map(fee => ({
                fee_name: fee.fee_name,
                fee_amount: fee.fee_amount,
                gst_amount: fee.gst_amount,
                fee_percent: fee.fee_percent,
                total_with_gst: fee.total_with_gst,
                application_method: fee.application_method || 'deduct_from_disbursal'
              }));
              updateFields.push('fees_breakdown = ?');
              updateValues.push(JSON.stringify(feesBreakdown));
            }
          }
          
          updateValues.push(loan.id);
          await executeQuery(
            `UPDATE loan_applications SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
            updateValues
          );
          
          results.fixed++;
          results.details.push({
            loanId: loan.id,
            status: 'fixed',
            oldValues: {
              disbursal_amount: oldDisbursalAmount,
              processing_fee: oldProcessingFee,
              total_interest: oldTotalInterest,
              total_repayable: oldTotalRepayable
            },
            newValues: {
              disbursal_amount: newDisbursalAmount,
              processing_fee: newProcessingFee,
              total_interest: newTotalInterest,
              total_repayable: newTotalRepayable
            }
          });
        } else {
          results.skipped++;
          results.details.push({
            loanId: loan.id,
            status: 'skipped',
            reason: 'All calculated fields already correct'
          });
        }
      } catch (error) {
        results.failed++;
        results.details.push({
          loanId: loan.id,
          status: 'failed',
          error: error.message
        });
        console.error(`Failed to fix disbursal_amount for loan ${loan.id}:`, error);
      }
    }

    res.json({
      status: 'success',
      message: `Fixed ${results.fixed} loans, ${results.failed} failed, ${results.skipped} skipped`,
      data: results
    });

  } catch (error) {
    console.error('Fix disbursal amounts error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fix disbursal amounts',
      error: error.message
    });
  }
});

module.exports = router;
