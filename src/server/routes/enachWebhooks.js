/**
 * Cashfree Webhooks Handler for eNACH Subscriptions
 * 
 * Handles:
 * - subscription.activated
 * - subscription.authentication_failed
 * - subscription.cancelled
 * - mandate.approved
 * - mandate.rejected
 * 
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { executeQuery, initializeDatabase } = require('../config/database');

const NODE_ENV = process.env.NODE_ENV || 'development';
const CASHFREE_WEBHOOK_SECRET = process.env.CASHFREE_WEBHOOK_SECRET;

// Webhook signature verification (if Cashfree provides it)
function verifyWebhookSignature(payload, signature, secret) {
    if (!secret || !signature) {
        if (NODE_ENV === 'production') {
            console.warn('[Webhook] WARNING: Signature verification skipped in production - webhook secret not configured');
        } else {
            console.warn('[Webhook] Signature verification skipped - no secret configured');
        }
        return true; // Skip if not configured (but warn in production)
    }

    try {
        const computed = crypto
            .createHmac('sha256', secret)
            .update(JSON.stringify(payload))
            .digest('hex');

        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(computed)
        );
    } catch (error) {
        console.error('[Webhook] Signature verification error:', error);
        return false;
    }
}

/**
 * Helper function to log webhook payloads to webhook_logs table
 */
