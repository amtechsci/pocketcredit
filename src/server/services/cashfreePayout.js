/**
 * Cashfree Payout API Service
 * Comprehensive backend helper for Cashfree Payout API v2
 * Handles loan disbursement transfers to beneficiary bank accounts
 * 
 * API Documentation: https://www.cashfree.com/docs/payouts/payouts/introduction
 * Base URL: 
 * - Production: https://api.cashfree.com/payout
 * - Sandbox: https://sandbox.cashfree.com/payout
 * 
 * Features:
 * - Beneficiary Management (add, get, list, delete, verify)
 * - Transfer Operations (standard, instant, bulk)
 * - Balance & Account Information
 * - Transaction History & Status
 * - Webhook Verification
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

class CashfreePayoutService {
    constructor() {
        // Payout API uses different base URL from Payment Gateway
        // But same credentials (Client ID and Secret)
        this.clientId = process.env.CASHFREE_CLIENT_ID;
        this.clientSecret = process.env.CASHFREE_CLIENT_SECRET;
        
        // Payout API Base URL (different from payment gateway)
        // Production: https://api.cashfree.com/payout
        // Sandbox: https://sandbox.cashfree.com/payout
        this.baseURL = process.env.CASHFREE_PAYOUT_API_BASE || 
                      (process.env.CASHFREE_API_BASE?.replace('/pg', '/payout') || 'https://sandbox.cashfree.com/payout');
        
        // If CASHFREE_API_BASE is set but doesn't contain /payout, construct it
        if (process.env.CASHFREE_API_BASE && !this.baseURL.includes('/payout')) {
            // Convert https://api.cashfree.com/pg to https://api.cashfree.com/payout
            const baseFromPG = process.env.CASHFREE_API_BASE.replace('/pg', '/payout');
            this.baseURL = baseFromPG;
        }
        
        // Default to v2 API version if not specified (latest recommended version)
        this.apiVersion = process.env.CASHFREE_PAYOUT_API_VERSION || '2024-01-01';
        this.nodeEnv = process.env.NODE_ENV || 'development';
        
        // Detect if we're using production API
        this.isProduction = this.baseURL.includes('api.cashfree.com') && 
                           !this.baseURL.includes('sandbox');
        
        // Log environment for debugging
        if (!this.isProduction && this.nodeEnv === 'production') {
            console.warn('⚠️  WARNING: Using sandbox Payout API in production environment!');
            console.warn('   Set CASHFREE_PAYOUT_API_BASE=https://api.cashfree.com/payout for production');
        }

        // Validate configuration
        if (!this.clientId || !this.clientSecret) {
            console.warn('⚠️  WARNING: Cashfree payout credentials not configured');
            if (this.nodeEnv === 'production') {
                console.error('❌ ERROR: Cashfree credentials are required in production!');
            }
        } else {
            console.log(`[CashfreePayout] Initialized - Environment: ${this.isProduction ? 'PRODUCTION' : 'SANDBOX'}`);
            console.log(`[CashfreePayout] API Base: ${this.baseURL}`);
            console.log(`[CashfreePayout] API Version: ${this.apiVersion}`);
        }

        // Axios instance with defaults
        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: 30000, // 30 second timeout
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Add request interceptor for logging
        this.client.interceptors.request.use(
            (config) => {
                console.log(`[CashfreePayout] ${config.method.toUpperCase()} ${config.url}`);
                return config;
            },
            (error) => {
                console.error('[CashfreePayout] Request error:', error);
                return Promise.reject(error);
            }
        );
    }

    /**
     * Get common headers for Cashfree Payout API
     * Note: Payout API uses x-client-id and x-client-secret (same as Payment Gateway)
     * @param {string} idempotencyKey - Optional idempotency key
     * @param {Object} additionalHeaders - Additional headers to include
     * @returns {Object} Headers object
     */
    getHeaders(idempotencyKey = null, additionalHeaders = {}) {
        const headers = {
            'x-client-id': this.clientId,
            'x-client-secret': this.clientSecret,
            'x-api-version': this.apiVersion,
            'Content-Type': 'application/json',
            'x-request-id': uuidv4(),
            ...additionalHeaders
        };
        
        if (idempotencyKey) {
            headers['x-idempotency-key'] = idempotencyKey;
        }
        
        return headers;
    }

    // ==================== BENEFICIARY MANAGEMENT ====================

    /**
     * Create/Add a beneficiary (v1 endpoint - backward compatible)
     * @param {Object} beneficiaryData - Beneficiary details
     * @returns {Promise<Object>} - Beneficiary creation response
     */
    async createBeneficiary(beneficiaryData) {
        const {
            beneId,
            name,
            email,
            phone,
            bankAccount,
            ifsc,
            address1,
            address2,
            city,
            state,
            pincode,
            vpa // VPA for UPI transfers
        } = beneficiaryData;

        // Validate required fields
        if (!beneId || !name || !phone) {
            throw new Error('Missing required fields: beneId, name, phone are required');
        }

        // Either bankAccount+ifsc OR vpa is required
        if (!bankAccount && !ifsc && !vpa) {
            throw new Error('Either bankAccount+ifsc OR vpa is required');
        }

        const payload = {
            beneId: beneId,
            name: name,
            email: email || '',
            phone: phone,
            address1: address1 || '',
            address2: address2 || '',
            city: city || '',
            state: state || '',
            pincode: pincode || ''
        };

        // Add bank account details if provided
        if (bankAccount && ifsc) {
            payload.bankAccount = bankAccount;
            payload.ifsc = ifsc;
        }

        // Add VPA if provided (for UPI)
        if (vpa) {
            payload.vpa = vpa;
        }

        try {
            console.log(`[CashfreePayout] Creating beneficiary: ${beneId}`);
            const response = await axios.post(
                `${this.baseURL}/v1/addBeneficiary`,
                payload,
                { 
                    headers: this.getHeaders(beneId),
                    timeout: 30000
                }
            );

            console.log(`[CashfreePayout] Beneficiary created: ${beneId}`, {
                status: response.data?.status,
                message: response.data?.message
            });

            return {
                success: true,
                data: response.data,
                beneId: beneId
            };
        } catch (error) {
            console.error('[CashfreePayout] Error creating beneficiary:', {
                beneId,
                error: error.response?.data || error.message,
                status: error.response?.status
            });

            // Enhance error with specific messages
            const enhancedError = this._enhanceError(error, 'beneficiary creation');
            throw enhancedError;
        }
    }

    /**
     * Get beneficiary details
     * @param {string} beneId - Beneficiary ID
     * @returns {Promise<Object>} - Beneficiary details
     */
    async getBeneficiary(beneId) {
        if (!beneId) {
            throw new Error('beneId is required');
        }

        try {
            const response = await axios.get(
                `${this.baseURL}/v1/getBeneficiary/${beneId}`,
                { 
                    headers: this.getHeaders(),
                    timeout: 30000
                }
            );

            return {
                success: true,
                data: response.data,
                beneId: beneId
            };
        } catch (error) {
            console.error(`[CashfreePayout] Error fetching beneficiary ${beneId}:`, error.response?.data || error.message);
            const enhancedError = this._enhanceError(error, 'fetching beneficiary');
            throw enhancedError;
        }
    }

    /**
     * List all beneficiaries with pagination
     * @param {Object} options - Query options
     * @param {number} options.page - Page number (default: 1)
     * @param {number} options.limit - Items per page (default: 10, max: 100)
     * @returns {Promise<Object>} - List of beneficiaries
     */
    async listBeneficiaries(options = {}) {
        const { page = 1, limit = 10 } = options;
        
        try {
            const response = await axios.get(
                `${this.baseURL}/v1/getBeneficiaries`,
                {
                    params: {
                        page: page,
                        limit: Math.min(limit, 100) // Max 100 per page
                    },
                    headers: this.getHeaders(),
                    timeout: 30000
                }
            );

            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('[CashfreePayout] Error listing beneficiaries:', error.response?.data || error.message);
            const enhancedError = this._enhanceError(error, 'listing beneficiaries');
            throw enhancedError;
        }
    }

    /**
     * Delete a beneficiary
     * @param {string} beneId - Beneficiary ID
     * @returns {Promise<Object>} - Deletion response
     */
    async deleteBeneficiary(beneId) {
        if (!beneId) {
            throw new Error('beneId is required');
        }

        try {
            const response = await axios.delete(
                `${this.baseURL}/v1/removeBeneficiary/${beneId}`,
                { 
                    headers: this.getHeaders(),
                    timeout: 30000
                }
            );

            console.log(`[CashfreePayout] Beneficiary deleted: ${beneId}`);

            return {
                success: true,
                data: response.data,
                beneId: beneId
            };
        } catch (error) {
            console.error(`[CashfreePayout] Error deleting beneficiary ${beneId}:`, error.response?.data || error.message);
            const enhancedError = this._enhanceError(error, 'deleting beneficiary');
            throw enhancedError;
        }
    }

    /**
     * Verify beneficiary bank account details
     * @param {Object} verifyData - Verification details
     * @param {string} verifyData.beneId - Beneficiary ID
     * @param {string} verifyData.bankAccount - Bank account number
     * @param {string} verifyData.ifsc - IFSC code
     * @returns {Promise<Object>} - Verification response
     */
    async verifyBeneficiary(verifyData) {
        const { beneId, bankAccount, ifsc } = verifyData;

        if (!beneId || !bankAccount || !ifsc) {
            throw new Error('Missing required fields: beneId, bankAccount, ifsc are required');
        }

        try {
            const response = await axios.post(
                `${this.baseURL}/v1/validation/bankDetails`,
                {
                    beneId: beneId,
                    bankAccount: bankAccount,
                    ifsc: ifsc
                },
                { 
                    headers: this.getHeaders(),
                    timeout: 30000
                }
            );

            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('[CashfreePayout] Error verifying beneficiary:', error.response?.data || error.message);
            const enhancedError = this._enhanceError(error, 'verifying beneficiary');
            throw enhancedError;
        }
    }

    // ==================== TRANSFER OPERATIONS ====================

    /**
     * Initiate a standard payout/transfer to beneficiary (NEFT/IMPS/RTGS)
     * @param {Object} transferData - Transfer details
     * @returns {Promise<Object>} - Transfer response
     */
    async initiateTransfer(transferData) {
        const {
            transferId,
            beneId,
            amount,
            transferMode = 'NEFT', // NEFT, IMPS, RTGS, UPI
            remarks = '',
            transferMeta = {}
        } = transferData;

        // Validate required fields
        if (!transferId || !beneId || !amount) {
            throw new Error('Missing required fields: transferId, beneId, amount are required');
        }

        // Validate transfer mode
        const validModes = ['NEFT', 'IMPS', 'RTGS', 'UPI'];
        if (!validModes.includes(transferMode.toUpperCase())) {
            throw new Error(`Invalid transfer mode. Must be one of: ${validModes.join(', ')}`);
        }

        const payload = {
            beneId: beneId,
            amount: parseFloat(amount).toFixed(2),
            transferId: transferId,
            transferMode: transferMode.toUpperCase(),
            remarks: remarks || `Transfer ${transferId}`
        };

        // Add transfer metadata if provided
        if (Object.keys(transferMeta).length > 0) {
            payload.transferMeta = transferMeta;
        }

        try {
            console.log(`[CashfreePayout] Initiating transfer: ${transferId}`, {
                beneId,
                amount,
                transferMode,
                environment: this.isProduction ? 'PRODUCTION' : 'SANDBOX'
            });

            const response = await axios.post(
                `${this.baseURL}/v1/standardTransfer`,
                payload,
                { 
                    headers: this.getHeaders(transferId),
                    timeout: 30000
                }
            );

            console.log(`[CashfreePayout] Transfer initiated: ${transferId}`, {
                status: response.data?.status,
                message: response.data?.message,
                referenceId: response.data?.referenceId || response.data?.utr
            });

            return {
                success: true,
                data: response.data,
                transferId: transferId,
                referenceId: response.data?.referenceId || response.data?.utr || null,
                status: response.data?.status || 'PENDING'
            };
        } catch (error) {
            console.error('[CashfreePayout] Error initiating transfer:', {
                transferId,
                error: error.response?.data || error.message,
                status: error.response?.status
            });

            const enhancedError = this._enhanceError(error, 'transfer initiation');
            throw enhancedError;
        }
    }

    /**
     * Initiate an instant transfer (faster but may have higher charges)
     * @param {Object} transferData - Transfer details
     * @returns {Promise<Object>} - Transfer response
     */
    async initiateInstantTransfer(transferData) {
        const {
            transferId,
            beneId,
            amount,
            transferMode = 'IMPS', // IMPS or UPI for instant
            remarks = '',
            transferMeta = {}
        } = transferData;

        // Validate required fields
        if (!transferId || !beneId || !amount) {
            throw new Error('Missing required fields: transferId, beneId, amount are required');
        }

        const payload = {
            beneId: beneId,
            amount: parseFloat(amount).toFixed(2),
            transferId: transferId,
            transferMode: transferMode.toUpperCase(),
            remarks: remarks || `Instant transfer ${transferId}`
        };

        // Add transfer metadata if provided
        if (Object.keys(transferMeta).length > 0) {
            payload.transferMeta = transferMeta;
        }

        try {
            console.log(`[CashfreePayout] Initiating instant transfer: ${transferId}`, {
                beneId,
                amount,
                transferMode
            });

            const response = await axios.post(
                `${this.baseURL}/v1/instantTransfer`,
                payload,
                { 
                    headers: this.getHeaders(transferId),
                    timeout: 30000
                }
            );

            console.log(`[CashfreePayout] Instant transfer initiated: ${transferId}`, {
                status: response.data?.status,
                referenceId: response.data?.referenceId || response.data?.utr
            });

            return {
                success: true,
                data: response.data,
                transferId: transferId,
                referenceId: response.data?.referenceId || response.data?.utr || null,
                status: response.data?.status || 'PENDING'
            };
        } catch (error) {
            console.error('[CashfreePayout] Error initiating instant transfer:', {
                transferId,
                error: error.response?.data || error.message
            });

            const enhancedError = this._enhanceError(error, 'instant transfer initiation');
            throw enhancedError;
        }
    }

    /**
     * Initiate bulk transfers (multiple transfers in one request)
     * @param {Object} bulkData - Bulk transfer details
     * @param {string} bulkData.bulkTransferId - Unique bulk transfer ID
     * @param {Array} bulkData.transfers - Array of transfer objects
     * @returns {Promise<Object>} - Bulk transfer response
     */
    async initiateBulkTransfer(bulkData) {
        const { bulkTransferId, transfers } = bulkData;

        if (!bulkTransferId || !Array.isArray(transfers) || transfers.length === 0) {
            throw new Error('Missing required fields: bulkTransferId and transfers array are required');
        }

        // Validate each transfer
        transfers.forEach((transfer, index) => {
            if (!transfer.transferId || !transfer.beneId || !transfer.amount) {
                throw new Error(`Transfer at index ${index} is missing required fields: transferId, beneId, amount`);
            }
        });

        const payload = {
            bulkTransferId: bulkTransferId,
            transfers: transfers.map(t => ({
                transferId: t.transferId,
                beneId: t.beneId,
                amount: parseFloat(t.amount).toFixed(2),
                transferMode: (t.transferMode || 'NEFT').toUpperCase(),
                remarks: t.remarks || `Bulk transfer - ${t.transferId}`
            }))
        };

        try {
            console.log(`[CashfreePayout] Initiating bulk transfer: ${bulkTransferId}`, {
                transferCount: transfers.length
            });

            const response = await axios.post(
                `${this.baseURL}/v1/bulkTransfer`,
                payload,
                { 
                    headers: this.getHeaders(bulkTransferId),
                    timeout: 60000 // 60 seconds for bulk operations
                }
            );

            console.log(`[CashfreePayout] Bulk transfer initiated: ${bulkTransferId}`, {
                status: response.data?.status,
                successCount: response.data?.data?.filter(t => t.status === 'SUCCESS').length,
                failureCount: response.data?.data?.filter(t => t.status === 'FAILED').length
            });

            return {
                success: true,
                data: response.data,
                bulkTransferId: bulkTransferId
            };
        } catch (error) {
            console.error('[CashfreePayout] Error initiating bulk transfer:', {
                bulkTransferId,
                error: error.response?.data || error.message
            });

            const enhancedError = this._enhanceError(error, 'bulk transfer initiation');
            throw enhancedError;
        }
    }

    /**
     * Get transfer status
     * @param {string} transferId - Transfer ID
     * @returns {Promise<Object>} - Transfer status
     */
    async getTransferStatus(transferId) {
        if (!transferId) {
            throw new Error('transferId is required');
        }

        try {
            const response = await axios.get(
                `${this.baseURL}/v1/getTransferStatus`,
                {
                    params: { transferId: transferId },
                    headers: this.getHeaders(),
                    timeout: 30000
                }
            );

            return {
                success: true,
                data: response.data,
                transferId: transferId,
                status: response.data?.status || 'UNKNOWN'
            };
        } catch (error) {
            console.error(`[CashfreePayout] Error fetching transfer status ${transferId}:`, error.response?.data || error.message);
            const enhancedError = this._enhanceError(error, 'fetching transfer status');
            throw enhancedError;
        }
    }

    /**
     * Get bulk transfer status
     * @param {string} bulkTransferId - Bulk Transfer ID
     * @returns {Promise<Object>} - Bulk transfer status
     */
    async getBulkTransferStatus(bulkTransferId) {
        if (!bulkTransferId) {
            throw new Error('bulkTransferId is required');
        }

        try {
            const response = await axios.get(
                `${this.baseURL}/v1/getBulkTransferStatus`,
                {
                    params: { bulkTransferId: bulkTransferId },
                    headers: this.getHeaders(),
                    timeout: 30000
                }
            );

            return {
                success: true,
                data: response.data,
                bulkTransferId: bulkTransferId
            };
        } catch (error) {
            console.error(`[CashfreePayout] Error fetching bulk transfer status ${bulkTransferId}:`, error.response?.data || error.message);
            const enhancedError = this._enhanceError(error, 'fetching bulk transfer status');
            throw enhancedError;
        }
    }

    // ==================== BALANCE & ACCOUNT INFO ====================

    /**
     * Get account balance
     * @returns {Promise<Object>} - Account balance information
     */
    async getBalance() {
        try {
            const response = await axios.get(
                `${this.baseURL}/v1/getBalance`,
                { 
                    headers: this.getHeaders(),
                    timeout: 30000
                }
            );

            return {
                success: true,
                data: response.data,
                balance: response.data?.balance || 0
            };
        } catch (error) {
            console.error('[CashfreePayout] Error fetching balance:', error.response?.data || error.message);
            const enhancedError = this._enhanceError(error, 'fetching balance');
            throw enhancedError;
        }
    }

    /**
     * Get account information
     * @returns {Promise<Object>} - Account information
     */
    async getAccountInfo() {
        try {
            const response = await axios.get(
                `${this.baseURL}/v1/getAccountInfo`,
                { 
                    headers: this.getHeaders(),
                    timeout: 30000
                }
            );

            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('[CashfreePayout] Error fetching account info:', error.response?.data || error.message);
            const enhancedError = this._enhanceError(error, 'fetching account info');
            throw enhancedError;
        }
    }

    // ==================== TRANSACTION HISTORY ====================

    /**
     * Get transfer history with filters
     * @param {Object} filters - Filter options
     * @param {string} filters.fromDate - Start date (YYYY-MM-DD)
     * @param {string} filters.toDate - End date (YYYY-MM-DD)
     * @param {number} filters.page - Page number (default: 1)
     * @param {number} filters.limit - Items per page (default: 10, max: 100)
     * @param {string} filters.status - Filter by status (SUCCESS, PENDING, FAILED)
     * @returns {Promise<Object>} - Transfer history
     */
    async getTransferHistory(filters = {}) {
        const {
            fromDate,
            toDate,
            page = 1,
            limit = 10,
            status
        } = filters;

        const params = {
            page: page,
            limit: Math.min(limit, 100)
        };

        if (fromDate) params.fromDate = fromDate;
        if (toDate) params.toDate = toDate;
        if (status) params.status = status;

        try {
            const response = await axios.get(
                `${this.baseURL}/v1/transfers`,
                {
                    params: params,
                    headers: this.getHeaders(),
                    timeout: 30000
                }
            );

            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('[CashfreePayout] Error fetching transfer history:', error.response?.data || error.message);
            const enhancedError = this._enhanceError(error, 'fetching transfer history');
            throw enhancedError;
        }
    }

    // ==================== WEBHOOK VERIFICATION ====================

    /**
     * Verify webhook signature
     * @param {Object} payload - Webhook payload
     * @param {string} signature - Webhook signature from header
     * @param {string} timestamp - Timestamp from header (optional)
     * @returns {boolean} - Verification result
     */
    verifyWebhookSignature(payload, signature, timestamp = null) {
        if (!signature || !this.clientSecret) {
            console.warn('[CashfreePayout] Cannot verify webhook: missing signature or secret');
            return false;
        }

        try {
            // Cashfree webhook signature verification
            // The signature is typically HMAC SHA256 of (timestamp + payload body)
            const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
            const timestampString = timestamp || Date.now().toString();
            
            const computedSignature = crypto
                .createHmac('sha256', this.clientSecret)
                .update(timestampString + payloadString)
                .digest('base64');

            // Cashfree may send signature in different formats
            const isValid = computedSignature === signature || 
                          signature.includes(computedSignature) ||
                          computedSignature === Buffer.from(signature, 'base64').toString('base64');

            if (!isValid) {
                console.warn('[CashfreePayout] Webhook signature verification failed', {
                    computed: computedSignature.substring(0, 20) + '...',
                    received: signature.substring(0, 20) + '...'
                });
            }

            return isValid;
        } catch (error) {
            console.error('[CashfreePayout] Error verifying webhook signature:', error);
            return false;
        }
    }

    // ==================== UTILITY METHODS ====================

    /**
     * Enhance error messages for better debugging
     * @param {Error} error - Original error
     * @param {string} context - Context where error occurred
     * @returns {Error} Enhanced error
     */
    _enhanceError(error, context) {
        const enhancedError = new Error(error.response?.data?.message || error.message);
        enhancedError.status = error.response?.status || error.status || 500;
        enhancedError.data = error.response?.data || error.data;
        enhancedError.context = context;
        enhancedError.originalError = error.message;
        
        // Add specific error messages based on status code
        if (error.response?.status === 401 || error.response?.status === 403) {
            enhancedError.message = 'Cashfree Payout API authentication failed. Please verify your credentials.';
            enhancedError.type = 'AUTHENTICATION_ERROR';
        } else if (error.response?.status === 400) {
            enhancedError.message = error.response?.data?.message || `Invalid request for ${context}`;
            enhancedError.type = 'VALIDATION_ERROR';
        } else if (error.response?.status === 404) {
            enhancedError.message = `Resource not found: ${context}`;
            enhancedError.type = 'NOT_FOUND';
        } else if (error.response?.status === 409) {
            enhancedError.message = error.response?.data?.message || `Resource already exists: ${context}`;
            enhancedError.type = 'DUPLICATE_ERROR';
        } else if (error.response?.status === 429) {
            enhancedError.message = 'Rate limit exceeded. Please try again later.';
            enhancedError.type = 'RATE_LIMIT_ERROR';
        } else if (error.response?.status >= 500) {
            enhancedError.message = 'Cashfree Payout API server error. Please try again later.';
            enhancedError.type = 'SERVER_ERROR';
        } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            enhancedError.message = 'Unable to connect to Cashfree Payout API. Please check your network connection.';
            enhancedError.type = 'NETWORK_ERROR';
        }
        
        return enhancedError;
    }

    /**
     * Validate IFSC code format
     * @param {string} ifsc - IFSC code
     * @returns {boolean} - True if valid format
     */
    validateIFSC(ifsc) {
        if (!ifsc || typeof ifsc !== 'string') {
            return false;
        }
        // IFSC format: 4 letters, 0, followed by 5 alphanumeric
        const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
        return ifscRegex.test(ifsc.toUpperCase());
    }

    /**
     * Validate bank account number
     * @param {string} accountNumber - Bank account number
     * @returns {boolean} - True if valid format
     */
    validateAccountNumber(accountNumber) {
        if (!accountNumber || typeof accountNumber !== 'string') {
            return false;
        }
        // Account number should be 9-18 digits
        const accountRegex = /^\d{9,18}$/;
        return accountRegex.test(accountNumber.replace(/\s/g, ''));
    }

    /**
     * Validate phone number (Indian format)
     * @param {string} phone - Phone number
     * @returns {boolean} - True if valid format
     */
    validatePhone(phone) {
        if (!phone || typeof phone !== 'string') {
            return false;
        }
        // Indian phone: 10 digits, optionally prefixed with +91 or 91
        const phoneRegex = /^(\+91|91)?[6-9]\d{9}$/;
        return phoneRegex.test(phone.replace(/[\s-]/g, ''));
    }

    /**
     * Get service health/status
     * @returns {Object} - Service status
     */
    getStatus() {
        return {
            initialized: !!(this.clientId && this.clientSecret),
            environment: this.isProduction ? 'PRODUCTION' : 'SANDBOX',
            apiBase: this.baseURL,
            apiVersion: this.apiVersion,
            isConfigured: !!(this.clientId && this.clientSecret)
        };
    }
}

module.exports = new CashfreePayoutService();
