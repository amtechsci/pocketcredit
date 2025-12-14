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

// Webhook signature verification (if Cashfree provides it)
function verifyWebhookSignature(payload, signature, secret) {
    if (!secret || !signature) {
        console.warn('[Webhook] Signature verification skipped - no secret configured');
        return true; // Skip if not configured
    }

    const computed = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');

    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(computed)
    );
}

/**
 * POST /api/enach/webhook
 * Cashfree webhook endpoint
 */
router.post('/webhook', express.json(), async (req, res) => {
    const requestId = req.headers['x-request-id'] || `webhook_${Date.now()}`;

    console.log(`[Webhook ${requestId}] Received event:`, {
        type: req.body.type,
        subscriptionId: req.body.data?.subscription?.subscription_id
    });

    try {
        await initializeDatabase();

        const {
            type: eventType,
            data: eventData
        } = req.body;

        // Extract event ID for idempotency
        const eventId = req.headers['x-cashfree-event-id'] ||
            eventData?.event_id ||
            `${eventType}_${Date.now()}_${Math.random()}`;

        // Check if already processed (idempotency)
        const existing = await executeQuery(
            'SELECT id, processed FROM enach_webhook_events WHERE event_id = ?',
            [eventId]
        );

        if (existing.length > 0 && existing[0].processed) {
            console.log(`[Webhook ${requestId}] Event ${eventId} already processed, skipping`);
            return res.status(200).json({ status: 'already_processed' });
        }

        // Store raw webhook event
        await executeQuery(
            `INSERT INTO enach_webhook_events 
       (event_id, event_type, subscription_id, cf_subscription_id, payload, signature, received_at) 
       VALUES (?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE payload = VALUES(payload), signature = VALUES(signature)`,
            [
                eventId,
                eventType,
                eventData?.subscription?.subscription_id || null,
                eventData?.subscription?.cf_subscription_id || null,
                JSON.stringify(req.body),
                req.headers['x-webhook-signature'] || null
            ]
        );

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

                default:
                    console.warn(`[Webhook ${requestId}] Unhandled event type: ${eventType}`);
                    processed = true; // Mark as processed to avoid retries
            }
        } catch (error) {
            processingError = error.message;
            console.error(`[Webhook ${requestId}] Processing error:`, error);
        }

        // Update processing status
        await executeQuery(
            `UPDATE enach_webhook_events 
       SET processed = ?, processed_at = NOW(), processing_error = ?
       WHERE event_id = ?`,
            [processed, processingError, eventId]
        );

        // Always return 200 to Cashfree to acknowledge receipt
        res.status(200).json({
            status: processed ? 'success' : 'error',
            eventId,
            requestId
        });

    } catch (error) {
        console.error(`[Webhook ${requestId}] Fatal error:`, error);

        // Still return 200 to avoid retries on permanent failures
        res.status(200).json({
            status: 'error',
            message: 'Internal processing error',
            requestId
        });
    }
});

/**
 * Handle subscription.activated event
 */
async function handleSubscriptionActivated(eventData, requestId) {
    const subscription = eventData.subscription || eventData;
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
    const subscription = eventData.subscription || eventData;
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
    const subscription = eventData.subscription || eventData;
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
    const mandate = eventData.mandate || eventData.subscription || eventData;
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
    const mandate = eventData.mandate || eventData.subscription || eventData;
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

module.exports = router;
