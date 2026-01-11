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
        // IMPORTANT: Set CASHFREE_API_BASE in .env file
        // Production: https://api.cashfree.com/pg
        // Sandbox: https://sandbox.cashfree.com/pg
        this.baseURL = process.env.CASHFREE_API_BASE || 'https://api.cashfree.com/pg';
        this.apiVersion = process.env.CASHFREE_API_VERSION || '2023-08-01';
        this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        this.nodeEnv = process.env.NODE_ENV || 'development';
        
        // Detect if we're using production API
        // Production: https://api.cashfree.com/pg
        // Sandbox: https://sandbox.cashfree.com/pg
        this.isProduction = this.baseURL.includes('api.cashfree.com') && 
                           !this.baseURL.includes('sandbox');
        
        // Log environment for debugging
        if (!this.isProduction && this.nodeEnv === 'production') {
            console.warn('⚠️  WARNING: Using sandbox API in production environment!');
            console.warn('   Set CASHFREE_API_BASE=https://api.cashfree.com/pg for production');
        }

        // Validate configuration
        if (!this.clientId || !this.clientSecret) {
            console.warn('⚠️  WARNING: Cashfree payment credentials not configured');
            if (this.nodeEnv === 'production') {
                console.error('❌ ERROR: Cashfree credentials are required in production!');
            }
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
        // Extract orderId first for error handling
        const orderId = orderData?.orderId;
        
        try {
            const {
                amount,
                customerName,
                customerEmail,
                customerPhone,
                returnUrl,
                notifyUrl
            } = orderData;

            // Validate required fields
            if (!orderId) {
                throw new Error('orderId is required in orderData');
            }

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
     * Get order status from Cashfree API
     * This is called from backend only to check if payment is received
     * @param {string} orderId - Cashfree order ID
     * @returns {Promise<Object>} - Order status with payment information
     */
    async getOrderStatus(orderId) {
        try {
            console.log(`[CashfreePayment] Fetching order status for: ${orderId}`);
            const response = await axios.get(
                `${this.baseURL}/orders/${orderId}`,
                { headers: this.getHeaders() }
            );

            const orderData = response.data;
            const orderStatus = orderData.order_status || orderData.order?.order_status;
            
            console.log(`[CashfreePayment] Order ${orderId} status: ${orderStatus}`);

            return {
                success: true,
                data: orderData,
                orderStatus: orderStatus,
                paymentReceived: orderStatus === 'PAID'
            };

        } catch (error) {
            console.error('❌ Failed to fetch order status from Cashfree:', error.response?.data || error.message);

            return {
                success: false,
                error: error.response?.data?.message || error.message,
                data: null
            };
        }
    }

    /**
     * Get payment details for an order
     * Returns all payment attempts for a specific order
     * @param {string} orderId - Cashfree order ID
     * @returns {Promise<Object>} - Payment details
     */
    async getOrderPayments(orderId) {
        try {
            console.log(`[CashfreePayment] Fetching payment details for order: ${orderId}`);
            const response = await axios.get(
                `${this.baseURL}/orders/${orderId}/payments`,
                { headers: this.getHeaders() }
            );

            return {
                success: true,
                data: response.data
            };

        } catch (error) {
            console.error('❌ Failed to fetch payment details from Cashfree:', error.response?.data || error.message);

            return {
                success: false,
                error: error.response?.data?.message || error.message,
                data: null
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
        
        // For Cashfree API v2023-08-01, the correct checkout URL format is:
        // Production: https://payments.cashfree.com/checkout/{payment_session_id}
        // Sandbox: https://payments-test.cashfree.com/checkout/{payment_session_id}
        // 
        // NOTE: The path is /checkout/ NOT /forms/
        // The /forms/ path is for static form names, not session IDs
        
        // Determine checkout domain based on API base URL
        let checkoutDomain;
        if (this.isProduction) {
            checkoutDomain = 'https://payments.cashfree.com';
        } else {
            checkoutDomain = 'https://payments-test.cashfree.com';
        }
        
        // Use /checkout/ path for payment_session_id (not /forms/)
        const checkoutUrl = `${checkoutDomain}/checkout/${paymentSessionId}`;
        console.log('[CashfreePayment] Constructed checkout URL:', {
            checkoutUrl,
            isProduction: this.isProduction,
            baseURL: this.baseURL,
            sessionId: paymentSessionId.substring(0, 20) + '...',
            path: '/checkout/ (correct for session IDs)'
        });
        
        return checkoutUrl;
    }
}

module.exports = new CashfreePaymentService();
