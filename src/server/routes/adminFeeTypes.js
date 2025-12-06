const express = require('express');
const { executeQuery, initializeDatabase } = require('../config/database');
const { authenticateAdmin } = require('../middleware/auth');
const router = express.Router();

/**
 * Ensure fee_types table exists
 */
const ensureFeeTypesTable = async () => {
  await initializeDatabase();
  
  // Create fee_types table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS fee_types (
      id INT AUTO_INCREMENT PRIMARY KEY,
      fee_name VARCHAR(100) NOT NULL UNIQUE,
      fee_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
      application_method ENUM('deduct_from_disbursal', 'add_to_total') NOT NULL DEFAULT 'deduct_from_disbursal',
      description TEXT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Try to create member_tier_fees table (deprecated, kept for backward compatibility)
  // If member_tiers table doesn't exist, this will fail silently
  try {
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS member_tier_fees (
        id INT AUTO_INCREMENT PRIMARY KEY,
        member_tier_id INT NOT NULL,
        fee_type_id INT NOT NULL,
        fee_percent DECIMAL(5,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (member_tier_id) REFERENCES member_tiers(id) ON DELETE CASCADE,
        FOREIGN KEY (fee_type_id) REFERENCES fee_types(id) ON DELETE CASCADE,
        UNIQUE KEY unique_tier_fee (member_tier_id, fee_type_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  } catch (error) {
    // If member_tiers table doesn't exist, skip creating member_tier_fees
    // This is expected if member tiers have been removed
    if (error.message && error.message.includes('member_tiers')) {
      console.log('Note: member_tiers table not found, skipping member_tier_fees table creation');
    } else {
      // Re-throw unexpected errors
      throw error;
    }
  }
};

/**
 * GET /api/admin/fee-types - Get all fee types
 */
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    await ensureFeeTypesTable();
    const feeTypes = await executeQuery(
      'SELECT * FROM fee_types ORDER BY fee_name ASC'
    );
    res.json({ 
      success: true, 
      data: feeTypes || []
    });
  } catch (error) {
    console.error('Get fee types error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch fee types',
      error: error.message
    });
  }
});

/**
 * POST /api/admin/fee-types - Create new fee type
 */
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    await ensureFeeTypesTable();
    const { fee_name, fee_percent, application_method, description, is_active } = req.body;

    if (!fee_name || fee_percent == null || !application_method) {
      return res.status(400).json({
        success: false,
        message: 'Fee name, fee percent, and application method are required'
      });
    }

    if (!['deduct_from_disbursal', 'add_to_total'].includes(application_method)) {
      return res.status(400).json({
        success: false,
        message: 'Application method must be "deduct_from_disbursal" or "add_to_total"'
      });
    }

    await executeQuery(
      `INSERT INTO fee_types (fee_name, fee_percent, application_method, description, is_active) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        fee_name.trim(),
        parseFloat(fee_percent),
        application_method,
        description || null,
        is_active !== undefined ? (is_active ? 1 : 0) : 1
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Fee type created successfully'
    });
  } catch (error) {
    console.error('Create fee type error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: 'Fee type with this name already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to create fee type'
    });
  }
});

/**
 * PUT /api/admin/fee-types/:id - Update fee type
 */
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    await ensureFeeTypesTable();
    const { id } = req.params;
    const { fee_name, fee_percent, application_method, description, is_active } = req.body;

    // Check if fee type exists
    const existing = await executeQuery(
      'SELECT id FROM fee_types WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Fee type not found'
      });
    }

    // Validate application_method if provided
    if (application_method && !['deduct_from_disbursal', 'add_to_total'].includes(application_method)) {
      return res.status(400).json({
        success: false,
        message: 'Application method must be "deduct_from_disbursal" or "add_to_total"'
      });
    }

    const updates = [];
    const values = [];

    if (fee_name !== undefined) {
      updates.push('fee_name = ?');
      values.push(fee_name.trim());
    }
    if (fee_percent !== undefined) {
      updates.push('fee_percent = ?');
      values.push(parseFloat(fee_percent));
    }
    if (application_method !== undefined) {
      updates.push('application_method = ?');
      values.push(application_method);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description || null);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updates.push('updated_at = NOW()');
    values.push(id);

    await executeQuery(
      `UPDATE fee_types SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    res.json({
      success: true,
      message: 'Fee type updated successfully'
    });
  } catch (error) {
    console.error('Update fee type error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: 'Fee type with this name already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to update fee type'
    });
  }
});

