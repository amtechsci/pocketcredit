const express = require('express');
const router = express.Router();
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken } = require('../middleware/auth');
const { executeQuery, initializeDatabase } = require('../config/database');

// Cashfree API configuration
const CASHFREE_API_BASE = process.env.CASHFREE_API_BASE || 'https://sandbox.cashfree.com/pg';
const CASHFREE_CLIENT_ID = process.env.CASHFREE_CLIENT_ID;
const CASHFREE_CLIENT_SECRET = process.env.CASHFREE_CLIENT_SECRET;
const CASHFREE_API_VERSION = process.env.CASHFREE_API_VERSION || '2025-01-01';

// Helper to create Cashfree headers
const getCashfreeHeaders = () => ({
    'Content-Type': 'application/json',
    'x-api-version': CASHFREE_API_VERSION,
    'x-client-id': CASHFREE_CLIENT_ID,
    'x-client-secret': CASHFREE_CLIENT_SECRET,
    'x-request-id': uuidv4(),
    'x-idempotency-key': uuidv4(),
});

/**
 * POST /api/enach/create-subscription
 * Create eNACH subscription for loan application
 */
router.post('/create-subscription', authenticateToken, async (req, res) => {
    try {
        await initializeDatabase();
        const userId = req.user.id;
        const { applicationId } = req.body;

        if (!applicationId) {
            return res.status(400).json({
                success: false,
                message: 'Application ID is required'
            });
        }

        // Fetch loan application details with all email fields
        const loanQuery = `
      SELECT 
        la.*,
        u.first_name,
        u.last_name,
        u.email,
        u.personal_email,
        u.official_email,
        u.phone
      FROM loan_applications la
      JOIN users u ON la.user_id = u.id
      WHERE la.id = ? AND la.user_id = ?
    `;

        const loans = await executeQuery(loanQuery, [applicationId, userId]);

        if (!loans || loans.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Loan application not found'
            });
        }

        const loan = loans[0];
        
        // Get email - use personal_email, official_email, or email (in that priority order)
        const customerEmail = loan.personal_email || loan.official_email || loan.email;
        
        if (!customerEmail) {
            return res.status(400).json({
                success: false,
                message: 'Customer email is required. Please update your email in profile settings.'
            });
        }

        // Fetch primary bank details
        const bankQuery = `
      SELECT * FROM bank_details
      WHERE user_id = ? AND is_primary = 1
      ORDER BY updated_at DESC
      LIMIT 1
    `;

        const banks = await executeQuery(bankQuery, [userId]);

        if (!banks || banks.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No primary bank account found. Please link your bank account first.'
            });
        }

        const bank = banks[0];

        // Create or use existing plan
        // For simplicity, we'll create a plan per loan (or you can use a fixed plan ID)
        const planId = `plan_loan_${applicationId}_${Date.now()}`;
        const subscriptionId = `sub_loan_${applicationId}_${Date.now()}`;

        // Step 1: Create Plan (if needed - you might want to use a pre-created plan)
        const planPayload = {
            plan_id: planId,
            plan_name: `Loan Repayment Plan - ${loan.application_number}`,
            plan_type: 'PERIODIC',
            plan_currency: 'INR',
            plan_recurring_amount: parseFloat(loan.emi_amount || loan.loan_amount),
            plan_max_amount: parseFloat(loan.emi_amount || loan.loan_amount),
            plan_max_cycles: parseInt(loan.tenure_months) || 12,
            plan_intervals: 1,
            plan_interval_type: 'MONTH',
            plan_note: `Monthly EMI payment for loan ${loan.application_number}`
        };

        let planResponse;
        try {
            planResponse = await axios.post(
                `${CASHFREE_API_BASE}/plans`,  // Correct endpoint: /plans not /subscriptions/plans
                planPayload,
                { headers: getCashfreeHeaders() }
            );
            console.log('Plan created:', planResponse.data);
        } catch (planError) {
            console.error('Error creating plan:', planError.response?.data || planError.message);
            // Continue with subscription creation even if plan already exists
        }

        // Step 2: Create Subscription
        const subscriptionPayload = {
            subscription_id: subscriptionId,
            customer_details: {
                customer_name: `${loan.first_name} ${loan.last_name}`,
                customer_email: customerEmail, // Use personal_email, official_email, or email
                customer_phone: loan.phone,
                customer_bank_account_holder_name: bank.account_holder_name || `${loan.first_name} ${loan.last_name}`,
                customer_bank_account_number: bank.account_number,
                customer_bank_ifsc: bank.ifsc_code,
                customer_bank_code: bank.ifsc_code.substring(0, 4),
                customer_bank_account_type: (bank.account_type || 'SAVINGS').toUpperCase()
            },
            plan_details: {
                plan_id: planId
            },
            subscription_payment_method: 'ENACH',  // Must be uppercase
            split_schemes: [
                {
                    scheme_id: 'PRIMARY_MERCHANT',
                    split_type: 'PERCENTAGE',
                    split_value: 100,
                    vendor_id: 'SELF'
                }
            ],
            subscription_meta: {
                return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/post-disbursal?applicationId=${applicationId}&enach=complete`,
                notification_channel: ['EMAIL', 'SMS']
            }
            // Don't include authorization_details - Cashfree adds it automatically
        };

        console.log('Creating subscription with payload:', JSON.stringify(subscriptionPayload, null, 2));

        const subscriptionResponse = await axios.post(
            `${CASHFREE_API_BASE}/subscriptions`,
            subscriptionPayload,
            { headers: getCashfreeHeaders() }
        );

        console.log('Subscription created:', subscriptionResponse.data);

        // For eNACH, there's no hosted checkout page
        // The mandate setup happens via bank's own flow
        // Cashfree will send mandate link to customer via SMS/Email

        // Check if Cashfree provided an authorization URL
        let authorizationUrl = null;

        if (subscriptionResponse.data.authorization_details?.authorization_url) {
            authorizationUrl = subscriptionResponse.data.authorization_details.authorization_url;
        } else if (subscriptionResponse.data.authorization_url) {
            authorizationUrl = subscriptionResponse.data.authorization_url;
        } else {
            // For eNACH, no immediate redirect URL
            // Customer will receive mandate link via SMS/Email from bank
            console.log('[eNACH] No authorization URL - mandate will be sent via SMS/Email');
            authorizationUrl = null;
        }

        // Store subscription details in database
        const insertQuery = `
      INSERT INTO enach_subscriptions 
      (user_id, loan_application_id, subscription_id, cf_subscription_id, plan_id, status, 
       subscription_session_id, cashfree_response, authorization_url, initialized_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

        await executeQuery(insertQuery, [
            userId,
            applicationId,
            subscriptionId,
            subscriptionResponse.data.cf_subscription_id || null,
            planId,
            'INITIALIZED',
            subscriptionResponse.data.subscription_session_id || null,
            JSON.stringify(subscriptionResponse.data),
            authorizationUrl
        ]);

        // Return response to frontend
        res.json({
            success: true,
            data: {
                subscription_id: subscriptionId,
                cf_subscription_id: subscriptionResponse.data.cf_subscription_id,
                authorization_url: authorizationUrl,
                subscription_status: subscriptionResponse.data.subscription_status,
                subscription_session_id: subscriptionResponse.data.subscription_session_id,
                message: authorizationUrl
                    ? 'Redirecting to authorization page...'
                    : 'eNACH mandate link will be sent to your registered mobile number and email. Please check and authorize the mandate.'
            }
        });

    } catch (error) {
        console.error('Error creating eNACH subscription:', error.response?.data || error.message);

        // Provide more helpful error messages
        let errorMessage = 'Failed to create eNACH subscription';

        if (error.response?.data?.message) {
            const cashfreeError = error.response.data.message;

            // Handle specific Cashfree errors
            if (cashfreeError.includes('format is invalid') || cashfreeError.includes('bank')) {
                errorMessage = 'The bank account details are not supported by the payment gateway. Please use a different bank account (HDFC, ICICI, SBI, Axis, etc.) or contact support.';
            } else if (cashfreeError.includes('IFSC')) {
                errorMessage = 'Invalid IFSC code. Please verify your bank details.';
            } else {
                errorMessage = cashfreeError;
            }
        }

        res.status(500).json({
            success: false,
            message: errorMessage,
            error: error.response?.data?.message || error.message,
            debug: process.env.NODE_ENV === 'development' ? {
                bank_code_sent: error.config?.data ? JSON.parse(error.config.data).customer_details?.customer_bank_code : 'N/A'
            } : undefined
        });
    }
});

