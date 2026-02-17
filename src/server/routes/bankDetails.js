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
 * Check if user has e-NACH subscription (using Cashfree subscriptions)
 * NOTE: This route must be placed BEFORE /user/:userId to avoid route conflicts
 */
router.get('/enach-status', requireAuth, async (req, res) => {
  try {
    console.log('✅ e-NACH status route called for user:', req.userId);
    await initializeDatabase();
    const userId = req.userId;

    try {
      // Check for active eNACH subscriptions using the new Cashfree system
      const existingEnach = await executeQuery(
        `SELECT es.subscription_id, es.cf_subscription_id, es.status, es.mandate_status, 
                es.loan_application_id, es.created_at, es.activated_at
         FROM enach_subscriptions es
         INNER JOIN loan_applications la ON es.loan_application_id = la.id
         WHERE la.user_id = ? 
           AND es.status IN ('ACTIVE', 'BANK_APPROVAL_PENDING', 'INITIALIZED')
         ORDER BY es.created_at DESC
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

    // Update loan application step to references (keep status as submitted - user needs to complete references first)
    // Status will be set to 'submitted' for admin review AFTER references are saved
    await executeQuery(
      'UPDATE loan_applications SET current_step = ?, updated_at = NOW() WHERE id = ?',
      ['references', application_id]
    );
    console.log(`✅ Updated loan application ${application_id} step to 'references' - user needs to complete references`);

    // Trigger automatic event-based SMS (bank_linked)
    try {
      const { triggerEventSMS } = require('../utils/eventSmsTrigger');
      // Get last 4 digits of account number for masking
      const maskedAccount = account_number.length > 4 
        ? `****${account_number.slice(-4)}` 
        : '****';
      await triggerEventSMS('bank_linked', {
        userId: userId,
        loanId: application_id,
        variables: {
          bank_name: bankName,
          account_number: maskedAccount
        }
      });
    } catch (smsError) {
      console.error('❌ Error sending bank_linked SMS (non-fatal):', smsError);
      // Don't fail - SMS failure shouldn't block bank linking
    }

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

    // Verify that the loan application belongs to the user and get user_bank_id
    const applications = await executeQuery(
      'SELECT id, user_id, user_bank_id FROM loan_applications WHERE id = ? AND user_id = ?',
      [applicationId, userId]
    );

    if (!applications || applications.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Loan application not found or does not belong to you'
      });
    }

    const application = applications[0];
    
    // Bank details are user-level, not application-level
    // If application has user_bank_id, get that specific bank detail
    // Otherwise, get the user's primary bank detail or most recent
    let bankDetails;
    
    if (application.user_bank_id) {
      // Application has a linked bank - get that specific one
      bankDetails = await executeQuery(
        'SELECT * FROM bank_details WHERE id = ? AND user_id = ?',
        [application.user_bank_id, userId]
      );
    } else {
      // No linked bank - get user's primary bank or most recent
      bankDetails = await executeQuery(
        'SELECT * FROM bank_details WHERE user_id = ? ORDER BY is_primary DESC, created_at DESC LIMIT 1',
        [userId]
      );
    }

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
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      sql: error.sql,
      sqlState: error.sqlState,
      applicationId,
      userId
    });
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching bank details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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

    // Trigger automatic event-based SMS (bank_linked)
    try {
      const { triggerEventSMS } = require('../utils/eventSmsTrigger');
      // Get last 4 digits of account number for masking
      const maskedAccount = account_number.length > 4 
        ? `****${account_number.slice(-4)}` 
        : '****';
      await triggerEventSMS('bank_linked', {
        userId: userId,
        variables: {
          bank_name: finalBankName,
          account_number: maskedAccount
        }
      });
    } catch (smsError) {
      console.error('❌ Error sending bank_linked SMS (non-fatal):', smsError);
      // Don't fail - SMS failure shouldn't block bank linking
    }

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
      'SELECT id, user_id, user_bank_id FROM loan_applications WHERE id = ? AND user_id = ?',
      [application_id, userId]
    );

    if (!applications || applications.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Loan application not found or does not belong to you'
      });
    }

    // Verify that the bank details belong to the user
    const bankDetails = await executeQuery(
      'SELECT * FROM bank_details WHERE id = ? AND user_id = ?',
      [bank_details_id, userId]
    );

    if (!bankDetails || bankDetails.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bank details not found or does not belong to you'
      });
    }

    const bankDetail = bankDetails[0];

    // Link the existing bank details to the loan application
    await executeQuery(
      'UPDATE loan_applications SET user_bank_id = ?, updated_at = NOW() WHERE id = ?',
      [bank_details_id, application_id]
    );

    // Verify the update by fetching the complete application data
    const verifyApp = await executeQuery(
      'SELECT id, user_id, user_bank_id, current_step FROM loan_applications WHERE id = ?',
      [application_id]
    );
    
    if (!verifyApp || verifyApp.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'Failed to verify bank details update'
      });
    }

    const updatedApplication = verifyApp[0];
    console.log(`✅ Bank details linked: application ${application_id} -> bank_details ${bank_details_id}, user_bank_id = ${updatedApplication.user_bank_id}`);

    // Update loan application step to references if not already set
    if (updatedApplication.current_step === 'bank-details') {
      await executeQuery(
        'UPDATE loan_applications SET current_step = ?, updated_at = NOW() WHERE id = ?',
        ['references', application_id]
      );
      console.log(`✅ Updated loan application ${application_id} step to 'references'`);
    }

    res.json({
      success: true,
      message: 'Bank details applied successfully',
      data: {
        application_id,
        bank_details_id,
        user_bank_id: updatedApplication.user_bank_id,
        application: {
          id: updatedApplication.id,
          user_bank_id: updatedApplication.user_bank_id,
          current_step: updatedApplication.current_step
        }
      }
    });

  } catch (error) {
    console.error('Error choosing bank details:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      sql: error.sql,
      sqlState: error.sqlState
    });
    res.status(500).json({
      success: false,
      message: 'Internal server error while choosing bank details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/bank-details/register-enach
 * DEPRECATED: This endpoint is no longer used.
 * e-NACH registration is now handled through Cashfree subscriptions via /api/enach/create-subscription
 * This endpoint is kept for backward compatibility but returns an error.
 */
router.post('/register-enach', requireAuth, async (req, res) => {
  res.status(410).json({
    success: false,
    message: 'This endpoint is deprecated. Please use the Cashfree eNACH subscription flow instead.',
    deprecated: true,
    newEndpoint: '/api/enach/create-subscription'
  });
});

module.exports = router;