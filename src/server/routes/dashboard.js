const express = require('express');
const { getDashboardSummary, getLoanDetails } = require('../controllers/dashboardController');
const { requireAuth } = require('../middleware/jwtAuth');
const router = express.Router();

// Apply JWT authentication middleware to all dashboard routes
router.use(requireAuth);

// Dashboard summary endpoint
router.get('/', getDashboardSummary);

// Individual loan details
router.get('/loans/:loanId', getLoanDetails);

module.exports = router;