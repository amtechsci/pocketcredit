const express = require('express');
const router = express.Router();
const { initializeDatabase, executeQuery } = require('../config/database');

/**
 * POST /api/clickwrap/webhook
 * Webhook endpoint for Digitap ClickWrap signing completion
 * This is called by Digitap when a document is signed
 */
router.post('/webhook', async (req, res) => {
  try {
    console.log('📥 ClickWrap webhook received:', JSON.stringify(req.body, null, 2));

    const webhookData = req.body;
    const { docTransactionId, entTransactionId, 'signers-info': signersInfo } = webhookData;

    if (!docTransactionId && !entTransactionId) {
      console.warn('⚠️ Webhook missing transaction IDs');
      return res.status(400).json({
        success: false,
        message: 'Missing transaction IDs'
      });
    }

    await initializeDatabase();

    // Find loan application by transaction ID
    const transactionId = entTransactionId || docTransactionId;
    const [applications] = await executeQuery(
      `SELECT id, user_id, status 
       FROM loan_applications 
       WHERE clickwrap_ent_transaction_id = ? OR clickwrap_doc_transaction_id = ?`,
      [transactionId, transactionId]
    );

    if (!applications || applications.length === 0) {
      console.warn('⚠️ No loan application found for transaction:', transactionId);
      return res.status(404).json({
        success: false,
        message: 'Loan application not found for this transaction'
      });
    }

    const application = applications[0];

    // Check if all signers have signed
    const allSigned = signersInfo && signersInfo.every((signer) => signer.status === 'SIGNED');

    if (allSigned) {
      // Determine new status based on current status
      // Repeat loans: repeat_disbursal -> ready_to_repeat_disbursal
      // Regular loans: disbursal -> ready_for_disbursement
      const isRepeatLoan = application.status === 'repeat_disbursal';
      const newStatus = isRepeatLoan ? 'ready_to_repeat_disbursal' : 'ready_for_disbursement';
      
      // Update agreement as signed and set status based on loan type
      // This matches the behavior when frontend manually sets agreement_signed
      await executeQuery(
        `UPDATE loan_applications 
         SET agreement_signed = 1,
             status = ?,
             clickwrap_signed_at = NOW(),
             clickwrap_webhook_data = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [newStatus, JSON.stringify(webhookData), application.id]
      );

      console.log(`✅ Loan agreement marked as signed for application: ${application.id}`);
      console.log(`✅ Loan status updated from ${application.status} to ${newStatus}`);
    } else {
      // Store webhook data but don't mark as signed yet
      await executeQuery(
        `UPDATE loan_applications 
         SET clickwrap_webhook_data = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [JSON.stringify(webhookData), application.id]
      );

      console.log('ℹ️ Webhook received but not all signers have signed yet');
    }

    // Always return success to Digitap
    res.json({
      success: true,
      message: 'Webhook processed successfully'
    });

  } catch (error) {
    console.error('❌ ClickWrap webhook error:', error);
    // Still return success to prevent Digitap from retrying
    res.json({
      success: true,
      message: 'Webhook received (processing error logged)'
    });
  }
});

module.exports = router;

