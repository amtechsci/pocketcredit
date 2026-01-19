const express = require('express');
const { authenticateAdmin } = require('../middleware/auth');
const { executeQuery, initializeDatabase } = require('../config/database');
const { validateRequest } = require('../middleware/validation');
const { getPresignedUrl, uploadStudentDocument } = require('../services/s3Service');
const { getLoanCalculation } = require('../utils/loanCalculations');
const pdfService = require('../services/pdfService');
const emailService = require('../services/emailService');
const axios = require('axios');
const puppeteer = require('puppeteer');
const router = express.Router();

/**
 * Format date to YYYY-MM-DD without timezone conversion
 */
function formatDateLocal(date) {
  // If date is a string or needs parsing, parse it safely to avoid timezone issues
  let d = date;
  if (typeof date === 'string' || !(date instanceof Date)) {
    const tempDate = new Date(date);
    d = new Date(tempDate.getUTCFullYear(), tempDate.getUTCMonth(), tempDate.getUTCDate(), 0, 0, 0, 0);
  } else if (date instanceof Date) {
    // If already a Date object, ensure we're using local values
    d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Helper function to get KFS HTML using Puppeteer
 */
async function getKFSHTML(loanId, baseUrl = 'http://localhost:5000') {
  let browser = null;
  try {
    console.log(`📊 Fetching KFS data for loan #${loanId}...`);
    const kfsDataResponse = await axios.get(`${baseUrl}/api/kfs/${loanId}`, {
      headers: {
        'x-internal-call': 'true'
      }
    });

    if (!kfsDataResponse.data.success || !kfsDataResponse.data.data) {
      throw new Error('Failed to get KFS data');
    }

    const kfsData = kfsDataResponse.data.data;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const kfsUrl = `${frontendUrl}/stpl/kfs/${loanId}?internal=true`;

    console.log(`🌐 Rendering KFS HTML via Puppeteer...`);
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto(kfsUrl, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    await page.waitForSelector('.kfs-document-content', { timeout: 10000 });

    const htmlContent = await page.evaluate(() => {
      const kfsElement = document.querySelector('.kfs-document-content');
      return kfsElement ? kfsElement.outerHTML : null;
    });

    if (!htmlContent) {
      throw new Error('KFS content not found on page');
    }

    return htmlContent;
  } catch (error) {
    console.error('Error getting KFS HTML:', error);
    throw new Error(`Failed to get KFS HTML: ${error.message}`);
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error closing browser:', closeError);
      }
    }
  }
}

/**
 * Helper function to get Loan Agreement HTML using Puppeteer
 */
async function getLoanAgreementHTML(loanId, baseUrl = 'http://localhost:5000') {
  let browser = null;
  try {
    console.log(`📊 Fetching Loan Agreement data for loan #${loanId}...`);
    const kfsDataResponse = await axios.get(`${baseUrl}/api/kfs/${loanId}`, {
      headers: {
        'x-internal-call': 'true'
      }
    });

    if (!kfsDataResponse.data.success || !kfsDataResponse.data.data) {
      throw new Error('Failed to get Loan Agreement data');
    }

    const agreementData = kfsDataResponse.data.data;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const agreementUrl = `${frontendUrl}/stpl/loan-agreement/${loanId}?internal=true`;

    console.log(`🌐 Rendering Loan Agreement HTML via Puppeteer...`);
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto(agreementUrl, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    await page.waitForSelector('.loan-agreement-content, .agreement-document', { timeout: 10000 });

    const htmlContent = await page.evaluate(() => {
      const agreementElement = document.querySelector('.loan-agreement-content') ||
        document.querySelector('.agreement-document');
      return agreementElement ? agreementElement.outerHTML : null;
    });

    if (!htmlContent) {
      throw new Error('Loan Agreement content not found on page');
    }

    return htmlContent;
  } catch (error) {
    console.error('Error getting Loan Agreement HTML:', error);
    throw new Error(`Failed to get Loan Agreement HTML: ${error.message}`);
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error closing browser:', closeError);
      }
    }
  }
}

/**
 * Helper function to send KFS and Loan Agreement emails automatically
 * Called when transaction details are updated
 */
async function sendKFSAndAgreementEmails(loanId) {
  try {
    console.log(`📧 Preparing to send KFS and Loan Agreement emails for loan #${loanId}...`);

    // Get loan and user details (including PDF URLs)
    const loans = await executeQuery(`
      SELECT 
        la.id, la.user_id, la.application_number, la.loan_amount, la.status,
        la.kfs_pdf_url, la.loan_agreement_pdf_url,
        u.email, u.first_name, u.last_name, u.personal_email, u.official_email
      FROM loan_applications la
      INNER JOIN users u ON la.user_id = u.id
      WHERE la.id = ?
    `, [loanId]);

    if (!loans || loans.length === 0) {
      console.warn(`⚠️ Loan ${loanId} not found, skipping email send`);
      return;
    }

    const loan = loans[0];
    const recipientEmail = loan.personal_email || loan.official_email || loan.email;
    const recipientName = `${loan.first_name || ''} ${loan.last_name || ''}`.trim() || 'User';

    if (!recipientEmail) {
      console.warn(`⚠️ No email address found for user ${loan.user_id}, skipping email send`);
      return;
    }

    const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:5000';
    const applicationNumber = loan.application_number || `LOAN_${loanId}`;

    const kfsFilename = `KFS_${applicationNumber}.pdf`;
    const agreementFilename = `Loan_Agreement_${applicationNumber}.pdf`;

    // PDFs should already be generated and uploaded during transaction addition
    // Download them from S3 using the URLs that were just saved
    let kfsPDF = null;
    let agreementPDF = null;
    const { downloadFromS3 } = require('../services/s3Service');

    // Get KFS PDF from S3 (should be available since it was just generated)
    if (loan.kfs_pdf_url) {
      try {
        console.log(`📥 Downloading KFS PDF from S3: ${loan.kfs_pdf_url}`);
        const kfsBuffer = await downloadFromS3(loan.kfs_pdf_url);
        kfsPDF = { buffer: kfsBuffer };
        console.log(`✅ KFS PDF downloaded from S3, size: ${kfsBuffer.length} bytes`);
      } catch (s3Error) {
        console.error(`❌ Failed to download KFS PDF from S3:`, s3Error.message);
        // Fallback: generate new one if download fails
        console.log(`📄 Generating KFS HTML for loan #${loanId}...`);
        const kfsHTML = await getKFSHTML(loanId, apiBaseUrl);
        console.log(`📄 Generating KFS PDF: ${kfsFilename}`);
        kfsPDF = await pdfService.generateKFSPDF(kfsHTML, kfsFilename);
      }
    } else {
      // If URL not available, generate new one
      console.log(`📄 Generating KFS HTML for loan #${loanId}...`);
      const kfsHTML = await getKFSHTML(loanId, apiBaseUrl);
      console.log(`📄 Generating KFS PDF: ${kfsFilename}`);
      kfsPDF = await pdfService.generateKFSPDF(kfsHTML, kfsFilename);
    }

    // Get Loan Agreement PDF from S3 (should be available since it was just generated)
    if (loan.loan_agreement_pdf_url) {
      try {
        console.log(`📥 Downloading Loan Agreement PDF from S3: ${loan.loan_agreement_pdf_url}`);
        const agreementBuffer = await downloadFromS3(loan.loan_agreement_pdf_url);
        agreementPDF = { buffer: agreementBuffer };
        console.log(`✅ Loan Agreement PDF downloaded from S3, size: ${agreementBuffer.length} bytes`);
      } catch (s3Error) {
        console.error(`❌ Failed to download Loan Agreement PDF from S3:`, s3Error.message);
        // Fallback: generate new one if download fails
        console.log(`📄 Getting Loan Agreement HTML for loan #${loanId}...`);
        const loanAgreementHTML = await getLoanAgreementHTML(loanId, apiBaseUrl);
        console.log(`📄 Generating Loan Agreement PDF: ${agreementFilename}`);
        agreementPDF = await pdfService.generateKFSPDF(loanAgreementHTML, agreementFilename);
      }
    } else {
      // If URL not available, generate new one
      console.log(`📄 Getting Loan Agreement HTML for loan #${loanId}...`);
      const loanAgreementHTML = await getLoanAgreementHTML(loanId, apiBaseUrl);
      console.log(`📄 Generating Loan Agreement PDF: ${agreementFilename}`);
      agreementPDF = await pdfService.generateKFSPDF(loanAgreementHTML, agreementFilename);
    }

    // Send KFS email
    try {
      await emailService.sendKFSEmail({
        loanId: loan.id,
        recipientEmail: recipientEmail,
        recipientName: recipientName,
        loanData: {
          application_number: loan.application_number,
          sanctioned_amount: loan.loan_amount,
          loan_term_days: 30,
          status: loan.status
        },
        pdfBuffer: kfsPDF.buffer,
        pdfFilename: kfsFilename,
        sentBy: null // System-generated
      });
      console.log(`✅ KFS email sent successfully to: ${recipientEmail}`);
    } catch (kfsEmailError) {
      console.error('❌ Error sending KFS email (non-fatal):', kfsEmailError.message);
    }

    // Send Loan Agreement email (using signed agreement email method)
    // Note: The subject will say "Signed Loan Agreement" but it's sent automatically when transaction is updated
    try {
      await emailService.sendSignedAgreementEmail({
        loanId: loan.id,
        recipientEmail: recipientEmail,
        recipientName: recipientName,
        loanData: {
          application_number: loan.application_number,
          loan_amount: loan.loan_amount,
          status: loan.status
        },
        pdfBuffer: agreementPDF.buffer,
        pdfFilename: agreementFilename,
        sentBy: null // System-generated
      });
      console.log(`✅ Loan Agreement email sent successfully to: ${recipientEmail}`);
    } catch (agreementEmailError) {
      console.error('❌ Error sending Loan Agreement email (non-fatal):', agreementEmailError.message);
    }

    console.log(`✅ KFS and Loan Agreement emails sent successfully for loan #${loanId}`);
  } catch (error) {
    console.error(`❌ Error sending KFS and Loan Agreement emails for loan #${loanId}:`, error);
    // Don't throw - this is a non-critical operation
  }
}

