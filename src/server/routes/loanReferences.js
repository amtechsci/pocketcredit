const express = require('express');
const { getConnection } = require('../utils/mysqlDatabase');
const { requireAuth } = require('../middleware/session');
const router = express.Router();

// =====================================================
// LOAN REFERENCES MANAGEMENT
// =====================================================

// POST /api/loan-references - Save Reference Details for Loan Application
router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

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
    const phoneRegex = /^[6-9]\d{9}$/;
    for (let i = 0; i < references.length; i++) {
      const ref = references[i];
      if (!ref.name || !ref.phone || !ref.relation) {
        return res.status(400).json({
          success: false,
          message: `Reference ${i + 1}: Name, phone, and relation are required`
        });
      }
      
      if (!phoneRegex.test(ref.phone)) {
        return res.status(400).json({
          success: false,
          message: `Reference ${i + 1}: Please enter a valid 10-digit mobile number starting with 6-9`
        });
      }
    }

    // Check for duplicate phone numbers
    const phoneNumbers = references.map(ref => ref.phone);
    const uniquePhones = [...new Set(phoneNumbers)];
    if (uniquePhones.length !== phoneNumbers.length) {
      return res.status(400).json({
        success: false,
        message: 'All reference phone numbers must be different'
      });
    }

    const connection = await getConnection();

    // Verify that the loan application belongs to the user
    const [applications] = await connection.execute(
      'SELECT id, user_id FROM loan_applications WHERE id = ? AND user_id = ?',
      [application_id, userId]
    );

    if (applications.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Loan application not found or does not belong to you'
      });
    }

    // Delete existing references for this application
    await connection.execute(
      'DELETE FROM `references` WHERE loan_application_id = ?',
      [application_id]
    );

    // Insert new references
    const insertPromises = references.map(ref => 
      connection.execute(
        `INSERT INTO \`references\` 
         (user_id, loan_application_id, name, phone, relation, status) 
         VALUES (?, ?, ?, ?, ?, 'pending')`,
        [userId, application_id, ref.name, ref.phone, ref.relation]
      )
    );

    await Promise.all(insertPromises);

    res.status(201).json({
      success: true,
      message: 'Reference details saved successfully',
      data: {
        references_count: references.length,
        status: 'saved'
      }
    });

  } catch (error) {
    console.error('Reference details error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while saving reference details'
    });
  }
});

// GET /api/loan-references/:applicationId - Get Reference Details for Loan Application
router.get('/:applicationId', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { applicationId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const connection = await getConnection();

    // Get reference details for the specific loan application
    const [references] = await connection.execute(
      `SELECT ref.*, la.application_number, la.loan_amount, la.loan_purpose
       FROM \`references\` ref
       JOIN loan_applications la ON ref.loan_application_id = la.id
       WHERE ref.loan_application_id = ? AND ref.user_id = ?
       ORDER BY ref.created_at ASC`,
      [applicationId, userId]
    );

    if (references.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Reference details not found for this loan application'
      });
    }

    res.json({
      success: true,
      data: references
    });

  } catch (error) {
    console.error('Get reference details error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching reference details'
    });
  }
});

module.exports = router;
