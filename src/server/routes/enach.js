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
const NODE_ENV = process.env.NODE_ENV || 'development';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Detect if we're using production API
const IS_PRODUCTION = CASHFREE_API_BASE.includes('api.cashfree.com') && 
                      !CASHFREE_API_BASE.includes('sandbox');

// Validate configuration on startup
if (!CASHFREE_CLIENT_ID || !CASHFREE_CLIENT_SECRET) {
    console.warn('⚠️  WARNING: Cashfree credentials not configured. eNACH features will not work.');
    if (NODE_ENV === 'production') {
        console.error('❌ ERROR: Cashfree credentials are required in production!');
    }
}

// Log environment on startup
console.log(`[eNACH] Environment: ${NODE_ENV}`);
console.log(`[eNACH] API Base: ${CASHFREE_API_BASE}`);
console.log(`[eNACH] Production Mode: ${IS_PRODUCTION ? '✅ YES' : '❌ NO (Sandbox)'}`);

// Helper to create Cashfree headers
const getCashfreeHeaders = (idempotencyKey = null) => {
    const headers = {
        'Content-Type': 'application/json',
        'x-api-version': CASHFREE_API_VERSION,
        'x-client-id': CASHFREE_CLIENT_ID,
        'x-client-secret': CASHFREE_CLIENT_SECRET,
        'x-request-id': uuidv4(),
    };
    
    if (idempotencyKey) {
        headers['x-idempotency-key'] = idempotencyKey;
    } else {
        headers['x-idempotency-key'] = uuidv4();
    }
    
    return headers;
};

/**
 * POST /api/enach/create-subscription
 * Create eNACH subscription for loan application
 */
