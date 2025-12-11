const express = require('express');
const { updateBasicProfile, updateAdditionalProfile, updateStudentProfile, updateGraduationStatus, getProfileStatus, updateAdditionalDetails } = require('../controllers/userController');
const { requireAuth } = require('../middleware/jwtAuth');
const { checkHoldStatus } = require('../middleware/checkHoldStatus');

const router = express.Router();

/**
 * User Routes
 * Handles user profile management endpoints
 */

/**
 * @route   PUT /api/user/profile/basic
 * @desc    Update basic profile details (Step 2)
 * @access  Private
 */
router.put('/profile/basic', requireAuth, checkHoldStatus, updateBasicProfile);

/**
 * @route   PUT /api/user/profile/additional
 * @desc    Update additional profile details (Step 3)
 * @access  Private
 */
router.put('/profile/additional', requireAuth, checkHoldStatus, updateAdditionalProfile);

/**
 * @route   PUT /api/user/profile/student
 * @desc    Update student profile details (Step 3 for students)
 * @access  Private
 */
router.put('/profile/student', requireAuth, checkHoldStatus, updateStudentProfile);

/**
 * @route   PUT /api/user/selected-loan-plan
 * @desc    Update user's selected loan plan
 * @access  Private
 */
router.put('/selected-loan-plan', requireAuth, async (req, res) => {
  try {
    const { executeQuery, initializeDatabase } = require('../config/database');
    await initializeDatabase();
    const userId = req.userId;
    const { plan_id } = req.body;

    if (!plan_id) {
      return res.status(400).json({
        status: 'error',
        message: 'plan_id is required'
      });
    }

    // Check if plan exists and is active
    const plans = await executeQuery(
      'SELECT id FROM loan_plans WHERE id = ? AND is_active = 1',
      [plan_id]
    );

    if (plans.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Loan plan not found or inactive'
      });
    }

    // Update user's selected loan plan
    await executeQuery(
      'UPDATE users SET selected_loan_plan_id = ?, updated_at = NOW() WHERE id = ?',
      [plan_id, userId]
    );

    res.json({
      status: 'success',
      message: 'Loan plan selected successfully',
      data: { plan_id }
    });
  } catch (error) {
    console.error('Update selected loan plan error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update selected loan plan'
    });
  }
});

/**
 * @route   GET /api/user/selected-loan-plan
 * @desc    Get user's selected loan plan
 * @access  Private
 */
router.get('/selected-loan-plan', requireAuth, async (req, res) => {
  try {
    const { executeQuery, initializeDatabase } = require('../config/database');
    await initializeDatabase();
    const userId = req.userId;

    // Get user's selected plan or default plan
    const users = await executeQuery(
      `SELECT u.selected_loan_plan_id 
       FROM users u 
       WHERE u.id = ?`,
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    const user = users[0];
    let planId = user.selected_loan_plan_id;

    // If no plan selected, get system default
    if (!planId) {
      const defaultPlans = await executeQuery(
        'SELECT id FROM loan_plans WHERE is_default = 1 AND is_active = 1 LIMIT 1'
      );
      if (defaultPlans.length > 0) {
        planId = defaultPlans[0].id;
      }
    }

    if (!planId) {
      return res.status(404).json({
        status: 'error',
        message: 'No loan plan available'
      });
    }

    // Get plan details
    const plans = await executeQuery(
      'SELECT * FROM loan_plans WHERE id = ?',
      [planId]
    );

    res.json({
      status: 'success',
      data: {
        plan: plans[0] || null,
        is_user_selected: user.selected_loan_plan_id === planId,
        is_system_default: !user.selected_loan_plan_id
      }
    });
  } catch (error) {
    console.error('Get selected loan plan error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get selected loan plan'
    });
  }
});

/**
 * @route   PUT /api/user/graduation-status
 * @desc    Update graduation status for students (Upsell feature)
 * @access  Private
 */
router.put('/graduation-status', requireAuth, updateGraduationStatus);

/**
 * @route   GET /api/user/profile/status
 * @desc    Get profile completion status
 * @access  Private
 */
router.get('/profile/status', requireAuth, getProfileStatus);

/**
 * @route   PUT /api/user/additional-details
 * @desc    Update additional details (email, marital status, salary date)
 * @access  Private
 */
router.put('/additional-details', requireAuth, checkHoldStatus, updateAdditionalDetails);

module.exports = router;
