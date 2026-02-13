/**
 * Public API - Partners list for Our Partners page
 * GET /api/partners-display - No auth required
 */

const express = require('express');
const router = express.Router();
const { executeQuery, initializeDatabase } = require('../config/database');

async function ensurePartnersColumns() {
  for (const col of [
    { name: 'category', def: 'VARCHAR(255) DEFAULT NULL' },
    { name: 'activities', def: 'TEXT DEFAULT NULL' }
  ]) {
    try {
      await executeQuery(`ALTER TABLE partners ADD COLUMN ${col.name} ${col.def}`);
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME' && !String(e.message || '').includes('Duplicate column')) {
        console.warn('Partners migration:', e.message);
      }
    }
  }
}

/**
 * GET /api/partners-display
 * Public - List partners for Our Partners page (name, category, activities, status)
 */
router.get('/', async (req, res) => {
  try {
    await initializeDatabase();
    await ensurePartnersColumns();

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
