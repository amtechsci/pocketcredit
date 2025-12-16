const axios = require('axios');

// Digitap ClickWrap API configuration
const DIGITAP_BASE_URL = process.env.DIGITAP_BASE_URL || 'https://apidemo.digitap.work';
const DIGITAP_CLIENT_ID = process.env.DIGITAP_CLIENT_ID;
const DIGITAP_CLIENT_SECRET = process.env.DIGITAP_CLIENT_SECRET;
const DIGITAP_CLICKWRAP_DOC_CLASS_ID = process.env.DIGITAP_CLICKWRAP_DOC_CLASS_ID || 'EI1OTPxxxxx';

// API Endpoints
const ENDPOINTS = {
  INITIATE: '/clickwrap/v1/inate',
  SEND_SIGN_IN_LINK: '/clickwrap/v1/send/sign-in-link',
  GET_DOC_URL: '/clickwrap/v1/get-doc-url'
};

/**
 * Get base URL without trailing slash
 */
function getBaseUrl() {
  return DIGITAP_BASE_URL.replace(/\/+$/, '');
}

/**
 * Get authorization header for Digitap API
 * Format: Base64(client_id:client_secret)
 */
function getAuthHeader() {
  const credentials = `${DIGITAP_CLIENT_ID}:${DIGITAP_CLIENT_SECRET}`;
  const base64Credentials = Buffer.from(credentials).toString('base64');
  return `Basic ${base64Credentials}`;
}

/**
 * Initiate ClickWrap - Create transaction and get upload URL
 * @param {Object} params - Signer information
 * @param {string} params.fname - First name
 * @param {string} params.lname - Last name
 * @param {string} params.email - Email address
 * @param {string} params.mobile - Mobile number (10 digits, will be used for OTP)
 * @param {string} params.reason - Reason for signing (default: "security")
 * @returns {Promise<Object>} Response with uploadUrl, previewUrl, docTransactionId, entTransactionId
 */
