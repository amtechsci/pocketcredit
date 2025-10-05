const express = require('express');
const { updateBasicProfile, updateAdditionalProfile, getProfileStatus } = require('../controllers/userController');
const { requireAuth } = require('../middleware/jwtAuth');

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
router.put('/profile/basic', requireAuth, updateBasicProfile);

/**
 * @route   PUT /api/user/profile/additional
 * @desc    Update additional profile details (Step 3)
 * @access  Private
 */
router.put('/profile/additional', requireAuth, updateAdditionalProfile);

/**
 * @route   GET /api/user/profile/status
 * @desc    Get profile completion status
 * @access  Private
 */
router.get('/profile/status', requireAuth, getProfileStatus);

module.exports = router;