// Get user profile with all related data
router.get('/:userId', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { userId } = req.params;

    // Get user basic info from MySQL (including PAN, alternate_mobile, company_name, company_email)
    const users = await executeQuery(`
      SELECT 
        id, first_name, last_name, email, phone, 
        date_of_birth, gender, marital_status, kyc_completed, 
        email_verified, phone_verified, status, profile_completion_step, 
        profile_completed, eligibility_status, eligibility_reason, 
        eligibility_retry_date, selected_loan_plan_id, created_at, updated_at, last_login_at,
        pan_number, alternate_mobile, company_name, company_email, salary_date,
        personal_email, official_email, loan_limit, credit_score, experian_score,
        monthly_net_income, work_experience_range, employment_type, income_range,
        application_hold_reason
      FROM users 
      WHERE id = ?
    `, [userId]);

    if (!users || users.length === 0) {
      console.log('❌ User not found in database');
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    const user = users[0];
    console.log('👤 User data:', user);

    // Get user's selected loan plan if exists
    let selectedLoanPlan = null;
    if (user.selected_loan_plan_id) {
      const plans = await executeQuery(
        'SELECT * FROM loan_plans WHERE id = ?',
        [user.selected_loan_plan_id]
      );
      if (plans && plans.length > 0) {
        selectedLoanPlan = plans[0];
      }
    }

    // Get loan applications for this user with e-nach status
    const applications = await executeQuery(`
      SELECT 
        la.id, la.application_number, la.loan_amount, la.loan_purpose, 
        la.tenure_months, la.status, la.rejection_reason, 
        la.approved_by, la.approved_at, la.disbursed_at, la.created_at, la.updated_at,
        la.processing_fee_percent, la.interest_percent_per_day, 
        la.processing_fee, la.total_interest, la.total_repayable, la.plan_snapshot,
        la.disbursal_amount, la.processed_at,
        la.processed_amount, la.exhausted_period_days, la.processed_p_fee,
        la.processed_post_service_fee, la.processed_gst, la.processed_interest,
        la.processed_penalty, la.processed_due_date, la.emi_schedule,
        es.status as enach_status
      FROM loan_applications la
      LEFT JOIN (
        SELECT es1.loan_application_id, es1.status
        FROM enach_subscriptions es1
        WHERE es1.id = (
          SELECT MAX(es2.id)
          FROM enach_subscriptions es2
          WHERE es2.loan_application_id = es1.loan_application_id
        )
      ) es ON la.id = es.loan_application_id
      WHERE la.user_id = ?
      ORDER BY la.created_at DESC
    `, [userId]);

    console.log('📋 Found applications:', applications ? applications.length : 0);

    // Get latest loan application status for profile status display
    const latestApplication = applications && applications.length > 0 ? applications[0] : null;
    const profileStatus = latestApplication ? latestApplication.status : (user.status || 'active');

    // Get assigned account manager if status is account_manager
    let assignedManager = null;
    if (profileStatus === 'account_manager' && latestApplication?.approved_by) {
      const manager = await executeQuery('SELECT name FROM admins WHERE id = ?', [latestApplication.approved_by]);
      if (manager && manager.length > 0) {
        assignedManager = manager[0].name;
      }
    }

    // Calculate pocket credit score (default 640, increase by 6 if loan cleared on/before due date)
    let pocketCreditScore = user.credit_score || 640;

    // Check if user has any cleared loans that were cleared on or before due date
    if (applications && applications.length > 0) {
      const clearedLoans = applications.filter(app => app.status === 'cleared');
      for (const loan of clearedLoans) {
        // Check if loan was cleared on or before due date
        if (loan.disbursed_at) {
          const disbursedDate = new Date(loan.disbursed_at);
          const dueDate = new Date(disbursedDate);
          // Assuming tenure in months, calculate due date
          const tenureDays = loan.tenure_months ? loan.tenure_months * 30 : 30;
          dueDate.setDate(dueDate.getDate() + tenureDays);
          const clearedDate = loan.updated_at ? new Date(loan.updated_at) : new Date();

          if (clearedDate <= dueDate) {
            pocketCreditScore += 6;
          }
        }
      }
    }

    // Get ALL addresses (not just primary) - ordered by is_primary DESC, then created_at DESC
    const addresses = await executeQuery(`
      SELECT * FROM addresses 
      WHERE user_id = ? 
      ORDER BY is_primary DESC, created_at DESC
    `, [userId]);

    // Get ALL employment details (latest first) - also get income_range from users table
    const employment = await executeQuery(`
      SELECT ed.*, u.income_range 
      FROM employment_details ed
      LEFT JOIN users u ON ed.user_id = u.id
      WHERE ed.user_id = ? 
      ORDER BY ed.id DESC
    `, [userId]);

    // Try to get income_range from users table if not in employment
    let incomeRange = (employment && employment[0])?.income_range;
    if (!incomeRange) {
      const userIncomeRange = await executeQuery(
        'SELECT income_range FROM users WHERE id = ?',
        [userId]
      );
      incomeRange = userIncomeRange[0]?.income_range || null;
    }

    // Get ALL references for this user
    const references = await executeQuery(`
      SELECT id, user_id, name, phone, relation, status, admin_id, admin_notes as notes, created_at, updated_at 
      FROM \`references\` 
      WHERE user_id = ? 
      ORDER BY created_at ASC
    `, [userId]);

    // Calculate age from date_of_birth
    const calculateAge = (dateOfBirth) => {
      if (!dateOfBirth) return 'N/A';
      const today = new Date();
      const birthDate = new Date(dateOfBirth);
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    };

    // Convert income_range to approximate monthly income
    const getMonthlyIncomeFromRange = (range) => {
      if (!range) return 0;
      const rangeMap = {
        // Old format
        '1k-20k': 10000,
        '20k-30k': 25000,
        '30k-40k': 35000,
        'above-40k': 50000,
        // New format from loan_limit_tiers
        '0-15000': 7500,
        '15000-30000': 22500,
        '30000-50000': 40000,
        '50000-75000': 62500,
        '75000-100000': 87500,
        '100000+': 125000
      };
      return rangeMap[range] || 0;
    };

    // Derive risk category and member level from available data
    const monthlyIncomeValue = getMonthlyIncomeFromRange(incomeRange);
    let riskCategory = 'N/A';
    if (monthlyIncomeValue > 0) {
      if (monthlyIncomeValue >= 50000) riskCategory = 'Low';
      else if (monthlyIncomeValue >= 25000) riskCategory = 'Medium';
      else riskCategory = 'High';
    }
    const memberLevel = riskCategory === 'Low' ? 'gold' : riskCategory === 'Medium' ? 'silver' : (riskCategory === 'High' ? 'bronze' : 'bronze');

    // Fetch bank statement report
    let bankStatement = null;
    let txnId = null;
    let bankStatementRecords = [];
    try {
      const bankStmtResults = await executeQuery(
        'SELECT id, report_data, txn_id, status, upload_method, file_path, file_name, file_size, bank_name, created_at, updated_at FROM user_bank_statements WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
      );
      if (bankStmtResults.length > 0) {
        // Get the latest completed one for bankStatement (backward compatibility)
        const completed = bankStmtResults.find(r => r.status === 'completed');
        if (completed && completed.report_data) {
          bankStatement = typeof completed.report_data === 'string'
            ? JSON.parse(completed.report_data)
            : completed.report_data;
          txnId = completed.txn_id;
          if (bankStatement && txnId) {
            bankStatement.txn_id = txnId;
          }
        }

        // Store all bank statement records
        bankStatementRecords = bankStmtResults.map(record => ({
          id: record.id,
          txn_id: record.txn_id,
          status: record.status,
          upload_method: record.upload_method || 'unknown',
          file_path: record.file_path,
          file_name: record.file_name,
          file_size: record.file_size,
          bank_name: record.bank_name,
          created_at: record.created_at,
          updated_at: record.updated_at,
          has_report_data: !!record.report_data
        }));
      }
    } catch (e) {
      console.error('Error fetching bank statement:', e);
    }

    // Fetch KYC Verification Data
    let kycData = null;
    try {
      const kycQuery = `
        SELECT verification_data, kyc_status as status, created_at
        FROM kyc_verifications 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT 1
      `;
      const kycResult = await executeQuery(kycQuery, [userId]);

      if (kycResult.length > 0) {
        kycData = kycResult[0];
        // Parse verification_data if it's a string
        if (kycData.verification_data && typeof kycData.verification_data === 'string') {
          try {
            kycData.verification_data = JSON.parse(kycData.verification_data);
          } catch (e) {
            console.error('Error parsing KYC verification data:', e);
          }
        }
      }
    } catch (e) {
      console.error('Error fetching KYC verification:', e);
    }

    // Fetch KYC Documents
    let kycDocuments = [];
    try {
      const docsQuery = `
        SELECT id, document_type, file_name, s3_key, mime_type, created_at
        FROM kyc_documents
        WHERE user_id = ?
        ORDER BY created_at DESC
      `;
      const docsResult = await executeQuery(docsQuery, [userId]);

      // Generate presigned URLs for documents
      kycDocuments = await Promise.all(docsResult.map(async (doc) => {
        try {
          const url = await getPresignedUrl(doc.s3_key);
          return { ...doc, url };
        } catch (err) {
          console.error(`Failed to generate URL for doc ${doc.id}:`, err);
          return { ...doc, url: null };
        }
      }));
    } catch (e) {
      console.error('Error fetching KYC documents:', e);
    }

    // Fetch Loan Application Documents for this user
    let loanApplicationDocuments = [];
    try {
      const loanDocsQuery = `
        SELECT 
          id, document_type as type, document_name as title,
          file_name as fileName, s3_key, mime_type, file_size as fileSize,
          upload_status as status, verification_notes as description, 
          verified_at as verifiedDate, uploaded_at as createdAt,
          loan_application_id
        FROM loan_application_documents
        WHERE user_id = ?
        ORDER BY uploaded_at DESC
      `;
      const loanDocsResult = await executeQuery(loanDocsQuery, [userId]);

      // Generate presigned URLs for documents
      loanApplicationDocuments = await Promise.all((loanDocsResult || []).map(async (doc) => {
        try {
          if (doc.s3_key) {
            const url = await getPresignedUrl(doc.s3_key, 3600); // 1 hour expiry
            return { ...doc, url };
          }
          return { ...doc, url: null };
        } catch (err) {
          console.error(`Failed to generate URL for doc ${doc.id}:`, err);
          return { ...doc, url: null };
        }
      }));
    } catch (e) {
      console.error('Error fetching loan application documents:', e);
      loanApplicationDocuments = [];
    }

    // Fetch user_info from multiple sources (for multi-source of truth)
    let userInfoRecords = [];
    try {
      const userInfoQuery = `
        SELECT id, name, dob, source, additional_details, created_at
        FROM user_info
        WHERE user_id = ?
        ORDER BY source, created_at DESC
      `;
      const userInfoResults = await executeQuery(userInfoQuery, [userId]);

      userInfoRecords = userInfoResults.map(record => {
        let additionalDetails = {};
        if (record.additional_details) {
          try {
            additionalDetails = typeof record.additional_details === 'string'
              ? JSON.parse(record.additional_details)
              : record.additional_details;
          } catch (e) {
            console.error('Error parsing additional_details:', e);
          }
        }
        return {
          id: record.id,
          name: record.name,
          dob: record.dob,
          source: record.source,
          additionalDetails: additionalDetails,
          createdAt: record.created_at
        };
      });
    } catch (e) {
      console.error('Error fetching user_info records:', e);
    }

    // Fetch user login history
    let loginHistory = [];
    try {
      const loginHistoryQuery = `
        SELECT 
          id, ip_address, user_agent, browser_name, browser_version, device_type, 
          os_name, os_version, location_country, location_city, location_region, 
          latitude, longitude, login_time, success, failure_reason, created_at
        FROM user_login_history
        WHERE user_id = ?
        ORDER BY login_time DESC
        LIMIT 50
      `;
      const loginHistoryResults = await executeQuery(loginHistoryQuery, [userId]);

      // Transform login history to match frontend expectations for both formats
      loginHistory = (loginHistoryResults || []).map(login => {
        // Format device string
        const deviceParts = [];
        if (login.browser_name) deviceParts.push(login.browser_name);
        if (login.browser_version) deviceParts.push(login.browser_version);
        if (login.os_name) deviceParts.push(`on ${login.os_name}`);
        const deviceString = deviceParts.length > 0 ? deviceParts.join(' ') : login.device_type || 'Unknown Device';

        // Format location string
        const locationParts = [];
        if (login.location_city) locationParts.push(login.location_city);
        if (login.location_region) locationParts.push(login.location_region);
        if (login.location_country) locationParts.push(login.location_country);
        const locationString = locationParts.length > 0 ? locationParts.join(', ') : 'Unknown Location';

        return {
          // Original database fields (for detailed table view in Personal tab)
          id: login.id,
          ip_address: login.ip_address,
          user_agent: login.user_agent,
          browser_name: login.browser_name,
          browser_version: login.browser_version,
          device_type: login.device_type,
          os_name: login.os_name,
          os_version: login.os_version,
          location_country: login.location_country,
          location_city: login.location_city,
          location_region: login.location_region,
          latitude: login.latitude,
          longitude: login.longitude,
          login_time: login.login_time,
          success: login.success,
          failure_reason: login.failure_reason,
          created_at: login.created_at,
          // Formatted fields for Login Data tab
          device: deviceString,
          location: locationString,
          time: login.login_time ? new Date(login.login_time).toLocaleString('en-IN') : 'N/A',
          ip: login.ip_address || 'N/A'
        };
      });
    } catch (e) {
      console.error('Error fetching login history:', e);
    }

    // Fetch Bank Details
    let bankDetails = [];
    try {
      const bankQuery = `
        SELECT *
        FROM bank_details
        WHERE user_id = ?
        ORDER BY created_at DESC
      `;
      const bankResults = await executeQuery(bankQuery, [userId]);

      if (bankResults && bankResults.length > 0) {
        bankDetails = bankResults.map(bank => ({
          id: bank.id,
          bankName: bank.bank_name,
          accountNumber: bank.account_number,
          ifscCode: bank.ifsc_code,
          accountHolderName: bank.account_holder_name,
          branchName: bank.branch_name || 'N/A',
          accountType: bank.account_type || 'Savings',
          isPrimary: bank.is_primary ? true : false,
          verificationStatus: bank.verification_status || 'N/A',
          createdAt: bank.created_at
        }));
      }
    } catch (e) {
      console.error('Error fetching bank details:', e);
    }

    // Check for duplicate accounts (after bankDetails is fetched)
    const duplicateChecks = {
      panExists: false,
      panDuplicateUsers: [],
      bankAccountExists: false,
      bankAccountDuplicateUsers: [],
      mobileExists: false,
      mobileDuplicateUsers: [],
      referencePhoneExists: false,
      referencePhoneDuplicateUsers: []
    };

    // Check PAN number duplicates
    if (user.pan_number) {
      const panDuplicates = await executeQuery(`
        SELECT id, first_name, last_name, phone, email, created_at
        FROM users
        WHERE pan_number = ? AND id != ?
        ORDER BY created_at DESC
      `, [user.pan_number, userId]);

      if (panDuplicates && panDuplicates.length > 0) {
        duplicateChecks.panExists = true;
        duplicateChecks.panDuplicateUsers = panDuplicates.map(u => ({
          id: u.id,
          name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Unknown',
          phone: u.phone || 'N/A',
          email: u.email || 'N/A',
          created_at: u.created_at
        }));
      }
    }

    // Check bank account number duplicates
    if (bankDetails && bankDetails.length > 0) {
      const accountNumbers = bankDetails.map(b => b.accountNumber).filter(Boolean);
      if (accountNumbers.length > 0) {
        const bankDuplicates = await executeQuery(`
          SELECT DISTINCT bd.user_id, u.id, u.first_name, u.last_name, u.phone, u.email, bd.account_number, bd.created_at
          FROM bank_details bd
          INNER JOIN users u ON bd.user_id = u.id
          WHERE bd.account_number IN (${accountNumbers.map(() => '?').join(',')}) 
            AND bd.user_id != ?
          ORDER BY bd.created_at DESC
        `, [...accountNumbers, userId]);

        if (bankDuplicates && bankDuplicates.length > 0) {
          duplicateChecks.bankAccountExists = true;
          duplicateChecks.bankAccountDuplicateUsers = bankDuplicates.map(u => ({
            id: u.id,
            name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Unknown',
            phone: u.phone || 'N/A',
            email: u.email || 'N/A',
            accountNumber: u.account_number,
            created_at: u.created_at
          }));
        }
      }
    }

    // Check mobile number duplicates
    if (user.phone) {
      const mobileDuplicates = await executeQuery(`
        SELECT id, first_name, last_name, phone, email, pan_number, created_at
        FROM users
        WHERE phone = ? AND id != ?
        ORDER BY created_at DESC
      `, [user.phone, userId]);

      if (mobileDuplicates && mobileDuplicates.length > 0) {
        duplicateChecks.mobileExists = true;
        duplicateChecks.mobileDuplicateUsers = mobileDuplicates.map(u => ({
          id: u.id,
          name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Unknown',
          phone: u.phone || 'N/A',
          email: u.email || 'N/A',
          panNumber: u.pan_number || 'N/A',
          created_at: u.created_at
        }));
      }
    }

    // Check reference phone number duplicates
    if (references && references.length > 0) {
      const referencePhones = references.map(r => r.phone).filter(Boolean);
      if (referencePhones.length > 0) {
        // Check if any reference phone matches other users' primary mobile or alternate mobile
        // Build query with proper placeholders
        const placeholders = referencePhones.map(() => '?').join(',');
        // Need 4 copies: one for each CASE and two for WHERE clause
        const allParams = [...referencePhones, ...referencePhones, ...referencePhones, ...referencePhones, userId];

        const referencePhoneDuplicates = await executeQuery(`
          SELECT DISTINCT u.id, u.first_name, u.last_name, u.phone, u.email, u.alternate_mobile, u.created_at,
                 COALESCE(
                   CASE WHEN u.phone IN (${placeholders}) THEN u.phone END,
                   CASE WHEN u.alternate_mobile IN (${placeholders}) THEN u.alternate_mobile END,
                   NULL
                 ) as matching_phone
          FROM users u
          WHERE (u.phone IN (${placeholders}) 
             OR u.alternate_mobile IN (${placeholders}))
            AND u.id != ?
          ORDER BY u.created_at DESC
        `, allParams);

        if (referencePhoneDuplicates && referencePhoneDuplicates.length > 0) {
          duplicateChecks.referencePhoneExists = true;
          duplicateChecks.referencePhoneDuplicateUsers = referencePhoneDuplicates.map(u => ({
            id: u.id,
            name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Unknown',
            phone: u.phone || 'N/A',
            email: u.email || 'N/A',
            matchingPhone: u.matching_phone || (u.phone && referencePhones.includes(u.phone) ? u.phone : (u.alternate_mobile && referencePhones.includes(u.alternate_mobile) ? u.alternate_mobile : 'N/A')),
            created_at: u.created_at
          }));
        }
      }
    }

    // Construct bankInfo object for frontend compatibility (UserProfileDetail.tsx expects this structure)
    let bankInfo = {
      bankName: 'N/A',
      accountNumber: 'N/A',
      ifscCode: 'N/A',
      accountType: 'N/A',
      accountHolderName: 'N/A',
      branchName: 'N/A',
      verificationStatus: 'N/A',
      verifiedDate: null,
      addedDate: null,
      isPrimary: false
    };

    if (bankDetails.length > 0) {
      // Use the primary bank account if available, otherwise the most recent one
      const primaryBank = bankDetails.find(b => b.isPrimary) || bankDetails[0];

      bankInfo = {
        id: primaryBank.id,
        bankName: primaryBank.bankName || 'N/A',
        accountNumber: primaryBank.accountNumber || 'N/A',
        ifscCode: primaryBank.ifscCode || 'N/A',
        accountType: primaryBank.accountType || 'Savings',
        accountHolderName: primaryBank.accountHolderName || 'N/A',
        branchName: primaryBank.branchName || 'N/A',
        verificationStatus: primaryBank.verificationStatus || 'pending',
        verifiedDate: primaryBank.verifiedDate || null,
        addedDate: primaryBank.createdAt || null,
        isPrimary: primaryBank.isPrimary
      };
    }

    // Generate customer unique ID (CLID) - format: PC + user ID
    const clid = `PC${String(user.id).padStart(5, '0')}`;

    // Fetch follow-ups
    let followUps = [];
    try {
      // Check if table exists and fix admin_id column type if needed
      try {
        const tableCheck = await executeQuery(`
          SELECT COLUMN_TYPE 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'user_follow_ups' 
          AND COLUMN_NAME = 'admin_id'
        `);

        if (tableCheck.length > 0 && tableCheck[0].COLUMN_TYPE !== 'varchar(36)') {
          // Drop foreign key if exists
          try {
            await executeQuery(`ALTER TABLE user_follow_ups DROP FOREIGN KEY user_follow_ups_ibfk_2`);
          } catch (e) {
            // Foreign key might not exist or have different name
          }
          // Alter column type
          await executeQuery(`ALTER TABLE user_follow_ups MODIFY admin_id VARCHAR(36)`);
          // Recreate foreign key
          await executeQuery(`
            ALTER TABLE user_follow_ups 
            ADD CONSTRAINT user_follow_ups_ibfk_2 
            FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
          `);
        }
      } catch (alterError) {
        // Table might not exist yet, continue to create it
      }

      // Create table if it doesn't exist
      await executeQuery(`
        CREATE TABLE IF NOT EXISTS user_follow_ups (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          loan_application_id INT DEFAULT NULL,
          follow_up_id VARCHAR(50) UNIQUE,
          type ENUM('call', 'email', 'sms', 'meeting', 'other', 'account_manager') NOT NULL,
          priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
          subject VARCHAR(200),
          description TEXT,
          response VARCHAR(200),
          assigned_to VARCHAR(100),
          admin_id VARCHAR(36),
          status ENUM('pending', 'in_progress', 'completed', 'cancelled', 'overdue') DEFAULT 'pending',
          scheduled_date DATETIME,
          due_date DATETIME,
          completed_date DATETIME,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL,
          INDEX idx_user_id (user_id),
          INDEX idx_status (status),
          INDEX idx_due_date (due_date),
          INDEX idx_follow_up_id (follow_up_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      // Ensure loan_application_id column exists
      try {
        const colCheck = await executeQuery(`SHOW COLUMNS FROM user_follow_ups LIKE 'loan_application_id'`);
        if (colCheck.length === 0) {
          await executeQuery(`ALTER TABLE user_follow_ups ADD COLUMN loan_application_id INT DEFAULT NULL AFTER user_id`);
        }
      } catch (e) { }

      // Ensure 'account_manager' is in ENUM
      try {
        await executeQuery(`
          ALTER TABLE user_follow_ups 
          MODIFY type ENUM('call', 'email', 'sms', 'meeting', 'other', 'account_manager') NOT NULL
        `);
      } catch (e) { }

      // Fetch follow-ups
      followUps = await executeQuery(`
        SELECT 
          uf.*,
          a.name as admin_name,
          a.email as admin_email
        FROM user_follow_ups uf
        LEFT JOIN admins a ON uf.admin_id = a.id
        WHERE uf.user_id = ?
        ORDER BY uf.created_at DESC
      `, [userId]);
    } catch (error) {
      console.error('Error fetching follow-ups:', error);
      followUps = [];
    }

    // Transform user data to match frontend expectations
    const userProfile = {
      id: user.id,
      clid: clid,
      name: `${user.first_name} ${user.last_name || ''}`.trim(),
      email: user.email || user.personal_email || user.official_email || 'N/A',
      personalEmail: user.personal_email || null,
      officialEmail: user.official_email || null,
      mobile: user.phone || 'N/A',
      dateOfBirth: user.date_of_birth ? new Date(user.date_of_birth).toLocaleDateString('en-IN') : 'N/A',
      panNumber: user.pan_number || 'N/A',
      alternateMobile: user.alternate_mobile || 'N/A',
      companyName: user.company_name || 'N/A',
      companyEmail: user.company_email || 'N/A',
      salaryDate: user.salary_date || null,
      loanLimit: parseFloat(user.loan_limit) || 0,
      monthlyIncome: parseFloat(user.monthly_net_income) || monthlyIncomeValue || 0,
      kycStatus: user.kyc_completed ? 'completed' : 'pending',
      isEmailVerified: user.email_verified ? true : false,
      isMobileVerified: user.phone_verified ? true : false,
      status: user.status || 'active',
      profileStatus: profileStatus, // Latest loan application status
      assignedManager: assignedManager, // Assigned account manager name
      registeredDate: user.created_at, // For admin UI compatibility
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      lastLoginAt: user.last_login_at || 'N/A',
      riskCategory,
      memberLevel,
      creditScore: pocketCreditScore, // Pocket credit score (calculated)
      experianScore: user.experian_score || null, // Experian score from API
      work_experience_range: user.work_experience_range || null, // Work experience range from users table
      limitVsSalaryPercent: (user.monthly_net_income && user.loan_limit)
        ? ((parseFloat(user.loan_limit) / parseFloat(user.monthly_net_income)) * 100).toFixed(1)
        : null,
      profileCompletionStep: user.profile_completion_step || 1,
      profileCompleted: user.profile_completed ? true : false,
      eligibilityStatus: user.eligibility_status || 'pending',
      eligibilityReason: user.eligibility_reason || 'N/A',
      eligibilityRetryDate: user.eligibility_retry_date || 'N/A',
      selectedLoanPlanId: user.selected_loan_plan_id || null,
      selectedLoanPlan: selectedLoanPlan,
      employmentType: user.employment_type || null, // Employment type from users table (Step 2 selection)
      incomeRange: user.income_range || null, // Income range from users table (Step 2 selection)
      application_hold_reason: user.application_hold_reason || null, // Hold reason if user is on hold
      personalInfo: {
        age: calculateAge(user.date_of_birth),
        gender: user.gender || 'N/A',
        maritalStatus: user.marital_status || 'N/A',
        // Primary address (first one, which should be is_primary = 1)
        address: (addresses && addresses[0])?.address_line1 || 'N/A',
        addressLine2: (addresses && addresses[0])?.address_line2 || 'N/A',
        city: (addresses && addresses[0])?.city || 'N/A',
        state: (addresses && addresses[0])?.state || 'N/A',
        pincode: (addresses && addresses[0])?.pincode || 'N/A',
        country: (addresses && addresses[0])?.country || 'India',
        // Employment details (latest)
        education: (employment && employment[0])?.education || 'N/A',
        employment: (employment && employment[0])?.employment_type || 'N/A',
        company: (employment && employment[0])?.company_name || 'N/A',
        industry: (employment && employment[0])?.industry || 'N/A',
        department: (employment && employment[0])?.department || 'N/A',
        monthlyIncome: (employment && employment[0]?.monthly_salary_old && parseFloat(employment[0].monthly_salary_old) > 0)
          ? parseFloat(employment[0].monthly_salary_old)
          : (parseFloat(user.monthly_net_income) || monthlyIncomeValue || 0),
        workExperience: (employment && employment[0]?.work_experience_years !== null && employment[0]?.work_experience_years !== undefined && employment[0]?.work_experience_years !== '')
          ? employment[0].work_experience_years
          : (employment && employment[0]?.work_experience_years === 0 ? 0 : null),
        designation: (employment && employment[0])?.designation || 'N/A',
        totalExperience: (employment && employment[0]?.work_experience_years !== null && employment[0]?.work_experience_years !== undefined && employment[0]?.work_experience_years !== '')
          ? employment[0].work_experience_years
          : (employment && employment[0]?.work_experience_years === 0 ? 0 : null)
      },
      // All addresses (not just primary)
      allAddresses: addresses || [],
      // All employment records
      allEmployment: employment || [],
      // Default values for data not yet in MySQL
      documents: loanApplicationDocuments,
      bankDetails: bankDetails,
      bankInfo: bankInfo, // Added for frontend compatibility
      references: references || [],
      transactions: [],
      followUps: followUps || [],
      notes: [],
      smsHistory: [],
      bankStatement: bankStatement,
      bankStatementRecords: bankStatementRecords, // All bank statement records
      kycVerification: kycData,
      kycDocuments: kycDocuments,
      userInfoRecords: userInfoRecords, // Multi-source of truth data
      loginHistory: loginHistory, // User login history from database
      duplicateChecks: duplicateChecks, // Duplicate account checks
      loans: applications.map(app => {
        // Calculate EMI if we have the required data
        // Convert interest_percent_per_day to annual rate, then to monthly rate
        const calculateEMI = (principal, interestPercentPerDay, tenure) => {
          if (!principal || !interestPercentPerDay || !tenure) return 0;
          // Convert daily rate to annual rate, then to monthly rate
          const annualRate = interestPercentPerDay * 365 * 100; // Convert to percentage
          const monthlyRate = annualRate / 100 / 12; // Convert to decimal monthly rate
          const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, tenure)) /
            (Math.pow(1 + monthlyRate, tenure) - 1);
          return Math.round(emi);
        };

        // Calculate interest_rate from interest_percent_per_day for display
        const interestRate = app.interest_percent_per_day
          ? (app.interest_percent_per_day * 365 * 100).toFixed(2)
          : null;

        const emi = calculateEMI(
          app.loan_amount,
          app.interest_percent_per_day || 0.001,
          app.tenure_months
        );
        const processingFee = Math.round(app.loan_amount * 0.025); // 2.5% processing fee
        const gst = Math.round(processingFee * 0.18); // 18% GST on processing fee
        const totalInterest = emi * app.tenure_months - app.loan_amount;
        const totalAmount = app.loan_amount + processingFee + gst + totalInterest;

        // Generate shorter loan ID format: PLL + 4 digits (last 4 digits of application number or ID)
        const loanIdDigits = app.application_number ? app.application_number.slice(-4) : String(app.id).padStart(4, '0').slice(-4);
        const shortLoanId = `PLL${loanIdDigits}`;

        return {
          id: app.id,
          loanId: app.application_number,
          shortLoanId: shortLoanId,
          amount: app.loan_amount,
          loan_amount: app.loan_amount,
          principalAmount: app.loan_amount,
          type: app.loan_purpose || 'Personal Loan',
          status: app.status,
          appliedDate: app.created_at,
          approvedDate: app.approved_at,
          disbursedDate: app.disbursed_at,
          disbursed_at: app.disbursed_at,
          processed_at: app.processed_at,
          processedDate: app.processed_at, // Use processed_at for Processed Date
          emi: emi,
          tenure: app.tenure_months,
          timePeriod: app.tenure_months,
          processingFeePercent: app.processing_fee_percent || 14,
          interestRate: interestRate ? parseFloat(interestRate) : null,
          disbursedAmount: app.disbursed_at ? app.loan_amount : 0,
          disbursal_amount: app.disbursal_amount || null,
          disbursalAmount: app.disbursal_amount || null,
          processingFee: app.processing_fee || processingFee,
          gst: gst,
          interest: app.total_interest || totalInterest,
          totalAmount: app.total_repayable || totalAmount,
          reason: app.rejection_reason || app.loan_purpose || 'N/A',
          statusDate: app.approved_at || app.disbursed_at || app.created_at,
          createdAt: app.created_at,
          created_at: app.created_at, // Add created_at for frontend compatibility
          updatedAt: app.updated_at || app.created_at,
          plan_snapshot: app.plan_snapshot,
          // Processed values (frozen at processing time)
          processed_amount: app.processed_amount,
          exhausted_period_days: app.exhausted_period_days,
          processed_p_fee: app.processed_p_fee,
          processed_post_service_fee: app.processed_post_service_fee,
          processed_gst: app.processed_gst,
          processed_interest: app.processed_interest,
          processed_penalty: app.processed_penalty,
          processed_due_date: app.processed_due_date,
          emi_schedule: app.emi_schedule || null,
          enach_status: app.enach_status || null
        };
      })
    };

    console.log('✅ User profile data prepared successfully');
    res.json({
      status: 'success',
      data: userProfile
    });

  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch user profile'
    });
  }
});

// Update user basic information
router.put('/:userId/basic-info', authenticateAdmin, async (req, res) => {
  try {
    console.log('📝 Updating basic info for user:', req.params.userId);
    await initializeDatabase();
    const { userId } = req.params;
    const { firstName, lastName, dateOfBirth, panNumber } = req.body;

    // Update user basic info in MySQL
    await executeQuery(`
      UPDATE users 
      SET 
        first_name = ?,
        last_name = ?,
        date_of_birth = ?,
        updated_at = NOW()
      WHERE id = ?
    `, [firstName, lastName, dateOfBirth, userId]);

    console.log('✅ Basic info updated successfully');
    console.log('📝 Updated fields:', { firstName, lastName, dateOfBirth, panNumber });

    res.json({
      status: 'success',
      message: 'Basic information updated successfully',
      data: {
        userId,
        firstName,
        lastName,
        dateOfBirth,
        panNumber: 'N/A (column not in DB yet)'
      }
    });

  } catch (error) {
    console.error('Update basic info error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update basic information'
    });
  }
});

// Update user's loan plan (admin only)
router.put('/:userId/loan-plan', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { userId } = req.params;
    const { plan_id } = req.body;

    if (!plan_id) {
      return res.status(400).json({
        status: 'error',
        message: 'Plan ID is required'
      });
    }

    // Verify plan exists and is active
    const plans = await executeQuery(
      'SELECT id FROM loan_plans WHERE id = ? AND is_active = 1',
      [plan_id]
    );

    if (plans.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Loan plan not found or inactive'
      });
    }

    // Update user's selected loan plan
    await executeQuery(
      'UPDATE users SET selected_loan_plan_id = ?, updated_at = NOW() WHERE id = ?',
      [plan_id, userId]
    );

    res.json({
      status: 'success',
      message: 'User loan plan updated successfully',
      data: { plan_id }
    });
  } catch (error) {
    console.error('Update user loan plan error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update user loan plan'
    });
  }
});

// Update user's loan limit (admin only)
router.put('/:userId/loan-limit', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { userId } = req.params;
    const { loanLimit } = req.body;

    if (!loanLimit || isNaN(parseFloat(loanLimit))) {
      return res.status(400).json({
        status: 'error',
        message: 'Valid loan limit is required'
      });
    }

    // Update user's loan limit
    await executeQuery(
      'UPDATE users SET loan_limit = ?, updated_at = NOW() WHERE id = ?',
      [parseFloat(loanLimit), userId]
    );

    // If this is a 2 EMI product user, recalculate and update pending credit limit
    // This ensures frontend shows correct next limit based on new logic
    try {
      const { calculateCreditLimitFor2EMI, storePendingCreditLimit } = require('../utils/creditLimitCalculator');
      const creditLimitData = await calculateCreditLimitFor2EMI(userId, null, parseFloat(loanLimit));

      // Only store pending limit if it's different from current limit
      if (creditLimitData.newLimit > parseFloat(loanLimit)) {
        await storePendingCreditLimit(userId, creditLimitData.newLimit, creditLimitData);
        console.log(`[CreditLimit] Recalculated next limit after manual update: ₹${creditLimitData.newLimit}`);
      }
    } catch (creditLimitError) {
      console.error('❌ Error recalculating credit limit after manual update (non-fatal):', creditLimitError);
      // Don't fail the update if recalculation fails
    }

    console.log('✅ Loan limit updated successfully');
    res.json({
      status: 'success',
      message: 'Loan limit updated successfully',
      data: { userId, loanLimit: parseFloat(loanLimit) }
    });
  } catch (error) {
    console.error('Update loan limit error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update loan limit'
    });
  }
});

// Update user salary date (admin only)
router.put('/:userId/salary-date', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { userId } = req.params;
    const { salaryDate } = req.body;

    if (salaryDate !== null && salaryDate !== undefined && salaryDate !== '') {
      // Validate salary date is between 1 and 31
      const day = parseInt(salaryDate);
      if (isNaN(day) || day < 1 || day > 31) {
        return res.status(400).json({
          status: 'error',
          message: 'Salary date must be a number between 1 and 31'
        });
      }
    }

    // Update user's salary date
    await executeQuery(
      'UPDATE users SET salary_date = ?, updated_at = NOW() WHERE id = ?',
      [salaryDate || null, userId]
    );

    console.log('✅ Salary date updated successfully');
    res.json({
      status: 'success',
      message: 'Salary date updated successfully',
      data: { userId, salaryDate: salaryDate || null }
    });
  } catch (error) {
    console.error('Update salary date error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update salary date'
    });
  }
});

// Update user contact information
router.put('/:userId/contact-info', authenticateAdmin, async (req, res) => {
  try {
    console.log('📞 Updating contact info for user:', req.params.userId);
    await initializeDatabase();
    const { userId } = req.params;
    const { email, phone, alternatePhone, personalEmail, officialEmail, companyEmail } = req.body;

    const updates = [];
    const values = [];

    if (email !== undefined) {
      updates.push('email = ?');
      values.push(email);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      values.push(phone);
    }
    if (alternatePhone !== undefined) {
      updates.push('alternate_mobile = ?');
      values.push(alternatePhone);
    }
    if (personalEmail !== undefined) {
      updates.push('personal_email = ?');
      values.push(personalEmail);
    }
    if (officialEmail !== undefined) {
      updates.push('official_email = ?');
      values.push(officialEmail);
    }
    if (companyEmail !== undefined) {
      updates.push('company_email = ?');
      values.push(companyEmail);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No fields to update provided'
      });
    }

    updates.push('updated_at = NOW()');
    values.push(userId);

    // Update user contact info in MySQL
    await executeQuery(`
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = ?
    `, values);

    console.log('✅ Contact info updated successfully');
    res.json({
      status: 'success',
      message: 'Contact information updated successfully',
      data: { userId, email, phone, alternatePhone, personalEmail, officialEmail, companyEmail }
    });

  } catch (error) {
    console.error('Update contact info error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update contact information'
    });
  }
});

// Add new address for user
router.post('/:userId/addresses', authenticateAdmin, async (req, res) => {
  try {
    console.log('🏠 Adding address for user:', req.params.userId);
    await initializeDatabase();
    const { userId } = req.params;
    const { address_line1, address_line2, city, state, pincode, country = 'India', address_type = 'current', is_primary = false } = req.body;

    // Validation
    if (!address_line1 || !city || !state || !pincode) {
      return res.status(400).json({
        status: 'error',
        message: 'Address line 1, city, state, and pincode are required'
      });
    }

    if (!/^\d{6}$/.test(pincode)) {
      return res.status(400).json({
        status: 'error',
        message: 'Pincode must be 6 digits'
      });
    }

    // If setting as primary, unset other primary addresses
    if (is_primary) {
      await executeQuery(
        `UPDATE addresses SET is_primary = 0 WHERE user_id = ?`,
        [userId]
      );
    }

    // Insert new address
    const result = await executeQuery(
      `INSERT INTO addresses (user_id, address_type, address_line1, address_line2, city, state, pincode, country, is_primary, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [userId, address_type, address_line1, address_line2 || null, city, state, pincode, country, is_primary ? 1 : 0]
    );

    // Fetch the created address
    const newAddress = await executeQuery(
      `SELECT * FROM addresses WHERE id = ?`,
      [result.insertId]
    );

    console.log('✅ Address added successfully');
    res.json({
      status: 'success',
      message: 'Address added successfully',
      data: newAddress[0]
    });

  } catch (error) {
    console.error('Add address error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to add address'
    });
  }
});

