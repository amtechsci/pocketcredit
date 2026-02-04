/**
 * OneXtel SMS Service
 * 
 * SMS API helper based on OneXtel API Documentation v1.1
 * Supports: Single SMS, Bulk SMS, Unicode SMS, Long SMS, JSON API
 * 
 * @see OneXtel API Documentation (October 2023)
 */

const fetch = require('node-fetch');

// OneXtel API Response Codes
const RESPONSE_CODES = {
  100: 'Message submitted successfully',
  200: 'Authentication failure',
  255: 'Blank Template ID',
  400: 'Unicode message but unicode value not set',
  500: 'Blank message',
  600: 'Blank/Invalid sender',
  700: 'Blank/Invalid recipient',
  800: 'Blank Entity ID',
  900: 'No data present'
};

class OneXtelSMSService {
  constructor(config = {}) {
    // Configuration from environment or passed config
    this.apiKey = config.apiKey || process.env.ONEXTEL_API_KEY;
    this.baseUrl = config.baseUrl || process.env.ONEXTEL_BASE_URL || 'http://apin.onex-aura.com';
    this.senderId = config.senderId || process.env.ONEXTEL_SENDER_ID || 'PKTCRD';
    this.entityId = config.entityId || process.env.ONEXTEL_ENTITY_ID;
    this.defaultTemplateId = config.defaultTemplateId || process.env.ONEXTEL_DEFAULT_TEMPLATE_ID;
    
    // Validate required configuration
    if (!this.apiKey) {
      console.warn('[OneXtel SMS] Warning: ONEXTEL_API_KEY not configured');
    }
    if (!this.entityId) {
      console.warn('[OneXtel SMS] Warning: ONEXTEL_ENTITY_ID not configured');
    }
  }

  /**
   * Validate mobile number (Indian format)
   * @param {string} mobile - Mobile number
   * @returns {boolean}
   */
  isValidMobile(mobile) {
    if (!mobile) return false;
    // Remove any spaces, dashes, or country code
    const cleaned = mobile.toString().replace(/[\s\-]/g, '').replace(/^(\+91|91)/, '');
    // Indian mobile: starts with 6-9, followed by 9 digits
    return /^[6-9]\d{9}$/.test(cleaned);
  }

  /**
   * Clean and format mobile number
   * @param {string} mobile - Mobile number
   * @returns {string}
   */
  formatMobile(mobile) {
    if (!mobile) return '';
    return mobile.toString().replace(/[\s\-]/g, '').replace(/^(\+91|91)/, '');
  }

  /**
   * Get human-readable error message from response code
   * @param {number} code - Response code
   * @returns {string}
   */
  getErrorMessage(code) {
    return RESPONSE_CODES[code] || `Unknown error (code: ${code})`;
  }

