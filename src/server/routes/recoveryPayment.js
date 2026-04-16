/**
 * Public recovery payment link API (no user JWT).
 * Admin creates links via /api/admin/user-profile/:userId/recovery-payment-links
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { executeQuery, initializeDatabase } = require('../config/database');
const cashfreePayment = require('../services/cashfreePayment');

const router = express.Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Public order status for recovery Cashfree orders (return URL without user session).
 * GET /api/recovery-payment/order-status/:orderId
 */
router.get('/order-status/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId || !String(orderId).startsWith('RCY_')) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    await initializeDatabase();

    const rows = await executeQuery(
      `SELECT po.order_id, po.status, po.amount, po.payment_type, po.loan_id,
              la.status AS loan_status
       FROM payment_orders po
       INNER JOIN recovery_payment_links r ON r.id = po.recovery_link_id
       LEFT JOIN loan_applications la ON la.id = po.loan_id
       WHERE po.order_id = ? AND po.recovery_link_id IS NOT NULL
       LIMIT 1`,
      [orderId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    return res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('[recovery-payment] order-status error:', error);
    res.status(500).json({ success: false, message: 'Failed to load order status' });
  }
});

const recoveryCheckoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Try again later.' }
});

function paymentTypeLabel(paymentType) {
  if (!paymentType) return 'Payment';
  const map = {
    'pre-close': 'Pre-close',
    full_payment: 'Full payment',
    loan_repayment: 'Loan repayment (partial / negotiated)',
    emi_1st: 'EMI 1',
    emi_2nd: 'EMI 2',
    emi_3rd: 'EMI 3',
    emi_4th: 'EMI 4'
  };
  if (map[paymentType]) return map[paymentType];
  return paymentType.replace(/_/g, ' ');
}

/**
 * GET /api/recovery-payment/:publicSlug
 */
router.get('/:publicSlug', async (req, res) => {
  try {
    const { publicSlug } = req.params;
    if (!UUID_RE.test(publicSlug)) {
      return res.status(404).json({ success: false, message: 'Link not found' });
    }

    await initializeDatabase();

    const rows = await executeQuery(
      `SELECT 
        r.id,
        r.public_slug,
        r.status,
        r.amount,
        r.payment_type,
        r.loan_application_id,
        la.application_number,
        la.status AS loan_status,
        u.first_name
      FROM recovery_payment_links r
      INNER JOIN loan_applications la ON la.id = r.loan_application_id
      INNER JOIN users u ON u.id = r.user_id
      WHERE r.public_slug = ?
      LIMIT 1`,
      [publicSlug]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Link not found' });
    }

    const row = rows[0];
    const shortLoanId = row.application_number
      ? String(row.application_number)
      : `PLL${row.loan_application_id}`;

    return res.json({
      success: true,
      data: {
        status: row.status,
        amount: parseFloat(row.amount),
        payment_type: row.payment_type,
        payment_type_label: paymentTypeLabel(row.payment_type),
        loan_application_id: row.loan_application_id,
        application_number: row.application_number,
        short_loan_id: shortLoanId,
        loan_status: row.loan_status,
        borrower_first_name: row.first_name || null
      }
    });
  } catch (error) {
    console.error('[recovery-payment] GET error:', error);
    res.status(500).json({ success: false, message: 'Failed to load payment link' });
  }
});

/**
 * POST /api/recovery-payment/:publicSlug/create-checkout
 */
