const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/jwtAuth');
const { initializeDatabase, executeQuery } = require('../config/database');
const {
  initiateClickWrap,
  uploadDocumentToDigitap,
  sendSignInLink,
  getSignedDocumentUrl
} = require('../services/digitapClickWrapService');
const pdfService = require('../services/pdfService');

/**
 * POST /api/clickwrap/initiate
 * Initiate ClickWrap transaction and get upload URL
 */
router.post('/initiate', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;
    const { applicationId } = req.body;

    if (!applicationId) {
      return res.status(400).json({
        success: false,
        message: 'Application ID is required'
      });
    }

    // Verify application belongs to user
    const [application] = await executeQuery(
      'SELECT id, user_id, status FROM loan_applications WHERE id = ? AND user_id = ?',
      [applicationId, userId]
    );

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found or access denied'
      });
    }

    // Get user details
    const [user] = await executeQuery(
      'SELECT first_name, last_name, email, phone, personal_email, official_email FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Use personal_email, official_email, or email (in priority order)
    const email = user.personal_email || user.official_email || user.email;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'User email is required for e-signature. Please update your profile with an email address.'
      });
    }

    // Get mobile number
    const mobile = user.phone;
    if (!mobile) {
      return res.status(400).json({
        success: false,
        message: 'User mobile number is required for OTP. Please update your profile with a mobile number.'
      });
    }

    // Get and validate names
    // If first_name or last_name is missing, use fallback values
    let fname = user.first_name;
    let lname = user.last_name;

    // If either name is missing, provide defaults
    if (!fname && !lname) {
      // Both names missing - use "User" as fallback
      fname = 'User';
      lname = '';
    } else if (!fname) {
      // First name missing - use last name as first name
      fname = lname;
      lname = '';
    } else if (!lname) {
      // Last name missing - keep first name, use empty string for last name
      lname = '';
    }

    // Clean and validate mobile number
    const cleanMobile = mobile.replace(/\D/g, '').slice(-10);
    if (cleanMobile.length !== 10 || !/^[6-9]\d{9}$/.test(cleanMobile)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid mobile number format. Must be 10 digits starting with 6-9.'
      });
    }

    // Initiate ClickWrap
    const initiateResult = await initiateClickWrap({
      fname: fname.trim(),
      lname: lname.trim(),
      email: email.trim(),
      mobile: cleanMobile,
      reason: 'loan_agreement'
    });

    if (!initiateResult.success) {
      return res.status(500).json({
        success: false,
        message: initiateResult.error || 'Failed to initiate ClickWrap'
      });
    }

    const { uploadUrl, previewUrl, docTransactionId, entTransactionId } = initiateResult.data;

    // Get HTML content from request body (frontend will send the rendered agreement HTML)
    const { htmlContent } = req.body;

    if (!htmlContent) {
      return res.status(400).json({
        success: false,
        message: 'HTML content is required. Please provide the loan agreement HTML.'
      });
    }

    // Generate loan agreement PDF from HTML
    console.log('📄 Generating loan agreement PDF for application:', applicationId);
    let pdfBuffer;
    try {
      // Generate PDF from HTML using pdfService (similar to KFS)
      const pdfResult = await pdfService.generateKFSPDF(htmlContent, `Loan_Agreement_${applicationId}.pdf`);
      pdfBuffer = pdfResult.buffer;
      console.log('✅ PDF generated successfully, size:', pdfBuffer.length, 'bytes');
    } catch (pdfError) {
      console.error('Error generating PDF:', pdfError);
      return res.status(500).json({
        success: false,
        message: 'Failed to generate loan agreement PDF: ' + pdfError.message
      });
    }

    // Upload PDF to Digitap
    const uploadResult = await uploadDocumentToDigitap(uploadUrl, pdfBuffer);
    if (!uploadResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to upload document: ' + uploadResult.error
      });
    }

    // Store transaction IDs in database
    await executeQuery(
      `UPDATE loan_applications 
       SET clickwrap_doc_transaction_id = ?,
           clickwrap_ent_transaction_id = ?,
           clickwrap_preview_url = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [docTransactionId, entTransactionId, previewUrl, applicationId]
    );

    // Send sign-in link
    const signInLinkResult = await sendSignInLink(docTransactionId, false);
    if (!signInLinkResult.success) {
      console.warn('⚠️ Failed to send sign-in link:', signInLinkResult.error);
      // Continue anyway - user can still sign via SDK
    }

    res.json({
      success: true,
      data: {
        entTransactionId: entTransactionId,
        docTransactionId: docTransactionId,
        previewUrl: previewUrl,
        message: 'ClickWrap initiated successfully. Use entTransactionId with SDK.'
      }
    });

  } catch (error) {
    console.error('Error initiating ClickWrap:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate ClickWrap: ' + error.message
    });
  }
});

/**
 * POST /api/clickwrap/get-signed-doc
 * Get signed document URL
 */
router.post('/get-signed-doc', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;
    const { applicationId } = req.body;

    if (!applicationId) {
      return res.status(400).json({
        success: false,
        message: 'Application ID is required'
      });
    }

    // Get transaction ID from database
    const [application] = await executeQuery(
      'SELECT clickwrap_ent_transaction_id, clickwrap_doc_transaction_id FROM loan_applications WHERE id = ? AND user_id = ?',
      [applicationId, userId]
    );

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found or access denied'
      });
    }

    const transactionId = application.clickwrap_ent_transaction_id || application.clickwrap_doc_transaction_id;
    if (!transactionId) {
      return res.status(400).json({
        success: false,
        message: 'ClickWrap transaction not found. Please initiate signing first.'
      });
    }

    // Get signed document URL
    const docResult = await getSignedDocumentUrl(transactionId);
    if (!docResult.success) {
      return res.status(500).json({
        success: false,
        message: docResult.error || 'Failed to get signed document'
      });
    }

    res.json({
      success: true,
      data: {
        previewUrl: docResult.data.previewUrl,
        signed: docResult.data.signed
      }
    });

  } catch (error) {
    console.error('Error getting signed document:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get signed document: ' + error.message
    });
  }
});

module.exports = router;

