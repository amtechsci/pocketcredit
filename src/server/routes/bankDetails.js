const express = require('express');
const { executeQuery, initializeDatabase } = require('../config/database');
const { requireAuth } = require('../middleware/jwtAuth');
const { checkHoldStatus } = require('../middleware/checkHoldStatus');
const router = express.Router();

// =====================================================
// BANK DETAILS MANAGEMENT
// =====================================================

/**
 * GET /api/bank-details/enach-status
 * Check if user has e-NACH registration
 * NOTE: This route must be placed BEFORE /user/:userId to avoid route conflicts
 */
router.get('/enach-status', requireAuth, async (req, res) => {
  try {
    console.log('✅ e-NACH status route called for user:', req.userId);
    await initializeDatabase();
    const userId = req.userId;

    try {
      const existingEnach = await executeQuery(
        `SELECT id, status, bank_detail_id, created_at 
         FROM enach_registrations 
         WHERE user_id = ? 
         LIMIT 1`,
        [userId]
      );

      if (existingEnach && existingEnach.length > 0) {
        return res.json({
          success: true,
          registered: true,
          data: existingEnach[0]
        });
      }

      return res.json({
        success: true,
        registered: false
      });
    } catch (tableError) {
      // If table doesn't exist, assume no registration
      if (tableError.message && tableError.message.includes("doesn't exist")) {
        return res.json({
          success: true,
          registered: false
        });
      }
      throw tableError;
    }
  } catch (error) {
    console.error('Check e-NACH status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check e-NACH status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});
// PUT /api/bank-details/:id - Update Bank Details
router.put('/:id', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;
    const { id } = req.params;
    const { account_number, is_primary } = req.body;

    if (!account_number && is_primary === undefined) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update provided'
      });
    }

    // Verify bank detail belongs to user
    const existing = await executeQuery(
      'SELECT id FROM bank_details WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (!existing || existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bank detail not found'
      });
    }

    const updates = [];
    const values = [];

    if (account_number) {
      updates.push('account_number = ?');
      values.push(account_number);
    }

    if (is_primary !== undefined) {
      updates.push('is_primary = ?');
      values.push(is_primary);

      // If setting as primary, unset others (optional but good practice)
      if (is_primary) {
        await executeQuery(
          'UPDATE bank_details SET is_primary = FALSE WHERE user_id = ? AND id != ?',
          [userId, id]
        );
      }
    }

    values.push(new Date()); // updated_at
    values.push(id);

    await executeQuery(
      `UPDATE bank_details SET ${updates.join(', ')}, updated_at = ? WHERE id = ?`,
      values
    );

    res.json({
      success: true,
      message: 'Bank details updated successfully'
    });

  } catch (error) {
    console.error('Error updating bank details:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// POST /api/bank-details - Save Bank Details for Loan Application
router.post('/', requireAuth, checkHoldStatus, async (req, res) => {
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

    // Insert new bank details (user-level)
    const result = await executeQuery(
      'INSERT INTO bank_details (user_id, account_number, ifsc_code, bank_name, account_holder_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
      [userId, account_number, ifsc_code, bankName, accountHolderName]
    );
    const bankDetailsId = result.insertId;

    // Link the bank details to the loan application
    await executeQuery(
      'UPDATE loan_applications SET user_bank_id = ? WHERE id = ?',
      [bankDetailsId, application_id]
    );

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
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Internal server error while saving bank details',
      error: error.message
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
      `SELECT bd.*, 
              (SELECT COUNT(*) FROM loan_applications WHERE user_bank_id = bd.id) as usage_count,
              (SELECT application_number FROM loan_applications WHERE user_bank_id = bd.id ORDER BY created_at DESC LIMIT 1) as latest_application
       FROM bank_details bd
       WHERE bd.user_id = ?
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

// POST /api/bank-details/user - Save Bank Details for User (without application_id)
router.post('/user', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;

    const {
      account_number,
      ifsc_code,
      bank_name
    } = req.body;

    // Validation
    if (!account_number || !ifsc_code) {
      return res.status(400).json({
        success: false,
        message: 'Account number and IFSC code are required'
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

    // Use provided bank_name or extract from IFSC code
    let finalBankName = bank_name;
    if (!finalBankName) {
      const bankCode = ifsc_code.substring(0, 4);
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
      finalBankName = bankNames[bankCode] || `${bankCode} Bank`;
    }

    // Check if bank details already exist for this user with same account number and IFSC
    const existing = await executeQuery(
      'SELECT id FROM bank_details WHERE user_id = ? AND account_number = ? AND ifsc_code = ?',
      [userId, account_number, ifsc_code.toUpperCase()]
    );

    if (existing && existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Bank account with this account number and IFSC code already exists'
      });
    }

    // Insert new bank details (user-level, no application_id)
    const result = await executeQuery(
      'INSERT INTO bank_details (user_id, account_number, ifsc_code, bank_name, account_holder_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
      [userId, account_number, ifsc_code.toUpperCase(), finalBankName, accountHolderName]
    );
    const bankDetailsId = result.insertId;

    res.json({
      success: true,
      message: 'Bank details saved successfully',
      data: {
        id: bankDetailsId,
        user_id: userId,
        account_number,
        ifsc_code: ifsc_code.toUpperCase(),
        bank_name: finalBankName,
        account_holder_name: accountHolderName
      }
    });

  } catch (error) {
    console.error('Error saving user bank details:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while saving bank details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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

    // Link the existing bank details to the loan application
    await executeQuery(
      'UPDATE loan_applications SET user_bank_id = ? WHERE id = ?',
      [bank_details_id, application_id]
    );

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

/**
 * POST /api/bank-details/register-enach
 * Register selected bank account for e-NACH (one-time per user, first loan application)
 */
router.post('/register-enach', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;

    const { bank_detail_id } = req.body;

    // Validation
    if (!bank_detail_id) {
      return res.status(400).json({
        success: false,
        message: 'Bank detail ID is required'
      });
    }

    // Check if enach_registrations table exists
    try {
      // Check if user already has an e-NACH registration
      const existingEnach = await executeQuery(
        `SELECT id FROM enach_registrations WHERE user_id = ?`,
        [userId]
      );

      if (existingEnach && existingEnach.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'e-NACH registration already exists for this user'
        });
      }
    } catch (tableError) {
      // If table doesn't exist, log warning but continue (table will be created by migration)
      if (tableError.message && tableError.message.includes("doesn't exist")) {
        console.warn('⚠️  enach_registrations table does not exist. Please run the migration script.');
        return res.status(500).json({
          success: false,
          message: 'e-NACH registration system is not set up. Please contact support.'
        });
      }
      throw tableError;
    }

    // Get bank details
    const bankDetails = await executeQuery(
      `SELECT id, account_number, ifsc_code, bank_name, account_holder_name, account_type 
       FROM bank_details 
       WHERE id = ? AND user_id = ?`,
      [bank_detail_id, userId]
    );

    if (!bankDetails || bankDetails.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bank detail not found or does not belong to you'
      });
    }

    const bank = bankDetails[0];

    // Get or create the first loan application
    let applicationId = null;
    const applications = await executeQuery(
      `SELECT id FROM loan_applications 
       WHERE user_id = ? 
       ORDER BY created_at ASC LIMIT 1`,
      [userId]
    );

    if (applications && applications.length > 0) {
      applicationId = applications[0].id;
    } else {
      // Create a new loan application if none exists
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000);
      const application_number = `PC${timestamp}${random}`;

      const result = await executeQuery(
        `INSERT INTO loan_applications 
         (user_id, application_number, status, created_at, updated_at)
         VALUES (?, ?, 'under_review', NOW(), NOW())`,
        [userId, application_number]
      );
      applicationId = result.insertId;
    }

    // Register e-NACH (status will be 'pending' until API is integrated)
    const enachResult = await executeQuery(
      `INSERT INTO enach_registrations 
       (user_id, application_id, bank_detail_id, account_number, ifsc_code, bank_name, account_holder_name, account_type, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
      [
        userId,
        applicationId,
        bank_detail_id,
        bank.account_number,
        bank.ifsc_code,
        bank.bank_name,
        bank.account_holder_name || null,
        bank.account_type || null
      ]
    );

    // Mark this bank detail as primary/salary account
    await executeQuery(
      `UPDATE bank_details 
       SET is_primary = TRUE, updated_at = NOW() 
       WHERE id = ?`,
      [bank_detail_id]
    );

    res.json({
      success: true,
      message: 'Bank account registered for e-NACH successfully',
      data: {
        enach_id: enachResult.insertId,
        bank_detail_id: bank_detail_id,
        application_id: applicationId
      }
    });

  } catch (error) {
    console.error('Register e-NACH error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register bank account for e-NACH',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;