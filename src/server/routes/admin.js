const express = require('express');
const { 
  User, 
  Admin, 
  Loan, 
  Document, 
  Transaction, 
  Note, 
  FollowUp, 
  SmsLog,
  LoginHistory,
  Reference,
  BankInfo,
  CibilData,
  PanData,
  readDatabase 
} = require('../utils/database');
const { authenticateAdmin, requirePermission } = require('../middleware/auth');
const { validate, validateQuery, schemas, querySchemas } = require('../middleware/validation');
const router = express.Router();

// Get admin dashboard stats
router.get('/dashboard', authenticateAdmin, async (req, res) => {
  try {
    const db = readDatabase();

    // Calculate stats
    const totalUsers = User.count();
    const totalLoans = Loan.count();
    const pendingLoans = Loan.count({ status: 'pending' });
    const underReviewLoans = Loan.count({ status: 'under_review' });
    const approvedLoans = Loan.count({ status: 'approved' });
    const activeLoans = Loan.count({ status: 'active' });
    const totalDisbursed = Loan.findAll({ status: { $in: ['disbursed', 'active', 'closed'] } })
      .reduce((sum, loan) => sum + loan.amount, 0);

    // Recent activity
    const recentLoans = Loan.findAll()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    const recentUsers = User.findAll()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    // Monthly stats
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const thisMonthLoans = Loan.findAll().filter(loan => {
      const loanDate = new Date(loan.createdAt);
      return loanDate.getMonth() === currentMonth && loanDate.getFullYear() === currentYear;
    });

    res.json({
      status: 'success',
      data: {
        stats: {
          totalUsers,
          totalLoans,
          pendingLoans,
          underReviewLoans,
          approvedLoans,
          activeLoans,
          totalDisbursed,
          thisMonthLoans: thisMonthLoans.length,
          thisMonthDisbursed: thisMonthLoans
            .filter(loan => loan.status === 'disbursed')
            .reduce((sum, loan) => sum + loan.amount, 0)
        },
        recentActivity: {
          loans: recentLoans.map(loan => ({
            id: loan.id,
            loanId: loan.loanId,
            amount: loan.amount,
            status: loan.status,
            createdAt: loan.createdAt,
            user: User.findById(loan.userId)?.name
          })),
          users: recentUsers.map(user => ({
            id: user.id,
            name: user.name,
            email: user.email,
            kycStatus: user.kycStatus,
            createdAt: user.createdAt
          }))
        }
      }
    });

  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch dashboard data'
    });
  }
});

// Get all users with pagination and filters
router.get('/users', authenticateAdmin, validateQuery(querySchemas.userFilter), async (req, res) => {
  try {
    const { page, limit, kycStatus, riskCategory, memberLevel, search } = req.validatedQuery;

    // Build filter
    let filter = {};
    if (kycStatus) filter.kycStatus = kycStatus;
    if (riskCategory) filter.riskCategory = riskCategory;
    if (memberLevel) filter.memberLevel = memberLevel;

    let users = User.findAll(filter);

    // Apply search filter
    if (search) {
      users = users.filter(user => 
        user.name.toLowerCase().includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase()) ||
        user.mobile.includes(search) ||
        (user.panNumber && user.panNumber.toLowerCase().includes(search.toLowerCase()))
      );
    }

    // Manual pagination since we have complex filtering
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedUsers = users.slice(startIndex, endIndex);

    res.json({
      status: 'success',
      data: paginatedUsers.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        panNumber: user.panNumber,
        kycStatus: user.kycStatus,
        creditScore: user.creditScore,
        riskCategory: user.riskCategory,
        memberLevel: user.memberLevel,
        isActive: user.isActive,
        createdAt: user.createdAt,
        lastLogin: user.lastLoginDate
      })),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(users.length / limit),
        totalRecords: users.length,
        hasNext: endIndex < users.length,
        hasPrev: startIndex > 0,
        limit
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch users'
    });
  }
});

// Get user profile details
router.get('/users/:userId', authenticateAdmin, async (req, res) => {
  try {
    const user = User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Get related data
    const loans = Loan.findAll({ userId: req.params.userId });
    const documents = Document.findAll({ userId: req.params.userId });
    const transactions = Transaction.findAll({ userId: req.params.userId });
    const references = Reference.findAll({ userId: req.params.userId });
    const bankInfo = BankInfo.findAll({ userId: req.params.userId });
    const notes = Note.findAll({ userId: req.params.userId });
    const followUps = FollowUp.findAll({ userId: req.params.userId });
    const smsLog = SmsLog.findAll({ userId: req.params.userId });
    const loginHistory = LoginHistory.findAll({ userId: req.params.userId })
      .sort((a, b) => new Date(b.loginTime) - new Date(a.loginTime))
      .slice(0, 10);

    // Get CIBIL and PAN data
    const cibilData = CibilData.findOne({ userId: req.params.userId });
    const panData = PanData.findOne({ userId: req.params.userId });

    // Remove password from user data
    const { password, ...userProfile } = user;

    res.json({
      status: 'success',
      data: {
        user: userProfile,
        loans,
        documents,
        transactions: transactions.slice(-10), // Last 10 transactions
        references,
        bankInfo,
        notes: notes.map(note => ({
          ...note,
          adminName: Admin.findById(note.adminId)?.name
        })),
        followUps: followUps.map(followUp => ({
          ...followUp,
          adminName: Admin.findById(followUp.adminId)?.name
        })),
        smsLog: smsLog.slice(-20), // Last 20 SMS
        loginHistory,
        cibilData,
        panData
      }
    });

  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch user profile'
    });
  }
});

