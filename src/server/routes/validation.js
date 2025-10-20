const express = require('express');
const { authenticateAdmin } = require('../middleware/auth');
const { executeQuery } = require('../config/database');
const router = express.Router();

// Get validation options by type
router.get('/options/:type', authenticateAdmin, async (req, res) => {
  try {
    const { type } = req.params;
    
    if (!['need_document', 'not_process', 'process', 'cancel'].includes(type)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid validation type'
      });
    }

    const options = await executeQuery(
      'SELECT id, name, type FROM validation_options WHERE type = ? AND is_active = TRUE ORDER BY name',
      [type]
    );

    res.json({
      status: 'success',
      data: options || []
    });

  } catch (error) {
    console.error('Error fetching validation options:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch validation options'
    });
  }
});

// Get all validation options
router.get('/options', authenticateAdmin, async (req, res) => {
  try {
    const options = await executeQuery(
      'SELECT id, name, type FROM validation_options WHERE is_active = TRUE ORDER BY type, name'
    );

    // Group by type
    const groupedOptions = options.reduce((acc, option) => {
      if (!acc[option.type]) {
        acc[option.type] = [];
      }
      acc[option.type].push({
        id: option.id,
        name: option.name
      });
      return acc;
    }, {});

    res.json({
      status: 'success',
      data: groupedOptions
    });

  } catch (error) {
    console.error('Error fetching validation options:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch validation options'
    });
  }
});

// Add new validation option
router.post('/options', authenticateAdmin, async (req, res) => {
  try {
    const { name, type } = req.body;

    if (!name || !type) {
      return res.status(400).json({
        status: 'error',
        message: 'Name and type are required'
      });
    }

    if (!['need_document', 'not_process', 'process', 'cancel'].includes(type)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid validation type'
      });
    }

    const result = await executeQuery(
      'INSERT INTO validation_options (name, type) VALUES (?, ?)',
      [name, type]
    );

    res.json({
      status: 'success',
      message: 'Validation option added successfully',
      data: {
        id: result.insertId,
        name,
        type
      }
    });

  } catch (error) {
    console.error('Error adding validation option:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to add validation option'
    });
  }
});

// Submit validation action
router.post('/submit', authenticateAdmin, async (req, res) => {
  try {
    console.log('Validation submit request body:', req.body);
    console.log('Admin from middleware:', req.admin);
    
    const { 
      userId, 
      loanApplicationId, 
      actionType, 
      actionDetails,
      adminId 
    } = req.body;

    // Use admin ID from the authenticated admin if not provided in body
    const finalAdminId = adminId || req.admin?.id;

    console.log('Final admin ID:', finalAdminId);

    if (!userId || !actionType || !actionDetails || !finalAdminId) {
      return res.status(400).json({
        status: 'error',
        message: 'userId, actionType, actionDetails, and adminId are required'
      });
    }

    if (!['need_document', 'process', 'not_process', 'cancel'].includes(actionType)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid action type'
      });
    }

    // Insert validation history record
    const historyResult = await executeQuery(
      `INSERT INTO user_validation_history 
       (user_id, loan_application_id, admin_id, action_type, action_details) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        userId, 
        loanApplicationId || null, 
        finalAdminId, 
        actionType, 
        JSON.stringify(actionDetails)
      ]
    );

    // Update loan application status if needed
    if (loanApplicationId) {
      let newStatus = null;
      
      switch (actionType) {
        case 'process':
          newStatus = 'disbursal';
          break;
        case 'not_process':
          newStatus = 'rejected';
          break;
        case 'cancel':
          newStatus = 'cancelled';
          break;
        // 'need_document' doesn't change status
      }

      if (newStatus) {
        await executeQuery(
          'UPDATE loan_applications SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [newStatus, loanApplicationId]
        );
      }
    }

    // Update user status if action is cancel with hold
    if (actionType === 'cancel' && actionDetails.holdUser === 'yes') {
      let userStatus = 'on_hold';
      let holdUntilDate = null;
      
      if (actionDetails.holdDuration === 'forever') {
        // User is held permanently
      } else if (actionDetails.holdDuration === 'days' && actionDetails.holdDays) {
        // Calculate hold until date
        const holdDays = parseInt(actionDetails.holdDays);
        holdUntilDate = new Date();
        holdUntilDate.setDate(holdUntilDate.getDate() + holdDays);
      }

      await executeQuery(
        `UPDATE users 
         SET status = ?, hold_until_date = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [userStatus, holdUntilDate, userId]
      );
    }

    res.json({
      status: 'success',
      message: 'Validation action submitted successfully',
      data: {
        historyId: historyResult.insertId,
        actionType,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error submitting validation action:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to submit validation action'
    });
  }
});

