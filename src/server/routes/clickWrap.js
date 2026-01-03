const express = require('express');
const router = express.Router();
const axios = require('axios');
const { requireAuth } = require('../middleware/jwtAuth');
const { initializeDatabase, executeQuery } = require('../config/database');
const {
  initiateClickWrap,
  uploadDocumentToDigitap,
  sendSignInLink,
  getSignedDocumentUrl
} = require('../services/digitapClickWrapService');
const pdfService = require('../services/pdfService');
const emailService = require('../services/emailService');
const { uploadGeneratedPDF } = require('../services/s3Service');

// Debug route to check if route is reachable
router.post('/initiate/debug', (req, res) => {
  console.log('🔍 Debug route hit');
  console.log('   Headers:', Object.keys(req.headers));
  console.log('   Authorization header:', req.headers['authorization'] || req.headers['Authorization']);
  console.log('   Body:', req.body);
  res.json({
    success: true,
    message: 'Debug route reached',
    hasAuthHeader: !!(req.headers['authorization'] || req.headers['Authorization']),
    headers: Object.keys(req.headers)
  });
});

/**
 * POST /api/clickwrap/initiate
 * Initiate ClickWrap transaction and get upload URL
 */
router.post('/initiate', requireAuth, async (req, res) => {
  try {
    console.log('✅ ClickWrap initiate route reached, userId:', req.userId);
    await initializeDatabase();
    const userId = req.userId;
    
    if (!userId) {
      console.error('❌ userId is missing after requireAuth middleware');
      return res.status(401).json({
        success: false,
        message: 'User ID not found in request'
      });
    }
    const { applicationId } = req.body;

    if (!applicationId) {
      return res.status(400).json({
        success: false,
        message: 'Application ID is required'
      });
    }

    // Verify application belongs to user and check for existing ClickWrap transaction
    const [application] = await executeQuery(
      `SELECT id, user_id, status, 
              clickwrap_ent_transaction_id, 
              clickwrap_doc_transaction_id,
              agreement_signed
       FROM loan_applications 
       WHERE id = ? AND user_id = ?`,
      [applicationId, userId]
    );

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found or access denied'
      });
    }

    // Idempotency check: If agreement is already signed, return existing transaction info
    if (application.agreement_signed) {
      return res.status(400).json({
        success: false,
        message: 'Agreement has already been signed'
      });
    }

    // If transaction IDs already exist (but not signed yet), return them
    // This allows re-initiating the SDK if user cancelled or closed the window
    if (application.clickwrap_ent_transaction_id || application.clickwrap_doc_transaction_id) {
      console.log('ℹ️ ClickWrap transaction already exists for application:', applicationId);
      console.log('   Returning existing transaction IDs');
      
      // Get preview URL if available
      const [appWithPreview] = await executeQuery(
        'SELECT clickwrap_preview_url FROM loan_applications WHERE id = ?',
        [applicationId]
      );

      return res.json({
        success: true,
        data: {
          entTransactionId: application.clickwrap_ent_transaction_id,
          docTransactionId: application.clickwrap_doc_transaction_id,
          previewUrl: appWithPreview?.clickwrap_preview_url || null,
          message: 'Existing ClickWrap transaction found. Use transaction IDs with SDK.'
        }
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

/**
 * GET /api/clickwrap/callback
 * Callback endpoint for Digitap redirect after signing
 * Handles: Check if signed, download PDF, upload to S3, send email, redirect to frontend
 */
router.get('/callback', async (req, res) => {
  try {
    await initializeDatabase();
    
    // Extract and normalize query parameters
    // Digitap may append query params to our URL, causing parsing issues
    let { success, transactionId, error_code, errorMsg, applicationId } = req.query;
    
    // Normalize transactionId - handle array case (Digitap sometimes sends duplicates)
    if (Array.isArray(transactionId)) {
      transactionId = transactionId[0]; // Take first value
    }
    if (typeof transactionId !== 'string' || !transactionId) {
      transactionId = String(transactionId || '').split('?')[0].split('&')[0]; // Extract clean value
    }
    
    // Normalize applicationId - remove any query params that got attached
    if (typeof applicationId === 'string' && applicationId.includes('?')) {
      applicationId = applicationId.split('?')[0]; // Take only the ID part before any ?
    }
    if (typeof applicationId === 'string' && applicationId.includes('&')) {
      applicationId = applicationId.split('&')[0]; // Take only the ID part before any &
    }
    
    // Normalize success - handle array case
    if (Array.isArray(success)) {
      success = success[0];
    }
    success = String(success || '').toLowerCase();
    
    // Determine frontend URL
    const isDevelopment = process.env.NODE_ENV === 'development';
    const frontendUrl = process.env.FRONTEND_URL || (isDevelopment ? 'http://localhost:3000' : 'https://pocketcredit.in');
    
    console.log('✅ ClickWrap callback received (normalized):', { 
      success, 
      transactionId, 
      applicationId,
      error_code, 
      errorMsg 
    });
    
    // Handle error case - redirect to frontend with error
    // Digitap sends error_code and errorMsg in error_url callback
    if (success === 'false' || error_code || (success !== 'true' && errorMsg)) {
      console.error('❌ ClickWrap callback error:', { error_code, errorMsg, transactionId, success });
      const errorCode = Array.isArray(error_code) ? error_code[0] : (error_code || 'unknown');
      const errorMessage = Array.isArray(errorMsg) ? errorMsg[0] : (errorMsg || 'Signing failed');
      const errorRedirect = `${frontendUrl}/post-disbursal?applicationId=${applicationId || ''}&clickwrap=error&error_code=${errorCode}&errorMsg=${encodeURIComponent(errorMessage)}`;
      return res.redirect(errorRedirect);
    }

    if (!applicationId || !transactionId) {
      console.error('❌ Missing required parameters:', { applicationId, transactionId });
      const errorRedirect = `${frontendUrl}/post-disbursal?applicationId=${applicationId || ''}&clickwrap=error&error_code=missing_params&errorMsg=${encodeURIComponent('Missing required parameters')}`;
      return res.redirect(errorRedirect);
    }
    
    // Ensure transactionId is a clean string (remove any trailing query params)
    transactionId = String(transactionId).trim().split('?')[0].split('&')[0];
    applicationId = String(applicationId).trim().split('?')[0].split('&')[0];

    // Get application details
    const [application] = await executeQuery(
      `SELECT id, user_id, application_number, loan_amount, status,
              clickwrap_ent_transaction_id, 
              clickwrap_doc_transaction_id,
              clickwrap_preview_url,
              agreement_signed
       FROM loan_applications 
       WHERE id = ?`,
      [applicationId]
    );

    if (!application) {
      console.error('❌ Application not found:', applicationId);
      const errorRedirect = `${frontendUrl}/post-disbursal?applicationId=${applicationId}&clickwrap=error&error_code=not_found&errorMsg=${encodeURIComponent('Application not found')}`;
      return res.redirect(errorRedirect);
    }

    // Check if already processed (idempotency)
    if (application.agreement_signed) {
      console.log('ℹ️ Agreement already signed, redirecting to frontend');
      return res.redirect(`${frontendUrl}/post-disbursal?applicationId=${applicationId}&clickwrap=success&transactionId=${transactionId}`);
    }

    // Verify transaction ID matches
    const expectedTransactionId = application.clickwrap_ent_transaction_id || application.clickwrap_doc_transaction_id;
    if (expectedTransactionId && expectedTransactionId !== transactionId) {
      console.warn('⚠️ Transaction ID mismatch, but proceeding:', { expected: expectedTransactionId, received: transactionId });
    }

    // Final safety check: ensure transactionId is a clean string before API call
    // Digitap API expects a string, not an array
    if (Array.isArray(transactionId)) {
      transactionId = transactionId[0];
    }
    transactionId = String(transactionId || '').trim().split('?')[0].split('&')[0];
    
    if (!transactionId || transactionId === 'undefined' || transactionId === 'null') {
      console.error('❌ Invalid transactionId after normalization:', transactionId);
      const errorRedirect = `${frontendUrl}/post-disbursal?applicationId=${applicationId}&clickwrap=error&error_code=invalid_transaction&errorMsg=${encodeURIComponent('Invalid transaction ID')}`;
      return res.redirect(errorRedirect);
    }

    console.log('📤 Calling Digitap API with transactionId:', transactionId, '(type:', typeof transactionId + ')');

    // Get signed document status from Digitap
    const docResult = await getSignedDocumentUrl(transactionId);
    if (!docResult.success || !docResult.data.signed) {
      console.error('❌ Document not signed yet or failed to verify:', docResult.error);
      const errorRedirect = `${frontendUrl}/post-disbursal?applicationId=${applicationId}&clickwrap=error&error_code=not_signed&errorMsg=${encodeURIComponent('Document verification failed')}`;
      return res.redirect(errorRedirect);
    }

    const signedPdfUrl = docResult.data.previewUrl;
    if (!signedPdfUrl) {
      console.error('❌ No preview URL returned from Digitap');
      const errorRedirect = `${frontendUrl}/post-disbursal?applicationId=${applicationId}&clickwrap=error&error_code=no_url&errorMsg=${encodeURIComponent('Failed to get signed document URL')}`;
      return res.redirect(errorRedirect);
    }

    console.log('📥 Downloading signed PDF from:', signedPdfUrl);

    // Download signed PDF from Digitap
    let pdfBuffer;
    try {
      const pdfResponse = await axios.get(signedPdfUrl, {
        responseType: 'arraybuffer',
        timeout: 30000
      });
      pdfBuffer = Buffer.from(pdfResponse.data);
      console.log('✅ Downloaded signed PDF, size:', pdfBuffer.length, 'bytes');
    } catch (downloadError) {
      console.error('❌ Failed to download PDF:', downloadError.message);
      // Still mark as signed in DB, but log the error
      await executeQuery(
        `UPDATE loan_applications 
         SET agreement_signed = 1,
             status = 'ready_for_disbursement',
             clickwrap_signed_at = NOW(),
             updated_at = NOW()
         WHERE id = ?`,
        [applicationId]
      );
      const errorRedirect = `${frontendUrl}/post-disbursal?applicationId=${applicationId}&clickwrap=error&error_code=download_failed&errorMsg=${encodeURIComponent('Failed to download signed document')}`;
      return res.redirect(errorRedirect);
    }

    // Upload signed PDF to S3
    let s3Key = null;
    try {
      const filename = `Signed_Agreement_${application.application_number}.pdf`;
      const uploadResult = await uploadGeneratedPDF(
        pdfBuffer,
        filename,
        application.user_id,
        'signed-loan-agreement'
      );
      s3Key = uploadResult.key;
      console.log('✅ Uploaded signed PDF to S3:', s3Key);
    } catch (uploadError) {
      console.error('❌ Failed to upload PDF to S3:', uploadError.message);
      // Continue - we'll still mark as signed and send email
    }

    // Get user details for email
    const [user] = await executeQuery(
      'SELECT first_name, last_name, email, personal_email, official_email FROM users WHERE id = ?',
      [application.user_id]
    );

    // Send email with signed agreement (if user email exists)
    if (user) {
      const recipientEmail = user.personal_email || user.official_email || user.email;
      const recipientName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'User';
      
      if (recipientEmail) {
        try {
          await emailService.sendSignedAgreementEmail({
            loanId: application.id,
            recipientEmail: recipientEmail,
            recipientName: recipientName,
            loanData: {
              application_number: application.application_number,
              loan_amount: application.loan_amount,
              status: application.status
            },
            pdfBuffer: pdfBuffer,
            pdfFilename: `Signed_Agreement_${application.application_number}.pdf`,
            sentBy: null // System-generated
          });
          console.log('✅ Email sent with signed agreement to:', recipientEmail);
        } catch (emailError) {
          console.error('❌ Failed to send email (non-fatal):', emailError.message);
          // Continue - email failure shouldn't block the process
        }
      }
    }

    // Update database: mark as signed and store S3 key if available
    await executeQuery(
      `UPDATE loan_applications 
       SET agreement_signed = 1,
           status = 'ready_for_disbursement',
           clickwrap_signed_at = NOW(),
           clickwrap_signed_pdf_s3_key = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [s3Key, applicationId]
    );

    console.log('✅ Agreement marked as signed in database for application:', applicationId);

    // Redirect to frontend with success
    return res.redirect(`${frontendUrl}/post-disbursal?applicationId=${applicationId}&clickwrap=success&transactionId=${transactionId}`);

  } catch (error) {
    console.error('❌ Error in ClickWrap callback:', error);
    const applicationId = req.query.applicationId || '';
    const isDevelopment = process.env.NODE_ENV === 'development';
    const frontendUrl = process.env.FRONTEND_URL || (isDevelopment ? 'http://localhost:3000' : 'https://pocketcredit.in');
    const errorRedirect = `${frontendUrl}/post-disbursal?applicationId=${applicationId}&clickwrap=error&error_code=server_error&errorMsg=${encodeURIComponent('Internal server error')}`;
    return res.redirect(errorRedirect);
  }
});

module.exports = router;