// Update user profile (admin)
router.put('/users/:userId', authenticateAdmin, requirePermission('edit_users'), async (req, res) => {
  try {
    const updates = req.body;
    
    // Remove sensitive fields that shouldn't be updated via this endpoint
    delete updates.password;
    delete updates.id;
    delete updates.createdAt;

    const updatedUser = User.update(req.params.userId, updates);

    if (!updatedUser) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Remove password from response
    const { password, ...userProfile } = updatedUser;

    res.json({
      status: 'success',
      message: 'User profile updated successfully',
      data: userProfile
    });

  } catch (error) {
    console.error('Update user profile error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update user profile'
    });
  }
});

// Get all loan applications
router.get('/loans', authenticateAdmin, validateQuery(querySchemas.loanFilter), async (req, res) => {
  try {
    const { page, limit, status, type, minAmount, maxAmount, fromDate, toDate } = req.validatedQuery;

    // Build filter
    let filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;

    let loans = Loan.findAll(filter);

    // Apply additional filters
    if (minAmount || maxAmount || fromDate || toDate) {
      loans = loans.filter(loan => {
        if (minAmount && loan.amount < minAmount) return false;
        if (maxAmount && loan.amount > maxAmount) return false;
        if (fromDate && new Date(loan.createdAt) < new Date(fromDate)) return false;
        if (toDate && new Date(loan.createdAt) > new Date(toDate)) return false;
        return true;
      });
    }

    // Sort by created date (newest first)
    loans.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Manual pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedLoans = loans.slice(startIndex, endIndex);

    // Enrich with user data
    const enrichedLoans = paginatedLoans.map(loan => {
      const user = User.findById(loan.userId);
      return {
        ...loan,
        userName: user?.name,
        userEmail: user?.email,
        userMobile: user?.mobile,
        userCreditScore: user?.creditScore
      };
    });

    res.json({
      status: 'success',
      data: enrichedLoans,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(loans.length / limit),
        totalRecords: loans.length,
        hasNext: endIndex < loans.length,
        hasPrev: startIndex > 0,
        limit
      }
    });

  } catch (error) {
    console.error('Get loans error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch loans'
    });
  }
});

// Get loan details
router.get('/loans/:loanId', authenticateAdmin, async (req, res) => {
  try {
    const loan = Loan.findOne({ loanId: req.params.loanId });
    if (!loan) {
      return res.status(404).json({
        status: 'error',
        message: 'Loan not found'
      });
    }

    // Get user details
    const user = User.findById(loan.userId);
    const documents = Document.findAll({ userId: loan.userId, loanId: req.params.loanId });
    const transactions = Transaction.findAll({ loanId: req.params.loanId });

    res.json({
      status: 'success',
      data: {
        loan,
        user: user ? {
          id: user.id,
          name: user.name,
          email: user.email,
          mobile: user.mobile,
          creditScore: user.creditScore,
          kycStatus: user.kycStatus,
          personalInfo: user.personalInfo
        } : null,
        documents,
        transactions
      }
    });

  } catch (error) {
    console.error('Get loan details error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch loan details'
    });
  }
});

// Approve loan
router.post('/loans/:loanId/approve', authenticateAdmin, requirePermission('approve_loans'), async (req, res) => {
  try {
    const { comments, modifiedAmount, modifiedTenure, modifiedInterestRate } = req.body;

    const loan = Loan.findOne({ loanId: req.params.loanId });
    if (!loan) {
      return res.status(404).json({
        status: 'error',
        message: 'Loan not found'
      });
    }

    if (!['pending', 'under_review'].includes(loan.status)) {
      return res.status(400).json({
        status: 'error',
        message: 'Loan cannot be approved in current status'
      });
    }

    // Calculate new EMI if amount/tenure/rate is modified
    let updatedLoan = { ...loan };
    if (modifiedAmount || modifiedTenure || modifiedInterestRate) {
      const amount = modifiedAmount || loan.amount;
      const tenure = modifiedTenure || loan.tenure;
      const interestRate = modifiedInterestRate || loan.interestRate;
      
      const monthlyRate = interestRate / (12 * 100);
      const emi = Math.round((amount * monthlyRate * Math.pow(1 + monthlyRate, tenure)) / 
                           (Math.pow(1 + monthlyRate, tenure) - 1));

      updatedLoan = {
        ...updatedLoan,
        amount,
        tenure,
        interestRate,
        emi
      };
    }

    // Update loan
    const approvedLoan = Loan.update(loan.id, {
      ...updatedLoan,
      status: 'approved',
      approvedBy: req.admin.id,
      approvedDate: new Date().toISOString(),
      approvalComments: comments,
      expectedDisbursalDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() // 3 days
    });

    res.json({
      status: 'success',
      message: 'Loan approved successfully',
      data: approvedLoan
    });

  } catch (error) {
    console.error('Approve loan error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to approve loan'
    });
  }
});

