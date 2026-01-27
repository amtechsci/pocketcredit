const axios = require('axios');

/**
 * Digitap Bank Statement Analysis Service
 * Handles bank statement collection and analysis using Digitap APIs
 */

// Production Digitap Bank Statement API Configuration
// Base URL: https://svc.digitap.ai
// Remove trailing slash if present to avoid double slashes in URLs
const getBaseUrl = () => {
  const url = process.env.DIGITAP_BANK_STATEMENT_URL || process.env.DIGITAP_API_URL || 'https://svc.digitap.ai';
  return url.replace(/\/+$/, ''); // Remove trailing slashes
};

const DIGITAP_BASE_URL = getBaseUrl();
const DIGITAP_CLIENT_ID = process.env.DIGITAP_CLIENT_ID || '25845721';
const DIGITAP_CLIENT_SECRET = process.env.DIGITAP_CLIENT_SECRET || 'o0GHuqVysgUKJ2LNQC7BB46amc5rBqH8';
const DIGITAP_CLIENT_NAME = process.env.DIGITAP_CLIENT_NAME || '25845721'; // Client name provided by Digitap
const DIGITAP_ENCRYPTION_KEY = process.env.DIGITAP_ENCRYPTION_KEY || process.env.DIGITAP_CLIENT_SECRET; // Key for signature encryption

// Correct API Endpoints for Bank Statement (PDF Upload API v1.20)
// According to Digitap API documentation v1.20
const ENDPOINTS = {
  GENERATE_URL: `${DIGITAP_BASE_URL}/bank-data/generateurl`,
  START_UPLOAD: `${DIGITAP_BASE_URL}/bank-data/startupload`, // Step 1: Start Upload API
  UPLOAD_STATEMENT: `${DIGITAP_BASE_URL}/bank-data/uploadstmt`, // Step 2: Upload Statement API (uses URL from Step 1)
  COMPLETE_UPLOAD: `${DIGITAP_BASE_URL}/bank-data/completeupload`, // Step 3: Complete Upload API
  STATUS_CHECK: `${DIGITAP_BASE_URL}/bank-data/statuscheck`,
  RETRIEVE_REPORT: `${DIGITAP_BASE_URL}/bank-data/retrievereport`,
  CANCEL_REQUEST: `${DIGITAP_BASE_URL}/bank-data/cancelrequest`,
  INSTITUTIONS: `${DIGITAP_BASE_URL}/bank-data/institutions`
};

/**
 * Generate Base64 encoded authorization header (with "Basic " prefix)
 * Used for Authorization header
 */
function getAuthHeader() {
  const credentials = `${DIGITAP_CLIENT_ID}:${DIGITAP_CLIENT_SECRET}`;
  const base64Credentials = Buffer.from(credentials).toString('base64');
  return `Basic ${base64Credentials}`;
}

/**
 * Generate Base64 encoded auth token (without "Basic " prefix)
 * Used for ent_authorization header (like other Digitap APIs)
 */
function getEntAuthToken() {
  const credentials = `${DIGITAP_CLIENT_ID}:${DIGITAP_CLIENT_SECRET}`;
  return Buffer.from(credentials).toString('base64');
}

/**
 * Generate signature for Digitap API requests
 * According to API v1.8: signature = base16(encrypt(base16(sha256(stringify(json_payload)))))
 * 
 * Note: The encryption method is not fully specified in the docs. Common approaches:
 * - HMAC-SHA256 with the key
 * - AES encryption with the key
 * - RSA encryption
 * 
 * This implementation uses HMAC-SHA256 as it's the most common approach for API signatures.
 * If this doesn't work, you may need to contact Digitap for the exact encryption method.
 * 
 * @param {Object} payload - The JSON payload to sign
 * @returns {string} - Base16 encoded encrypted signature
 */
function generateSignature(payload) {
  try {
    const crypto = require('crypto');
    
    // Step 1: Stringify the JSON payload (sorted keys for consistency)
    const jsonString = JSON.stringify(payload, Object.keys(payload).sort());
    
    // Step 2: Generate SHA256 digest
    const sha256Hash = crypto.createHash('sha256').update(jsonString).digest();
    
    // Step 3: Base16 encode the digest (already hex, so it's base16)
    const base16Hash = sha256Hash.toString('hex');
    
    // Step 4: Encrypt using HMAC-SHA256 (most common approach for API signatures)
    // Using the encryption key as the HMAC secret
    const hmac = crypto.createHmac('sha256', DIGITAP_ENCRYPTION_KEY);
    hmac.update(base16Hash);
    const encrypted = hmac.digest('hex');
    
    // Step 5: Base16 encode the encrypted digest (already hex, so return as is)
    return encrypted;
  } catch (error) {
    console.error('❌ Error generating signature:', error);
    // Fallback: simple HMAC of the JSON string
    const crypto = require('crypto');
    const jsonString = JSON.stringify(payload, Object.keys(payload).sort());
    const hmac = crypto.createHmac('sha256', DIGITAP_ENCRYPTION_KEY);
    hmac.update(jsonString);
    return hmac.digest('hex');
  }
}

/**
 * Generate unique client reference number
 * Format: PC{userId}{timestamp} (only alphanumeric, dots, hyphens allowed)
 * Example: PC1231761761705123 (userId=123, timestamp=1761761705123)
 * This ensures uniqueness per user even if multiple users upload simultaneously
 */
function generateClientRefNum(userId, applicationId) {
  const timestamp = Date.now();
  // Include userId to ensure uniqueness per user
  // Pad userId to 6 digits for consistent format (supports up to 999999 users)
  const paddedUserId = String(userId || 0).padStart(6, '0');
  return `PC${paddedUserId}${timestamp}`;
}

