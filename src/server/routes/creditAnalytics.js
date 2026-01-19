const express = require('express');
const { executeQuery, initializeDatabase } = require('../config/database');
const { requireAuth } = require('../middleware/jwtAuth');
const creditAnalyticsService = require('../services/creditAnalyticsService');

const router = express.Router();

/**
 * POST /api/credit-analytics/check
 * Perform credit check for a user (one-time check)
 */
router.post('/check', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;

    // Check if credit check already exists for this user
    const existingCheck = await executeQuery(
      'SELECT id, credit_score, is_eligible, checked_at FROM credit_checks WHERE user_id = ?',
      [userId]
    );

    if (existingCheck.length > 0) {
      return res.json({
        status: 'success',
        message: 'Credit check already performed',
        data: {
          already_checked: true,
          credit_score: existingCheck[0].credit_score,
          is_eligible: existingCheck[0].is_eligible,
          checked_at: existingCheck[0].checked_at
        }
      });
    }

    // Get user details for credit check
    const user = await executeQuery(
      'SELECT first_name, last_name, phone, email, pan_number, date_of_birth FROM users WHERE id = ?',
      [userId]
    );

    if (!user || user.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    const userData = user[0];

    // Priority 1: Check for PANCR document in kyc_documents and extract PAN via OCR
    if (!userData.pan_number) {
      try {
        const { downloadFromS3 } = require('../services/s3Service');
        
        // Import OCR function from adminUsers (same robust OCR implementation)
        const extractPANFromText = (text) => {
          if (!text || typeof text !== 'string') {
            return null;
          }
          const panPattern = /\b([A-Z]{5}[0-9]{4}[A-Z]{1})\b/g;
          const matches = text.match(panPattern);
          if (matches && matches.length > 0) {
            const pan = matches[0].toUpperCase();
            console.log(`   📄 Extracted PAN from PDF: ${pan}`);
            return pan;
          }
          const panWithLabel = /Permanent\s+Account\s+Number\s+([A-Z]{5}[0-9]{4}[A-Z]{1})/gi;
          const labelMatch = text.match(panWithLabel);
          if (labelMatch) {
            const pan = labelMatch[0].replace(/Permanent\s+Account\s+Number\s+/gi, '').trim().toUpperCase();
            console.log(`   📄 Extracted PAN from PDF (with label): ${pan}`);
            return pan;
          }
          return null;
        };

        const extractPANFromPDF = async (pdfBuffer) => {
          let parser = null;
          try {
            if (!Buffer.isBuffer(pdfBuffer)) {
              pdfBuffer = Buffer.from(pdfBuffer);
            }
            console.log('   🔍 Attempting to parse PDF, buffer size:', pdfBuffer.length);
            const { PDFParse } = require('pdf-parse');
            parser = new PDFParse({ data: pdfBuffer });
            const result = await parser.getText();
            const text = result.text || '';
            console.log('   ✅ PDF parsed successfully, text length:', text.length);
            return extractPANFromText(text);
          } catch (error) {
            console.error('   ❌ Error extracting PAN from PDF:', error.message);
            console.error('   Error stack:', error.stack);
            return null;
          } finally {
            if (parser) {
              try {
                await parser.destroy();
              } catch (destroyError) {
                // Ignore destroy errors
              }
            }
          }
        };

        const pancrDocs = await executeQuery(
          'SELECT id, s3_key, file_name FROM kyc_documents WHERE user_id = ? AND document_type = ? AND s3_key IS NOT NULL ORDER BY created_at DESC LIMIT 1',
          [userId, 'PANCR']
        );

        if (pancrDocs && pancrDocs.length > 0 && pancrDocs[0].s3_key) {
          console.log(`📄 Found PANCR document, extracting PAN via OCR...`);
          try {
            // Download PDF from S3
            const pdfBuffer = await downloadFromS3(pancrDocs[0].s3_key);
            console.log(`✅ Downloaded PANCR PDF from S3, size: ${pdfBuffer.length} bytes`);

            // Extract PAN from PDF
            const extractedPAN = await extractPANFromPDF(pdfBuffer);

            if (extractedPAN) {
              // Validate PAN format
              const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
              if (panRegex.test(extractedPAN)) {
                // Update users table with extracted PAN
                await executeQuery(
                  `UPDATE users 
                   SET pan_number = ?,
                       updated_at = NOW()
                   WHERE id = ?`,
                  [extractedPAN, userId]
                );
                console.log(`✅ Saved extracted PAN to users table: ${extractedPAN}`);

                // Also save to verification_records table
                await executeQuery(
                  `INSERT INTO verification_records (user_id, document_type, document_number, verification_status, created_at, updated_at)
                   VALUES (?, 'pan', ?, 'pending', NOW(), NOW())
                   ON DUPLICATE KEY UPDATE
                     document_number = VALUES(document_number),
                     updated_at = NOW()`,
                  [userId, extractedPAN]
                );
                console.log(`✅ Saved PAN to verification_records: ${extractedPAN}`);

                userData.pan_number = extractedPAN;
              } else {
                console.warn(`⚠️ Extracted PAN format invalid: ${extractedPAN}`);
              }
            } else {
              console.warn(`⚠️ Could not extract PAN from PANCR PDF`);
            }
          } catch (ocrError) {
            console.error(`❌ Error processing PANCR document for OCR: ${ocrError.message}`);
          }
        }
      } catch (kycError) {
        console.error(`❌ Error checking kyc_documents for PANCR: ${kycError.message}`);
      }
    }

    // Priority 2: Get PAN from verification_records (if already extracted)
    if (!userData.pan_number) {
      const panVerification = await executeQuery(
        'SELECT document_number FROM verification_records WHERE user_id = ? AND document_type = ? ORDER BY updated_at DESC LIMIT 1',
        [userId, 'pan']
      );

      if (panVerification && panVerification.length > 0 && panVerification[0].document_number) {
        userData.pan_number = panVerification[0].document_number;
        console.log(`✅ Using PAN from verification_records: ${userData.pan_number}`);
      }
    }

    // Priority 2: Get DOB from user_info (Aadhar from Digilocker)
    if (!userData.date_of_birth) {
      const aadharInfo = await executeQuery(
        'SELECT dob FROM user_info WHERE user_id = ? AND source = ? ORDER BY created_at DESC LIMIT 1',
        [userId, 'digilocker']
      );

      if (aadharInfo && aadharInfo.length > 0 && aadharInfo[0].dob) {
        userData.date_of_birth = aadharInfo[0].dob;
        console.log(`✅ Using DOB from Aadhar (Digilocker): ${userData.date_of_birth}`);
      }
    }

    // Fallback: If PAN or DOB still not found, try to get from digitap_responses (pre-fill data)
    if (!userData.pan_number || !userData.date_of_birth) {
      const digitapData = await executeQuery(
        'SELECT response_data FROM digitap_responses WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
        [userId]
      );

      if (digitapData && digitapData.length > 0 && digitapData[0].response_data) {
        const prefillData = typeof digitapData[0].response_data === 'string'
          ? JSON.parse(digitapData[0].response_data)
          : digitapData[0].response_data;

        // Use pre-fill data if available (only if not already found)
        if (!userData.pan_number && prefillData.pan) {
          userData.pan_number = prefillData.pan;
          console.log(`✅ Using PAN from digitap_responses: ${userData.pan_number}`);
        }
        if (!userData.date_of_birth && prefillData.dob) {
          // Convert DD/MM/YYYY to YYYY-MM-DD if needed
          if (prefillData.dob.includes('/')) {
            const dobParts = prefillData.dob.split('/');
            if (dobParts.length === 3) {
              userData.date_of_birth = `${dobParts[2]}-${dobParts[1]}-${dobParts[0]}`;
            }
          } else {
            userData.date_of_birth = prefillData.dob;
          }
          console.log(`✅ Using DOB from digitap_responses: ${userData.date_of_birth}`);
        }
      }
    }

    // Validate required fields after checking all sources
    if (!userData.pan_number || !userData.date_of_birth) {
      return res.status(400).json({
        status: 'error',
        message: 'PAN and Date of Birth are required for credit check. Please complete your KYC first.'
      });
    }

    // Request credit report from Experian
    const clientRefNum = `PC${userId}_${Date.now()}`;
    
    // Normalize email - treat placeholder values as empty
    const placeholderEmails = ['N/A', 'NA', 'n/a', 'na', 'NONE', 'none', 'NULL', 'null', ''];
    const normalizedEmail = userData.email && !placeholderEmails.includes(userData.email.trim().toUpperCase())
      ? userData.email
      : null;
    
    // Use default email if normalized email is null/empty
    const emailForRequest = normalizedEmail || `user${userId}@pocketcredit.in`;
    
    const creditReportResponse = await creditAnalyticsService.requestCreditReport({
      client_ref_num: clientRefNum,
      mobile_no: userData.phone,
      first_name: userData.first_name || 'User',
      last_name: userData.last_name || '',
      date_of_birth: userData.date_of_birth, // YYYY-MM-DD
      email: emailForRequest,
      pan: userData.pan_number,
      device_ip: req.ip || '192.168.1.1'
    });

    // Validate eligibility
    const validation = creditAnalyticsService.validateEligibility(creditReportResponse);

    // Extract PDF URL from response and download to S3
    let s3PdfKey = null;
    const experianPdfUrl = creditAnalyticsService.extractPdfUrl(creditReportResponse);
    
    if (experianPdfUrl) {
      console.log('📄 PDF URL extracted from response:', experianPdfUrl);
      
      try {
        // Download PDF from Experian URL
        const axios = require('axios');
        console.log('📥 Downloading credit report PDF from Experian...');
        const pdfResponse = await axios.get(experianPdfUrl, {
          responseType: 'arraybuffer',
          timeout: 30000,
          headers: {
            'Accept': 'application/pdf'
          }
        });
        
        const pdfBuffer = Buffer.from(pdfResponse.data);
        console.log(`✅ Downloaded PDF from Experian, size: ${pdfBuffer.length} bytes`);
        
        // Validate it's a PDF
        if (pdfBuffer.length < 100 || !pdfBuffer.toString('ascii', 0, 4).startsWith('%PDF')) {
          throw new Error('Downloaded file does not appear to be a valid PDF');
        }
        
        // Upload to S3
        const { uploadGeneratedPDF } = require('../services/s3Service');
        const fileName = `Credit_Report_${clientRefNum}.pdf`;
        const uploadResult = await uploadGeneratedPDF(pdfBuffer, fileName, userId, 'credit-report');
        s3PdfKey = uploadResult.key;
        console.log(`✅ Uploaded credit report PDF to S3: ${s3PdfKey}`);
      } catch (pdfError) {
        console.error('❌ Error downloading/uploading credit report PDF:', pdfError.message);
        // Continue without PDF - don't fail the entire credit check
        // Save the original Experian URL as fallback
        s3PdfKey = experianPdfUrl;
      }
    } else {
      console.log('⚠️ PDF URL not found in credit report response');
    }

    // Save credit check to database (one-time per user)
    await executeQuery(
      `INSERT INTO credit_checks (
        user_id, request_id, client_ref_num, 
        credit_score, result_code, api_message, 
        is_eligible, rejection_reasons,
        has_settlements, has_writeoffs, has_suit_files, has_wilful_default,
        negative_indicators, full_report, pdf_url, checked_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        userId,
        creditReportResponse.request_id,
        clientRefNum,
        validation.creditScore,
        creditReportResponse.result_code,
        creditReportResponse.message,
        validation.isEligible,
        validation.reasons.length > 0 ? JSON.stringify(validation.reasons) : null,
        validation.negativeIndicators.hasSettlements,
        validation.negativeIndicators.hasWriteOffs,
        validation.negativeIndicators.hasSuitFiles,
        validation.negativeIndicators.hasWilfulDefault,
        JSON.stringify(validation.negativeIndicators),
        JSON.stringify(creditReportResponse),
        s3PdfKey || null
      ]
    );

    // If not eligible, update user profile to on_hold
    if (!validation.isEligible) {
      const holdReason = `Credit check failed: ${validation.reasons.join(', ')}`;
      const holdDuration = 60; // 60 days hold

      await executeQuery(
        `UPDATE users 
         SET on_hold = TRUE, 
             hold_reason = ?, 
             hold_until = DATE_ADD(NOW(), INTERVAL ? DAY)
         WHERE id = ?`,
        [holdReason, holdDuration, userId]
      );
    }

    res.json({
      status: 'success',
      message: validation.isEligible ? 'Credit check passed' : 'Credit check failed',
      data: {
        is_eligible: validation.isEligible,
        credit_score: validation.creditScore,
        reasons: validation.reasons,
        request_id: creditReportResponse.request_id
      }
    });

  } catch (error) {
    console.error('Credit check error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to perform credit check',
      error: error.message
    });
  }
});

/**
 * GET /api/credit-analytics/status
 * Check if credit check is already performed for the current user
 */
router.get('/status', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;

    // Check if credit check exists for this user
    const creditCheck = await executeQuery(
      'SELECT id, credit_score, is_eligible, checked_at FROM credit_checks WHERE user_id = ?',
      [userId]
    );

    res.json({
      status: 'success',
      message: 'Credit check status retrieved',
      data: {
        completed: creditCheck.length > 0,
        credit_score: creditCheck.length > 0 ? creditCheck[0].credit_score : null,
        is_eligible: creditCheck.length > 0 ? creditCheck[0].is_eligible : null,
        checked_at: creditCheck.length > 0 ? creditCheck[0].checked_at : null
      }
    });

  } catch (error) {
    console.error('Credit check status error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to check credit status',
      error: error.message
    });
  }
});

/**
 * GET /api/credit-analytics/data
 * Get full credit analytics data for the current user
 */
router.get('/data', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;

    // Fetch credit check data from credit_checks table
    const query = `
      SELECT 
        id,
        user_id,
        request_id,
        client_ref_num,
        credit_score,
        result_code,
        api_message,
        is_eligible,
        rejection_reasons,
        has_settlements,
        has_writeoffs,
        has_suit_files,
        has_wilful_default,
        negative_indicators,
        full_report,
        pdf_url,
        checked_at,
        created_at,
        updated_at
      FROM credit_checks
      WHERE user_id = ?
      ORDER BY checked_at DESC
      LIMIT 1
    `;

    const results = await executeQuery(query, [userId]);

    if (results.length === 0) {
      return res.json({
        status: 'success',
        message: 'No credit analytics data found for this user',
        data: null
      });
    }

    const creditData = results[0];

    // Parse JSON fields
    if (creditData.rejection_reasons) {
      try {
        creditData.rejection_reasons = JSON.parse(creditData.rejection_reasons);
      } catch (e) {
        creditData.rejection_reasons = [];
      }
    }

    if (creditData.negative_indicators) {
      try {
        creditData.negative_indicators = JSON.parse(creditData.negative_indicators);
      } catch (e) {
        creditData.negative_indicators = null;
      }
    }

    if (creditData.full_report) {
      try {
        // Check if it's already an object or needs parsing
        if (typeof creditData.full_report === 'string') {
          creditData.full_report = JSON.parse(creditData.full_report);
        }
      } catch (e) {
        console.error('❌ Error parsing credit report full_report:', e);
        creditData.full_report = null;
      }
    }

    // Generate presigned URL if pdf_url is an S3 key (starts with "pocket/" or doesn't start with "http")
    let pdfUrl = creditData.pdf_url;
    if (pdfUrl && !pdfUrl.startsWith('http')) {
      try {
        // pdf_url is an S3 key, generate presigned URL (expires in 1 hour)
        const { getPresignedUrl } = require('../services/s3Service');
        pdfUrl = await getPresignedUrl(pdfUrl, 3600);
        console.log('✅ Generated presigned URL for credit report PDF');
      } catch (error) {
        console.error('❌ Failed to generate presigned URL for credit report PDF:', error);
        // Keep original S3 key if presigned URL generation fails
      }
    }

    res.json({
      status: 'success',
      message: 'Credit analytics data retrieved successfully',
      data: {
        ...creditData,
        pdf_url: pdfUrl
      }
    });

  } catch (error) {
    console.error('Get credit analytics error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve credit analytics data'
    });
  }
});

module.exports = router;

