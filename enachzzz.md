# 🚀 Cashfree eNACH Production Deployment Guide

**When You Get Production Keys - Follow This Checklist**

This is your **step-by-step guide** to switch from Cashfree sandbox to production when you receive your live API credentials.

---

## 📋 Pre-Deployment Checklist

### ✅ Prerequisites

- [ ] Received production Cashfree credentials (Client ID + Client Secret)
- [ ] Production database ready (not using dev database)
- [ ] HTTPS/SSL certificate installed on domain
- [ ] Production domain configured (e.g., pocketcredit.in)
- [ ] Backup of current database taken
- [ ] Code deployed to production server

---

## 🔑 Step 1: Update Environment Variables (CRITICAL)

### File: `src/server/.env`

**Location:** `c:\xampp\htdocs\pocket\src\server\.env`

```bash
# ============================================
# CASHFREE PRODUCTION CREDENTIALS
# ============================================

# OLD (Sandbox - REMOVE THESE):
# CASHFREE_CLIENT_ID=TEST_XXXXXXXXXXXXX (redacted - use your own sandbox credentials)
# CASHFREE_CLIENT_SECRET=cfsk_ma_test_XXXXXXXXXXXXX (redacted - use your own sandbox credentials)
# CASHFREE_API_BASE=https://sandbox.cashfree.com/pg

# NEW (Production - ADD THESE):
CASHFREE_CLIENT_ID=YOUR_PRODUCTION_CLIENT_ID_HERE
CASHFREE_CLIENT_SECRET=YOUR_PRODUCTION_CLIENT_SECRET_HERE
CASHFREE_API_VERSION=2025-01-01
CASHFREE_API_BASE=https://api.cashfree.com/pg

# ============================================
# APPLICATION URLS (UPDATE THESE)
# ============================================

FRONTEND_URL=https://pocketcredit.in
BACKEND_WEBHOOK_URL=https://pocketcredit.in/api/enach/webhook

# ============================================
# ENVIRONMENT
# ============================================

NODE_ENV=production
```

### 🚨 **CRITICAL CHANGES:**

1. **Replace `CASHFREE_CLIENT_ID`** with production ID (starts with something like `prod_` or different from `TEST`)
2. **Replace `CASHFREE_CLIENT_SECRET`** with production secret (longer, different prefix)
3. **Change `CASHFREE_API_BASE`** from `sandbox.cashfree.com` → `api.cashfree.com`
4. **Update `FRONTEND_URL`** to your actual domain
5. **Update `NODE_ENV`** to `production`

---

## 🔄 Step 2: Configure Cashfree Dashboard

### Login to Production Dashboard

1. Go to: https://merchant.cashfree.com
2. Login with your production account credentials

### Configure Webhooks

**Navigation:** Dashboard → Developers → Webhooks

1. **Add New Webhook:**
   - **Webhook URL:** `https://pocketcredit.in/api/enach/webhook`
   - **Events to Subscribe:**
     - ✅ `subscription.activated`
     - ✅ `subscription.authentication_failed`
     - ✅ `subscription.cancelled` 
     - ✅ `mandate.approved`
     - ✅ `mandate.rejected`
   
2. **Save Webhook Configuration**

3. **Note Down:**
   - Webhook Secret (if provided) → Add to `.env` as `CASHFREE_WEBHOOK_SECRET`

### Verify API Credentials

1. Navigate to: Dashboard → Developers → API Keys
2. Verify:
   - ✅ Client ID matches what you put in `.env`
   - ✅ Client Secret is active
   - ✅ eNACH/Subscriptions module is enabled

---

## 🗄️ Step 3: Verify Production Database

### Connect to Production DB

```bash
mysql -h YOUR_PROD_DB_HOST -u YOUR_PROD_DB_USER -p
USE pocket_credit;
```

### Verify Tables Exist

```sql
-- Check eNACH tables
SHOW TABLES LIKE 'enach%';

-- Expected output:
-- enach_plans
-- enach_subscriptions
-- enach_webhook_events

-- If tables DON'T exist, run migration:
-- mysql -u pocket -p pocket_credit < src/server/migrations/enach_tables.sql
```

### Verify Table Structure

```sql
-- Check subscription table has all required columns
DESCRIBE enach_subscriptions;

-- Must have these columns:
-- - subscription_id
-- - cf_subscription_id
-- - subscription_session_id
-- - status
-- - mandate_status
-- - authorization_url
-- - cashfree_response (JSON)
-- - created_at, updated_at
-- - activated_at, failed_at, cancelled_at
```

