const express = require('express');
const router = express.Router();
const { getDashboardSummary, getLoanDetails } = require('../controllers/dashboardController');
const { requireAuth } = require('../middleware/auth');

// Apply authentication middleware to all dashboard routes
router.use(requireAuth);

// Dashboard summary endpoint
router.get('/summary', getDashboardSummary);

// Individual loan details
router.get('/loans/:loanId', getLoanDetails);

module.exports = router;
