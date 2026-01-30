const axios = require('axios');

const DIGITAP_API_URL_MOBILE_PREFILL = process.env.DIGITAP_API_URL_MOBILE_PREFILL;
const DIGITAP_CLIENT_ID = process.env.DIGITAP_CLIENT_ID;
const DIGITAP_CLIENT_SECRET = process.env.DIGITAP_CLIENT_SECRET;

function getAuthHeader() {
  const credentials = `${DIGITAP_CLIENT_ID}:${DIGITAP_CLIENT_SECRET}`;
  const base64Credentials = Buffer.from(credentials).toString('base64');
  return `Basic ${base64Credentials}`;
}

/**
 * Get authentication token for Digitap/Digilocker APIs
 * Uses DIGILOCKER_AUTH_TOKEN if available, otherwise constructs from DIGITAP_CLIENT_ID/SECRET
 * @returns {string|null} - Base64 encoded auth token or null
 */
function getEntAuthToken() {
  // Try DIGILOCKER_AUTH_TOKEN first (same as Digilocker APIs)
  let authToken = process.env.DIGILOCKER_AUTH_TOKEN;
  
  // If not set, try to construct from DIGILOCKER_CLIENT_ID/SECRET
  if (!authToken && process.env.DIGILOCKER_CLIENT_ID && process.env.DIGILOCKER_CLIENT_SECRET) {
    const credentials = `${process.env.DIGILOCKER_CLIENT_ID}:${process.env.DIGILOCKER_CLIENT_SECRET}`;
    authToken = Buffer.from(credentials).toString('base64');
  }
  
  // Fallback to DIGITAP credentials if DIGILOCKER credentials not set
  if (!authToken && DIGITAP_CLIENT_ID && DIGITAP_CLIENT_SECRET) {
    const credentials = `${DIGITAP_CLIENT_ID}:${DIGITAP_CLIENT_SECRET}`;
    authToken = Buffer.from(credentials).toString('base64');
  }
  
  // Development fallback (only if not in production)
  if (!authToken && process.env.NODE_ENV !== 'production') {
    authToken = 'MjcxMDg3NTA6UlRwYzRpVjJUQnFNdFhKRWR6a1BhRG5CRDVZTk9BRkI=';
  }
  
  return authToken;
}

/**
 * Get authentication token for PAN validation API
 * Uses DIGITAP_API_KEY if available, otherwise falls back to DIGITAP_CLIENT_ID/SECRET
 * @returns {string|null} - Base64 encoded auth token or null
 */
function getPANValidationAuthToken() {
  // Try DIGITAP_API_KEY first (specific for PAN validation)
  let authToken = process.env.DIGITAP_API_KEY;
  
  // Fallback to DIGITAP credentials if API_KEY not set
  if (!authToken && DIGITAP_CLIENT_ID && DIGITAP_CLIENT_SECRET) {
    const credentials = `${DIGITAP_CLIENT_ID}:${DIGITAP_CLIENT_SECRET}`;
    authToken = Buffer.from(credentials).toString('base64');
  }
  
  // Development fallback (only if not in production)
  if (!authToken && process.env.NODE_ENV !== 'production') {
    authToken = 'MjU4NDU3MjE6bzBHSHVxVnlzZ1VLSjJMTlFDN0JCNDZhbWM1ckJxSDg=';
  }
  
  return authToken;
}

/**
 * Generate client reference number for Digitap API
 */
function generateClientRefNum() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `pocket-${timestamp}-${random}`;
}

