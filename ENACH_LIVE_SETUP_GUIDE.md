# 🚀 eNACH Live APIs Setup Guide

This guide will help you set up and switch to Cashfree eNACH live/production APIs.

## 📋 Prerequisites

- [ ] Production Cashfree account created
- [ ] Production API credentials received (Client ID + Client Secret)
- [ ] Production database ready
- [ ] HTTPS/SSL certificate installed on domain
- [ ] Production domain configured

---

## 🔧 Step 1: Run Database Migration

First, create the necessary database tables for eNACH:

### Option A: Using SQL File (Recommended)

```bash
# Connect to your database
mysql -u your_username -p pocket_credit

# Run the migration
source src/server/migrations/create_enach_tables.sql
```

### Option B: Using Node.js Script

```bash
cd src/server
node migrations/create_enach_tables.js
```

### Verify Tables Created

```sql
SHOW TABLES LIKE 'enach%';
-- Should show:
-- enach_plans
-- enach_subscriptions
-- enach_webhook_events
```

---

## 🔑 Step 2: Configure Environment Variables

Update your `.env` file in `src/server/.env`:

```bash
# ============================================
# CASHFREE PRODUCTION CREDENTIALS
# ============================================

# Production API Base URL
CASHFREE_API_BASE=https://api.cashfree.com/pg

# Your production credentials (from Cashfree dashboard)
CASHFREE_CLIENT_ID=YOUR_PRODUCTION_CLIENT_ID_HERE
CASHFREE_CLIENT_SECRET=YOUR_PRODUCTION_CLIENT_SECRET_HERE
CASHFREE_API_VERSION=2025-01-01

# Webhook secret (if provided by Cashfree)
CASHFREE_WEBHOOK_SECRET=your-webhook-secret-if-provided

# ============================================
# APPLICATION URLS
# ============================================

# Your production frontend URL
FRONTEND_URL=https://yourdomain.com

# Environment
NODE_ENV=production
```

### 🚨 Critical Changes:

1. **CASHFREE_API_BASE**: Change from `https://sandbox.cashfree.com/pg` → `https://api.cashfree.com/pg`
2. **CASHFREE_CLIENT_ID**: Replace with production Client ID
3. **CASHFREE_CLIENT_SECRET**: Replace with production Client Secret
4. **FRONTEND_URL**: Update to your actual production domain
5. **NODE_ENV**: Set to `production`

---

## 🔄 Step 3: Configure Cashfree Dashboard

### 3.1 Login to Production Dashboard

1. Go to: https://merchant.cashfree.com
2. Login with your production account credentials

### 3.2 Configure Webhooks

**Navigation:** Dashboard → Developers → Webhooks

1. **Add New Webhook:**
   - **Webhook URL:** `https://yourdomain.com/api/enach/webhook`
   - **Events to Subscribe:**
     - ✅ `subscription.activated`
     - ✅ `subscription.authentication_failed`
     - ✅ `subscription.cancelled`
     - ✅ `mandate.approved`
     - ✅ `mandate.rejected`

2. **Save Webhook Configuration**

3. **Note Down:**
   - Webhook Secret (if provided) → Add to `.env` as `CASHFREE_WEBHOOK_SECRET`

### 3.3 Verify API Credentials

1. Navigate to: Dashboard → Developers → API Keys
2. Verify:
   - ✅ Client ID matches what you put in `.env`
   - ✅ Client Secret is active
   - ✅ eNACH/Subscriptions module is enabled

---

## 🖥️ Step 4: Restart Application

### Using PM2 (Production)

```bash
cd src/server
pm2 restart pocket-server

# Verify restart
pm2 logs pocket-server --lines 50
```

### Using npm (Development)

```bash
cd src/server
npm run dev
```

### Verify Environment Loaded

Check server logs for:

```
[eNACH] Environment: production
[eNACH] API Base: https://api.cashfree.com/pg
[eNACH] Production Mode: ✅ YES
```

---

## 🧪 Step 5: Test Production Integration

### Test 1: Health Check

```bash
curl https://yourdomain.com/api/enach/health
```

**Expected Response:**
```json
{
  "service": "eNACH",
  "status": "ok",
  "environment": "production",
  "production": true,
  "api_base": "https://api.cashfree.com/pg",
  "configured": true,
  "database": "connected",
  "tables": {
    "enach_plans": true,
    "enach_subscriptions": true,
    "enach_webhook_events": true
  }
}
```