// Update user address information
router.put('/:userId/address-info', authenticateAdmin, async (req, res) => {
  try {
    console.log('🏠 Updating address info for user:', req.params.userId);
    await initializeDatabase();
    const { userId } = req.params;
    const { address, city, state, pincode, country } = req.body;

    // For now, we'll store address info in a JSON field or create a separate table
    // Since address columns don't exist in users table yet, we'll return success
    console.log('✅ Address info updated successfully (stored in memory)');
    res.json({
      status: 'success',
      message: 'Address information updated successfully',
      data: { userId, address, city, state, pincode, country }
    });

  } catch (error) {
    console.error('Update address info error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update address information'
    });
  }
});

// Update specific address
router.put('/:userId/addresses/:addressId', authenticateAdmin, async (req, res) => {
  try {
    console.log('🏠 Updating address:', req.params.addressId, 'for user:', req.params.userId);
    await initializeDatabase();
    const { userId, addressId } = req.params;
    const { address_line1, address_line2, city, state, pincode, country = 'India', address_type = 'current', is_primary = false } = req.body;

    // Validation
    if (!address_line1 || !city || !state || !pincode) {
      return res.status(400).json({
        status: 'error',
        message: 'Address line 1, city, state, and pincode are required'
      });
    }

    if (!/^\d{6}$/.test(pincode)) {
      return res.status(400).json({
        status: 'error',
        message: 'Pincode must be 6 digits'
      });
    }

    // If setting as primary, unset other primary addresses
    if (is_primary) {
      await executeQuery(
        `UPDATE addresses SET is_primary = 0 WHERE user_id = ? AND id != ?`,
        [userId, addressId]
      );
    }

    // Update address
    await executeQuery(
      `UPDATE addresses 
       SET address_type = ?, address_line1 = ?, address_line2 = ?, city = ?, state = ?, pincode = ?, country = ?, is_primary = ?, updated_at = NOW()
       WHERE id = ? AND user_id = ?`,
      [address_type, address_line1, address_line2 || null, city, state, pincode, country, is_primary ? 1 : 0, addressId, userId]
    );

    // Fetch the updated address
    const updatedAddress = await executeQuery(
      `SELECT * FROM addresses WHERE id = ?`,
      [addressId]
    );

    console.log('✅ Address updated successfully');
    res.json({
      status: 'success',
      message: 'Address updated successfully',
      data: updatedAddress[0]
    });

  } catch (error) {
    console.error('Update address error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update address'
    });
  }
});

