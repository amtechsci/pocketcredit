const express = require('express');
const { executeQuery, initializeDatabase } = require('../config/database');
const { authenticateAdmin } = require('../middleware/auth');
const router = express.Router();

/**
 * GET /api/admin/late-fees/:memberTierId - Get late fee tiers for a member tier
 */
router.get('/:memberTierId', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { memberTierId } = req.params;

    const lateFees = await executeQuery(
      'SELECT * FROM late_fee_tiers WHERE member_tier_id = ? ORDER BY tier_order ASC',
      [memberTierId]
    );

    res.json({
      success: true,
      data: lateFees
    });
  } catch (error) {
    console.error('Get late fees error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch late fees'
    });
  }
});

/**
 * POST /api/admin/late-fees - Create new late fee tier
 */
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { 
      member_tier_id, 
      tier_name,
      days_overdue_start, 
      days_overdue_end, 
      fee_type, 
      fee_value,
      tier_order
    } = req.body;

    if (!member_tier_id || !tier_name || days_overdue_start == null || !fee_type || !fee_value || !tier_order) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    const result = await executeQuery(
      `INSERT INTO late_fee_tiers 
        (member_tier_id, tier_name, days_overdue_start, days_overdue_end, fee_type, fee_value, tier_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [member_tier_id, tier_name, days_overdue_start, days_overdue_end || null, fee_type, fee_value, tier_order]
    );

    res.json({
      success: true,
      message: 'Late fee tier created successfully',
      data: {
        id: result.insertId
      }
    });
  } catch (error) {
    console.error('Create late fee error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create late fee tier'
    });
  }
});

/**
 * PUT /api/admin/late-fees/:id - Update late fee tier
 */
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { id } = req.params;
    const { 
      tier_name,
      days_overdue_start, 
      days_overdue_end, 
      fee_type, 
      fee_value,
      tier_order
    } = req.body;

    const existing = await executeQuery(
      'SELECT id FROM late_fee_tiers WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Late fee tier not found'
      });
    }

    await executeQuery(
      `UPDATE late_fee_tiers 
      SET tier_name = ?, days_overdue_start = ?, days_overdue_end = ?, 
          fee_type = ?, fee_value = ?, tier_order = ?, updated_at = NOW()
      WHERE id = ?`,
      [tier_name, days_overdue_start, days_overdue_end || null, fee_type, fee_value, tier_order, id]
    );

    res.json({
      success: true,
      message: 'Late fee tier updated successfully'
    });
  } catch (error) {
    console.error('Update late fee error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update late fee tier'
    });
  }
});

/**
 * DELETE /api/admin/late-fees/:id - Delete late fee tier
 */
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { id } = req.params;

    const existing = await executeQuery(
      'SELECT id FROM late_fee_tiers WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Late fee tier not found'
      });
    }

    await executeQuery('DELETE FROM late_fee_tiers WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Late fee tier deleted successfully'
    });
  } catch (error) {
    console.error('Delete late fee error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete late fee tier'
    });
  }
});

module.exports = router;

