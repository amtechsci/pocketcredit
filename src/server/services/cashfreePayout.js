/**
 * Cashfree Payout API Service
 * Handles loan disbursement transfers to beneficiary bank accounts
 * 
 * API Documentation: https://docs.cashfree.com/docs/payouts-api
 * Base URL: 
 * - Production: https://api.cashfree.com/payout
 * - Sandbox: https://sandbox.cashfree.com/payout
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

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
                      (process.env.CASHFREE_API_BASE?.replace('/pg', '/payout') || 'https://api.cashfree.com/payout');
        
        // If CASHFREE_API_BASE is set but doesn't contain /payout, construct it
        if (process.env.CASHFREE_API_BASE && !this.baseURL.includes('/payout')) {
            // Convert https://api.cashfree.com/pg to https://api.cashfree.com/payout
            this.baseURL = process.env.CASHFREE_API_BASE.replace('/pg', '/payout');
        }
        
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
    }

    /**
     * Get common headers for Cashfree Payout API
     * Note: Payout API uses x-client-id and x-client-secret (same as Payment Gateway)
     */
    getHeaders(idempotencyKey = null) {
        const headers = {
            'x-client-id': this.clientId,
            'x-client-secret': this.clientSecret,
            'x-api-version': this.apiVersion,
            'Content-Type': 'application/json',
            'x-request-id': uuidv4()
        };
        
        if (idempotencyKey) {
            headers['x-idempotency-key'] = idempotencyKey;
        }
        
        return headers;
    }

    /**
     * Create/Add a beneficiary
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
            pincode
        } = beneficiaryData;

        // Validate required fields
        if (!beneId || !name || !phone || !bankAccount || !ifsc) {
            throw new Error('Missing required fields: beneId, name, phone, bankAccount, ifsc are required');
        }

        const payload = {
            beneId: beneId,
            name: name,
            email: email || '',
            phone: phone,
            bankAccount: bankAccount,
            ifsc: ifsc,
            address1: address1 || '',
            address2: address2 || '',
            city: city || '',
            state: state || '',
            pincode: pincode || ''
        };

        try {
            console.log(`[CashfreePayout] Creating beneficiary: ${beneId}`);
            const response = await axios.post(
                `${this.baseURL}/v1/addBeneficiary`,
                payload,
                { headers: this.getHeaders(beneId) } // Use beneId as idempotency key
            );

            console.log(`[CashfreePayout] Beneficiary created: ${beneId}`, {
                status: response.data?.status,
                message: response.data?.message
            });

            return {
                success: true,
                data: response.data
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
        try {
            const response = await axios.get(
                `${this.baseURL}/v1/getBeneficiary/${beneId}`,
                { headers: this.getHeaders() }
            );

            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error(`[CashfreePayout] Error fetching beneficiary ${beneId}:`, error.response?.data || error.message);
            const enhancedError = this._enhanceError(error, 'fetching beneficiary');
            throw enhancedError;
        }
    }

    /**
     * Initiate a payout/transfer to beneficiary
     * @param {Object} transferData - Transfer details
     * @returns {Promise<Object>} - Transfer response
     */
    async initiateTransfer(transferData) {
        const {
            transferId,
            beneId,
            amount,
            transferMode = 'NEFT', // NEFT, IMPS, RTGS, UPI, etc.
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
            transferMode: transferMode,
            remarks: remarks || `Loan disbursement - Transfer ${transferId}`
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
                { headers: this.getHeaders(transferId) } // Use transferId as idempotency key
            );

            console.log(`[CashfreePayout] Transfer initiated: ${transferId}`, {
                status: response.data?.status,
                message: response.data?.message,
                referenceId: response.data?.referenceId
            });

            return {
                success: true,
                data: response.data,
                transferId: transferId,
                referenceId: response.data?.referenceId || null,
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
     * Get transfer status
     * @param {string} transferId - Transfer ID
     * @returns {Promise<Object>} - Transfer status
     */
    async getTransferStatus(transferId) {
        try {
            const response = await axios.get(
                `${this.baseURL}/v1/getTransferStatus?transferId=${transferId}`,
                { headers: this.getHeaders() }
            );

            return {
                success: true,
                data: response.data,
                status: response.data?.status || 'UNKNOWN'
            };
        } catch (error) {
            console.error(`[CashfreePayout] Error fetching transfer status ${transferId}:`, error.response?.data || error.message);
            const enhancedError = this._enhanceError(error, 'fetching transfer status');
            throw enhancedError;
        }
    }

    /**
     * Enhance error messages for better debugging
     */
    _enhanceError(error, context) {
        const enhancedError = new Error(error.response?.data?.message || error.message);
        enhancedError.status = error.response?.status;
        enhancedError.data = error.response?.data;
        enhancedError.context = context;
        
        // Add specific error messages
        if (error.response?.status === 401 || error.response?.status === 403) {
            enhancedError.message = `Cashfree Payout API authentication failed. Please verify your credentials.`;
        } else if (error.response?.status === 400) {
            enhancedError.message = error.response?.data?.message || `Invalid request for ${context}`;
        } else if (error.response?.status === 404) {
            enhancedError.message = `Beneficiary or transfer not found`;
        }
        
        return enhancedError;
    }
}

module.exports = new CashfreePayoutService();