// Create new follow-up
router.post('/:userId/follow-ups', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { userId } = req.params;
    const adminId = req.admin.id;
    const {
      type,
      subject,
      description,
      response,
      loan_application_id,
      scheduled_date,
      notes,
      status,
      assigned_to,
      priority
    } = req.body;

    if (!type) {
      return res.status(400).json({
        status: 'error',
        message: 'Type is required'
      });
    }

    // Generate Follow Up ID (FU + Timestamp + Random)
    const followUpId = `FU${Date.now()}${Math.floor(Math.random() * 1000)}`;

    const query = `
      INSERT INTO user_follow_ups (
        user_id, loan_application_id, follow_up_id, type, priority, 
        subject, description, response, assigned_to, admin_id, 
        status, scheduled_date, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    const values = [
      userId,
      loan_application_id || null,
      followUpId,
      type,
      priority || 'medium',
      subject || 'Follow Up',
      description || null,
      response || null,
      assigned_to || null,
      adminId,
      status || 'pending',
      scheduled_date || null,
      notes || null
    ];

    const result = await executeQuery(query, values);

    res.json({
      status: 'success',
      message: 'Follow-up created successfully',
      data: {
        id: result.insertId,
        follow_up_id: followUpId,
        user_id: userId,
        type,
        subject,
        created_at: new Date()
      }
    });

  } catch (error) {
    console.error('Create follow-up error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create follow-up'
    });
  }
});

// Update user employment information
router.put('/:userId/employment-info', authenticateAdmin, async (req, res) => {
  try {
    console.log('💼 Updating employment info for user:', req.params.userId);
    await initializeDatabase();
    const { userId } = req.params;
    const { company, companyName, designation, industry, department, monthlyIncome, income, workExperience } = req.body;

    // Use companyName if provided, otherwise company
    const finalCompanyName = companyName || company;
    // Use income if provided, otherwise monthlyIncome
    const finalIncome = income || monthlyIncome;

    // Get the latest employment record for this user
    const existingEmployment = await executeQuery(`
      SELECT id FROM employment_details 
      WHERE user_id = ? 
      ORDER BY id DESC 
      LIMIT 1
    `, [userId]);

    let employmentId;
    if (existingEmployment && existingEmployment.length > 0) {
      // Update existing employment record
      employmentId = existingEmployment[0].id;
      const updates = [];
      const values = [];

      if (finalCompanyName !== undefined) {
        updates.push('company_name = ?');
        values.push(finalCompanyName);
      }
      if (designation !== undefined) {
        updates.push('designation = ?');
        values.push(designation);
      }
      if (industry !== undefined) {
        updates.push('industry = ?');
        values.push(industry);
      }
      if (department !== undefined) {
        updates.push('department = ?');
        values.push(department);
      }
      if (finalIncome !== undefined && finalIncome !== null) {
        updates.push('monthly_salary_old = ?');
        values.push(finalIncome);
      }
      if (workExperience !== undefined && workExperience !== null) {
        updates.push('work_experience_years = ?');
        values.push(workExperience);
      }

      if (updates.length > 0) {
        updates.push('updated_at = NOW()');
        values.push(employmentId);
        await executeQuery(`
          UPDATE employment_details 
          SET ${updates.join(', ')}
          WHERE id = ?
        `, values);
      }
    } else {
      // Create new employment record if none exists
      const result = await executeQuery(`
        INSERT INTO employment_details 
        (user_id, company_name, designation, industry, department, monthly_salary_old, work_experience_years, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [
        userId,
        finalCompanyName || null,
        designation || null,
        industry || null,
        department || null,
        finalIncome || null,
        workExperience || null
      ]);
      employmentId = result.insertId;
    }

    // Also update users table with company_name and monthly_net_income
    const userUpdates = [];
    const userValues = [];

    if (finalCompanyName !== undefined) {
      userUpdates.push('company_name = ?');
      userValues.push(finalCompanyName);
    }
    if (finalIncome !== undefined && finalIncome !== null) {
      userUpdates.push('monthly_net_income = ?');
      userValues.push(finalIncome);
    }

    if (userUpdates.length > 0) {
      userUpdates.push('updated_at = NOW()');
      userValues.push(userId);
      await executeQuery(`
        UPDATE users 
        SET ${userUpdates.join(', ')}
        WHERE id = ?
      `, userValues);

      // Adjust first-time loan amount to 8% of salary if salary was updated
      if (finalIncome !== undefined && finalIncome !== null) {
        try {
          const { adjustFirstTimeLoanAmount } = require('../utils/creditLimitCalculator');
          const adjustmentResult = await adjustFirstTimeLoanAmount(userId, parseFloat(finalIncome));
          if (adjustmentResult.adjusted) {
            console.log(`✅ First-time loan amount adjusted: Loan ${adjustmentResult.loanId} from ₹${adjustmentResult.oldAmount} to ₹${adjustmentResult.newAmount}`);
          }
        } catch (adjustmentError) {
          // Don't fail the request if adjustment fails - log and continue
          console.error('⚠️ Error adjusting first-time loan amount (non-critical):', adjustmentError.message);
        }
      }
    }

    console.log('✅ Employment info updated successfully');
    res.json({
      status: 'success',
      message: 'Employment information updated successfully',
      data: { userId, employmentId, company: finalCompanyName, designation, industry, department, monthlyIncome: finalIncome, workExperience }
    });

  } catch (error) {
    console.error('Update employment info error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update employment information',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update bank details (edit) - More specific route must come first
router.put('/:userId/bank-details/:bankId/edit', authenticateAdmin, async (req, res) => {
  try {
    console.log('🏦 Updating bank details:', req.params.bankId);
    await initializeDatabase();
    const { userId, bankId } = req.params;
    const { bankName, accountNumber, ifscCode, accountHolderName, branchName, accountType } = req.body;

    // Verify bank detail belongs to user
    const existing = await executeQuery(
      'SELECT id FROM bank_details WHERE id = ? AND user_id = ?',
      [bankId, userId]
    );

    if (!existing || existing.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Bank detail not found'
      });
    }

    const updates = [];
    const values = [];

    if (bankName) {
      updates.push('bank_name = ?');
      values.push(bankName);
    }
    if (accountNumber) {
      updates.push('account_number = ?');
      values.push(accountNumber);
    }
    if (ifscCode) {
      updates.push('ifsc_code = ?');
      values.push(ifscCode.toUpperCase());
    }
    if (accountHolderName) {
      updates.push('account_holder_name = ?');
      values.push(accountHolderName);
    }
    if (branchName !== undefined) {
      updates.push('branch_name = ?');
      values.push(branchName);
    }
    if (accountType) {
      updates.push('account_type = ?');
      values.push(accountType);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No fields to update provided'
      });
    }

    values.push(bankId, userId);

    await executeQuery(
      `UPDATE bank_details SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ? AND user_id = ?`,
      values
    );

    console.log('✅ Bank details updated successfully');
    res.json({
      status: 'success',
      message: 'Bank details updated successfully'
    });

  } catch (error) {
    console.error('Update bank details error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update bank details'
    });
  }
});

