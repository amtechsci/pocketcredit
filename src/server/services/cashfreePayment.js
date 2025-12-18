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
                payment_link: response.data.payment_link,
                order_status: response.data.order_status,
                full_response_keys: Object.keys(response.data)
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
     * @param {Object} orderResponse - Full order response from Cashfree
     * @returns {string} - Checkout URL
     */
    getCheckoutUrl(orderResponse) {
        // Cashfree may return payment_link directly in the response (preferred)
        if (orderResponse.payment_link) {
            console.log('[CashfreePayment] Using payment_link from response');
            return orderResponse.payment_link;
        }
        
        // Check for payment_url (alternative field name)
        if (orderResponse.payment_url) {
            console.log('[CashfreePayment] Using payment_url from response');
            return orderResponse.payment_url;
        }
        
        // Otherwise, construct URL from payment_session_id
        const paymentSessionId = orderResponse.payment_session_id;
        if (!paymentSessionId) {
            throw new Error('No payment_session_id, payment_link, or payment_url found in order response');
        }
        
        // For Cashfree API v2023-08-01, the checkout URL format is:
        // Production: https://payments.cashfree.com/forms/{payment_session_id}
        // Sandbox: https://payments-test.cashfree.com/forms/{payment_session_id}
        // 
        // However, if the session was created with a different environment,
        // we need to match the environment used for order creation
        
        // Determine checkout domain based on API base URL
        let checkoutDomain;
        if (this.isProduction) {
            checkoutDomain = 'https://payments.cashfree.com';
        } else {
            checkoutDomain = 'https://payments-test.cashfree.com';
        }
        
        const checkoutUrl = `${checkoutDomain}/forms/${paymentSessionId}`;
        console.log('[CashfreePayment] Constructed checkout URL:', {
            checkoutUrl,
            isProduction: this.isProduction,
            baseURL: this.baseURL,
            sessionId: paymentSessionId.substring(0, 20) + '...'
        });
        
        return checkoutUrl;
    }
}

module.exports = new CashfreePaymentService();
