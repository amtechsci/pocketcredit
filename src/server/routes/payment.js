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

        // Check if there's an existing pending or paid order for this loan
        const existingOrders = await executeQuery(
            `SELECT order_id, status, amount, payment_session_id, created_at 
             FROM payment_orders 
             WHERE loan_id = ? AND user_id = ? AND status IN ('PENDING', 'PAID')
             ORDER BY created_at DESC 
             LIMIT 1`,
            [loanId, userId]
        );

        if (existingOrders.length > 0) {
            const existingOrder = existingOrders[0];
            console.log(`[Payment] Found existing order for loan ${loanId}:`, {
                orderId: existingOrder.order_id,
                status: existingOrder.status,
                amount: existingOrder.amount
            });

            // If there's a PAID order, check if payment was actually processed
            if (existingOrder.status === 'PAID') {
                // Check if loan payment record exists
                const paymentRecord = await executeQuery(
                    `SELECT id FROM loan_payments WHERE transaction_id = ? AND loan_id = ?`,
                    [existingOrder.order_id, loanId]
                );

                if (paymentRecord.length > 0) {
                    console.log(`[Payment] Payment already processed for order ${existingOrder.order_id}`);
                    
                    // Even if payment is processed, check if loan should be cleared
                    try {
                        const loanDetails = await executeQuery(
                            `SELECT 
                                id, processed_amount, sanctioned_amount, loan_amount,
                                processed_post_service_fee, fees_breakdown, plan_snapshot,
                                status
                            FROM loan_applications 
                            WHERE id = ?`,
                            [loanId]
                        );

                        if (loanDetails.length > 0) {
                            const loan = loanDetails[0];
                            
                            // Only check for cleared status if loan is in account_manager status
                            if (loan.status === 'account_manager') {
                                // Calculate total payments made for this loan
                                const totalPaymentsResult = await executeQuery(
                                    `SELECT COALESCE(SUM(amount), 0) as total_paid 
                                     FROM loan_payments 
                                     WHERE loan_id = ? AND status = 'SUCCESS'`,
                                    [loanId]
                                );
                                
                                const totalPaid = parseFloat(totalPaymentsResult[0]?.total_paid || 0);
                                
                                // Calculate outstanding balance
                                const { calculateOutstandingBalance } = require('../utils/extensionCalculations');
                                const outstandingBalance = calculateOutstandingBalance(loan);
                                
                                console.log(`💰 Checking if loan #${loanId} should be cleared:`, {
                                    totalPaid: totalPaid,
                                    outstandingBalance: outstandingBalance,
                                    remaining: outstandingBalance - totalPaid
                                });
                                
                                // If total payments >= outstanding balance (with small tolerance for rounding)
                                if (totalPaid >= outstandingBalance - 0.01) {
                                    // Mark loan as cleared
                                    await executeQuery(
                                        `UPDATE loan_applications 
                                         SET status = 'cleared', updated_at = NOW() 
                                         WHERE id = ?`,
                                        [loanId]
                                    );
                                    
                                    console.log(`✅ Loan #${loanId} fully paid and marked as CLEARED`);
                                }
                            }
                        }
                    } catch (clearanceError) {
                        console.error('❌ Error checking if loan should be cleared:', clearanceError);
                        // Don't fail the response, just log the error
                    }
                    
                    return res.json({
                        success: true,
                        message: 'Payment already processed',
                        data: {
                            orderId: existingOrder.order_id,
                            status: 'PAID',
                            alreadyProcessed: true
                        }
                    });
                } else {
                    // Payment marked as PAID but not processed - trigger processing
                    console.log(`[Payment] Order ${existingOrder.order_id} is PAID but not processed, will trigger processing`);
                    // Continue to create new order or return existing one with note to check status
                    return res.json({
                        success: true,
                        message: 'Payment order exists but needs verification',
                        data: {
                            orderId: existingOrder.order_id,
                            status: existingOrder.status,
                            paymentSessionId: existingOrder.payment_session_id,
                            needsVerification: true,
                            checkoutUrl: existingOrder.payment_session_id 
                                ? `https://payments.cashfree.com/checkout/${existingOrder.payment_session_id}`
                                : null
                        }
                    });
                }
            } else if (existingOrder.status === 'PENDING') {
                // Return existing pending order
                console.log(`[Payment] Returning existing pending order ${existingOrder.order_id}`);
                return res.json({
                    success: true,
                    message: 'Existing payment order found',
                    data: {
                        orderId: existingOrder.order_id,
                        status: 'PENDING',
                        paymentSessionId: existingOrder.payment_session_id,
                        checkoutUrl: existingOrder.payment_session_id 
                            ? `https://payments.cashfree.com/checkout/${existingOrder.payment_session_id}`
                            : null
                    }
                });
            }
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
            order_id, loan_id, user_id, amount, payment_type, status, created_at
          ) VALUES (?, ?, ?, ?, 'loan_repayment', 'PENDING', NOW())`,
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
router.post('/webhook', async (req, res) => {
    try {
        const signature = req.headers['x-webhook-signature'];
        
        // Handle different body formats
        let payload;
        if (Buffer.isBuffer(req.body)) {
            // Body is a Buffer (raw)
            try {
                payload = JSON.parse(req.body.toString('utf8'));
            } catch (parseError) {
                console.error('❌ Failed to parse Buffer body:', parseError);
                return res.status(400).json({ message: 'Invalid webhook payload format' });
            }
        } else if (typeof req.body === 'string') {
            // Body is a string - check if it's valid JSON
            const trimmed = req.body.trim();
            if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                try {
                    payload = JSON.parse(req.body);
                } catch (parseError) {
                    console.error('❌ Failed to parse string body:', parseError, 'Body:', req.body);
                    return res.status(400).json({ message: 'Invalid webhook payload format' });
                }
            } else {
                console.error('❌ Invalid JSON string in webhook body (not starting with { or [):', req.body);
                return res.status(400).json({ message: 'Invalid webhook payload format' });
            }
        } else if (typeof req.body === 'object' && req.body !== null) {
            // Already an object (parsed by global express.json middleware)
            payload = req.body;
        } else {
            console.error('❌ Unexpected webhook body type:', typeof req.body, 'Value:', req.body);
            return res.status(400).json({ message: 'Invalid webhook payload' });
        }
        
        // Validate payload structure
        if (!payload || typeof payload !== 'object') {
            console.error('❌ Invalid payload structure:', payload);
            return res.status(400).json({ message: 'Invalid webhook payload structure' });
        }

        console.log('🔔 Payment webhook received:', payload);

        // Verify signature (optional but recommended)
        // const isValid = cashfreePayment.verifyWebhookSignature(signature, payload);
        // if (!isValid) {
        //   console.error('❌ Invalid webhook signature');
        //   return res.status(401).json({ message: 'Invalid signature' });
        // }

        const { order, payment } = payload.data || {};
        if (!order) {
            return res.status(400).json({ message: 'Invalid payload' });
        }

        const orderId = order.order_id;
        const orderAmount = order.order_amount;
        
        // Determine order status from webhook
        // Cashfree webhook doesn't include order_status directly
        // We need to derive it from payment_status or webhook type
        let orderStatus = 'PENDING'; // Default
        
        if (payment) {
            // If payment_status is SUCCESS, order is PAID
            if (payment.payment_status === 'SUCCESS') {
                orderStatus = 'PAID';
            } else if (payment.payment_status === 'FAILED') {
                orderStatus = 'FAILED';
            }
        }
        
        // Also check webhook type
        if (payload.type === 'PAYMENT_SUCCESS_WEBHOOK') {
            orderStatus = 'PAID';
        } else if (payload.type === 'PAYMENT_FAILED_WEBHOOK' || payload.type === 'PAYMENT_USER_DROPPED_WEBHOOK') {
            orderStatus = 'FAILED';
        }

        console.log(`💰 Webhook order status determined: ${orderStatus} (from payment_status: ${payment?.payment_status}, type: ${payload.type})`);

        // Update payment order status
        await executeQuery(
            `UPDATE payment_orders 
       SET status = ?, webhook_data = ?, updated_at = NOW() 
       WHERE order_id = ?`,
            [orderStatus, JSON.stringify(payload), orderId]
        );

        // If payment succeeded, process based on payment type
        if (orderStatus === 'PAID') {
            const [paymentOrder] = await executeQuery(
                'SELECT loan_id, extension_id, payment_type, user_id FROM payment_orders WHERE order_id = ?',
                [orderId]
            );

            if (paymentOrder) {
                // Check if this is an extension payment
                if (paymentOrder.payment_type === 'extension_fee' && paymentOrder.extension_id) {
                    console.log('✅ Extension payment successful, auto-approving extension:', {
                        extensionId: paymentOrder.extension_id,
                        orderId,
                        amount: orderAmount
                    });

                    try {
                        // First check if extension is already approved (by order-status check) - skip if so
                        const extensionStatusCheck = await executeQuery(
                            `SELECT status, payment_status FROM loan_extensions WHERE id = ?`,
                            [paymentOrder.extension_id]
                        );
                        
                        if (extensionStatusCheck.length > 0) {
                            const extStatus = extensionStatusCheck[0];
                            if (extStatus.status === 'approved' && extStatus.payment_status === 'paid') {
                                console.log(`ℹ️ Extension #${paymentOrder.extension_id} is already approved (by order-status check), skipping webhook processing`);
                                // Skip processing if already approved, but continue to send webhook response
                            } else {
                                // Check if transaction already exists for this order to avoid duplicates
                                const existingTransaction = await executeQuery(
                                    `SELECT id FROM transactions WHERE reference_number = ? AND loan_application_id = ? AND transaction_type LIKE 'loan_extension_%'`,
                                    [orderId, paymentOrder.loan_id]
                                );
                                
                                if (existingTransaction.length > 0) {
                                    console.log(`ℹ️ Transaction already exists for extension payment order ${orderId}, skipping duplicate`);
                                } else {
                                    // Import and use the approval function
                                    const { approveExtension } = require('../utils/extensionApproval');
                                    const approvalResult = await approveExtension(
                                        paymentOrder.extension_id,
                                        orderId, // Use orderId as reference number
                                        null // No admin ID for auto-approval
                                    );

                                    console.log('✅ Extension auto-approved:', approvalResult);

                                    // Send extension letter email after successful payment
                                    try {
                                        const emailService = require('../services/emailService');
                                        const pdfService = require('../services/pdfService');
                                        
                                        // Get extension and loan details for email
                                        const extensionDetails = await executeQuery(`
                                SELECT 
                                    le.*,
                                    la.application_number,
                                    la.processed_at,
                                    la.processed_due_date,
                                    la.plan_snapshot,
                                    u.first_name,
                                    u.last_name,
                                    u.email,
                                    u.personal_email,
                                    u.official_email,
                                    u.salary_date
                                FROM loan_extensions le
                                INNER JOIN loan_applications la ON le.loan_application_id = la.id
                                INNER JOIN users u ON la.user_id = u.id
                                            WHERE le.id = ?
                                        `, [paymentOrder.extension_id]);

                                        if (extensionDetails && extensionDetails.length > 0) {
                                            const ext = extensionDetails[0];
                                            const recipientEmail = ext.personal_email || ext.official_email || ext.email;
                                            
                                            if (recipientEmail) {
                                                try {
                                                    // Get loan details
                                                    const loanDetails = await executeQuery(`
                                            SELECT 
                                                la.*,
                                                u.first_name, u.last_name, u.email, u.personal_email, u.official_email,
                                                u.salary_date
                                            FROM loan_applications la
                                            INNER JOIN users u ON la.user_id = u.id
                                            WHERE la.id = ?
                                        `, [ext.loan_application_id]);
                                        
                                        if (!loanDetails || loanDetails.length === 0) {
                                            console.warn('⚠️ Loan not found for extension letter email');
                                            return;
                                        }
                                        
                                        const loan = loanDetails[0];
                                        
                                        // Get extension letter data (reuse existing logic from kfs.js)
                                        // For now, we'll generate a simple HTML from extension data
                                        // In production, you might want to use the full extension letter template
                                        
                                        // Parse extension dates
                                        let originalDueDate = ext.original_due_date;
                                        let newDueDate = ext.new_due_date;
                                        try {
                                            if (typeof originalDueDate === 'string' && originalDueDate.startsWith('[')) {
                                                const parsed = JSON.parse(originalDueDate);
                                                originalDueDate = Array.isArray(parsed) ? parsed[0] : originalDueDate;
                                            }
                                            if (typeof newDueDate === 'string' && newDueDate.startsWith('[')) {
                                                const parsed = JSON.parse(newDueDate);
                                                newDueDate = Array.isArray(parsed) ? parsed[0] : newDueDate;
                                            }
                                        } catch (e) {
                                            // Keep original values if parsing fails
                                        }
                                        
                                        // Generate HTML content (simplified - you can enhance this to match your template)
                                        const htmlContent = `
                                            <!DOCTYPE html>
                                            <html>
                                            <head>
                                                <meta charset="UTF-8">
                                                <title>Extension Letter</title>
                                            </head>
                                            <body style="font-family: Arial, sans-serif; padding: 20px;">
                                                <h1>Loan Extension Letter</h1>
                                                <p><strong>Application Number:</strong> ${loan.application_number}</p>
                                                <p><strong>Extension Number:</strong> ${ext.extension_number}</p>
                                                <h2>Extension Details</h2>
                                                <p>Extension Fee: ₹${ext.extension_fee}</p>
                                                <p>GST: ₹${ext.gst_amount}</p>
                                                <p>Interest Till Date: ₹${ext.interest_till_date}</p>
                                                <p>Total Amount: ₹${ext.total_extension_amount}</p>
                                                <p>Original Due Date: ${originalDueDate}</p>
                                                <p>New Due Date: ${newDueDate}</p>
                                                <p>Extension Period: ${ext.extension_period_days} days</p>
                                            </body>
                                                        </html>
                                                    `;
                                                    
                                                    // Generate PDF from HTML
                                                    const filename = `Extension_Letter_${loan.application_number}.pdf`;
                                                    const pdfResult = await pdfService.generateKFSPDF(htmlContent, filename);

                                                    // Send email with PDF
                                                    await emailService.sendExtensionLetterEmail({
                                                        loanId: ext.loan_application_id,
                                                        recipientEmail,
                                                        recipientName: `${ext.first_name} ${ext.last_name || ''}`.trim(),
                                                        loanData: {
                                                            application_number: loan.application_number
                                                        },
                                                        pdfBuffer: pdfResult.buffer,
                                                        pdfFilename: filename,
                                                        sentBy: 'system'
                                                    });

                                                    console.log('✅ Extension letter email sent to:', recipientEmail);
                                                } catch (emailError) {
                                                    console.error('❌ Error sending extension letter email (non-fatal):', emailError);
                                                    // Don't fail the webhook if email fails
                                                }
                                            }
                                        }
                                    } catch (emailError) {
                                        console.error('❌ Error sending extension letter email (non-fatal):', emailError);
                                        // Don't fail the webhook if email fails
                                    }
                                }
                            }
                        } else {
                            console.warn(`⚠️ Extension #${paymentOrder.extension_id} not found`);
                        }
                    } catch (approvalError) {
                        console.error('❌ Error auto-approving extension:', approvalError);
                        // Log error but don't fail the webhook - payment was successful
                    }
                } else {
                    // Regular loan repayment
                    // First check if loan is already cleared (by order-status check) - skip if so
                    const loanStatusCheck = await executeQuery(
                        `SELECT status FROM loan_applications WHERE id = ?`,
                        [paymentOrder.loan_id]
                    );
                    
                    if (loanStatusCheck.length > 0 && loanStatusCheck[0].status === 'cleared') {
                        console.log(`ℹ️ Loan #${paymentOrder.loan_id} is already cleared (by order-status check), skipping webhook processing`);
                        // Skip processing if already cleared, but continue to send webhook response
                    } else {
                        // Check if payment record already exists to avoid duplicates
                    const existingPayment = await executeQuery(
                        `SELECT id FROM loan_payments WHERE transaction_id = ? AND loan_id = ?`,
                        [orderId, paymentOrder.loan_id]
                    );
                    
                    if (existingPayment.length === 0) {
                        // Create payment record
                        await executeQuery(
                            `INSERT INTO loan_payments (
                    loan_id, amount, payment_method, transaction_id, status, payment_date
                  ) VALUES (?, ?, 'CASHFREE', ?, 'SUCCESS', NOW())`,
                            [paymentOrder.loan_id, orderAmount, orderId]
                        );
                        console.log(`✅ Loan payment record created for loan: ${paymentOrder.loan_id}`);
                        
                        // Get loan details to determine transaction type and get user_id
                        const loanInfo = await executeQuery(
                            `SELECT user_id, application_number FROM loan_applications WHERE id = ?`,
                            [paymentOrder.loan_id]
                        );
                        
                        if (loanInfo.length > 0) {
                            const userId = paymentOrder.user_id || loanInfo[0].user_id;
                            const applicationNumber = loanInfo[0].application_number;
                            
                            // Create transaction record for admin visibility
                            // Transaction type will be determined after checking if loan is fully paid
                            // For now, we'll use 'emi_paid' and update to 'full_payment' if loan is cleared
                            await executeQuery(
                                `INSERT INTO transactions (
                                    user_id, loan_application_id, transaction_type, amount, description,
                                    category, payment_method, reference_number, transaction_date,
                                    status, priority, created_at, updated_at
                                ) VALUES (?, ?, 'emi_paid', ?, ?, 'loan', 'cashfree', ?, CURDATE(), 'completed', 'high', NOW(), NOW())`,
                                [
                                    userId,
                                    paymentOrder.loan_id,
                                    orderAmount,
                                    `Loan repayment via Cashfree - Order ID: ${orderId}, Application: ${applicationNumber}`,
                                    orderId
                                ]
                            );
                            console.log(`✅ Transaction record created for loan repayment`);
                        }
                    } else {
                        console.log(`ℹ️ Payment record already exists for order ${orderId}, skipping duplicate`);
                    }

                    // Check if loan is fully paid and should be marked as cleared
                    try {
                        // Get loan details to calculate outstanding balance
                        const loanDetails = await executeQuery(
                            `SELECT 
                                id, processed_amount, sanctioned_amount, loan_amount,
                                processed_post_service_fee, fees_breakdown, plan_snapshot,
                                status
                            FROM loan_applications 
                            WHERE id = ?`,
                            [paymentOrder.loan_id]
                        );

                        if (loanDetails.length > 0) {
                            const loan = loanDetails[0];
                            
                            // Only check for cleared status if loan is in account_manager status
                            // (Skip if already cleared by order-status check)
                            if (loan.status === 'account_manager') {
                                // Calculate total payments made for this loan (including the one we just added)
                                const totalPaymentsResult = await executeQuery(
                                    `SELECT COALESCE(SUM(amount), 0) as total_paid 
                                     FROM loan_payments 
                                     WHERE loan_id = ? AND status = 'SUCCESS'`,
                                    [paymentOrder.loan_id]
                                );
                                
                                const totalPaid = parseFloat(totalPaymentsResult[0]?.total_paid || 0);
                                
                                // Calculate outstanding balance using the same logic as extension calculations
                                const { calculateOutstandingBalance } = require('../utils/extensionCalculations');
                                const outstandingBalance = calculateOutstandingBalance(loan);
                                
                                console.log(`💰 Payment check for loan #${paymentOrder.loan_id}:`, {
                                    totalPaid: totalPaid,
                                    outstandingBalance: outstandingBalance,
                                    remaining: outstandingBalance - totalPaid
                                });
                                
                                // If total payments >= outstanding balance (with small tolerance for rounding)
                                if (totalPaid >= outstandingBalance - 0.01) {
                                    // Mark loan as cleared
                                    await executeQuery(
                                        `UPDATE loan_applications 
                                         SET status = 'cleared', updated_at = NOW() 
                                         WHERE id = ?`,
                                        [paymentOrder.loan_id]
                                    );
                                    
                                    // Update transaction type to 'full_payment' if it was created as 'emi_paid'
                                    await executeQuery(
                                        `UPDATE transactions 
                                         SET transaction_type = 'full_payment',
                                             description = CONCAT(description, ' - Full payment received, loan cleared')
                                         WHERE reference_number = ? AND transaction_type = 'emi_paid' AND loan_application_id = ?`,
                                        [orderId, paymentOrder.loan_id]
                                    );
                                    
                                    console.log(`✅ Loan #${paymentOrder.loan_id} fully paid and marked as CLEARED`, {
                                        totalPaid: totalPaid,
                                        outstandingBalance: outstandingBalance
                                    });
                                } else {
                                    // Loan not fully paid yet, keep as account_manager (don't update status)
                                    console.log(`ℹ️ Loan #${paymentOrder.loan_id} payment received but not fully paid yet`, {
                                        totalPaid: totalPaid,
                                        outstandingBalance: outstandingBalance,
                                        remaining: outstandingBalance - totalPaid
                                    });
                                }
                            } else {
                                console.log(`ℹ️ Loan #${paymentOrder.loan_id} status is '${loan.status}', skipping clearance check`);
                            }
                        }
                    } catch (clearanceError) {
                        console.error('❌ Error checking if loan should be cleared:', clearanceError);
                        // Don't fail the webhook - payment was successful, just log the error
                    }

                    console.log('✅ Loan payment processed:', {
                        loanId: paymentOrder.loan_id,
                        amount: orderAmount
                    });
                    }
                }
            }
        }

        res.json({ success: true });

    } catch (error) {
        console.error('❌ Webhook processing error:', error);
        res.status(500).json({ message: 'Webhook processing failed' });
    }
});

