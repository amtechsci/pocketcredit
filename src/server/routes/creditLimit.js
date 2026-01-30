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
  getCreditLimitHistory,
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

    // Get user's current limit to verify it hasn't already been increased
    const userQuery = `SELECT loan_limit FROM users WHERE id = ?`;
    const userResult = await executeQuery(userQuery, [userId]);
    const currentUserLimit = userResult && userResult.length > 0 
      ? parseFloat(userResult[0].loan_limit) || 0 
      : 0;

    // Recalculate the correct new limit using current logic (to handle old pending limits)
    const recalculatedLimitData = await calculateCreditLimitFor2EMI(userId, null, currentUserLimit);
    const correctNewLimit = recalculatedLimitData.newLimit;
    const pendingNewLimit = parseFloat(pendingLimit.new_limit);
    const storedCurrentLimit = parseFloat(pendingLimit.current_limit);

    // Check if we need to update the pending limit:
    // 1. If recalculated limit is different (and higher) than stored pending limit
    // 2. If stored current_limit is outdated (doesn't match user's actual current limit)
    const needsUpdate = (
      (correctNewLimit !== pendingNewLimit && correctNewLimit > currentUserLimit) ||
      (storedCurrentLimit !== currentUserLimit)
    );

    if (needsUpdate) {
      // Only update new_limit if it's higher than current user limit
      const finalNewLimit = correctNewLimit > currentUserLimit ? correctNewLimit : pendingNewLimit;
      
      if (finalNewLimit !== pendingNewLimit || storedCurrentLimit !== currentUserLimit) {
        console.log(`[CreditLimit] Updating pending limit: new_limit ₹${pendingNewLimit} → ₹${finalNewLimit}, current_limit ₹${storedCurrentLimit} → ₹${currentUserLimit}`);
        
        // Update the pending limit with the correct recalculated value
        await executeQuery(
          `UPDATE pending_credit_limits 
           SET new_limit = ?, current_limit = ?, percentage = ?, loan_count = ?, salary = ?, 
               is_premium_limit = ?, premium_tenure = ?, updated_at = NOW()
           WHERE id = ? AND status = 'pending'`,
          [
            finalNewLimit,
            currentUserLimit, // Update current_limit to match user's actual current limit
            recalculatedLimitData.percentage || null,
            recalculatedLimitData.loanCount || null,
            recalculatedLimitData.salary || null,
            recalculatedLimitData.showPremiumLimit ? 1 : 0,
            recalculatedLimitData.premiumTenure || null,
            pendingLimit.id
          ]
        );
        
        // Use the updated correct limit
        const updatedPendingLimit = await getPendingCreditLimit(userId);
        if (updatedPendingLimit) {
          return res.json({
            success: true,
            hasPendingLimit: true,
            data: {
              id: updatedPendingLimit.id,
              newLimit: parseFloat(updatedPendingLimit.new_limit),
              currentLimit: parseFloat(updatedPendingLimit.current_limit),
              percentage: updatedPendingLimit.percentage ? parseFloat(updatedPendingLimit.percentage) : null,
              loanCount: updatedPendingLimit.loan_count,
              salary: updatedPendingLimit.salary ? parseFloat(updatedPendingLimit.salary) : null,
              isPremiumLimit: updatedPendingLimit.is_premium_limit === 1,
              premiumTenure: updatedPendingLimit.premium_tenure,
              createdAt: updatedPendingLimit.created_at
            }
          });
        }
      }
    }

    // Use the most up-to-date values (may have been updated above)
    const finalPendingLimit = await getPendingCreditLimit(userId);
    if (!finalPendingLimit) {
      return res.json({
        success: true,
        hasPendingLimit: false,
        data: null
      });
    }

    const finalNewLimit = parseFloat(finalPendingLimit.new_limit);
    const finalCurrentLimit = parseFloat(finalPendingLimit.current_limit);

    // If user's current limit already matches or exceeds the pending new limit,
    // it means the limit was already increased, so don't show the modal
    if (currentUserLimit >= finalNewLimit) {
      // Mark the pending limit as accepted since it was already applied
      await executeQuery(
        `UPDATE pending_credit_limits 
         SET status = 'accepted', accepted_at = NOW() 
         WHERE id = ? AND status = 'pending'`,
        [finalPendingLimit.id]
      );
      
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
        id: finalPendingLimit.id,
        newLimit: finalNewLimit,
        currentLimit: finalCurrentLimit,
        percentage: finalPendingLimit.percentage ? parseFloat(finalPendingLimit.percentage) : null,
        loanCount: finalPendingLimit.loan_count,
        salary: finalPendingLimit.salary ? parseFloat(finalPendingLimit.salary) : null,
        isPremiumLimit: finalPendingLimit.is_premium_limit === 1,
        premiumTenure: finalPendingLimit.premium_tenure,
        createdAt: finalPendingLimit.created_at
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
 * GET /api/credit-limit/history
 * Get credit limit history for current user
 */
router.get('/history', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;
    const limit = parseInt(req.query.limit) || 10;

    const history = await getCreditLimitHistory(userId, limit);

    res.json({
      success: true,
      data: history.map(item => ({
        id: item.id,
        oldLimit: parseFloat(item.old_limit),
        newLimit: parseFloat(item.new_limit),
        increaseAmount: parseFloat(item.increase_amount),
        percentage: item.percentage ? parseFloat(item.percentage) : null,
        loanCount: item.loan_count,
        salary: item.salary ? parseFloat(item.salary) : null,
        isPremiumLimit: item.is_premium_limit === 1,
        premiumTenure: item.premium_tenure,
        createdAt: item.created_at
      }))
    });

  } catch (error) {
    console.error('Error fetching credit limit history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch credit limit history'
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

/**
 * POST /api/admin/credit-limit/:userId/recalculate
 * Manually trigger credit limit recalculation for a user (admin only)
 * Useful for debugging or fixing missed limit increases
 */
router.post('/admin/:userId/recalculate', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { userId } = req.params;
    const adminId = req.admin?.id;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Admin authentication required'
      });
    }

    const { calculateCreditLimitFor2EMI, storePendingCreditLimit } = require('../utils/creditLimitCalculator');
    const notificationService = require('../services/notificationService');

    // Get user's current limit
    const userLimitQuery = await executeQuery(
      `SELECT loan_limit FROM users WHERE id = ?`,
      [userId]
    );
    const currentLimit = userLimitQuery && userLimitQuery.length > 0
      ? parseFloat(userLimitQuery[0].loan_limit) || 0
      : 0;

    // Calculate new credit limit
    const creditLimitData = await calculateCreditLimitFor2EMI(userId);

    // Get user info
    const userQuery = await executeQuery(
      `SELECT first_name, last_name, phone, email FROM users WHERE id = ?`,
      [userId]
    );
    const user = userQuery && userQuery.length > 0 ? userQuery[0] : null;

    if (!creditLimitData || creditLimitData.newLimit <= 0) {
      return res.json({
        success: false,
        message: 'Could not calculate credit limit - salary may be missing',
        data: {
          currentLimit,
          calculatedLimit: creditLimitData?.newLimit || 0,
          loanCount: creditLimitData?.loanCount || 0,
          salary: creditLimitData?.salary || 0,
          error: 'No valid salary found or calculation failed'
        }
      });
    }

    const result = {
      currentLimit,
      newLimit: creditLimitData.newLimit,
      loanCount: creditLimitData.loanCount,
      percentage: creditLimitData.percentage,
      salary: creditLimitData.salary,
      willIncrease: creditLimitData.newLimit > currentLimit,
      pendingLimitStored: false
    };

    // Only store pending limit if it's higher than current limit
    if (creditLimitData.newLimit > currentLimit) {
      // Store as pending credit limit (requires user acceptance)
      await storePendingCreditLimit(userId, creditLimitData.newLimit, creditLimitData);
      result.pendingLimitStored = true;

      if (user) {
        // Send SMS and Email notification
        const recipientName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Customer';
        try {
          await notificationService.sendCreditLimitNotification({
            userId: userId,
            mobile: user.phone,
            email: user.email,
            recipientName: recipientName,
            newLimit: creditLimitData.newLimit
          });
          result.notificationSent = true;
        } catch (notifError) {
          console.error('Error sending notification:', notifError);
          result.notificationSent = false;
          result.notificationError = notifError.message;
        }
      }

      console.log(`[Admin] Manually triggered credit limit recalculation for user ${userId}: ₹${currentLimit} → ₹${creditLimitData.newLimit}`);
    } else {
      console.log(`[Admin] Credit limit recalculation for user ${userId}: New limit (₹${creditLimitData.newLimit}) is not higher than current (₹${currentLimit})`);
    }

    res.json({
      success: true,
      message: result.pendingLimitStored 
        ? 'Credit limit recalculation completed. Pending limit stored and notification sent.'
        : 'Credit limit recalculation completed. No increase needed.',
      data: result
    });

  } catch (error) {
    console.error('Error recalculating credit limit:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to recalculate credit limit',
      error: error.message
    });
  }
});

module.exports = router;

