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
    const PAN_VALIDATION_URL = 'https://svcint.digitap.work/wrap/demo/svc/validation/kyc/v1/pan_details';

    console.log(`Calling Digitap PAN validation API for PAN: ${panNumber}`);
    console.log(`Client Ref Num: ${refNum}`);

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
          'Authorization': getAuthHeader(),
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
          name: result.fullname || '',
          first_name: result.first_name || '',
          middle_name: result.middle_name || '',
          last_name: result.last_name || '',
          dob: convertedDOB || result.dob || null,
          gender: result.gender ? result.gender.toLowerCase() : null,
          pan: result.pan || panNumber,
          aadhaar_number: result.aadhaar_number || null,
          aadhaar_linked: result.aadhaar_linked || false,
          address: addressArray,
          mobile: result.mobile || null,
          email: result.email || null,
          pan_type: result.pan_type || null
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
      console.error('PAN validation API error response:', error.response.status, error.response.data);
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
  fetchUserPrefillData,
  validatePANDetails
};

