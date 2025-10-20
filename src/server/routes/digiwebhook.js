const express = require('express');
const router = express.Router();
const { executeQuery, initializeDatabase } = require('../config/database');

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
  const debug = req.query.debug === '1' || req.query.debug === 'true';
  const { txnId, success } = req.query;

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
      `SELECT id, user_id, application_id, verification_data 
       FROM kyc_verifications 
       WHERE JSON_EXTRACT(verification_data, '$.transactionId') = ?`,
      [txnId]
    );

    if (kycRecords.length === 0) {
      console.error('❌ KYC record not found for txnId:', txnId);
      return res.redirect(`${process.env.FRONTEND_URL || 'https://pocketcredit.in'}/kyc-failed?reason=record_not_found`);
    }

    const kycRecord = kycRecords[0];
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

      // Redirect WITHOUT kycSuccess param - frontend will check DB
      res.redirect(`${process.env.FRONTEND_URL || 'https://pocketcredit.in'}/loan-application/kyc-check?applicationId=${kycRecord.application_id}`);
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

      // Redirect WITHOUT kycFailed param - frontend will check DB
      res.redirect(`${process.env.FRONTEND_URL || 'https://pocketcredit.in'}/loan-application/kyc-check?applicationId=${kycRecord.application_id}`);
    }

  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'https://pocketcredit.in'}/kyc-failed?reason=processing_error`);
  }
});

// Support POST webhook as well (some providers send POST with JSON/form)
router.post('/', async (req, res) => {
  const debug = (req.query && (req.query.debug === '1' || req.query.debug === 'true')) || false;
  const txnId = (req.body && (req.body.txnId || req.body.transactionId)) || req.query.txnId;
  const successParam = (req.body && (req.body.success || req.body.status)) || req.query.success;
  const isSuccess = successParam === 'true' || successParam === true || successParam === 'success';

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
      `SELECT id, user_id, application_id, verification_data 
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
      return res.status(200).json({ success: false, message: 'KYC failed' });
    }
  } catch (error) {
    console.error('❌ Webhook POST processing error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;

