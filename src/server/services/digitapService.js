const axios = require('axios');

const DIGITAP_API_URL = process.env.DIGITAP_API_URL || 'https://svcint.digitap.work/wrap/demo/svc/mobile_prefill/request';
const DIGITAP_API_KEY = process.env.DIGITAP_API_KEY || 'MjcxMDg3NTA6UlRwYzRpVjJUQnFNdFhKRWR6a1BhRG5CRDVZTk9BRkI='; // Default Basic auth

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
    // Validate mobile number format
    if (!mobileNumber || !/^[6-9]\d{9}$/.test(mobileNumber)) {
      return {
        success: false,
        error: 'Invalid mobile number format',
        allow_manual: true
      };
    }

    console.log(`Calling Digitap API for mobile: ${mobileNumber}`);

    const clientRefNum = generateClientRefNum();

    const response = await axios.post(
      DIGITAP_API_URL,
      {
        mobile_no: mobileNumber,
        client_ref_num: clientRefNum,
        name_lookup: 1
      },
      {
        headers: {
          'Authorization': `Basic ${DIGITAP_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000 // 15 seconds
      }
    );

    console.log('Digitap API response received:', response.data?.result_code);

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
      console.warn('Digitap API returned non-success result:', response.data?.message);
      return {
        success: false,
        error: response.data?.message || 'API returned unsuccessful response',
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

module.exports = {
  fetchUserPrefillData
};