async function initiateClickWrap(params) {
  try {
    const { fname, lname, email, mobile, reason = 'security' } = params;

    // Validate required fields
    if (!fname || !lname || !email || !mobile) {
      throw new Error('fname, lname, email, and mobile are required');
    }

    // Validate mobile format (10 digits)
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      throw new Error('Invalid mobile number format. Must be 10 digits starting with 6-9');
    }

    const requestBody = {
      docClassId: DIGITAP_CLICKWRAP_DOC_CLASS_ID,
      reason: reason,
      signersInfo: [
        {
          fname: fname,
          lname: lname,
          email: email,
          mobile: mobile,
          signerType: 'signer1'
        }
      ]
    };

    const apiUrl = `${getBaseUrl()}${ENDPOINTS.INITIATE}`;
    console.log('📤 Initiating Digitap ClickWrap:', apiUrl);
    console.log('📋 Request body:', JSON.stringify(requestBody, null, 2));

    const response = await axios.post(apiUrl, requestBody, {
      headers: {
        'ent_authorization': getAuthHeader(),
        'content-type': 'application/json'
      },
      timeout: 30000
    });

    console.log('📥 Digitap ClickWrap Initiate Response:', {
      code: response.data?.code,
      hasModel: !!response.data?.model
    });

    if (response.data && response.data.code === '200' && response.data.model) {
      return {
        success: true,
        data: {
          uploadUrl: response.data.model.uploadUrl,
          previewUrl: response.data.model.previewUrl,
          docTransactionId: response.data.model.docTransactionId,
          entTransactionId: response.data.model.entTransactionId
        }
      };
    } else {
      throw new Error(response.data?.message || 'Failed to initiate ClickWrap');
    }
  } catch (error) {
    console.error('❌ Digitap ClickWrap Initiate Error:', error.message);
    
    if (error.response) {
      console.error('Error response:', error.response.data);
      return {
        success: false,
        error: error.response.data?.message || error.message,
        statusCode: error.response.status
      };
    }

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Upload PDF document to Digitap S3 using presigned URL
 * @param {string} uploadUrl - Presigned S3 URL from initiateClickWrap
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @returns {Promise<Object>} Upload result
 */
async function uploadDocumentToDigitap(uploadUrl, pdfBuffer) {
  try {
    console.log('📤 Uploading PDF to Digitap S3...');
    console.log('   URL length:', uploadUrl.length);
    console.log('   PDF size:', pdfBuffer.length, 'bytes');

    const response = await axios.put(uploadUrl, pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf'
      },
      timeout: 60000, // 60 seconds for large files
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    console.log('✅ PDF uploaded successfully. Status:', response.status);
    return {
      success: true,
      statusCode: response.status
    };
  } catch (error) {
    console.error('❌ Error uploading PDF to Digitap:', error.message);
    
    if (error.response) {
      console.error('Upload error response:', error.response.status, error.response.data);
      return {
        success: false,
        error: `Upload failed: ${error.response.status}`,
        statusCode: error.response.status
      };
    }

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Send Sign-in Link - Trigger OTP flow
 * @param {string} docTransactionId - Transaction ID from initiateClickWrap
 * @param {boolean} sendNotification - Whether to send notification (default: false)
 * @returns {Promise<Object>} Response
 */
async function sendSignInLink(docTransactionId, sendNotification = false) {
  try {
    if (!docTransactionId) {
      throw new Error('docTransactionId is required');
    }

    const requestBody = {
      docTransactionId: docTransactionId,
      sendNotification: sendNotification
    };

    const apiUrl = `${getBaseUrl()}${ENDPOINTS.SEND_SIGN_IN_LINK}`;
    console.log('📤 Sending sign-in link:', apiUrl);
    console.log('📋 Request body:', JSON.stringify(requestBody, null, 2));

    const response = await axios.post(apiUrl, requestBody, {
      headers: {
        'ent_authorization': getAuthHeader(),
        'content-type': 'application/json'
      },
      timeout: 30000
    });

    console.log('📥 Sign-in link response:', {
      code: response.data?.code,
      status: response.status
    });

    if (response.data && (response.data.code === '200' || response.status === 200)) {
      return {
        success: true,
        message: 'Sign-in link sent successfully'
      };
    } else {
      throw new Error(response.data?.message || 'Failed to send sign-in link');
    }
  } catch (error) {
    console.error('❌ Error sending sign-in link:', error.message);
    
    if (error.response) {
      console.error('Error response:', error.response.data);
      return {
        success: false,
        error: error.response.data?.message || error.message,
        statusCode: error.response.status
      };
    }

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get Signed Document URL
 * @param {string} transactionId - Transaction ID (entTransactionId or docTransactionId)
 * @returns {Promise<Object>} Response with previewUrl and signed status
 */
async function getSignedDocumentUrl(transactionId) {
  try {
    if (!transactionId) {
      throw new Error('transactionId is required');
    }

    const requestBody = {
      transactionId: transactionId
    };

    const apiUrl = `${getBaseUrl()}${ENDPOINTS.GET_DOC_URL}`;
    console.log('📤 Getting signed document URL:', apiUrl);
    console.log('📋 Request body:', JSON.stringify(requestBody, null, 2));

    const response = await axios.post(apiUrl, requestBody, {
      headers: {
        'ent_authorization': getAuthHeader(),
        'content-type': 'application/json'
      },
      timeout: 30000
    });

    console.log('📥 Get document URL response:', {
      code: response.data?.code,
      hasModel: !!response.data?.model
    });

    if (response.data && response.data.code === 200 && response.data.model) {
      return {
        success: true,
        data: {
          previewUrl: response.data.model.previewUrl,
          signed: response.data.model.signed === true || response.data.model.signed === 'true'
        }
      };
    } else {
      throw new Error(response.data?.message || 'Failed to get signed document');
    }
  } catch (error) {
    console.error('❌ Error getting signed document:', error.message);
    
    if (error.response) {
      console.error('Error response:', error.response.data);
      return {
        success: false,
        error: error.response.data?.message || error.message,
        statusCode: error.response.status
      };
    }

    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  initiateClickWrap,
  uploadDocumentToDigitap,
  sendSignInLink,
  getSignedDocumentUrl
};