/**
 * DELETE /api/admin/fee-types/:id - Delete fee type
 */
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    await ensureFeeTypesTable();
    const { id } = req.params;

    // Check if fee type is assigned to any member tier (if table exists)
    try {
      const assigned = await executeQuery(
        'SELECT COUNT(*) as count FROM member_tier_fees WHERE fee_type_id = ?',
        [id]
      );

      if (assigned && assigned.length > 0 && assigned[0] && assigned[0].count > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete fee type that is assigned to member tiers. Please remove it from all tiers first.'
        });
      }
    } catch (error) {
      // If member_tier_fees table doesn't exist, skip the check
      // This is expected if member tiers have been removed
      if (error.message && error.message.includes('member_tier_fees')) {
        console.log('Note: member_tier_fees table not found, skipping assignment check');
      } else {
        // Log unexpected errors but don't fail
        console.log('Note: Error checking member_tier_fees:', error.message);
      }
    }

    await executeQuery('DELETE FROM fee_types WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Fee type deleted successfully'
    });
  } catch (error) {
    console.error('Delete fee type error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete fee type'
    });
  }
});

/**
 * GET /api/admin/fee-types/member-tier/:tierId - Get fees for a specific member tier
 */
router.get('/member-tier/:tierId', authenticateAdmin, async (req, res) => {
  try {
    await ensureFeeTypesTable();
    const { tierId } = req.params;

    const tierFees = await executeQuery(
      `SELECT 
        mtf.id,
        mtf.member_tier_id,
        mtf.fee_type_id,
        mtf.fee_percent,
        ft.fee_name,
        ft.application_method,
        ft.description
       FROM member_tier_fees mtf
       INNER JOIN fee_types ft ON mtf.fee_type_id = ft.id
       WHERE mtf.member_tier_id = ?
       ORDER BY ft.fee_name ASC`,
      [tierId]
    );

    res.json({
      success: true,
      data: tierFees
    });
  } catch (error) {
    console.error('Get member tier fees error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch member tier fees'
    });
  }
});

/**
 * POST /api/admin/fee-types/member-tier/:tierId - Assign fee to member tier
 */
router.post('/member-tier/:tierId', authenticateAdmin, async (req, res) => {
  try {
    await ensureFeeTypesTable();
    const { tierId } = req.params;
    const { fee_type_id, fee_percent } = req.body;

    if (!fee_type_id || fee_percent == null) {
      return res.status(400).json({
        success: false,
        message: 'Fee type ID and fee percent are required'
      });
    }

    // Check if member tier exists
    const tier = await executeQuery(
      'SELECT id FROM member_tiers WHERE id = ?',
      [tierId]
    );

    if (tier.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Member tier not found'
      });
    }

    // Check if fee type exists
    const feeType = await executeQuery(
      'SELECT id FROM fee_types WHERE id = ?',
      [fee_type_id]
    );

    if (feeType.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Fee type not found'
      });
    }

    // Insert or update
    await executeQuery(
      `INSERT INTO member_tier_fees (member_tier_id, fee_type_id, fee_percent)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE fee_percent = VALUES(fee_percent), updated_at = NOW()`,
      [tierId, fee_type_id, parseFloat(fee_percent)]
    );

    res.json({
      success: true,
      message: 'Fee assigned to member tier successfully'
    });
  } catch (error) {
    console.error('Assign fee to tier error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign fee to member tier'
    });
  }
});

/**
 * DELETE /api/admin/fee-types/member-tier/:tierId/:feeId - Remove fee from member tier
 */
router.delete('/member-tier/:tierId/:feeId', authenticateAdmin, async (req, res) => {
  try {
    await ensureFeeTypesTable();
    const { tierId, feeId } = req.params;

    await executeQuery(
      'DELETE FROM member_tier_fees WHERE member_tier_id = ? AND id = ?',
      [tierId, feeId]
    );

    res.json({
      success: true,
      message: 'Fee removed from member tier successfully'
    });
  } catch (error) {
    console.error('Remove fee from tier error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove fee from member tier'
    });
  }
});

module.exports = router;