/**
 * Generate URL for Bank Statement Collection
 * This creates a secure link where customers can:
 * - Login to Net Banking
 * - Upload PDF statements
 * - Use Account Aggregator
 * 
 * @param {Object} params
 * @param {string} params.client_ref_num - Unique reference number
 * @param {string} params.return_url - URL to redirect after completion
 * @param {string} params.txn_completed_cburl - Webhook URL for callbacks
 * @param {string} params.mobile_num - User's mobile number (required for new API)
 * @param {string} params.start_date - Start date (YYYY-MM-DD format)
 * @param {string} params.end_date - End date (YYYY-MM-DD format)
 * @param {string} params.destination - Method: 'accountaggregator', 'netbanking', 'pdf'
 * @param {string} params.aa_vendor - AA vendor (optional, configurable via DIGITAP_AA_VENDOR env var). If not provided, Digitap will use default vendor for your account
 * @param {string} params.multi_aa - Multi AA flag: '0' or '1' - default: '0'
 * @param {string} params.acceptance_policy - Acceptance policy - default: 'atLeastOneTransactionInRange'
 * @param {string} params.txn_id - Transaction ID (optional)
 * @param {string} params.report_type - Report type - default: 'xlsx'
 * @param {string} params.report_subtype - Report subtype - default: 'type3'
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
async function generateBankStatementURL(params) {
  try {
    const {
      client_ref_num,
      return_url,
      txn_completed_cburl,
      mobile_num,
      start_date,
      end_date,
      destination = 'accountaggregator',
      aa_vendor = process.env.DIGITAP_AA_VENDOR || null, // Make configurable, default to null (let Digitap choose)
      multi_aa = '0',
      acceptance_policy = 'atLeastOneTransactionInRange',
      txn_id,
      report_type = 'xlsx',
      report_subtype = 'type3'
    } = params;

    // Validate required parameters
    if (!client_ref_num) {
      return {
        success: false,
        error: 'Client reference number is required'
      };
    }

    // Mobile number is required for accountaggregator and netbanking
    // For statementupload (manual), it's optional but recommended
    if (destination !== 'statementupload' && !mobile_num) {
      return {
        success: false,
        error: 'Mobile number is required for online verification methods'
      };
    }
    
    // For manual upload, use a placeholder if not provided
    const mobileNumToUse = mobile_num || '0000000000';

    console.log(`📊 Generating Digitap Bank Statement URL`);
    console.log('Using endpoint:', ENDPOINTS.GENERATE_URL);

    // Calculate date range (default: last 6 months)
    const endDate = end_date ? new Date(end_date) : new Date();
    const startDate = start_date ? new Date(start_date) : (() => {
      const d = new Date();
      d.setMonth(d.getMonth() - 6);
      return d;
    })();
    
    // Format dates as YYYY-MM-DD
    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);
    
    // Calculate expiry date (1 month from end date)
    const expiryDate = new Date(endDate);
    expiryDate.setMonth(expiryDate.getMonth() + 1);
    const expiryDateStr = formatDate(expiryDate);

    // Build consent_request array (new API structure)
    const consentRequestObj = {
      fetch_type: "ONETIME",
      fi_types: ["DEPOSIT"],
      purpose: {
        code: "103",
        text: "Aggregated statement"
      },
      data_life: {
        unit: "MONTH",
        value: 1
      },
      fi_date_range: {
        start_date: startDateStr,
        end_date: endDateStr
      },
      consent: {
        mode: "STORE",
        types: ["TRANSACTIONS", "PROFILE", "SUMMARY"]
      },
      expiry: expiryDateStr,
      report_type: report_type,
      report_subtype: report_subtype
    };

    // Only include txn_id if provided
    if (txn_id) {
      consentRequestObj.txn_id = txn_id;
    }

    const consent_request = [consentRequestObj];

    // Determine API URL - prioritize environment variables, then use production URLs as default
    // Only use localhost if explicitly in development mode
    // API is on same domain as frontend: https://pocketcredit.in/api/
    const isDevelopment = process.env.NODE_ENV === 'development' || (!process.env.NODE_ENV && !process.env.APP_URL);
    const defaultApiUrl = process.env.APP_URL || (isDevelopment ? 'http://localhost:3002' : 'https://pocketcredit.in/api');
    const defaultFrontendUrl = process.env.FRONTEND_URL || (isDevelopment ? 'http://localhost:3000' : 'https://pocketcredit.in');
    
    // Routes are mounted at /api/bank-statement, so add /api for dev, or just /bank-statement for prod (since defaultApiUrl already has /api)
    const webhookPath = isDevelopment ? `${defaultApiUrl}/api/bank-statement/bank-data/webhook` : `${defaultApiUrl}/bank-statement/bank-data/webhook`;
    const returnPath = isDevelopment ? `${defaultApiUrl}/api/bank-statement/bank-data/success` : `${defaultApiUrl}/bank-statement/bank-data/success`;
    
    const requestBody = {
      client_ref_num,
      txn_completed_cburl: txn_completed_cburl || webhookPath,
      destination: destination,
      acceptance_policy: acceptance_policy,
      return_url: return_url || returnPath,
      mobile_num: mobile_num,
      multi_aa: multi_aa,
      consent_request: consent_request
    };

    // Only include aa_vendor if provided (some clients may not have specific vendors configured)
    if (aa_vendor) {
      requestBody.aa_vendor = aa_vendor;
    }

    console.log('Request body:', JSON.stringify(requestBody, null, 2));
    console.log('Authorization:', getAuthHeader());

    const response = await axios.post(
      ENDPOINTS.GENERATE_URL,
      requestBody,
      {
        headers: {
          'Authorization': getAuthHeader(),
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    console.log('✅ Digitap Generate URL Response:', JSON.stringify(response.data, null, 2));

    // Check for success based on Digitap's actual response format
    // Response structure: { url, expires, status, request_id }
    if (response.data && response.data.status === 'success' && response.data.url) {
      console.log('✅ Digitap URL generated successfully');
      return {
        success: true,
        data: {
          url: response.data.url,
          client_ref_num: client_ref_num,
          expires: response.data.expires,
          expiry_time: response.data.expires, // Use expires field
          request_id: response.data.request_id,
          message: 'URL generated successfully'
        }
      };
    } else {
      console.error('❌ Digitap returned non-success response:', response.data);
      return {
        success: false,
        error: response.data?.msg || response.data?.message || 'Failed to generate URL',
        code: response.data?.code,
        status: response.data?.status,
        raw_response: response.data
      };
    }
  } catch (error) {
    console.error('❌ Digitap Generate URL Error:', error.message);
    
    if (error.response) {
      console.error('Response error:', error.response.status, error.response.data);
      return {
        success: false,
        error: error.response.data?.msg || error.response.data?.message || `API error: ${error.response.status}`,
        code: error.response.data?.code
      };
    }

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get Institution List from Digitap
 * According to Digitap API v1.8 documentation
 * Note: API accepts GET or POST, but requires signature
 * 
 * @param {string} type - Institution type: "NetBanking" or "Statement"
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
async function getInstitutionList(type = 'Statement') {
  try {
    const payload = {
      client_name: DIGITAP_CLIENT_NAME,
      type: type
    };

    const signature = generateSignature(payload);

    // For GET requests with signature, we'll use POST with JSON body (more reliable)
    const requestBody = {
      payload: payload,
      signature: signature
    };

    const response = await axios.post(ENDPOINTS.INSTITUTIONS, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getAuthHeader() // Add Basic Auth header
      },
      timeout: 15000
    });

    if (response.data && response.data.status === 'success') {
      return {
        success: true,
        data: response.data.data || []
      };
    } else {
      return {
        success: false,
        error: response.data?.message || 'Failed to get institution list',
        code: response.data?.code
      };
    }
  } catch (error) {
    console.error('❌ Get Institution List Error:', error.message);
    if (error.response) {
      console.error('❌ Response:', error.response.data);
    }
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Start Upload API - Step 1 of PDF Upload Flow
 * According to Digitap API v1.8 documentation
 * 
 * @param {Object} params
 * @param {string} params.client_ref_num - Unique reference number
 * @param {string} params.txn_completed_cburl - Callback URL
 * @param {number} params.institution_id - Bank/Institution ID (from Institution List API) - REQUIRED
 * @param {string} params.start_month - Start month in YYYY-MM format (optional)
 * @param {string} params.end_month - End month in YYYY-MM format (optional)
 * @param {string} params.acceptance_policy - Acceptance policy (optional, default: 'atLeastOneTransactionInRange')
 * @param {number} params.relaxation_days - Relaxation days (optional, max 15)
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
async function startUploadAPI(params) {
  try {
    const {
      client_ref_num,
      txn_completed_cburl,
      institution_id,
      start_month,
      end_month,
      acceptance_policy = 'atLeastOneTransactionInRange',
      relaxation_days
    } = params;

    if (!client_ref_num || !txn_completed_cburl) {
      return {
        success: false,
        error: 'Missing required parameters: client_ref_num and txn_completed_cburl are required'
      };
    }
    
    // Note: institution_id is optional per API docs - Digitap can auto-detect the bank from the PDF

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📤 DIGITAP START UPLOAD API - DETAILED REQUEST LOG');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📤 Endpoint (primary):', ENDPOINTS.START_UPLOAD);
    console.log('📤 Method: POST');
    console.log('📤 Timestamp:', new Date().toISOString());

    const payload = {
      client_name: DIGITAP_CLIENT_NAME,
      client_ref_num: client_ref_num,
      txn_completed_cburl: txn_completed_cburl
    };

    // Add optional parameters
    if (institution_id) payload.institution_id = institution_id; // Optional - Digitap can auto-detect
    if (start_month) payload.start_month = start_month;
    if (end_month) payload.end_month = end_month;
    if (acceptance_policy) payload.acceptance_policy = acceptance_policy;
    if (relaxation_days !== undefined) payload.relaxation_days = String(relaxation_days);

    // Generate signature (for logging/debugging, but not used in Header-Based Auth)
    const signature = generateSignature(payload);

    // Log complete request details
    console.log('\n📋 REQUEST PAYLOAD (fields to send directly):');
    console.log(JSON.stringify(payload, null, 2));
    console.log('\n📋 REQUEST HEADERS:');
    const authHeader = getAuthHeader();
    console.log(JSON.stringify({
      'Content-Type': 'application/json',
      'Authorization': authHeader ? '[REDACTED - Basic Auth]' : 'NOT SET',
      'User-Agent': 'axios/' + require('axios/package.json').version
    }, null, 2));
    console.log('📋 Authorization Header (first 20 chars):', authHeader ? authHeader.substring(0, 20) + '...' : 'NOT SET');
    console.log('📋 Note: Using Header-Based Authentication (Basic Auth) - fields sent directly in body, NO payload wrapper');
    console.log('\n📋 CONFIGURATION:');
    console.log(JSON.stringify({
      DIGITAP_BASE_URL: DIGITAP_BASE_URL,
      DIGITAP_CLIENT_ID: DIGITAP_CLIENT_ID,
      DIGITAP_CLIENT_NAME: DIGITAP_CLIENT_NAME,
      'DIGITAP_CLIENT_SECRET': '[REDACTED]',
      'DIGITAP_ENCRYPTION_KEY': '[REDACTED]',
      signature_length: signature.length,
      signature_first_10_chars: signature.substring(0, 10) + '...'
    }, null, 2));

    // According to Digitap Support Team's working example:
    // Start Upload API expects fields DIRECTLY in request body (NO payload wrapper!)
    // 
    // Correct format:
    //   - Request body: { client_name, institution_id, client_ref_num, txn_completed_cburl, acceptance_policy, ... }
    //   - Headers: Authorization: Basic base64(CLIENT_ID:CLIENT_SECRET), Content-Type: application/json
    //
    // WRONG format (what we were doing):
    //   - Request body: { payload: { ... } } ❌
    
    let response;
    
    // Request config with Header-Based Authentication
    const requestConfig = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getAuthHeader() // Basic Auth: Base64(CLIENT_ID:CLIENT_SECRET)
      },
      timeout: 30000
    };
    
    // Send payload fields DIRECTLY (no payload wrapper!)
    // This matches the working cURL from Digitap support
    try {
      console.log('\n🚀 Sending request with Header-Based Authentication (fields directly in body, NO payload wrapper)...');
      console.log('📋 Request Body:', JSON.stringify(payload, null, 2));
      
      response = await axios.post(
        ENDPOINTS.START_UPLOAD,
        payload, // Send fields directly, NOT wrapped in payload object
        requestConfig
      );
      
      // Log successful response
      console.log('\n✅ RESPONSE RECEIVED (SUCCESS):');
      console.log('📥 Status Code:', response.status);
      console.log('📥 Status Text:', response.statusText);
      console.log('📥 Response Data:', JSON.stringify(response.data, null, 2));
      console.log('═══════════════════════════════════════════════════════════\n');
    } catch (error) {
      // Log error response details
      console.log('\n❌ REQUEST FAILED:');
      if (error.response) {
        console.log('📥 Status Code:', error.response.status);
        console.log('📥 Status Text:', error.response.statusText);
        console.log('📥 Response Data:', JSON.stringify(error.response.data, null, 2));
        console.log('📥 Error Code:', error.response.data?.code || 'N/A');
        console.log('📥 Error Message:', error.response.data?.msg || error.response.data?.message || 'N/A');
      } else if (error.request) {
        console.log('📥 No response received from server');
      } else {
        console.log('📥 Error setting up request:', error.message);
      }
      console.log('═══════════════════════════════════════════════════════════\n');
      throw error;
    }
    
    // If we still don't have a response, throw the error
    if (!response) {
      console.log('═══════════════════════════════════════════════════════════\n');
      throw new Error('Failed to get response from Start Upload API');
    }

    // Final response logging (if we got here, request succeeded)
    if (response && response.data) {
      console.log('\n✅ FINAL RESPONSE (SUCCESS):');
      console.log('📥 Status Code:', response.status);
      console.log('📥 Status Text:', response.statusText);
      console.log('📥 Response Headers:', JSON.stringify(response.headers, null, 2));
      console.log('📥 Response Data:', JSON.stringify(response.data, null, 2));
      console.log('═══════════════════════════════════════════════════════════\n');
    }

    if (response.data && response.data.status === 'success') {
      return {
        success: true,
        data: {
          url: response.data.url, // Upload Statement URL (dynamic)
          token: response.data.token,
          request_id: response.data.request_id,
          txn_id: response.data.txn_id,
          expires: response.data.expires,
          client_ref_num: client_ref_num
        }
      };
    } else {
      return {
        success: false,
        error: response.data?.msg || response.data?.message || 'Start Upload failed',
        code: response.data?.code
      };
    }
  } catch (error) {
    // Final error logging - comprehensive error details for Digitap team
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('❌ FINAL ERROR - ALL ATTEMPTS FAILED');
    console.log('═══════════════════════════════════════════════════════════');
    console.error('❌ Error Message:', error.message);
    console.error('❌ Error Code:', error.code || 'N/A');
    
    if (error.response) {
      console.error('❌ Response Status:', error.response.status);
      console.error('❌ Response Status Text:', error.response.statusText);
      console.error('❌ Response Headers:', JSON.stringify(error.response.headers, null, 2));
      console.error('❌ Response Data:', JSON.stringify(error.response.data, null, 2));
      
      const errorCode = error.response.data?.code;
      let errorMessage = error.response.data?.msg || error.response.data?.message || `API error: ${error.response.status}`;
      
      // Provide helpful error messages for common issues
      if (errorCode === 'NotSignedUp') {
        errorMessage = 'Your Digitap account has not been enabled for the Bank Data PDF Upload Service. Please contact Digitap support to enable this service for your client account.';
        console.error('⚠️  IMPORTANT: Your account needs to be enabled for Bank Data PDF Upload Service by Digitap.');
        console.error('⚠️  Please contact Digitap support with your client_id:', DIGITAP_CLIENT_ID);
      } else if (errorCode === 'RequiredClientName' || errorCode === 'ClientName') {
        errorMessage = `Invalid client_name. Please check if DIGITAP_CLIENT_NAME environment variable is set correctly. Current value: ${DIGITAP_CLIENT_NAME}`;
      } else if (errorCode === 'SignatureDoesNotMatch' || errorCode === 'InvalidEncryption') {
        errorMessage = `Signature authentication failed. Please verify DIGITAP_ENCRYPTION_KEY is set correctly. Error: ${errorMessage}`;
      } else if (errorCode === 'RequiredToken') {
        // This error shouldn't happen for Start Upload API - it doesn't require a token
        // If we get this, there might be an issue with the endpoint or request structure
        errorMessage = 'Start Upload API error: ' + errorMessage;
        console.error('⚠️  Note: Start Upload API should not require a token. Please verify the endpoint and request structure.');
      }
      
      console.log('═══════════════════════════════════════════════════════════\n');
      return {
        success: false,
        error: errorMessage,
        code: errorCode,
        status: error.response.status,
        raw_response: error.response.data
      };
    } else if (error.request) {
      console.error('❌ No response received from server');
      console.error('❌ Request Config:', JSON.stringify({
        url: error.config?.url,
        method: error.config?.method,
        timeout: error.config?.timeout,
        headers: error.config?.headers ? Object.keys(error.config.headers) : 'N/A'
      }, null, 2));
      console.log('═══════════════════════════════════════════════════════════\n');
    } else {
      console.error('❌ Error setting up request:', error.message);
      console.error('❌ Stack Trace:', error.stack?.split('\n').slice(0, 10).join('\n'));
      console.log('═══════════════════════════════════════════════════════════\n');
    }
    
    return {
      success: false,
      error: error.message || 'Start Upload failed'
    };
  }
}

/**
 * Upload Statement API - Step 2 of PDF Upload Flow
 * According to Digitap API v1.8 documentation
 * 
 * @param {Object} params
 * @param {string} params.upload_url - URL returned from Start Upload API
 * @param {string} params.token - Token from Start Upload API
 * @param {string} params.request_id - Request ID from Start Upload API
 * @param {Buffer} params.file_buffer - PDF file buffer
 * @param {string} params.file_name - Original filename
 * @param {string} params.file_password_b16 - Base16 encoded password (optional)
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
async function uploadStatementAPI(params) {
  try {
    const FormData = require('form-data');
    const crypto = require('crypto');
    
    const {
      upload_url,
      token,
      request_id,
      file_buffer,
      file_name,
      file_password_b16
    } = params;

    if (!upload_url || !token || !request_id || !file_buffer) {
      return {
        success: false,
        error: 'Missing required parameters: upload_url, token, request_id, and file_buffer are required'
      };
    }

    console.log('📤 Calling Digitap Upload Statement API...');
    console.log('📤 Upload URL:', upload_url);

    const formData = new FormData();
    formData.append('token', token);
    formData.append('request_id', request_id);
    formData.append('file', file_buffer, file_name);
    
    if (file_password_b16) {
      formData.append('file_password_b16', file_password_b16);
    }

    const response = await axios.post(
      upload_url, // Use the dynamic URL from Start Upload
      formData,
      {
        headers: {
          ...formData.getHeaders()
          // Note: No signature required for this API
        },
        timeout: 60000, // 60 seconds for file upload
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    console.log('✅ Upload Statement Response:', JSON.stringify(response.data, null, 2));

    if (response.data && response.data.status === 'success') {
      return {
        success: true,
        data: {
          status: response.data.status,
          code: response.data.code,
          msg: response.data.msg,
          statement_id: response.data.statement_id,
          accounts: response.data.accounts || []
        }
      };
    } else {
      return {
        success: false,
        error: response.data?.msg || response.data?.message || 'Upload failed',
        code: response.data?.code
      };
    }
  } catch (error) {
    console.error('❌ Upload Statement API Error:', error.message);
    if (error.response) {
      console.error('❌ Response Status:', error.response.status);
      console.error('❌ Response Data:', error.response.data);
      return {
        success: false,
        error: error.response.data?.msg || error.response.data?.message || `API error: ${error.response.status}`,
        code: error.response.data?.code,
        status: error.response.status
      };
    }
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Complete Upload API - Step 3 of PDF Upload Flow
 * According to Digitap API v1.8 documentation
 * 
 * @param {Object} params
 * @param {string} params.request_id - Request ID from Start Upload API
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
async function completeUploadAPI(params) {
  try {
    const { request_id } = params;

    if (!request_id) {
      return {
        success: false,
        error: 'Missing required parameter: request_id'
      };
    }

    console.log('📤 Calling Digitap Complete Upload API...');
    console.log('📤 Endpoint:', ENDPOINTS.COMPLETE_UPLOAD);

    // According to API docs v1.20, for Header-Based Authentication:
    // Send fields directly (no payload wrapper)
    const requestBody = {
      request_id: request_id
    };

    const response = await axios.post(
      ENDPOINTS.COMPLETE_UPLOAD,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': getAuthHeader() // Basic Auth: Base64(CLIENT_ID:CLIENT_SECRET)
        },
        timeout: 30000
      }
    );

    console.log('✅ Complete Upload Response:', JSON.stringify(response.data, null, 2));

    if (response.data && response.data.status === 'success') {
      return {
        success: true,
        data: {
          status: response.data.status,
          code: response.data.code,
          msg: response.data.msg
        }
      };
    } else {
      return {
        success: false,
        error: response.data?.msg || response.data?.message || 'Complete Upload failed',
        code: response.data?.code
      };
    }
  } catch (error) {
    console.error('❌ Complete Upload API Error:', error.message);
    if (error.response) {
      console.error('❌ Response Status:', error.response.status);
      console.error('❌ Response Data:', error.response.data);
      return {
        success: false,
        error: error.response.data?.msg || error.response.data?.message || `API error: ${error.response.status}`,
        code: error.response.data?.code,
        status: error.response.status
      };
    }
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Upload Bank Statement PDF directly to Digitap
 * Follows the 3-step process: Start Upload → Upload Statement → Complete Upload
 * According to Digitap API v1.8 documentation
 * 
 * @param {Object} params
 * @param {string} params.mobile_no - Customer mobile number (not used in PDF Upload API, but kept for compatibility)
 * @param {string} params.client_ref_num - Unique reference number
 * @param {Buffer} params.file_buffer - PDF file buffer
 * @param {string} params.file_name - Original filename
 * @param {string} params.bank_name - Bank name (optional, used to get institution_id)
 * @param {string} params.password - PDF password if encrypted (optional, will be base16 encoded)
 * @param {string} params.txn_completed_cburl - Callback URL (optional, will use default if not provided)
 * @param {number} params.institution_id - Bank/Institution ID (optional, will try to get from bank_name if not provided)
 * @param {string} params.start_month - Start month in YYYY-MM format (optional)
 * @param {string} params.end_month - End month in YYYY-MM format (optional)
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
async function uploadBankStatementPDF(params) {
  try {
    const crypto = require('crypto');
    
    const {
      mobile_no,
      client_ref_num,
      file_buffer,
      file_name,
      bank_name,
      password,
      txn_completed_cburl,
      institution_id,
      start_month,
      end_month
    } = params;

    if (!client_ref_num || !file_buffer) {
      return {
        success: false,
        error: 'Missing required parameters: client_ref_num and file_buffer are required'
      };
    }

    console.log(`📤 Starting Digitap PDF Upload Flow for: ${file_name}`);

    // Step 1: Start Upload API
    // Determine institution_id - if not provided, try to get it from bank_name
    let finalInstitutionId = institution_id;
    if (!finalInstitutionId && bank_name) {
      console.log(`🔍 Attempting to find institution_id for bank: ${bank_name}`);
      try {
        const institutionListResult = await getInstitutionList('Statement');
        if (institutionListResult.success && institutionListResult.data && institutionListResult.data.length > 0) {
          // Try to find matching institution by name (case-insensitive, partial match)
          const bankNameLower = bank_name.toLowerCase().trim();
          const matchingInstitution = institutionListResult.data.find(inst => {
            if (!inst.name) return false;
            const instNameLower = inst.name.toLowerCase().trim();
            // Check if bank_name is contained in institution name or vice versa
            return instNameLower.includes(bankNameLower) || bankNameLower.includes(instNameLower);
          });
          
          if (matchingInstitution) {
            finalInstitutionId = matchingInstitution.id;
            console.log(`✅ Found institution_id ${finalInstitutionId} for bank: ${bank_name} (matched: ${matchingInstitution.name})`);
          } else {
            console.warn(`⚠️  Could not find matching institution for bank: ${bank_name}`);
            console.log(`📋 Available institutions (first 5):`, institutionListResult.data.slice(0, 5).map(i => `${i.id}: ${i.name}`));
          }
        } else {
          console.warn('⚠️  Institution list API returned no data');
        }
      } catch (error) {
        console.warn('⚠️  Could not fetch institution list:', error.message);
      }
    }
    
    // If still no institution_id, try using a default (common banks) or return a helpful error
    if (!finalInstitutionId) {
      // Try common bank mappings (these are examples - you may need to adjust based on your Digitap account)
      const commonBankMappings = {
        'hdfc': 1,
        'icici': 2,
        'sbi': 3,
        'axis': 4,
        'kotak': 5,
        'pnb': 6,
        'bob': 7,
        'canara': 8,
        'union': 9,
        'indian': 10
      };
      
      if (bank_name) {
        const bankNameLower = bank_name.toLowerCase().trim();
        for (const [key, id] of Object.entries(commonBankMappings)) {
          if (bankNameLower.includes(key)) {
            finalInstitutionId = id;
            console.log(`📌 Using default institution_id ${finalInstitutionId} for bank pattern: ${key}`);
            break;
          }
        }
      }
      
      // If still no institution_id, use a default (1) but log a warning
      if (!finalInstitutionId) {
        console.warn(`⚠️  No institution_id found for bank: ${bank_name || 'N/A'}. Using default institution_id: 1`);
        finalInstitutionId = 1; // Default fallback - you may need to adjust this
      }
    }

    // Determine callback URL
    const defaultApiUrl = process.env.APP_URL || 'https://pocketcredit.in/api';
    const finalCallbackUrl = txn_completed_cburl || `${defaultApiUrl}/bank-statement/bank-data/webhook`;

    const startUploadResult = await startUploadAPI({
      client_ref_num: client_ref_num,
      txn_completed_cburl: finalCallbackUrl,
      institution_id: finalInstitutionId,
      start_month: start_month,
      end_month: end_month,
      acceptance_policy: 'atLeastOneTransactionInRange'
    });

    if (!startUploadResult.success) {
      return {
        success: false,
        error: `Start Upload failed: ${startUploadResult.error}`,
        code: startUploadResult.code
      };
    }

    const { url: uploadUrl, token, request_id, txn_id } = startUploadResult.data;
    console.log('✅ Step 1 Complete: Start Upload successful');
    console.log(`📊 Received upload URL, token, request_id: ${request_id}, txn_id: ${txn_id}`);

    // Step 2: Upload Statement API
    // Encode password to base16 if provided
    let filePasswordB16 = null;
    if (password) {
      filePasswordB16 = Buffer.from(password, 'utf8').toString('hex');
    }

    const uploadStatementResult = await uploadStatementAPI({
      upload_url: uploadUrl,
      token: token,
      request_id: request_id,
      file_buffer: file_buffer,
      file_name: file_name,
      file_password_b16: filePasswordB16
    });

    if (!uploadStatementResult.success) {
      return {
        success: false,
        error: `Upload Statement failed: ${uploadStatementResult.error}`,
        code: uploadStatementResult.code,
        request_id: request_id,
        txn_id: txn_id
      };
    }

    console.log('✅ Step 2 Complete: Upload Statement successful');

    // Step 3: Complete Upload API
    const completeUploadResult = await completeUploadAPI({
      request_id: request_id
    });

    if (!completeUploadResult.success) {
      return {
        success: false,
        error: `Complete Upload failed: ${completeUploadResult.error}`,
        code: completeUploadResult.code,
        request_id: request_id,
        txn_id: txn_id
      };
    }

    console.log('✅ Step 3 Complete: Complete Upload successful');
    console.log('✅ All steps completed: PDF uploaded and processing started');

    return {
      success: true,
      data: {
        client_ref_num: client_ref_num,
        request_id: request_id,
        txn_id: txn_id,
        status: 'processing',
        message: 'PDF uploaded successfully. Processing started.',
        statement_id: uploadStatementResult.data?.statement_id,
        accounts: uploadStatementResult.data?.accounts || []
      }
    };
  } catch (error) {
    console.error('❌ Digitap PDF Upload Flow Error:', error.message);
    console.error('❌ Stack:', error.stack);
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Check status of bank statement processing using request_id
 * 
 * @param {number} request_id - Request ID from generateurl response
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
async function checkBankStatementStatus(request_id) {
  try {
    if (!request_id) {
      return {
        success: false,
        error: 'Request ID is required'
      };
    }


    // According to API docs v1.20, for Header-Based Authentication:
    // Send fields directly (no payload wrapper)
    const response = await axios.post(
      ENDPOINTS.STATUS_CHECK,
      {
        request_id: request_id
      },
      {
        headers: {
          'Authorization': getAuthHeader(),
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );
    
    console.log('📋 Status Check Request: request_id =', request_id);

    console.log('✅ Status Check Response:', JSON.stringify(response.data, null, 2));

    if (response.data && response.data.status === 'success') {
      const txnStatus = response.data.txn_status || [];
      
      // Check transaction statuses 
      // Digitap uses: "Success" (report ready), "InProgress" (processing), "Failure" (failed)
      const allCompleted = txnStatus.every(txn => txn.status === 'Success' || txn.status === 'Completed');
      const anyInProgress = txnStatus.some(txn => txn.status === 'InProgress');
      const anyFailed = txnStatus.some(txn => txn.status === 'Failure' || txn.status === 'Failed' || txn.status === 'Error');

      // Map to our database enum: pending, processing, completed, failed, InProgress
      let overall_status = 'pending';
      if (allCompleted) {
        overall_status = 'completed';
      } else if (anyFailed) {
        overall_status = 'failed';
      } else if (anyInProgress) {
        overall_status = 'InProgress';
      }

      return {
        success: true,
        data: {
          request_id: response.data.request_id,
          txn_status: txnStatus,
          overall_status: overall_status,
          is_complete: allCompleted,
          is_in_progress: anyInProgress,
          is_failed: anyFailed,
          message: response.data.message
        }
      };
    } else {
      return {
        success: false,
        error: response.data?.msg || response.data?.message || 'Status check failed',
        code: response.data?.code
      };
    }
  } catch (error) {
    console.error('❌ Status Check Error:', error.message);
    
    if (error.response) {
      console.error('Response error:', error.response.status, error.response.data);
      return {
        success: false,
        error: `Status check error: ${error.response.status}`
      };
    }

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Retrieve analyzed bank statement report
 * Only call this after status shows "ReportGenerated"
 * 
 * @param {string} client_ref_num - Reference number (optional if txn_id provided)
 * @param {string} format - Report format: 'json' or 'excel' (default: 'json')
 * @param {string} txn_id - Transaction ID (optional, alternative to client_ref_num)
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
async function retrieveBankStatementReport(client_ref_num = null, format = 'json', txn_id = null) {
  try {
    // Either client_ref_num or txn_id must be provided
    if (!client_ref_num && !txn_id) {
      return {
        success: false,
        error: 'Either client reference number or transaction ID is required'
      };
    }

    console.log(`📥 Retrieving report for: ${txn_id ? `txn_id=${txn_id}` : `client_ref_num=${client_ref_num}`} (format: ${format})`);

    // According to API docs v1.20, for Header-Based Authentication:
    // Send fields directly (no payload wrapper)
    const requestBody = {
      report_type: format || 'json',
      report_subtype: 'type1' // Changed to type1 as it works in Postman
    };
    
    if (txn_id) {
      // When txn_id is provided, ONLY use txn_id (API doesn't allow both)
      requestBody.txn_id = txn_id;
    } else if (client_ref_num) {
      // Only use client_ref_num if txn_id is not available
      requestBody.client_ref_num = client_ref_num;
    }

    console.log('📋 Retrieve Report Request Body:', JSON.stringify(requestBody, null, 2));

    // For Excel format, we need to receive binary data
    const response = await axios.post(
      ENDPOINTS.RETRIEVE_REPORT,
      requestBody,
      {
        headers: {
          'Authorization': getAuthHeader(),
          'Content-Type': 'application/json'
        },
        responseType: format === 'xlsx' ? 'arraybuffer' : 'json', // Binary for Excel, JSON for other formats
        timeout: 30000
      }
    );

    console.log('✅ Report Retrieved, status:', response.status);
    
    // Handle Excel format (binary response)
    if (format === 'xlsx') {
      if (response.data && Buffer.isBuffer(response.data)) {
        console.log('✅ Excel file received, size:', response.data.length, 'bytes');
        return {
          success: true,
          data: {
            report: response.data, // Binary buffer
            txn_id: txn_id || null,
            format: 'xlsx',
            message: 'Excel report retrieved successfully'
          }
        };
      } else if (response.data) {
        // If it's not a buffer, try to convert it
        const buffer = Buffer.from(response.data);
        console.log('✅ Excel file converted to buffer, size:', buffer.length, 'bytes');
        return {
          success: true,
          data: {
            report: buffer,
            txn_id: txn_id || null,
            format: 'xlsx',
            message: 'Excel report retrieved successfully'
          }
        };
      } else {
        return {
          success: false,
          error: 'No Excel data received from Digitap'
        };
      }
    }

    // Handle JSON format
    console.log('📊 Report response structure:', {
      hasResult: !!response.data?.result,
      hasData: !!response.data?.data,
      resultCode: response.data?.result_code,
      httpResponseCode: response.data?.http_response_code,
      statusCode: response.status,
      responseKeys: response.data ? Object.keys(response.data) : [],
      hasBanks: !!response.data?.banks,
      hasStatus: !!response.data?.status
    });

    // Handle different response formats
    // The API can return the report in different ways:
    // 1. Nested: { result_code: 101, result: {...} }
    // 2. Direct: { banks: [...], status: '...', ... } (the entire response.data IS the report)
    let reportData = null;
    
    if (response.data) {
      // Check for error status first
      if (response.data.status === 'error' || response.data.code === 'error') {
        console.error('❌ API returned error status:', response.data);
        return {
          success: false,
          error: response.data.msg || response.data.message || 'API returned error status',
          code: response.data.code,
          statusCode: response.status
        };
      }
      
      // Check if response has report-related keys (banks, status, request_level_summary_var, etc.)
      // This indicates the response.data itself IS the report
      // Key indicators: banks array, request_level_summary_var, source_report, statement dates
      const hasReportKeys = Array.isArray(response.data.banks) || 
                           response.data.request_level_summary_var !== undefined ||
                           response.data.source_report !== undefined ||
                           response.data.statement_start_date !== undefined ||
                           response.data.statement_end_date !== undefined ||
                           response.data.multiple_accounts_found !== undefined;
      
      // Check if it's a nested response with result_code
      const hasResultCode = response.data.result_code === 101 || response.data.http_response_code === 200;
      
      // Check HTTP status code (200 = success)
      const isHttpSuccess = response.status === 200;
      
      console.log('📊 Report detection:', {
        hasReportKeys,
        hasResultCode,
        isHttpSuccess,
        hasBanks: !!response.data.banks,
        isBanksArray: Array.isArray(response.data.banks),
        hasStatus: !!response.data.status,
        statusValue: response.data.status,
        hasRequestLevelSummary: !!response.data.request_level_summary_var
      });
      
      // If HTTP status is 200 and we have data, and it's not an error, treat it as a report
      if (hasReportKeys || hasResultCode || (isHttpSuccess && response.data && !response.data.code)) {
        // Extract report data
        if (response.data.result) {
          // Nested in result field
          reportData = response.data.result;
        } else if (response.data.data) {
          // Nested in data field
          reportData = response.data.data;
        } else if (hasReportKeys || isHttpSuccess) {
          // The entire response.data IS the report (most common case for large reports)
          reportData = response.data;
        } else {
          // Fallback: use response.data
          reportData = response.data;
        }
        
        // If reportData is a string, try to parse it
        if (typeof reportData === 'string') {
          try {
            reportData = JSON.parse(reportData);
          } catch (e) {
            console.warn('Report data is a string but not valid JSON, using as-is');
          }
        }
        
        // If we have report data (even if it's the entire response), return it
        if (reportData && (typeof reportData === 'object' || typeof reportData === 'string')) {
          const reportSize = typeof reportData === 'string' ? reportData.length : JSON.stringify(reportData).length;
          console.log('✅ Report data extracted successfully, size:', reportSize, 'characters');
          
          return {
            success: true,
            data: {
              report: reportData,
              client_ref_num: client_ref_num || reportData.client_ref_num || null,
              txn_id: txn_id || reportData.txn_id || null,
              format,
              message: response.data.message || 'Report retrieved successfully'
            }
          };
        }
      }
    }
    
    // If we get here, report retrieval failed
    console.error('❌ Report retrieval failed:', {
      result_code: response.data?.result_code,
      http_response_code: response.data?.http_response_code,
      statusCode: response.status,
      message: response.data?.message,
      hasReportKeys: response.data ? (!!response.data.banks || !!response.data.status) : false
    });
    
    return {
      success: false,
      error: response.data?.message || response.data?.msg || 'Failed to retrieve report',
      result_code: response.data?.result_code,
      http_response_code: response.data?.http_response_code,
      statusCode: response.status
    };
  } catch (error) {
    console.error('❌ Report Retrieval Error:', error.message);
    
    if (error.response) {
      console.error('Response error:', error.response.status, error.response.data);
      return {
        success: false,
        error: `Report retrieval error: ${error.response.status}`
      };
    }

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Complete flow helper: Generate URL and track until report is ready
 * This is a convenience method that handles the entire flow
 * 
 * @param {number} userId - User ID
 * @param {number} applicationId - Application ID
 * @param {string} redirectUrl - Return URL after completion
 * @param {string} webhookUrl - Webhook callback URL
 * @param {string} mobileNum - User's mobile number (required)
 */
async function initiateBankStatementCollection(userId, applicationId, redirectUrl, webhookUrl, mobileNum) {
  if (!mobileNum) {
    return {
      success: false,
      error: 'Mobile number is required'
    };
  }

  const clientRefNum = generateClientRefNum(userId, applicationId);
  
  // Calculate date range (last 6 months)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 6);
  
  // Format dates as YYYY-MM-DD
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const startDateStr = formatDate(startDate);
  const endDateStr = formatDate(endDate);
  
  const result = await generateBankStatementURL({
    client_ref_num: clientRefNum,
    return_url: redirectUrl,
    txn_completed_cburl: webhookUrl,
    mobile_num: mobileNum,
    start_date: startDateStr,
    end_date: endDateStr,
    destination: 'accountaggregator'
  });

  if (result.success) {
    return {
      success: true,
      data: {
        ...result.data,
        client_ref_num: clientRefNum
      }
    };
  }

  return result;
}

module.exports = {
  generateBankStatementURL,
  uploadBankStatementPDF,
  checkBankStatementStatus,
  retrieveBankStatementReport,
  initiateBankStatementCollection,
  generateClientRefNum,
  startUploadAPI,
  uploadStatementAPI,
  getInstitutionList,
  completeUploadAPI
};