router.post('/:publicSlug/create-checkout', recoveryCheckoutLimiter, async (req, res) => {
  let orderId = null;
  try {
    const { publicSlug } = req.params;
    if (!UUID_RE.test(publicSlug)) {
      return res.status(404).json({ success: false, message: 'Link not found' });
    }

    await initializeDatabase();

    const linkRows = await executeQuery(
      `SELECT r.*, la.application_number, la.status AS loan_status,
              u.first_name, u.last_name, u.email, u.personal_email, u.official_email, u.phone
       FROM recovery_payment_links r
       INNER JOIN loan_applications la ON la.id = r.loan_application_id
       INNER JOIN users u ON u.id = r.user_id
       WHERE r.public_slug = ?
       LIMIT 1`,
      [publicSlug]
    );

    if (!linkRows || linkRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Link not found' });
    }

    const recovery = linkRows[0];

    if (recovery.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: recovery.status === 'paid' ? 'This link has already been paid.' : 'This link is no longer valid.'
      });
    }

    if (recovery.loan_status === 'cleared') {
      return res.status(400).json({
        success: false,
        message: 'This loan has already been cleared.'
      });
    }

    const customerEmail = recovery.personal_email || recovery.official_email || recovery.email;
    if (!customerEmail || String(customerEmail).trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Customer email is required for payment. Please contact support.'
      });
    }

    const finalAmount = parseFloat(recovery.amount);
    if (!finalAmount || finalAmount <= 0 || isNaN(finalAmount)) {
      return res.status(400).json({ success: false, message: 'Invalid payment amount' });
    }

    const loanId = recovery.loan_application_id;
    const userId = recovery.user_id;
    const recoveryLinkId = recovery.id;

    // Reuse recent pending order for same recovery link (same amount, < 30 min)
    const pendingOrders = await executeQuery(
      `SELECT order_id, amount, payment_session_id, created_at
       FROM payment_orders
       WHERE recovery_link_id = ? AND status = 'PENDING'
       ORDER BY created_at DESC
       LIMIT 1`,
      [recoveryLinkId]
    );

    if (pendingOrders.length > 0) {
      const existing = pendingOrders[0];
      const existingAmount = parseFloat(existing.amount || 0);
      if (Math.abs(existingAmount - finalAmount) <= 0.01) {
        const orderAge = Date.now() - new Date(existing.created_at).getTime();
        const thirtyMinutes = 30 * 60 * 1000;
        if (orderAge <= thirtyMinutes && existing.payment_session_id) {
          const checkoutUrl = cashfreePayment.getCheckoutUrl({
            payment_session_id: existing.payment_session_id
          });
          return res.json({
            success: true,
            message: 'Existing payment session',
            data: {
              orderId: existing.order_id,
              paymentSessionId: existing.payment_session_id,
              checkoutUrl
            }
          });
        }
        await executeQuery(
          `UPDATE payment_orders SET status = 'EXPIRED', updated_at = NOW() WHERE order_id = ?`,
          [existing.order_id]
        );
      }
    }

    orderId = `RCY_${recoveryLinkId}_${Date.now()}`;

    await executeQuery(
      `INSERT INTO payment_orders (
        order_id, loan_id, user_id, amount, payment_type, status, recovery_link_id, created_at
      ) VALUES (?, ?, ?, ?, ?, 'PENDING', ?, NOW())`,
      [orderId, loanId, userId, finalAmount, recovery.payment_type, recoveryLinkId]
    );

    await executeQuery(
      `UPDATE recovery_payment_links SET last_order_id = ?, updated_at = NOW() WHERE id = ?`,
      [orderId, recoveryLinkId]
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const backendUrl = process.env.BACKEND_URL || process.env.APP_URL || 'http://localhost:3002';
    const returnUrl = `${frontendUrl}/payment/return?orderId=${encodeURIComponent(orderId)}`;
    const notifyUrl = `${backendUrl}/api/payment/webhook`;

    const customerName =
      `${recovery.first_name || ''} ${recovery.last_name || ''}`.trim() || 'Customer';

    const orderResult = await cashfreePayment.createOrder({
      orderId,
      amount: finalAmount,
      customerName,
      customerEmail,
      customerPhone: recovery.phone || '9999999999',
      returnUrl,
      notifyUrl
    });

    if (!orderResult.success) {
      await executeQuery(
        `UPDATE payment_orders SET status = 'FAILED', updated_at = NOW() WHERE order_id = ?`,
        [orderId]
      );
      return res.status(orderResult.statusCode || 500).json({
        success: false,
        message: orderResult.error || 'Failed to create payment order'
      });
    }

    let paymentSessionId = orderResult.data.payment_session_id;
    if (!paymentSessionId) {
      return res.status(500).json({
        success: false,
        message: 'Payment gateway did not return a valid session.'
      });
    }

    const cleanSessionId = paymentSessionId
      .trim()
      .split(/\s+/)[0]
      .replace(/[^a-zA-Z0-9_\-]/g, '')
      .replace(/paymentpayment$/i, '');

    if (!cleanSessionId.startsWith('session_')) {
      return res.status(500).json({
        success: false,
        message: 'Invalid payment session from gateway.'
      });
    }

    await executeQuery(
      `UPDATE payment_orders 
       SET payment_session_id = ?, cashfree_response = ? 
       WHERE order_id = ?`,
      [cleanSessionId, JSON.stringify(orderResult.data), orderId]
    );

    const cleanOrderResponse = {
      ...orderResult.data,
      payment_session_id: cleanSessionId
    };
    const checkoutUrl = cashfreePayment.getCheckoutUrl(cleanOrderResponse);

    return res.json({
      success: true,
      data: {
        orderId,
        paymentSessionId: cleanSessionId,
        checkoutUrl
      }
    });
  } catch (error) {
    console.error('[recovery-payment] create-checkout error:', error);
    if (orderId) {
      try {
        await executeQuery(
          `UPDATE payment_orders SET status = 'FAILED', updated_at = NOW() WHERE order_id = ?`,
          [orderId]
        );
      } catch (e) {
        /* ignore */
      }
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to start payment'
    });
  }
});

module.exports = router;
