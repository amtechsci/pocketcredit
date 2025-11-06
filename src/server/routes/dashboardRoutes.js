const express = require('express');
const router = express.Router();
const { getDashboardSummary, getLoanDetails } = require('../controllers/dashboardController');
const { requireAuth } = require('../middleware/jwtAuth');

// Apply authentication middleware to all dashboard routes
router.use(requireAuth);

// Dashboard summary endpoint (both root and /summary for compatibility)
router.get('/', getDashboardSummary);
router.get('/summary', getDashboardSummary);

// Individual loan details
router.get('/loans/:loanId', getLoanDetails);

module.exports = router;