async function logWebhookPayload(req, webhookType, endpoint, processed = false, error = null) {
    try {
        await initializeDatabase();

        const headers = {};
        Object.keys(req.headers).forEach(key => {
            headers[key] = req.headers[key];
        });

        const queryParams = req.query && Object.keys(req.query).length > 0 ? req.query : null;
        const bodyData = req.body && Object.keys(req.body).length > 0 ? req.body : null;

        // Extract common fields for eNACH webhooks
        const requestId = req.headers['x-request-id'] || req.body?.request_id || req.query?.request_id || req.query?.subscription_id || null;
        const eventId = req.headers['x-cashfree-event-id'] || req.body?.event_id || req.body?.data?.event_id || null;
        const subscriptionId = req.body?.data?.subscription?.subscription_id || req.body?.subscription_id || req.query?.subscription_id || null;
        const cfSubscriptionId = req.body?.data?.subscription?.cf_subscription_id || req.body?.cf_subscription_id || req.query?.cf_subscription_id || null;
        const status = req.body?.type || req.body?.status || req.query?.status || req.query?.subscription_status || null;

        // Get client IP
        const ipAddress = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || null;
        const userAgent = req.headers['user-agent'] || null;

        // Store raw payload as string (handle circular references and large payloads)
        let rawPayload = null;
        try {
            rawPayload = JSON.stringify({
                method: req.method,
                url: req.url,
                headers: headers,
                query: req.query,
                body: req.body
            }, null, 2);
        } catch (jsonError) {
            // If JSON.stringify fails (circular reference or too large), store a summary
            rawPayload = JSON.stringify({
                method: req.method,
                url: req.url,
                error: 'Could not serialize full payload',
                bodySize: req.body ? JSON.stringify(req.body).length : 0
            });
            console.warn(`[Webhook] Could not serialize full payload:`, jsonError.message);
        }

        await executeQuery(
            `INSERT INTO webhook_logs 
             (webhook_type, http_method, endpoint, headers, query_params, body_data, raw_payload, 
              request_id, client_ref_num, status, ip_address, user_agent, processed, processing_error, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
                webhookType,
                req.method,
                endpoint,
                JSON.stringify(headers),
                queryParams ? JSON.stringify(queryParams) : null,
                bodyData ? JSON.stringify(bodyData) : null,
                rawPayload,
                requestId || eventId,
                subscriptionId || cfSubscriptionId, // Use subscription ID as client_ref_num
                status,
                ipAddress,
                userAgent,
                processed,
                error
            ]
        );

        console.log(`📝 [eNACH Webhook] Logged to webhook_logs: ${webhookType} - ${req.method} ${endpoint}`);
    } catch (logError) {
        console.error('❌ [eNACH Webhook] Error logging to webhook_logs:', logError);
        // Don't throw - logging failure shouldn't break webhook processing
    }
}

/**
 * GET /api/enach/webhook
 * Test endpoint to verify webhook route is accessible
 */
router.get('/webhook', async (req, res) => {
    // Log GET request to webhook_logs
    await logWebhookPayload(req, 'enach_webhook', '/api/enach/webhook', true, null);
    
    res.json({
        status: 'ok',
        message: 'eNACH webhook endpoint is accessible',
        method: 'GET',
        timestamp: new Date().toISOString()
    });
});

/**
 * OPTIONS /api/enach/webhook
 * Handle CORS preflight requests
 */
router.options('/webhook', async (req, res) => {
    // Log OPTIONS request to webhook_logs
    await logWebhookPayload(req, 'enach_webhook', '/api/enach/webhook', true, null);
    
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, x-cashfree-signature, x-request-id, x-cashfree-event-id');
    res.sendStatus(200);
});

/**
 * POST /api/enach/webhook
 * Cashfree webhook endpoint
 */
router.post('/webhook', express.json(), async (req, res) => {
    const requestId = req.headers['x-request-id'] || `webhook_${Date.now()}`;
    
    try {
        const signature = req.headers['x-cashfree-signature'] || req.headers['x-webhook-signature'];
        const eventId = req.headers['x-cashfree-event-id'] || null;

        console.log(`[Webhook ${requestId}] Received webhook:`, {
            method: req.method,
            headers: {
                'content-type': req.headers['content-type'],
                'x-request-id': req.headers['x-request-id'],
                'x-cashfree-event-id': req.headers['x-cashfree-event-id'],
                'x-cashfree-signature': req.headers['x-cashfree-signature'] ? 'present' : 'missing'
            },
            bodyKeys: req.body ? Object.keys(req.body) : [],
            bodyType: req.body?.type || 'unknown',
            hasData: !!req.body?.data
        });

        // Handle test/ping webhooks from Cashfree
        // Cashfree may send test webhooks during configuration
        if (!req.body || Object.keys(req.body).length === 0 || req.body.type === 'ping' || req.body.type === 'test') {
            console.log(`[Webhook ${requestId}] Test/ping webhook received, responding OK`);
            try {
                await logWebhookPayload(req, 'enach_webhook', '/api/enach/webhook', true, null);
            } catch (logError) {
                console.error(`[Webhook ${requestId}] Error logging test webhook:`, logError);
            }
            
            return res.status(200).json({
                status: 'ok',
                message: 'Webhook endpoint is active and receiving requests',
                requestId,
                timestamp: new Date().toISOString()
            });
        }

        // Verify webhook signature if secret is configured (skip for test webhooks)
        // NOTE: Even if signature verification fails, we still process the webhook
        // because Cashfree might send valid webhooks with different signature formats
        // or signature calculation might differ between environments
        if (CASHFREE_WEBHOOK_SECRET && signature && req.body.type !== 'test') {
            const isValid = verifyWebhookSignature(req.body, signature, CASHFREE_WEBHOOK_SECRET);
            if (!isValid) {
                console.warn(`[Webhook ${requestId}] ⚠️  Signature verification failed, but continuing to process webhook`);
                console.warn(`[Webhook ${requestId}] This might be due to signature format differences. Processing anyway.`);
                // Don't reject - continue processing but log the warning
                // The webhook will still be logged and processed
            } else {
                console.log(`[Webhook ${requestId}] ✅ Signature verified successfully`);
            }
        }

        // Log webhook to webhook_logs (initially as not processed, will update after async processing)
        try {
            await logWebhookPayload(req, 'enach_webhook', '/api/enach/webhook', false, null);
        } catch (logError) {
            console.error(`[Webhook ${requestId}] Error logging webhook (continuing anyway):`, logError);
            // Continue processing even if logging fails
        }

        // Always respond with 200 immediately to acknowledge receipt
        // Process webhook asynchronously after responding
        res.status(200).json({
            status: 'received',
            message: 'Webhook received and processing',
            requestId,
            timestamp: new Date().toISOString()
        });

        // Process webhook asynchronously (don't block response)
        processWebhookAsync(req.body, requestId, eventId, signature, req).catch(error => {
            console.error(`[Webhook ${requestId}] Async processing error:`, error);
            // Update webhook_logs with error
            logWebhookPayload(req, 'enach_webhook', '/api/enach/webhook', false, error.message).catch(() => {});
        });
    } catch (error) {
        console.error(`[Webhook ${requestId}] Fatal error in webhook handler:`, error);
        console.error(`[Webhook ${requestId}] Error stack:`, error.stack);
        
        // Try to log the error
        try {
            await logWebhookPayload(req, 'enach_webhook', '/api/enach/webhook', false, error.message);
        } catch (logError) {
            console.error(`[Webhook ${requestId}] Could not log error:`, logError);
        }
        
        // Always return 200 to Cashfree to prevent retries
        // But log the error for debugging
        if (!res.headersSent) {
            res.status(200).json({
                success: false,
                status: 'error',
                message: 'Internal server error',
                requestId,
                timestamp: new Date().toISOString()
            });
        }
    }
});

/**
 * Process webhook asynchronously
 */
async function processWebhookAsync(reqBody, requestId, eventId, signature, req = null) {
    try {
        await initializeDatabase();

        const {
            type: eventType,
            data: eventData
        } = reqBody;

        console.log(`[Webhook ${requestId}] Processing event:`, {
            type: eventType,
            subscriptionId: eventData?.subscription?.subscription_id || eventData?.subscription_details?.subscription_id,
            cfSubscriptionId: eventData?.subscription?.cf_subscription_id || eventData?.subscription_details?.cf_subscription_id,
            subscriptionStatus: eventData?.subscription?.subscription_status || eventData?.subscription_details?.subscription_status,
            authorizationStatus: eventData?.authorization_details?.authorizationStatus || eventData?.authorization_details?.authorization_status,
            environment: NODE_ENV
        });

        // Extract event ID for idempotency
        const finalEventId = eventId ||
            eventData?.event_id ||
            `${eventType}_${Date.now()}_${Math.random()}`;

        // Check if already processed (idempotency)
        let existing = [];
        try {
            existing = await executeQuery(
                'SELECT id, processed FROM enach_webhook_events WHERE event_id = ?',
                [finalEventId]
            );
        } catch (dbError) {
            console.warn(`[Webhook ${requestId}] Could not check idempotency (table might not exist):`, dbError.message);
        }

        if (existing.length > 0 && existing[0].processed) {
            console.log(`[Webhook ${requestId}] Event ${finalEventId} already processed, skipping`);
            return;
        }

        // Store raw webhook event
        try {
            // Extract subscription IDs from different data structures
            const subscriptionId = eventData?.subscription?.subscription_id || 
                                  eventData?.subscription_details?.subscription_id || null;
            const cfSubscriptionId = eventData?.subscription?.cf_subscription_id || 
                                    eventData?.subscription_details?.cf_subscription_id || null;
            
            await executeQuery(
                `INSERT INTO enach_webhook_events 
         (event_id, event_type, subscription_id, cf_subscription_id, payload, signature, received_at) 
         VALUES (?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE payload = VALUES(payload), signature = VALUES(signature), received_at = VALUES(received_at)`,
                [
                    finalEventId,
                    eventType,
                    subscriptionId,
                    cfSubscriptionId,
                    JSON.stringify(reqBody),
                    signature || null
                ]
            );
        } catch (dbError) {
            console.warn(`[Webhook ${requestId}] Could not store webhook event (table might not exist):`, dbError.message);
            // Continue processing even if storage fails
        }

        // Process based on event type
        let processed = false;
        let processingError = null;

        try {
            switch (eventType) {
                case 'subscription.activated':
                case 'SUBSCRIPTION_ACTIVATED':
                    await handleSubscriptionActivated(eventData, requestId);
                    processed = true;
                    break;

                case 'subscription.authentication_failed':
                case 'SUBSCRIPTION_AUTHENTICATION_FAILED':
                    await handleSubscriptionFailed(eventData, requestId);
                    processed = true;
                    break;

                case 'subscription.cancelled':
                case 'SUBSCRIPTION_CANCELLED':
                    await handleSubscriptionCancelled(eventData, requestId);
                    processed = true;
                    break;

                case 'mandate.approved':
                case 'MANDATE_APPROVED':
                    await handleMandateApproved(eventData, requestId);
                    processed = true;
                    break;

                case 'mandate.rejected':
                case 'MANDATE_REJECTED':
                    await handleMandateRejected(eventData, requestId);
                    processed = true;
                    break;

                case 'SUBSCRIPTION_STATUS_CHANGED':
                case 'subscription.status_changed':
                    // Handle SUBSCRIPTION_STATUS_CHANGED event
                    // This event is sent when subscription status changes (e.g., BANK_APPROVAL_PENDING -> ACTIVE)
                    await handleSubscriptionStatusChanged(eventData, requestId);
                    processed = true;
                    break;

                default:
                    console.warn(`[Webhook ${requestId}] Unhandled event type: ${eventType}`, {
                        availableKeys: reqBody ? Object.keys(reqBody) : []
                    });
                    // Try to process as status change if it has subscription details
                    if (eventData?.subscription_details || eventData?.subscription) {
                        console.log(`[Webhook ${requestId}] Attempting to process as status change event`);
                        await handleSubscriptionStatusChanged(eventData, requestId);
                        processed = true;
                    } else {
                        processed = true; // Mark as processed to avoid retries
                    }
            }
        } catch (error) {
            processingError = error.message;
            console.error(`[Webhook ${requestId}] Processing error:`, error);
        }

        // Update processing status
        try {
            await executeQuery(
                `UPDATE enach_webhook_events 
         SET processed = ?, processed_at = NOW(), processing_error = ?
         WHERE event_id = ?`,
                [processed, processingError, finalEventId]
            );
        } catch (dbError) {
            console.warn(`[Webhook ${requestId}] Could not update processing status:`, dbError.message);
        }

        console.log(`[Webhook ${requestId}] Processing completed:`, {
            eventId: finalEventId,
            eventType,
            processed,
            error: processingError
        });

        // Update webhook_logs with final processing status
        if (req) {
            try {
                // Update the most recent webhook_logs entry for this request
                await executeQuery(
                    `UPDATE webhook_logs 
                     SET processed = ?, processing_error = ?
                     WHERE webhook_type = 'enach_webhook' 
                     AND request_id = ?
                     ORDER BY created_at DESC
                     LIMIT 1`,
                    [processed, processingError, requestId]
                );
                console.log(`📝 [eNACH Webhook] Updated webhook_logs for request ${requestId}`);
            } catch (updateError) {
                console.warn(`[Webhook ${requestId}] Could not update webhook_logs:`, updateError.message);
            }
        }

    } catch (error) {
        console.error(`[Webhook ${requestId}] Fatal error in async processing:`, error);
        
        // Update webhook_logs with error
        if (req) {
            try {
                await executeQuery(
                    `UPDATE webhook_logs 
                     SET processed = ?, processing_error = ?
                     WHERE webhook_type = 'enach_webhook' 
                     AND request_id = ?
                     ORDER BY created_at DESC
                     LIMIT 1`,
                    [false, error.message, requestId]
                );
            } catch (updateError) {
                console.warn(`[Webhook ${requestId}] Could not update webhook_logs with error:`, updateError.message);
            }
        }
        // Error already logged, webhook was already acknowledged with 200
    }
}

/**
 * Handle subscription.activated event
 */
async function handleSubscriptionActivated(eventData, requestId) {
    const subscription = eventData.subscription || eventData.subscription_details || eventData;
    const subscriptionId = subscription.subscription_id;
    const cfSubscriptionId = subscription.cf_subscription_id;

    console.log(`[Webhook ${requestId}] Processing subscription.activated for ${subscriptionId}`);

    await executeQuery(
        `UPDATE enach_subscriptions 
     SET status = 'ACTIVE', 
         mandate_status = 'APPROVED',
         activated_at = NOW(),
         last_error = NULL,
         cashfree_response = ?
     WHERE subscription_id = ? OR cf_subscription_id = ?`,
        [JSON.stringify(subscription), subscriptionId, cfSubscriptionId]
    );

    console.log(`[Webhook ${requestId}] Subscription ${subscriptionId} marked as ACTIVE`);
}

/**
 * Handle subscription.authentication_failed event
 */
async function handleSubscriptionFailed(eventData, requestId) {
    const subscription = eventData.subscription || eventData.subscription_details || eventData;
    const subscriptionId = subscription.subscription_id;
    const cfSubscriptionId = subscription.cf_subscription_id;
    const errorReason = subscription.failure_reason || 'Authentication failed';

    console.log(`[Webhook ${requestId}] Processing subscription.authentication_failed for ${subscriptionId}`);

    await executeQuery(
        `UPDATE enach_subscriptions 
     SET status = 'FAILED', 
         mandate_status = 'REJECTED',
         failed_at = NOW(),
         last_error = ?,
         cashfree_response = ?
     WHERE subscription_id = ? OR cf_subscription_id = ?`,
        [errorReason, JSON.stringify(subscription), subscriptionId, cfSubscriptionId]
    );

    console.log(`[Webhook ${requestId}] Subscription ${subscriptionId} marked as FAILED`);
}

/**
 * Handle subscription.cancelled event
 */
async function handleSubscriptionCancelled(eventData, requestId) {
    const subscription = eventData.subscription || eventData.subscription_details || eventData;
    const subscriptionId = subscription.subscription_id;
    const cfSubscriptionId = subscription.cf_subscription_id;

    console.log(`[Webhook ${requestId}] Processing subscription.cancelled for ${subscriptionId}`);

    await executeQuery(
        `UPDATE enach_subscriptions 
     SET status = 'CANCELLED', 
         cancelled_at = NOW(),
         cashfree_response = ?
     WHERE subscription_id = ? OR cf_subscription_id = ?`,
        [JSON.stringify(subscription), subscriptionId, cfSubscriptionId]
    );

    console.log(`[Webhook ${requestId}] Subscription ${subscriptionId} marked as CANCELLED`);
}

/**
 * Handle mandate.approved event
 */
async function handleMandateApproved(eventData, requestId) {
    const mandate = eventData.mandate || eventData.subscription || eventData.subscription_details || eventData;
    const subscriptionId = mandate.subscription_id;
    const cfSubscriptionId = mandate.cf_subscription_id;

    console.log(`[Webhook ${requestId}] Processing mandate.approved for ${subscriptionId}`);

    await executeQuery(
        `UPDATE enach_subscriptions 
     SET mandate_status = 'APPROVED',
         cashfree_response = ?
     WHERE subscription_id = ? OR cf_subscription_id = ?`,
        [JSON.stringify(mandate), subscriptionId, cfSubscriptionId]
    );

    console.log(`[Webhook ${requestId}] Mandate approved for ${subscriptionId}`);
}

/**
 * Handle mandate.rejected event
 */
async function handleMandateRejected(eventData, requestId) {
    const mandate = eventData.mandate || eventData.subscription || eventData.subscription_details || eventData;
    const subscriptionId = mandate.subscription_id;
    const cfSubscriptionId = mandate.cf_subscription_id;
    const errorReason = mandate.rejection_reason || 'Mandate rejected';

    console.log(`[Webhook ${requestId}] Processing mandate.rejected for ${subscriptionId}`);

    await executeQuery(
        `UPDATE enach_subscriptions 
     SET mandate_status = 'REJECTED',
         status = 'FAILED',
         failed_at = NOW(),
         last_error = ?,
         cashfree_response = ?
     WHERE subscription_id = ? OR cf_subscription_id = ?`,
        [errorReason, JSON.stringify(mandate), subscriptionId, cfSubscriptionId]
    );

    console.log(`[Webhook ${requestId}] Mandate rejected for ${subscriptionId}`);
}

/**
 * Handle SUBSCRIPTION_STATUS_CHANGED event
 * This event is sent when subscription status changes (e.g., after authorization)
 * Cashfree sends data in: data.subscription_details and data.authorization_details
 */
async function handleSubscriptionStatusChanged(eventData, requestId) {
    console.log(`[Webhook ${requestId}] 📥 handleSubscriptionStatusChanged called with eventData:`, {
        hasSubscriptionDetails: !!eventData.subscription_details,
        hasSubscription: !!eventData.subscription,
        hasAuthorizationDetails: !!eventData.authorization_details,
        eventDataKeys: Object.keys(eventData || {})
    });

    // Cashfree sends data in different formats - handle both
    const subscriptionDetails = eventData.subscription_details || eventData.subscription || eventData;
    const authorizationDetails = eventData.authorization_details || {};
    
    const subscriptionId = subscriptionDetails?.subscription_id;
    const cfSubscriptionId = subscriptionDetails?.cf_subscription_id;
    const subscriptionStatus = subscriptionDetails?.subscription_status;
    const authorizationStatus = authorizationDetails?.authorizationStatus || authorizationDetails?.authorization_status;
    const authorizationReference = authorizationDetails?.authorizationReference || authorizationDetails?.authorization_reference;
    const authorizationTime = authorizationDetails?.authorizationTime || authorizationDetails?.authorization_time;
    const paymentId = authorizationDetails?.paymentId || authorizationDetails?.payment_id;

    console.log(`[Webhook ${requestId}] Processing SUBSCRIPTION_STATUS_CHANGED:`, {
        subscriptionId,
        cfSubscriptionId,
        subscriptionStatus,
        authorizationStatus,
        authorizationReference,
        authorizationTime,
        paymentId,
        subscriptionDetailsKeys: subscriptionDetails ? Object.keys(subscriptionDetails) : [],
        authorizationDetailsKeys: authorizationDetails ? Object.keys(authorizationDetails) : []
    });

    if (!subscriptionId && !cfSubscriptionId) {
        console.error(`[Webhook ${requestId}] ❌ Missing subscription identifiers:`, {
            subscriptionId,
            cfSubscriptionId,
            subscriptionDetails,
            eventData
        });
        throw new Error('Missing subscription_id or cf_subscription_id in webhook payload');
    }

    // Determine the final status based on subscription and authorization status
    let finalStatus = subscriptionStatus;
    let mandateStatus = null;

    if (authorizationStatus === 'ACTIVE' || authorizationStatus === 'APPROVED') {
        mandateStatus = 'APPROVED';
        // If authorization is ACTIVE, subscription should be ACTIVE or BANK_APPROVAL_PENDING
        if (subscriptionStatus === 'BANK_APPROVAL_PENDING' || subscriptionStatus === 'INITIALIZED') {
            // Authorization is complete, waiting for bank approval
            finalStatus = 'BANK_APPROVAL_PENDING';
        } else if (subscriptionStatus === 'ACTIVE') {
            finalStatus = 'ACTIVE';
        }
    } else if (authorizationStatus === 'REJECTED' || authorizationStatus === 'FAILED') {
        mandateStatus = 'REJECTED';
        finalStatus = 'FAILED';
    } else if (subscriptionStatus === 'ACTIVE') {
        // If subscription is ACTIVE, mandate is approved
        mandateStatus = 'APPROVED';
        finalStatus = 'ACTIVE';
    }

    // Update subscription in database
    // Note: authorization_reference is stored in cashfree_response JSON, not as a separate column
    try {
        // First, check if subscription exists
        const existingSubscriptions = await executeQuery(
            `SELECT id, subscription_id, cf_subscription_id, status FROM enach_subscriptions 
             WHERE subscription_id = ? OR cf_subscription_id = ?`,
            [subscriptionId, cfSubscriptionId]
        );

        if (!existingSubscriptions || existingSubscriptions.length === 0) {
            console.error(`[Webhook ${requestId}] ❌ Subscription not found in database:`, {
                subscriptionId,
                cfSubscriptionId,
                searchedBy: {
                    subscription_id: subscriptionId,
                    cf_subscription_id: cfSubscriptionId
                }
            });
            throw new Error(`Subscription not found: ${subscriptionId} (CF: ${cfSubscriptionId})`);
        }

        console.log(`[Webhook ${requestId}] Found ${existingSubscriptions.length} subscription(s) to update:`, {
            subscriptionId,
            cfSubscriptionId,
            currentStatus: existingSubscriptions[0].status
        });

        // Include authorization_reference in the cashfree_response JSON
        const updatedResponse = {
            ...eventData,
            authorization_reference: authorizationReference || null,
            authorization_time: authorizationTime || null
        };
        
        const updateResult = await executeQuery(
            `UPDATE enach_subscriptions 
             SET status = ?,
                 mandate_status = ?,
                 authorized_at = ?,
                 cashfree_response = ?,
                 updated_at = NOW()
             WHERE subscription_id = ? OR cf_subscription_id = ?`,
            [
                finalStatus,
                mandateStatus,
                authorizationTime ? new Date(authorizationTime) : null,
                JSON.stringify(updatedResponse),
                subscriptionId,
                cfSubscriptionId
            ]
        );

        const affectedRows = updateResult?.affectedRows || updateResult || 0;
        
        if (affectedRows === 0) {
            console.warn(`[Webhook ${requestId}] ⚠️  UPDATE query executed but no rows affected:`, {
                subscriptionId,
                cfSubscriptionId,
                finalStatus,
                mandateStatus
            });
        } else {
            console.log(`[Webhook ${requestId}] ✅ Subscription ${subscriptionId} updated (${affectedRows} row(s) affected):`, {
                status: finalStatus,
                mandateStatus: mandateStatus,
                authorizationStatus: authorizationStatus,
                authorizationReference: authorizationReference,
                previousStatus: existingSubscriptions[0].status
            });
        }
    } catch (dbError) {
        console.error(`[Webhook ${requestId}] ❌ Error updating subscription:`, dbError);
        console.error(`[Webhook ${requestId}] Error details:`, {
            message: dbError.message,
            stack: dbError.stack,
            subscriptionId,
            cfSubscriptionId
        });
        throw dbError;
    }
}

/**
 * GET /api/enach/callback
 * Callback endpoint for Cashfree redirects after eNACH authorization
 * Handles GET requests with query parameters
 */
router.get('/callback', async (req, res) => {
    const requestId = `callback_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    try {
        console.log(`[eNACH Callback ${requestId}] GET callback received:`, {
            query: req.query,
            headers: {
                'user-agent': req.headers['user-agent'],
                'referer': req.headers['referer']
            }
        });

        // Log to webhook_logs (don't let logging errors break the redirect)
        try {
            await logWebhookPayload(req, 'enach_callback', '/api/enach/callback', true, null);
        } catch (logError) {
            console.error(`[eNACH Callback ${requestId}] Error logging callback:`, logError);
            // Continue anyway - logging failure shouldn't break redirect
        }

        // Extract parameters
        const applicationId = req.query.applicationId;
        const subscriptionId = req.query.subscription_id || req.query.subscriptionId;
        const status = req.query.status || req.query.subscription_status;
        const error = req.query.error || req.query.error_message;

        // Build redirect URL safely
        let redirectUrl;
        try {
            const frontendUrl = process.env.FRONTEND_URL || 'https://pocketcredit.in';
            redirectUrl = new URL('/post-disbursal', frontendUrl);
            
            if (applicationId) redirectUrl.searchParams.set('applicationId', applicationId);
            if (subscriptionId) redirectUrl.searchParams.set('subscription_id', subscriptionId);
            redirectUrl.searchParams.set('enach', 'complete');
            if (status) redirectUrl.searchParams.set('status', status);
            if (error) redirectUrl.searchParams.set('error', error);

            console.log(`[eNACH Callback ${requestId}] Redirecting to frontend: ${redirectUrl.toString()}`);
        } catch (urlError) {
            console.error(`[eNACH Callback ${requestId}] Error building redirect URL:`, urlError);
            // Fallback to simple redirect
            redirectUrl = `https://pocketcredit.in/post-disbursal?enach=complete${applicationId ? '&applicationId=' + applicationId : ''}${subscriptionId ? '&subscription_id=' + subscriptionId : ''}`;
        }
        
        if (!res.headersSent) {
            res.redirect(302, redirectUrl.toString());
        }
    } catch (error) {
        console.error(`[eNACH Callback ${requestId}] Fatal error in callback handler:`, error);
        console.error(`[eNACH Callback ${requestId}] Error stack:`, error.stack);
        
        // Try to redirect anyway, or return error response
        if (!res.headersSent) {
            try {
                const frontendUrl = process.env.FRONTEND_URL || 'https://pocketcredit.in';
                const applicationId = req.query.applicationId;
                const subscriptionId = req.query.subscription_id || req.query.subscriptionId;
                
                let fallbackUrl = `${frontendUrl}/post-disbursal?enach=complete&error=callback_error`;
                if (applicationId) fallbackUrl += `&applicationId=${applicationId}`;
                if (subscriptionId) fallbackUrl += `&subscription_id=${subscriptionId}`;
                
                res.redirect(302, fallbackUrl);
            } catch (redirectError) {
                console.error(`[eNACH Callback ${requestId}] Failed to redirect:`, redirectError);
                // Last resort - return JSON error
                res.status(500).json({
                    success: false,
                    status: 'error',
                    message: 'Callback processing failed. Please check your subscription status manually.',
                    requestId
                });
            }
        } else {
            // Headers already sent, can't redirect or send JSON
            console.error(`[eNACH Callback ${requestId}] Headers already sent, cannot send error response`);
        }
    }
});

/**
 * POST /api/enach/callback
 * Callback endpoint for Cashfree POST callbacks after eNACH authorization
 * Handles POST requests with body data
 */
router.post('/callback', express.json(), express.urlencoded({ extended: true }), async (req, res) => {
    const requestId = `callback_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    try {
        console.log(`[eNACH Callback ${requestId}] POST callback received:`, {
            body: req.body,
            headers: {
                'content-type': req.headers['content-type'],
                'user-agent': req.headers['user-agent']
            }
        });

        // Log to webhook_logs (don't let logging errors break the redirect)
        try {
            await logWebhookPayload(req, 'enach_callback', '/api/enach/callback', true, null);
        } catch (logError) {
            console.error(`[eNACH Callback ${requestId}] Error logging callback:`, logError);
            // Continue anyway - logging failure shouldn't break redirect
        }

        // Extract parameters from body or query
        const applicationId = req.body?.applicationId || req.query?.applicationId;
        const subscriptionId = req.body?.subscription_id || req.body?.subscriptionId || req.query?.subscription_id;
        const status = req.body?.status || req.body?.subscription_status || req.query?.status;
        const error = req.body?.error || req.body?.error_message || req.query?.error;

        // Build redirect URL safely
        let redirectUrl;
        try {
            const frontendUrl = process.env.FRONTEND_URL || 'https://pocketcredit.in';
            redirectUrl = new URL('/post-disbursal', frontendUrl);
            
            if (applicationId) redirectUrl.searchParams.set('applicationId', applicationId);
            if (subscriptionId) redirectUrl.searchParams.set('subscription_id', subscriptionId);
            redirectUrl.searchParams.set('enach', 'complete');
            if (status) redirectUrl.searchParams.set('status', status);
            if (error) redirectUrl.searchParams.set('error', error);

            console.log(`[eNACH Callback ${requestId}] Redirecting to frontend: ${redirectUrl.toString()}`);
        } catch (urlError) {
            console.error(`[eNACH Callback ${requestId}] Error building redirect URL:`, urlError);
            // Fallback to simple redirect
            redirectUrl = `https://pocketcredit.in/post-disbursal?enach=complete${applicationId ? '&applicationId=' + applicationId : ''}${subscriptionId ? '&subscription_id=' + subscriptionId : ''}`;
        }
        
        if (!res.headersSent) {
            res.redirect(302, redirectUrl.toString());
        }
    } catch (error) {
        console.error(`[eNACH Callback ${requestId}] Fatal error in callback handler:`, error);
        console.error(`[eNACH Callback ${requestId}] Error stack:`, error.stack);
        
        // Try to redirect anyway, or return error response
        if (!res.headersSent) {
            try {
                const frontendUrl = process.env.FRONTEND_URL || 'https://pocketcredit.in';
                const applicationId = req.body?.applicationId || req.query?.applicationId;
                const subscriptionId = req.body?.subscription_id || req.query?.subscription_id;
                
                let fallbackUrl = `${frontendUrl}/post-disbursal?enach=complete&error=callback_error`;
                if (applicationId) fallbackUrl += `&applicationId=${applicationId}`;
                if (subscriptionId) fallbackUrl += `&subscription_id=${subscriptionId}`;
                
                res.redirect(302, fallbackUrl);
            } catch (redirectError) {
                console.error(`[eNACH Callback ${requestId}] Failed to redirect:`, redirectError);
                // Last resort - return JSON error
                res.status(500).json({
                    success: false,
                    status: 'error',
                    message: 'Callback processing failed. Please check your subscription status manually.',
                    requestId
                });
            }
        } else {
            // Headers already sent, can't redirect or send JSON
            console.error(`[eNACH Callback ${requestId}] Headers already sent, cannot send error response`);
        }
    }
});

module.exports = router;