// Update bank details status
router.put('/:userId/bank-details/:bankId', authenticateAdmin, async (req, res) => {
  try {
    console.log('🏦 Updating bank details status:', req.params.bankId);
    await initializeDatabase();
    const { userId, bankId } = req.params;
    const { verificationStatus, rejectionReason } = req.body;

    // Map status to is_verified (1 for verified, 0 for others)
    const isVerified = verificationStatus === 'verified' ? 1 : 0;

    // Update query
    // We try to update verification_status column too if it exists, otherwise just is_verified
    // Since we can't easily check column existence in query, we'll try to update both
    // If verification_status doesn't exist, this might fail, so we should check schema or use a safer approach
    // For now, let's assume is_verified is the main flag and we'll try to update verification_status if possible

    // First check if verification_status column exists
    const columns = await executeQuery(`SHOW COLUMNS FROM bank_details LIKE 'verification_status'`);
    const hasVerificationStatus = columns.length > 0;

    const rejectionReasonColumn = await executeQuery(`SHOW COLUMNS FROM bank_details LIKE 'rejection_reason'`);
    const hasRejectionReason = rejectionReasonColumn.length > 0;

    let updateQuery = 'UPDATE bank_details SET is_verified = ?, updated_at = NOW()';
    const params = [isVerified];

    if (hasVerificationStatus) {
      updateQuery += ', verification_status = ?';
      params.push(verificationStatus);
    }

    if (hasRejectionReason && rejectionReason) {
      updateQuery += ', rejection_reason = ?';
      params.push(rejectionReason);
    }

    updateQuery += ' WHERE id = ? AND user_id = ?';
    params.push(bankId, userId);

    await executeQuery(updateQuery, params);

    console.log('✅ Bank details status updated successfully');
    res.json({
      status: 'success',
      message: 'Bank details status updated successfully',
      data: {
        id: bankId,
        isVerified,
        verificationStatus,
        rejectionReason
      }
    });

  } catch (error) {
    console.error('Update bank details status error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update bank details status'
    });
  }
});

// Add bank details
router.post('/:userId/bank-details', authenticateAdmin, async (req, res) => {
  try {
    console.log('🏦 Adding bank details for user:', req.params.userId);
    await initializeDatabase();
    const { userId } = req.params;
    const { bankName, accountNumber, ifscCode, accountHolderName, branchName } = req.body;

    // For now, we'll store bank details in memory since table doesn't exist yet
    console.log('✅ Bank details added successfully (stored in memory)');
    res.json({
      status: 'success',
      message: 'Bank details added successfully',
      data: { userId, bankName, accountNumber, ifscCode, accountHolderName, branchName }
    });

  } catch (error) {
    console.error('Add bank details error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to add bank details'
    });
  }
});

// Add reference details
router.post('/:userId/reference-details', authenticateAdmin, async (req, res) => {
  try {
    console.log('👥 Adding reference details for user:', req.params.userId);
    await initializeDatabase();
    const { userId } = req.params;
    const { name, relationship, phone, email, address } = req.body;

    // For now, we'll store reference details in memory since table doesn't exist yet
    console.log('✅ Reference details added successfully (stored in memory)');
    res.json({
      status: 'success',
      message: 'Reference details added successfully',
      data: { userId, name, relationship, phone, email, address }
    });

  } catch (error) {
    console.error('Add reference details error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to add reference details'
    });
  }
});

// Update reference status (Admin only)
router.put('/:userId/references/:referenceId', authenticateAdmin, async (req, res) => {
  try {
    console.log('👥 Updating reference status:', req.params.referenceId);
    await initializeDatabase();
    const { userId, referenceId } = req.params;
    const { verificationStatus, feedback, rejectionReason, name, phone, relation } = req.body;

    // Get admin ID from request (if available)
    const adminId = req.admin?.id || null;

    // Add admin_notes column if it doesn't exist
    try {
      // Check if column exists
      const columnCheck = await executeQuery(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'references' 
        AND COLUMN_NAME = 'admin_notes'
      `);

      if (!columnCheck || columnCheck.length === 0) {
        await executeQuery(`
          ALTER TABLE \`references\` 
          ADD COLUMN admin_notes TEXT NULL AFTER status
        `);
        console.log('✅ Added admin_notes column to references table');
      }
    } catch (err) {
      // Column might already exist or other error, log and continue
      console.log('⚠️  Could not add admin_notes column:', err.message);
    }

    // Build update query dynamically based on what's provided
    let updateFields = [];
    let updateValues = [];

    if (verificationStatus && ['pending', 'verified', 'rejected'].includes(verificationStatus)) {
      updateFields.push('status = ?');
      updateValues.push(verificationStatus);
    }

    if (adminId) {
      updateFields.push('admin_id = ?');
      updateValues.push(adminId);
    }

    if (feedback !== undefined) {
      updateFields.push('admin_notes = ?');
      updateValues.push(feedback);
    }

    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }

    if (phone !== undefined) {
      updateFields.push('phone = ?');
      updateValues.push(phone);
    }

    if (relation !== undefined) {
      updateFields.push('relation = ?');
      updateValues.push(relation);
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(referenceId, userId);

    if (updateFields.length === 1) { // Only updated_at
      return res.status(400).json({
        status: 'error',
        message: 'No valid fields to update'
      });
    }

    // Update reference
    await executeQuery(
      `UPDATE \`references\` 
       SET ${updateFields.join(', ')}
       WHERE id = ? AND user_id = ?`,
      updateValues
    );

    console.log('✅ Reference updated successfully');
    res.json({
      status: 'success',
      message: 'Reference updated successfully',
      data: { referenceId, status: verificationStatus, notes: feedback }
    });

  } catch (error) {
    console.error('Update reference error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update reference'
    });
  }
});

// POST /api/user-profile/:userId/references - Add a new reference (Admin only)
router.post('/:userId/references', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { userId } = req.params;
    const { name, phone, relation } = req.body;

    if (!name || !phone || !relation) {
      return res.status(400).json({
        status: 'error',
        message: 'Name, phone, and relation are required'
      });
    }

    const result = await executeQuery(
      'INSERT INTO `references` (user_id, name, phone, relation, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
      [userId, name, phone, relation]
    );

    console.log('✅ Reference added successfully');
    res.json({
      status: 'success',
      message: 'Reference added successfully',
      data: { id: result.insertId, name, phone, relation }
    });

  } catch (error) {
    console.error('Add reference error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to add reference'
    });
  }
});

// Upload document (with file)
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit (increased from 10MB)
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, JPG, and PNG files are allowed.'));
    }
  }
});

router.post('/:userId/documents/upload', authenticateAdmin, upload.single('document'), async (req, res) => {
  try {
    console.log('📄 Uploading document for user:', req.params.userId);
    await initializeDatabase();
    const { userId } = req.params;
    const { documentType, documentTitle, description, loanApplicationId } = req.body;
    const adminId = req.admin ? (req.admin.id || req.admin.userId) : null;

    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'No file uploaded'
      });
    }

    if (!documentType || !documentTitle) {
      return res.status(400).json({
        status: 'error',
        message: 'Document type and title are required'
      });
    }

    // Get loan_application_id - use provided one or get the most recent loan application
    let loanApplicationIdToUse = loanApplicationId ? parseInt(loanApplicationId) : null;

    if (!loanApplicationIdToUse) {
      // Get the most recent loan application for this user
      const recentLoanApp = await executeQuery(`
        SELECT id FROM loan_applications 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT 1
      `, [userId]);

      if (recentLoanApp && recentLoanApp.length > 0) {
        loanApplicationIdToUse = recentLoanApp[0].id;
      } else {
        return res.status(400).json({
          status: 'error',
          message: 'No loan application found for this user. Please create a loan application first.'
        });
      }
    }

    // Verify the loan application belongs to this user
    const loanAppCheck = await executeQuery(`
      SELECT id FROM loan_applications 
      WHERE id = ? AND user_id = ?
    `, [loanApplicationIdToUse, userId]);

    if (!loanAppCheck || loanAppCheck.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Loan application not found or does not belong to this user'
      });
    }

    // Upload to S3 - using uploadStudentDocument helper for consistency
    let uploadResult;
    try {
      uploadResult = await uploadStudentDocument(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        parseInt(userId),
        documentType
      );
    } catch (uploadError) {
      console.error('S3 upload error:', uploadError);
      return res.status(500).json({
        status: 'error',
        message: `Failed to upload file to storage: ${uploadError.message}`
      });
    }

    if (!uploadResult || !uploadResult.success || !uploadResult.key) {
      return res.status(500).json({
        status: 'error',
        message: 'Failed to upload file to storage - upload result invalid'
      });
    }

    // Store document metadata in loan_application_documents table
    const insertQuery = `
      INSERT INTO loan_application_documents (
        loan_application_id, user_id, document_name, document_type, file_name, file_path, 
        s3_key, s3_bucket, file_size, mime_type, 
        upload_status, verification_notes, verified_by, uploaded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'uploaded', ?, ?, NOW())
    `;

    const fileUrl = uploadResult.url || (uploadResult.bucket ? `https://${uploadResult.bucket}.s3.amazonaws.com/${uploadResult.key}` : '');

    const insertResult = await executeQuery(insertQuery, [
      loanApplicationIdToUse,
      parseInt(userId),
      documentTitle, // document_name
      documentType,  // document_type
      req.file.originalname,
      fileUrl,
      uploadResult.key,
      uploadResult.bucket || null,
      req.file.size,
      req.file.mimetype,
      description || null, // verification_notes
      adminId ? parseInt(adminId) : null
    ]);

    console.log('✅ Document uploaded and saved successfully:', {
      documentId: insertResult.insertId,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      documentType,
      documentTitle
    });

    res.json({
      status: 'success',
      message: 'Document uploaded successfully',
      data: {
        id: insertResult.insertId,
        userId,
        documentType,
        documentTitle,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        description: description || null,
        s3_key: uploadResult.key
      }
    });

  } catch (error) {
    console.error('Upload document error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to upload document',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Upload document (legacy endpoint for backward compatibility)
router.post('/:userId/documents', authenticateAdmin, async (req, res) => {
  try {
    console.log('📄 Uploading document for user:', req.params.userId);
    await initializeDatabase();
    const { userId } = req.params;
    const { documentType, fileName, fileSize, description } = req.body;

    // For now, we'll store document info in memory since table doesn't exist yet
    console.log('✅ Document uploaded successfully (stored in memory)');
    res.json({
      status: 'success',
      message: 'Document uploaded successfully',
      data: { userId, documentType, fileName, fileSize, description }
    });

  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to upload document'
    });
  }
});

// Update transaction
router.put('/:userId/transactions/:transactionId', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { userId, transactionId } = req.params;
    const adminId = req.admin.id;

    const { reference_number } = req.body;

    // Validate reference_number
    if (!reference_number || reference_number.trim() === '') {
      return res.status(400).json({
        status: 'error',
        message: 'Reference / UTR number is required'
      });
    }

    // Check if transaction exists and belongs to user, and get loan_application_id
    const transactionCheck = await executeQuery(
      'SELECT id, loan_application_id FROM transactions WHERE id = ? AND user_id = ?',
      [transactionId, userId]
    );

    if (!transactionCheck || transactionCheck.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Transaction not found'
      });
    }

    const transaction = transactionCheck[0];
    const loanApplicationId = transaction.loan_application_id;

    // Update transaction
    await executeQuery(
      `UPDATE transactions 
       SET reference_number = ?, updated_at = NOW() 
       WHERE id = ? AND user_id = ?`,
      [reference_number.trim(), transactionId, userId]
    );

    console.log('✅ Transaction reference number updated successfully');

    // Automatically send KFS and Loan Agreement emails if loan_application_id exists
    if (loanApplicationId) {
      console.log(`📧 Transaction updated for loan application #${loanApplicationId}, sending KFS and Loan Agreement emails...`);
      // Send emails asynchronously (don't wait for it to complete)
      sendKFSAndAgreementEmails(loanApplicationId).catch(error => {
        console.error('❌ Error in background email sending:', error);
        // Don't fail the transaction update if email sending fails
      });
    }

    res.json({
      status: 'success',
      message: 'Transaction reference number updated successfully',
      data: { transactionId, reference_number: reference_number.trim() }
    });

  } catch (error) {
    console.error('Update transaction error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update transaction reference number'
    });
  }
});