/**
 * GET /api/enach/subscription-status/:subscriptionId
 * Check subscription status
 */
router.get('/subscription-status/:subscriptionId', authenticateToken, async (req, res) => {
    try {
        const { subscriptionId } = req.params;

        const statusResponse = await axios.get(
            `${CASHFREE_API_BASE}/subscriptions/${subscriptionId}`,
            { headers: getCashfreeHeaders() }
        );

        // Update database with latest status
        await initializeDatabase();
        const updateQuery = `
      UPDATE enach_subscriptions 
      SET status = ?, cashfree_response = ?, updated_at = NOW()
      WHERE subscription_id = ?
    `;

        await executeQuery(updateQuery, [
            statusResponse.data.subscription_status,
            JSON.stringify(statusResponse.data),
            subscriptionId
        ]);

        res.json({
            success: true,
            data: statusResponse.data
        });

    } catch (error) {
        console.error('Error fetching subscription status:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch subscription status',
            error: error.response?.data?.message || error.message
        });
    }
});

/**
 * GET /api/enach/subscription/:applicationId
 * Get subscription details for a loan application
 */
router.get('/subscription/:applicationId', authenticateToken, async (req, res) => {
    try {
        await initializeDatabase();
        const userId = req.user.id;
        const { applicationId } = req.params;

        const query = `
      SELECT * FROM enach_subscriptions
      WHERE user_id = ? AND loan_application_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `;

        const subscriptions = await executeQuery(query, [userId, applicationId]);

        if (!subscriptions || subscriptions.length === 0) {
            return res.json({
                success: true,
                data: null
            });
        }

        res.json({
            success: true,
            data: subscriptions[0]
        });

    } catch (error) {
        console.error('Error fetching subscription:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch subscription'
        });
    }
});

module.exports = router;
