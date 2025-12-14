/**
 * Cashfree Payment Gateway Service
 * Handles one-time loan repayment transactions
 */

const axios = require('axios');

class CashfreePaymentService {
    constructor() {
        this.clientId = process.env.CASHFREE_CLIENT_ID;
        this.clientSecret = process.env.CASHFREE_CLIENT_SECRET;
        this.environment = process.env.CASHFREE_ENV || 'sandbox'; // 'sandbox' or 'production'

        this.baseURL = this.environment === 'production'
            ? 'https://api.cashfree.com/pg'
            : 'https://sandbox.cashfree.com/pg';

        this.apiVersion = process.env.CASHFREE_API_VERSION || '2023-08-01';
    }

    /**
     * Get common headers for Cashfree API
     */
    getHeaders() {
        return {
            'x-client-id': this.clientId,
            'x-client-secret': this.clientSecret,
            'x-api-version': this.apiVersion,
            'Content-Type': 'application/json'
        };
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

            console.log('💳 Creating Cashfree order:', { orderId, amount });

            const response = await axios.post(
                `${this.baseURL}/orders`,
                payload,
                { headers: this.getHeaders() }
            );

            console.log('✅ Cashfree order created successfully!');
            console.log('📦 Full Response:', JSON.stringify(response.data, null, 2));
            console.log('🔑 Payment Session ID:', response.data.payment_session_id);

            return {
                success: true,
                data: response.data
            };

        } catch (error) {
            console.error('❌ Cashfree order creation failed:', error.response?.data || error.message);

            return {
                success: false,
                error: error.response?.data?.message || error.message
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
        if (this.environment === 'production') {
            return `https://payments.cashfree.com/forms/${paymentSessionId}`;
        } else {
            return `https://payments-test.cashfree.com/forms/${paymentSessionId}`;
        }
    }
}

module.exports = new CashfreePaymentService();
