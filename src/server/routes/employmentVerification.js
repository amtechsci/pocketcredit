const express = require('express');
const multer = require('multer');
const nodemailer = require('nodemailer');
const router = express.Router();
const { executeQuery, initializeDatabase } = require('../config/database');
const { requireAuth } = require('../middleware/jwtAuth');
const { uploadLoanDocument, resolveUploadFilePath } = require('../services/s3Service');
const {
  resolveLoanApplicationId,
  getOrCreateRecord,
  markVerified,
  checkUANByPAN,
  checkUANByNumber,
  getEmploymentVerificationStatus,
  getLatestRecord,
  assertNotAwaitingDocsReview
} = require('../services/employmentVerificationService');
const { isUANSuccess } = require('../constants/employmentVerificationCodes');
const { resolveAadhaarLinkedMobile } = require('../utils/resolveAadhaarLinkedMobile');
const { isBlockedEmailDomain } = require('../constants/employmentVerificationCodes');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER?.trim(),
    pass: process.env.SMTP_PASS?.trim()
  },
  tls: { rejectUnauthorized: false }
});

const EMPLOYMENT_DOC_EXTENSIONS = ['jpg', 'jpeg', 'png', 'pdf', 'heic', 'heif', 'webp'];
const EMPLOYMENT_DOC_MIMES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/pdf',
  'image/heic',
  'image/heif',
  'image/webp',
  'application/octet-stream'
];

function getFileExtension(fileName) {
  return (fileName || '').split('.').pop()?.toLowerCase() || '';
}

function isAllowedEmploymentDocument(file) {
  const ext = getFileExtension(file.originalname);
  if (EMPLOYMENT_DOC_MIMES.includes(file.mimetype)) {
    if (file.mimetype === 'application/octet-stream') {
      return EMPLOYMENT_DOC_EXTENSIONS.includes(ext);
    }
    return true;
  }
  return EMPLOYMENT_DOC_EXTENSIONS.includes(ext);
}

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (isAllowedEmploymentDocument(file)) cb(null, true);
    else cb(new Error('Invalid file type. Only JPG, PNG, HEIC, WEBP, and PDF files are allowed.'));
  }
});

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function getUserMobileAndPan(userId) {
  const rows = await executeQuery(
    'SELECT phone, pan_number, aadhar_linked_mobile FROM users WHERE id = ?',
    [userId]
  );
  if (!rows.length) return { mobile: null, pan: null };
  const u = rows[0];
  const mobile = resolveAadhaarLinkedMobile(u);
  return { mobile, pan: u.pan_number || null };
}

function handleDocsVerifyBlock(res, error) {
  if (error.code === 'DOCS_VERIFY_PENDING') {
    return res.status(403).json({
      success: false,
      docs_verify: true,
      message: 'Your documents are under review & we will update the status soon'
    });
  }
  return null;
}

/**
 * GET /api/employment-verification/status
 */
router.get('/status', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const applicationId = req.query.applicationId ? parseInt(req.query.applicationId, 10) : null;
    const status = await getEmploymentVerificationStatus(req.userId, applicationId);
    res.json({ success: true, data: status });
  } catch (error) {
    console.error('Employment verification status error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch employment verification status' });
  }
});

/**
 * POST /api/employment-verification/check-uan-by-pan
 */
router.post('/check-uan-by-pan', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;
    let { applicationId, pan } = req.body;
    applicationId = await resolveLoanApplicationId(userId, applicationId ? parseInt(applicationId, 10) : null);

    try {
      await assertNotAwaitingDocsReview(userId, applicationId);
    } catch (e) {
      const blocked = handleDocsVerifyBlock(res, e);
      if (blocked) return blocked;
      throw e;
    }

    const { mobile, pan: storedPan } = await getUserMobileAndPan(userId);
    const panToUse = (pan || storedPan || '').toUpperCase();

    if (!panToUse || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panToUse)) {
      return res.status(400).json({
        success: false,
        needsPan: true,
        message: 'PAN number is required for employment verification'
      });
    }

    if (!mobile) {
      return res.status(400).json({
        success: false,
        message: 'Aadhaar-linked mobile number not found. Complete DigiLocker KYC first.'
      });
    }

    if (pan) {
      await executeQuery(
        'UPDATE users SET pan_number = ?, updated_at = NOW() WHERE id = ?',
        [panToUse, userId]
      );
    }

    const existing = await getLatestRecord(userId, applicationId);
    if (existing?.status === 'verified') {
      return res.json({
        success: true,
        verified: true,
        shouldShowManualFlow: false,
        message: 'Employment already verified'
      });
    }

    if (existing?.status === 'pending' && isUANSuccess(existing.uan_api_result_code)) {
      return res.json({
        success: true,
        verified: false,
        uanFetched: true,
        requiresPayslipOnly: true,
        shouldShowManualFlow: false,
        message: 'UAN verified. Please upload your latest payslip to continue.'
      });
    }

    const result = await checkUANByPAN(userId, mobile, panToUse, applicationId);
    res.json(result);
  } catch (error) {
    console.error('check-uan-by-pan error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify employment via UAN API' });
  }
});

