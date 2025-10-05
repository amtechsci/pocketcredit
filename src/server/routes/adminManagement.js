const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { User, Loan, OtpCode } = require('../utils/database');
const router = express.Router();

// Middleware to verify admin token
const verifyAdminToken = (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'No token provided'
      });
    }

    const decoded = verifyToken(token);
    
    if (decoded.role !== 'superadmin' && decoded.role !== 'admin' && decoded.role !== 'manager') {
      return res.status(403).json({
        status: 'error',
        message: 'Insufficient permissions'
      });
    }

    req.adminId = decoded.id;
    req.adminRole = decoded.role;
    next();
  } catch (error) {
    res.status(401).json({
      status: 'error',
      message: 'Invalid or expired token'
    });
  }
};

// Apply admin token verification to all routes
router.use(verifyAdminToken);

// Dashboard Stats
router.get('/dashboard', async (req, res) => {
  try {
    // Calculate stats
    const totalUsers = User.count();
    const totalLoans = Loan.count();
    const pendingLoans = Loan.count({ status: 'pending' });
    const underReviewLoans = Loan.count({ status: 'under_review' });
    const approvedLoans = Loan.count({ status: 'approved' });
    const activeLoans = Loan.count({ status: 'active' });
    const disbursedLoans = Loan.findAll().filter(loan => 
      ['disbursed', 'active', 'closed'].includes(loan.status)
    );
    const totalDisbursed = disbursedLoans.reduce((sum, loan) => sum + loan.amount, 0);

    // Recent activity
    const recentLoans = Loan.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    const recentUsers = User.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    const recentActivity = [
      ...recentLoans.map(loan => ({
        type: 'loan',
        id: loan.id,
        message: `New loan application for ₹${loan.amount}`,
        timestamp: loan.createdAt,
        status: loan.status
      })),
      ...recentUsers.map(user => ({
        type: 'user',
        id: user.id,
        message: `New user registered: ${user.name || user.mobile}`,
        timestamp: user.createdAt,
        status: 'registration'
      }))
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 10);

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
          totalDisbursed
        },
        recentActivity
      }
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch dashboard data'
    });
  }
});

// Get Users
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20, kycStatus, riskCategory, memberLevel, search } = req.query;

    // Build filter
    let filter = {};
    if (kycStatus && kycStatus !== '') filter.kycStatus = kycStatus;
    if (riskCategory && riskCategory !== '') filter.riskCategory = riskCategory;
    if (memberLevel && memberLevel !== '') filter.memberLevel = memberLevel;

    let users = User.findAll(filter);

    // Apply search filter
    if (search && search !== '') {
      users = users.filter(user => 
        user.name?.toLowerCase().includes(search.toLowerCase()) ||
        user.email?.toLowerCase().includes(search.toLowerCase()) ||
        user.mobile.includes(search) ||
        (user.panNumber && user.panNumber.toLowerCase().includes(search.toLowerCase()))
      );
    }

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedUsers = users.slice(startIndex, endIndex);

    res.json({
      status: 'success',
      data: {
        users: paginatedUsers,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(users.length / limit),
          totalUsers: users.length,
          hasNext: endIndex < users.length,
          hasPrev: startIndex > 0
        }
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

// Get User Profile
router.get('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const user = User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Get user's loans
    const userLoans = Loan.findAll({ userId });

    // Get user's documents (mock data for now)
    const documents = [];

    // Get user's notes (mock data for now)
    const notes = [];

    res.json({
      status: 'success',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          mobile: user.mobile,
          kycStatus: user.kycStatus,
          creditScore: user.creditScore,
          memberLevel: user.memberLevel,
          status: user.status,
          personalInfo: user.personalInfo || {}
        },
        loans: userLoans,
        documents,
        notes
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

// Get Loans
router.get('/loans', async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;

    let loans = Loan.findAll();

    // Apply status filter
    if (status && status !== '') {
      loans = loans.filter(loan => loan.status === status);
    }

    // Apply search filter
    if (search && search !== '') {
      loans = loans.filter(loan => 
        loan.userId?.toLowerCase().includes(search.toLowerCase()) ||
        loan.type?.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Add user information to each loan
    const loansWithUserInfo = loans.map(loan => {
      const user = User.findById(loan.userId);
      return {
        ...loan,
        userName: user?.name || 'Unknown',
        userMobile: user?.mobile || 'N/A',
        userEmail: user?.email || 'N/A',
        userCreditScore: user?.creditScore || 0
      };
    });

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedLoans = loansWithUserInfo.slice(startIndex, endIndex);

    res.json({
      status: 'success',
      data: {
        loans: paginatedLoans,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(loansWithUserInfo.length / limit),
          totalLoans: loansWithUserInfo.length,
          hasNext: endIndex < loansWithUserInfo.length,
          hasPrev: startIndex > 0
        }
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

// Approve Loan
router.post('/loans/:loanId/approve', async (req, res) => {
  try {
    const { loanId } = req.params;
    const { approvedAmount, notes } = req.body;

    const loan = Loan.findById(loanId);
    if (!loan) {
      return res.status(404).json({
        status: 'error',
        message: 'Loan not found'
      });
    }

    // Update loan status
    Loan.update(loanId, {
      status: 'approved',
      approvedAmount: approvedAmount || loan.amount,
      approvedAt: new Date().toISOString(),
      approvedBy: req.adminId,
      adminNotes: notes
    });

    res.json({
      status: 'success',
      message: 'Loan approved successfully'
    });

  } catch (error) {
    console.error('Approve loan error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to approve loan'
    });
  }
});

// Reject Loan
router.post('/loans/:loanId/reject', async (req, res) => {
  try {
    const { loanId } = req.params;
    const { reason } = req.body;

    const loan = Loan.findById(loanId);
    if (!loan) {
      return res.status(404).json({
        status: 'error',
        message: 'Loan not found'
      });
    }

    // Update loan status
    Loan.update(loanId, {
      status: 'rejected',
      rejectedAt: new Date().toISOString(),
      rejectedBy: req.adminId,
      rejectionReason: reason
    });

    res.json({
      status: 'success',
      message: 'Loan rejected successfully'
    });

  } catch (error) {
    console.error('Reject loan error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to reject loan'
    });
  }
});

// Add Note to User
router.post('/users/:userId/notes', async (req, res) => {
  try {
    const { userId } = req.params;
    const { note } = req.body;

    // In a real implementation, you would save this to a notes table
    console.log(`Admin ${req.adminId} added note for user ${userId}: ${note}`);

    res.json({
      status: 'success',
      message: 'Note added successfully'
    });

  } catch (error) {
    console.error('Add note error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to add note'
    });
  }
});

// Send SMS to User
router.post('/users/:userId/sms', async (req, res) => {
  try {
    const { userId } = req.params;
    const { message } = req.body;

    const user = User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // In a real implementation, you would send actual SMS
    console.log(`SMS to ${user.mobile}: ${message}`);

    res.json({
      status: 'success',
      message: 'SMS sent successfully'
    });

  } catch (error) {
    console.error('Send SMS error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to send SMS'
    });
  }
});

module.exports = router;
