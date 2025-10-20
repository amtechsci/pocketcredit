const express = require('express');
const router = express.Router();
const { executeQuery, initializeDatabase } = require('../config/database');

/**
 * GET /api/digiwebhook
 * Webhook endpoint to receive KYC completion callback from Digilocker
 * Example: /api/digiwebhook?txnId=201647298824594329&success=true
 */
router.get('/', async (req, res) => {
  const { txnId, success } = req.query;

  console.log('🔔 Digilocker Webhook Called:', { txnId, success });

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

module.exports = router;

