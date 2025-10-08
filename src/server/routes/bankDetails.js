const express = require('express');
const { executeQuery, initializeDatabase } = require('../config/database');
const { requireAuth } = require('../middleware/jwtAuth');
const router = express.Router();

// =====================================================
// BANK DETAILS MANAGEMENT
// =====================================================

// POST /api/bank-details - Save Bank Details for Loan Application
router.post('/', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;

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

    // Get user details for account holder name
    const users = await executeQuery(
      'SELECT first_name, last_name FROM users WHERE id = ?',
      [userId]
    );

    if (!users || users.length === 0) {
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
      'FDRL': 'Federal Bank',
      'IDFB': 'IDFC First Bank',
      'RATN': 'RBL Bank',
      'BAND': 'Bandhan Bank',
      'DCBL': 'DCB Bank'
    };

    const bankName = bankNames[bankCode] || `${bankCode} Bank`;

    // Check if bank details already exist for this application
    const existingBankDetails = await executeQuery(
      'SELECT id FROM bank_details WHERE loan_application_id = ?',
      [application_id]
    );

    let bankDetailsId;

    if (existingBankDetails && existingBankDetails.length > 0) {
      // Update existing bank details
      await executeQuery(
        'UPDATE bank_details SET account_number = ?, ifsc_code = ?, bank_name = ?, account_holder_name = ?, updated_at = NOW() WHERE loan_application_id = ?',
        [account_number, ifsc_code, bankName, accountHolderName, application_id]
      );
      bankDetailsId = existingBankDetails[0].id;
    } else {
      // Insert new bank details
      const result = await executeQuery(
        'INSERT INTO bank_details (loan_application_id, account_number, ifsc_code, bank_name, account_holder_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
        [application_id, account_number, ifsc_code, bankName, accountHolderName]
      );
      bankDetailsId = result.insertId;
    }

    // Update loan application status and step
    await executeQuery(
      'UPDATE loan_applications SET status = ?, current_step = ? WHERE id = ?',
      ['under_review', 'references', application_id]
    );

    res.json({
      success: true,
      message: 'Bank details saved successfully',
      data: {
        id: bankDetailsId,
        application_id,
        account_number,
        ifsc_code,
        bank_name: bankName,
        account_holder_name: accountHolderName
      }
    });

  } catch (error) {
    console.error('Error saving bank details:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while saving bank details'
    });
  }
});

// GET /api/bank-details/:applicationId - Get Bank Details for Loan Application
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

    const bankDetails = await executeQuery(
      'SELECT * FROM bank_details WHERE loan_application_id = ? ORDER BY created_at DESC LIMIT 1',
      [applicationId]
    );

    if (!bankDetails || bankDetails.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bank details not found for this application'
      });
    }

    res.json({
      success: true,
      data: bankDetails[0]
    });

  } catch (error) {
    console.error('Error fetching bank details:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching bank details'
    });
  }
});

// GET /api/bank-details/user/:userId - Get All Bank Details for User
router.get('/user/:userId', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;
    const { userId: paramUserId } = req.params;

    // Verify that the user is accessing their own data
    if (userId !== parseInt(paramUserId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const bankDetails = await executeQuery(
      `SELECT bd.*, la.application_number, la.loan_amount, la.status as application_status
       FROM bank_details bd
       JOIN loan_applications la ON bd.loan_application_id = la.id
       WHERE la.user_id = ?
       ORDER BY bd.created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: bankDetails || []
    });

  } catch (error) {
    console.error('Error fetching user bank details:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching bank details'
    });
  }
});

// POST /api/bank-details/choose - Choose Existing Bank Details for Loan Application
router.post('/choose', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;
    const { application_id, bank_details_id } = req.body;

    if (!application_id || !bank_details_id) {
      return res.status(400).json({
        success: false,
        message: 'Application ID and bank details ID are required'
      });
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

    // Get the bank details to copy
    const bankDetails = await executeQuery(
      'SELECT * FROM bank_details WHERE id = ?',
      [bank_details_id]
    );

    if (!bankDetails || bankDetails.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bank details not found'
      });
    }

    const bankDetail = bankDetails[0];

    // Check if bank details already exist for this application
    const existingBankDetails = await executeQuery(
      'SELECT id FROM bank_details WHERE loan_application_id = ?',
      [application_id]
    );

    let result;

    if (existingBankDetails && existingBankDetails.length > 0) {
      // Update existing bank details
      result = await executeQuery(
        'UPDATE bank_details SET account_number = ?, ifsc_code = ?, bank_name = ?, account_holder_name = ?, updated_at = NOW() WHERE loan_application_id = ?',
        [bankDetail.account_number, bankDetail.ifsc_code, bankDetail.bank_name, bankDetail.account_holder_name, application_id]
      );
    } else {
      // Insert new bank details
      result = await executeQuery(
        'INSERT INTO bank_details (loan_application_id, account_number, ifsc_code, bank_name, account_holder_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
        [application_id, bankDetail.account_number, bankDetail.ifsc_code, bankDetail.bank_name, bankDetail.account_holder_name]
      );
    }

    res.json({
      success: true,
      message: 'Bank details applied successfully',
      data: {
        application_id,
        bank_details_id
      }
    });

  } catch (error) {
    console.error('Error choosing bank details:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while choosing bank details'
    });
  }
});

module.exports = router;