const express = require('express');
const { authenticateAdmin } = require('../middleware/auth');
const { executeQuery, initializeDatabase } = require('../config/database');
const router = express.Router();

// Get dashboard statistics (root route and /stats both work)
const getDashboardStats = async (req, res) => {
  try {
    await initializeDatabase();
    
    const { period = '30d' } = req.query;
    
    // Calculate date range based on period
    const now = new Date();
    let startDate;
    
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get all data from MySQL
    const [
      usersResult,
      applicationsResult,
      loansResult
    ] = await Promise.all([
      executeQuery('SELECT COUNT(*) as total, SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as recent, SUM(CASE WHEN kyc_completed = 1 THEN 1 ELSE 0 END) as verified, SUM(CASE WHEN kyc_completed = 0 THEN 1 ELSE 0 END) as pending FROM users', [startDate]),
      executeQuery('SELECT COUNT(*) as total, SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as recent, SUM(CASE WHEN LOWER(status) IN ("submitted", "pending", "under_review", "under review") THEN 1 ELSE 0 END) as pending, SUM(CASE WHEN LOWER(status) = "approved" THEN 1 ELSE 0 END) as approved, SUM(CASE WHEN LOWER(status) = "rejected" THEN 1 ELSE 0 END) as rejected, SUM(loan_amount) as totalAmount, AVG(loan_amount) as avgAmount FROM loan_applications', [startDate]),
      executeQuery('SELECT COUNT(*) as total, SUM(CASE WHEN status = "active" THEN 1 ELSE 0 END) as active, SUM(CASE WHEN status = "disbursed" THEN 1 ELSE 0 END) as disbursed, SUM(loan_amount) as totalDisbursed, AVG(loan_amount) as avgAmount FROM loan_applications WHERE status IN ("approved", "disbursed")')
    ]);

    const users = usersResult[0];
    const applications = applicationsResult[0];
    const loans = loansResult[0];

    // Calculate statistics from MySQL data
    const stats = {
      // User statistics
      totalUsers: users.total || 0,
      activeUsers: users.total || 0, // All users are considered active in current schema
      newUsers: users.recent || 0,
      verifiedUsers: users.verified || 0,
      pendingVerification: users.pending || 0,

      // Application statistics
      totalApplications: applications.total || 0,
      pendingApplications: applications.pending || 0,
      approvedApplications: applications.approved || 0,
      rejectedApplications: applications.rejected || 0,
      newApplications: applications.recent || 0,

      // Loan statistics
      totalLoans: loans.total || 0,
      activeLoans: loans.active || 0,
      disbursedLoans: loans.disbursed || 0,
      totalDisbursed: parseFloat(loans.totalDisbursed) || 0,
      averageLoanAmount: parseFloat(applications.avgAmount) || 0,

      // Document statistics (using defaults since these tables don't exist yet)
      totalDocuments: 0,
      verifiedDocuments: 0,
      pendingDocuments: 0,
      rejectedDocuments: 0,

      // Transaction statistics (using defaults since these tables don't exist yet)
      totalTransactions: 0,
      totalTransactionAmount: 0,
      recentTransactions: 0,
      completedTransactions: 0,

      // Activity statistics (using defaults since these tables don't exist yet)
      totalFollowUps: 0,
      pendingFollowUps: 0,
      completedFollowUps: 0,
      totalNotes: 0,
      totalSmsSent: 0,
      recentSmsSent: 0,
      totalLogins: 0,
      recentLogins: 0,

      // Risk statistics (using defaults since risk categories don't exist yet)
      highRiskUsers: 0,
      mediumRiskUsers: 0,
      lowRiskUsers: 0,

      // Credit score statistics (using defaults since credit_score column doesn't exist)
      averageCreditScore: 750,
      highCreditScore: 0,
      lowCreditScore: 0
    };

    res.json({
      status: 'success',
      data: stats
    });

  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch dashboard statistics'
    });
  }
};

// Mount the dashboard stats on both root and /stats
router.get('/', authenticateAdmin, getDashboardStats);
router.get('/stats', authenticateAdmin, getDashboardStats);