// Get user validation history
router.get('/history/:userId', authenticateAdmin, async (req, res) => {
  try {
    console.log('Fetching validation history for user:', req.params.userId);
    console.log('Query params:', req.query);
    
    const { userId } = req.params;
    const { loanApplicationId } = req.query;

    let query = `
      SELECT 
        uvh.id,
        uvh.action_type,
        uvh.action_details,
        uvh.status,
        uvh.created_at,
        a.name as admin_name,
        uvh.loan_application_id
      FROM user_validation_history uvh
      LEFT JOIN admins a ON uvh.admin_id = a.id
      WHERE uvh.user_id = ?
    `;
    
    const params = [userId];
    
    if (loanApplicationId) {
      query += ' AND uvh.loan_application_id = ?';
      params.push(loanApplicationId);
    }
    
    query += ' ORDER BY uvh.created_at DESC';

    console.log('Executing query:', query);
    console.log('With params:', params);

    const history = await executeQuery(query, params);
    
    console.log('Query results:', history);

    // Parse action_details JSON and format response
    const formattedHistory = history.map(item => {
      // Handle action_details - it might already be parsed by MySQL JSON column
      let details = {};
      try {
        if (typeof item.action_details === 'string') {
          details = JSON.parse(item.action_details);
        } else {
          details = item.action_details || {};
        }
      } catch (error) {
        console.error('Error parsing action_details:', error);
        details = {};
      }

      return {
        id: item.id,
        type: item.action_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        updatedBy: item.admin_name || 'Unknown Admin',
        updatedOn: new Date(item.created_at).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }),
        action: item.action_type,
        details: details,
        status: item.status,
        loanApplicationId: item.loan_application_id
      };
    });

    res.json({
      status: 'success',
      data: formattedHistory
    });

  } catch (error) {
    console.error('Error fetching validation history:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch validation history'
    });
  }
});

// Get validation status for user
router.get('/status/:userId', authenticateAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { loanApplicationId } = req.query;

    let query = `
      SELECT 
        kyc_verification,
        income_verification,
        reference_verification,
        address_verification,
        employment_verification,
        other_verification,
        kyc_percentage,
        income_percentage,
        reference_percentage,
        address_percentage,
        employment_percentage,
        other_percentage
      FROM validation_status
      WHERE user_id = ?
    `;
    
    const params = [userId];
    
    if (loanApplicationId) {
      query += ' AND loan_application_id = ?';
      params.push(loanApplicationId);
    }

    const status = await executeQuery(query, params);

    if (!status || status.length === 0) {
      // Return default status if none exists
      return res.json({
        status: 'success',
        data: {
          kyc_verification: 'pending',
          income_verification: 'pending',
          reference_verification: 'pending',
          address_verification: 'pending',
          employment_verification: 'pending',
          other_verification: 'pending',
          kyc_percentage: 0,
          income_percentage: 0,
          reference_percentage: 0,
          address_percentage: 0,
          employment_percentage: 0,
          other_percentage: 0
        }
      });
    }

    res.json({
      status: 'success',
      data: status[0]
    });

  } catch (error) {
    console.error('Error fetching validation status:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch validation status'
    });
  }
});

// Update validation status
router.put('/status/:userId', authenticateAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { 
      loanApplicationId,
      kyc_verification,
      income_verification,
      reference_verification,
      address_verification,
      employment_verification,
      other_verification,
      kyc_percentage,
      income_percentage,
      reference_percentage,
      address_percentage,
      employment_percentage,
      other_percentage
    } = req.body;

    // Check if validation status exists
    const existingStatus = await executeQuery(
      'SELECT id FROM validation_status WHERE user_id = ? AND loan_application_id = ?',
      [userId, loanApplicationId || null]
    );

    if (existingStatus && existingStatus.length > 0) {
      // Update existing status
      await executeQuery(
        `UPDATE validation_status SET
         kyc_verification = COALESCE(?, kyc_verification),
         income_verification = COALESCE(?, income_verification),
         reference_verification = COALESCE(?, reference_verification),
         address_verification = COALESCE(?, address_verification),
         employment_verification = COALESCE(?, employment_verification),
         other_verification = COALESCE(?, other_verification),
         kyc_percentage = COALESCE(?, kyc_percentage),
         income_percentage = COALESCE(?, income_percentage),
         reference_percentage = COALESCE(?, reference_percentage),
         address_percentage = COALESCE(?, address_percentage),
         employment_percentage = COALESCE(?, employment_percentage),
         other_percentage = COALESCE(?, other_percentage),
         updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND loan_application_id = ?`,
        [
          kyc_verification, income_verification, reference_verification,
          address_verification, employment_verification, other_verification,
          kyc_percentage, income_percentage, reference_percentage,
          address_percentage, employment_percentage, other_percentage,
          userId, loanApplicationId || null
        ]
      );
    } else {
      // Insert new status
      await executeQuery(
        `INSERT INTO validation_status (
         user_id, loan_application_id, kyc_verification, income_verification,
         reference_verification, address_verification, employment_verification,
         other_verification, kyc_percentage, income_percentage, reference_percentage,
         address_percentage, employment_percentage, other_percentage
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId, loanApplicationId || null,
          kyc_verification || 'pending', income_verification || 'pending',
          reference_verification || 'pending', address_verification || 'pending',
          employment_verification || 'pending', other_verification || 'pending',
          kyc_percentage || 0, income_percentage || 0, reference_percentage || 0,
          address_percentage || 0, employment_percentage || 0, other_percentage || 0
        ]
      );
    }

    res.json({
      status: 'success',
      message: 'Validation status updated successfully'
    });

  } catch (error) {
    console.error('Error updating validation status:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update validation status'
    });
  }
});

module.exports = router;