---

## 🖥️ Step 4: Restart Application

### Using PM2 (Recommended)

```bash
# Navigate to server directory
cd /path/to/pocket/src/server

# Restart the application
pm2 restart pocket-server

# Verify restart
pm2 logs pocket-server --lines 50

# Should see:
# "Server is running on port 3002"
# No errors about CASHFREE_CLIENT_ID or CASHFREE_CLIENT_SECRET
```

### Using npm (Development)

```bash
# Stop current server (Ctrl+C)

# Clear cache
npm cache clean --force

# Restart
npm run dev

# Verify .env loaded:
# Look for log: "Cashfree API Base: https://api.cashfree.com/pg"
```

### Verify Environment Loaded

**Add this temporary log to `src/server/server.js`:**

```javascript
// After loading environment
console.log('🔧 Environment Check:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('CASHFREE_API_BASE:', process.env.CASHFREE_API_BASE);
console.log('CASHFREE_CLIENT_ID:', process.env.CASHFREE_CLIENT_ID ? '✅ Set' : '❌ Missing');
console.log('CASHFREE_CLIENT_SECRET:', process.env.CASHFREE_CLIENT_SECRET ? '✅ Set' : '❌ Missing');
```

**Expected Output:**
```
🔧 Environment Check:
NODE_ENV: production
CASHFREE_API_BASE: https://api.cashfree.com/pg
CASHFREE_CLIENT_ID: ✅ Set
CASHFREE_CLIENT_SECRET: ✅ Set
```

---

## 🧪 Step 5: Test Production Integration

### Test 1: Health Check

```bash
curl https://pocketcredit.in/api/health
# Expected: {"status":"ok"}
```

### Test 2: Create Test Subscription (AFTER Production Keys)

**Prerequisites:**
- Have a test user account
- User has valid bank details (HDFC, ICICI, SBI, etc.)
- User has an active loan application

**Steps:**

1. Login to your app as a test user
2. Navigate to: `https://pocketcredit.in/post-disbursal?applicationId=XX`
3. Click "Proceed to e-NACH Registration"
4. **Expected:**
   - ✅ Success message: "eNACH mandate link will be sent..."
   - ✅ Check phone/email for actual SMS/Email from bank
   - ✅ No errors in browser console
   - ✅ No errors in server logs

### Test 3: Verify Database Entry

```sql
-- Check subscription created
SELECT 
    subscription_id,
    cf_subscription_id,
    status,
    mandate_status,
    created_at,
    JSON_EXTRACT(cashfree_response, '$.subscription_status') as cf_status
FROM enach_subscriptions 
ORDER BY created_at DESC 
LIMIT 1;

-- Expected:
-- status: INITIALIZED
-- cf_status: INITIALIZED
-- subscription_id: sub_loan_XX_XXXXX
-- cf_subscription_id: numeric ID from Cashfree
```

### Test 4: Verify Cashfree Dashboard

1. Login to https://merchant.cashfree.com
2. Navigate to: Subscriptions
3. **Verify:**
   - ✅ New subscription appears
   - ✅ Status shows "INITIALIZED" or "ACTIVE"
   - ✅ Customer details correct
   - ✅ Plan details match loan amount

### Test 5: Complete Full Flow (With Real Customer)

**Day 1:**
1. Customer completes eNACH registration
2. Customer receives SMS/Email from bank
3. Customer clicks link and authorizes mandate
4. Bank processes (may take 24-48 hours)

**Day 2-3:**
5. Webhook received: `subscription.activated`
6. Database updated: `status = 'ACTIVE'`

**Verify:**
```sql
-- Check subscriptions activated in last 7 days
SELECT 
    subscription_id,
    status,
    mandate_status,
    activated_at,
    TIMESTAMPDIFF(HOUR, created_at, activated_at) as hours_to_activate
FROM enach_subscriptions
WHERE activated_at IS NOT NULL
ORDER BY activated_at DESC
LIMIT 10;
```

---

## 📊 Step 6: Monitor Production

### Set Up Monitoring Queries

**Daily Check (Run every morning):**

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

**Webhook Health (Run hourly):**

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

