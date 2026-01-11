const { executeQuery } = require('../config/database');

/**
 * Middleware to check if user is on hold
 * This middleware runs AFTER requireAuth, so req.userId and req.user are already set
 * 
 * Usage:
 * - Use on routes where user should NOT be able to proceed if on hold
 * - Examples: loan applications, profile updates, document submissions
 * - Don't use on: dashboard, profile view, logout
 */
const checkHoldStatus = async (req, res, next) => {
  try {
    const userId = req.userId || req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    // Get user's hold status
    const users = await executeQuery(
      `SELECT 
        status, 
        eligibility_status, 
        application_hold_reason, 
        hold_until_date 
      FROM users 
      WHERE id = ?`,
      [userId]
    );

    if (!users || users.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    const user = users[0];

    // Check if user is on hold
    if (user.status === 'on_hold') {
      // Check if hold is temporary (has hold_until_date)
      if (user.hold_until_date) {
        const holdUntil = new Date(user.hold_until_date);
        const now = new Date();

        // Check if hold period has expired
        if (now > holdUntil) {
          // Hold expired - release the hold
          await executeQuery(
            `UPDATE users 
            SET status = 'active', 
                eligibility_status = 'pending',
                application_hold_reason = NULL,
                hold_until_date = NULL,
                updated_at = NOW()
            WHERE id = ?`,
            [userId]
          );

          
          // Proceed to next middleware
          return next();
        } else {
          // Still on hold - calculate remaining days
          const remainingDays = Math.ceil((holdUntil - now) / (1000 * 60 * 60 * 24));

          return res.status(403).json({
            status: 'error',
            message: 'Your application is currently on hold',
            hold_status: {
              is_on_hold: true,
              hold_type: 'temporary',
              hold_reason: user.application_hold_reason,
              hold_until: holdUntil.toISOString(),
              hold_until_formatted: holdUntil.toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              }),
              remaining_days: remainingDays,
              can_reapply_after: holdUntil.toISOString()
            }
          });
        }
      } else {
        // Permanent hold (no hold_until_date)
        return res.status(403).json({
          status: 'error',
          message: 'Your application is permanently on hold',
          hold_status: {
            is_on_hold: true,
            hold_type: 'permanent',
            hold_reason: user.application_hold_reason,
            can_reapply: false
          }
        });
      }
    }

    // User is not on hold or hold expired - proceed
    next();

  } catch (error) {
    console.error('Hold status check error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to check hold status'
    });
  }
};

/**
 * Optional: Middleware to add hold info to response without blocking
 * Use this on dashboard/profile routes to show hold banner
 */
const addHoldInfo = async (req, res, next) => {
  try {
    const userId = req.userId || req.user?.id;
    
    if (!userId) {
      return next();
    }

    const users = await executeQuery(
      `SELECT 
        status, 
        eligibility_status, 
        application_hold_reason, 
        hold_until_date 
      FROM users 
      WHERE id = ?`,
      [userId]
    );

    if (users && users.length > 0) {
      const user = users[0];
      
      if (user.status === 'on_hold') {
        req.holdInfo = {
          is_on_hold: true,
          hold_reason: user.application_hold_reason,
          hold_until: user.hold_until_date,
          hold_type: user.hold_until_date ? 'temporary' : 'permanent'
        };
      }
    }

    next();
  } catch (error) {
    console.error('Add hold info error:', error);
    next(); // Don't block on error
  }
};

module.exports = {
  checkHoldStatus,
  addHoldInfo
};