/**
 * POST /api/employment-verification/company-email/send-otp
 */
router.post('/company-email/send-otp', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;
    const { email, applicationId } = req.body;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }

    if (isBlockedEmailDomain(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter your company / official mail ID or enter your UAN number in the below step to proceed'
      });
    }

    const appId = await resolveLoanApplicationId(userId, applicationId ? parseInt(applicationId, 10) : null);

    try {
      await assertNotAwaitingDocsReview(userId, appId);
    } catch (e) {
      const blocked = handleDocsVerifyBlock(res, e);
      if (blocked) return blocked;
      throw e;
    }

    const record = await getOrCreateRecord(userId, appId);
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await executeQuery(
      `UPDATE employment_verification_records
       SET company_email = ?, email_otp = ?, email_otp_expires_at = ?, updated_at = NOW()
       WHERE id = ?`,
      [email.trim().toLowerCase(), otp, expiresAt, record.id]
    );

    const fromEmail = process.env.SMTP_USER?.trim();
    const smtpPass = process.env.SMTP_PASS?.trim();
    if (!fromEmail || !smtpPass) {
      return res.status(500).json({
        success: false,
        message: 'Email service is not configured'
      });
    }

    await transporter.sendMail({
      from: `"Pocket Credit" <${fromEmail}>`,
      to: email,
      subject: 'Verify your company email - Pocket Credit',
      html: `<p>Your OTP for company email verification is: <strong>${otp}</strong></p><p>Valid for 5 minutes.</p>`
    });

    res.json({ success: true, message: 'OTP sent to your company email' });
  } catch (error) {
    console.error('company-email send-otp error:', error);
    res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
});

/**
 * POST /api/employment-verification/company-email/verify-otp
 */
router.post('/company-email/verify-otp', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;
    const { email, otp, applicationId } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }

    const appId = await resolveLoanApplicationId(userId, applicationId ? parseInt(applicationId, 10) : null);

    try {
      await assertNotAwaitingDocsReview(userId, appId);
    } catch (e) {
      const blocked = handleDocsVerifyBlock(res, e);
      if (blocked) return blocked;
      throw e;
    }

    const record = await getLatestRecord(userId, appId);

    if (!record || record.company_email !== email.trim().toLowerCase()) {
      return res.status(400).json({ success: false, message: 'Invalid verification request' });
    }

    if (!record.email_otp || record.email_otp !== String(otp)) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    if (record.email_otp_expires_at && new Date(record.email_otp_expires_at) < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP has expired' });
    }

    await markVerified(record.id, 'company_email_otp', { company_email: email.trim().toLowerCase() });
    await executeQuery(
      'UPDATE employment_verification_records SET email_otp = NULL, email_otp_expires_at = NULL WHERE id = ?',
      [record.id]
    );

    res.json({ success: true, verified: true, message: 'Company email verified successfully' });
  } catch (error) {
    console.error('company-email verify-otp error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify OTP' });
  }
});

/**
 * POST /api/employment-verification/uan-number
 */
router.post('/uan-number', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;
    const { uanNumber, applicationId } = req.body;

    if (!uanNumber || !/^\d{12}$/.test(String(uanNumber).trim())) {
      return res.status(400).json({
        success: false,
        message: 'Enter your valid UAN number or enter your company mail id in the above step to proceed'
      });
    }

    const appId = await resolveLoanApplicationId(userId, applicationId ? parseInt(applicationId, 10) : null);

    try {
      await assertNotAwaitingDocsReview(userId, appId);
    } catch (e) {
      const blocked = handleDocsVerifyBlock(res, e);
      if (blocked) return blocked;
      throw e;
    }

    const result = await checkUANByNumber(userId, String(uanNumber).trim(), appId);

    if (result.verified) {
      return res.json({
        success: true,
        verified: true,
        result_code: result.result_code,
        message: result.message || 'UAN verified successfully',
        data: result.data
      });
    }

    return res.status(400).json({
      success: false,
      verified: false,
      result_code: result.result_code,
      message: result.message
    });
  } catch (error) {
    console.error('uan-number error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit UAN number' });
  }
});

/**
 * POST /api/employment-verification/skip-to-manual
 */
router.post('/skip-to-manual', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const appId = await resolveLoanApplicationId(
      req.userId,
      req.body.applicationId ? parseInt(req.body.applicationId, 10) : null
    );
    await getOrCreateRecord(req.userId, appId);
    res.json({ success: true, message: 'Proceed to upload employment documents' });
  } catch (error) {
    console.error('skip-to-manual error:', error);
    res.status(500).json({ success: false, message: 'Failed to proceed' });
  }
});