/**
 * Fetch user prefill data from Digitap API
 * @param {string} mobileNumber - User's mobile number (10 digits)
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
async function fetchUserPrefillData(mobileNumber) {
  try {
    if (!mobileNumber || !/^[6-9]\d{9}$/.test(mobileNumber)) {
      return {
        success: false,
        error: 'Invalid mobile number format',
        allow_manual: true
      };
    }

    console.log(`Calling Digitap API for mobile: ${mobileNumber}`);
    console.log(`Using Digitap credentials - Client ID: ${DIGITAP_CLIENT_ID}`);
    console.log(`Authorization header: ${getAuthHeader()}`);

    const clientRefNum = generateClientRefNum();

    const response = await axios.post(
      DIGITAP_API_URL_MOBILE_PREFILL,
      {
        mobile_no: mobileNumber,
        client_ref_num: clientRefNum,
        name_lookup: 1
      },
      {
        headers: {
          'Authorization': getAuthHeader(),
          'Content-Type': 'application/json'
        },
        timeout: 15000 // 15 seconds
      }
    );

    console.log('Digitap API response received:', response.data?.result_code);
    console.log('Full Digitap response:', JSON.stringify(response.data, null, 2));

    // Check if response is successful (result_code 101 = success)
    if (response.data && response.data.result_code === 101 && response.data.result) {
      const result = response.data.result;

      return {
        success: true,
        data: {
          name: result.name,
          dob: result.dob, // Format: DD-MM-YYYY
          age: result.age,
          gender: result.gender,
          pan: result.pan,
          email: result.email,
          address: result.address || [],
          experian_score: result.score ? parseInt(result.score) : null
        }
      };
    } else {
      const resultCode = response.data?.result_code;
      const message = response.data?.message || 'API returned unsuccessful response';

      console.warn(`Digitap API returned non-success result_code: ${resultCode}`);
      console.warn(`Digitap message: ${message}`);

      // Common Digitap result codes:
      // 101 = Success
      // 102 = No data found
      // 103 = Invalid request
      // 104 = Rate limit exceeded

      return {
        success: false,
        error: `${message} (Code: ${resultCode})`,
        result_code: resultCode,
        allow_manual: true
      };
    }
  } catch (error) {
    console.error('Digitap API error:', error.message);

    // Handle specific error types
    if (error.code === 'ECONNABORTED') {
      return {
        success: false,
        error: 'Request timeout',
        allow_manual: true
      };
    }

    if (error.response) {
      // API responded with error status
      console.error('Digitap API error response:', error.response.status, error.response.data);
      return {
        success: false,
        error: `API error: ${error.response.status}`,
        allow_manual: true
      };
    }

    if (error.request) {
      // Request was made but no response
      return {
        success: false,
        error: 'No response from API',
        allow_manual: true
      };
    }

    // Other errors
    return {
      success: false,
      error: error.message,
      allow_manual: true
    };
  }
}

/**
 * Validate PAN and fetch details from Digitap API
 * @param {string} panNumber - PAN number (10 characters)
 * @param {string} clientRefNum - Client reference number
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
async function validatePANDetails(panNumber, clientRefNum = null) {
  try {
    // Validate PAN format
    if (!panNumber || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panNumber)) {
      return {
        success: false,
        error: 'Invalid PAN number format',
        allow_manual: true
      };
    }

    const refNum = clientRefNum || generateClientRefNum();
    
    // Use environment variable for PAN validation URL, with fallback
    // Production: https://api.digitap.ai/validation/kyc/v1/pan_details
    // Demo: https://svcint.digitap.work/wrap/demo/svc/validation/kyc/v1/pan_details
    const PAN_VALIDATION_URL = process.env.DIGITAP_PAN_VALIDATION_URL || 
      'https://api.digitap.ai/validation/kyc/v1/pan_details';

    console.log(`Calling Digitap PAN validation API for PAN: ${panNumber}`);
    console.log(`Client Ref Num: ${refNum}`);
    console.log(`PAN Validation URL: ${PAN_VALIDATION_URL}`);

    // Get authentication token for PAN validation (uses DIGITAP_API_KEY)
    const authToken = getPANValidationAuthToken();
    if (!authToken) {
      throw new Error('Authentication token not available. Please configure DIGITAP_API_KEY or DIGITAP_CLIENT_ID/SECRET');
    }
    
    // Debug: Log token source (first 20 chars only for security)
    console.log(`🔑 Auth token source: ${process.env.DIGITAP_API_KEY ? 'DIGITAP_API_KEY' : 
      (DIGITAP_CLIENT_ID ? 'DIGITAP_CLIENT_ID/SECRET' : 'Development fallback')}`);
    console.log(`🔑 Auth token (first 20 chars): ${authToken.substring(0, 20)}...`);

    const response = await axios.post(
      PAN_VALIDATION_URL,
      {
        pan: panNumber,
        father_name: "false",
        pan_display_name: "false",
        client_ref_num: refNum
      },
      {
        headers: {
          'Authorization': authToken,
          'Content-Type': 'application/json'
        },
        timeout: 15000 // 15 seconds
      }
    );

    console.log('PAN validation API response:', response.data?.result_code);
    console.log('Full PAN validation response:', JSON.stringify(response.data, null, 2));

    // Check if response is successful (result_code 101 = success)
    if (response.data && response.data.http_response_code === 200 && response.data.result_code === 101 && response.data.result) {
      const result = response.data.result;

      // Convert DOB from DD/MM/YYYY to YYYY-MM-DD
      let convertedDOB = null;
      if (result.dob) {
        try {
          const dobParts = result.dob.split('/'); // DD/MM/YYYY
          if (dobParts.length === 3) {
            convertedDOB = `${dobParts[2]}-${dobParts[1]}-${dobParts[0]}`; // YYYY-MM-DD
          }
        } catch (e) {
          console.error('DOB conversion error:', e);
        }
      }

      // Format address
      let addressArray = [];
      if (result.address) {
        addressArray = [{
          address_line1: result.address.building_name || '',
          address_line2: result.address.street_name || '',
          locality: result.address.locality || '',
          city: result.address.city || '',
          state: result.address.state || '',
          pincode: result.address.pincode || '',
          country: result.address.country || 'India',
          postal_code: result.address.pincode || ''
        }];
      }

      return {
        success: true,
        data: {
          name: result.fullname || result.name || '',
          first_name: result.first_name || '',
          middle_name: result.middle_name || '',
          last_name: result.last_name || '',
          dob: convertedDOB || result.dob || null,
          gender: result.gender ? result.gender.toLowerCase() : null,
          pan: result.pan || panNumber,
          pan_status: result.pan_status || result.status || result.panStatus || null,
          aadhaar_number: result.aadhaar_number || result.aadhaarNumber || null,
          aadhaar_linked: result.aadhaar_linked !== undefined ? result.aadhaar_linked : (result.aadhaarLinked !== undefined ? result.aadhaarLinked : false),
          aadhaar_seeding_status: result.aadhaar_seeding_status || result.aadhaar_seeding || result.aadhaarSeedingStatus || result.aadhaarSeeding || null,
          address: addressArray,
          mobile: result.mobile || null,
          email: result.email || null,
          pan_type: result.pan_type || result.panType || null
        }
      };
    } else {
      const resultCode = response.data?.result_code;
      const message = response.data?.message || 'API returned unsuccessful response';

      console.warn(`PAN validation API returned non-success result_code: ${resultCode}`);
      console.warn(`PAN validation message: ${message}`);

      return {
        success: false,
        error: `${message} (Code: ${resultCode})`,
        result_code: resultCode,
        allow_manual: true
      };
    }
  } catch (error) {
    console.error('PAN validation API error:', error.message);

    // Handle specific error types
    if (error.code === 'ECONNABORTED') {
      return {
        success: false,
        error: 'Request timeout',
        allow_manual: true
      };
    }

    if (error.response) {
      // API responded with error status
      const status = error.response.status;
      const errorData = error.response.data;
      console.error('PAN validation API error response:', status, errorData);
      
      // Provide more specific error messages
      if (status === 401) {
        return {
          success: false,
          error: 'Authentication failed. Please check API credentials configuration.',
          allow_manual: true
        };
      }
      
      if (status === 400) {
        const errorMsg = errorData?.error || errorData?.message || 'Invalid request';
        return {
          success: false,
          error: errorMsg,
          allow_manual: true
        };
      }
      
      return {
        success: false,
        error: `API error: ${status} - ${errorData?.error || errorData?.message || 'Unknown error'}`,
        allow_manual: true
      };
    }

    if (error.request) {
      // Request was made but no response
      return {
        success: false,
        error: 'No response from API',
        allow_manual: true
      };
    }

    // Other errors
    return {
      success: false,
      error: error.message,
      allow_manual: true
    };
  }
}

/**
 * UAN Basic V3 API Functions (Synchronous)
 */