-- Expected: 0 rows (all webhooks processed)
```

**Stuck Subscriptions (Run daily):**

```sql
-- Subscriptions stuck in INITIALIZED for >3 days
SELECT 
    subscription_id,
    cf_subscription_id,
    user_id,
    loan_application_id,
    created_at,
    TIMESTAMPDIFF(DAY, created_at, NOW()) as days_stuck
FROM enach_subscriptions
WHERE status = 'INITIALIZED'
  AND created_at < NOW() - INTERVAL 3 DAY
ORDER BY created_at;

-- Action: Manually check status in Cashfree dashboard
```

### Set Up Alerts (Recommended)

**Create a monitoring script:** `src/server/monitoring/enach_alerts.js`

```javascript
const { executeQuery } = require('../config/database');

async function checkENachHealth() {
  // Check 1: Failed subscriptions in last hour
  const failed = await executeQuery(`
    SELECT COUNT(*) as count 
    FROM enach_subscriptions 
    WHERE status = 'FAILED' 
      AND failed_at > NOW() - INTERVAL 1 HOUR
  `);
  
  if (failed[0].count > 5) {
    // ALERT: High failure rate
    console.error('🚨 ALERT: More than 5 subscriptions failed in last hour');
    // Send email/SMS to ops team
  }
  
  // Check 2: Unprocessed webhooks
  const unprocessed = await executeQuery(`
    SELECT COUNT(*) as count 
    FROM enach_webhook_events 
    WHERE processed = FALSE 
      AND received_at < NOW() - INTERVAL 10 MINUTE
  `);
  
  if (unprocessed[0].count > 0) {
    // ALERT: Webhooks stuck
    console.error('🚨 ALERT: Webhooks not processing');
    // Send alert
  }
  
  console.log('✅ eNACH health check passed');
}

// Run every 5 minutes
setInterval(checkENachHealth, 5 * 60 * 1000);
```

---

## 🐛 Step 7: Common Issues & Quick Fixes

### Issue 1: "Invalid Client ID or Secret"

**Symptoms:**
- Error: `authentication_error` or `invalid_credentials`
- All subscription requests fail

**Fix:**
```bash
# 1. Verify credentials in Cashfree dashboard
# 2. Double-check .env file:
cat src/server/.env | grep CASHFREE

# 3. Restart server:
pm2 restart pocket-server
```

### Issue 2: Webhooks Not Arriving

**Symptoms:**
- Subscriptions stuck in INITIALIZED
- No rows in `enach_webhook_events` table

**Fix:**
1. Check Cashfree dashboard → Webhooks → verify URL is correct
2. Verify webhook URL is accessible:
   ```bash
   curl -X POST https://pocketcredit.in/api/enach/webhook \
     -H "Content-Type: application/json" \
     -d '{"type":"test","data":{}}'
   # Should return 200 OK
   ```
3. Check firewall allows Cashfree IPs
4. Check server logs:
   ```bash
   pm2 logs pocket-server | grep webhook
   ```

### Issue 3: "Bank Not Supported"

**Symptoms:**
- Error: "Bank account details not supported"
- Bank code: FNSB, or other small banks

**Fix:**
- Guide customer to add major bank account:
  - HDFC (HDFC)
  - ICICI (ICIC)
  - SBI (SBIN)
  - Axis (UTIB)
  - Yes Bank (YESB)

### Issue 4: "Plan Does Not Exist"

**Symptoms:**
- Subscription creation fails
- Error: "Plan does not exist"

**Fix:**
```sql
-- Check if plan was created
SELECT * FROM enach_plans 
WHERE plan_id LIKE 'plan_loan_%' 
ORDER BY created_at DESC 
LIMIT 1;

-- If no plans exist, check logs:
pm2 logs pocket-server | grep "Plan created"

