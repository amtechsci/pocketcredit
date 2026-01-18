const express = require('express');
const router = express.Router();
const { executeQuery, initializeDatabase } = require('../config/database');
const { requireAuth } = require('../middleware/jwtAuth');
const { uploadKYCDocument } = require('../services/s3Service');
const axios = require('axios');
// pdf-parse v2.x - supports both old and new API
// The module exports an object, but should have a callable default function
const pdfParseModule = require('pdf-parse');
// In pdf-parse v2.x, the default export should still be the parsing function
// Try accessing it via .default or use the module itself if it's callable
const pdf = pdfParseModule.default || pdfParseModule;

/**
 * Extract PAN number from PDF text
 * PAN format: 5 letters, 4 digits, 1 letter (e.g., FPFPM8829N)
 * @param {string} text - PDF text content
 * @returns {string|null} - Extracted PAN number or null
 */
function extractPANFromText(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }

  // PAN pattern: 5 uppercase letters, 4 digits, 1 uppercase letter
  // Look for patterns like "Permanent Account Number FPFPM8829N" or just the PAN itself
  const panPattern = /\b([A-Z]{5}[0-9]{4}[A-Z]{1})\b/g;
  const matches = text.match(panPattern);
  
  if (matches && matches.length > 0) {
    // Return the first valid PAN found
    const pan = matches[0].toUpperCase();
    console.log(`   📄 Extracted PAN from PDF: ${pan}`);
    return pan;
  }

  // Alternative: Look for "Permanent Account Number" followed by PAN
  const panWithLabel = /Permanent\s+Account\s+Number\s+([A-Z]{5}[0-9]{4}[A-Z]{1})/gi;
  const labelMatch = text.match(panWithLabel);
  if (labelMatch) {
    const pan = labelMatch[0].replace(/Permanent\s+Account\s+Number\s+/gi, '').trim().toUpperCase();
    console.log(`   📄 Extracted PAN from PDF (with label): ${pan}`);
    return pan;
  }

  return null;
}

/**
 * Extract PAN from PANCR PDF document
 * Uses the same robust OCR extraction method as Credit Analytics
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @returns {Promise<string|null>} - Extracted PAN number or null
 */
async function extractPANFromPDF(pdfBuffer) {
  let parser = null;
  try {
    // Ensure buffer is a Buffer object
    if (!Buffer.isBuffer(pdfBuffer)) {
      pdfBuffer = Buffer.from(pdfBuffer);
    }
    
    console.log('   🔍 Attempting to parse PDF, buffer size:', pdfBuffer.length);
    
    // Try to use PDFParse class for pdf-parse v2.4.5+ (more robust)
    try {
      const { PDFParse } = require('pdf-parse');
      
      // Create parser instance with the PDF buffer
      parser = new PDFParse({ data: pdfBuffer });
      
      // Extract text from PDF
      const result = await parser.getText();
      
      const text = result.text || '';
      console.log('   ✅ PDF parsed successfully using PDFParse class, text length:', text.length);
      return extractPANFromText(text);
    } catch (classError) {
      // Fallback to old API if PDFParse class is not available
      console.log('   ⚠️ PDFParse class not available, using fallback method');
      const data = await pdf(pdfBuffer);
      const text = data.text || '';
      console.log('   ✅ PDF parsed successfully using fallback method, text length:', text.length);
      return extractPANFromText(text);
    }
  } catch (error) {
    console.error('   ❌ Error extracting PAN from PDF:', error.message);
    console.error('   Error stack:', error.stack);
    return null;
  } finally {
    // Clean up parser resources
    if (parser) {
      try {
        await parser.destroy();
      } catch (destroyError) {
        // Ignore destroy errors
      }
    }
  }
}

/**
 * Helper: Download and Upload Docs to S3
 */
