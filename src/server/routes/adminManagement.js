const express = require('express');
const { authenticateAdmin } = require('../middleware/auth');
const router = express.Router();

// This file is a placeholder for admin management routes
// Most functionality has been moved to:
// - adminDashboard.js (mounted at /api/admin/dashboard)
// - adminApplications.js (mounted at /api/admin/applications)
// - adminUsers.js (mounted at /api/admin/users)
// - adminSettings.js (mounted at /api/admin/settings)

// Apply admin authentication to all routes
router.use(authenticateAdmin);

// Placeholder endpoints - return empty/default responses
// These routes are for any legacy admin endpoints not yet migrated

module.exports = router;