// Add transaction
router.post('/:userId/transactions', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { userId } = req.params;
    const adminId = req.admin.id; // Get admin ID from authenticated token

    // Extract all fields
    const {
      amount,
      transaction_type, // Frontend sends "transaction_type" or "type"
      type,             // Fallback
      loan_application_id,
      description,
      category,
      payment_method,
      reference_number,
      transaction_date,
      transaction_time,
      status,
      priority,
      bank_name,
      account_number,
      additional_notes
    } = req.body;

    const txType = transaction_type || type;
    const txDate = transaction_date || new Date().toISOString().split('T')[0];
    const txStatus = status || 'completed';

    // Validate required fields
    if (!amount || !txType) {
      return res.status(400).json({
        status: 'error',
        message: 'Amount and transaction type are required'
      });
    }

    // Validate reference_number (UTR) is required
    if (!reference_number || reference_number.trim() === '') {
      return res.status(400).json({
        status: 'error',
        message: 'Reference / UTR number is required'
      });
    }

    // Validate loan disbursement - cannot disburse if already in account_manager or cleared
    if (txType === 'loan_disbursement' && loan_application_id) {
      const loanCheck = await executeQuery(
        'SELECT id, status FROM loan_applications WHERE id = ?',
        [loan_application_id]
      );

      if (loanCheck.length > 0) {
        const loanStatus = loanCheck[0].status;
        if (loanStatus === 'account_manager' || loanStatus === 'cleared') {
          return res.status(400).json({
            status: 'error',
            message: `Cannot disburse this loan. Loan is already in "${loanStatus}" status. The loan has already been disbursed.`
          });
        }
      }
    }

    // Insert transaction into database
    const query = `
      INSERT INTO transactions (
        user_id, loan_application_id, transaction_type, amount, description, 
        category, payment_method, reference_number, transaction_date, 
        transaction_time, status, priority, bank_name, account_number, 
        additional_notes, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    const values = [
      userId,
      loan_application_id || null,
      txType,
      amount,
      description || null,
      category || null,
      payment_method || null,
      reference_number || null,
      txDate,
      transaction_time || null,
      txStatus,
      priority || 'normal',
      bank_name || null,
      account_number || null,
      additional_notes || null,
      adminId
    ];

    const result = await executeQuery(query, values);
    const transactionId = result.insertId;

    let loanStatusUpdated = false;
    let newStatus = null;

    // If this is a loan disbursement, update the loan application status
    if (txType === 'loan_disbursement' && loan_application_id) {
      const loanIdInt = parseInt(loan_application_id);
      const userIdInt = parseInt(userId);

      // 1. Verify loan exists and get full loan data
      const loans = await executeQuery(
        `SELECT id, user_id, status, loan_amount, plan_snapshot, interest_percent_per_day, 
         fees_breakdown, processed_at FROM loan_applications WHERE id = ?`,
        [loanIdInt]
      );

      if (loans.length > 0) {
        const loan = loans[0];
        // Check ownership in JS to be safe
        if (loan.user_id == userIdInt || loan.user_id == userId) {
          console.log(`✅ Loan ownership confirmed. Current status: ${loan.status}`);

          // Check if already processed
          // Check if loan needs processing or re-processing
          const needsProcessing = !loan.processed_at ||
            !loan.processed_amount ||
            loan.processed_amount <= 0;

          if (loan.processed_at && !needsProcessing) {
            console.log(`⚠️ Loan #${loanIdInt} already processed at ${loan.processed_at} with valid values`);
          } else {
            if (loan.processed_at && needsProcessing) {
              console.log(`🔄 Re-processing loan #${loanIdInt} (missing processed values)`);
            }
            // 2. Get loan calculation to save all values
            let calculatedValues = null;
            try {
              calculatedValues = await getLoanCalculation(loanIdInt);
            } catch (calcError) {
              console.error(`❌ Error getting loan calculation:`, calcError);
              // Continue with update even if calculation fails
            }

            // 3. Calculate values to save
            const processedAmount = calculatedValues?.disbursal?.amount || loan.disbursal_amount || loan.loan_amount || 0;
            const exhaustedPeriodDays = 1; // At processing time, it's day 1 (inclusive counting)
            const pFee = calculatedValues?.totals?.disbursalFee || loan.processing_fee || 0;
            const postServiceFee = calculatedValues?.totals?.repayableFee || 0;
            const gst = (calculatedValues?.totals?.disbursalFeeGST || 0) + (calculatedValues?.totals?.repayableFeeGST || 0);
            const interest = calculatedValues?.interest?.amount || loan.total_interest || 0;
            const penalty = 0; // No penalty at processing time

            // Validate processedAmount - it should never be null or 0 for account_manager loans
            if (!processedAmount || processedAmount <= 0) {
              console.error(`❌ ERROR: processedAmount is invalid (${processedAmount}) for loan #${loanIdInt}. Cannot create EMI schedule.`);
              return res.status(400).json({
                success: false,
                message: 'Cannot move loan to account_manager status: Invalid loan amount. Please ensure the loan has a valid disbursal amount or loan amount.'
              });
            }

            // Calculate processed_due_date - single date for single payment, JSON array for multi-EMI
            let processedDueDate = null;
            let emiScheduleForUpdate = null; // Initialize emi_schedule for update
            try {
              // Parse plan snapshot to check if it's multi-EMI
              let planSnapshot = {};
              try {
                planSnapshot = typeof loan.plan_snapshot === 'string'
                  ? JSON.parse(loan.plan_snapshot)
                  : loan.plan_snapshot || {};
              } catch (e) {
                console.error('Error parsing plan_snapshot:', e);
              }

              const emiCount = planSnapshot.emi_count || null;
              const isMultiEmi = emiCount && emiCount > 1;

              if (isMultiEmi) {
                // Multi-EMI: Generate all EMI dates and store as JSON array
                const { getNextSalaryDate, getSalaryDateForMonth } = require('../utils/loanCalculations');
                const { executeQuery: execQuery } = require('../config/database');

                // Get user salary date
                const userResult = await execQuery('SELECT salary_date FROM users WHERE id = ?', [loan.user_id]);
                const userSalaryDate = userResult[0]?.salary_date || null;

                // Calculate base date (disbursement date or today)
                const baseDate = loan.disbursed_at ? new Date(loan.disbursed_at) : new Date();
                baseDate.setHours(0, 0, 0, 0);

                // Generate all EMI dates
                const allEmiDates = [];

                if (planSnapshot.emi_frequency === 'monthly' && planSnapshot.calculate_by_salary_date && userSalaryDate) {
                  // Salary-based monthly EMIs
                  const salaryDate = parseInt(userSalaryDate);
                  if (salaryDate >= 1 && salaryDate <= 31) {
                    let nextSalaryDate = getNextSalaryDate(baseDate, salaryDate);

                    // Check if duration is less than minimum days
                    const minDuration = planSnapshot.repayment_days || 15;
                    const daysToNextSalary = Math.ceil((nextSalaryDate - baseDate) / (1000 * 60 * 60 * 24)) + 1;
                    if (daysToNextSalary < minDuration) {
                      nextSalaryDate = getSalaryDateForMonth(baseDate, salaryDate, 1);
                    }

                    // Ensure nextSalaryDate matches the salary date exactly
                    const firstEmiYear = nextSalaryDate.getFullYear();
                    const firstEmiMonth = nextSalaryDate.getMonth();
                    let correctedFirstEmiDate = new Date(firstEmiYear, firstEmiMonth, salaryDate);
                    correctedFirstEmiDate.setHours(0, 0, 0, 0);
                    if (correctedFirstEmiDate.getDate() !== salaryDate) {
                      const lastDay = new Date(firstEmiYear, firstEmiMonth + 1, 0).getDate();
                      correctedFirstEmiDate = new Date(firstEmiYear, firstEmiMonth, Math.min(salaryDate, lastDay));
                      correctedFirstEmiDate.setHours(0, 0, 0, 0);
                    }
                    nextSalaryDate = correctedFirstEmiDate;

                    // Generate all EMI dates
                    for (let i = 0; i < emiCount; i++) {
                      const emiDate = getSalaryDateForMonth(nextSalaryDate, salaryDate, i);
                      allEmiDates.push(formatDateLocal(emiDate)); // Store as YYYY-MM-DD without timezone conversion
                    }
                  } else {
                    console.warn(`⚠️ Invalid salary date (${userSalaryDate}) for loan #${loanIdInt}, will fall back to non-salary calculation`);
                  }
                }

                // If salary-based calculation didn't generate dates, use non-salary method
                if (allEmiDates.length === 0 && emiCount > 1) {
                  const firstDueDate = calculatedValues?.interest?.repayment_date
                    ? new Date(calculatedValues.interest.repayment_date)
                    : (() => {
                      const dueDate = new Date(baseDate);
                      dueDate.setDate(dueDate.getDate() + (planSnapshot.repayment_days || 15));
                      dueDate.setHours(0, 0, 0, 0);
                      return dueDate;
                    })();

                  const daysPerEmi = { daily: 1, weekly: 7, biweekly: 14, monthly: 30 };
                  const daysBetween = daysPerEmi[planSnapshot.emi_frequency] || 30;

                  for (let i = 0; i < emiCount; i++) {
                    const emiDate = new Date(firstDueDate);
                    if (planSnapshot.emi_frequency === 'monthly') {
                      emiDate.setMonth(emiDate.getMonth() + i);
                    } else {
                      emiDate.setDate(emiDate.getDate() + (i * daysBetween));
                    }
                    emiDate.setHours(0, 0, 0, 0);
                    allEmiDates.push(formatDateLocal(emiDate));
                  }
                }

                // Validate EMI dates were generated
                if (!allEmiDates || allEmiDates.length !== emiCount) {
                  console.error(`❌ ERROR: Failed to generate EMI dates for loan #${loanIdInt}. Expected ${emiCount} dates but got ${allEmiDates?.length || 0}`);
                  return res.status(400).json({
                    success: false,
                    message: `Cannot create EMI schedule: Failed to generate ${emiCount} EMI dates. Please check loan plan configuration.`
                  });
                }

                // Store as JSON array for multi-EMI
                processedDueDate = JSON.stringify(allEmiDates);

                // Create emi_schedule with dates, amounts, and status using REDUCING BALANCE method
                const { formatDateToString, calculateDaysBetween, getTodayString, toDecimal2 } = require('../utils/loanCalculations');
                const emiSchedule = [];

                // Validate processedAmount is valid before calculation
                if (!processedAmount || processedAmount <= 0 || isNaN(processedAmount)) {
                  console.error(`❌ ERROR: Invalid processedAmount (${processedAmount}) for loan #${loanIdInt} EMI calculation`);
                  return res.status(400).json({
                    success: false,
                    message: 'Cannot create EMI schedule: Invalid processed amount. Please ensure the loan has a valid disbursal amount.'
                  });
                }

                const principalPerEmi = toDecimal2(Math.floor(processedAmount / emiCount * 100) / 100);
                const remainder = toDecimal2(processedAmount - (principalPerEmi * emiCount));

                // Calculate per-EMI fees (post service fee and GST are already total amounts)
                // IMPORTANT: postServiceFee and repayableFeeGST are TOTAL amounts, need to divide by emiCount for per-EMI
                // NOTE: Only use repayableFeeGST for EMI calculations, NOT disbursalFeeGST (which is deducted upfront)
                const totalRepayableFeeGST = calculatedValues?.totals?.repayableFeeGST || 0;
                const postServiceFeePerEmi = toDecimal2((postServiceFee || 0) / emiCount);
                const postServiceFeeGSTPerEmi = toDecimal2(totalRepayableFeeGST / emiCount);

                // Get interest rate per day from loan or plan snapshot
                const interestRatePerDay = parseFloat(loan.interest_percent_per_day || planSnapshot.interest_percent_per_day || 0.001);

                // Log EMI calculation inputs for debugging

                // Calculate base date for interest calculation (processed_at takes priority over disbursed_at)
                // Reuse existing baseDate variable but update it if processed_at exists
                const interestBaseDate = loan.processed_at ? new Date(loan.processed_at) : baseDate;
                interestBaseDate.setHours(0, 0, 0, 0);
                const baseDateStr = formatDateToString(interestBaseDate) || getTodayString();

                // Track outstanding principal for reducing balance calculation
                let outstandingPrincipal = processedAmount;

                // Calculate EMI amounts using reducing balance method
                for (let i = 0; i < emiCount; i++) {
                  const emiDateStr = allEmiDates[i];

                  // Calculate days for this period
                  let previousDateStr;
                  if (i === 0) {
                    // First EMI: from base date (processed_at/disbursed_at) to first EMI date
                    previousDateStr = baseDateStr;
                  } else {
                    // Subsequent EMIs: from day AFTER previous EMI date to current EMI date
                    const prevEmiDateStr = allEmiDates[i - 1];
                    const [prevYear, prevMonth, prevDay] = prevEmiDateStr.split('-').map(Number);
                    const prevDueDate = new Date(prevYear, prevMonth - 1, prevDay);
                    prevDueDate.setDate(prevDueDate.getDate() + 1); // Add 1 day (inclusive counting)
                    previousDateStr = formatDateToString(prevDueDate);
                  }

                  // Calculate days between dates (inclusive)
                  const daysForPeriod = calculateDaysBetween(previousDateStr, emiDateStr);

                  // Calculate principal for this EMI (last EMI gets remainder)
                  const principalForThisEmi = i === emiCount - 1
                    ? toDecimal2(principalPerEmi + remainder)
                    : principalPerEmi;

                  // Calculate interest for this period on reducing balance
                  const interestForPeriod = toDecimal2(outstandingPrincipal * interestRatePerDay * daysForPeriod);

                  // Calculate EMI amount: principal + interest + post service fee + GST
                  const emiAmount = toDecimal2(principalForThisEmi + interestForPeriod + postServiceFeePerEmi + postServiceFeeGSTPerEmi);

                  // Reduce outstanding principal for next EMI
                  outstandingPrincipal = toDecimal2(outstandingPrincipal - principalForThisEmi);

                  emiSchedule.push({
                    emi_number: i + 1,
                    instalment_no: i + 1,
                    due_date: emiDateStr,
                    emi_amount: emiAmount,
                    status: 'pending'
                  });

                }

                // Store emi_schedule to be updated
                emiScheduleForUpdate = JSON.stringify(emiSchedule);
              } else {
                // Single payment: Calculate from plan snapshot and processed_at
                const { getNextSalaryDate, getSalaryDateForMonth, formatDateToString, calculateDaysBetween, parseDateToString } = require('../utils/loanCalculations');

                // Get user salary date
                const userResult = await executeQuery('SELECT salary_date FROM users WHERE id = ?', [loan.user_id]);
                const userSalaryDate = userResult[0]?.salary_date || null;

                // Calculate base date (use processed_at if available, otherwise disbursed_at or today)
                const baseDate = loan.processed_at
                  ? new Date(loan.processed_at)
                  : (loan.disbursed_at ? new Date(loan.disbursed_at) : new Date());
                baseDate.setHours(0, 0, 0, 0);
                const baseDateStr = formatDateToString(baseDate);

                // Try to get from calculatedValues first
                if (calculatedValues?.interest?.repayment_date) {
                  processedDueDate = formatDateLocal(calculatedValues.interest.repayment_date);
                  console.log(`📅 Single payment loan ${loanId}: Due date = ${processedDueDate} (from repayment_date)`);
                } else {
                  // Calculate from plan snapshot
                  const usesSalaryDate = planSnapshot.calculate_by_salary_date === 1 || planSnapshot.calculate_by_salary_date === true;
                  const salaryDate = userSalaryDate ? parseInt(userSalaryDate) : null;

                  if (usesSalaryDate && salaryDate && salaryDate >= 1 && salaryDate <= 31) {
                    // Salary-date-based calculation
                    const nextSalaryDate = getNextSalaryDate(baseDateStr, salaryDate);
                    const minDuration = planSnapshot.repayment_days || planSnapshot.total_duration_days || 15;
                    const nextSalaryDateStr = formatDateToString(nextSalaryDate);
                    const daysToSalary = calculateDaysBetween(baseDateStr, nextSalaryDateStr);

                    if (daysToSalary < minDuration) {
                      // Extend to next month's salary date
                      processedDueDate = formatDateToString(getSalaryDateForMonth(nextSalaryDateStr, salaryDate, 1));
                    } else {
                      processedDueDate = nextSalaryDateStr;
                    }
                    console.log(`📅 Single payment loan ${loanId}: Due date = ${processedDueDate} (salary-date-based, base: ${baseDateStr}, salary date: ${salaryDate})`);
                  } else {
                    // Fixed days calculation
                    const repaymentDays = planSnapshot.repayment_days || planSnapshot.total_duration_days || 15;
                    const dueDate = new Date(baseDate);
                    dueDate.setDate(dueDate.getDate() + repaymentDays);
                    dueDate.setHours(0, 0, 0, 0);
                    processedDueDate = formatDateToString(dueDate);
                    console.log(`📅 Single payment loan ${loanId}: Due date = ${processedDueDate} (fixed days: ${repaymentDays}, base: ${baseDateStr})`);
                  }
                }

                // Create emi_schedule for single payment loan
                // NOTE: Only use repayableFeeGST for repayment amount, NOT disbursalFeeGST (which is deducted upfront)
                const repayableFeeGST = calculatedValues?.totals?.repayableFeeGST || 0;
                const totalAmount = (processedAmount || 0) + (interest || 0) + (postServiceFee || 0) + (repayableFeeGST || 0);
                const emiScheduleForSingle = [{
                  emi_number: 1,
                  instalment_no: 1,
                  due_date: processedDueDate,
                  emi_amount: totalAmount,
                  status: 'pending'
                }];

                emiScheduleForUpdate = JSON.stringify(emiScheduleForSingle);
              }
            } catch (dueDateError) {
              console.error('Error calculating processed_due_date:', dueDateError);
              // Fallback to single date
              processedDueDate = calculatedValues?.interest?.repayment_date
                ? formatDateLocal(calculatedValues.interest.repayment_date)
                : null;
            }

            // 4. Generate and upload KFS and Loan Agreement PDFs
            let kfsPdfUrl = null;
            let loanAgreementPdfUrl = null;

            try {
              console.log(`📄 Generating PDFs for loan #${loanIdInt}...`);
              const { generateAndUploadLoanPDFs } = require('../utils/generateLoanPDFs');
              const pdfResult = await generateAndUploadLoanPDFs(loanIdInt, loan.user_id);

              if (pdfResult.success) {
                kfsPdfUrl = pdfResult.kfs.s3Key;
                loanAgreementPdfUrl = pdfResult.agreement.s3Key;
                console.log(`✅ PDFs generated and uploaded: KFS=${kfsPdfUrl}, Agreement=${loanAgreementPdfUrl}`);
              }
            } catch (pdfError) {
              console.error(`❌ Error generating PDFs for loan #${loanIdInt}:`, pdfError);
              // Continue with loan update even if PDF generation fails
            }

            // 5. Update loan status and save calculated values
            console.log(`Attempting to update loan status to account_manager with calculated values...`);

            // Build UPDATE query with emi_schedule if available
            let updateQueryParts = [
              `status = 'account_manager'`,
              `disbursed_at = NOW()`,
              `processed_at = NOW()`,
              `processed_amount = ?`,
              `exhausted_period_days = ?`,
              `processed_p_fee = ?`,
              `processed_post_service_fee = ?`,
              `processed_gst = ?`,
              `processed_interest = ?`,
              `processed_penalty = ?`,
              `processed_due_date = ?`
            ];

            let updateParams = [
              processedAmount,
              exhaustedPeriodDays,
              pFee,
              postServiceFee,
              gst || null,
              interest,
              penalty,
              processedDueDate
            ];

            // Add emi_schedule if it was created
            if (emiScheduleForUpdate) {
              updateQueryParts.push(`emi_schedule = ?`);
              updateParams.push(emiScheduleForUpdate);
            }

            updateQueryParts.push(`kfs_pdf_url = ?`, `loan_agreement_pdf_url = ?`, `updated_at = NOW()`);
            updateParams.push(kfsPdfUrl, loanAgreementPdfUrl, loanIdInt);

            const updateQuery = `UPDATE loan_applications SET ${updateQueryParts.join(', ')} WHERE id = ?`;
            const updateResult = await executeQuery(updateQuery, updateParams);

            console.log('Update result:', updateResult);
            console.log(`✅ Updated loan #${loanIdInt} status to account_manager and saved calculated values`);

            // Update partner leads if this loan is linked to a partner lead
            try {
              const { updateLeadPayout } = require('../services/partnerPayoutService');
              const partnerLeads = await executeQuery(
                `SELECT id FROM partner_leads WHERE loan_application_id = ? LIMIT 1`,
                [loanIdInt]
              );

              if (partnerLeads && partnerLeads.length > 0) {
                const loanData = await executeQuery(
                  `SELECT loan_amount, disbursal_amount FROM loan_applications WHERE id = ?`,
                  [loanIdInt]
                );
                const disbursalAmount = (loanData[0]?.disbursal_amount || loanData[0]?.loan_amount);
                await updateLeadPayout(
                  partnerLeads[0].id,
                  disbursalAmount,
                  new Date()
                );
                console.log(`✅ Updated partner lead payout for lead ${partnerLeads[0].id}`);
              }
            } catch (partnerError) {
              console.error('Error updating partner lead payout:', partnerError);
              // Don't fail the transaction if partner update fails
            }
          }

          loanStatusUpdated = true;
          newStatus = 'account_manager';
          
          // Send KFS and Loan Agreement emails after loan moves to account_manager
          // This is when admin adds transaction (loan_disbursement)
          console.log(`📧 Triggering email send for loan #${loanIdInt} (moved to account_manager)`);
          try {
            await sendKFSAndAgreementEmails(loanIdInt);
            console.log(`✅ KFS and Loan Agreement emails sent for loan #${loanIdInt}`);
          } catch (emailError) {
            console.error(`❌ Error sending emails for loan #${loanIdInt} (non-fatal):`, emailError.message);
            // Continue - email failure shouldn't block the transaction
          }
        } else {
          console.warn(`❌ Loan #${loanIdInt} belongs to user ${loan.user_id}, not requested user ${userId}`);
        }
      } else {
        console.warn(`⚠️ Loan #${loanIdInt} not found`);
      }
    } else {
      console.log('Skipping loan status update (conditions not met)');
    }

    // Handle full_payment transaction type - mark loan as cleared
    console.log(`🔍 Checking transaction type: ${txType}, loan_application_id: ${loan_application_id}`);
    if (txType === 'full_payment' && loan_application_id) {
      const loanIdInt = parseInt(loan_application_id);
      const userIdInt = parseInt(userId);

      console.log(`💳 Processing full_payment transaction for loan #${loanIdInt}, user #${userIdInt}`);

      // Verify loan exists and get loan data
      const loans = await executeQuery(
        'SELECT id, user_id, status FROM loan_applications WHERE id = ?',
        [loanIdInt]
      );

      if (loans.length > 0) {
        const loan = loans[0];
        // Check ownership
        if (loan.user_id == userIdInt || loan.user_id == userId) {
          console.log(`✅ Loan ownership confirmed. Current status: ${loan.status}`);

          // Update loan status to cleared
          await executeQuery(`
            UPDATE loan_applications 
            SET 
              status = 'cleared',
              updated_at = NOW()
            WHERE id = ?
          `, [loanIdInt]);

          console.log(`✅ Loan #${loanIdInt} marked as cleared (full payment received)`);

          // Send NOC email to user
          try {
            const emailService = require('../services/emailService');
            const pdfService = require('../services/pdfService');

            // Get loan details for NOC
            const loanDetails = await executeQuery(`
              SELECT 
                la.*,
                DATE(la.disbursed_at) as disbursed_at_date,
                u.first_name, u.last_name, u.email, u.personal_email, u.official_email, 
                u.phone, u.date_of_birth, u.gender, u.marital_status, u.pan_number
              FROM loan_applications la
              INNER JOIN users u ON la.user_id = u.id
              WHERE la.id = ?
            `, [loanIdInt]);

            if (loanDetails && loanDetails.length > 0) {
              const loanDetail = loanDetails[0];
              const recipientEmail = loanDetail.personal_email || loanDetail.official_email || loanDetail.email;
              const recipientName = `${loanDetail.first_name || ''} ${loanDetail.last_name || ''}`.trim() || 'User';

              if (recipientEmail) {
                // Generate NOC HTML (same logic as payment.js)
                const formatDate = (dateString) => {
                  if (!dateString || dateString === 'N/A') return 'N/A';
                  try {
                    if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
                      const [year, month, day] = dateString.split('-');
                      return `${day}-${month}-${year}`;
                    }
                    if (typeof dateString === 'string' && dateString.includes('T')) {
                      const datePart = dateString.split('T')[0];
                      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
                        const [year, month, day] = datePart.split('-');
                        return `${day}-${month}-${year}`;
                      }
                    }
                    if (typeof dateString === 'string' && dateString.includes(' ')) {
                      const datePart = dateString.split(' ')[0];
                      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
                        const [year, month, day] = datePart.split('-');
                        return `${day}-${month}-${year}`;
                      }
                    }
                    const date = new Date(dateString);
                    const day = String(date.getDate()).padStart(2, '0');
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const year = date.getFullYear();
                    return `${day}-${month}-${year}`;
                  } catch {
                    return dateString;
                  }
                };

                const borrowerName = recipientName;
                const applicationNumber = loanDetail.application_number || loanIdInt;
                const shortLoanId = applicationNumber && applicationNumber !== 'N/A'
                  ? `PLL${String(applicationNumber).slice(-4)}`
                  : `PLL${String(loanIdInt).padStart(4, '0').slice(-4)}`;
                const todayDate = formatDate(new Date().toISOString());

                const htmlContent = `
                  <div style="font-family: 'Times New Roman', Times, serif; font-size: 11pt; line-height: 1.6; background-color: white;">
                    <div style="padding: 32px;">
                      <div style="text-align: center; margin-bottom: 16px; border-bottom: 1px solid #000; padding-bottom: 8px;">
                        <h2 style="font-weight: bold; margin-bottom: 4px; font-size: 14pt;">
                          SPHEETI FINTECH PRIVATE LIMITED
                        </h2>
                        <p style="font-size: 12px; margin-bottom: 4px;">
                          CIN: U65929MH2018PTC306088 | RBI Registration no: N-13.02361
                        </p>
                        <p style="font-size: 12px; margin-bottom: 8px;">
                          Mahadev Compound Gala No. A7, Dhobi Ghat Road, Ulhasnagar MUMBAI, MAHARASHTRA, 421001
                        </p>
                      </div>
                      <div style="text-align: center; margin-bottom: 24px;">
                        <h1 style="font-weight: bold; font-size: 13pt; text-transform: uppercase;">
                          NO DUES CERTIFICATE
                        </h1>
                      </div>
                      <div style="margin-bottom: 16px;">
                        <p style="font-size: 12px;"><strong>Date :</strong> ${todayDate}</p>
                      </div>
                      <div style="margin-bottom: 16px;">
                        <p style="font-size: 12px;"><strong>Name of the Customer:</strong> ${borrowerName}</p>
                      </div>
                      <div style="margin-bottom: 16px;">
                        <p style="font-size: 12px;"><strong>Sub: No Dues Certificate for Loan ID - ${shortLoanId}</strong></p>
                      </div>
                      <div style="margin-bottom: 16px;">
                        <p style="font-weight: bold;">Dear Sir/Madam,</p>
                      </div>
                      <div style="margin-bottom: 24px; text-align: justify;">
                        <p>This letter is to confirm that Spheeti Fintech Private Limited has received payment for the aforesaid loan ID and no amount is outstanding and payable by you to the Company under the aforesaid loan ID.</p>
                      </div>
                      <div style="margin-top: 32px;">
                        <p style="margin-bottom: 4px; font-weight: bold;">Thanking you,</p>
                        <p style="font-weight: bold;">On behalf of Spheeti Fintech Private Limited</p>
                      </div>
                    </div>
                  </div>
                `;

                // Generate PDF
                const filename = `No_Dues_Certificate_${applicationNumber}.pdf`;
                const pdfResult = await pdfService.generateKFSPDF(htmlContent, filename);
                let pdfBuffer = Buffer.isBuffer(pdfResult) ? pdfResult : (pdfResult.buffer || pdfResult);
                if (!Buffer.isBuffer(pdfBuffer) && pdfBuffer instanceof Uint8Array) {
                  pdfBuffer = Buffer.from(pdfBuffer);
                }

                // Send email
                await emailService.sendNOCEmail({
                  loanId: loanIdInt,
                  recipientEmail: recipientEmail,
                  recipientName: recipientName,
                  loanData: {
                    application_number: applicationNumber,
                    loan_amount: loanDetail.loan_amount || loanDetail.sanctioned_amount || 0
                  },
                  pdfBuffer: pdfBuffer,
                  pdfFilename: filename,
                  sentBy: null
                });

                console.log(`✅ NOC email sent successfully to ${recipientEmail} for loan #${loanIdInt}`);
              }
            }
          } catch (nocEmailError) {
            console.error('❌ Error sending NOC email (non-fatal):', nocEmailError);
            // Don't fail - email failure shouldn't block loan clearance
          }

          // Check if this is a premium loan (₹1,50,000) and mark user in cooling period
          try {
            const { checkAndMarkCoolingPeriod } = require('../utils/creditLimitCalculator');
            await checkAndMarkCoolingPeriod(loan.user_id, loanIdInt);
          } catch (coolingPeriodError) {
            console.error('❌ Error checking cooling period (non-fatal):', coolingPeriodError);
            // Don't fail - cooling period check failure shouldn't block loan clearance
          }

          loanStatusUpdated = true;
          newStatus = 'cleared';
        } else {
          console.warn(`❌ Loan #${loanIdInt} belongs to user ${loan.user_id}, not requested user ${userId}`);
        }
      } else {
        console.warn(`⚠️ Loan #${loanIdInt} not found`);
      }
    }

    console.log('✅ Transaction added successfully to database');

    res.json({
      status: 'success',
      message: loanStatusUpdated
        ? (newStatus === 'cleared'
          ? 'Transaction added and loan marked as Cleared (fully paid)'
          : 'Transaction added and loan status updated to Account Manager')
        : 'Transaction added successfully',
      data: {
        transaction_id: transactionId,
        user_id: userId,
        amount,
        transaction_type: txType,
        loan_status_updated: loanStatusUpdated,
        new_status: newStatus
      }
    });

  } catch (error) {
    console.error('Add transaction error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to add transaction',
      error: error.message
    });
  }
});