async function processAndUploadDocs(userId, transactionId, docs) {
  if (!docs || !Array.isArray(docs)) {
    console.log('⚠️ No docs array provided to processAndUploadDocs');
    return;
  }

  console.log(`🔄 Processing ${docs.length} documents for S3 upload (User: ${userId})...`);

  for (const doc of docs) {
    const url = doc.url || doc.docLink || doc.uri;
    if (!url) continue;

    const docType = doc.docType || 'UNKNOWN';
    const docExt = doc.docExtension || 'pdf';
    const fileName = `${docType}_${Date.now()}.${docExt}`;
    const mimeType = docExt === 'pdf' ? 'application/pdf' : (docExt === 'xml' ? 'text/xml' : 'image/jpeg');

    try {
      // Check if exists
      const existing = await executeQuery(
        'SELECT id FROM kyc_documents WHERE user_id = ? AND transaction_id = ? AND document_type = ?',
        [userId, transactionId, docType]
      );
      if (existing.length > 0) continue;

      // Download
      const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
      const buffer = Buffer.from(response.data);

      // Extract PAN from PANCR PDF documents
      let extractedPAN = null;
      if (docType === 'PANCR' && docExt === 'pdf') {
        extractedPAN = await extractPANFromPDF(buffer);
        
        if (extractedPAN) {
          // Validate PAN format
          const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
          if (panRegex.test(extractedPAN)) {
            // Update users table with extracted PAN
            try {
              await executeQuery(
                `UPDATE users 
                 SET pan_number = COALESCE(pan_number, ?),
                     updated_at = NOW()
                 WHERE id = ?`,
                [extractedPAN, userId]
              );
              console.log(`   ✅ Saved extracted PAN to users table: ${extractedPAN}`);

              // Also save to verification_records table
              await executeQuery(
                `INSERT INTO verification_records (user_id, document_type, document_number, verification_status, created_at, updated_at)
                 VALUES (?, 'pan', ?, 'pending', NOW(), NOW())
                 ON DUPLICATE KEY UPDATE
                   document_number = VALUES(document_number),
                   updated_at = NOW()`,
                [userId, extractedPAN]
              );
              console.log(`   ✅ Saved PAN to verification_records: ${extractedPAN}`);
            } catch (dbError) {
              console.error(`   ❌ Error saving extracted PAN to database: ${dbError.message}`);
            }
          } else {
            console.warn(`   ⚠️ Extracted PAN format invalid: ${extractedPAN}`);
          }
        } else {
          console.log(`   ⚠️ Could not extract PAN from ${docType} PDF`);
        }
      }

      // Upload
      const result = await uploadKYCDocument(buffer, fileName, mimeType, userId, docType);

      // Save to DB
      await executeQuery(`
        INSERT INTO kyc_documents 
        (user_id, transaction_id, document_type, file_name, s3_key, s3_bucket, mime_type, file_size, doc_extension, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [userId, transactionId, docType, fileName, result.key, result.bucket, mimeType, result.size, docExt]);

      console.log(`   ✅ Uploaded ${docType} to S3`);
    } catch (e) {
      console.error(`   ❌ Failed to upload ${docType}: ${e.message}`);
    }
  }
}

/**
 * POST /api/digilocker/generate-kyc-url
 * Generate Digilocker KYC URL for user verification
 */
router.post('/generate-kyc-url', requireAuth, async (req, res) => {
  const { mobile_number, application_id, first_name, last_name, email } = req.body;
  const userId = req.userId;

  if (!mobile_number) {
    console.log('❌ Validation failed: Mobile number is required');
    return res.status(400).json({
      success: false,
      message: 'Mobile number is required'
    });
  }

  // Validate mobile number format
  if (!/^[6-9]\d{9}$/.test(mobile_number)) {
    console.log('❌ Validation failed: Invalid mobile number format', { mobile_number });
    return res.status(400).json({
      success: false,
      message: 'Invalid mobile number format. Must be 10 digits starting with 6-9.'
    });
  }

  // Optional name validation per provider rules
  const nameRegex = /^[A-Za-z][A-Za-z .\-_' ]{0,44}$/; // start alpha, allowed ., -, ', space, _ up to 45
  if (first_name && !nameRegex.test(first_name)) {
    console.log('❌ Validation failed: Invalid first name format', { first_name });
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid first name format. Must start with a letter and contain only letters, spaces, dots, hyphens, underscores, or apostrophes (max 45 characters).' 
    });
  }
  if (last_name && !nameRegex.test(last_name)) {
    console.log('❌ Validation failed: Invalid last name format', { last_name });
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid last name format. Must start with a letter and contain only letters, spaces, dots, hyphens, underscores, or apostrophes (max 45 characters).' 
    });
  }
  
  // Email is optional for Digilocker - only validate if a real email is provided
  // Treat placeholder values (N/A, NA, etc.) and empty strings as optional
  const placeholderEmails = ['N/A', 'NA', 'n/a', 'na', 'NONE', 'none', 'NULL', 'null', ''];
  const isPlaceholderEmail = !email || placeholderEmails.includes(email.trim().toUpperCase());
  const emailForRequest = isPlaceholderEmail ? null : email;
  
  // Only validate email format if a real email is provided
  if (!isPlaceholderEmail && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    console.log('❌ Validation failed: Invalid email format', { email: `${email.substring(0, 5)}***` });
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid email format' 
    });
  }

  try {
    await initializeDatabase();

    // Generate unique UID for this KYC request
    const uid = `PC${userId}_${application_id || 'NONE'}_${Date.now()}`;

    // Prepare Digilocker API request
    const digilockerRequest = {
      uid: uid,
      emailId: emailForRequest || "",
      firstName: first_name || "",
      lastName: last_name || "",
      isHideExplanationScreen: false,
      isSendOtp: false,
      mobile: mobile_number,
      // APP_URL: production includes /api, development doesn't
      redirectionUrl: (() => {
        const isDevelopment = process.env.NODE_ENV === 'development';
        // Ensure we target the API URL with /api prefix
        let baseUrl = process.env.API_URL;
        
        if (!baseUrl) {
          if (isDevelopment) {
            baseUrl = 'http://localhost:3002/api'; // Include /api in development
          } else {
            baseUrl = 'https://pocketcredit.in/api';
          }
        } else {
          // If API_URL is set, ensure it has /api prefix
          if (!baseUrl.endsWith('/api')) {
            baseUrl = baseUrl.endsWith('/') ? `${baseUrl}api` : `${baseUrl}/api`;
          }
        }

        // Remove trailing slash if present
        const cleanBaseUrl = baseUrl.replace(/\/$/, '');

        // Return full path to webhook endpoint
        return `${cleanBaseUrl}/digiwebhook`;
      })(),
      serviceId: process.env.DIGILOCKER_SERVICE_ID || "4"
    };

    console.log('🔐 Generating Digilocker KYC URL:', { uid, mobile: mobile_number });

    // Call Digilocker API to generate KYC URL
    const digilockerApiUrl = process.env.DIGILOCKER_API_URL;
    if (!digilockerApiUrl) {
      throw new Error('DIGILOCKER_API_URL environment variable is required');
    }
    
    // Get auth token from env or construct from client_id:client_secret
    let authToken = process.env.DIGILOCKER_AUTH_TOKEN;
    if (!authToken && process.env.DIGILOCKER_CLIENT_ID && process.env.DIGILOCKER_CLIENT_SECRET) {
      const credentials = `${process.env.DIGILOCKER_CLIENT_ID}:${process.env.DIGILOCKER_CLIENT_SECRET}`;
      authToken = Buffer.from(credentials).toString('base64');
    }
    // Fallback to test token only in development
    if (!authToken && process.env.NODE_ENV !== 'production') {
      authToken = 'MjcxMDg3NTA6UlRwYzRpVjJUQnFNdFhKRWR6a1BhRG5CRDVZTk9BRkI=';
    }
    
    if (!authToken) {
      throw new Error('DIGILOCKER_AUTH_TOKEN or DIGILOCKER_CLIENT_ID/SECRET must be configured');
    }

    const digilockerResponse = await axios.post(
      digilockerApiUrl,
      digilockerRequest,
      {
        headers: {
          // Per docs: base64(client_id:client_secret)
          'ent_authorization': authToken,
          // Backward compatibility if gateway expects Authorization
          'Authorization': authToken,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Digilocker API Response:', digilockerResponse.data);

    if (digilockerResponse.data.code === "200" && digilockerResponse.data.model) {
      const { url, transactionId, kycUrl } = digilockerResponse.data.model;

      // Store KYC verification record with transaction ID
      const kycCheck = await executeQuery(
        'SELECT id FROM kyc_verifications WHERE user_id = ?',
        [userId]
      );

      const verificationData = JSON.stringify({
        uid,
        transactionId,
        url,
        kycUrl,
        mobile_number,
        timestamp: new Date().toISOString()
      });

      if (kycCheck.length > 0) {
        // Update existing record
        await executeQuery(
          `UPDATE kyc_verifications 
           SET kyc_status = 'pending', 
               kyc_method = 'digilocker', 
               mobile_number = ?, 
               verification_data = ?,
               updated_at = NOW() 
           WHERE id = ?`,
          [mobile_number, verificationData, kycCheck[0].id]
        );
      } else {
        // Create new record
        // Note: application_id is optional - KYC is per-user, not per-application
        // If application_id column exists and is NOT NULL, we'll need to handle it
        // For now, try INSERT without application_id first
        try {
          await executeQuery(
            `INSERT INTO kyc_verifications 
             (user_id, kyc_status, kyc_method, mobile_number, verification_data, created_at, updated_at) 
             VALUES (?, 'pending', 'digilocker', ?, ?, NOW(), NOW())`,
            [userId, mobile_number, verificationData]
          );
        } catch (insertError) {
          // If error is about application_id, try with NULL or a placeholder
          if (insertError.message && insertError.message.includes('application_id')) {
            // Try with NULL if column allows it, or with a placeholder application_id
            // First, check if we have an application_id from the request
            if (application_id) {
              await executeQuery(
                `INSERT INTO kyc_verifications 
                 (user_id, application_id, kyc_status, kyc_method, mobile_number, verification_data, created_at, updated_at) 
                 VALUES (?, ?, 'pending', 'digilocker', ?, ?, NOW(), NOW())`,
                [userId, application_id, mobile_number, verificationData]
              );
            } else {
              // If no application_id and column requires it, we need to alter the table
              // For now, throw a more helpful error
              throw new Error('KYC table requires application_id but it was removed. Please run: ALTER TABLE kyc_verifications MODIFY COLUMN application_id INT NULL;');
            }
          } else {
            throw insertError;
          }
        }
      }

      res.json({
        success: true,
        message: 'KYC URL generated successfully',
        data: {
          kycUrl: kycUrl,
          transactionId: transactionId,
          shortUrl: url
        }
      });
    } else {
      throw new Error('Invalid response from Digilocker API');
    }

  } catch (error) {
    console.error('❌ Digilocker KYC URL generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate KYC URL. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/digilocker/kyc-status/:applicationId
 * Get KYC verification status for a user (applicationId kept for backward compatibility but not used)
 */
router.get('/kyc-status/:applicationId', requireAuth, async (req, res) => {
  const { applicationId } = req.params;
  const userId = req.userId;

  try {
    await initializeDatabase();

    const results = await executeQuery(
      `SELECT kyc_status, kyc_method, verified_at, created_at, verification_data 
       FROM kyc_verifications 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [userId]
    );

    if (results.length === 0) {
      return res.json({
        success: true,
        data: {
          kyc_status: 'pending',
          kyc_method: null,
          verified_at: null
        }
      });
    }

    res.json({
      success: true,
      data: results[0]
    });

  } catch (error) {
    console.error('Get KYC status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch KYC status'
    });
  }
});