/**
 * Get Basic Auth token for UAN Basic V3 API
 * Uses DIGITAP_UAN_AUTH_TOKEN if available, otherwise uses hardcoded production credentials
 */
function getUANBasicAuthToken() {
  // Try DIGITAP_UAN_AUTH_TOKEN first (should be base64 encoded credentials)
  let authToken = process.env.DIGITAP_UAN_AUTH_TOKEN;
  
  // Fallback to production credentials
  if (!authToken) {
    authToken = 'MjU4NDU3MjE6bzBHSHVxVnlzZ1VLSjJMTlFDN0JCNDZhbWM1ckJxSDg=';
  }
  
  return authToken;
}

/**
 * Generate client reference number for UAN API
 */
function generateUANClientRefNum(userId) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `ent-${userId}-${timestamp}-${random}`;
}

/**
 * UAN Basic V3 - Synchronous API call
 * @param {string} mobile - Mobile number
 * @param {string} clientRefNum - Client reference number
 * @param {string} pan - PAN number (required for API)
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
async function getUANBasic(mobile, clientRefNum, pan) {
  try {
    if (!mobile) {
      return {
        success: false,
        error: 'Mobile number is required'
      };
    }

    // Validate mobile number format
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      return {
        success: false,
        error: 'Invalid mobile number format. Must be 10 digits starting with 6-9.'
      };
    }

    // Validate PAN format - PAN is required for this API
    if (!pan) {
      return {
        success: false,
        error: 'PAN number is required for UAN lookup'
      };
    }

    const panUpper = pan.toUpperCase();
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panUpper)) {
      return {
        success: false,
        error: 'Invalid PAN number format'
      };
    }

    const authToken = getUANBasicAuthToken();
    console.log(`UAN Basic Auth token configured: ${authToken.substring(0, 20)}...`);

    // Use the correct production URL
    const url = 'https://svc.digitap.ai/cv/v3/uan_basic/sync';

    // Build request body with all required fields as per API spec
    const requestBody = {
      client_ref_num: String(clientRefNum),
      mobile: String(mobile),
      run_alternate_pan_flow: 0,
      pan: panUpper
    };

    console.log(`Calling UAN Basic V3 API: ${url}`);
    console.log(`Request body:`, JSON.stringify(requestBody, null, 2));
    console.log(`Authorization header: Basic ${authToken.substring(0, 20)}...`);

    const response = await axios.post(url, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authToken}`
      },
      timeout: 60000 // 60 seconds timeout for sync API
    });

    console.log(`UAN Basic V3 API Response Status: ${response.status}`);
    console.log(`UAN Basic V3 API Response:`, JSON.stringify(response.data, null, 2));

    if (response.status === 200) {
      const resultCode = response.data?.result_code;
      const httpResponseCode = response.data?.http_response_code || response.status;
      
      // Check if result is successful (101) - UAN Basic V3 returns result_code 101 for success
      if (resultCode === 101) {
        return {
          success: true,
          data: response.data
        };
      } else {
        // API returned 200 but with error result_code (e.g., 103 = No records found)
        return {
          success: false,
          error: response.data?.message || 'No records found',
          data: response.data,
          result_code: resultCode
        };
      }
    } else {
      return {
        success: false,
        error: response.data?.message || 'Failed to get UAN data',
        data: response.data
      };
    }
  } catch (error) {
    console.error('UAN Basic V3 API Error:', error.message);
    console.error('Error status:', error.response?.status);
    console.error('Error headers:', error.response?.headers);
    
    if (error.response) {
      // Try to parse HTML response or get JSON error
      let errorMessage = 'Internal Server Error';
      let errorData = error.response.data;
      
      // If response is HTML, try to extract useful info
      if (typeof error.response.data === 'string' && error.response.data.includes('<html>')) {
        errorMessage = `API returned ${error.response.status} error. Please check authentication configuration.`;
        errorData = { html_response: true, status: error.response.status };
      } else if (error.response.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response.data?.error_msg) {
        errorMessage = error.response.data.error_msg;
      } else if (error.response.status === 401) {
        errorMessage = 'Authentication failed. Please check API credentials.';
      } else if (error.response.status === 500) {
        errorMessage = 'Internal server error from API. Please verify credentials and request format.';
      }
      
      console.error('Response data:', error.response.data);
      return {
        success: false,
        error: errorMessage,
        data: errorData,
        status: error.response.status
      };
    }
    return {
      success: false,
      error: error.message || 'Network error occurred'
    };
  }
}

module.exports = {
  fetchUserPrefillData,
  validatePANDetails,
  getUANBasic,
  generateUANClientRefNum
};

