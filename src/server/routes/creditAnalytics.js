const express = require('express');
const { executeQuery, initializeDatabase } = require('../config/database');
const { requireAuth } = require('../middleware/jwtAuth');
const creditAnalyticsService = require('../services/creditAnalyticsService');

const router = express.Router();

/**
 * POST /api/credit-analytics/check
 * Perform credit check for a user (one-time check)
 */
router.post('/check', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;

    // Check if credit check already exists for this user
    const existingCheck = await executeQuery(
      'SELECT id, credit_score, is_eligible, checked_at FROM credit_checks WHERE user_id = ?',
      [userId]
    );

    if (existingCheck.length > 0) {
      return res.json({
        status: 'success',
        message: 'Credit check already performed',
        data: {
          already_checked: true,
          credit_score: existingCheck[0].credit_score,
          is_eligible: existingCheck[0].is_eligible,
          checked_at: existingCheck[0].checked_at
        }
      });
    }

    // Get user details for credit check
    const user = await executeQuery(
      'SELECT first_name, last_name, phone, email, pan_number, date_of_birth FROM users WHERE id = ?',
      [userId]
    );

    if (!user || user.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    const userData = user[0];

    // If PAN or DOB not in users table, try to get from digitap_responses (pre-fill data)
    if (!userData.pan_number || !userData.date_of_birth) {
      const digitapData = await executeQuery(
        'SELECT response_data FROM digitap_responses WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
        [userId]
      );

      if (digitapData && digitapData.length > 0 && digitapData[0].response_data) {
        const prefillData = typeof digitapData[0].response_data === 'string' 
          ? JSON.parse(digitapData[0].response_data) 
          : digitapData[0].response_data;

        // Use pre-fill data if available
        if (!userData.pan_number && prefillData.pan) {
          userData.pan_number = prefillData.pan;
        }
        if (!userData.date_of_birth && prefillData.dob) {
          userData.date_of_birth = prefillData.dob;
        }
      }
    }

    // Validate required fields after checking digitap data
    if (!userData.pan_number || !userData.date_of_birth) {
      return res.status(400).json({
        status: 'error',
        message: 'PAN and Date of Birth are required for credit check. Please complete your profile first.'
      });
    }

    // Request credit report from Experian
    const clientRefNum = `PC${userId}_${Date.now()}`;
    
    // Normalize email - treat placeholder values as empty
    const placeholderEmails = ['N/A', 'NA', 'n/a', 'na', 'NONE', 'none', 'NULL', 'null', ''];
    const normalizedEmail = userData.email && !placeholderEmails.includes(userData.email.trim().toUpperCase())
      ? userData.email
      : null;
    
    // Use default email if normalized email is null/empty
    const emailForRequest = normalizedEmail || `user${userId}@pocketcredit.in`;
    
    const creditReportResponse = await creditAnalyticsService.requestCreditReport({
      client_ref_num: clientRefNum,
      mobile_no: userData.phone,
      first_name: userData.first_name || 'User',
      last_name: userData.last_name || '',
      date_of_birth: userData.date_of_birth, // YYYY-MM-DD
      email: emailForRequest,
      pan: userData.pan_number,
      device_ip: req.ip || '192.168.1.1'
    });

    // Validate eligibility
    const validation = creditAnalyticsService.validateEligibility(creditReportResponse);

    // Save credit check to database (one-time per user)
    await executeQuery(
      `INSERT INTO credit_checks (
        user_id, request_id, client_ref_num, 
        credit_score, result_code, api_message, 
        is_eligible, rejection_reasons,
        has_settlements, has_writeoffs, has_suit_files, has_wilful_default,
        negative_indicators, full_report
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        creditReportResponse.request_id,
        clientRefNum,
        validation.creditScore,
        creditReportResponse.result_code,
        creditReportResponse.message,
        validation.isEligible,
        validation.reasons.length > 0 ? JSON.stringify(validation.reasons) : null,
        validation.negativeIndicators.hasSettlements,
        validation.negativeIndicators.hasWriteOffs,
        validation.negativeIndicators.hasSuitFiles,
        validation.negativeIndicators.hasWilfulDefault,
        JSON.stringify(validation.negativeIndicators),
        JSON.stringify(creditReportResponse)
      ]
    );

    // If not eligible, update user profile to on_hold
    if (!validation.isEligible) {
      const holdReason = `Credit check failed: ${validation.reasons.join(', ')}`;
      const holdDuration = 60; // 60 days hold

      await executeQuery(
        `UPDATE users 
         SET on_hold = TRUE, 
             hold_reason = ?, 
             hold_until = DATE_ADD(NOW(), INTERVAL ? DAY)
         WHERE id = ?`,
        [holdReason, holdDuration, userId]
      );
    }

    res.json({
      status: 'success',
      message: validation.isEligible ? 'Credit check passed' : 'Credit check failed',
      data: {
        is_eligible: validation.isEligible,
        credit_score: validation.creditScore,
        reasons: validation.reasons,
        request_id: creditReportResponse.request_id
      }
    });

  } catch (error) {
    console.error('Credit check error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to perform credit check',
      error: error.message
    });
  }
});

/**
 * GET /api/credit-analytics/status
 * Check if credit check is already performed for the current user
 */
router.get('/status', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;

    // Check if credit check exists for this user
    const creditCheck = await executeQuery(
      'SELECT id, credit_score, is_eligible, checked_at FROM credit_checks WHERE user_id = ?',
      [userId]
    );

    res.json({
      status: 'success',
      message: 'Credit check status retrieved',
      data: {
        completed: creditCheck.length > 0,
        credit_score: creditCheck.length > 0 ? creditCheck[0].credit_score : null,
        is_eligible: creditCheck.length > 0 ? creditCheck[0].is_eligible : null,
        checked_at: creditCheck.length > 0 ? creditCheck[0].checked_at : null
      }
    });

  } catch (error) {
    console.error('Credit check status error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to check credit status',
      error: error.message
    });
  }
});

module.exports = router;

