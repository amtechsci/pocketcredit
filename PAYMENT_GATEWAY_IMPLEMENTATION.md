# 💳 Payment Gateway Implementation Guide

This document describes the payment gateway integration for the "Repay Now" button on the repayment schedule page.

## 🎯 Overview

The payment gateway uses **Cashfree** for processing one-time loan repayment transactions. Users can click the "Repay Now" button to initiate a payment through Cashfree's hosted checkout page.

## 📋 Features

- ✅ One-time payment processing via Cashfree
- ✅ Hosted checkout page (no need to handle card details)
- ✅ Payment success/failure handling
- ✅ Webhook integration for payment status updates
- ✅ Production and sandbox environment support
- ✅ Payment order tracking in database

## 🗄️ Database Tables

### payment_orders

Stores all payment orders created for loan repayments.

**Key Fields:**
- `order_id` - Unique order identifier
- `loan_id` - Reference to loan application
- `user_id` - Reference to user
- `amount` - Payment amount
- `status` - PENDING, PAID, FAILED, CANCELLED, EXPIRED
- `payment_session_id` - Cashfree session ID
- `transaction_id` - Cashfree transaction ID

**Migration:**
```bash
cd src/server
node migrations/create_payment_orders_table.js
```

## 🔧 Configuration

### Environment Variables

Add to `src/server/.env`:

```bash
# Cashfree Payment Gateway (uses same credentials as eNACH)
CASHFREE_API_BASE=https://api.cashfree.com/pg  # or https://sandbox.cashfree.com/pg
CASHFREE_CLIENT_ID=your-client-id
CASHFREE_CLIENT_SECRET=your-client-secret
CASHFREE_API_VERSION=2023-08-01

# Application URLs
FRONTEND_URL=https://yourdomain.com
BACKEND_URL=https://api.yourdomain.com  # or http://localhost:3001 for dev
```

## 🔄 Payment Flow

### 1. User Clicks "Repay Now"

- User is on `/repayment-schedule` page
- Clicks "Repay Now" button
- Frontend calls `POST /api/payment/create-order`

### 2. Create Payment Order

**Endpoint:** `POST /api/payment/create-order`

**Request:**
```json
{
  "loanId": 123,
  "amount": 5000.00
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "orderId": "LOAN_APP123_1234567890",
    "paymentSessionId": "session_abc123",
    "checkoutUrl": "https://payments.cashfree.com/forms/session_abc123"
  }
}
```

### 3. Redirect to Cashfree

- User is redirected to Cashfree hosted checkout page
- User completes payment (UPI, Net Banking, Card, etc.)
- Cashfree processes payment

### 4. Payment Return

- User is redirected back to `/payment/return?orderId=LOAN_APP123_1234567890`
- Frontend fetches payment status
- Shows success/failure message

### 5. Webhook Processing

- Cashfree sends webhook to `/api/payment/webhook`
- Backend updates payment order status
- Creates transaction record
- Updates loan status if fully paid

## 📁 File Structure

```
src/
├── server/
│   ├── routes/
│   │   └── payment.js          # Payment API routes
│   ├── services/
│   │   └── cashfreePayment.js   # Cashfree payment service
│   └── migrations/
│       ├── create_payment_orders_table.sql
│       └── create_payment_orders_table.js
└── components/
    └── pages/
        ├── RepaymentSchedulePage.tsx  # "Repay Now" button
        └── PaymentReturnPage.tsx     # Payment return page
```

## 🔌 API Endpoints

### POST /api/payment/create-order

Create a new payment order for loan repayment.

**Authentication:** Required (JWT token)

**Request Body:**
```json
{
  "loanId": 123,
  "amount": 5000.00
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "orderId": "LOAN_APP123_1234567890",
    "paymentSessionId": "session_abc123",
    "checkoutUrl": "https://payments.cashfree.com/forms/session_abc123"
  }
}
```

### GET /api/payment/order-status/:orderId

Get payment order status.

**Authentication:** Required (JWT token)

**Response:**
```json
{
  "success": true,
  "data": {
    "order_id": "LOAN_APP123_1234567890",
    "status": "PAID",
    "amount": 5000.00,
    "payment_method": "UPI",
    "transaction_id": "txn_abc123",
    "cashfreeStatus": { ... }
  }
}
```

### POST /api/payment/webhook

Cashfree webhook endpoint for payment status updates.

**Authentication:** None (verified by signature)

**Headers:**
- `x-webhook-signature` - Webhook signature (optional)

**Payload:**
```json
{
  "type": "PAYMENT_SUCCESS_WEBHOOK",
  "data": {
    "order": {
      "order_id": "LOAN_APP123_1234567890",
      "order_status": "PAID",
      "order_amount": 5000.00,
      ...
    }
  }
}
```

## 🎨 Frontend Components

### RepaymentSchedulePage

The "Repay Now" button is located in `RepaymentSchedulePage.tsx`:

```typescript
<Button onClick={async () => {
  const response = await apiService.createPaymentOrder(loanId, amount);
  if (response.success && response.data?.checkoutUrl) {
    window.location.href = response.data.checkoutUrl;
  }
}}>
  Repay Now
</Button>
```

### PaymentReturnPage

Handles payment return from Cashfree:

- Shows success/failure message
- Displays payment details
- Provides navigation options

## 🔒 Security

1. **Authentication:** All payment endpoints require JWT authentication
2. **Webhook Verification:** Webhook signature verification (optional but recommended)
3. **Idempotency:** Order IDs are unique to prevent duplicate payments
4. **Environment Detection:** Automatically detects production vs sandbox

## 🧪 Testing

### Sandbox Testing

1. Set `CASHFREE_API_BASE=https://sandbox.cashfree.com/pg`
2. Use sandbox credentials
3. Test with Cashfree test cards/UPI

### Production Testing

1. Set `CASHFREE_API_BASE=https://api.cashfree.com/pg`
2. Use production credentials
3. Configure webhook URL in Cashfree dashboard
4. Test with real payment methods

## 🐛 Troubleshooting

### Issue: Payment order creation fails

**Check:**
- Cashfree credentials are correct
- Environment variables are set
- Database table exists
- Loan ID and amount are valid

### Issue: Webhook not received

**Check:**
- Webhook URL is accessible (HTTPS required in production)
- Webhook URL is configured in Cashfree dashboard
- Firewall allows Cashfree IPs
- Server logs for webhook requests

### Issue: Payment status not updating

**Check:**
- Webhook is being received
- Database updates are working
- Order ID matches between frontend and backend

## 📊 Monitoring

### Check Payment Orders

```sql
SELECT 
    order_id,
    loan_id,
    amount,
    status,
    created_at,
    updated_at
FROM payment_orders
ORDER BY created_at DESC
LIMIT 10;
```

### Payment Success Rate

```sql
SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_orders,
    SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END) as successful,
    SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed,
    ROUND(SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END) / COUNT(*) * 100, 2) as success_rate
FROM payment_orders
WHERE DATE(created_at) >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

## ✅ Production Checklist

- [ ] Database migration completed
- [ ] Environment variables configured
- [ ] Cashfree dashboard webhook URL configured
- [ ] Test payment in sandbox
- [ ] Test payment in production
- [ ] Webhook receiving and processing correctly
- [ ] Payment return page working
- [ ] Error handling tested

## 🔗 Related Documentation

- [eNACH Live Setup Guide](./ENACH_LIVE_SETUP_GUIDE.md) - For eNACH subscriptions
- [Cashfree API Docs](https://docs.cashfree.com/docs/payments-overview)

---

**Last Updated:** December 2024  
**Version:** 1.0.0

