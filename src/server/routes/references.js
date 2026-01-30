const express = require('express');
const { executeQuery, initializeDatabase } = require('../config/database');
const { requireAuth } = require('../middleware/jwtAuth');
const { checkHoldStatus } = require('../middleware/checkHoldStatus');
const router = express.Router();

// POST /api/references - Save/Update User References and Alternate Data
// Note: Removed checkHoldStatus - users should be able to update references even if on hold
router.post('/', requireAuth, async (req, res) => {
  console.log('🔔 POST /api/references - Request received');
  console.log('🔔 Headers:', { 
    authorization: req.headers.authorization ? 'present' : 'missing',
    'content-type': req.headers['content-type']
  });
  
  try {
    await initializeDatabase();
    const userId = req.userId;
    const { references, alternate_mobile, company_name, company_email } = req.body;

    console.log('📝 Saving references for user:', userId);
    console.log('📝 Request body:', { 
      referencesCount: references?.length, 
      hasAlternateMobile: !!alternate_mobile,
      references: references 
    });

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
    console.log('✅ Deleted existing references for user:', userId);

    // Insert new references
    const insertedRefs = [];
    for (const ref of references) {
      const relationship = ref.relationship || ref.relation;
      console.log('📝 Inserting reference:', { name: ref.name, phone: ref.phone, relation: relationship });
      const result = await executeQuery(
        'INSERT INTO `references` (user_id, name, phone, relation, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
        [userId, ref.name, ref.phone, relationship]
      );
      insertedRefs.push({ id: result.insertId, ...ref, relationship });
      console.log('✅ Inserted reference with ID:', result.insertId);
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
    console.log('✅ Updated user alternate data for user:', userId);

    // After references saved, update loan application status to 'submitted' for admin review
    // This marks that user has completed all required steps
    try {
      const applications = await executeQuery(
        `SELECT id, status, current_step FROM loan_applications 
         WHERE user_id = ? AND status NOT IN ('cleared', 'cancelled', 'account_manager', 'overdue')
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );

      if (applications && applications.length > 0) {
        const application = applications[0];
        // Only update if application is in a pre-review status and step is at references or later
        if (['pending', 'in_progress', 'submitted'].includes(application.status) || 
            ['bank-details', 'references'].includes(application.current_step)) {
          await executeQuery(
            `UPDATE loan_applications 
             SET status = 'submitted', current_step = 'complete', updated_at = NOW() 
             WHERE id = ?`,
            [application.id]
          );
          console.log(`✅ Updated loan application ${application.id} to 'submitted' status - ready for admin review`);
        }
      }
    } catch (stepError) {
      console.warn('⚠️ Could not update loan application status after references saved:', stepError.message);
      // Don't fail - references are already saved
    }

    console.log('✅ Successfully saved references:', {
      referencesCount: insertedRefs.length,
      alternateMobile: alternate_mobile
    });

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
    console.error('❌ Error saving user references:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error while saving references',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
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

// POST /api/references/credit-analytics - Auto-save credit analytics mobile numbers as references
router.post('/credit-analytics', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;
    const { mobile_numbers } = req.body;

    console.log('📱 Auto-saving credit analytics references for user:', userId);
    console.log('📱 Mobile numbers received:', mobile_numbers);

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (!mobile_numbers || !Array.isArray(mobile_numbers) || mobile_numbers.length === 0) {
      return res.status(400).json({ success: false, message: 'No mobile numbers provided' });
    }

    // Get user's registered phone number to exclude it
    const userData = await executeQuery('SELECT phone FROM users WHERE id = ?', [userId]);
    const userPhone = userData.length > 0 ? userData[0].phone : null;

    // Get existing references for this user to avoid duplicates
    const existingRefs = await executeQuery(
      'SELECT phone FROM `references` WHERE user_id = ?',
      [userId]
    );
    const existingPhones = new Set(existingRefs.map(ref => ref.phone));

    // Filter valid mobile numbers
    const phoneRegex = /^[6-9]\d{9}$/;
    const validMobiles = mobile_numbers.filter(mobile => {
      const phone = String(mobile).trim();
      // Must be valid format, not user's own number, not already saved
      return phoneRegex.test(phone) && phone !== userPhone && !existingPhones.has(phone);
    });

    console.log('📱 Valid new mobiles to save:', validMobiles);

    if (validMobiles.length === 0) {
      return res.json({
        success: true,
        message: 'No new credit analytics references to save',
        data: { saved_count: 0, saved_references: [] }
      });
    }

    // Insert new credit analytics references
    const savedRefs = [];
    for (let i = 0; i < validMobiles.length; i++) {
      const mobile = validMobiles[i];
      const name = `Credit Report Contact ${i + 1}`;
      const relation = 'Self';

      const result = await executeQuery(
        'INSERT INTO `references` (user_id, name, phone, relation, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
        [userId, name, mobile, relation]
      );

      savedRefs.push({
        id: result.insertId,
        name,
        phone: mobile,
        relation
      });

      console.log(`✅ Saved credit analytics reference: ${mobile}`);
    }

    console.log(`✅ Auto-saved ${savedRefs.length} credit analytics references for user ${userId}`);

    res.json({
      success: true,
      message: `Successfully saved ${savedRefs.length} credit analytics references`,
      data: {
        saved_count: savedRefs.length,
        saved_references: savedRefs
      }
    });

  } catch (error) {
    console.error('❌ Error auto-saving credit analytics references:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while saving credit analytics references'
    });
  }
});

module.exports = router;
