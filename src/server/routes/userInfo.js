const express = require('express');
const router = express.Router();
const { executeQuery, initializeDatabase } = require('../config/database');
const { requireAuth } = require('../middleware/jwtAuth');
const { authenticateAdmin } = require('../middleware/auth');
const { getUserInfo, saveUserInfoFromDigilocker, saveAddressFromDigilocker, saveUserInfoFromBankAPI } = require('../services/userInfoService');

/**
 * GET /api/user-info
 * Get all user info records for the authenticated user
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;

    const records = await getUserInfo(userId);

    // Parse additional_details JSON if it's a string
    const parsedRecords = records.map(record => ({
      ...record,
      additional_details: typeof record.additional_details === 'string' 
        ? JSON.parse(record.additional_details) 
        : record.additional_details
    }));

    res.json({
      success: true,
      data: parsedRecords
    });
  } catch (error) {
    console.error('Error getting user info:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user info',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/user-info/:userId
 * Get all user info records for a specific user (admin only)
 */
router.get('/:userId', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = parseInt(req.params.userId);

    const records = await getUserInfo(userId);

    // Parse additional_details JSON if it's a string
    const parsedRecords = records.map(record => ({
      ...record,
      additional_details: typeof record.additional_details === 'string' 
        ? JSON.parse(record.additional_details) 
        : record.additional_details
    }));

    res.json({
      success: true,
      data: parsedRecords
    });
  } catch (error) {
    console.error('Error getting user info:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user info',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/user-info
 * Create or update user info manually (input source)
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;
    const { name, phone, email, gender, dob, additional_details } = req.body;

    // Validate required fields
    if (!name && !phone && !email) {
      return res.status(400).json({
        success: false,
        message: 'At least one of name, phone, or email is required'
      });
    }

    // Check if user_info already exists for manual input
    const existing = await executeQuery(
      `SELECT id FROM user_info 
       WHERE user_id = ? AND source = 'input' AND is_primary = 1`,
      [userId]
    );

    const additionalDetailsJson = additional_details ? JSON.stringify(additional_details) : null;

    if (existing.length > 0) {
      // Update existing record
      await executeQuery(
        `UPDATE user_info 
         SET name = ?, phone = ?, email = ?, gender = ?, dob = ?, additional_details = ?, updated_at = NOW()
         WHERE id = ?`,
        [name || null, phone || null, email || null, gender || null, dob || null, additionalDetailsJson, existing[0].id]
      );
      
      res.json({
        success: true,
        message: 'User info updated successfully',
        data: { id: existing[0].id, action: 'updated' }
      });
    } else {
      // Mark other input records as not primary
      await executeQuery(
        `UPDATE user_info SET is_primary = 0 WHERE user_id = ? AND source = 'input'`
      );

      // Insert new record
      const result = await executeQuery(
        `INSERT INTO user_info 
         (user_id, name, phone, email, gender, dob, additional_details, source, is_primary, verified, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'input', 1, 0, NOW(), NOW())`,
        [userId, name || null, phone || null, email || null, gender || null, dob || null, additionalDetailsJson]
      );
      
      res.json({
        success: true,
        message: 'User info created successfully',
        data: { id: result.insertId, action: 'created' }
      });
    }
  } catch (error) {
    console.error('Error saving user info:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save user info',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * PUT /api/user-info/:id
 * Update a specific user info record
 */
router.put('/:id', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;
    const infoId = parseInt(req.params.id);
    const { name, phone, email, gender, dob, additional_details, verified } = req.body;

    // Verify the record belongs to the user
    const existing = await executeQuery(
      `SELECT id FROM user_info WHERE id = ? AND user_id = ?`,
      [infoId, userId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User info record not found'
      });
    }

    const additionalDetailsJson = additional_details ? JSON.stringify(additional_details) : null;

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (phone !== undefined) { updates.push('phone = ?'); values.push(phone); }
    if (email !== undefined) { updates.push('email = ?'); values.push(email); }
    if (gender !== undefined) { updates.push('gender = ?'); values.push(gender); }
    if (dob !== undefined) { updates.push('dob = ?'); values.push(dob); }
    if (additional_details !== undefined) { updates.push('additional_details = ?'); values.push(additionalDetailsJson); }
    if (verified !== undefined) { updates.push('verified = ?'); values.push(verified ? 1 : 0); }

    updates.push('updated_at = NOW()');
    values.push(infoId);

    await executeQuery(
      `UPDATE user_info SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    res.json({
      success: true,
      message: 'User info updated successfully'
    });
  } catch (error) {
    console.error('Error updating user info:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user info',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * DELETE /api/user-info/:id
 * Delete a specific user info record
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;
    const infoId = parseInt(req.params.id);

    // Verify the record belongs to the user
    const existing = await executeQuery(
      `SELECT id FROM user_info WHERE id = ? AND user_id = ?`,
      [infoId, userId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User info record not found'
      });
    }

    await executeQuery(
      `DELETE FROM user_info WHERE id = ?`,
      [infoId]
    );

    res.json({
      success: true,
      message: 'User info deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user info:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user info',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;

