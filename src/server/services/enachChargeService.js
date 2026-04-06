const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { executeQuery, initializeDatabase } = require('../config/database');

const CASHFREE_API_BASE = process.env.CASHFREE_API_BASE || 'https://sandbox.cashfree.com/pg';
const CASHFREE_CLIENT_ID = process.env.CASHFREE_CLIENT_ID;
const CASHFREE_CLIENT_SECRET = process.env.CASHFREE_CLIENT_SECRET;
const CASHFREE_API_VERSION = process.env.CASHFREE_API_VERSION || '2025-01-01';

function getCashfreeHeaders(idempotencyKey = null) {
  const headers = {
    'Content-Type': 'application/json',
    'x-api-version': CASHFREE_API_VERSION,
    'x-client-id': CASHFREE_CLIENT_ID,
    'x-client-secret': CASHFREE_CLIENT_SECRET,
    'x-request-id': uuidv4(),
    'x-idempotency-key': idempotencyKey || uuidv4()
  };
  return headers;
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (e) {
    return fallback;
  }
}

async function chargeSubscription({ userId, dbSubscriptionId, amount, source = 'manual' }) {
  await initializeDatabase();

  if (!CASHFREE_CLIENT_ID || !CASHFREE_CLIENT_SECRET) {
    throw new Error('Cashfree eNACH credentials are not configured');
  }

  const subscriptions = await executeQuery(
    `SELECT es.*
     FROM enach_subscriptions es
     WHERE es.id = ? AND es.user_id = ?`,
    [dbSubscriptionId, userId]
  );

  if (!subscriptions || subscriptions.length === 0) {
    throw new Error('eNACH subscription not found');
  }

  const subscription = subscriptions[0];
  const merchantSubscriptionId = subscription.subscription_id;
  const cfSubscriptionId = subscription.cf_subscription_id;
  const subscriptionIdToUse = merchantSubscriptionId || cfSubscriptionId;

  if (!subscriptionIdToUse) {
    throw new Error('No subscription identifier available for charge');
  }

  const chargeAmount = Number(amount);
  if (!Number.isFinite(chargeAmount) || chargeAmount <= 0) {
    throw new Error('Invalid charge amount');
  }

  const paymentId = `charge_${subscriptionIdToUse}_${Date.now()}`;
  const chargePayload = {
    subscription_id: subscriptionIdToUse,
    payment_id: paymentId,
    payment_type: 'CHARGE',
    payment_amount: chargeAmount,
    payment_currency: 'INR'
  };

  const headers = getCashfreeHeaders(paymentId);
  const chargeUrl = `${CASHFREE_API_BASE}/subscriptions/pay`;

  try {
    const chargeResponse = await axios.post(chargeUrl, chargePayload, {
      headers,
      timeout: 60000
    });

    const paymentStatus = chargeResponse.data?.payment_status || 'PENDING';
    const cfPaymentId = chargeResponse.data?.cf_payment_id || null;

    await executeQuery(
      `INSERT INTO enach_charge_requests
      (user_id, subscription_id, db_subscription_id, payment_id, cf_payment_id, amount, status,
       request_data, response_data, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        userId,
        subscriptionIdToUse,
        dbSubscriptionId,
        paymentId,
        cfPaymentId,
        chargeAmount,
        paymentStatus,
        JSON.stringify(chargePayload),
        JSON.stringify(chargeResponse.data || {})
      ]
    );

    return {
      success: true,
      status: paymentStatus,
      paymentId,
      cfPaymentId,
      subscriptionId: subscriptionIdToUse,
      response: chargeResponse.data || {}
    };
  } catch (error) {
    await executeQuery(
      `INSERT INTO enach_charge_requests
      (user_id, subscription_id, db_subscription_id, payment_id, amount, status,
       request_data, response_data, error_message, created_at)
      VALUES (?, ?, ?, ?, ?, 'FAILED', ?, ?, ?, NOW())`,
      [
        userId,
        subscriptionIdToUse,
        dbSubscriptionId,
        paymentId,
        chargeAmount,
        JSON.stringify(chargePayload),
        JSON.stringify(error.response?.data || {}),
        error.message
      ]
    );

    return {
      success: false,
      status: 'FAILED',
      paymentId,
      subscriptionId: subscriptionIdToUse,
      response: error.response?.data || null,
      error: error.message
    };
  }
}

async function fetchChargeStatus(subscriptionId, paymentId) {
  if (!CASHFREE_CLIENT_ID || !CASHFREE_CLIENT_SECRET) {
    throw new Error('Cashfree eNACH credentials are not configured');
  }

  const headers = getCashfreeHeaders();
  const url = `${CASHFREE_API_BASE}/subscriptions/${subscriptionId}/payments/${paymentId}`;
  const response = await axios.get(url, { headers, timeout: 30000 });
  return response.data || {};
}

async function applySuccessfulChargeToLoan({ loanApplicationId, paymentId, amount }) {
  await initializeDatabase();
  const loans = await executeQuery(
    `SELECT id, status, user_id, emi_schedule, total_repayable
     FROM loan_applications
     WHERE id = ?`,
    [loanApplicationId]
  );

  if (!loans || loans.length === 0) {
    return { updated: false, reason: 'loan_not_found' };
  }

  const loan = loans[0];
  if (!loan.emi_schedule) {
    return { updated: false, reason: 'emi_schedule_missing' };
  }

  const schedule = parseJson(loan.emi_schedule, null);
  if (!Array.isArray(schedule) || schedule.length === 0) {
    return { updated: false, reason: 'emi_schedule_invalid' };
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  let targetIndex = -1;

  for (let i = 0; i < schedule.length; i++) {
    const emi = schedule[i];
    const status = String(emi.status || '').toLowerCase();
    const dueDate = String(emi.due_date || emi.dueDate || '').split('T')[0].split(' ')[0];
    if (status !== 'paid' && dueDate <= todayStr) {
      targetIndex = i;
      break;
    }
  }

  if (targetIndex === -1) {
    return { updated: false, reason: 'no_unpaid_due_emi' };
  }

  schedule[targetIndex] = {
    ...schedule[targetIndex],
    status: 'paid',
    paid_date: todayStr
  };

  await executeQuery(
    `UPDATE loan_applications
     SET emi_schedule = ?, updated_at = NOW()
     WHERE id = ?`,
    [JSON.stringify(schedule), loanApplicationId]
  );

  const existingPayment = await executeQuery(
    `SELECT id FROM loan_payments WHERE transaction_id = ? AND loan_id = ? LIMIT 1`,
    [paymentId, loanApplicationId]
  );
  if (!existingPayment || existingPayment.length === 0) {
    await executeQuery(
      `INSERT INTO loan_payments (loan_id, amount, payment_method, transaction_id, status, payment_date)
       VALUES (?, ?, 'ENACH', ?, 'SUCCESS', NOW())`,
      [loanApplicationId, Number(amount) || 0, paymentId]
    );
  }

  const allPaid = schedule.every((emi) => String(emi.status || '').toLowerCase() === 'paid');
  if (allPaid && loan.status === 'account_manager') {
    await executeQuery(
      `UPDATE loan_applications
       SET status = 'cleared', closed_date = CURDATE(), closed_amount = ?, updated_at = NOW()
       WHERE id = ?`,
      [Number(loan.total_repayable) || 0, loanApplicationId]
    );
  }

  return { updated: true, emiNumber: targetIndex + 1, allPaid };
}

module.exports = {
  chargeSubscription,
  fetchChargeStatus,
  applySuccessfulChargeToLoan
};
