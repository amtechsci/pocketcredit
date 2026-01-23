/**
 * Generate and upload KFS and Loan Agreement PDFs for processed loans
 * This is called when loan status changes to account_manager
 * 
 * Uses server-side HTML generators to avoid Puppeteer browser navigation issues.
 * The HTML is generated directly from data, then converted to PDF.
 */

const pdfService = require('../services/pdfService');
const { uploadGeneratedPDF } = require('../services/s3Service');
const { executeQuery } = require('../config/database');
const axios = require('axios');

// Import server-side HTML generators
const { generateKFSHTML } = require('./kfsHtmlGenerator');
const { generateLoanAgreementHTML } = require('./loanAgreementHtmlGenerator');

/**
 * Get KFS data from internal API
 * @param {number} loanId - Loan ID
 * @param {string} baseUrl - Backend API base URL  
 * @returns {Promise<Object>} KFS data object
 */
async function getKFSData(loanId, baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`) {
  try {
    console.log(`📊 Fetching KFS data for loan #${loanId}...`);
    const kfsDataResponse = await axios.get(`${baseUrl}/api/kfs/${loanId}`, {
      headers: {
        'x-internal-call': 'true',
      },
      timeout: 30000
    });

    if (!kfsDataResponse.data.success || !kfsDataResponse.data.data) {
      throw new Error('Failed to get KFS data from API');
    }

    return kfsDataResponse.data.data;
  } catch (error) {
    console.error(`Error fetching KFS data for loan #${loanId}:`, error.message);
    throw new Error(`Failed to fetch KFS data: ${error.message}`);
  }
}

/**
 * Get KFS HTML by generating it server-side (no Puppeteer browser navigation needed)
 * @param {number} loanId - Loan ID
 * @param {string} baseUrl - Backend API base URL
 * @returns {Promise<string>} Complete HTML document
 */
async function getKFSHTMLServerSide(loanId, baseUrl) {
  try {
    // Step 1: Get KFS data via internal API
    const kfsData = await getKFSData(loanId, baseUrl);

    // Step 2: Generate HTML server-side (no browser needed!)
    console.log(`📄 Generating KFS HTML server-side for loan #${loanId}...`);
    const html = generateKFSHTML(kfsData);

    console.log(`✅ KFS HTML generated successfully (${html.length} chars)`);
    return html;
  } catch (error) {
    console.error('Error generating KFS HTML:', error);
    throw new Error(`Failed to generate KFS HTML: ${error.message}`);
  }
}

/**
 * Get Loan Agreement HTML by generating it server-side
 * @param {number} loanId - Loan ID
 * @param {string} baseUrl - Backend API base URL
 * @returns {Promise<string>} Complete HTML document
 */
async function getLoanAgreementHTMLServerSide(loanId, baseUrl) {
  try {
    // Step 1: Get KFS data (same data structure is used for agreement)
    const agreementData = await getKFSData(loanId, baseUrl);

    // Step 2: Generate HTML server-side (no browser needed!)
    console.log(`📄 Generating Loan Agreement HTML server-side for loan #${loanId}...`);
    const html = generateLoanAgreementHTML(agreementData);

    console.log(`✅ Loan Agreement HTML generated successfully (${html.length} chars)`);
    return html;
  } catch (error) {
    console.error('Error generating Loan Agreement HTML:', error);
    throw new Error(`Failed to generate Loan Agreement HTML: ${error.message}`);
  }
}

/**
 * Generate and upload KFS and Loan Agreement PDFs for a loan
 * @param {number} loanId - Loan application ID
 * @param {number} userId - User ID
 * @returns {Promise<Object>} S3 keys of uploaded PDFs
 */
async function generateAndUploadLoanPDFs(loanId, userId) {
  try {
    console.log(`📄 Generating PDFs for loan #${loanId}`);

    // Get loan data for filenames
    const loans = await executeQuery(
      'SELECT application_number FROM loan_applications WHERE id = ?',
      [loanId]
    );

    if (!loans || loans.length === 0) {
      throw new Error(`Loan ${loanId} not found`);
    }

    const applicationNumber = loans[0].application_number;
    const apiBaseUrl = process.env.BACKEND_URL || process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3001}`;

    // Generate HTML content server-side (no Puppeteer browser navigation!)
    console.log(`📄 Generating KFS HTML for loan #${loanId}...`);
    const kfsHTML = await getKFSHTMLServerSide(loanId, apiBaseUrl);

    console.log(`📄 Generating Loan Agreement HTML for loan #${loanId}...`);
    const loanAgreementHTML = await getLoanAgreementHTMLServerSide(loanId, apiBaseUrl);

    // Generate PDFs using pdfService (uses Puppeteer internally just for HTML-to-PDF conversion)
    const kfsFilename = `KFS_${applicationNumber}.pdf`;
    const agreementFilename = `Loan_Agreement_${applicationNumber}.pdf`;

    console.log(`📄 Converting KFS HTML to PDF: ${kfsFilename}`);
    const kfsPDF = await pdfService.generateKFSPDF(kfsHTML, kfsFilename);

    console.log(`📄 Converting Loan Agreement HTML to PDF: ${agreementFilename}`);
    const agreementPDF = await pdfService.generateKFSPDF(loanAgreementHTML, agreementFilename);

    // Upload to S3
    console.log(`📤 Uploading KFS PDF to S3...`);
    const kfsUpload = await uploadGeneratedPDF(
      kfsPDF.buffer,
      kfsFilename,
      userId,
      'kfs'
    );

    console.log(`📤 Uploading Loan Agreement PDF to S3...`);
    const agreementUpload = await uploadGeneratedPDF(
      agreementPDF.buffer,
      agreementFilename,
      userId,
      'loan-agreement'
    );

    console.log(`✅ PDFs generated and uploaded successfully`);
    console.log(`   KFS S3 Key: ${kfsUpload.key}`);
    console.log(`   Agreement S3 Key: ${agreementUpload.key}`);

    return {
      success: true,
      kfs: {
        s3Key: kfsUpload.key
      },
      agreement: {
        s3Key: agreementUpload.key
      }
    };

  } catch (error) {
    console.error(`❌ Error generating/uploading PDFs for loan #${loanId}:`, error);
    throw error;
  }
}

module.exports = {
  generateAndUploadLoanPDFs,
  getKFSHTMLServerSide,
  getLoanAgreementHTMLServerSide,
  getKFSData
};
