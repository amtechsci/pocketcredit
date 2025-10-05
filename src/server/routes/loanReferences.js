const express = require('express');
const { executeQuery, initializeDatabase } = require('../config/database');
const { requireAuth } = require('../middleware/jwtAuth');
const router = express.Router();

// =====================================================
// LOAN REFERENCES MANAGEMENT
// =====================================================

// POST /api/loan-references - Save Reference Details for Loan Application
router.post('/', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;

    const { 
      application_id,
      references
    } = req.body;

    // Validation
    if (!application_id || !references || !Array.isArray(references) || references.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Application ID and references array are required'
      });
    }

    // Validate each reference
    for (const ref of references) {
      // Accept both 'relationship' and 'relation' field names for backward compatibility
      const relationship = ref.relationship || ref.relation;
      if (!ref.name || !ref.phone || !relationship) {
        return res.status(400).json({
          success: false,
          message: 'Each reference must have name, phone, and relationship'
        });
      }

      // Validate phone number format
      const phoneRegex = /^[6-9]\d{9}$/;
      if (!phoneRegex.test(ref.phone)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid phone number format for reference'
        });
      }
    }

    // Verify that the loan application belongs to the user
    const applications = await executeQuery(
      'SELECT id, user_id FROM loan_applications WHERE id = ? AND user_id = ?',
      [application_id, userId]
    );

    if (!applications || applications.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Loan application not found or does not belong to you'
      });
    }

    // Delete existing references for this application
    await executeQuery(
      'DELETE FROM loan_references WHERE application_id = ?',
      [application_id]
    );

    // Insert new references
    const referenceIds = [];
    for (const ref of references) {
      // Use the normalized relationship value
      const relationship = ref.relationship || ref.relation;
      const result = await executeQuery(
        'INSERT INTO loan_references (application_id, name, phone, relationship, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
        [application_id, ref.name, ref.phone, relationship]
      );
      referenceIds.push(result.insertId);
    }

    res.json({
      success: true,
      message: 'Reference details saved successfully',
      data: {
        application_id,
        reference_ids: referenceIds,
        references_count: references.length
      }
    });

  } catch (error) {
    console.error('Error saving loan references:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while saving loan references'
    });
  }
});

// GET /api/loan-references/:applicationId - Get Reference Details for Loan Application
router.get('/:applicationId', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;
    const { applicationId } = req.params;

    // Verify that the loan application belongs to the user
    const applications = await executeQuery(
      'SELECT id, user_id FROM loan_applications WHERE id = ? AND user_id = ?',
      [applicationId, userId]
    );

    if (!applications || applications.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Loan application not found or does not belong to you'
      });
    }

    const references = await executeQuery(
      'SELECT * FROM loan_references WHERE application_id = ? ORDER BY created_at DESC',
      [applicationId]
    );

    res.json({
      success: true,
      data: references || []
    });

  } catch (error) {
    console.error('Error fetching loan references:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching loan references'
    });
  }
});

module.exports = router;