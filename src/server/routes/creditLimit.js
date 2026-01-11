/**
 * Credit Limit Management Routes
 * Handles credit limit increases, acceptance, and rejection
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/jwtAuth');
const { authenticateAdmin } = require('../middleware/auth');
const { initializeDatabase, executeQuery } = require('../config/database');
const {
  calculateCreditLimitFor2EMI,
  getPendingCreditLimit,
  acceptPendingCreditLimit,
  rejectPendingCreditLimit,
  getMonthlyIncomeFromRange
} = require('../utils/creditLimitCalculator');

/**
 * GET /api/credit-limit/pending
 * Get pending credit limit increase for current user
 */
router.get('/pending', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;

    const pendingLimit = await getPendingCreditLimit(userId);

    if (!pendingLimit) {
      return res.json({
        success: true,
        hasPendingLimit: false,
        data: null
      });
    }

    res.json({
      success: true,
      hasPendingLimit: true,
      data: {
        id: pendingLimit.id,
        newLimit: parseFloat(pendingLimit.new_limit),
        currentLimit: parseFloat(pendingLimit.current_limit),
        percentage: pendingLimit.percentage ? parseFloat(pendingLimit.percentage) : null,
        loanCount: pendingLimit.loan_count,
        salary: pendingLimit.salary ? parseFloat(pendingLimit.salary) : null,
        isPremiumLimit: pendingLimit.is_premium_limit === 1,
        premiumTenure: pendingLimit.premium_tenure,
        createdAt: pendingLimit.created_at
      }
    });

  } catch (error) {
    console.error('Error fetching pending credit limit:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending credit limit'
    });
  }
});

/**
 * GET /api/credit-limit/next
 * Get next available credit limit (for display in frontend)
 */
router.get('/next', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;

    // Get user's current limit
    const userQuery = `SELECT loan_limit FROM users WHERE id = ?`;
    const userResult = await executeQuery(userQuery, [userId]);
    const currentLimit = userResult && userResult.length > 0 
      ? parseFloat(userResult[0].loan_limit) || 0 
      : 0;

    // Calculate next limit
    const limitData = await calculateCreditLimitFor2EMI(userId, null, currentLimit);

    res.json({
      success: true,
      data: {
        currentLimit: limitData.currentLimit,
        nextLimit: limitData.newLimit,
        percentage: limitData.percentage,
        loanCount: limitData.loanCount,
        isPremiumLimit: limitData.showPremiumLimit,
        premiumLimit: limitData.premiumLimit,
        premiumTenure: limitData.premiumTenure,
        isMaxReached: limitData.isMaxReached
      }
    });

  } catch (error) {
    console.error('Error calculating next credit limit:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate next credit limit'
    });
  }
});

/**
 * POST /api/credit-limit/accept
 * Accept pending credit limit increase
 */
router.post('/accept', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;
    const { pendingLimitId } = req.body;

    if (!pendingLimitId) {
      return res.status(400).json({
        success: false,
        message: 'Pending limit ID is required'
      });
    }

    await acceptPendingCreditLimit(userId, pendingLimitId);

    res.json({
      success: true,
      message: 'Credit limit increase accepted successfully'
    });

  } catch (error) {
    console.error('Error accepting credit limit:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to accept credit limit increase'
    });
  }
});

/**
 * POST /api/credit-limit/reject
 * Reject pending credit limit increase
 */
router.post('/reject', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;
    const { pendingLimitId } = req.body;

    if (!pendingLimitId) {
      return res.status(400).json({
        success: false,
        message: 'Pending limit ID is required'
      });
    }

    await rejectPendingCreditLimit(userId, pendingLimitId);

    res.json({
      success: true,
      message: 'Credit limit increase rejected'
    });

  } catch (error) {
    console.error('Error rejecting credit limit:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject credit limit increase'
    });
  }
});

/**
 * GET /api/admin/credit-limit/pending
 * Get all pending credit limits (admin)
 */
router.get('/admin/pending', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();

    const query = `
      SELECT 
        pcl.*,
        u.id as user_id,
        u.first_name,
        u.last_name,
        u.phone,
        u.email,
        u.personal_email,
        u.official_email
      FROM pending_credit_limits pcl
      JOIN users u ON pcl.user_id = u.id
      WHERE pcl.status = 'pending'
      ORDER BY pcl.created_at DESC
    `;

    const results = await executeQuery(query);

    res.json({
      success: true,
      data: results.map(limit => ({
        id: limit.id,
        userId: limit.user_id,
        userName: `${limit.first_name || ''} ${limit.last_name || ''}`.trim(),
        phone: limit.phone,
        email: limit.personal_email || limit.official_email || limit.email,
        newLimit: parseFloat(limit.new_limit),
        currentLimit: parseFloat(limit.current_limit),
        percentage: limit.percentage ? parseFloat(limit.percentage) : null,
        loanCount: limit.loan_count,
        isPremiumLimit: limit.is_premium_limit === 1,
        premiumTenure: limit.premium_tenure,
        createdAt: limit.created_at
      }))
    });

  } catch (error) {
    console.error('Error fetching pending credit limits:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending credit limits'
    });
  }
});

module.exports = router;

