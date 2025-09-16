const express = require('express');
const { 
  applyForLoan, 
  getAllUserLoanApplications, 
  getLoanApplicationById,
  getLoanApplicationStats 
} = require('../controllers/loanApplicationController');
const { requireAuth } = require('../middleware/session');

const router = express.Router();

/**
 * Loan Application Routes
 * Handles loan application management endpoints
 */

/**
 * @route   POST /api/loan-applications/apply
 * @desc    Apply for a new loan
 * @access  Private (requires complete profile)
 */
router.post('/apply', requireAuth, applyForLoan);

/**
 * @route   GET /api/loan-applications
 * @desc    Get all user's loan applications
 * @access  Private
 */
router.get('/', requireAuth, getAllUserLoanApplications);

/**
 * @route   GET /api/loan-applications/:applicationId
 * @desc    Get specific loan application by ID
 * @access  Private
 */
router.get('/:applicationId', requireAuth, getLoanApplicationById);

/**
 * @route   GET /api/loan-applications/stats/summary
 * @desc    Get loan application statistics
 * @access  Private
 */
router.get('/stats/summary', requireAuth, getLoanApplicationStats);

module.exports = router;