// Reject loan
router.post('/loans/:loanId/reject', authenticateAdmin, requirePermission('reject_loans'), async (req, res) => {
  try {
    const { reason, comments } = req.body;

    if (!reason) {
      return res.status(400).json({
        status: 'error',
        message: 'Rejection reason is required'
      });
    }

    const loan = Loan.findOne({ loanId: req.params.loanId });
    if (!loan) {
      return res.status(404).json({
        status: 'error',
        message: 'Loan not found'
      });
    }

    if (!['pending', 'under_review'].includes(loan.status)) {
      return res.status(400).json({
        status: 'error',
        message: 'Loan cannot be rejected in current status'
      });
    }

    // Update loan
    const rejectedLoan = Loan.update(loan.id, {
      status: 'rejected',
      rejectedBy: req.admin.id,
      rejectedDate: new Date().toISOString(),
      rejectionReason: reason,
      rejectionComments: comments
    });

    res.json({
      status: 'success',
      message: 'Loan rejected successfully',
      data: rejectedLoan
    });

  } catch (error) {
    console.error('Reject loan error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to reject loan'
    });
  }
});

// Add admin note
router.post('/users/:userId/notes', authenticateAdmin, validate(schemas.adminNote), async (req, res) => {
  try {
    const note = Note.create({
      userId: req.params.userId,
      adminId: req.admin.id,
      ...req.validatedData
    });

    res.json({
      status: 'success',
      message: 'Note added successfully',
      data: {
        ...note,
        adminName: req.admin.name
      }
    });

  } catch (error) {
    console.error('Add note error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to add note'
    });
  }
});

// Add follow-up
router.post('/users/:userId/follow-ups', authenticateAdmin, validate(schemas.followUp), async (req, res) => {
  try {
    const followUp = FollowUp.create({
      userId: req.params.userId,
      adminId: req.admin.id,
      ...req.validatedData,
      status: 'pending'
    });

    res.json({
      status: 'success',
      message: 'Follow-up scheduled successfully',
      data: {
        ...followUp,
        adminName: req.admin.name
      }
    });

  } catch (error) {
    console.error('Add follow-up error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to schedule follow-up'
    });
  }
});

// Send SMS to user
router.post('/users/:userId/send-sms', authenticateAdmin, validate(schemas.smsMessage), async (req, res) => {
  try {
    const user = User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Mock SMS sending
    console.log(`📱 Admin SMS to ${user.mobile}: ${req.validatedData.message}`);

    // Log SMS
    const smsLog = SmsLog.create({
      userId: req.params.userId,
      adminId: req.admin.id,
      mobile: user.mobile,
      message: req.validatedData.message,
      type: req.validatedData.type,
      status: 'delivered' // Mock status
    });

    res.json({
      status: 'success',
      message: 'SMS sent successfully',
      data: smsLog
    });

  } catch (error) {
    console.error('Send SMS error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to send SMS'
    });
  }
});

// Verify/Reject document
router.post('/documents/:documentId/verify', authenticateAdmin, requirePermission('verify_documents'), async (req, res) => {
  try {
    const { action, remarks } = req.body; // action: 'verify' or 'reject'

    if (!action || !['verify', 'reject'].includes(action)) {
      return res.status(400).json({
        status: 'error',
        message: 'Valid action (verify/reject) is required'
      });
    }

    const document = Document.findById(req.params.documentId);
    if (!document) {
      return res.status(404).json({
        status: 'error',
        message: 'Document not found'
      });
    }

    const updatedDocument = Document.update(req.params.documentId, {
      status: action === 'verify' ? 'verified' : 'rejected',
      verifiedBy: req.admin.id,
      verificationDate: new Date().toISOString(),
      remarks: remarks || (action === 'verify' ? 'Document verified' : 'Document rejected')
    });

    res.json({
      status: 'success',
      message: `Document ${action}ed successfully`,
      data: updatedDocument
    });

  } catch (error) {
    console.error('Document verification error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to process document'
    });
  }
});

// Get admin team (super admin only)
router.get('/team', authenticateAdmin, requirePermission('manage_team'), async (req, res) => {
  try {
    const admins = Admin.findAll({ isActive: true });

    const teamMembers = admins.map(admin => ({
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      permissions: admin.permissions,
      isActive: admin.isActive,
      createdAt: admin.createdAt,
      lastLogin: LoginHistory.findOne({ 
        userId: admin.id, 
        userType: 'admin' 
      })?.loginTime
    }));

    res.json({
      status: 'success',
      data: teamMembers
    });

  } catch (error) {
    console.error('Get team error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch team members'
    });
  }
});

// Get system settings
router.get('/settings', authenticateAdmin, async (req, res) => {
  try {
    const db = readDatabase();
    
    res.json({
      status: 'success',
      data: db.settings || {}
    });

  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch settings'
    });
  }
});

module.exports = router;