/**
 * POST /api/digilocker/fetch-kyc-data
 * Fetch actual KYC data from Digilocker using transactionId
 */
router.post('/fetch-kyc-data', requireAuth, async (req, res) => {
  const { transaction_id } = req.body;
  const userId = req.userId;

  if (!transaction_id) {
    return res.status(400).json({
      success: false,
      message: 'Transaction ID is required'
    });
  }

  try {
    await initializeDatabase();

    console.log('📥 Fetching KYC data from Digilocker for txnId:', transaction_id);

    // Call Digilocker API to fetch actual KYC data
    const fetchApiUrl = process.env.DIGILOCKER_FETCH_API_URL;
    if (!fetchApiUrl) {
      throw new Error('DIGILOCKER_FETCH_API_URL environment variable is required');
    }
    
    // Get auth token (same logic as generate-kyc-url)
    let authToken = process.env.DIGILOCKER_AUTH_TOKEN;
    if (!authToken && process.env.DIGILOCKER_CLIENT_ID && process.env.DIGILOCKER_CLIENT_SECRET) {
      const credentials = `${process.env.DIGILOCKER_CLIENT_ID}:${process.env.DIGILOCKER_CLIENT_SECRET}`;
      authToken = Buffer.from(credentials).toString('base64');
    }
    if (!authToken && process.env.NODE_ENV !== 'production') {
      authToken = 'MjcxMDg3NTA6UlRwYzRpVjJUQnFNdFhKRWR6a1BhRG5CRDVZTk9BRkI=';
    }

    const digilockerResponse = await axios.post(
      fetchApiUrl,
      {
        transactionId: transaction_id
      },
      {
        headers: {
          'Authorization': authToken,
          'ent_authorization': authToken,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Digilocker KYC Data Response:', digilockerResponse.data);

    if (digilockerResponse.data && digilockerResponse.data.code === "200") {
      const kycData = digilockerResponse.data.model || digilockerResponse.data.data;

      // Update kyc_verifications table with full data
      await executeQuery(
        `UPDATE kyc_verifications 
         SET verification_data = JSON_SET(
           COALESCE(verification_data, '{}'),
           '$.kycData', ?
         )
         WHERE user_id = ? 
         AND JSON_EXTRACT(verification_data, '$.transactionId') = ?`,
        [JSON.stringify(kycData), userId, transaction_id]
      );

      console.log('📊 KYC Data Keys:', Object.keys(kycData));

      const docsToProcess = kycData.digilockerFiles || kycData.docs;

      // Process Docs if available in kycData
      if (docsToProcess && Array.isArray(docsToProcess)) {
        console.log('🚀 Details found, triggering background upload...');
        // Run in background to avoid blocking response
        processAndUploadDocs(userId, transaction_id, docsToProcess).catch(e => console.error('Bg Upload Error', e));
      } else {
        console.log('⚠️ No digilockerFiles or docs array found in response');
      }

      res.json({
        success: true,
        message: 'KYC data fetched successfully',
        data: kycData
      });
    } else {
      throw new Error('Invalid response from Digilocker fetch API');
    }

  } catch (error) {
    console.error('❌ Fetch KYC data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch KYC data from Digilocker',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/digilocker/get-details/:transactionId
 * Proxy to Digitap get-digilocker-details (returns profile data)
 */
router.get('/get-details/:transactionId', requireAuth, async (req, res) => {
  const { transactionId } = req.params;
  const userId = req.userId;
  if (!transactionId) {
    return res.status(400).json({ success: false, message: 'Transaction ID is required' });
  }
  try {
    await initializeDatabase();
    const apiUrl = process.env.DIGILOCKER_GET_API_URL;
    if (!apiUrl) {
      return res.status(500).json({ success: false, message: 'DIGILOCKER_GET_API_URL environment variable is required' });
    }
    
    // Get auth token
    let authToken = process.env.DIGILOCKER_AUTH_TOKEN;
    if (!authToken && process.env.DIGILOCKER_CLIENT_ID && process.env.DIGILOCKER_CLIENT_SECRET) {
      const credentials = `${process.env.DIGILOCKER_CLIENT_ID}:${process.env.DIGILOCKER_CLIENT_SECRET}`;
      authToken = Buffer.from(credentials).toString('base64');
    }
    if (!authToken && process.env.NODE_ENV !== 'production') {
      authToken = 'MjcxMDg3NTA6UlRwYzRpVjJUQnFNdFhKRWR6a1BhRG5CRDVZTk9BRkI=';
    }
    
    const apiResp = await axios.post(
      apiUrl,
      { transactionId },
      { headers: { 'ent_authorization': authToken, 'Content-Type': 'application/json' } }
    );
    if (!apiResp.data || apiResp.data.code !== '200') {
      return res.status(400).json({ success: false, message: apiResp.data?.msg || 'Failed to fetch details' });
    }
    const details = apiResp.data.model || apiResp.data.data;
    // Persist under verification_data.kycData (parse if it's a string)
    const kycDataParsed = typeof details === 'string' ? JSON.parse(details) : details;
    await executeQuery(
      `UPDATE kyc_verifications SET verification_data = JSON_SET(COALESCE(verification_data,'{}'), '$.kycData', CAST(? AS JSON)) 
       WHERE user_id = ? AND JSON_EXTRACT(verification_data, '$.transactionId') = ?`,
      [JSON.stringify(kycDataParsed), userId, transactionId]
    );
    res.json({ success: true, data: details });
  } catch (e) {
    console.error('get-details error:', e);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * GET /api/digilocker/list-docs/:transactionId
 * Proxy to Digitap digilocker/list-docs (returns doc links)
 */
router.get('/list-docs/:transactionId', requireAuth, async (req, res) => {
  const { transactionId } = req.params;
  const userId = req.userId;
  if (!transactionId) {
    return res.status(400).json({ success: false, message: 'Transaction ID is required' });
  }
  try {
    await initializeDatabase();
    const apiUrl = process.env.DIGILOCKER_LIST_DOCS_URL;
    if (!apiUrl) {
      return res.status(500).json({ success: false, message: 'DIGILOCKER_LIST_DOCS_URL environment variable is required' });
    }
    
    // Get auth token
    let authToken = process.env.DIGILOCKER_AUTH_TOKEN;
    if (!authToken && process.env.DIGILOCKER_CLIENT_ID && process.env.DIGILOCKER_CLIENT_SECRET) {
      const credentials = `${process.env.DIGILOCKER_CLIENT_ID}:${process.env.DIGILOCKER_CLIENT_SECRET}`;
      authToken = Buffer.from(credentials).toString('base64');
    }
    if (!authToken && process.env.NODE_ENV !== 'production') {
      authToken = 'MjcxMDg3NTA6UlRwYzRpVjJUQnFNdFhKRWR6a1BhRG5CRDVZTk9BRkI=';
    }
    
    const apiResp = await axios.post(
      apiUrl,
      { transactionId },
      { headers: { 'ent_authorization': authToken, 'Content-Type': 'application/json' } }
    );
    if (!apiResp.data || apiResp.data.code !== '200') {
      return res.status(400).json({ success: false, message: apiResp.data?.msg || 'Failed to list docs' });
    }
    const docs = apiResp.data.model || apiResp.data.data;
    // Persist under verification_data.docs (parse if it's a string)
    const docsParsed = typeof docs === 'string' ? JSON.parse(docs) : docs;
    await executeQuery(
      `UPDATE kyc_verifications SET verification_data = JSON_SET(COALESCE(verification_data,'{}'), '$.docs', CAST(? AS JSON)) 
       WHERE user_id = ? AND JSON_EXTRACT(verification_data, '$.transactionId') = ?`,
      [JSON.stringify(docsParsed), userId, transactionId]
    );

    // Process Docs
    processAndUploadDocs(userId, transactionId, docsParsed).catch(e => console.error('Bg Upload Error', e));

    res.json({ success: true, data: docs });
  } catch (e) {
    console.error('list-docs error:', e);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * GET /api/digilocker/check-pan-document/:applicationId
 * Check if PAN document exists in Digilocker KYC documents
 */
router.get('/check-pan-document/:applicationId', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;
    const applicationId = parseInt(req.params.applicationId);

    // Get KYC verification record
    const kycRecords = await executeQuery(
      `SELECT id, verification_data 
       FROM kyc_verifications 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [userId]
    );

    if (kycRecords.length === 0) {
      return res.json({
        success: true,
        data: {
          hasPanDocument: false,
          transactionId: null
        },
        message: 'No KYC verification found'
      });
    }

    const kycRecord = kycRecords[0];
    let verificationData = kycRecord.verification_data;

    // Parse if it's a string
    if (typeof verificationData === 'string') {
      try {
        verificationData = JSON.parse(verificationData);
      } catch (e) {
        return res.json({
          success: true,
          data: {
            hasPanDocument: false,
            transactionId: null
          },
          message: 'Invalid verification data format'
        });
      }
    }

    // Check for documents in various possible locations
    const docs = verificationData.docs || verificationData.digilockerFiles || [];
    const docsArray = Array.isArray(docs) ? docs : [];

    console.log(`📄 Documents array length: ${docsArray.length}`);

    // Check if PAN document exists in documents
    // PAN documents might be labeled as: 'PAN', 'PAN_CARD', 'PAN_CARD_PDF', 'PANCR', etc.
    let hasPanDocument = docsArray.some((doc) => {
      const docType = (doc.docType || doc.document_type || '').toUpperCase();
      const matches = docType.includes('PAN') || docType === 'PAN' || docType === 'PANCR';
      if (matches) {
        console.log(`✅ Found PAN document: ${docType}`);
      }
      return matches;
    });

    // Also check if PAN number was extracted and saved to users table
    // This handles cases where PAN was extracted from PANCR PDF but document check might fail
    if (!hasPanDocument) {
      try {
        const userPan = await executeQuery(
          'SELECT pan_number FROM users WHERE id = ? AND pan_number IS NOT NULL AND pan_number != ""',
          [userId]
        );
        if (userPan && userPan.length > 0 && userPan[0].pan_number) {
          console.log(`✅ PAN number found in users table: ${userPan[0].pan_number.substring(0, 3)}***`);
          hasPanDocument = true;
        } else {
          console.log('⚠️ No PAN number found in users table');
        }
      } catch (panCheckError) {
        console.error('Error checking PAN in users table:', panCheckError);
        // Continue with document check result
      }
    }

    // Also check verification_records table for PAN verification
    if (!hasPanDocument) {
      try {
        const panVerification = await executeQuery(
          `SELECT id FROM verification_records 
           WHERE user_id = ? AND document_type = 'PAN' AND verification_status = 'verified'`,
          [userId]
        );
        if (panVerification && panVerification.length > 0) {
          console.log('✅ PAN found in verification_records table');
          hasPanDocument = true;
        }
      } catch (verificationError) {
        console.error('Error checking verification_records:', verificationError);
      }
    }

    console.log(`📊 PAN document check result: ${hasPanDocument ? 'FOUND' : 'NOT FOUND'}`);

    res.json({
      success: true,
      data: {
        hasPanDocument: hasPanDocument,
        transactionId: verificationData.transactionId || null
      }
    });
  } catch (error) {
    console.error('Error checking PAN document:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check PAN document',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
module.exports.processAndUploadDocs = processAndUploadDocs;

