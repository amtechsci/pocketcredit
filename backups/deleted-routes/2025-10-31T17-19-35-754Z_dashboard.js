const express = require('express');
const { getDashboardSummary, getLoanDetails, invalidateUserCache, clearAllCache } = require('../controllers/dashboardController');
const { requireAuth } = require('../middleware/jwtAuth');
const router = express.Router();

// Apply JWT authentication middleware to all dashboard routes
router.use(requireAuth);

// Dashboard summary endpoint
router.get('/', getDashboardSummary);

// Individual loan details
router.get('/loans/:loanId', getLoanDetails);

// Clear cache for current user (debugging endpoint)
router.post('/clear-cache', (req, res) => {
  try {
    const userId = req.userId;
    invalidateUserCache(userId);
    console.log(`🔄 Cache cleared for user ${userId}`);
    res.json({
      status: 'success',
      message: 'Dashboard cache cleared. Refresh to see updated data.'
    });
  } catch (error) {
    console.error('Cache clear error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to clear cache'
    });
  }
});

module.exports = router;