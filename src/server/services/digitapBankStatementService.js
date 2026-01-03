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

// Correct API Endpoints for Bank Statement
const ENDPOINTS = {
  GENERATE_URL: `${DIGITAP_BASE_URL}/bank-data/generateurl`,
  UPLOAD_PDF: `${DIGITAP_BASE_URL}/bank-data/uploadpdf`, // Try uploadpdf instead of upload
  UPLOAD_PDF_ALT: `${DIGITAP_BASE_URL}/bank-data/upload`, // Fallback to original
  STATUS_CHECK: `${DIGITAP_BASE_URL}/bank-data/statuscheck`,
  RETRIEVE_REPORT: `${DIGITAP_BASE_URL}/bank-data/retrievereport`
};

/**
 * Generate Base64 encoded authorization header
 */
function getAuthHeader() {
  const credentials = `${DIGITAP_CLIENT_ID}:${DIGITAP_CLIENT_SECRET}`;
  const base64Credentials = Buffer.from(credentials).toString('base64');
  return `Basic ${base64Credentials}`;
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
 * Upload Bank Statement PDF directly to Digitap
 * Bypasses the UI flow and uploads PDFs for analysis
 * 
 * @param {Object} params
 * @param {string} params.mobile_no - Customer mobile number
 * @param {string} params.client_ref_num - Unique reference number
 * @param {Buffer} params.file_buffer - PDF file buffer
 * @param {string} params.file_name - Original filename
 * @param {string} params.bank_name - Bank name (optional)
 * @param {string} params.password - PDF password if encrypted (optional)
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
async function uploadBankStatementPDF(params) {
  try {
    const FormData = require('form-data');
    
    const {
      mobile_no,
      client_ref_num,
      file_buffer,
      file_name,
      bank_name,
      password
    } = params;

    if (!mobile_no || !client_ref_num || !file_buffer) {
      return {
        success: false,
        error: 'Missing required parameters'
      };
    }

    console.log(`📤 Uploading PDF to Digitap: ${file_name}`);
    console.log(`📤 Digitap Upload Endpoint: ${ENDPOINTS.UPLOAD_PDF}`);
    console.log(`📤 Base URL: ${DIGITAP_BASE_URL}`);

    const formData = new FormData();
    formData.append('mobile_no', mobile_no);
    formData.append('client_ref_num', client_ref_num);
    formData.append('file', file_buffer, file_name);
    
    if (bank_name) {
      formData.append('bank_name', bank_name);
    }
    
    if (password) {
      formData.append('password', password);
    }

    // Try primary endpoint first, then fallback to alternative
    let response;
    let lastError;
    
    try {
      response = await axios.post(
        ENDPOINTS.UPLOAD_PDF,
        formData,
        {
          headers: {
            'Authorization': getAuthHeader(),
            ...formData.getHeaders()
          },
          timeout: 30000, // 30 seconds for file upload
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );
    } catch (error) {
      // If 404, try alternative endpoint
      if (error.response && error.response.status === 404 && ENDPOINTS.UPLOAD_PDF_ALT) {
        console.log(`⚠️  Primary endpoint failed (404), trying alternative: ${ENDPOINTS.UPLOAD_PDF_ALT}`);
        lastError = error;
        try {
          response = await axios.post(
            ENDPOINTS.UPLOAD_PDF_ALT,
            formData,
            {
              headers: {
                'Authorization': getAuthHeader(),
                ...formData.getHeaders()
              },
              timeout: 30000,
              maxContentLength: Infinity,
              maxBodyLength: Infinity
            }
          );
        } catch (altError) {
          // Both endpoints failed, throw the original error
          throw lastError;
        }
      } else {
        throw error;
      }
    }

    console.log('✅ Digitap Upload Response:', response.data?.result_code);

    if (response.data && response.data.result_code === 101) {
      return {
        success: true,
        data: {
          client_ref_num: response.data.result?.client_ref_num,
          status: response.data.result?.status,
          message: response.data.message
        }
      };
    } else {
      return {
        success: false,
        error: response.data?.message || 'Upload failed',
        result_code: response.data?.result_code
      };
    }
  } catch (error) {
    console.error('❌ Digitap PDF Upload Error:', error.message);
    console.error('❌ Request URL:', ENDPOINTS.UPLOAD_PDF);
    console.error('❌ Base URL:', DIGITAP_BASE_URL);
    
    if (error.response) {
      console.error('❌ Response Status:', error.response.status);
      console.error('❌ Response Headers:', error.response.headers);
      console.error('❌ Response Data:', error.response.data);
      return {
        success: false,
        error: `Upload error: ${error.response.status} - ${error.response.data?.message || error.response.data || 'Unknown error'}`,
        status: error.response.status,
        responseData: error.response.data
      };
    }

    if (error.request) {
      console.error('❌ Request made but no response received');
      console.error('❌ Request config:', error.config?.url);
    }

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

    console.log(`🔍 Checking status for request_id: ${request_id}`);

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

    console.log('✅ Status Check Response:', JSON.stringify(response.data, null, 2));

    if (response.data && response.data.status === 'success') {
      const txnStatus = response.data.txn_status || [];
      
      // Check transaction statuses (Digitap uses: Completed, InProgress, Failure)
      const allCompleted = txnStatus.every(txn => txn.status === 'Completed');
      const anyInProgress = txnStatus.some(txn => txn.status === 'InProgress');
      const anyFailed = txnStatus.some(txn => txn.status === 'Failure' || txn.status === 'Failed');

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

    // Build request body - use txn_id if provided, otherwise use client_ref_num
    // API expects: txn_id OR client_ref_num (not both), report_type, report_subtype
    // When txn_id is provided, ONLY send txn_id (not client_ref_num)
    const requestBody = {
      report_type: format || 'json',
      report_subtype: 'type3'
    };
    
    if (txn_id) {
      // When txn_id is provided, ONLY use txn_id (API doesn't allow both)
      requestBody.txn_id = txn_id;
    } else if (client_ref_num) {
      // Only use client_ref_num if txn_id is not available
      requestBody.client_ref_num = client_ref_num;
    }

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
  generateClientRefNum
};

