/**
 * Generate and upload KFS and Loan Agreement PDFs for processed loans
 * This is called when loan status changes to account_manager
 * 
 * Uses the existing pdfService.generateKFSPDF() which takes HTML content
 * and generates PDF using Puppeteer internally.
 */

const pdfService = require('../services/pdfService');
const { uploadGeneratedPDF } = require('../services/s3Service');
const { executeQuery } = require('../config/database');
const axios = require('axios');
const puppeteer = require('puppeteer');

/**
 * Get KFS HTML by making internal API call to get KFS data,
 * then rendering it using Puppeteer (similar to how frontend does it)
 */
async function getKFSHTML(loanId, baseUrl = 'http://localhost:5000') {
  try {
    // Step 1: Get KFS data (JSON) via internal API call
    console.log(`📊 Fetching KFS data for loan #${loanId}...`);
    const kfsDataResponse = await axios.get(`${baseUrl}/api/kfs/${loanId}`, {
      headers: {
        'x-internal-call': 'true',
        // Note: You may need to add admin token for authentication
        // 'Authorization': `Bearer ${process.env.INTERNAL_API_TOKEN}`
      }
    });
    
    if (!kfsDataResponse.data.success || !kfsDataResponse.data.data) {
      throw new Error('Failed to get KFS data');
    }
    
    const kfsData = kfsDataResponse.data.data;
    
    // Step 2: Render KFS data to HTML using Puppeteer
    // We'll create a simple HTML page with the KFS data and render the React component
    // For now, we'll use Puppeteer to navigate to a URL that renders it
    // OR we can create an internal endpoint that returns HTML
    
    // Alternative: Use Puppeteer to navigate to frontend URL (requires frontend running)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const kfsUrl = `${frontendUrl}/admin/loans/${loanId}/kfs?internal=true&data=${encodeURIComponent(JSON.stringify(kfsData))}`;
    
    console.log(`🌐 Rendering KFS HTML via Puppeteer...`);
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.goto(kfsUrl, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    // Wait for KFS content to render
    await page.waitForSelector('.kfs-document-content', { timeout: 10000 });
    
    // Extract HTML content
    const htmlContent = await page.evaluate(() => {
      const kfsElement = document.querySelector('.kfs-document-content');
      return kfsElement ? kfsElement.outerHTML : null;
    });
    
    await browser.close();
    
    if (!htmlContent) {
      throw new Error('KFS content not found on page');
    }
    
    return htmlContent;
    
  } catch (error) {
    console.error('Error getting KFS HTML:', error);
    throw new Error(`Failed to get KFS HTML: ${error.message}`);
  }
}

/**
 * Get Loan Agreement HTML (similar to KFS)
 */
async function getLoanAgreementHTML(loanId, baseUrl = 'http://localhost:5000') {
  try {
    // Get KFS data (loan agreement uses same data structure)
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
    
    // Render using Puppeteer
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const agreementUrl = `${frontendUrl}/admin/loans/${loanId}/agreement?internal=true&data=${encodeURIComponent(JSON.stringify(agreementData))}`;
    
    console.log(`🌐 Rendering Loan Agreement HTML via Puppeteer...`);
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.goto(agreementUrl, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    // Wait for agreement content
    await page.waitForSelector('.loan-agreement-content, .agreement-document', { timeout: 10000 });
    
    const htmlContent = await page.evaluate(() => {
      const agreementElement = document.querySelector('.loan-agreement-content') || 
                              document.querySelector('.agreement-document');
      return agreementElement ? agreementElement.outerHTML : null;
    });
    
    await browser.close();
    
    if (!htmlContent) {
      throw new Error('Loan Agreement content not found on page');
    }
    
    return htmlContent;
    
  } catch (error) {
    console.error('Error getting Loan Agreement HTML:', error);
    throw new Error(`Failed to get Loan Agreement HTML: ${error.message}`);
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
    
    // Get HTML content - uses existing KFS API and Puppeteer to render
    const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:5000';
    
    console.log(`📄 Getting KFS HTML for loan #${loanId}...`);
    const kfsHTML = await getKFSHTML(loanId, apiBaseUrl);
    
    console.log(`📄 Getting Loan Agreement HTML for loan #${loanId}...`);
    const loanAgreementHTML = await getLoanAgreementHTML(loanId, apiBaseUrl);
    
    // Generate PDFs
    const kfsFilename = `KFS_${applicationNumber}.pdf`;
    const agreementFilename = `Loan_Agreement_${applicationNumber}.pdf`;
    
    console.log(`📄 Generating KFS PDF: ${kfsFilename}`);
    const kfsPDF = await pdfService.generateKFSPDF(kfsHTML, kfsFilename);
    
    console.log(`📄 Generating Loan Agreement PDF: ${agreementFilename}`);
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
  generateAndUploadLoanPDFs
};