### Test 2: Create Test Subscription

1. Login to your app as a test user
2. Navigate to post-disbursal flow
3. Click "Proceed to e-NACH Registration"
4. **Expected:**
   - ✅ Success message
   - ✅ Check phone/email for SMS/Email from bank
   - ✅ No errors in browser console
   - ✅ No errors in server logs

### Test 3: Verify Database Entry

```sql
SELECT 
    subscription_id,
    cf_subscription_id,
    status,
    mandate_status,
    created_at
FROM enach_subscriptions 
ORDER BY created_at DESC 
LIMIT 1;
```

### Test 4: Verify Cashfree Dashboard

1. Login to https://merchant.cashfree.com
2. Navigate to: Subscriptions
3. **Verify:**
   - ✅ New subscription appears
   - ✅ Status shows "INITIALIZED" or "ACTIVE"
   - ✅ Customer details correct
   - ✅ Plan details match loan amount

---

## 📊 Step 6: Monitor Production

### Daily Check Query

```sql
-- Yesterday's subscription stats
SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_created,
    SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as activated,
    SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed,
    SUM(CASE WHEN status = 'INITIALIZED' THEN 1 ELSE 0 END) as pending,
    ROUND(SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) / COUNT(*) * 100, 2) as success_rate
FROM enach_subscriptions
WHERE DATE(created_at) = CURDATE() - INTERVAL 1 DAY;
```

### Webhook Health Check

```sql
-- Unprocessed webhooks
SELECT 
    event_type,
    COUNT(*) as unprocessed_count,
    MIN(received_at) as oldest_event
FROM enach_webhook_events
WHERE processed = FALSE
  AND received_at > NOW() - INTERVAL 24 HOUR
GROUP BY event_type;
```

---

## 🐛 Troubleshooting

### Issue 1: "Invalid Client ID or Secret"

**Symptoms:**
- Error: `authentication_error` or `invalid_credentials`
- All subscription requests fail

**Fix:**
1. Verify credentials in Cashfree dashboard
2. Double-check `.env` file
3. Restart server

### Issue 2: Webhooks Not Arriving

**Symptoms:**
- Subscriptions stuck in INITIALIZED
- No rows in `enach_webhook_events` table

**Fix:**
1. Check Cashfree dashboard → Webhooks → verify URL is correct
2. Verify webhook URL is accessible (HTTPS required)
3. Check firewall allows Cashfree IPs
4. Check server logs

### Issue 3: "Bank Not Supported"

**Symptoms:**
- Error: "Bank account details not supported"

**Fix:**
- Guide customer to add major bank account:
  - HDFC (HDFC)
  - ICICI (ICIC)
  - SBI (SBIN)
  - Axis (UTIB)
  - Yes Bank (YESB)

---

## 🔒 Security Checklist

- [ ] `.env` file not in git (check `.gitignore`)
- [ ] HTTPS enforced for webhook URL
- [ ] Webhook signature verification enabled (if secret provided)
- [ ] Production database accessible only from production server
- [ ] Rate limiting enabled
- [ ] Credentials rotated from sandbox → production

---

## 📞 Support

### Cashfree Support
- **Email:** support@cashfree.com
- **Phone:** +91-80-6197-2830
- **Dashboard:** https://merchant.cashfree.com
- **Docs:** https://docs.cashfree.com/docs/subscriptions-overview

---

## ✅ Final Verification Checklist

Before declaring "Production Ready":

- [ ] Database migration completed
- [ ] Environment variables updated with production keys
- [ ] Cashfree dashboard webhooks configured
- [ ] Application restarted and verified
- [ ] Health check endpoint returns success
- [ ] Test subscription created successfully
- [ ] Webhook received and processed
- [ ] Security checklist completed
- [ ] Monitoring queries set up

---

## 🎯 Quick Reference

**Production API Base:** `https://api.cashfree.com/pg`  
**Dashboard:** https://merchant.cashfree.com  
**Webhook URL:** `https://yourdomain.com/api/enach/webhook`  
**Health Check:** `https://yourdomain.com/api/enach/health`

**Database Tables:**
- `enach_plans`
- `enach_subscriptions`
- `enach_webhook_events`

**Key Status Values:**
- `INITIALIZED` → waiting for approval
- `ACTIVE` → ready for charges
- `FAILED` → mandate rejected

---

**Last Updated:** December 2024  
**Version:** 1.0.0

