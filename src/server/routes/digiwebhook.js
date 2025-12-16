const express = require('express');
const router = express.Router();
const { executeQuery, initializeDatabase } = require('../config/database');

/**
 * Helper function to log webhook payloads to database
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

    // Extract common fields
    const requestId = req.body?.txnId || req.body?.transactionId || req.query?.txnId || req.query?.transactionId || null;
    const clientRefNum = req.body?.client_ref_num || req.query?.client_ref_num || null;
    const status = req.body?.success || req.query?.success || req.body?.status || null;

    // Get client IP
    const ipAddress = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || null;
    const userAgent = req.headers['user-agent'] || null;

    // Store raw payload as string
    const rawPayload = JSON.stringify({
      method: req.method,
      url: req.url,
      headers: headers,
      query: req.query,
      body: req.body
    }, null, 2);

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
        requestId,
        clientRefNum,
        status,
        ipAddress,
        userAgent,
        processed,
        error
      ]
    );

    console.log(`📝 Webhook logged: ${webhookType} - ${req.method} ${endpoint}`);
  } catch (logError) {
    console.error('❌ Error logging webhook:', logError);
    // Don't throw - logging failure shouldn't break webhook processing
  }
}

/**
 * GET /api/digiwebhook
 * Webhook endpoint to receive KYC completion callback from Digilocker
 * Example: /api/digiwebhook?txnId=201647298824594329&success=true
 */
