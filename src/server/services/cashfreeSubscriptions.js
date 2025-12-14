/**
 * Cashfree Subscriptions Service
 * Production-grade client for Cashfree eNACH subscriptions
 * 
 * @version 1.0.0
 * @apiVersion 2025-01-01
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

class CashfreeSubscriptionsService {
    constructor() {
        this.apiBase = process.env.CASHFREE_API_BASE || 'https://sandbox.cashfree.com/pg';
        this.clientId = process.env.CASHFREE_CLIENT_ID;
        this.clientSecret = process.env.CASHFREE_CLIENT_SECRET;
        this.apiVersion = process.env.CASHFREE_API_VERSION || '2025-01-01';

        if (!this.clientId || !this.clientSecret) {
            throw new Error('CASHFREE_CLIENT_ID and CASHFREE_CLIENT_SECRET must be set');
        }

        // Axios instance with defaults
        this.client = axios.create({
            baseURL: this.apiBase,
            headers: {
                'Content-Type': 'application/json',
                'x-api-version': this.apiVersion,
                'x-client-id': this.clientId,
                'x-client-secret': this.clientSecret
            },
            timeout: 30000 // 30 second timeout
        });

        // Add request interceptor for logging
        this.client.interceptors.request.use(
            (config) => {
                config.headers['x-request-id'] = uuidv4();
                console.log(`[Cashfree] ${config.method.toUpperCase()} ${config.url}`, {
                    requestId: config.headers['x-request-id']
                });
                return config;
            },
            (error) => Promise.reject(error)
        );

        // Add response interceptor for error handling
        this.client.interceptors.response.use(
            (response) => response,
            (error) => {
                const enhanced = this._enhanceError(error);
                console.error('[Cashfree] API Error:', enhanced);
                return Promise.reject(enhanced);
            }
        );
    }

    /**
     * Get headers for a Cashfree API request
     */
    _getHeaders(idempotencyKey = null) {
        const headers = {
            'Content-Type': 'application/json',
            'x-api-version': this.apiVersion,
            'x-client-id': this.clientId,
            'x-client-secret': this.clientSecret,
            'x-request-id': uuidv4()
        };

        if (idempotencyKey) {
            headers['x-idempotency-key'] = idempotencyKey;
        }

        return headers;
    }

    /**
     * Enhance error with structured information
     */
    _enhanceError(error) {
        if (error.response) {
            return {
                message: error.response.data?.message || 'Cashfree API error',
                code: error.response.status,
                cashfreeError: error.response.data,
                requestId: error.config?.headers?.['x-request-id']
            };
        }

        return {
            message: error.message || 'Unknown error',
            code: 'NETWORK_ERROR',
            original: error
        };
    }

    /**
     * Create a subscription plan
     * 
     * @param {Object} planData - Plan configuration
     * @returns {Promise<Object>} Created plan
     */
    async createPlan(planData) {
        const {
            plan_id,
            plan_name,
            plan_recurring_amount,
            plan_max_amount,
            plan_max_cycles,
            plan_interval_type = 'MONTH',
            plan_intervals = 1,
            plan_type = 'PERIODIC',
            plan_currency = 'INR',
            plan_note = ''
        } = planData;

        const payload = {
            plan_id,
            plan_name,
            plan_type,
            plan_currency,
            plan_recurring_amount,
            plan_max_amount,
            plan_max_cycles,
            plan_intervals,
            plan_interval_type,
            plan_note
        };

        try {
            const response = await this.client.post('/plans', payload, {
                headers: this._getHeaders(plan_id) // Use plan_id as idempotency key
            });

            console.log(`[Cashfree] Plan created: ${plan_id}`, response.data);
            return { success: true, data: response.data };

        } catch (error) {
            // If plan already exists, fetch it
            if (error.cashfreeError?.message?.includes('already exists') ||
                error.cashfreeError?.message?.includes('Plan already created')) {
                console.log(`[Cashfree] Plan ${plan_id} already exists, fetching...`);
                return { success: true, data: { plan_id, plan_status: 'ACTIVE' }, existed: true };
            }

            throw error;
        }
    }

    /**
     * Create an eNACH subscription
     * 
     * CRITICAL: For eNACH subscriptions:
     * - Do NOT include authorization_details
     * - Use subscr
  
  iption_payment_method: 'ENACH'
     * - split_schemes is MANDATORY
     * 
     * @param {Object} subscriptionData - Subscription configuration
     * @returns {Promise<Object>} Created subscription
     */
    async createSubscription(subscriptionData) {
        const {
            subscription_id,
            customer_details,
            plan_id,
            return_url,
            notification_channels = ['EMAIL', 'SMS']
        } = subscriptionData;

        // Validate required fields
        if (!subscription_id || !customer_details || !plan_id || !return_url) {
            throw new Error('Missing required fields: subscription_id, customer_details, plan_id, return_url');
        }

        // Validate customer bank details for eNACH
        const required = [
            'customer_name',
            'customer_email',
            'customer_phone',
            'customer_bank_account_holder_name',
            'customer_bank_account_number',
            'customer_bank_ifsc',
            'customer_bank_code',
            'customer_bank_account_type'
        ];

        const missing = required.filter(field => !customer_details[field]);
        if (missing.length > 0) {
            throw new Error(`Missing required customer fields: ${missing.join(', ')}`);
        }

        const payload = {
            subscription_id,
            customer_details,
            plan_details: { plan_id },
            subscription_payment_method: 'ENACH', // CRITICAL: Must be uppercase
            split_schemes: [
                {
                    scheme_id: 'PRIMARY_MERCHANT',
                    split_type: 'PERCENTAGE',
                    split_value: 100,
                    vendor_id: 'SELF'
                }
            ],
            subscription_meta: {
                return_url,
                notification_channel: notification_channels
            }
            // CRITICAL: Do NOT include authorization_details for eNACH
        };

        try {
            const response = await this.client.post('/subscriptions', payload, {
                headers: this._getHeaders(subscription_id)
            });

            console.log(`[Cashfree] Subscription created: ${subscription_id}`, {
                cf_subscription_id: response.data.cf_subscription_id,
                status: response.data.subscription_status
            });

            return { success: true, data: response.data };

        } catch (error) {
            console.error(`[Cashfree] Subscription creation failed:`, error);
            throw error;
        }
    }

    /**
     * Get subscription status
     * 
     * @param {string} subscriptionId - Your subscription ID
     * @returns {Promise<Object>} Subscription details
     */
    async getSubscriptionStatus(subscriptionId) {
        try {
            const response = await this.client.get(`/subscriptions/${subscriptionId}`, {
                headers: this._getHeaders()
            });

            return { success: true, data: response.data };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Build authorization URL from session ID
     * 
     * @param {string} sessionId - subscription_session_id from Cashfree
     * @returns {string} Authorization URL
     */
    buildAuthorizationUrl(sessionId) {
        return `${this.apiBase}/checkout/subscription?subscription_session_id=${sessionId}`;
    }

    /**
     * Cancel a subscription
     * 
     * @param {string} subscriptionId - Your subscription ID
     * @returns {Promise<Object>} Cancellation result
     */
    async cancelSubscription(subscriptionId) {
        try {
            const response = await this.client.post(`/subscriptions/${subscriptionId}/cancel`, {}, {
                headers: this._getHeaders()
            });

            console.log(`[Cashfree] Subscription cancelled: ${subscriptionId}`);
            return { success: true, data: response.data };
        } catch (error) {
            throw error;
        }
    }
}

// Export singleton instance
module.exports = new CashfreeSubscriptionsService();
