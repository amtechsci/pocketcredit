/**
 * Cashfree Payout Webhooks Handler
 * 
 * Handles webhook events for payout transfers:
 * - TRANSFER_SUCCESS
 * - TRANSFER_FAILED
 * - TRANSFER_REVERSED
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
            console.warn('[PayoutWebhook] WARNING: Signature verification skipped in production - webhook secret not configured');
        } else {
            console.warn('[PayoutWebhook] Signature verification skipped - no secret configured');
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
        console.error('[PayoutWebhook] Signature verification error:', error);
        return false;
    }
}

/**
 * GET /api/payout/webhook
 * Test endpoint to verify webhook route is accessible
 */
router.get('/webhook', async (req, res) => {
    res.json({
        status: 'ok',
        message: 'Cashfree Payout webhook endpoint is accessible',
        method: 'GET',
        timestamp: new Date().toISOString()
    });
});

/**
 * OPTIONS /api/payout/webhook
 * Handle CORS preflight requests
 */
router.options('/webhook', (req, res) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, x-cashfree-signature, x-request-id, x-cashfree-event-id');
    res.sendStatus(200);
});

/**
 * POST /api/payout/webhook
 * Cashfree Payout webhook endpoint
 */
router.post('/webhook', express.json(), async (req, res) => {
    const requestId = req.headers['x-request-id'] || `webhook_${Date.now()}`;
    const signature = req.headers['x-cashfree-signature'] || req.headers['x-webhook-signature'];
    const eventId = req.headers['x-cashfree-event-id'] || null;

    console.log(`[PayoutWebhook ${requestId}] Received webhook:`, {
        method: req.method,
        headers: {
            'content-type': req.headers['content-type'],
            'x-request-id': req.headers['x-request-id'],
            'x-cashfree-event-id': req.headers['x-cashfree-event-id'],
            'x-cashfree-signature': req.headers['x-cashfree-signature'] ? 'present' : 'missing'
        },
        bodyKeys: req.body ? Object.keys(req.body) : [],
        bodyType: req.body?.type || req.body?.eventType || 'unknown'
    });

    // Handle test/ping webhooks from Cashfree
    if (!req.body || Object.keys(req.body).length === 0 || 
        req.body.type === 'ping' || req.body.type === 'test' ||
        req.body.eventType === 'ping' || req.body.eventType === 'test') {
        console.log(`[PayoutWebhook ${requestId}] Test/ping webhook received, responding OK`);
        return res.status(200).json({
            status: 'ok',
            message: 'Payout webhook endpoint is active and receiving requests',
            requestId,
            timestamp: new Date().toISOString()
        });
    }

    // Verify webhook signature if secret is configured
    if (CASHFREE_WEBHOOK_SECRET && signature && req.body.type !== 'test') {
        const isValid = verifyWebhookSignature(req.body, signature, CASHFREE_WEBHOOK_SECRET);
        if (!isValid) {
            console.error(`[PayoutWebhook ${requestId}] Invalid signature - rejecting webhook`);
            return res.status(200).json({
                status: 'error',
                message: 'Invalid webhook signature',
                requestId
            });
        }
    }

    // Always respond with 200 immediately to acknowledge receipt
    res.status(200).json({
        status: 'received',
        message: 'Webhook received and processing',
        requestId,
        timestamp: new Date().toISOString()
    });

    // Process webhook asynchronously
    processPayoutWebhookAsync(req.body, requestId, eventId, signature).catch(error => {
        console.error(`[PayoutWebhook ${requestId}] Async processing error:`, error);
    });
});

/**
 * Process payout webhook asynchronously
 */
