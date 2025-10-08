const express = require('express');
const { executeQuery, initializeDatabase } = require('../config/database');
const { requireAuth } = require('../middleware/jwtAuth');
const router = express.Router();

// POST /api/references - Save/Update User References
router.post('/', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;
    const { references } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    if (!references || !Array.isArray(references) || references.length === 0) {
      return res.status(400).json({ success: false, message: 'References array is required' });
    }
    if (references.length > 3) {
      return res.status(400).json({ success: false, message: 'You can provide a maximum of 3 references' });
    }

    for (const ref of references) {
      const relationship = ref.relationship || ref.relation; // Allow both for flexibility
      if (!ref.name || !ref.phone || !relationship) {
        return res.status(400).json({ success: false, message: 'Each reference must have name, phone, and relationship' });
      }
      const phoneRegex = /^[6-9]\d{9}$/;
      if (!phoneRegex.test(ref.phone)) {
        return res.status(400).json({ success: false, message: 'Invalid phone number format for reference' });
      }
    }

    // Delete existing references for this user
    await executeQuery('DELETE FROM `references` WHERE user_id = ?', [userId]);

    // Insert new references
    const insertedRefs = [];
    for (const ref of references) {
      const relationship = ref.relationship || ref.relation;
      const result = await executeQuery(
        'INSERT INTO `references` (user_id, name, phone, relationship, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
        [userId, ref.name, ref.phone, relationship]
      );
      insertedRefs.push({ id: result.insertId, ...ref, relationship });
    }

    res.status(201).json({
      success: true,
      message: 'References saved successfully',
      data: insertedRefs,
      references_count: insertedRefs.length
    });

  } catch (error) {
    console.error('Error saving user references:', error);
    res.status(500).json({ success: false, message: 'Internal server error while saving references' });
  }
});

// GET /api/references - Get User References
router.get('/', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const references = await executeQuery(
      'SELECT id, user_id, name, phone, relationship, status, admin_id, created_at, updated_at FROM `references` WHERE user_id = ? ORDER BY created_at ASC',
      [userId]
    );

    res.json({ success: true, data: references || [] });

  } catch (error) {
    console.error('Error fetching user references:', error);
    res.status(500).json({ success: false, message: 'Internal server error while fetching references' });
  }
});

// PUT /api/references/:id - Update a specific user reference
router.put('/:id', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;
    const { id } = req.params;
    const { name, phone, relationship, status } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const updateFields = [];
    const updateValues = [];

    if (name) { updateFields.push('name = ?'); updateValues.push(name); }
    if (phone) { updateFields.push('phone = ?'); updateValues.push(phone); }
    if (relationship) { updateFields.push('relationship = ?'); updateValues.push(relationship); }
    if (status) { updateFields.push('status = ?'); updateValues.push(status); }

    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, message: 'No update data provided' });
    }

    updateValues.push(id, userId);

    const result = await executeQuery(
      `UPDATE \`references\` SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ? AND user_id = ?`,
      updateValues
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Reference not found or does not belong to user' });
    }

    res.json({ success: true, message: 'Reference updated successfully' });

  } catch (error) {
    console.error('Error updating user reference:', error);
    res.status(500).json({ success: false, message: 'Internal server error while updating reference' });
  }
});

// DELETE /api/references/:id - Delete a specific user reference
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const result = await executeQuery(
      'DELETE FROM `references` WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Reference not found or does not belong to user' });
    }

    res.json({ success: true, message: 'Reference deleted successfully' });

  } catch (error) {
    console.error('Error deleting user reference:', error);
    res.status(500).json({ success: false, message: 'Internal server error while deleting reference' });
  }
});

module.exports = router;
