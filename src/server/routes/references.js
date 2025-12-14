const express = require('express');
const { executeQuery, initializeDatabase } = require('../config/database');
const { requireAuth } = require('../middleware/jwtAuth');
const { checkHoldStatus } = require('../middleware/checkHoldStatus');
const router = express.Router();

// POST /api/references - Save/Update User References and Alternate Data
router.post('/', requireAuth, checkHoldStatus, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;
    const { references, alternate_mobile, company_name, company_email } = req.body;

    // Get user's registered phone number
    const userData = await executeQuery('SELECT phone FROM users WHERE id = ?', [userId]);
    const userPhone = userData.length > 0 ? userData[0].phone : null;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // Validate references - exactly 3 required
    if (!references || !Array.isArray(references) || references.length === 0) {
      return res.status(400).json({ success: false, message: 'References array is required' });
    }
    if (references.length !== 3) {
      return res.status(400).json({ success: false, message: 'Exactly 3 references are required' });
    }

    // Validate alternate mobile is required
    if (!alternate_mobile) {
      return res.status(400).json({ success: false, message: 'Alternate mobile is required' });
    }

    // Validate alternate mobile format
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(alternate_mobile)) {
      return res.status(400).json({ success: false, message: 'Invalid alternate mobile number format' });
    }

    // Validate company email format if provided
    if (company_email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(company_email)) {
        return res.status(400).json({ success: false, message: 'Invalid company email format' });
      }
    }

    // Check if any reference phone matches user's own registered phone
    if (userPhone) {
      for (let i = 0; i < references.length; i++) {
        if (references[i].phone === userPhone) {
          return res.status(400).json({ success: false, message: `Reference ${i + 1}: Cannot use your own registered phone number` });
        }
      }

      // Check if alternate mobile matches user's own registered phone
      if (alternate_mobile === userPhone) {
        return res.status(400).json({ success: false, message: 'Alternate mobile cannot be your own registered phone number' });
      }
    }

    // Check for duplicate phone numbers across all references
    const allReferencePhones = references.map(ref => ref.phone);
    for (let i = 0; i < allReferencePhones.length; i++) {
      for (let j = i + 1; j < allReferencePhones.length; j++) {
        if (allReferencePhones[i] === allReferencePhones[j]) {
          return res.status(400).json({ success: false, message: `Reference ${i + 1} and Reference ${j + 1} have the same phone number` });
        }
      }
    }

    // Check that alternate mobile is different from reference phones
    if (allReferencePhones.includes(alternate_mobile)) {
      return res.status(400).json({ success: false, message: 'Alternate mobile number cannot be same as any reference number' });
    }

    // Final check: all numbers should be unique
    const allPhones = [...allReferencePhones, alternate_mobile];
    const uniquePhones = new Set(allPhones);
    if (uniquePhones.size !== allPhones.length) {
      return res.status(400).json({ success: false, message: 'All phone numbers must be unique. Please check for duplicates.' });
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
        'INSERT INTO `references` (user_id, name, phone, relation, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
        [userId, ref.name, ref.phone, relationship]
      );
      insertedRefs.push({ id: result.insertId, ...ref, relationship });
    }

    // Update user with alternate data (only update company fields if provided)
    const updateFields = ['alternate_mobile = ?'];
    const updateValues = [alternate_mobile];

    if (company_name) {
      updateFields.push('company_name = ?');
      updateValues.push(company_name);
    }

    if (company_email) {
      updateFields.push('company_email = ?');
      updateValues.push(company_email);
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(userId);

    await executeQuery(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    res.status(201).json({
      success: true,
      message: 'References and alternate data saved successfully',
      data: {
        references: insertedRefs,
        references_count: insertedRefs.length,
        alternate_data: {
          alternate_mobile,
          company_name,
          company_email
        }
      }
    });

  } catch (error) {
    console.error('Error saving user references:', error);
    res.status(500).json({ success: false, message: 'Internal server error while saving references' });
  }
});

// GET /api/references - Get User References and Alternate Data
router.get('/', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const references = await executeQuery(
      'SELECT id, user_id, name, phone, relation, status, admin_id, created_at, updated_at FROM `references` WHERE user_id = ? ORDER BY created_at ASC',
      [userId]
    );

    // Get alternate data from users table
    const userData = await executeQuery(
      'SELECT alternate_mobile, company_name, company_email FROM users WHERE id = ?',
      [userId]
    );

    res.json({
      success: true,
      data: {
        references: references || [],
        alternate_data: userData.length > 0 ? {
          alternate_mobile: userData[0].alternate_mobile,
          company_name: userData[0].company_name,
          company_email: userData[0].company_email
        } : null
      }
    });

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
    if (relationship) { updateFields.push('relation = ?'); updateValues.push(relationship); }
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
