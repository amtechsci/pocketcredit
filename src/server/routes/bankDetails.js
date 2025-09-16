const express = require('express');
const { getConnection } = require('../utils/mysqlDatabase');
const { requireAuth } = require('../middleware/session');
const router = express.Router();

// =====================================================
// BANK DETAILS MANAGEMENT
// =====================================================

// POST /api/bank-details - Save Bank Details for Loan Application
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
      account_number, 
      ifsc_code
    } = req.body;

    // Validation
    if (!application_id || !account_number || !ifsc_code) {
      return res.status(400).json({
        success: false,
        message: 'Application ID, account number, and IFSC code are required'
      });
    }

    // Validate IFSC code format
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(ifsc_code.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid IFSC code format'
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

    // Get user details for account holder name
    const [users] = await connection.execute(
      'SELECT first_name, last_name FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];
    const accountHolderName = `${user.first_name || ''} ${user.last_name || ''}`.trim();

    // Extract bank name from IFSC code (first 4 characters)
    const bankCode = ifsc_code.substring(0, 4);
    
    // Map common bank codes to bank names
    const bankNames = {
      'SBIN': 'State Bank of India',
      'HDFC': 'HDFC Bank',
      'ICIC': 'ICICI Bank',
      'AXIS': 'Axis Bank',
      'KOTK': 'Kotak Mahindra Bank',
      'PNB': 'Punjab National Bank',
      'BOFA': 'Bank of America',
      'CITI': 'Citibank',
      'HSBC': 'HSBC Bank',
      'UBI': 'Union Bank of India',
      'BOI': 'Bank of India',
      'BOB': 'Bank of Baroda',
      'CANB': 'Canara Bank',
      'INDB': 'IndusInd Bank',
      'YESB': 'Yes Bank',
      'IDFB': 'IDFC First Bank',
      'RBLB': 'RBL Bank',
      'FEDR': 'Federal Bank',
      'SIBL': 'South Indian Bank',
      'KARB': 'Karnataka Bank'
    };

    const bankName = bankNames[bankCode] || `Bank (${bankCode})`;

    // Check if bank details already exist for this loan application
    const [existingBankDetails] = await connection.execute(
      'SELECT id FROM bank_details WHERE loan_application_id = ?',
      [application_id]
    );

    let result;
    if (existingBankDetails.length > 0) {
      // Update existing bank details
      [result] = await connection.execute(
        `UPDATE bank_details 
         SET account_number = ?, ifsc_code = ?, bank_name = ?, 
             account_holder_name = ?, updated_at = CURRENT_TIMESTAMP
         WHERE loan_application_id = ?`,
        [account_number, ifsc_code.toUpperCase(), bankName, accountHolderName, application_id]
      );
    } else {
      // Insert new bank details
      [result] = await connection.execute(
        `INSERT INTO bank_details 
         (user_id, loan_application_id, bank_name, account_number, ifsc_code, 
          account_holder_name, account_type, is_primary, is_verified) 
         VALUES (?, ?, ?, ?, ?, ?, 'savings', TRUE, FALSE)`,
        [userId, application_id, bankName, account_number, ifsc_code.toUpperCase(), accountHolderName]
      );
    }

    // Get the bank details ID (either from insert or existing)
    const bankDetailsId = result.insertId || existingBankDetails[0].id;

    // Update loan application with bank_id (keep status as submitted)
    await connection.execute(
      'UPDATE loan_applications SET bank_id = ? WHERE id = ?',
      [bankDetailsId, application_id]
    );

    res.status(201).json({
      success: true,
      message: 'Bank details saved successfully',
      data: {
        bank_details_id: result.insertId || existingBankDetails[0].id,
        status: 'saved'
      }
    });

  } catch (error) {
    console.error('Bank details error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while saving bank details'
    });
  }
});

// GET /api/bank-details/:applicationId - Get Bank Details for Loan Application
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

    // Get bank details for the specific loan application
    const [bankDetails] = await connection.execute(
      `SELECT bd.*, la.application_number, la.loan_amount, la.loan_purpose
       FROM bank_details bd
       JOIN loan_applications la ON bd.loan_application_id = la.id
       WHERE bd.loan_application_id = ? AND bd.user_id = ?`,
      [applicationId, userId]
    );

    if (bankDetails.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bank details not found for this loan application'
      });
    }

    res.json({
      success: true,
      data: bankDetails[0]
    });

  } catch (error) {
    console.error('Get bank details error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching bank details'
    });
  }
});

// GET /api/bank-details/user/:userId - Get All Bank Details for User
router.get('/user/:userId', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { userId: paramUserId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Verify user can only access their own bank details
    if (parseInt(paramUserId) !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const connection = await getConnection();

    // Get all bank details for the user
    const [bankDetails] = await connection.execute(
      `SELECT bd.*, la.application_number, la.loan_amount, la.loan_purpose
       FROM bank_details bd
       LEFT JOIN loan_applications la ON bd.loan_application_id = la.id
       WHERE bd.user_id = ?
       ORDER BY bd.created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: bankDetails
    });

  } catch (error) {
    console.error('Get user bank details error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching bank details'
    });
  }
});

// POST /api/bank-details/choose - Choose Existing Bank Details for Loan Application
router.post('/choose', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { application_id, bank_details_id } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!application_id || !bank_details_id) {
      return res.status(400).json({
        success: false,
        message: 'Application ID and bank details ID are required'
      });
    }

    const connection = await getConnection();

    // Verify that the loan application belongs to the user
    const [applications] = await connection.execute(
      'SELECT id FROM loan_applications WHERE id = ? AND user_id = ?',
      [application_id, userId]
    );

    if (applications.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Loan application not found or does not belong to you'
      });
    }

    // Verify that the bank details belong to the user
    const [bankDetails] = await connection.execute(
      'SELECT id FROM bank_details WHERE id = ? AND user_id = ?',
      [bank_details_id, userId]
    );

    if (bankDetails.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bank details not found or does not belong to you'
      });
    }

    // Update loan application with chosen bank_id
    await connection.execute(
      'UPDATE loan_applications SET bank_id = ? WHERE id = ?',
      [bank_details_id, application_id]
    );

    res.json({
      success: true,
      message: 'Bank details selected successfully',
      data: {
        bank_details_id: bank_details_id,
        status: 'selected'
      }
    });

  } catch (error) {
    console.error('Choose bank details error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while selecting bank details'
    });
  }
});

module.exports = router;
