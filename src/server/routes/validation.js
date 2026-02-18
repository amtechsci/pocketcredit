const express = require('express');
const { authenticateAdmin } = require('../middleware/auth');
const { requireAuth } = require('../middleware/jwtAuth');
const { executeQuery, initializeDatabase } = require('../config/database');
const router = express.Router();

// Get validation options by type
router.get('/options/:type', authenticateAdmin, async (req, res) => {
  try {
    const { type } = req.params;

    if (!['need_document', 'not_process', 'process', 'cancel', 're_process', 'unhold', 'delete', 'move_to_tvr'].includes(type)) {
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

    if (!['need_document', 'not_process', 'process', 'cancel', 're_process', 'unhold', 'delete', 'move_to_tvr'].includes(type)) {
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

    if (!['need_document', 'process', 'not_process', 'cancel', 're_process', 'unhold', 'delete', 'qa_verification', 'qa_approve', 'move_to_tvr'].includes(actionType)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid action type'
      });
    }

    // Block certain actions if user has any loan in account_manager status
    const blockedActions = ['not_process', 're_process', 'delete', 'cancel', 'process', 'qa_approve'];
    if (blockedActions.includes(actionType)) {
      // Check if user has any loan with account_manager status
      const accountManagerLoans = await executeQuery(
        'SELECT id, application_number, status FROM loan_applications WHERE user_id = ? AND status = ?',
        [userId, 'account_manager']
      );

      if (accountManagerLoans && accountManagerLoans.length > 0) {
        return res.status(400).json({
          status: 'error',
          message: `Cannot perform "${actionType}" action. User has loan(s) in account_manager status. Loans in account_manager status cannot be modified.`,
          blockedLoanIds: accountManagerLoans.map(loan => loan.id)
        });
      }
    }

    // For cancel/qa_verification actions, ensure we have the loan to update
    let loanToUpdate = null;
    let actualLoanId = loanApplicationId;

    if (['cancel', 'qa_verification', 'qa_approve'].includes(actionType)) {
      // Try to find the loan to cancel
      if (loanApplicationId) {
        // Verify loan exists and get current status
        const loanCheck = await executeQuery(
          'SELECT id, status, user_id FROM loan_applications WHERE id = ?',
          [loanApplicationId]
        );

        if (loanCheck.length === 0) {
          console.error(`❌ Loan application ${loanApplicationId} not found for cancel action`);
          return res.status(404).json({
            status: 'error',
            message: `Loan application with ID ${loanApplicationId} not found`
          });
        }

        const currentLoan = loanCheck[0];

        // Verify loan belongs to the user
        if (currentLoan.user_id !== userId) {
          console.error(`❌ Loan ${loanApplicationId} does not belong to user ${userId}`);
          return res.status(403).json({
            status: 'error',
            message: 'Loan application does not belong to this user'
          });
        }

        // Block cancellation if loan is in account_manager status
        if (currentLoan.status === 'account_manager') {
          return res.status(400).json({
            status: 'error',
            message: 'Cannot cancel loan. Loan is in account_manager status and cannot be modified.'
          });
        }

        // Block cancellation if loan is already cancelled
        if (currentLoan.status === 'cancelled') {
          return res.status(400).json({
            status: 'error',
            message: 'Loan is already cancelled'
          });
        }

        loanToUpdate = currentLoan;
      } else {
        // If no loanApplicationId provided, try to find active loan for user
        const activeLoans = await executeQuery(
          `SELECT id, status FROM loan_applications 
           WHERE user_id = ? 
           AND status IN ('submitted', 'under_review', 'follow_up', 'approved', 'disbursal', 'ready_for_disbursement', 'ready_to_repeat_disbursal', 'repeat_disbursal', 'qa_verification')
           ORDER BY created_at DESC
           LIMIT 1`,
          [userId]
        );

        if (activeLoans.length > 0) {
          const foundLoan = activeLoans[0];

          // Block cancellation if loan is in account_manager status (though shouldn't be in the query)
          if (foundLoan.status === 'account_manager') {
            return res.status(400).json({
              status: 'error',
              message: 'Cannot cancel loan. Loan is in account_manager status and cannot be modified.'
            });
          }

          if (foundLoan.status === 'cancelled') {
            return res.status(400).json({
              status: 'error',
              message: 'Loan is already cancelled'
            });
          }

          loanToUpdate = foundLoan;
          actualLoanId = foundLoan.id;
        } else {
          console.warn(`⚠️ Cancel action requested but no active loan found for user ${userId}`);
          // Continue - might just be updating user status
        }
      }
    }

    // Insert validation history record
    const historyResult = await executeQuery(
      `INSERT INTO user_validation_history 
       (user_id, loan_application_id, admin_id, action_type, action_details) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        userId,
        actualLoanId || null,
        finalAdminId,
        actionType,
        JSON.stringify(actionDetails)
      ]
    );

    // Update loan application status if needed
    let loanUpdateSuccess = false;
    let loanUpdateMessage = '';

    if (loanApplicationId || loanToUpdate) {
      let newStatus = null;

      switch (actionType) {
        case 'need_document':
          newStatus = 'follow_up';
          break;
        case 'process':
        case 'qa_approve':
          newStatus = 'disbursal';
          break;
        case 'not_process':
          newStatus = 'rejected';
          break;
        case 'cancel':
        case 're_process':
          newStatus = 'cancelled';
          break;
        case 'qa_verification':
          newStatus = 'qa_verification';
          break;
      }

      if (newStatus) {
        const targetLoanId = actualLoanId || loanApplicationId;

        if (targetLoanId) {
          // Update loan status
          const updateResult = await executeQuery(
            'UPDATE loan_applications SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [newStatus, targetLoanId]
          );

          const affectedRows = updateResult?.affectedRows || (typeof updateResult === 'number' ? updateResult : 0);

          if (affectedRows > 0) {
            loanUpdateSuccess = true;
            const oldStatus = loanToUpdate?.status || 'unknown';
            loanUpdateMessage = `Loan ${targetLoanId} status updated from ${oldStatus} to ${newStatus}`;
            console.log(`✅ Successfully updated loan ${targetLoanId} status from ${oldStatus} to ${newStatus} (${affectedRows} row(s) affected)`);
            if (newStatus === 'qa_verification') {
              try {
                const { assignQAUserForLoan } = require('../services/adminAssignmentService');
                await assignQAUserForLoan(targetLoanId);
              } catch (err) {
                console.error('Assign QA user for loan failed:', err);
              }
            }
          } else {
            loanUpdateMessage = `Failed to update loan ${targetLoanId} status. No rows were affected.`;
            console.error(`❌ ${loanUpdateMessage}`);
            console.error(`   Target loan ID: ${targetLoanId}, New status: ${newStatus}`);
          }
        }
      }
    }

    // Handle different action types for user status updates
    if (actionType === 'cancel' && actionDetails.holdUser === 'yes') {
      // Cancel with hold (existing logic)
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
      
      // When user is put on hold via cancel action, cancel ALL their active loans (not just the one being cancelled)
      const cancellableStatuses = ['submitted', 'under_review', 'follow_up', 'approved', 'disbursal', 'ready_for_disbursement', 'ready_to_repeat_disbursal', 'repeat_disbursal', 'qa_verification'];
      const allActiveLoans = await executeQuery(
        `SELECT id, status, application_number FROM loan_applications 
         WHERE user_id = ? 
         AND status IN (${cancellableStatuses.map(() => '?').join(',')})
         AND status != 'account_manager' 
         AND status != 'overdue'
         AND status != 'cleared'
         AND status != 'cancelled'`,
        [userId, ...cancellableStatuses]
      );
      
      if (allActiveLoans && allActiveLoans.length > 0) {
        for (const loan of allActiveLoans) {
          // Skip if this loan is already being cancelled in the current action
          if (loan.id !== actualLoanId && loan.id !== loanApplicationId) {
            await executeQuery(
              `UPDATE loan_applications 
               SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP 
               WHERE id = ?`,
              [loan.id]
            );
            console.log(`✅ Auto-cancelled loan #${loan.id} (${loan.application_number}) - User put on hold via cancel action`);
          }
        }
        const otherLoansCount = allActiveLoans.filter(l => l.id !== actualLoanId && l.id !== loanApplicationId).length;
        if (otherLoansCount > 0) {
          console.log(`✅ Auto-cancelled ${otherLoansCount} additional loan(s) for user ${userId} due to hold status`);
        }
      }
    } else if (actionType === 'not_process') {
      // Not process: Hold permanently (lifetime hold)
      await executeQuery(
        `UPDATE users 
         SET status = 'on_hold', hold_until_date = NULL, application_hold_reason = 'Profile temporarily locked', updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [userId]
      );
      console.log(`✅ User ${userId} marked as NOT PROCESS (permanent hold)`);
      
      // Automatically cancel all active/submitted loans for this user
      const cancellableStatuses = ['submitted', 'under_review', 'follow_up', 'approved', 'disbursal', 'ready_for_disbursement', 'ready_to_repeat_disbursal', 'repeat_disbursal', 'qa_verification'];
      const activeLoans = await executeQuery(
        `SELECT id, status, application_number FROM loan_applications 
         WHERE user_id = ? 
         AND status IN (${cancellableStatuses.map(() => '?').join(',')})
         AND status != 'account_manager' 
         AND status != 'overdue'
         AND status != 'cleared'`,
        [userId, ...cancellableStatuses]
      );
      
      if (activeLoans && activeLoans.length > 0) {
        for (const loan of activeLoans) {
          await executeQuery(
            `UPDATE loan_applications 
             SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP 
             WHERE id = ?`,
            [loan.id]
          );
          console.log(`✅ Auto-cancelled loan #${loan.id} (${loan.application_number}) - User put on hold`);
        }
        console.log(`✅ Auto-cancelled ${activeLoans.length} loan(s) for user ${userId} due to hold status`);
      }
    } else if (actionType === 're_process') {
      // Re-process: Hold for 45 days (cooling period)
      const holdUntilDate = new Date();
      holdUntilDate.setDate(holdUntilDate.getDate() + 45);

      await executeQuery(
        `UPDATE users 
         SET status = 'on_hold', hold_until_date = ?, application_hold_reason = 'Profile under cooling period', updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [holdUntilDate, userId]
      );
      console.log(`✅ User ${userId} marked as RE-PROCESS (45-day hold until ${holdUntilDate.toISOString()})`);
      
      // Automatically cancel all active/submitted loans for this user
      const cancellableStatuses = ['submitted', 'under_review', 'follow_up', 'approved', 'disbursal', 'ready_for_disbursement', 'ready_to_repeat_disbursal', 'repeat_disbursal', 'qa_verification'];
      const activeLoans = await executeQuery(
        `SELECT id, status, application_number FROM loan_applications 
         WHERE user_id = ? 
         AND status IN (${cancellableStatuses.map(() => '?').join(',')})
         AND status != 'account_manager' 
         AND status != 'overdue'
         AND status != 'cleared'`,
        [userId, ...cancellableStatuses]
      );
      
      if (activeLoans && activeLoans.length > 0) {
        for (const loan of activeLoans) {
          await executeQuery(
            `UPDATE loan_applications 
             SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP 
             WHERE id = ?`,
            [loan.id]
          );
          console.log(`✅ Auto-cancelled loan #${loan.id} (${loan.application_number}) - User put on hold`);
        }
        console.log(`✅ Auto-cancelled ${activeLoans.length} loan(s) for user ${userId} due to hold status`);
      }
    } else if (actionType === 'unhold') {
      // Unhold: Move from hold to active status
      await executeQuery(
        `UPDATE users 
         SET status = 'active', hold_until_date = NULL, application_hold_reason = NULL, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [userId]
      );
      console.log(`✅ User ${userId} UNHOLD - moved to active status`);
    } else if (actionType === 'delete') {
      // Delete: Mark user as deleted and purge data (except primary number, PAN, Aadhar, loan data)
      // First, mark user as deleted
      await executeQuery(
        `UPDATE users 
         SET status = 'deleted', updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [userId]
      );
      console.log(`✅ User ${userId} marked as DELETED`);


      // Get user's primary phone and PAN before deletion
      const userData = await executeQuery(
        `SELECT phone, pan_number FROM users WHERE id = ?`,
        [userId]
      );

      const primaryPhone = userData[0]?.phone || null;
      const panNumber = userData[0]?.pan_number || null;

      // Delete user data except primary number, PAN, Aadhar, and loan data
      // Note: Aadhaar is stored in verification_records table, so we'll preserve those records
      // Wrap each delete in try-catch to handle missing tables gracefully

      const deleteOperations = [
        { query: `DELETE FROM addresses WHERE user_id = ?`, name: 'addresses' },
        { query: `DELETE FROM bank_details WHERE user_id = ?`, name: 'bank_details' },
        { query: `DELETE FROM \`references\` WHERE user_id = ?`, name: 'references' },
        { query: `DELETE FROM student_documents WHERE user_id = ?`, name: 'student_documents' },
        { query: `DELETE FROM kyc_verifications WHERE user_id = ?`, name: 'kyc_verifications' },
        { query: `DELETE FROM user_notes WHERE user_id = ?`, name: 'user_notes' },
        { query: `DELETE FROM user_follow_ups WHERE user_id = ?`, name: 'user_follow_ups' },
        { query: `DELETE FROM user_bank_statements WHERE user_id = ?`, name: 'user_bank_statements' }
      ];

      for (const operation of deleteOperations) {
        try {
          await executeQuery(operation.query, [userId]);
          console.log(`✅ Deleted from ${operation.name} for user ${userId}`);
        } catch (error) {
          // Ignore errors if table doesn't exist
          if (error.code === 'ER_NO_SUCH_TABLE') {
            console.log(`ℹ️ Table ${operation.name} doesn't exist, skipping...`);
          } else {
            console.error(`⚠️ Error deleting from ${operation.name}:`, error.message);
            // Continue with other deletions even if one fails
          }
        }
      }

      // Delete verification records EXCEPT PAN and Aadhaar (keep these as per requirements)
      try {
        await executeQuery(
          `DELETE FROM verification_records WHERE user_id = ? AND document_type NOT IN ('pan', 'aadhaar', 'aadhar')`,
          [userId]
        );
        console.log(`✅ Deleted verification records (except PAN/Aadhaar) for user ${userId}`);
      } catch (error) {
        if (error.code === 'ER_NO_SUCH_TABLE') {
          console.log(`ℹ️ Table verification_records doesn't exist, skipping...`);
        } else {
          console.error(`⚠️ Error deleting verification records:`, error.message);
        }
      }

      // Clear user profile data but keep primary identifiers
      // Only update columns that exist in the users table
      try {
        await executeQuery(
          `UPDATE users 
           SET first_name = NULL, last_name = NULL, email = NULL, 
               date_of_birth = NULL, gender = NULL, marital_status = NULL,
               employment_type = NULL, company_name = NULL,
               monthly_net_income = NULL, work_experience_range = NULL, profile_completion_step = 0,
               graduation_status = NULL, loan_limit = 0, credit_score = NULL,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [userId]
        );
        console.log(`✅ Cleared user profile data for user ${userId}`);
      } catch (error) {
        console.error(`⚠️ Error clearing user profile data:`, error.message);
        // Continue even if some columns don't exist
      }
    } else if (actionType === 'qa_verification') {
      // QA Verification
      await executeQuery(
        `UPDATE users 
       SET status = 'qa_verification', updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
        [userId]
      );
      console.log(`✅ User ${userId} marked as QA VERIFICATION`);
    } else if (actionType === 'qa_approve') {
      // QA Approve: Move to disbursal (handled above) and ensure user is active
      await executeQuery(
        `UPDATE users 
         SET status = 'active', updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [userId]
      );
      console.log(`✅ User ${userId} marked as ACTIVE (QA Approved)`);
    } else if (actionType === 'move_to_tvr') {
      // Move to TVR: Mark user as moved to TVR
      await executeQuery(
        `UPDATE users 
         SET moved_to_tvr = 1, moved_to_tvr_at = NOW(), moved_to_tvr_by = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [finalAdminId, userId]
      );
      console.log(`✅ User ${userId} moved to TVR by admin ${finalAdminId}`);
    }

    // Build response message
    let responseMessage = 'Validation action submitted successfully';
    if (actionType === 'cancel') {
      if (loanUpdateSuccess) {
        responseMessage = 'Loan cancelled successfully';
      } else if (loanUpdateMessage) {
        responseMessage = `Validation action submitted, but ${loanUpdateMessage.toLowerCase()}`;
      } else {
        responseMessage = 'Validation action submitted. No active loan found to cancel.';
      }
    }

    res.json({
      status: 'success',
      message: responseMessage,
      data: {
        historyId: historyResult.insertId,
        actionType,
        timestamp: new Date().toISOString(),
        loanUpdateSuccess,
        loanUpdateMessage: loanUpdateMessage || null
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

// Get user validation history (admin only)
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

// Get user's own validation history (user-facing endpoint)
router.get('/user/history', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;
    const { loanApplicationId } = req.query;

    let query = `
      SELECT 
        uvh.id,
        uvh.action_type,
        uvh.action_details,
        uvh.status,
        uvh.created_at,
        uvh.loan_application_id
      FROM user_validation_history uvh
      WHERE uvh.user_id = ?
    `;

    const params = [userId];

    if (loanApplicationId) {
      query += ' AND uvh.loan_application_id = ?';
      params.push(loanApplicationId);
    }

    query += ' ORDER BY uvh.created_at DESC';

    const history = await executeQuery(query, params);

    // Parse action_details JSON and format response
    const formattedHistory = history.map(item => {
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
        action_type: item.action_type,
        action_details: details,
        status: item.status,
        created_at: item.created_at,
        loan_application_id: item.loan_application_id
      };
    });

    res.json({
      status: 'success',
      data: formattedHistory
    });

  } catch (error) {
    console.error('Error fetching user validation history:', error);
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
