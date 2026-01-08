const axios = require('axios');

/**
 * Credit Analytics Service - Experian Credit Check via Digitap
 */

class CreditAnalyticsService {
  constructor() {
    this.apiUrl = process.env.CREDIT_ANALYTICS_API_URL || 'https://apidemo.digitap.work/credit_analytics/request';
    this.clientId = process.env.DIGITAP_CLIENT_ID;
    this.clientSecret = process.env.DIGITAP_CLIENT_SECRET;
    
    // Validate required configuration
    if (!this.clientId || !this.clientSecret) {
      console.warn('⚠️  DIGITAP_CLIENT_ID or DIGITAP_CLIENT_SECRET not configured. Credit check may fail.');
    }
  }

  /**
   * Generate Authorization header (Base64 encoded client_id:client_secret)
   */
  getAuthHeader() {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('DIGITAP_CLIENT_ID and DIGITAP_CLIENT_SECRET must be configured for credit checks');
    }
    const credentials = `${this.clientId}:${this.clientSecret}`;
    const base64Credentials = Buffer.from(credentials).toString('base64');
    return `Basic ${base64Credentials}`;
  }

  /**
   * Request Credit Report from Experian with retry logic for transient errors
   * @param {Object} data - User data for credit check
   * @param {Object} options - Retry options
   * @returns {Promise<Object>} Credit report response
   */
  async requestCreditReport(data, options = {}) {
    const {
      client_ref_num,
      mobile_no,
      first_name,
      last_name,
      date_of_birth, // Format: YYYY-MM-DD
      email,
      pan,
      device_ip = '192.168.1.1'
    } = data;

    const maxRetries = options.maxRetries || 3;
    const retryDelay = options.retryDelay || 2000; // 2 seconds base delay
    const retryableStatusCodes = options.retryableStatusCodes || [503, 502, 504, 429]; // Service unavailable, Bad gateway, Gateway timeout, Too many requests

    // Generate timestamp in required format: DDMMYYYY-HH:MM:SS
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timestamp = `${day}${month}${year}-${hours}:${minutes}:${seconds}`;

    // Format date_of_birth to YYYY-MM-DD
    let formattedDob = date_of_birth;
    if (date_of_birth) {
      // Check if already in YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(date_of_birth)) {
        formattedDob = date_of_birth;
      } else if (/^\d{2}-\d{2}-\d{4}$/.test(date_of_birth)) {
        // Convert from DD-MM-YYYY to YYYY-MM-DD
        const [day, month, year] = date_of_birth.split('-');
        formattedDob = `${year}-${month}-${day}`;
      } else {
        // Convert from ISO format to YYYY-MM-DD
        const dobDate = new Date(date_of_birth);
        const dobYear = dobDate.getFullYear();
        const dobMonth = String(dobDate.getMonth() + 1).padStart(2, '0');
        const dobDay = String(dobDate.getDate()).padStart(2, '0');
        formattedDob = `${dobYear}-${dobMonth}-${dobDay}`;
      }
    }

    // Ensure mobile number is 10 digits only (no country code)
    const formattedMobile = mobile_no.toString().replace(/^\+?91/, '').replace(/\D/g, '').slice(-10);

    // Normalize email - treat placeholder values and validate format
    let normalizedEmail = email;
    if (email) {
      const placeholderEmails = ['N/A', 'NA', 'n/a', 'na', 'NONE', 'none', 'NULL', 'null', ''];
      if (placeholderEmails.includes(email.trim().toUpperCase())) {
        normalizedEmail = null;
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        // Invalid email format - use null instead
        console.warn(`⚠️ Invalid email format: ${email}, using default`);
        normalizedEmail = null;
      }
    }
    
    // Use a valid default email format if email is null/invalid
    // Extract user ID from client_ref_num if possible (format: PC{userId}_{timestamp})
    const emailMatch = client_ref_num.match(/^PC(\d+)_/);
    const defaultEmail = emailMatch 
      ? `user${emailMatch[1]}@pocketcredit.in`
      : `user@pocketcredit.in`;

    const requestBody = {
      client_ref_num,
      mobile_no: formattedMobile,
      name_lookup: 0,
      first_name,
      last_name,
      date_of_birth: formattedDob, // YYYY-MM-DD format
      email: normalizedEmail || defaultEmail, // Use valid default email if null/invalid
      pan: pan.toUpperCase(), // Ensure PAN is uppercase
      consent_message: "I hereby authorize Experian to pull my credit report for loan application purpose",
      consent_acceptance: "yes",
      device_type: "web",
      otp: "123456", // Demo OTP
      timestamp,
      device_ip,
      report_type: "3" // Testing report_type 3
    };

    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          const delay = retryDelay * Math.pow(2, attempt - 2); // Exponential backoff
          console.log(`🔄 Retrying credit report request (attempt ${attempt}/${maxRetries}) after ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        console.log(`🔍 Requesting credit report for (attempt ${attempt}/${maxRetries}):`, { pan, mobile_no, client_ref_num });
        if (attempt === 1) {
          console.log('📋 Full request body:', JSON.stringify(requestBody, null, 2));
        }
        
        const response = await axios.post(this.apiUrl, requestBody, {
          headers: {
            'Authorization': this.getAuthHeader(),
            'Content-Type': 'application/json'
          },
          timeout: 30000 // 30 second timeout
        });

        console.log('✅ Credit report received:', {
          result_code: response.data.result_code,
          message: response.data.message,
          request_id: response.data.request_id
        });

        return response.data;
      } catch (error) {
        lastError = error;
        const statusCode = error.response?.status;
        const isRetryable = statusCode && retryableStatusCodes.includes(statusCode);
        
        console.error(`❌ Credit Analytics API error (attempt ${attempt}/${maxRetries}):`, {
          message: error.message,
          status: statusCode,
          response: error.response?.data,
          isRetryable: isRetryable && attempt < maxRetries
        });

        // If it's a retryable error and we have attempts left, continue to retry
        if (isRetryable && attempt < maxRetries) {
          continue;
        }

        // If it's not retryable or we've exhausted retries, throw the error
        // Enhance error message for service unavailable
        if (statusCode === 503) {
          const enhancedError = new Error('Credit Analytics service is temporarily unavailable. Please try again later.');
          enhancedError.status = 503;
          enhancedError.isServiceUnavailable = true;
          enhancedError.originalError = error;
          enhancedError.response = error.response;
          throw enhancedError;
        }

        // For other errors, throw as-is
        throw error;
      }
    }

    // If we've exhausted all retries, throw the last error
    if (lastError) {
      const enhancedError = new Error('Credit Analytics service is temporarily unavailable after multiple retry attempts. Please try again later.');
      enhancedError.status = lastError.response?.status || 503;
      enhancedError.isServiceUnavailable = true;
      enhancedError.originalError = lastError;
      enhancedError.response = lastError.response;
      throw enhancedError;
    }
  }

  /**
   * Parse credit score from API response
   */
  parseCreditScore(apiResponse) {
    try {
      const score = apiResponse?.result?.result_json?.INProfileResponse?.SCORE?.BureauScore;
      return score ? parseInt(score) : null;
    } catch (error) {
      console.error('Error parsing credit score:', error);
      return null;
    }
  }

  /**
   * Check for negative indicators (settlements, write-offs, suit files)
   */
  checkNegativeIndicators(apiResponse) {
    const indicators = {
      hasSettlements: false,
      hasWriteOffs: false,
      hasSuitFiles: false,
      hasWilfulDefault: false,
      details: []
    };

    try {
      const accounts = apiResponse?.result?.result_json?.INProfileResponse?.CAIS_Account?.CAIS_Account_DETAILS || [];

      accounts.forEach(account => {
        // Check for settlements
        if (account.Written_off_Settled_Status && account.Written_off_Settled_Status !== '00') {
          indicators.hasSettlements = true;
          indicators.details.push({
            type: 'Settlement',
            subscriber: account.Subscriber_Name,
            accountNumber: account.Account_Number,
            status: account.Written_off_Settled_Status
          });
        }

        // Check for write-offs
        if (account.Written_Off_Amt_Total && parseInt(account.Written_Off_Amt_Total) > 0) {
          indicators.hasWriteOffs = true;
          indicators.details.push({
            type: 'Write-off',
            subscriber: account.Subscriber_Name,
            accountNumber: account.Account_Number,
            amount: account.Written_Off_Amt_Total
          });
        }

        // Check for suit files / wilful default
        if (account.SuitFiled_WilfulDefault && account.SuitFiled_WilfulDefault !== '00') {
          indicators.hasSuitFiles = true;
          indicators.hasWilfulDefault = true;
          indicators.details.push({
            type: 'Suit Filed / Wilful Default',
            subscriber: account.Subscriber_Name,
            accountNumber: account.Account_Number,
            status: account.SuitFiled_WilfulDefault
          });
        }

        // Check special comment field
        if (account.Special_Comment) {
          indicators.details.push({
            type: 'Special Comment',
            subscriber: account.Subscriber_Name,
            accountNumber: account.Account_Number,
            comment: account.Special_Comment
          });
        }
      });

    } catch (error) {
      console.error('Error checking negative indicators:', error);
    }

    return indicators;
  }

  /**
   * Validate if user is eligible based on credit report
   */
  validateEligibility(apiResponse) {
    if (!apiResponse) {
      throw new Error('API response is required for eligibility validation');
    }

    let creditScore;
    let negativeIndicators;

    try {
      creditScore = this.parseCreditScore(apiResponse);
    } catch (error) {
      console.error('Error parsing credit score:', error);
      creditScore = null;
    }

    try {
      negativeIndicators = this.checkNegativeIndicators(apiResponse);
    } catch (error) {
      console.error('Error checking negative indicators:', error);
      negativeIndicators = {
        hasSettlements: false,
        hasWriteOffs: false,
        hasSuitFiles: false,
        hasWilfulDefault: false,
        details: []
      };
    }

    const validation = {
      isEligible: true,
      creditScore,
      reasons: [],
      negativeIndicators
    };

    // Rule 1: Credit score must be >= 630
    if (creditScore !== null && creditScore < 630) {
      validation.isEligible = false;
      validation.reasons.push(`Credit score ${creditScore} is below minimum requirement of 630`);
    }

    // Rule 2: No settlements (to be implemented later)
    // if (negativeIndicators.hasSettlements) {
    //   validation.isEligible = false;
    //   validation.reasons.push('Account has settlements');
    // }

    // Rule 3: No write-offs (to be implemented later)
    // if (negativeIndicators.hasWriteOffs) {
    //   validation.isEligible = false;
    //   validation.reasons.push('Account has write-offs');
    // }

    // Rule 4: No suit files / wilful default (to be implemented later)
    // if (negativeIndicators.hasSuitFiles || negativeIndicators.hasWilfulDefault) {
    //   validation.isEligible = false;
    //   validation.reasons.push('Account has suit files or wilful default');
    // }

    return validation;
  }

  /**
   * Extract PDF URL from credit report response
   * Checks multiple possible locations where PDF URL might be stored
   * @param {Object} apiResponse - The full API response
   * @returns {string|null} - PDF URL if found, null otherwise
   */
  extractPdfUrl(apiResponse) {
    if (!apiResponse || typeof apiResponse !== 'object') {
      return null;
    }

    // Check multiple possible locations - prioritize result_pdf field
    const possiblePaths = [
      // Primary location: result.result_pdf (for report_type "4")
      apiResponse?.result?.result_pdf,
      // Alternative locations
      apiResponse?.result?.model?.pdf_url,
      apiResponse?.result?.data?.pdf_url,
      apiResponse?.result?.pdf_url,
      apiResponse?.result?.model?.pdfUrl,
      apiResponse?.result?.data?.pdfUrl,
      apiResponse?.result?.pdfUrl,
      apiResponse?.model?.pdf_url,
      apiResponse?.data?.pdf_url,
      apiResponse?.pdf_url,
      apiResponse?.model?.pdfUrl,
      apiResponse?.data?.pdfUrl,
      apiResponse?.pdfUrl,
      apiResponse?.result?.result_json?.pdf_url,
      apiResponse?.result?.result_json?.pdfUrl,
      // Check nested in INProfileResponse
      apiResponse?.result?.result_json?.INProfileResponse?.pdf_url,
      apiResponse?.result?.result_json?.INProfileResponse?.pdfUrl,
    ];

    for (const url of possiblePaths) {
      if (url && typeof url === 'string' && url.trim().length > 0) {
        console.log('✅ PDF URL found:', url);
        return url.trim();
      }
    }

    // Log structure for debugging if PDF URL not found
    if (apiResponse.result) {
      const resultPdfValue = apiResponse.result.result_pdf;
      console.log('⚠️ PDF URL not found in response. Checking structure:', {
        hasResult: !!apiResponse.result,
        hasResultPdf: resultPdfValue !== undefined && resultPdfValue !== null,
        resultPdfValue: resultPdfValue,
        resultPdfType: typeof resultPdfValue,
        hasResultXml: !!apiResponse.result.result_xml,
        hasModel: !!apiResponse.result.model,
        hasData: !!apiResponse.result.data,
        resultKeys: Object.keys(apiResponse.result),
        topLevelKeys: Object.keys(apiResponse)
      });
      
      // If result_pdf exists but is null, log a warning
      if (apiResponse.result.hasOwnProperty('result_pdf') && resultPdfValue === null) {
        console.warn('⚠️ result_pdf field exists but is null. PDF may not be ready yet or may require a separate API call.');
      }
    }

    return null;
  }
}

module.exports = new CreditAnalyticsService();