router.post('/create-subscription', authenticateToken, async (req, res) => {
    try {
        // Validate Cashfree configuration
        if (!CASHFREE_CLIENT_ID || !CASHFREE_CLIENT_SECRET) {
            return res.status(500).json({
                success: false,
                message: 'eNACH service is not configured. Please contact support.',
                error: 'CASHFREE_CLIENT_ID or CASHFREE_CLIENT_SECRET not set'
            });
        }

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
        let planCreated = false;
        try {
            planResponse = await axios.post(
                `${CASHFREE_API_BASE}/plans`,
                planPayload,
                { headers: getCashfreeHeaders(planId) } // Use plan_id as idempotency key
            );
            console.log(`[eNACH] Plan created: ${planId}`, {
                cf_plan_id: planResponse.data.cf_plan_id,
                status: planResponse.data.plan_status
            });
            planCreated = true;
            
            // Store plan in database
            try {
                await executeQuery(`
                    INSERT INTO enach_plans 
                    (plan_id, cf_plan_id, plan_name, plan_type, plan_currency, 
                     plan_recurring_amount, plan_max_amount, plan_max_cycles, 
                     plan_intervals, plan_interval_type, plan_note, plan_status, 
                     loan_application_id, cashfree_response, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                    ON DUPLICATE KEY UPDATE
                        cf_plan_id = VALUES(cf_plan_id),
                        plan_status = VALUES(plan_status),
                        cashfree_response = VALUES(cashfree_response),
                        updated_at = NOW()
                `, [
                    planId,
                    planResponse.data.cf_plan_id || null,
                    planPayload.plan_name,
                    planPayload.plan_type,
                    planPayload.plan_currency,
                    planPayload.plan_recurring_amount,
                    planPayload.plan_max_amount,
                    planPayload.plan_max_cycles,
                    planPayload.plan_intervals,
                    planPayload.plan_interval_type,
                    planPayload.plan_note,
                    planResponse.data.plan_status || 'ACTIVE',
                    applicationId,
                    JSON.stringify(planResponse.data)
                ]);
            } catch (dbError) {
                console.warn('[eNACH] Failed to store plan in database:', dbError.message);
                // Continue - not critical
            }
        } catch (planError) {
            // If plan already exists, that's fine - continue
            if (planError.response?.status === 400 && 
                (planError.response?.data?.message?.includes('already exists') ||
                 planError.response?.data?.message?.includes('Plan already created'))) {
                console.log(`[eNACH] Plan ${planId} already exists, continuing...`);
            } else {
                console.error('[eNACH] Error creating plan:', planError.response?.data || planError.message);
                // Continue with subscription creation even if plan creation fails
            }
        }

        // Step 2: Create Subscription
        // For dashboard-based eNACH flow, we include authorization_details
        // to force redirect instead of SMS
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
                return_url: `${FRONTEND_URL}/post-disbursal?applicationId=${applicationId}&enach=complete&subscription_id=${subscriptionId}`,
                notification_channel: ['EMAIL', 'SMS']
            },
            // Add authorization_details with payment_methods to enable dashboard redirect
            // According to Cashfree docs, this should include "enach" in payment_methods
            authorization_details: {
                payment_methods: ['enach'],
                authorization_amount: parseFloat(loan.emi_amount || loan.loan_amount),
                authorization_amount_refundable: false
            }
        };

        console.log(`[eNACH] Creating subscription for application ${applicationId}`, {
            subscription_id: subscriptionId,
            plan_id: planId,
            environment: IS_PRODUCTION ? 'PRODUCTION' : 'SANDBOX'
        });

        const subscriptionResponse = await axios.post(
            `${CASHFREE_API_BASE}/subscriptions`,
            subscriptionPayload,
            { headers: getCashfreeHeaders(subscriptionId) } // Use subscription_id as idempotency key
        );

        // Log full response structure to debug
        console.log(`[eNACH] Subscription created: ${subscriptionId}`, {
            cf_subscription_id: subscriptionResponse.data.cf_subscription_id,
            status: subscriptionResponse.data.subscription_status,
            environment: IS_PRODUCTION ? 'PRODUCTION' : 'SANDBOX',
            response_keys: Object.keys(subscriptionResponse.data || {}),
            has_authorization_details: !!subscriptionResponse.data.authorization_details,
            has_subscription_session_id: !!subscriptionResponse.data.subscription_session_id,
            subscription_session_id: subscriptionResponse.data.subscription_session_id?.substring(0, 50) + '...',
            full_response: JSON.stringify(subscriptionResponse.data, null, 2)
        });

        // Extract authorization URL from response (dashboard-based flow)
        // According to Cashfree docs, authorization_url is in authorization_details or directly in response
        let authorizationUrl = null;

        // Priority 1: Check authorization_details.payment_method.enach.authorization_url
        // For eNACH, Cashfree may nest the URL in payment_method.enach
        if (subscriptionResponse.data.authorization_details?.payment_method?.enach?.authorization_url) {
            authorizationUrl = subscriptionResponse.data.authorization_details.payment_method.enach.authorization_url;
            console.log(`[eNACH] Found authorization URL in authorization_details.payment_method.enach: ${authorizationUrl}`);
        }
        // Priority 2: Check authorization_details.authorization_url (direct)
        else if (subscriptionResponse.data.authorization_details?.authorization_url) {
            authorizationUrl = subscriptionResponse.data.authorization_details.authorization_url;
            console.log(`[eNACH] Found authorization URL in authorization_details: ${authorizationUrl}`);
        } 
        // Priority 3: Check direct authorization_url field
        else if (subscriptionResponse.data.authorization_url) {
            authorizationUrl = subscriptionResponse.data.authorization_url;
            console.log(`[eNACH] Found authorization URL in response root: ${authorizationUrl}`);
        } 
        // Priority 4: Check alternative field names
        else if (subscriptionResponse.data.auth_link) {
            authorizationUrl = subscriptionResponse.data.auth_link;
            console.log(`[eNACH] Found authorization URL in auth_link: ${authorizationUrl}`);
        } 
        else if (subscriptionResponse.data.authorization_link) {
            authorizationUrl = subscriptionResponse.data.authorization_link;
            console.log(`[eNACH] Found authorization URL in authorization_link: ${authorizationUrl}`);
        }
        
        // Log what we found (or didn't find) for debugging
        if (!authorizationUrl) {
            console.log(`[eNACH] No authorization URL found in response. Checking response structure...`);
            console.log(`[eNACH] Response has authorization_details: ${!!subscriptionResponse.data.authorization_details}`);
            if (subscriptionResponse.data.authorization_details) {
                console.log(`[eNACH] authorization_details keys:`, Object.keys(subscriptionResponse.data.authorization_details));
                // Check if payment_method exists
                if (subscriptionResponse.data.authorization_details.payment_method) {
                    console.log(`[eNACH] payment_method keys:`, Object.keys(subscriptionResponse.data.authorization_details.payment_method));
                    if (subscriptionResponse.data.authorization_details.payment_method.enach) {
                        console.log(`[eNACH] payment_method.enach keys:`, Object.keys(subscriptionResponse.data.authorization_details.payment_method.enach));
                    }
                }
            }
        }

        // If still no URL, try to raise an authorization payment to get the authorization URL
        // For eNACH, we may need to raise a payment/authorization request to get the URL
        if (!authorizationUrl && subscriptionResponse.data.cf_subscription_id) {
            const cfSubscriptionId = subscriptionResponse.data.cf_subscription_id;
            
            try {
                console.log(`[eNACH] Attempting to raise authorization payment for subscription: ${cfSubscriptionId}`);
                // Try to raise an authorization payment - this might return the authorization URL
                const authPaymentResponse = await axios.post(
                    `${CASHFREE_API_BASE}/subscriptions/${cfSubscriptionId}/authorize`,
                    {
                        authorization_amount: parseFloat(loan.emi_amount || loan.loan_amount)
                    },
                    { headers: getCashfreeHeaders() }
                );
                
                // Check for authorization URL in the response
                if (authPaymentResponse.data?.authorization_url) {
                    authorizationUrl = authPaymentResponse.data.authorization_url;
                    console.log(`[eNACH] Retrieved authorization URL from authorize endpoint: ${authorizationUrl}`);
                } else if (authPaymentResponse.data?.data?.url) {
                    // Sometimes URL is nested in data.url
                    authorizationUrl = authPaymentResponse.data.data.url;
                    console.log(`[eNACH] Retrieved authorization URL from data.url: ${authorizationUrl}`);
                } else if (authPaymentResponse.data?.action === 'custom' && authPaymentResponse.data?.data?.url) {
                    // For eNACH, URL might be in action: custom, data.url
                    authorizationUrl = authPaymentResponse.data.data.url;
                    console.log(`[eNACH] Retrieved authorization URL from custom action: ${authorizationUrl}`);
                }
            } catch (authError) {
                console.warn('[eNACH] Could not raise authorization payment:', {
                    status: authError.response?.status,
                    error: authError.response?.data || authError.message
                });
            }
        }

        // If still no URL, try constructing checkout URL using subscription_session_id
        // Based on Cashfree patterns, subscriptions might use different URL formats
        if (!authorizationUrl && subscriptionResponse.data.subscription_session_id) {
            const sessionId = subscriptionResponse.data.subscription_session_id;
            const checkoutDomain = IS_PRODUCTION 
                ? 'https://payments.cashfree.com'
                : 'https://payments-test.cashfree.com';
            
            // Try Format 1: /checkout/subscription/{session_id} (path-based)
            authorizationUrl = `${checkoutDomain}/checkout/subscription/${sessionId}`;
            console.log(`[eNACH] Constructed subscription checkout URL (format 1 - path): ${authorizationUrl}`);
            console.log(`[eNACH] If this gives 404, Cashfree may not support dashboard redirect for eNACH`);
        }
        
        if (!authorizationUrl) {
            console.warn('[eNACH] ⚠️  No authorization URL found in Cashfree response.');
            console.warn('[eNACH] This means Cashfree will send the authorization link via SMS/Email.');
            console.warn('[eNACH] This is the standard eNACH flow - dashboard redirect is not available.');
            console.warn('[eNACH] Full response structure logged above for debugging.');
        }

        // For eNACH, if no authorization URL is available, Cashfree sends authorization link via SMS
        // This is the default behavior for eNACH - the authorization link is sent via SMS/Email
        // We should inform the frontend about this
        if (!authorizationUrl) {
            console.log('[eNACH] No authorization URL - Cashfree will send authorization link via SMS');
            
            // Return success response with SMS flow indicator
            return res.json({
                success: true,
                data: {
                    subscription_id: subscriptionId,
                    cf_subscription_id: subscriptionResponse.data.cf_subscription_id,
                    authorization_url: null,
                    subscription_status: subscriptionResponse.data.subscription_status,
                    subscription_session_id: subscriptionResponse.data.subscription_session_id,
                    message: 'eNACH authorization link will be sent to your registered mobile number and email. Please check and authorize the mandate.',
                    sms_flow: true
                }
            });
        }

        console.log(`[eNACH] Authorization URL: ${authorizationUrl}`);

        // Store subscription details in database
        const insertQuery = `
      INSERT INTO enach_subscriptions 
      (user_id, loan_application_id, subscription_id, cf_subscription_id, plan_id, status, 
       subscription_session_id, cashfree_response, authorization_url, initialized_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        cf_subscription_id = VALUES(cf_subscription_id),
        subscription_session_id = VALUES(subscription_session_id),
        status = VALUES(status),
        cashfree_response = VALUES(cashfree_response),
        authorization_url = VALUES(authorization_url),
        updated_at = NOW()
    `;

        await executeQuery(insertQuery, [
            userId,
            applicationId,
            subscriptionId,
            subscriptionResponse.data.cf_subscription_id || null,
            planId,
            subscriptionResponse.data.subscription_status || 'INITIALIZED',
            subscriptionResponse.data.subscription_session_id || null,
            JSON.stringify(subscriptionResponse.data),
            authorizationUrl
        ]);

        // Return response to frontend - always include authorization_url for redirect
        res.json({
            success: true,
            data: {
                subscription_id: subscriptionId,
                cf_subscription_id: subscriptionResponse.data.cf_subscription_id,
                authorization_url: authorizationUrl,
                subscription_status: subscriptionResponse.data.subscription_status,
                subscription_session_id: subscriptionResponse.data.subscription_session_id,
                message: 'Redirecting to eNACH authorization page...'
            }
        });

    } catch (error) {
        console.error('[eNACH] Error creating subscription:', {
            error: error.response?.data || error.message,
            status: error.response?.status,
            subscription_id: subscriptionId || 'N/A'
        });

        // Provide more helpful error messages
        let errorMessage = 'Failed to create eNACH subscription';
        let statusCode = 500;

        if (error.response?.data?.message) {
            const cashfreeError = error.response.data.message;

            // Handle specific Cashfree errors
            if (cashfreeError.includes('format is invalid') || cashfreeError.includes('bank')) {
                errorMessage = 'The bank account details are not supported by the payment gateway. Please use a different bank account (HDFC, ICICI, SBI, Axis, etc.) or contact support.';
            } else if (cashfreeError.includes('IFSC')) {
                errorMessage = 'Invalid IFSC code. Please verify your bank details.';
            } else if (cashfreeError.includes('authentication') || cashfreeError.includes('credentials')) {
                errorMessage = 'Payment gateway authentication failed. Please contact support.';
                statusCode = 503; // Service unavailable
            } else if (error.response.status === 401 || error.response.status === 403) {
                errorMessage = 'Payment gateway authentication failed. Please contact support.';
                statusCode = 503;
            } else {
                errorMessage = cashfreeError;
            }
        } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            errorMessage = 'Payment gateway is temporarily unavailable. Please try again later.';
            statusCode = 503;
        }

        res.status(statusCode).json({
            success: false,
            message: errorMessage,
            error: error.response?.data?.message || error.message,
            debug: NODE_ENV === 'development' ? {
                bank_code_sent: error.config?.data ? JSON.parse(error.config.data).customer_details?.customer_bank_code : 'N/A',
                environment: IS_PRODUCTION ? 'PRODUCTION' : 'SANDBOX'
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

/**
 * GET /api/enach/health
 * Health check endpoint for eNACH service
 */
router.get('/health', async (req, res) => {
    try {
        const health = {
            service: 'eNACH',
            status: 'ok',
            environment: NODE_ENV,
            production: IS_PRODUCTION,
            api_base: CASHFREE_API_BASE,
            configured: !!(CASHFREE_CLIENT_ID && CASHFREE_CLIENT_SECRET),
            timestamp: new Date().toISOString()
        };

        // Test database connection
        try {
            await initializeDatabase();
            health.database = 'connected';
        } catch (dbError) {
            health.database = 'error';
            health.database_error = dbError.message;
        }

        // Test if tables exist
        try {
            const tables = await executeQuery(`
                SELECT TABLE_NAME 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME IN ('enach_plans', 'enach_subscriptions', 'enach_webhook_events')
            `);
            health.tables = {
                enach_plans: tables.some(t => t.TABLE_NAME === 'enach_plans'),
                enach_subscriptions: tables.some(t => t.TABLE_NAME === 'enach_subscriptions'),
                enach_webhook_events: tables.some(t => t.TABLE_NAME === 'enach_webhook_events')
            };
        } catch (tableError) {
            health.tables = 'error';
            health.tables_error = tableError.message;
        }

        const statusCode = health.configured && health.database === 'connected' ? 200 : 503;
        res.status(statusCode).json(health);
    } catch (error) {
        res.status(503).json({
            service: 'eNACH',
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;
