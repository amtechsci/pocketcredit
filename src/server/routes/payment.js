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

        // Fetch loan details
        const [loan] = await executeQuery(
            `SELECT la.*, 
                    CONCAT(u.first_name, ' ', u.last_name) as name,
                    u.email, 
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

        // Generate unique order ID
        const orderId = `LOAN_${loan.application_number}_${Date.now()}`;

        // Create payment order in database
        await executeQuery(
            `INSERT INTO payment_orders (
        order_id, loan_id, user_id, amount, status, created_at
      ) VALUES (?, ?, ?, ?, 'PENDING', NOW())`,
            [orderId, loanId, userId, amount]
        );

        // Create Cashfree order
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const backendUrl = process.env.BACKEND_URL || process.env.APP_URL || 'http://localhost:3001';
        const returnUrl = `${frontendUrl}/payment/return?orderId=${orderId}`;
        const notifyUrl = `${backendUrl}/api/payment/webhook`;

        const orderResult = await cashfreePayment.createOrder({
            orderId,
            amount,
            customerName: loan.name,
            customerEmail: loan.email,
            customerPhone: loan.phone,
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

        // Update order with payment_session_id
        await executeQuery(
            `UPDATE payment_orders 
       SET payment_session_id = ?, cashfree_response = ? 
       WHERE order_id = ?`,
            [
                orderResult.data.payment_session_id,
                JSON.stringify(orderResult.data),
                orderId
            ]
        );

        console.log('🔍 Debug - orderResult.data:', orderResult.data);
        console.log('🔍 Debug - Session ID from response:', orderResult.data.payment_session_id);

        // Get checkout URL
        const checkoutUrl = cashfreePayment.getCheckoutUrl(orderResult.data.payment_session_id);

        console.log('🔍 Debug - Generated checkout URL:', checkoutUrl);
        console.log('✅ Payment order created:', { orderId, checkoutUrl });

        res.json({
            success: true,
            data: {
                orderId,
                paymentSessionId: orderResult.data.payment_session_id,
                checkoutUrl
            }
        });

    } catch (error) {
        console.error('❌ Error creating payment order:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
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