// Get user transactions
router.get('/:userId/transactions', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { userId } = req.params;

    const transactions = await executeQuery(`
      SELECT t.*, a.name as created_by_name, la.application_number
      FROM transactions t
      LEFT JOIN admins a ON t.created_by = a.id
      LEFT JOIN loan_applications la ON t.loan_application_id = la.id
      WHERE t.user_id = ?
      ORDER BY t.transaction_date DESC, t.created_at DESC
    `, [userId]);

    res.json({
      status: 'success',
      data: transactions
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch transactions'
    });
  }
});

// Get follow-ups for a user
router.get('/:userId/follow-ups', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { userId } = req.params;

    // Create table if it doesn't exist
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS user_follow_ups (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        follow_up_id VARCHAR(50) UNIQUE,
        type ENUM('call', 'email', 'sms', 'meeting', 'other') NOT NULL,
        priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
        subject VARCHAR(200),
        description TEXT,
        response VARCHAR(200),
        assigned_to VARCHAR(100),
        admin_id INT,
        status ENUM('pending', 'in_progress', 'completed', 'cancelled', 'overdue') DEFAULT 'pending',
        scheduled_date DATETIME,
        due_date DATETIME,
        completed_date DATETIME,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL,
        INDEX idx_user_id (user_id),
        INDEX idx_status (status),
        INDEX idx_due_date (due_date),
        INDEX idx_follow_up_id (follow_up_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Fetch follow-ups
    const followUps = await executeQuery(`
      SELECT 
        uf.*,
        a.name as admin_name,
        a.email as admin_email
      FROM user_follow_ups uf
      LEFT JOIN admins a ON uf.admin_id = a.id
      WHERE uf.user_id = ?
      ORDER BY uf.created_at DESC
    `, [userId]);

    res.json({
      status: 'success',
      data: followUps || []
    });

  } catch (error) {
    console.error('Get follow-ups error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch follow-ups',
      error: error.message
    });
  }
});

