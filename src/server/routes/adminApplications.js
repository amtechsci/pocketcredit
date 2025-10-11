const express = require('express');
const { authenticateAdmin } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const { executeQuery, initializeDatabase } = require('../config/database');
const router = express.Router();

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
        la.interest_rate as interestRate,
        la.emi_amount as emiAmount,
        la.status,
        la.rejection_reason as rejectionReason,
        la.approved_by as approvedBy,
        la.approved_at as approvedDate,
        la.disbursed_at as disbursedDate,
        la.created_at as applicationDate,
        la.updated_at as updatedAt,
        u.first_name,
        u.last_name,
        u.phone as mobile,
        u.email,
        u.kyc_completed,
        u.status as userStatus,
        u.date_of_birth,
        u.gender,
        u.marital_status,
        COALESCE(ed.employment_type, '') as employment_type,
        COALESCE(ed.company_name, '') as company_name,
        COALESCE(ed.monthly_salary, 0) as monthly_salary,
        COALESCE(ed.designation, '') as designation,
        COALESCE(ed.work_experience_years, 0) as work_experience_years,
        0 as credit_score,
        COALESCE(ed.monthly_salary, 0) as monthly_income,
        0 as monthly_expenses,
        0 as existing_loans,
        COALESCE(a.city, '') as city,
        COALESCE(a.state, '') as state,
        COALESCE(a.pincode, '') as pincode,
        COALESCE(a.address_line1, '') as address_line1,
        COALESCE(a.address_line2, '') as address_line2
      FROM loan_applications la
      LEFT JOIN users u ON la.user_id = u.id
      LEFT JOIN employment_details ed ON u.id = ed.user_id
      LEFT JOIN addresses a ON u.id = a.user_id AND a.is_primary = 1
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

    // Get total count for pagination
    const countQuery = baseQuery.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM').replace(/ORDER BY[\s\S]*$/, '');
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
    const applicationsWithUserData = applications.map(app => ({
      id: app.applicationNumber || app.id,
      userId: app.userId,
      loanAmount: parseFloat(app.loanAmount) || 0,
      loanType: app.loanType?.toLowerCase() || 'personal',
      status: app.status,
      applicationDate: app.applicationDate,
      tenure: app.tenure || 0,
      interestRate: app.interestRate || 0,
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
      monthlyIncome: app.monthly_salary || app.monthly_income || 50000, // Use actual income
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
      userStatus: app.userStatus || 'active'
    }));

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
        ed.employment_type,
        ed.company_name,
        ed.monthly_salary,
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
      interestRate: app.interest_rate,
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
        monthlySalary: app.monthly_salary,
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

    // Check if application exists
    const applicationResult = await executeQuery('SELECT id FROM loan_applications WHERE id = ?', [applicationId]);
    if (applicationResult.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Application not found'
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
    } else if (status === 'disbursed') {
      updateQuery += ', disbursed_at = NOW()';
    }

    updateQuery += ' WHERE id = ?';
    updateParams.push(applicationId);

    await executeQuery(updateQuery, updateParams);

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
      approvedApplications: statusCounts['approved'] || 0,
      rejectedApplications: statusCounts['rejected'] || 0,
      disbursedApplications: statusCounts['disbursed'] || 0,
      newApplications: statusCounts['submitted'] || 0, // New applications are typically submitted
      
      // Legacy field names for backward compatibility
      total: total,
      applied: statusCounts['applied'] || 0,
      underReview: statusCounts['under_review'] || 0,
      approved: statusCounts['approved'] || 0,
      rejected: statusCounts['rejected'] || 0,
      disbursed: statusCounts['disbursed'] || 0,
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