// Get recent activity
router.get('/recent-activity', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    
    const { limit = 10 } = req.query;
    
    const activities = [];

    // Get recent applications from MySQL
    const recentApplications = await executeQuery(`
      SELECT 
        la.id,
        la.application_number,
        la.loan_amount,
        la.loan_purpose,
        la.status,
        la.created_at,
        u.first_name,
        u.last_name,
        u.email
      FROM loan_applications la
      LEFT JOIN users u ON la.user_id = u.id
      ORDER BY la.created_at DESC
      LIMIT 5
    `);
    
    recentApplications.forEach(app => {
      activities.push({
        id: `app-${app.id}`,
        type: 'application',
        title: 'New Loan Application',
        description: `${app.first_name || 'Unknown User'} applied for ₹${parseFloat(app.loan_amount || 0).toLocaleString()} ${app.loan_purpose?.toLowerCase() || 'personal'} loan`,
        timestamp: app.created_at,
        status: app.status,
        user: app.first_name ? { id: app.id, name: `${app.first_name} ${app.last_name || ''}`.trim() } : null
      });
    });

    // Get recent user registrations from MySQL
    const recentUsers = await executeQuery(`
      SELECT 
        id,
        first_name,
        last_name,
        email,
        created_at,
        kyc_completed
      FROM users
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    recentUsers.forEach(user => {
      activities.push({
        id: `user-${user.id}`,
        type: 'registration',
        title: 'New User Registration',
        description: `${user.first_name} registered with ${user.email}`,
        timestamp: user.created_at,
        status: user.kyc_completed ? 'completed' : 'pending',
        user: { id: user.id, name: `${user.first_name} ${user.last_name || ''}`.trim() }
      });
    });

    // Sort all activities by timestamp and limit
    const sortedActivities = activities
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, parseInt(limit));

    res.json({
      status: 'success',
      data: sortedActivities
    });

  } catch (error) {
    console.error('Get recent activity error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch recent activity'
    });
  }
});

// Get chart data for the dashboard
router.get('/charts', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    
    const { period = '30d' } = req.query;

    const now = new Date();
    let startDate;
    let groupBy;

    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        groupBy = 'day';
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        groupBy = 'day';
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        groupBy = 'week';
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        groupBy = 'month';
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        groupBy = 'day';
    }

    // Get applications data from MySQL
    const applications = await executeQuery(`
      SELECT 
        created_at as applicationDate,
        loan_amount as loanAmount
      FROM loan_applications 
      WHERE created_at >= ?
      ORDER BY created_at ASC
    `, [startDate]);

    // Get loans data from MySQL (using approved applications as loans)
    const loans = await executeQuery(`
      SELECT 
        approved_at as disbursedDate,
        loan_amount as disbursedAmount
      FROM loan_applications 
      WHERE approved_at IS NOT NULL AND approved_at >= ?
      ORDER BY approved_at ASC
    `, [startDate]);

    const formatData = (data, dateField, valueField) => {
      const result = {};
      data.forEach(item => {
        const date = new Date(item[dateField]);
        let key;

        if (groupBy === 'day') {
          key = date.toISOString().split('T')[0];
        } else if (groupBy === 'week') {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
        } else { // month
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }

        if (!result[key]) {
          result[key] = 0;
        }
        result[key] += item[valueField] || 0;
      });
      return result;
    };

    const applicationData = formatData(applications, 'applicationDate', 'loanAmount');
    const loanData = formatData(loans, 'disbursedDate', 'disbursedAmount');
    
    res.json({
      status: 'success',
      data: {
        applications: applicationData,
        loans: loanData
      }
    });

  } catch (error) {
    console.error('Get chart data error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch chart data' });
  }
});

// Helper functions for chart data
async function getApplicationsOverTime(startDate, endDate) {
  const applications = LoanApplication.findAll()
    .filter(app => {
      const appDate = new Date(app.applicationDate);
      return appDate >= startDate && appDate <= endDate;
    });

  // Group by date
  const grouped = {};
  applications.forEach(app => {
    const date = new Date(app.applicationDate).toISOString().split('T')[0];
    if (!grouped[date]) {
      grouped[date] = { date, count: 0, amount: 0 };
    }
    grouped[date].count++;
    grouped[date].amount += app.loanAmount || 0;
  });

  return Object.values(grouped).sort((a, b) => new Date(a.date) - new Date(b.date));
}

async function getLoanAmountsDistribution() {
  const loans = Loan.findAll();
  
  const ranges = [
    { range: '0-50k', min: 0, max: 50000, count: 0 },
    { range: '50k-1L', min: 50000, max: 100000, count: 0 },
    { range: '1L-5L', min: 100000, max: 500000, count: 0 },
    { range: '5L-10L', min: 500000, max: 1000000, count: 0 },
    { range: '10L+', min: 1000000, max: Infinity, count: 0 }
  ];

  loans.forEach(loan => {
    const amount = loan.amount || 0;
    const range = ranges.find(r => amount >= r.min && amount < r.max);
    if (range) range.count++;
  });

  return ranges;
}

async function getUserRegistrationsOverTime(startDate, endDate) {
  const users = User.findAll()
    .filter(user => {
      const userDate = new Date(user.createdAt);
      return userDate >= startDate && userDate <= endDate;
    });

  // Group by date
  const grouped = {};
  users.forEach(user => {
    const date = new Date(user.createdAt).toISOString().split('T')[0];
    if (!grouped[date]) {
      grouped[date] = { date, count: 0 };
    }
    grouped[date].count++;
  });

  return Object.values(grouped).sort((a, b) => new Date(a.date) - new Date(b.date));
}

async function getCreditScoreDistribution() {
  const users = User.findAll();
  
  const ranges = [
    { range: '300-500', min: 300, max: 500, count: 0 },
    { range: '500-600', min: 500, max: 600, count: 0 },
    { range: '600-700', min: 600, max: 700, count: 0 },
    { range: '700-750', min: 700, max: 750, count: 0 },
    { range: '750-800', min: 750, max: 800, count: 0 },
    { range: '800+', min: 800, max: 900, count: 0 }
  ];

  users.forEach(user => {
    const score = user.creditScore || 0;
    const range = ranges.find(r => score >= r.min && score < r.max);
    if (range) range.count++;
  });

  return ranges;
}

async function getStatusBreakdown() {
  const applications = LoanApplication.findAll();
  
  const statusCounts = {};
  applications.forEach(app => {
    statusCounts[app.status] = (statusCounts[app.status] || 0) + 1;
  });

  return Object.entries(statusCounts).map(([status, count]) => ({
    status,
    count,
    percentage: (count / applications.length) * 100
  }));
}

module.exports = router;
