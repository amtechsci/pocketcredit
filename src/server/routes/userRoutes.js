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