/**
 * POST /api/employment-verification/upload-documents
 */
router.post('/upload-documents', requireAuth, (req, res, next) => {
  upload.fields([
    { name: 'payslip', maxCount: 1 },
    { name: 'company_id', maxCount: 1 }
  ])(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File size too large. Maximum size is 50MB.'
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || 'Invalid file upload'
      });
    }
    next();
  });
}, async (req, res) => {
    try {
      await initializeDatabase();
      const userId = req.userId;
      const applicationId = await resolveLoanApplicationId(
        userId,
        req.body.applicationId ? parseInt(req.body.applicationId, 10) : null
      );

      if (!applicationId) {
        return res.status(400).json({ success: false, message: 'Loan application not found' });
      }

      try {
        await assertNotAwaitingDocsReview(userId, applicationId);
      } catch (e) {
        const blocked = handleDocsVerifyBlock(res, e);
        if (blocked) return blocked;
        throw e;
      }

      const payslipFile = req.files?.payslip?.[0];
      const companyIdFile = req.files?.company_id?.[0];
      const uploadMode = (req.body.uploadMode || 'full').toLowerCase();
      const payslipOnly = uploadMode === 'payslip_only';

      if (!payslipFile) {
        return res.status(400).json({
          success: false,
          message: 'Please upload your payslip to proceed'
        });
      }

      if (!payslipOnly && !companyIdFile) {
        return res.status(400).json({
          success: false,
          message: 'Please upload both documents to proceed'
        });
      }

      const record = await getOrCreateRecord(userId, applicationId);

      if (payslipOnly && !isUANSuccess(record.uan_api_result_code)) {
        return res.status(400).json({
          success: false,
          message: 'UAN verification is required before uploading payslip'
        });
      }

      const payslipUpload = await uploadLoanDocument(
        payslipFile.buffer,
        payslipFile.originalname,
        payslipFile.mimetype,
        userId,
        applicationId
      );

      const payslipFilePath = resolveUploadFilePath(payslipUpload);

      const payslipInsert = await executeQuery(
        `INSERT INTO loan_application_documents
         (loan_application_id, user_id, document_name, document_type, file_name, file_path,
          s3_key, s3_bucket, file_size, mime_type, upload_status, uploaded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'uploaded', NOW())`,
        [
          applicationId,
          userId,
          'Latest Payslip',
          'employment_payslip',
          payslipFile.originalname,
          payslipFilePath,
          payslipUpload.key,
          payslipUpload.bucket,
          payslipFile.size,
          payslipFile.mimetype
        ]
      );

      if (payslipOnly) {
        await markVerified(record.id, 'uan_pan_api', {
          pan_used: record.pan_used,
          uan_api_result_code: record.uan_api_result_code,
          uan_api_response: record.uan_api_response
            ? (typeof record.uan_api_response === 'string'
              ? JSON.parse(record.uan_api_response)
              : record.uan_api_response)
            : null
        });

        await executeQuery(
          `UPDATE employment_verification_records
           SET payslip_document_id = ?,
               payslip_s3_key = ?,
               updated_at = NOW()
           WHERE id = ?`,
          [payslipInsert.insertId, payslipUpload.key, record.id]
        );

        return res.json({
          success: true,
          verified: true,
          message: 'Payslip uploaded successfully. Proceeding to credit check.',
          redirectTo: 'credit-analytics'
        });
      }

      const companyIdUpload = await uploadLoanDocument(
        companyIdFile.buffer,
        companyIdFile.originalname,
        companyIdFile.mimetype,
        userId,
        applicationId
      );

      const companyIdFilePath = resolveUploadFilePath(companyIdUpload);

      const companyIdInsert = await executeQuery(
        `INSERT INTO loan_application_documents
         (loan_application_id, user_id, document_name, document_type, file_name, file_path,
          s3_key, s3_bucket, file_size, mime_type, upload_status, uploaded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'uploaded', NOW())`,
        [
          applicationId,
          userId,
          'Company ID Card',
          'employment_company_id',
          companyIdFile.originalname,
          companyIdFilePath,
          companyIdUpload.key,
          companyIdUpload.bucket,
          companyIdFile.size,
          companyIdFile.mimetype
        ]
      );

      await executeQuery(
        `UPDATE employment_verification_records
         SET status = 'docs_verify',
             method = 'manual_docs',
             payslip_document_id = ?,
             company_id_document_id = ?,
             payslip_s3_key = ?,
             company_id_s3_key = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [
          payslipInsert.insertId,
          companyIdInsert.insertId,
          payslipUpload.key,
          companyIdUpload.key,
          record.id
        ]
      );

      res.json({
        success: true,
        message: 'Your documents are under verification. We will get back to you soon.'
      });
    } catch (error) {
      console.error('upload-documents error:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to upload documents' });
    }
  });

module.exports = router;