/**
 * GET /api/payment/pending
 * Get all pending payment orders for the authenticated user
 */
router.get('/pending', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log(`🔍 Fetching pending payments for user: ${userId}`);

        // Fetch all pending payment orders for the user
        const orders = await executeQuery(
            `SELECT 
                po.id,
                po.order_id,
                po.loan_id,
                po.extension_id,
                po.amount,
                po.payment_type,
                po.status,
                po.payment_session_id,
                po.created_at,
                po.updated_at,
                la.application_number,
                la.loan_amount as loan_amount,
                la.status as loan_status
            FROM payment_orders po
            LEFT JOIN loan_applications la ON po.loan_id = la.id
            WHERE po.user_id = ? AND po.status = 'PENDING'
            ORDER BY po.created_at DESC`,
            [userId]
        );

        console.log(`📊 Found ${orders.length} pending payment orders`);

        // Optionally fetch fresh status from Cashfree for each order (but don't fail if it errors)
        const ordersWithStatus = await Promise.all(
            orders.map(async (order) => {
                try {
                    const cashfreeStatus = await cashfreePayment.getOrderStatus(order.order_id);
                    // If Cashfree shows PAID, update our database
                    if (cashfreeStatus.data && cashfreeStatus.data.order_status === 'PAID') {
                        console.log(`💰 Order ${order.order_id} is PAID in Cashfree, updating status...`);
                        await executeQuery(
                            `UPDATE payment_orders SET status = 'PAID', updated_at = NOW() WHERE order_id = ?`,
                            [order.order_id]
                        );
                        // Process the payment if it's paid
                        // (This would trigger the webhook processing logic)
                    }
                    return {
                        ...order,
                        cashfreeStatus: cashfreeStatus.data || null
                    };
                } catch (error) {
                    console.error(`❌ Error fetching Cashfree status for order ${order.order_id}:`, error);
                    return {
                        ...order,
                        cashfreeStatus: null
                    };
                }
            })
        );

        res.json({
            success: true,
            data: {
                orders: ordersWithStatus,
                count: ordersWithStatus.length
            }
        });

    } catch (error) {
        console.error('❌ Error fetching pending payments:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch pending payments',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * GET /api/payment/order-status/:orderId
 * Get payment order status from both database and Cashfree API
 * This endpoint calls Cashfree API to get the latest payment status
 */
router.get('/order-status/:orderId', authenticateToken, async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.user.id;

        console.log(`🔍 Checking payment status for order: ${orderId}, user: ${userId}`);

        // Fetch from database first
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

        // Always fetch fresh status from Cashfree API (backend call)
        console.log(`📞 Calling Cashfree API to get order status for: ${orderId}`);
        const cashfreeStatus = await cashfreePayment.getOrderStatus(orderId);

        if (!cashfreeStatus.success) {
            console.error(`❌ Failed to fetch status from Cashfree:`, cashfreeStatus.error);
            // Return database status if Cashfree call fails
            return res.json({
                success: true,
                data: {
                    ...order,
                    cashfreeStatus: null,
                    error: 'Failed to fetch status from Cashfree',
                    note: 'Showing database status only'
                }
            });
        }

        // Extract order status from Cashfree response
        const cashfreeOrderStatus = cashfreeStatus.orderStatus || 
                                   cashfreeStatus.data?.order_status || 
                                   cashfreeStatus.data?.order?.order_status;
        const paymentReceived = cashfreeStatus.paymentReceived || (cashfreeOrderStatus === 'PAID');
        
        console.log(`💰 Cashfree order status: ${cashfreeOrderStatus}, Payment received: ${paymentReceived}`);

        // If Cashfree shows payment is PAID, process it regardless of DB status
        // This handles cases where payment was successful but processing failed
        if (paymentReceived) {
            // Update DB status if it's still PENDING
            if (order.status === 'PENDING') {
                console.log(`🔄 Updating order status from PENDING to PAID in database`);
                await executeQuery(
                    `UPDATE payment_orders SET status = 'PAID', updated_at = NOW() WHERE order_id = ?`,
                    [orderId]
                );
                order.status = 'PAID';
            } else if (order.status === 'PAID') {
                console.log(`ℹ️ Order is already PAID in database, but checking if payment needs to be processed`);
            }
            
            // Process the payment (similar to webhook processing)
            // This will handle cases where payment is PAID but loan/extension wasn't processed
            try {
                const [paymentOrder] = await executeQuery(
                    'SELECT loan_id, extension_id, payment_type, amount, user_id FROM payment_orders WHERE order_id = ?',
                    [orderId]
                );

                if (paymentOrder) {
                    if (paymentOrder.payment_type === 'loan_repayment') {
                        // Process loan repayment
                        console.log(`💳 Processing loan repayment for loan: ${paymentOrder.loan_id}`);
                        
                        // First check if loan is already cleared (by webhook) - skip if so
                        const loanStatusCheck = await executeQuery(
                            `SELECT status FROM loan_applications WHERE id = ?`,
                            [paymentOrder.loan_id]
                        );
                        
                        if (loanStatusCheck.length > 0 && loanStatusCheck[0].status === 'cleared') {
                            console.log(`ℹ️ Loan #${paymentOrder.loan_id} is already cleared (by webhook), skipping order-status processing`);
                            // Still return the order data, just skip processing
                        } else {
                            // Check if payment record already exists to avoid duplicates
                            const existingPayment = await executeQuery(
                                `SELECT id FROM loan_payments WHERE transaction_id = ? AND loan_id = ?`,
                                [orderId, paymentOrder.loan_id]
                            );
                            
                            if (existingPayment.length === 0) {
                                // Create payment record
                                await executeQuery(
                                    `INSERT INTO loan_payments (
                                        loan_id, amount, payment_method, transaction_id, status, payment_date
                                    ) VALUES (?, ?, 'CASHFREE', ?, 'SUCCESS', NOW())`,
                                    [paymentOrder.loan_id, paymentOrder.amount, orderId]
                                );
                                console.log(`✅ Loan payment record created for loan: ${paymentOrder.loan_id}`);
                                
                                // Get loan details to determine transaction type and get user_id
                                const loanInfo = await executeQuery(
                                    `SELECT user_id, application_number FROM loan_applications WHERE id = ?`,
                                    [paymentOrder.loan_id]
                                );
                                
                                if (loanInfo.length > 0) {
                                    const userId = paymentOrder.user_id || loanInfo[0].user_id;
                                    const applicationNumber = loanInfo[0].application_number;
                                    
                                    // Create transaction record for admin visibility
                                    await executeQuery(
                                        `INSERT INTO transactions (
                                            user_id, loan_application_id, transaction_type, amount, description,
                                            category, payment_method, reference_number, transaction_date,
                                            status, priority, created_at, updated_at
                                        ) VALUES (?, ?, 'emi_paid', ?, ?, 'loan', 'cashfree', ?, CURDATE(), 'completed', 'high', NOW(), NOW())`,
                                        [
                                            userId,
                                            paymentOrder.loan_id,
                                            paymentOrder.amount,
                                            `Loan repayment via Cashfree - Order ID: ${orderId}, Application: ${applicationNumber}`,
                                            orderId
                                        ]
                                    );
                                    console.log(`✅ Transaction record created for loan repayment`);
                                }
                                
                                // Check if loan should be marked as cleared
                                try {
                                    const loanDetails = await executeQuery(
                                        `SELECT 
                                            id, processed_amount, sanctioned_amount, loan_amount,
                                            processed_post_service_fee, fees_breakdown, plan_snapshot,
                                            status
                                        FROM loan_applications 
                                        WHERE id = ?`,
                                        [paymentOrder.loan_id]
                                    );

                                    if (loanDetails.length > 0) {
                                        const loan = loanDetails[0];
                                        
                                        // Only process if not already cleared (double-check)
                                        if (loan.status === 'account_manager') {
                                            const totalPaymentsResult = await executeQuery(
                                                `SELECT COALESCE(SUM(amount), 0) as total_paid 
                                                 FROM loan_payments 
                                                 WHERE loan_id = ? AND status = 'SUCCESS'`,
                                                [paymentOrder.loan_id]
                                            );
                                            
                                            const totalPaid = parseFloat(totalPaymentsResult[0]?.total_paid || 0);
                                            
                                            const { calculateOutstandingBalance } = require('../utils/extensionCalculations');
                                            const outstandingBalance = calculateOutstandingBalance(loan);
                                            
                                            console.log(`💰 Payment check for loan #${paymentOrder.loan_id}:`, {
                                                totalPaid: totalPaid,
                                                outstandingBalance: outstandingBalance,
                                                remaining: outstandingBalance - totalPaid
                                            });
                                            
                                        if (totalPaid >= outstandingBalance - 0.01) {
                                            await executeQuery(
                                                `UPDATE loan_applications 
                                                 SET status = 'cleared', updated_at = NOW() 
                                                 WHERE id = ?`,
                                                [paymentOrder.loan_id]
                                            );
                                            
                                            // Update transaction type to 'full_payment' if it was created as 'emi_paid'
                                            await executeQuery(
                                                `UPDATE transactions 
                                                 SET transaction_type = 'full_payment',
                                                     description = CONCAT(description, ' - Full payment received, loan cleared')
                                                 WHERE reference_number = ? AND transaction_type = 'emi_paid' AND loan_application_id = ?`,
                                                [orderId, paymentOrder.loan_id]
                                            );
                                            
                                            console.log(`✅ Loan #${paymentOrder.loan_id} fully paid and marked as CLEARED`);
                                        } else {
                                                console.log(`ℹ️ Loan #${paymentOrder.loan_id} payment received but not fully paid yet`);
                                            }
                                        } else {
                                            console.log(`ℹ️ Loan #${paymentOrder.loan_id} status is '${loan.status}', skipping clearance check`);
                                        }
                                    }
                                } catch (clearanceError) {
                                    console.error('❌ Error checking if loan should be cleared:', clearanceError);
                                }
                            } else {
                                console.log(`ℹ️ Payment record already exists for order ${orderId}, skipping duplicate`);
                            }
                        }
                    } else if (paymentOrder.payment_type === 'extension_fee' && paymentOrder.extension_id) {
                        // Process extension payment
                        console.log(`📅 Processing extension payment for extension: ${paymentOrder.extension_id}`);
                        
                        // First check if extension is already approved (by webhook) - skip if so
                        const extensionStatusCheck = await executeQuery(
                            `SELECT status, payment_status FROM loan_extensions WHERE id = ?`,
                            [paymentOrder.extension_id]
                        );
                        
                        if (extensionStatusCheck.length > 0) {
                            const extStatus = extensionStatusCheck[0];
                            if (extStatus.status === 'approved' && extStatus.payment_status === 'paid') {
                                console.log(`ℹ️ Extension #${paymentOrder.extension_id} is already approved (by webhook), skipping order-status processing`);
                                // Skip processing if already approved
                            } else {
                                // Check if transaction already exists for this order to avoid duplicates
                                const existingTransaction = await executeQuery(
                                    `SELECT id FROM transactions WHERE reference_number = ? AND loan_application_id = ? AND transaction_type LIKE 'loan_extension_%'`,
                                    [orderId, paymentOrder.loan_id]
                                );
                                
                                if (existingTransaction.length > 0) {
                                    console.log(`ℹ️ Transaction already exists for extension payment order ${orderId}, skipping duplicate`);
                                } else {
                                    try {
                                        const { approveExtension } = require('../utils/extensionApproval');
                                        const approvalResult = await approveExtension(
                                            paymentOrder.extension_id,
                                            orderId,
                                            null
                                        );
                                        console.log('✅ Extension auto-approved:', approvalResult);
                                    } catch (approvalError) {
                                        console.error('❌ Error auto-approving extension:', approvalError);
                                    }
                                }
                            }
                        } else {
                            console.warn(`⚠️ Extension #${paymentOrder.extension_id} not found`);
                        }
                    }
                }
            } catch (processError) {
                console.error('❌ Error processing payment:', processError);
                // Don't fail the response, just log the error
            }
        }

        res.json({
            success: true,
            data: {
                ...order,
                status: order.status, // Updated status if changed
                cashfreeStatus: cashfreeStatus.data,
                paymentReceived: paymentReceived,
                paymentStatus: cashfreeOrderStatus || order.status,
                // Additional payment info if available
                cfOrderId: cashfreeStatus.data?.cf_order_id || null,
                orderAmount: cashfreeStatus.data?.order_amount || order.amount
            }
        });

    } catch (error) {
        console.error('❌ Error fetching order status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch order status',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;
