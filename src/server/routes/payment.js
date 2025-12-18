/**
 * Payment Gateway Routes
 * Handles loan repayment via Cashfree
 */

const express = require('express');
const router = express.Router();
const { executeQuery } = require('../config/database');
const cashfreePayment = require('../services/cashfreePayment');
const { authenticateToken } = require('../middleware/auth');

/**
 * POST /api/payment/create-order
 * Create a payment order for loan repayment
 */
router.post('/create-order', authenticateToken, async (req, res) => {
    let orderId = null; // Initialize to avoid scope issues in error handling
    
    try {
        const userId = req.user.id;
        const { loanId, amount } = req.body;

        // Validate input
        if (!loanId || !amount) {
            return res.status(400).json({
                success: false,
                message: 'Loan ID and amount are required'
            });
        }

        // Fetch loan details with all email fields (similar to eNACH implementation)
        const [loan] = await executeQuery(
            `SELECT la.*, 
                    CONCAT(u.first_name, ' ', u.last_name) as name,
                    u.email, 
                    u.personal_email,
                    u.official_email,
                    u.phone 
             FROM loan_applications la 
             JOIN users u ON la.user_id = u.id 
             WHERE la.id = ? AND la.user_id = ?`,
            [loanId, userId]
        );

        if (!loan) {
            return res.status(404).json({
                success: false,
                message: 'Loan not found'
            });
        }

        // Validate loan has required fields
        if (!loan.application_number) {
            console.error('[Payment] Loan missing application_number:', { loanId, userId });
            return res.status(400).json({
                success: false,
                message: 'Loan application number is missing. Please contact support.'
            });
        }

        // Get email - use personal_email, official_email, or email (in that priority order)
        const customerEmail = loan.personal_email || loan.official_email || loan.email;
        
        // Validate customer details
        if (!customerEmail) {
            console.error('[Payment] Loan missing customer email:', { 
                loanId, 
                userId,
                hasEmail: !!loan.email,
                hasPersonalEmail: !!loan.personal_email,
                hasOfficialEmail: !!loan.official_email
            });
            return res.status(400).json({
                success: false,
                message: 'Customer email is required for payment processing. Please update your email in profile settings.'
            });
        }

        // Generate unique order ID
        orderId = `LOAN_${loan.application_number}_${Date.now()}`;
        console.log(`[Payment] Generated order ID: ${orderId} for loan ${loanId}`);

        // Create payment order in database
        // First, ensure the table exists (create if it doesn't)
        try {
            await executeQuery(`
                CREATE TABLE IF NOT EXISTS payment_orders (
                    id INT NOT NULL AUTO_INCREMENT,
                    order_id VARCHAR(255) NOT NULL,
                    loan_id INT NOT NULL,
                    user_id INT NOT NULL,
                    amount DECIMAL(12, 2) NOT NULL,
                    status ENUM('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED') DEFAULT 'PENDING',
                    payment_session_id VARCHAR(255) DEFAULT NULL,
                    cashfree_response JSON DEFAULT NULL,
                    webhook_data JSON DEFAULT NULL,
                    payment_method VARCHAR(50) DEFAULT NULL,
                    transaction_id VARCHAR(255) DEFAULT NULL,
                    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    PRIMARY KEY (id),
                    UNIQUE KEY unique_order_id (order_id),
                    KEY idx_loan_id (loan_id),
                    KEY idx_user_id (user_id),
                    KEY idx_status (status)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
        } catch (tableError) {
            // Table might already exist, continue
            if (!tableError.message.includes('already exists')) {
                console.warn('[Payment] Table creation warning:', tableError.message);
            }
        }

        // Insert payment order
        try {
            await executeQuery(
                `INSERT INTO payment_orders (
            order_id, loan_id, user_id, amount, status, created_at
          ) VALUES (?, ?, ?, ?, 'PENDING', NOW())`,
                [orderId, loanId, userId, amount]
            );
            console.log(`[Payment] Payment order created in DB: ${orderId}`);
        } catch (insertError) {
            console.error('[Payment] Failed to insert payment order:', insertError);
            // If it's a duplicate key error, that's okay - order already exists
            if (insertError.message && insertError.message.includes('Duplicate entry')) {
                console.log(`[Payment] Order ${orderId} already exists, continuing...`);
            } else {
                throw insertError; // Re-throw if it's a different error
            }
        }

        // Validate Cashfree service is configured
        // Check environment variables directly since service properties might not be exposed
        if (!process.env.CASHFREE_CLIENT_ID || !process.env.CASHFREE_CLIENT_SECRET) {
            console.error('[Payment] Cashfree credentials not configured in environment');
            return res.status(503).json({
                success: false,
                message: 'Payment gateway is not configured. Please contact support.',
                error: 'CASHFREE_CLIENT_ID or CASHFREE_CLIENT_SECRET not set'
            });
        }

        // Create Cashfree order
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const backendUrl = process.env.BACKEND_URL || process.env.APP_URL || 'http://localhost:3001';
        const returnUrl = `${frontendUrl}/payment/return?orderId=${orderId}`;
        const notifyUrl = `${backendUrl}/api/payment/webhook`;

        console.log(`[Payment] Creating Cashfree order:`, {
            orderId,
            amount,
            customerEmail: customerEmail,
            customerPhone: loan.phone || 'N/A',
            returnUrl,
            notifyUrl,
            cashfreeBaseURL: cashfreePayment.baseURL
        });

        const orderResult = await cashfreePayment.createOrder({
            orderId,
            amount,
            customerName: loan.name || 'Customer',
            customerEmail: customerEmail, // Use the resolved email
            customerPhone: loan.phone || '9999999999', // Default phone if missing
            returnUrl,
            notifyUrl
        });

        if (!orderResult.success) {
            console.error('[Payment] Cashfree order creation failed:', orderResult.error);
            
            // Update order status to FAILED
            await executeQuery(
                `UPDATE payment_orders 
           SET status = 'FAILED', updated_at = NOW() 
           WHERE order_id = ?`,
                [orderId]
            );
            
            const statusCode = orderResult.statusCode || 500;
            return res.status(statusCode).json({
                success: false,
                message: orderResult.error || 'Failed to create payment order',
                error: orderResult.error
            });
        }

        // Extract and clean payment_session_id
        let paymentSessionId = orderResult.data.payment_session_id;
        if (!paymentSessionId) {
            console.error('[Payment] No payment_session_id in Cashfree response');
            return res.status(500).json({
                success: false,
                message: 'Payment gateway did not return a valid session. Please try again.',
                error: 'Missing payment_session_id in response'
            });
        }

        // Clean the session ID - remove any trailing garbage (like "paymentpayment")
        // Session IDs should start with "session_" and be alphanumeric with dashes/underscores
        const cleanSessionId = paymentSessionId
            .trim()
            .split(/\s+/)[0]  // Take first part if there are spaces
            .replace(/[^a-zA-Z0-9_\-]/g, '') // Remove any invalid characters
            .replace(/paymentpayment$/i, ''); // Remove trailing "paymentpayment" if present
        
        console.log('[Payment] Payment session ID processing:', {
            original: paymentSessionId.substring(0, 50) + '...',
            originalLength: paymentSessionId.length,
            cleaned: cleanSessionId.substring(0, 50) + '...',
            cleanedLength: cleanSessionId.length,
            isValid: cleanSessionId.startsWith('session_')
        });

        if (!cleanSessionId.startsWith('session_')) {
            console.error('[Payment] Invalid session ID format after cleaning');
            return res.status(500).json({
                success: false,
                message: 'Invalid payment session received. Please try again.',
                error: 'Session ID does not start with "session_"'
            });
        }

        // Update order with cleaned payment_session_id
        await executeQuery(
            `UPDATE payment_orders 
       SET payment_session_id = ?, cashfree_response = ? 
       WHERE order_id = ?`,
            [
                cleanSessionId,
                JSON.stringify(orderResult.data),
                orderId
            ]
        );

        console.log('🔍 Debug - Full Cashfree response:', JSON.stringify(orderResult.data, null, 2));
        console.log('🔍 Debug - Response keys:', Object.keys(orderResult.data || {}));
        console.log('🔍 Debug - Session ID from response (original):', paymentSessionId);
        console.log('🔍 Debug - Session ID (cleaned):', cleanSessionId);
        console.log('🔍 Debug - Payment link from response:', orderResult.data.payment_link);
        console.log('🔍 Debug - Payment URL from response:', orderResult.data.payment_url);
        console.log('🔍 Debug - Order status:', orderResult.data.order_status);

        // Create a clean response object with cleaned session ID
        const cleanOrderResponse = {
            ...orderResult.data,
            payment_session_id: cleanSessionId
        };

        // Get checkout URL - pass clean response to handle payment_link if available
        let checkoutUrl;
        try {
            checkoutUrl = cashfreePayment.getCheckoutUrl(cleanOrderResponse);
            console.log('🔍 Debug - Generated checkout URL:', checkoutUrl);
            
            // Verify URL format
            if (!checkoutUrl || !checkoutUrl.startsWith('http')) {
                throw new Error(`Invalid checkout URL format: ${checkoutUrl}`);
            }
            
            // Verify environment match
            const isSandboxSession = checkoutUrl.includes('payments-test.cashfree.com');
            const isProductionSession = checkoutUrl.includes('payments.cashfree.com');
            const isSandboxAPI = cashfreePayment.baseURL.includes('sandbox');
            
            if (isSandboxAPI && !isSandboxSession) {
                console.warn('[Payment] WARNING: Sandbox API but production checkout URL detected');
            }
            if (!isSandboxAPI && !isProductionSession) {
                console.warn('[Payment] WARNING: Production API but sandbox checkout URL detected');
            }
            
        } catch (urlError) {
            console.error('[Payment] Failed to generate checkout URL:', urlError);
            return res.status(500).json({
                success: false,
                message: 'Failed to generate payment URL. Please try again.',
                error: urlError.message
            });
        }

        console.log('✅ Payment order created:', { 
            orderId, 
            checkoutUrl,
            environment: cashfreePayment.isProduction ? 'PRODUCTION' : 'SANDBOX'
        });

        res.json({
            success: true,
            data: {
                orderId,
                paymentSessionId: cleanSessionId, // Use cleaned session ID
                checkoutUrl
            }
        });

    } catch (error) {
        console.error('❌ Error creating payment order:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        console.error('Order ID at error:', orderId);
        
        // Provide more helpful error messages
        let errorMessage = 'Internal server error';
        let statusCode = 500;
        
        if (error.message) {
            if (error.message.includes('orderId')) {
                errorMessage = 'Failed to process payment order. Please try again.';
            } else if (error.message.includes('doesn\'t exist') || error.message.includes('Unknown table')) {
                errorMessage = 'Payment system is not properly configured. Please contact support.';
            } else if (error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT')) {
                errorMessage = 'Payment gateway is temporarily unavailable. Please try again later.';
                statusCode = 503;
            } else if (error.message.includes('authentication') || error.message.includes('credentials')) {
                errorMessage = 'Payment gateway authentication failed. Please contact support.';
                statusCode = 503;
            } else {
                errorMessage = error.message;
            }
        }
        
        // Always log full error details for debugging
        console.error('[Payment] Full error details:', {
            message: error.message,
            code: error.code,
            orderId: orderId,
            loanId: req.body?.loanId,
            amount: req.body?.amount
        });
        
        res.status(statusCode).json({
            success: false,
            message: errorMessage,
            error: process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'production' ? error.message : undefined
        });
    }
});

/**
 * POST /api/payment/webhook
 * Cashfree webhook for payment status
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const signature = req.headers['x-webhook-signature'];
        const payload = JSON.parse(req.body.toString());

        console.log('🔔 Payment webhook received:', payload);

        // Verify signature (optional but recommended)
        // const isValid = cashfreePayment.verifyWebhookSignature(signature, payload);
        // if (!isValid) {
        //   console.error('❌ Invalid webhook signature');
        //   return res.status(401).json({ message: 'Invalid signature' });
        // }

        const { order } = payload.data || {};
        if (!order) {
            return res.status(400).json({ message: 'Invalid payload' });
        }

        const orderId = order.order_id;
        const orderStatus = order.order_status;
        const orderAmount = order.order_amount;

        // Update payment order status
        await executeQuery(
            `UPDATE payment_orders 
       SET status = ?, webhook_data = ?, updated_at = NOW() 
       WHERE order_id = ?`,
            [orderStatus, JSON.stringify(payload), orderId]
        );

        // If payment succeeded, update loan
        if (orderStatus === 'PAID') {
            const [paymentOrder] = await executeQuery(
                'SELECT loan_id FROM payment_orders WHERE order_id = ?',
                [orderId]
            );

            if (paymentOrder) {
                // Create payment record
                await executeQuery(
                    `INSERT INTO loan_payments (
            loan_id, amount, payment_method, transaction_id, status, payment_date
          ) VALUES (?, ?, 'CASHFREE', ?, 'SUCCESS', NOW())`,
                    [paymentOrder.loan_id, orderAmount, orderId]
                );

                // Update loan status (you may want more sophisticated logic here)
                await executeQuery(
                    `UPDATE loan_applications 
           SET status = 'paid', updated_at = NOW() 
           WHERE id = ?`,
                    [paymentOrder.loan_id]
                );

                console.log('✅ Loan payment processed:', {
                    loanId: paymentOrder.loan_id,
                    amount: orderAmount
                });
            }
        }

        res.json({ success: true });

    } catch (error) {
        console.error('❌ Webhook processing error:', error);
        res.status(500).json({ message: 'Webhook processing failed' });
    }
});

/**
 * GET /api/payment/order-status/:orderId
 * Get payment order status
 */
router.get('/order-status/:orderId', authenticateToken, async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.user.id;

        // Fetch from database
        const [order] = await executeQuery(
            `SELECT po.*, la.application_number 
       FROM payment_orders po
       JOIN loan_applications la ON po.loan_id = la.id
       WHERE po.order_id = ? AND po.user_id = ?`,
            [orderId, userId]
        );

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Optionally fetch fresh status from Cashfree
        const cashfreeStatus = await cashfreePayment.getOrderStatus(orderId);

        res.json({
            success: true,
            data: {
                ...order,
                cashfreeStatus: cashfreeStatus.data
            }
        });

    } catch (error) {
        console.error('❌ Error fetching order status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch order status'
        });
    }
});

module.exports = router;
