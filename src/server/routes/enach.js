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
const BACKEND_URL = process.env.BACKEND_URL || process.env.FRONTEND_URL || 'http://localhost:3002';

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

        // Fetch loan application details with all email fields and salary
        const loanQuery = `
      SELECT 
        la.*,
        u.first_name,
        u.last_name,
        u.email,
        u.personal_email,
        u.official_email,
        u.phone,
        u.monthly_net_income
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

        // Get monthly salary for plan_max_amount calculation (60% of salary)
        const monthlySalary = parseFloat(loan.monthly_net_income) || 0;
        if (!monthlySalary || monthlySalary <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Monthly salary is required. Please update your employment details with salary information.'
            });
        }

        // Calculate 60% of salary for plan_max_amount
        const planMaxAmount = Math.round(monthlySalary * 0.6);

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

        // Step 1: Create Plan - ON_DEMAND type (merchant triggers charges manually)
        // For ON_DEMAND plans:
        // - plan_recurring_amount is not required (set to 0 or omit)
        // - plan_max_amount is 60% of monthly salary
        // - plan_max_cycles is 0 for unlimited (or very high number)
        // - plan_intervals and plan_interval_type are not required
        const planPayload = {
            plan_id: planId,
            plan_name: `Loan Repayment Plan - ${loan.application_number}`,
            plan_type: 'ON_DEMAND',
            plan_currency: 'INR',
            plan_max_amount: planMaxAmount,
            plan_max_cycles: 0, // 0 means unlimited cycles
            plan_note: `On-demand payment plan for loan ${loan.application_number}. Maximum amount: ₹${planMaxAmount.toLocaleString('en-IN')} (60% of monthly salary)`
        };

        let planResponse;
        let planCreated = false;
        try {
            console.log(`[eNACH] Creating plan with payload:`, JSON.stringify(planPayload, null, 2));
            planResponse = await axios.post(
                `${CASHFREE_API_BASE}/plans`,
                planPayload,
                { headers: getCashfreeHeaders(planId) } // Use plan_id as idempotency key
            );
            console.log(`[eNACH] Plan created successfully: ${planId}`, {
                cf_plan_id: planResponse.data.cf_plan_id,
                plan_type: planResponse.data.plan_type,
                plan_max_amount: planResponse.data.plan_max_amount,
                plan_max_cycles: planResponse.data.plan_max_cycles,
                status: planResponse.data.plan_status,
                full_response: JSON.stringify(planResponse.data, null, 2)
            });
            
            // Verify the plan was created with correct type
            if (planResponse.data.plan_type !== 'ON_DEMAND') {
                console.error(`[eNACH] ⚠️ WARNING: Plan created with wrong type! Expected ON_DEMAND, got ${planResponse.data.plan_type}`);
                return res.status(500).json({
                    success: false,
                    message: 'Plan creation failed: Wrong plan type returned by Cashfree',
                    error: `Expected ON_DEMAND, got ${planResponse.data.plan_type}`
                });
            }
            
            planCreated = true;
            
            // Plan is stored in Cashfree, no need to store locally
        } catch (planError) {
            // If plan already exists, that's a problem - we need a unique plan
            if (planError.response?.status === 400 && 
                (planError.response?.data?.message?.includes('already exists') ||
                 planError.response?.data?.message?.includes('Plan already created'))) {
                console.error(`[eNACH] ❌ Plan ${planId} already exists! This should not happen with timestamp-based IDs.`);
                console.error(`[eNACH] Error details:`, planError.response?.data);
                return res.status(500).json({
                    success: false,
                    message: 'Plan creation failed: Plan ID already exists',
                    error: 'Please try again. If the issue persists, contact support.'
                });
            } else {
                console.error('[eNACH] ❌ Error creating plan:', {
                    status: planError.response?.status,
                    data: planError.response?.data,
                    message: planError.message,
                    payload: JSON.stringify(planPayload, null, 2)
                });
                return res.status(500).json({
                    success: false,
                    message: 'Failed to create payment plan. Please try again.',
                    error: planError.response?.data?.message || planError.message
                });
            }
        }

        // Ensure plan was created successfully before proceeding
        if (!planCreated || !planResponse) {
            return res.status(500).json({
                success: false,
                message: 'Failed to create payment plan. Cannot proceed with subscription creation.',
                error: 'Plan creation did not complete successfully'
            });
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
            // For ON_DEMAND plans, we can pass plan_id OR inline plan details
            // Passing plan_id is preferred if plan already exists (which it should)
            // But we also include inline details as fallback to ensure correct plan type
            plan_details: {
                plan_id: planId,
                // Inline plan details as fallback (Cashfree will use plan_id if it exists)
                plan_type: 'ON_DEMAND',
                plan_max_amount: planMaxAmount,
                plan_max_cycles: 0,
                plan_currency: 'INR'
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
                return_url: `${BACKEND_URL}/api/enach/callback?applicationId=${applicationId}&subscription_id=${subscriptionId}`,
                notification_channel: ['EMAIL', 'SMS']
            },
            // Add authorization_details with payment_methods to enable dashboard redirect
            // According to Cashfree docs, this should include "enach" in payment_methods
            // Add authorization_details with payment_methods to enable dashboard redirect
            // According to Cashfree docs, for ENACH, authorization_amount is always 0
            authorization_details: {
                payment_methods: ['enach'],
                authorization_amount: 0, // For ENACH, authorization_amount is always 0 as per Cashfree docs
                authorization_amount_refund: false
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
            has_checkout_url: !!subscriptionResponse.data.checkout_url,
            has_subscription_checkout_url: !!subscriptionResponse.data.subscription_checkout_url,
            subscription_session_id: subscriptionResponse.data.subscription_session_id?.substring(0, 50) + '...',
            checkout_url: subscriptionResponse.data.checkout_url,
            subscription_checkout_url: subscriptionResponse.data.subscription_checkout_url,
            full_response: JSON.stringify(subscriptionResponse.data, null, 2)
        });

        // Extract authorization URL from response (dashboard-based flow)
        // According to Cashfree docs, authorization_url is in authorization_details or directly in response
        let authorizationUrl = null;

        // According to Cashfree docs, auth_link is in authorization_details.auth_link
        // Priority 1: Check authorization_details.auth_link (most common location per Cashfree docs)
        if (subscriptionResponse.data.authorization_details?.auth_link) {
            authorizationUrl = subscriptionResponse.data.authorization_details.auth_link;
            console.log(`[eNACH] Found authorization URL in authorization_details.auth_link: ${authorizationUrl}`);
        }
        // Priority 2: Check authorization_details.payment_method.enach.authorization_url
        // For eNACH, Cashfree may nest the URL in payment_method.enach
        else if (subscriptionResponse.data.authorization_details?.payment_method?.enach?.authorization_url) {
            authorizationUrl = subscriptionResponse.data.authorization_details.payment_method.enach.authorization_url;
            console.log(`[eNACH] Found authorization URL in authorization_details.payment_method.enach: ${authorizationUrl}`);
        }
        // Priority 3: Check authorization_details.authorization_url (direct)
        else if (subscriptionResponse.data.authorization_details?.authorization_url) {
            authorizationUrl = subscriptionResponse.data.authorization_details.authorization_url;
            console.log(`[eNACH] Found authorization URL in authorization_details.authorization_url: ${authorizationUrl}`);
        } 
        // Priority 4: Check direct authorization_url field in response root
        else if (subscriptionResponse.data.authorization_url) {
            authorizationUrl = subscriptionResponse.data.authorization_url;
            console.log(`[eNACH] Found authorization URL in response root: ${authorizationUrl}`);
        } 
        // Priority 5: Check alternative field names in response root
        else if (subscriptionResponse.data.auth_link) {
            authorizationUrl = subscriptionResponse.data.auth_link;
            console.log(`[eNACH] Found authorization URL in response root auth_link: ${authorizationUrl}`);
        } 
        else if (subscriptionResponse.data.authorization_link) {
            authorizationUrl = subscriptionResponse.data.authorization_link;
            console.log(`[eNACH] Found authorization URL in response root authorization_link: ${authorizationUrl}`);
        }
        
        // Log what we found (or didn't find) for debugging
        if (!authorizationUrl) {
            console.log(`[eNACH] No authorization URL found in response. Checking response structure...`);
            console.log(`[eNACH] Response has authorization_details: ${!!subscriptionResponse.data.authorization_details}`);
            if (subscriptionResponse.data.authorization_details) {
                const authDetails = subscriptionResponse.data.authorization_details;
                console.log(`[eNACH] authorization_details keys:`, Object.keys(authDetails));
                console.log(`[eNACH] authorization_details.auth_link:`, authDetails.auth_link);
                console.log(`[eNACH] authorization_details.authorization_url:`, authDetails.authorization_url);
                // Check if payment_method exists
                if (authDetails.payment_method) {
                    console.log(`[eNACH] payment_method keys:`, Object.keys(authDetails.payment_method));
                    if (authDetails.payment_method.enach) {
                        console.log(`[eNACH] payment_method.enach keys:`, Object.keys(authDetails.payment_method.enach));
                        console.log(`[eNACH] payment_method.enach.authorization_url:`, authDetails.payment_method.enach.authorization_url);
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
                        authorization_amount: 0 // For ENACH, authorization_amount is always 0
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

        // If still no URL, check for checkout_url or construct using subscription_session_id
        // Check for direct checkout_url in response
        if (!authorizationUrl && subscriptionResponse.data.checkout_url) {
            authorizationUrl = subscriptionResponse.data.checkout_url;
            console.log(`[eNACH] Found checkout_url in response: ${authorizationUrl}`);
        }
        // Check for subscription_checkout_url
        else if (!authorizationUrl && subscriptionResponse.data.subscription_checkout_url) {
            authorizationUrl = subscriptionResponse.data.subscription_checkout_url;
            console.log(`[eNACH] Found subscription_checkout_url in response: ${authorizationUrl}`);
        }
        // If still no URL, construct subscription checkout URL
        // Correct format: https://payments.cashfree.com/subscriptions/checkout/{subscription_session_id}
        // Note: The session_id might need to be encoded, but we'll try the raw value first
        else if (!authorizationUrl && subscriptionResponse.data.subscription_session_id) {
            const sessionId = subscriptionResponse.data.subscription_session_id;
            const checkoutDomain = IS_PRODUCTION 
                ? 'https://payments.cashfree.com'
                : 'https://payments-test.cashfree.com';
            
            // IMPORTANT: DO NOT use raw subscription_session_id - it will result in 404
            // Cashfree requires an encoded/encrypted token that is only sent via SMS/Email
            // The raw session ID (like "sub_session_...") does NOT work in checkout URL
            // We cannot construct a valid URL without the encoded token from SMS
            console.warn(`[eNACH] Cannot construct checkout URL - raw subscription_session_id will not work`);
            console.warn(`[eNACH] Cashfree only provides encoded checkout token via SMS/Email`);
            // Do NOT set authorizationUrl - let it remain null so frontend handles SMS flow
        }
        
        if (!authorizationUrl) {
            console.warn('[eNACH] ⚠️  No authorization URL found in Cashfree response.');
            console.warn('[eNACH] This means Cashfree will send the authorization link via SMS/Email.');
            console.warn('[eNACH] This is the standard eNACH flow - dashboard redirect is not available.');
            console.warn('[eNACH] Full response structure logged above for debugging.');
        }

        console.log(`[eNACH] Authorization URL: ${authorizationUrl || 'null (SMS flow)'}`);

        // Store subscription details in database (ALWAYS save, regardless of authorization URL)
        // This is critical for webhook matching - we need subscription_id in database
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

        try {
            await executeQuery(insertQuery, [
                userId,
                applicationId,
                subscriptionId,
                subscriptionResponse.data.cf_subscription_id || null,
                planId,
                subscriptionResponse.data.subscription_status || 'INITIALIZED',
                subscriptionResponse.data.subscription_session_id || null,
                JSON.stringify(subscriptionResponse.data),
                authorizationUrl || null
            ]);
            console.log(`[eNACH] ✅ Subscription saved to database: ${subscriptionId}`);
        } catch (dbError) {
            console.error('[eNACH] ❌ Error saving subscription to database:', dbError);
            // Continue anyway - don't fail the request if DB save fails
            // But log it so we can fix the issue
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
                AND TABLE_NAME IN ('enach_subscriptions', 'enach_webhook_events')
            `);
            health.tables = {
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