  /**
   * Send a single SMS
   * 
   * @param {Object} options - SMS options
   * @param {string} options.to - Recipient mobile number
   * @param {string} options.message - SMS message body
   * @param {string} [options.templateId] - Template ID (required by DLT)
   * @param {string} [options.senderId] - Sender ID (6 characters)
   * @param {string} [options.entityId] - Entity ID (DLT registered)
   * @param {boolean} [options.unicode=false] - Set true for non-English messages
   * @param {boolean} [options.flash=false] - Set true for flash SMS
   * @param {string} [options.custref] - Custom reference ID
   * @param {string} [options.scheduleTime] - Schedule time (format: 2018-09-01 11:10:00)
   * @returns {Promise<Object>} - API response
   */
  async sendSMS({
    to,
    message,
    templateId,
    senderId,
    entityId,
    unicode = false,
    flash = false,
    custref,
    scheduleTime
  }) {
    try {
      // Validate required fields
      if (!this.apiKey) {
        throw new Error('API key not configured. Set ONEXTEL_API_KEY environment variable.');
      }

      const mobile = this.formatMobile(to);
      if (!this.isValidMobile(mobile)) {
        return {
          success: false,
          status: 700,
          description: 'Invalid mobile number format',
          mobile: to
        };
      }

      if (!message || message.trim() === '') {
        return {
          success: false,
          status: 500,
          description: 'Message cannot be blank',
          mobile: to
        };
      }

      const finalEntityId = entityId || this.entityId;
      if (!finalEntityId) {
        return {
          success: false,
          status: 800,
          description: 'Entity ID is required',
          mobile: to
        };
      }

      const finalTemplateId = templateId || this.defaultTemplateId;
      if (!finalTemplateId) {
        return {
          success: false,
          status: 255,
          description: 'Template ID is required',
          mobile: to
        };
      }

      // Build URL parameters (using working format: no password, lowercase params)
      const params = new URLSearchParams({
        key: this.apiKey,
        to: mobile,
        from: senderId || this.senderId,
        body: message,
        entityid: finalEntityId,
        templateid: finalTemplateId
      });

      // Optional parameters
      if (unicode) params.append('unicode', '1');
      if (flash) params.append('flash', '1');
      if (custref) params.append('custref', custref);
      if (scheduleTime) params.append('time', scheduleTime);

      const url = `${this.baseUrl}/api/sms?${params.toString()}`;

      console.log(`[OneXtel SMS] Sending SMS to ${mobile}`);
      console.log(`[OneXtel SMS] URL: ${this.baseUrl}/api/sms?key=***&to=${mobile}&from=${senderId || this.senderId}&entityid=${finalEntityId}&templateid=${finalTemplateId}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Charset': 'UTF-8'
        }
      });

      const result = await response.json();

      // Check if successful (status 100)
      if (result.status === 100 || result.uid) {
        console.log(`[OneXtel SMS] SMS sent successfully to ${mobile}, UID: ${result.uid}`);
        return {
          success: true,
          status: 100,
          description: 'Message submitted successfully',
          uid: result.uid,
          mobile: mobile
        };
      }

      console.error(`[OneXtel SMS] Failed to send SMS to ${mobile}:`, result);
      return {
        success: false,
        status: result.status,
        description: result.description || this.getErrorMessage(result.status),
        mobile: mobile
      };

    } catch (error) {
      console.error('[OneXtel SMS] Error sending SMS:', error);
      return {
        success: false,
        status: -1,
        description: error.message,
        mobile: to
      };
    }
  }

  /**
   * Send bulk SMS to multiple recipients
   * 
   * @param {Object} options - Bulk SMS options
   * @param {Array<Object>} options.messages - Array of message objects
   * @param {string} options.messages[].to - Recipient mobile number
   * @param {string} options.messages[].message - SMS message body
   * @param {string} [options.messages[].templateId] - Template ID
   * @param {string} [options.messages[].clientsmsid] - Client SMS ID for tracking
   * @returns {Promise<Object>} - API response
   */
  async sendBulkSMS({ messages }) {
    try {
      if (!this.apiKey) {
        throw new Error('API key not configured. Set ONEXTEL_API_KEY environment variable.');
      }

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return {
          success: false,
          status: 700,
          description: 'No messages provided'
        };
      }

      // Build list of SMS
      const listsms = messages.map((msg, index) => {
        const mobile = this.formatMobile(msg.to);
        return {
          from: msg.senderId || this.senderId,
          to: mobile,
          body: msg.message,
          entityid: msg.entityId || this.entityId,
          templateid: msg.templateId || this.defaultTemplateId,
          ...(msg.clientsmsid && { clientsmsid: msg.clientsmsid })
        };
      });

      const payload = {
        key: this.apiKey,
        listsms
      };

      const url = `${this.baseUrl}/api/jsmslist`;

      console.log(`[OneXtel SMS] Sending bulk SMS to ${messages.length} recipients`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Charset': 'UTF-8'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (result.status === 100 || result.data) {
        console.log(`[OneXtel SMS] Bulk SMS sent successfully`);
        return {
          success: true,
          status: 100,
          description: 'Bulk messages submitted successfully',
          data: result.data || result
        };
      }

      console.error('[OneXtel SMS] Bulk SMS failed:', result);
      return {
        success: false,
        status: result.status,
        description: result.description || this.getErrorMessage(result.status)
      };

    } catch (error) {
      console.error('[OneXtel SMS] Error sending bulk SMS:', error);
      return {
        success: false,
        status: -1,
        description: error.message
      };
    }
  }

  /**
   * Send SMS using JSON API (POST with JSON body)
   * 
   * @param {Object} options - Same as sendSMS
   * @returns {Promise<Object>} - API response
   */
  async sendSMSJson({
    to,
    message,
    templateId,
    senderId,
    entityId
  }) {
    try {
      if (!this.apiKey) {
        throw new Error('API key not configured. Set ONEXTEL_API_KEY environment variable.');
      }

      const mobile = this.formatMobile(to);
      if (!this.isValidMobile(mobile)) {
        return {
          success: false,
          status: 700,
          description: 'Invalid mobile number format',
          mobile: to
        };
      }

      const payload = {
        key: this.apiKey,
        to: mobile,
        from: senderId || this.senderId,
        body: message,
        entityid: entityId || this.entityId,
        templateid: templateId || this.defaultTemplateId
      };

      const url = `${this.baseUrl}/api/jsms`;

      console.log(`[OneXtel SMS] Sending JSON SMS to ${mobile}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Charset': 'UTF-8'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (result.status === 100 || result.uid) {
        console.log(`[OneXtel SMS] JSON SMS sent successfully to ${mobile}, UID: ${result.uid}`);
        return {
          success: true,
          status: 100,
          description: 'Message submitted successfully',
          uid: result.uid,
          mobile: mobile
        };
      }

      console.error(`[OneXtel SMS] JSON SMS failed to ${mobile}:`, result);
      return {
        success: false,
        status: result.status,
        description: result.description || this.getErrorMessage(result.status),
        mobile: mobile
      };

    } catch (error) {
      console.error('[OneXtel SMS] Error sending JSON SMS:', error);
      return {
        success: false,
        status: -1,
        description: error.message,
        mobile: to
      };
    }
  }

