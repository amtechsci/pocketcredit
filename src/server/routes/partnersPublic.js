/**
 * Public API - Partners list for Our Partners page
 * GET /api/partners-display - No auth required
 */

const express = require('express');
const router = express.Router();
const { executeQuery, initializeDatabase } = require('../config/database');

/**
 * GET /api/partners-display
 * Public - List partners for Our Partners page (name, category, activities, status)
 */
router.get('/', async (req, res) => {
  try {
    await initializeDatabase();

    const partners = await executeQuery(
      `SELECT id, name, category, activities, is_active 
       FROM partners 
       ORDER BY name ASC`
    );

    const data = (partners || []).map(p => ({
      id: p.id,
      name: p.name,
      category: p.category || null,
      activities: p.activities || null,
      status: p.is_active ? 'Active' : 'Inactive'
    }));

    res.json({
      status: 'success',
      data
    });
  } catch (error) {
    console.error('Error fetching partners for display:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch partners',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