async function processPayoutWebhookAsync(reqBody, requestId, eventId, signature) {
    try {
        await initializeDatabase();

        // Extract event details
        const eventType = reqBody.type || reqBody.eventType;
        const transferData = reqBody.data || reqBody;

        console.log(`[PayoutWebhook ${requestId}] Processing event:`, {
            eventType,
            transferId: transferData?.transferId || transferData?.transfer_id,
            status: transferData?.status
        });

        const transferId = transferData?.transferId || transferData?.transfer_id;

        if (!transferId) {
            console.warn(`[PayoutWebhook ${requestId}] No transfer ID found in webhook payload`);
            return;
        }

        // Store webhook event
        try {
            await executeQuery(
                `INSERT INTO payout_webhook_events 
                (event_id, event_type, transfer_id, payload, signature, received_at) 
                VALUES (?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE payload = VALUES(payload), signature = VALUES(signature), received_at = VALUES(received_at)`,
                [
                    eventId || `${eventType}_${Date.now()}_${Math.random()}`,
                    eventType,
                    transferId,
                    JSON.stringify(reqBody),
                    signature || null
                ]
            );
        } catch (dbError) {
            console.warn(`[PayoutWebhook ${requestId}] Could not store webhook event:`, dbError.message);
        }

        // Update payout transaction status based on event type
        let newStatus = null;
        let processed = false;

        try {
            switch (eventType) {
                case 'TRANSFER_SUCCESS':
                case 'transfer.success':
                    newStatus = 'SUCCESS';
                    await executeQuery(`
                        UPDATE payout_transactions 
                        SET 
                            status = 'SUCCESS',
                            cashfree_response = ?,
                            updated_at = NOW()
                        WHERE transfer_id = ?
                    `, [JSON.stringify(transferData), transferId]);
                    processed = true;
                    console.log(`[PayoutWebhook ${requestId}] Transfer ${transferId} marked as SUCCESS`);

                    // Update partner leads if loan is linked and disbursed
                    try {
                        const payoutTransaction = await executeQuery(
                            `SELECT loan_application_id, amount FROM payout_transactions WHERE transfer_id = ? LIMIT 1`,
                            [transferId]
                        );
                        
                        if (payoutTransaction && payoutTransaction.length > 0 && payoutTransaction[0].loan_application_id) {
                            const loanAppId = payoutTransaction[0].loan_application_id;
                            const loan = await executeQuery(
                                `SELECT id, loan_amount, disbursal_amount, disbursed_at, status FROM loan_applications WHERE id = ?`,
                                [loanAppId]
                            );
                            
                            if (loan && loan.length > 0 && loan[0].disbursed_at && loan[0].status === 'account_manager') {
                                const { updateLeadPayout } = require('../services/partnerPayoutService');
                                const partnerLeads = await executeQuery(
                                    `SELECT id FROM partner_leads WHERE loan_application_id = ? LIMIT 1`,
                                    [loanAppId]
                                );
                                
                                if (partnerLeads && partnerLeads.length > 0) {
                                    const disbursalAmount = loan[0].disbursal_amount || loan[0].loan_amount;
                                    await updateLeadPayout(
                                        partnerLeads[0].id,
                                        disbursalAmount,
                                        new Date(loan[0].disbursed_at)
                                    );
                                    console.log(`[PayoutWebhook ${requestId}] Updated partner lead payout for lead ${partnerLeads[0].id} (from webhook)`);
                                }
                            }
                        }
                    } catch (partnerError) {
                        console.error(`[PayoutWebhook ${requestId}] Error updating partner lead payout:`, partnerError);
                        // Don't fail webhook processing if partner update fails
                    }
                    break;

                case 'TRANSFER_FAILED':
                case 'transfer.failed':
                    newStatus = 'FAILED';
                    await executeQuery(`
                        UPDATE payout_transactions 
                        SET 
                            status = 'FAILED',
                            failure_reason = ?,
                            cashfree_response = ?,
                            updated_at = NOW()
                        WHERE transfer_id = ?
                    `, [
                        transferData?.failureReason || transferData?.failure_reason || 'Transfer failed',
                        JSON.stringify(transferData),
                        transferId
                    ]);
                    processed = true;
                    console.log(`[PayoutWebhook ${requestId}] Transfer ${transferId} marked as FAILED`);
                    break;

                case 'TRANSFER_REVERSED':
                case 'transfer.reversed':
                    newStatus = 'REVERSED';
                    await executeQuery(`
                        UPDATE payout_transactions 
                        SET 
                            status = 'REVERSED',
                            cashfree_response = ?,
                            updated_at = NOW()
                        WHERE transfer_id = ?
                    `, [JSON.stringify(transferData), transferId]);
                    processed = true;
                    console.log(`[PayoutWebhook ${requestId}] Transfer ${transferId} marked as REVERSED`);
                    break;

                default:
                    console.warn(`[PayoutWebhook ${requestId}] Unhandled event type: ${eventType}`);
                    processed = true; // Mark as processed to avoid retries
            }
        } catch (updateError) {
            console.error(`[PayoutWebhook ${requestId}] Error updating transaction status:`, updateError);
        }

        console.log(`[PayoutWebhook ${requestId}] Processing completed:`, {
            eventId,
            eventType,
            transferId,
            newStatus,
            processed
        });

    } catch (error) {
        console.error(`[PayoutWebhook ${requestId}] Fatal error in async processing:`, error);
    }
}

module.exports = router;