-- Manually create plan via Cashfree dashboard if needed
```

---

## 📝 Step 8: Production Rollout Plan

### Phase 1: Soft Launch (Week 1)

**Goal:** Test with internal team and 5-10 friendly customers

**Actions:**
- [ ] Enable eNACH only for specific users (feature flag)
- [ ] Monitor every subscription closely
- [ ] Daily review of all transactions
- [ ] Fix any issues immediately

**Success Criteria:**
- ✅ 90%+ subscription success rate
- ✅ All webhooks processed
- ✅ No customer complaints

### Phase 2: Limited Rollout (Week 2-3)

**Goal:** Expand to 25% of new customers

**Actions:**
- [ ] Enable for 25% of new loan disbursals (random selection)
- [ ] Monitor daily metrics
- [ ] Collect customer feedback
- [ ] Document common issues

**Success Criteria:**
- ✅ 85%+ subscription success rate
- ✅ <5% customer support tickets
- ✅ Webhook processing 100% reliable

### Phase 3: Full Rollout (Week 4+)

**Goal:** Enable for all customers

**Actions:**
- [ ] Remove feature flags
- [ ] Enable for 100% of disbursals
- [ ] Set up automated monitoring
- [ ] Train customer support team

**Success Criteria:**
- ✅ Stable performance for 7 consecutive days
- ✅ Support team trained
- ✅ Runbook documented

---

## 🔒 Step 9: Security Verification

### Checklist

- [ ] **Credentials Secure:**
  - `.env` file not in git (`git check-ignore .env` returns positive)
  - Credentials rotated from sandbox → production
  
- [ ] **HTTPS Enforced:**
  ```bash
  curl -I http://pocketcredit.in/api/enach/webhook
  # Should redirect to HTTPS
  ```

- [ ] **Webhook Signature Verified:**
  - If Cashfree provides signature secret, add to code:
  ```javascript
  // In enachWebhooks.js
  const signature = req.headers['x-cashfree-signature'];
  if (!verifyWebhookSignature(req.body, signature, process.env.CASHFREE_WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  ```

- [ ] **Database Access:**
  - Production DB accessible only from production server IP
  - No public internet access
  - Backups configured (daily)

- [ ] **Rate Limiting:**
  ```javascript
  // In server.js (already configured)
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
  });
  ```

---

## 📞 Step 10: Support & Escalation

### Cashfree Support

- **Email:** support@cashfree.com
- **Phone:** +91-80-6197-2830
- **Dashboard:** https://merchant.cashfree.com
- **Docs:** https://docs.cashfree.com/docs/subscriptions-overview

### When to Contact Cashfree

1. **Webhook not received** after 48 hours
2. **API errors** not documented (new error codes)
3. **Production credential issues**
4. **Bank support questions** (which banks are enabled)
5. **Settlement queries**

### Internal Escalation Path

1. **L1:** Check database + logs (Dev team)
2. **L2:** Review Cashfree dashboard (Ops team)
3. **L3:** Contact Cashfree support (Tech lead)

---

## ✅ Final Verification Checklist

Before declaring "Production Ready":

- [ ] Environment variables updated with production keys
- [ ] Cashfree dashboard webhooks configured
- [ ] Database tables exist in production
- [ ] Application restarted and verified
- [ ] Test subscription created successfully
- [ ] Webhook received and processed
- [ ] Monitoring queries set up
- [ ] Alert script configured (if applicable)
- [ ] Security checklist completed
- [ ] Support team trained
- [ ] Rollout plan approved
- [ ] Backup and recovery tested

---

## 📄 Quick Reference Card

**Print this and keep it handy:**

```
┌─────────────────────────────────────────────┐
│   CASHFREE ENACH PRODUCTION QUICK REF       │
├─────────────────────────────────────────────┤
│ Production API Base:                        │
│   https://api.cashfree.com/pg              │
│                                             │
│ Dashboard:                                  │
│   https://merchant.cashfree.com            │
│                                             │
│ Webhook URL:                                │
│   https://pocketcredit.in/api/enach/webhook│
│                                             │
│ Support:                                    │
│   support@cashfree.com                     │
│   +91-80-6197-2830                         │
│                                             │
│ Critical Files:                             │
│   .env (server credentials)                │
│   enach.js (API routes)                    │
│   enachWebhooks.js (webhook handler)       │
│                                             │
│ Database Tables:                            │
│   enach_subscriptions                      │
│   enach_webhook_events                     │
│   enach_plans                              │
│                                             │
│ Key Status Values:                          │
│   INITIALIZED → waiting for approval       │
│   ACTIVE → ready for charges               │
│   FAILED → mandate rejected                │
└─────────────────────────────────────────────┘
```

---

## 🎯 Success!

If all steps above are completed:

✅ **Your eNACH integration is LIVE in production!**

Monitor closely for the first week and address any issues immediately.

**Questions?** Refer to `ENACH_COMPLETE_IMPLEMENTATION_GUIDE.md` or contact Cashfree support.

---

**Last Updated:** December 14, 2024  
**Version:** 1.0.0  
**Status:** Production Deployment Guide