  /**
   * Send Unicode SMS (non-English languages)
   * 
   * @param {Object} options - Same as sendSMS
   * @returns {Promise<Object>} - API response
   */
  async sendUnicodeSMS(options) {
    return this.sendSMS({ ...options, unicode: true });
  }

  /**
   * Pull delivery report for a sent SMS
   * 
   * @param {string} uid - Message ID from send SMS response
   * @returns {Promise<Object>} - Delivery report
   */
  async pullReport(uid) {
    try {
      if (!this.apiKey) {
        throw new Error('API key not configured');
      }

      if (!uid) {
        return {
          success: false,
          status: 900,
          description: 'Message UID is required'
        };
      }

      const url = `${this.baseUrl}/api/report?key=${this.apiKey}&uid=${uid}`;

      console.log(`[OneXtel SMS] Pulling report for UID: ${uid}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (result.status === 900) {
        return {
          success: false,
          status: 900,
          description: 'No data present'
        };
      }

      return {
        success: true,
        data: result
      };

    } catch (error) {
      console.error('[OneXtel SMS] Error pulling report:', error);
      return {
        success: false,
        status: -1,
        description: error.message
      };
    }
  }

  /**
   * Check account balance
   * 
   * @returns {Promise<Object>} - Balance information
   */
  async checkBalance() {
    try {
      if (!this.apiKey) {
        throw new Error('API key not configured');
      }

      const url = `${this.baseUrl}/api/bal?key=${this.apiKey}`;

      console.log('[OneXtel SMS] Checking balance');

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (result.status === 200) {
        return {
          success: false,
          status: 200,
          description: 'Authentication failure'
        };
      }

      return {
        success: true,
        balance: result.balance || result,
        data: result
      };

    } catch (error) {
      console.error('[OneXtel SMS] Error checking balance:', error);
      return {
        success: false,
        status: -1,
        description: error.message
      };
    }
  }

  /**
   * Get campaign summary report
   * 
   * @param {Object} options - Report options
   * @param {string} options.fromDate - Start date (format: YYYYMMDD)
   * @param {string} options.toDate - End date (format: YYYYMMDD)
   * @param {string} [options.campaignName] - Optional campaign name filter
   * @returns {Promise<Object>} - Campaign summary
   */
  async getCampaignSummary({ fromDate, toDate, campaignName }) {
    try {
      if (!this.apiKey) {
        throw new Error('API key not configured');
      }

      if (!fromDate || !toDate) {
        return {
          success: false,
          status: 400,
          description: 'fromDate and toDate are required'
        };
      }

      let url = `${this.baseUrl}/api/summary?key=${this.apiKey}&fromdate=${fromDate}&todate=${toDate}`;
      
      if (campaignName) {
        url += `&campaign_name=${encodeURIComponent(campaignName)}`;
      }

      console.log(`[OneXtel SMS] Getting campaign summary from ${fromDate} to ${toDate}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (result.status === 200) {
        return {
          success: false,
          status: 200,
          description: 'Authentication failure'
        };
      }

      return {
        success: true,
        data: result
      };

    } catch (error) {
      console.error('[OneXtel SMS] Error getting campaign summary:', error);
      return {
        success: false,
        status: -1,
        description: error.message
      };
    }
  }
}

// Create singleton instance
const smsService = new OneXtelSMSService();

// Export both the class and singleton instance
module.exports = {
  OneXtelSMSService,
  smsService,
  RESPONSE_CODES
};