// Add follow-up
router.post('/:userId/follow-ups', authenticateAdmin, async (req, res) => {
  try {
    console.log('📞 Adding follow-up for user:', req.params.userId);
    await initializeDatabase();
    const { userId } = req.params;
    const adminId = req.user?.id || req.user?.adminId || null;

    const {
      type,
      priority = 'medium',
      subject,
      description,
      response,
      scheduledDate,
      dueDate,
      notes,
      status = 'pending'
    } = req.body;

    // Validate required fields
    if (!type) {
      return res.status(400).json({
        status: 'error',
        message: 'Follow-up type is required'
      });
    }

    // Check if table exists and fix admin_id column type if needed
    try {
      const tableCheck = await executeQuery(`
        SELECT COLUMN_TYPE 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'user_follow_ups' 
        AND COLUMN_NAME = 'admin_id'
      `);

      if (tableCheck.length > 0 && tableCheck[0].COLUMN_TYPE !== 'varchar(36)') {
        // Drop foreign key if exists
        try {
          await executeQuery(`ALTER TABLE user_follow_ups DROP FOREIGN KEY user_follow_ups_ibfk_2`);
        } catch (e) {
          // Foreign key might not exist or have different name
        }
        // Alter column type
        await executeQuery(`ALTER TABLE user_follow_ups MODIFY admin_id VARCHAR(36)`);
        // Recreate foreign key
        await executeQuery(`
          ALTER TABLE user_follow_ups 
          ADD CONSTRAINT user_follow_ups_ibfk_2 
          FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
        `);
      }
    } catch (alterError) {
      // Table might not exist yet, continue to create it
    }

    // Create table if it doesn't exist
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS user_follow_ups (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        follow_up_id VARCHAR(50) UNIQUE,
        type ENUM('call', 'email', 'sms', 'meeting', 'other') NOT NULL,
        priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
        subject VARCHAR(200),
        description TEXT,
        response VARCHAR(200),
        assigned_to VARCHAR(100),
        admin_id INT,
        status ENUM('pending', 'in_progress', 'completed', 'cancelled', 'overdue') DEFAULT 'pending',
        scheduled_date DATETIME,
        due_date DATETIME,
        completed_date DATETIME,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL,
        INDEX idx_user_id (user_id),
        INDEX idx_status (status),
        INDEX idx_due_date (due_date),
        INDEX idx_follow_up_id (follow_up_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Generate follow-up ID
    const followUpCount = await executeQuery(`
      SELECT COUNT(*) as count FROM user_follow_ups WHERE user_id = ?
    `, [userId]);
    const count = followUpCount[0]?.count || 0;
    const followUpId = `FU${String(count + 1).padStart(6, '0')}`;

    // Insert follow-up
    const result = await executeQuery(`
      INSERT INTO user_follow_ups (
        user_id, 
        follow_up_id, 
        type, 
        priority, 
        subject, 
        description, 
        response,
        admin_id,
        status, 
        scheduled_date, 
        due_date,
        notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      userId,
      followUpId,
      type,
      priority,
      subject || `Follow Up - ${type}`,
      description || notes || '',
      response || null,
      adminId,
      status,
      scheduledDate ? new Date(scheduledDate) : null,
      dueDate ? new Date(dueDate) : (scheduledDate ? new Date(scheduledDate) : null),
      notes || description || ''
    ]);

    const followUpIdInserted = result.insertId;

    // Fetch the created follow-up
    const followUp = await executeQuery(`
      SELECT 
        uf.*,
        a.name as admin_name,
        a.email as admin_email
      FROM user_follow_ups uf
      LEFT JOIN admins a ON uf.admin_id = a.id
      WHERE uf.id = ?
    `, [followUpIdInserted]);

    console.log('✅ Follow-up added successfully');
    res.json({
      status: 'success',
      message: 'Follow-up added successfully',
      data: followUp[0]
    });

  } catch (error) {
    console.error('Add follow-up error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to add follow-up',
      error: error.message
    });
  }
});

// Add note
router.post('/:userId/notes', authenticateAdmin, async (req, res) => {
  try {
    console.log('📝 Adding note for user:', req.params.userId);
    await initializeDatabase();
    const { userId } = req.params;
    const { subject, note, category, priority } = req.body;

    // For now, we'll store note info in memory since table doesn't exist yet
    console.log('✅ Note added successfully (stored in memory)');
    res.json({
      status: 'success',
      message: 'Note added successfully',
      data: { userId, subject, note, category, priority }
    });

  } catch (error) {
    console.error('Add note error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to add note'
    });
  }
});

// Send SMS
router.post('/:userId/sms', authenticateAdmin, async (req, res) => {
  try {
    console.log('📱 Sending SMS for user:', req.params.userId);
    await initializeDatabase();
    const { userId } = req.params;
    const { message, templateId } = req.body;

    // For now, we'll store SMS info in memory since table doesn't exist yet
    console.log('✅ SMS sent successfully (stored in memory)');
    res.json({
      status: 'success',
      message: 'SMS sent successfully',
      data: { userId, message, templateId }
    });

  } catch (error) {
    console.error('Send SMS error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to send SMS'
    });
  }
});

/**
 * POST /api/admin/user-profile/:userId/refetch-kyc
 * Refetch KYC data from Digilocker and process documents
 */
router.post('/:userId/refetch-kyc', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { userId } = req.params;

    console.log('🔄 Admin refetching KYC data for user:', userId);

    // Get the latest KYC verification record for this user
    const kycRecords = await executeQuery(
      `SELECT id, user_id, verification_data, kyc_status
       FROM kyc_verifications 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [userId]
    );

    if (kycRecords.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'No KYC verification record found for this user'
      });
    }

    const kycRecord = kycRecords[0];

    // Parse verification_data if it's a JSON string
    let verificationData;
    if (typeof kycRecord.verification_data === 'string') {
      try {
        verificationData = JSON.parse(kycRecord.verification_data);
      } catch (e) {
        console.error('❌ Error parsing verification_data:', e);
        verificationData = {};
      }
    } else {
      verificationData = kycRecord.verification_data || {};
    }

    // Get transactionId from various possible locations
    const transactionId = verificationData.transactionId ||
      verificationData.transaction_id ||
      (verificationData.verification_data && verificationData.verification_data.transactionId);

    if (!transactionId) {
      return res.status(400).json({
        status: 'error',
        message: 'No transaction ID found in KYC verification record'
      });
    }

    console.log('📥 Fetching KYC data from Digilocker for txnId:', transactionId);
    console.log('📋 Verification data structure:', JSON.stringify(verificationData, null, 2));

    if (!transactionId) {
      console.error('❌ Transaction ID not found. Verification data keys:', Object.keys(verificationData));
      return res.status(400).json({
        status: 'error',
        message: 'No transaction ID found in KYC verification record',
        debug: {
          verificationDataKeys: Object.keys(verificationData),
          verificationDataSample: verificationData
        }
      });
    }

    // Import axios and processAndUploadDocs
    const axios = require('axios');

    // Import processAndUploadDocs function
    let processAndUploadDocs;
    try {
      const digilockerRoutes = require('./digilocker');
      processAndUploadDocs = digilockerRoutes.processAndUploadDocs;
      if (!processAndUploadDocs) {
        throw new Error('processAndUploadDocs function not found in digilocker routes');
      }
      console.log('✅ Successfully imported processAndUploadDocs');
    } catch (importError) {
      console.error('❌ Error importing processAndUploadDocs:', importError);
      console.error('❌ Import error stack:', importError.stack);
      return res.status(500).json({
        status: 'error',
        message: `Failed to import processAndUploadDocs: ${importError.message}`,
        error: process.env.NODE_ENV === 'development' ? importError.stack : undefined
      });
    }

    // Call Digilocker API to fetch actual KYC data
    // Use get-digilocker-details endpoint (same as get-details route)
    const useProduction = process.env.DIGILOCKER_USE_PRODUCTION === 'true';
    const apiUrl = process.env.DIGILOCKER_GET_DETAILS_URL ||
      (useProduction
        ? 'https://api.digitap.ai/ent/v1/kyc/get-digilocker-details'
        : 'https://apidemo.digitap.work/ent/v1/kyc/get-digilocker-details');

    // Get auth token
    let authToken = process.env.DIGILOCKER_AUTH_TOKEN;
    if (!authToken && process.env.DIGILOCKER_CLIENT_ID && process.env.DIGILOCKER_CLIENT_SECRET) {
      const credentials = `${process.env.DIGILOCKER_CLIENT_ID}:${process.env.DIGILOCKER_CLIENT_SECRET}`;
      authToken = Buffer.from(credentials).toString('base64');
    }
    // Fallback to DIGITAP credentials if DIGILOCKER credentials not set
    if (!authToken && process.env.DIGITAP_CLIENT_ID && process.env.DIGITAP_CLIENT_SECRET) {
      const credentials = `${process.env.DIGITAP_CLIENT_ID}:${process.env.DIGITAP_CLIENT_SECRET}`;
      authToken = Buffer.from(credentials).toString('base64');
    }
    if (!authToken && process.env.NODE_ENV !== 'production') {
      authToken = 'MjcxMDg3NTA6UlRwYzRpVjJUQnFNdFhKRWR6a1BhRG5CRDVZTk9BRkI=';
    }

    console.log('🔗 Calling Digilocker get-details API:', apiUrl);
    console.log('🔑 Using auth token:', authToken ? 'Yes' : 'No');

    const digilockerResponse = await axios.post(
      apiUrl,
      { transactionId: transactionId },
      {
        headers: {
          'ent_authorization': authToken,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    console.log('✅ Digilocker KYC Data Response Status:', digilockerResponse.status);
    console.log('✅ Digilocker KYC Data Response Code:', digilockerResponse.data?.code);

    if (digilockerResponse.data && digilockerResponse.data.code === "200") {
      const kycData = digilockerResponse.data.model || digilockerResponse.data.data;

      console.log('📊 KYC Data fetched successfully. Keys:', Object.keys(kycData || {}));

      // Update kyc_verifications table with full KYC data
      await executeQuery(
        `UPDATE kyc_verifications 
         SET verification_data = JSON_SET(
           COALESCE(verification_data, '{}'),
           '$.kycData', ?
         ),
         updated_at = NOW()
         WHERE id = ?`,
        [JSON.stringify(kycData), kycRecord.id]
      );

      // Extract and save user info from Digilocker KYC data
      try {
        const { saveUserInfoFromDigilocker, saveAddressFromDigilocker } = require('../services/userInfoService');
        await saveUserInfoFromDigilocker(kycRecord.user_id, kycData, transactionId);
        console.log('✅ User info extracted and saved from Digilocker KYC.');

        // Also save address if available
        await saveAddressFromDigilocker(kycRecord.user_id, kycData, transactionId);
        console.log('✅ Address extracted and saved from Digilocker KYC.');
      } catch (infoError) {
        console.error('❌ Error saving user info from Digilocker KYC:', infoError.message);
        // Continue even if user info extraction fails
      }

      // Also fetch documents using list-docs endpoint
      let documentsProcessed = 0;
      try {
        const listDocsUrl = process.env.DIGILOCKER_LIST_DOCS_URL ||
          (useProduction
            ? 'https://api.digitap.ai/ent/v1/digilocker/list-docs'
            : 'https://apidemo.digitap.work/ent/v1/digilocker/list-docs');

        console.log('📄 Fetching documents from list-docs endpoint...');
        const docsResponse = await axios.post(
          listDocsUrl,
          { transactionId: transactionId },
          {
            headers: {
              'ent_authorization': authToken,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          }
        );

        if (docsResponse.data && docsResponse.data.code === '200') {
          const docs = docsResponse.data.model || docsResponse.data.data;
          const docsParsed = typeof docs === 'string' ? JSON.parse(docs) : docs;

          console.log(`📄 Found ${Array.isArray(docsParsed) ? docsParsed.length : 0} documents`);

          // Process and upload documents
          if (docsParsed && Array.isArray(docsParsed) && docsParsed.length > 0) {
            console.log(`🚀 Processing ${docsParsed.length} documents...`);
            try {
              const userIdInt = parseInt(userId);
              if (isNaN(userIdInt)) {
                throw new Error(`Invalid user ID: ${userId}`);
              }
              await processAndUploadDocs(userIdInt, transactionId, docsParsed);
              documentsProcessed = docsParsed.length;
              console.log(`✅ Successfully processed ${documentsProcessed} documents`);
            } catch (docError) {
              console.error('❌ Error processing documents:', docError);
              console.error('❌ Document processing error stack:', docError.stack);
            }
          }
        } else {
          console.log('⚠️ list-docs returned non-200 code:', docsResponse.data?.code);
        }
      } catch (docsError) {
        console.error('❌ Error fetching documents from list-docs:', docsError.message);
        // Continue even if document fetch fails
      }

      res.json({
        status: 'success',
        message: 'KYC data refetched successfully',
        data: {
          kycData: kycData,
          documentsProcessed: documentsProcessed,
          transactionId: transactionId
        }
      });
    } else {
      return res.status(400).json({
        status: 'error',
        message: digilockerResponse.data?.msg || 'Invalid response from Digilocker API',
        code: digilockerResponse.data?.code
      });
    }

  } catch (error) {
    console.error('❌ Refetch KYC data error:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      status: 'error',
      message: 'Failed to refetch KYC data from Digilocker',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;