/**
 * Cashfree Payment Gateway Service
 * Handles one-time loan repayment transactions
 * 
 * Uses the same environment configuration as eNACH subscriptions
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

class CashfreePaymentService {
    constructor() {
        this.clientId = process.env.CASHFREE_CLIENT_ID;
        this.clientSecret = process.env.CASHFREE_CLIENT_SECRET;
        
        // Use CASHFREE_API_BASE for consistency with eNACH implementation
        this.baseURL = process.env.CASHFREE_API_BASE || 'https://sandbox.cashfree.com/pg';
        this.apiVersion = process.env.CASHFREE_API_VERSION || '2023-08-01';
        this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        this.nodeEnv = process.env.NODE_ENV || 'development';
        
        // Detect if we're using production API
        this.isProduction = this.baseURL.includes('api.cashfree.com') && 
                           !this.baseURL.includes('sandbox');

        // Validate configuration
        if (!this.clientId || !this.clientSecret) {
            console.warn('⚠️  WARNING: Cashfree payment credentials not configured');
            if (this.nodeEnv === 'production') {
                console.error('❌ ERROR: Cashfree credentials are required in production!');
            }
        } else {
            console.log(`[CashfreePayment] Initialized - Environment: ${this.isProduction ? 'PRODUCTION' : 'SANDBOX'}`);
        }
    }

    /**
     * Get common headers for Cashfree API
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
     * Create a payment order
     * @param {Object} orderData - Order details
     * @returns {Promise<Object>} - Order creation response
     */
    async createOrder(orderData) {
        try {
            const {
                orderId,
                amount,
                customerName,
                customerEmail,
                customerPhone,
                returnUrl,
                notifyUrl
            } = orderData;

            const payload = {
                order_id: orderId,
                order_amount: parseFloat(amount).toFixed(2),
                order_currency: 'INR',
                customer_details: {
                    customer_id: `user_${customerEmail.replace(/[^a-zA-Z0-9]/g, '_')}`, // Alphanumeric only
                    customer_name: customerName,
                    customer_email: customerEmail,
                    customer_phone: customerPhone
                },
                order_meta: {
                    return_url: returnUrl,
                    notify_url: notifyUrl
                },
                order_note: `Loan Repayment - ${orderId}`
            };

            console.log(`[CashfreePayment] Creating order: ${orderId}`, {
                amount,
                environment: this.isProduction ? 'PRODUCTION' : 'SANDBOX'
            });

            const response = await axios.post(
                `${this.baseURL}/orders`,
                payload,
                { 
                    headers: this.getHeaders(orderId), // Use orderId as idempotency key
                    timeout: 30000 // 30 second timeout
                }
            );

            console.log(`[CashfreePayment] Order created successfully: ${orderId}`, {
                payment_session_id: response.data.payment_session_id,
                order_status: response.data.order_status
            });

            return {
                success: true,
                data: response.data
            };

        } catch (error) {
            console.error(`[CashfreePayment] Order creation failed: ${orderId}`, {
                error: error.response?.data || error.message,
                status: error.response?.status
            });

            // Provide more helpful error messages
            let errorMessage = error.response?.data?.message || error.message;
            
            if (error.response?.status === 401 || error.response?.status === 403) {
                errorMessage = 'Payment gateway authentication failed. Please contact support.';
            } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
                errorMessage = 'Payment gateway is temporarily unavailable. Please try again later.';
            }

            return {
                success: false,
                error: errorMessage,
                statusCode: error.response?.status
            };
        }
    }

    /**
     * Get order status
     * @param {string} orderId - Cashfree order ID
     * @returns {Promise<Object>} - Order status
     */
    async getOrderStatus(orderId) {
        try {
            const response = await axios.get(
                `${this.baseURL}/orders/${orderId}`,
                { headers: this.getHeaders() }
            );

            return {
                success: true,
                data: response.data
            };

        } catch (error) {
            console.error('❌ Failed to fetch order status:', error.response?.data || error.message);

            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Verify webhook signature
     * @param {string} signature - Webhook signature from header
     * @param {Object} payload - Webhook payload
     * @returns {boolean} - Verification result
     */
    verifyWebhookSignature(signature, payload) {
        const crypto = require('crypto');

        // Cashfree uses timestamp-based signature
        const timestamp = payload.data?.order?.order_meta?.timestamp || Date.now();
        const rawBody = JSON.stringify(payload);

        const computedSignature = crypto
            .createHmac('sha256', this.clientSecret)
            .update(timestamp + rawBody)
            .digest('base64');

        return computedSignature === signature;
    }

    /**
     * Get payment checkout URL
     * @param {string} paymentSessionId - Session ID from order creation
     * @returns {string} - Checkout URL
     */
    getCheckoutUrl(paymentSessionId) {
        // Cashfree hosted checkout URL
        if (this.isProduction) {
            return `https://payments.cashfree.com/forms/${paymentSessionId}`;
        } else {
            return `https://payments-test.cashfree.com/forms/${paymentSessionId}`;
        }
    }
}

module.exports = new CashfreePaymentService();
