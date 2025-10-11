const express = require('express');
const { executeQuery, initializeDatabase } = require('../config/database');
const { authenticateAdmin } = require('../middleware/auth');
const router = express.Router();

/**
 * GET /api/admin/loan-tiers - Get all loan limit tiers
 */
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    
    const tiers = await executeQuery(
      'SELECT * FROM loan_limit_tiers ORDER BY tier_order ASC'
    );

    res.json({
      success: true,
      data: tiers
    });
  } catch (error) {
    console.error('Get loan tiers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch loan tiers'
    });
  }
});

/**
 * GET /api/admin/loan-tiers/:id - Get single loan tier
 */
router.get('/:id', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { id } = req.params;

    const tiers = await executeQuery(
      'SELECT * FROM loan_limit_tiers WHERE id = ?',
      [id]
    );

    if (tiers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Loan tier not found'
      });
    }

    res.json({
      success: true,
      data: tiers[0]
    });
  } catch (error) {
    console.error('Get loan tier error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch loan tier'
    });
  }
});

/**
 * POST /api/admin/loan-tiers - Create new loan tier
 */
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { tier_name, min_salary, max_salary, loan_limit, is_active, tier_order } = req.body;

    // Validate required fields
    if (!tier_name || !min_salary || !loan_limit || tier_order === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: tier_name, min_salary, loan_limit, tier_order'
      });
    }

    // Check if tier_order already exists
    const existingTier = await executeQuery(
      'SELECT id FROM loan_limit_tiers WHERE tier_order = ?',
      [tier_order]
    );

    if (existingTier.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'A tier with this order already exists'
      });
    }

    const result = await executeQuery(
      `INSERT INTO loan_limit_tiers 
        (tier_name, min_salary, max_salary, loan_limit, is_active, tier_order)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [tier_name, min_salary, max_salary || null, loan_limit, is_active !== false ? 1 : 0, tier_order]
    );

    res.json({
      success: true,
      message: 'Loan tier created successfully',
      data: {
        id: result.insertId
      }
    });
  } catch (error) {
    console.error('Create loan tier error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create loan tier'
    });
  }
});

/**
 * PUT /api/admin/loan-tiers/:id - Update loan tier
 */
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { id } = req.params;
    const { tier_name, min_salary, max_salary, loan_limit, is_active, tier_order } = req.body;

    // Check if tier exists
    const existing = await executeQuery(
      'SELECT id FROM loan_limit_tiers WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Loan tier not found'
      });
    }

    // Check if new tier_order conflicts with another tier
    if (tier_order !== undefined) {
      const conflictingTier = await executeQuery(
        'SELECT id FROM loan_limit_tiers WHERE tier_order = ? AND id != ?',
        [tier_order, id]
      );

      if (conflictingTier.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'A tier with this order already exists'
        });
      }
    }

    await executeQuery(
      `UPDATE loan_limit_tiers 
      SET tier_name = ?, min_salary = ?, max_salary = ?, loan_limit = ?, is_active = ?, tier_order = ?, updated_at = NOW()
      WHERE id = ?`,
      [tier_name, min_salary, max_salary || null, loan_limit, is_active !== false ? 1 : 0, tier_order, id]
    );

    res.json({
      success: true,
      message: 'Loan tier updated successfully'
    });
  } catch (error) {
    console.error('Update loan tier error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update loan tier'
    });
  }
});

/**
 * DELETE /api/admin/loan-tiers/:id - Delete loan tier
 */
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { id } = req.params;

    // Check if tier exists
    const existing = await executeQuery(
      'SELECT id FROM loan_limit_tiers WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Loan tier not found'
      });
    }

    await executeQuery('DELETE FROM loan_limit_tiers WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Loan tier deleted successfully'
    });
  } catch (error) {
    console.error('Delete loan tier error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete loan tier'
    });
  }
});

/**
 * PATCH /api/admin/loan-tiers/:id/toggle - Toggle tier active status
 */
router.patch('/:id/toggle', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { id } = req.params;

    // Check if tier exists
    const existing = await executeQuery(
      'SELECT id, is_active FROM loan_limit_tiers WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Loan tier not found'
      });
    }

    const newStatus = existing[0].is_active ? 0 : 1;

    await executeQuery(
      'UPDATE loan_limit_tiers SET is_active = ?, updated_at = NOW() WHERE id = ?',
      [newStatus, id]
    );

    res.json({
      success: true,
      message: `Loan tier ${newStatus ? 'activated' : 'deactivated'} successfully`,
      data: {
        is_active: newStatus
      }
    });
  } catch (error) {
    console.error('Toggle loan tier error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle loan tier status'
    });
  }
});

module.exports = router;