// Helper to render a debug HTML page that prints everything received
function renderDebugPage(req, res) {
  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Digilocker Webhook Debug</title>
  <style>body{font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Arial,sans-serif;padding:20px;line-height:1.45}pre{background:#0b1020;color:#e5e7eb;padding:16px;border-radius:8px;overflow:auto}h1{margin:0 0 12px}</style>
  </head><body>
    <h1>Digilocker Webhook - Received Payload</h1>
    <p><strong>Method:</strong> ${req.method}</p>
    <p><strong>URL:</strong> ${req.protocol}://${req.get('host')}${req.originalUrl}</p>
    <h3>Headers</h3>
    <pre>${JSON.stringify(req.headers, null, 2)}</pre>
    <h3>Query</h3>
    <pre>${JSON.stringify(req.query || {}, null, 2)}</pre>
    <h3>Body</h3>
    <pre>${JSON.stringify(req.body || {}, null, 2)}</pre>
  </body></html>`;
  res.status(200).send(html);
}

router.get('/', async (req, res) => {
  let processingError = null;
  const debug = req.query.debug === '1' || req.query.debug === 'true';
  const { txnId, success } = req.query;

  // Log webhook payload to database FIRST
  await logWebhookPayload(req, 'digiwebhook', '/api/digiwebhook', false, null);

  console.log('🔔 Digilocker Webhook (GET):', { txnId, success });

  if (debug) {
    return renderDebugPage(req, res);
  }

  if (!txnId) {
    return res.status(400).send('Missing transaction ID');
  }

  try {
    await initializeDatabase();

    // Find the KYC verification by transaction ID
    const kycRecords = await executeQuery(
      `SELECT id, user_id, verification_data 
       FROM kyc_verifications 
       WHERE JSON_EXTRACT(verification_data, '$.transactionId') = ?`,
      [txnId]
    );

    if (kycRecords.length === 0) {
      console.error('❌ KYC record not found for txnId:', txnId);
      const frontendUrl = process.env.FRONTEND_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://pocketcredit.in');
      return res.redirect(`${frontendUrl}/kyc-failed?reason=record_not_found`);
    }

    const kycRecord = kycRecords[0];
    console.log('✅ Webhook found KYC Record:', { id: kycRecord.id, user_id: kycRecord.user_id });

    // Find the latest application for this user for redirect purposes
    let applicationId = null;
    try {
      const appCheck = await executeQuery(
        'SELECT id FROM applications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
        [kycRecord.user_id]
      );
      if (appCheck.length > 0) {
        applicationId = appCheck[0].id;
        console.log('✨ Found latest application_id for redirect:', applicationId);
      }
    } catch (err) {
      console.error('❌ Error fetching application for redirect:', err);
    }

    const isSuccess = success === 'true' || success === true;

    if (isSuccess) {
      // If provider sends full data in webhook via configuration, persist it for audit
      if (req.query.data || (req.body && req.body.data)) {
        const payloadData = req.query.data || req.body.data;
        try {
          const parsed = typeof payloadData === 'string' ? JSON.parse(payloadData) : payloadData;
          await executeQuery(
            `UPDATE kyc_verifications SET verification_data = JSON_SET(COALESCE(verification_data,'{}'), '$.kycData', ?) WHERE id = ?`,
            [JSON.stringify(parsed), kycRecord.id]
          );
        } catch (e) {
          console.warn('⚠️ Failed to parse webhook data JSON, storing raw:', e?.message);
          await executeQuery(
            `UPDATE kyc_verifications SET verification_data = JSON_SET(COALESCE(verification_data,'{}'), '$.kycDataRaw', ?) WHERE id = ?`,
            [String(payloadData), kycRecord.id]
          );
        }
      }
      // TODO: Fetch actual KYC data from Digilocker
      // Call Digilocker API to get user details using transactionId
      // For now, we'll add a placeholder

      // Update KYC status to verified
      await executeQuery(
        `UPDATE kyc_verifications 
         SET kyc_status = 'verified', 
             verified_at = NOW(), 
             updated_at = NOW() 
         WHERE id = ?`,
        [kycRecord.id]
      );

      // Update user's KYC status
      await executeQuery(
        'UPDATE users SET kyc_completed = TRUE, updated_at = NOW() WHERE id = ?',
        [kycRecord.user_id]
      );

      console.log('✅ KYC Verified successfully for user:', kycRecord.user_id);

      // Update webhook log as processed
      await logWebhookPayload(req, 'digiwebhook', '/api/digiwebhook', true, null);

      // Redirect WITHOUT kycSuccess param - frontend will check DB
      const frontendUrl = process.env.FRONTEND_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://pocketcredit.in');
      const redirectUrl = applicationId 
        ? `${frontendUrl}/loan-application/kyc-check?applicationId=${applicationId}`
        : `${frontendUrl}/loan-application/kyc-check`;
      res.redirect(redirectUrl);
    } else {
      // Update KYC status to failed
      await executeQuery(
        `UPDATE kyc_verifications 
         SET kyc_status = 'failed', 
             updated_at = NOW() 
         WHERE id = ?`,
        [kycRecord.id]
      );

      console.log('❌ KYC Failed for user:', kycRecord.user_id);

      // Update webhook log as processed
      await logWebhookPayload(req, 'digiwebhook', '/api/digiwebhook', true, null);

      // Redirect WITHOUT kycFailed param - frontend will check DB
      const frontendUrl = process.env.FRONTEND_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://pocketcredit.in');
      const redirectUrl = applicationId 
        ? `${frontendUrl}/loan-application/kyc-check?applicationId=${applicationId}`
        : `${frontendUrl}/loan-application/kyc-check`;
      res.redirect(redirectUrl);
    }

  } catch (error) {
    processingError = error.message || 'Unknown error';
    console.error('❌ Webhook processing error:', error);

    // Update webhook log with error
    await logWebhookPayload(req, 'digiwebhook', '/api/digiwebhook', false, processingError);

    const frontendUrl = process.env.FRONTEND_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://pocketcredit.in');
    res.redirect(`${frontendUrl}/kyc-failed?reason=processing_error`);
  }
});

// Support POST webhook as well (some providers send POST with JSON/form)
router.post('/', async (req, res) => {
  let processingError = null;
  const debug = (req.query && (req.query.debug === '1' || req.query.debug === 'true')) || false;
  const txnId = (req.body && (req.body.txnId || req.body.transactionId)) || req.query.txnId;
  const successParam = (req.body && (req.body.success || req.body.status)) || req.query.success;
  const isSuccess = successParam === 'true' || successParam === true || successParam === 'success';

  // Log webhook payload to database FIRST
  await logWebhookPayload(req, 'digiwebhook', '/api/digiwebhook', false, null);

  console.log('🔔 Digilocker Webhook (POST):', { txnId, success: successParam });

  if (debug) {
    return renderDebugPage(req, res);
  }

  if (!txnId) {
    return res.status(400).send('Missing transaction ID');
  }

  try {
    await initializeDatabase();

    const kycRecords = await executeQuery(
      `SELECT id, user_id, verification_data 
       FROM kyc_verifications 
       WHERE JSON_EXTRACT(verification_data, '$.transactionId') = ?`,
      [txnId]
    );

    if (kycRecords.length === 0) {
      console.error('❌ KYC record not found for txnId (POST):', txnId);
      return res.status(404).json({ success: false, message: 'KYC record not found' });
    }

    const kycRecord = kycRecords[0];

    if (isSuccess) {
      await executeQuery(
        `UPDATE kyc_verifications 
         SET kyc_status = 'verified', 
             verified_at = NOW(), 
             updated_at = NOW() 
         WHERE id = ?`,
        [kycRecord.id]
      );

      await executeQuery(
        'UPDATE users SET kyc_completed = TRUE, updated_at = NOW() WHERE id = ?',
        [kycRecord.user_id]
      );

      console.log('✅ KYC Verified successfully for user (POST):', kycRecord.user_id);

      // Update webhook log as processed
      await logWebhookPayload(req, 'digiwebhook', '/api/digiwebhook', true, null);

      return res.status(200).json({ success: true, message: 'KYC verified' });
    } else {
      await executeQuery(
        `UPDATE kyc_verifications 
         SET kyc_status = 'failed', 
             updated_at = NOW() 
         WHERE id = ?`,
        [kycRecord.id]
      );

      console.log('❌ KYC Failed for user (POST):', kycRecord.user_id);

      // Update webhook log as processed
      await logWebhookPayload(req, 'digiwebhook', '/api/digiwebhook', true, null);

      return res.status(200).json({ success: false, message: 'KYC failed' });
    }
  } catch (error) {
    processingError = error.message || 'Unknown error';
    console.error('❌ Webhook POST processing error:', error);

    // Update webhook log with error
    await logWebhookPayload(req, 'digiwebhook', '/api/digiwebhook', false, processingError);

    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;

