# ⚡ eNACH Live APIs - Quick Start

Quick reference for switching to production eNACH APIs.

## 🚀 3-Step Setup

### 1. Run Database Migration

```bash
cd src/server
node migrations/create_enach_tables.js
```

### 2. Update `.env` File

```bash
# In src/server/.env

# Change these:
CASHFREE_API_BASE=https://api.cashfree.com/pg  # ← Change from sandbox
CASHFREE_CLIENT_ID=YOUR_PRODUCTION_CLIENT_ID
CASHFREE_CLIENT_SECRET=YOUR_PRODUCTION_CLIENT_SECRET
FRONTEND_URL=https://yourdomain.com
NODE_ENV=production
```

### 3. Restart Server

```bash
pm2 restart pocket-server
# or
npm run dev
```

## ✅ Verify Setup

```bash
curl https://yourdomain.com/api/enach/health
```

Should return:
```json
{
  "status": "ok",
  "production": true,
  "configured": true,
  "database": "connected"
}
```

## 🔗 Important URLs

- **Health Check:** `/api/enach/health`
- **Create Subscription:** `POST /api/enach/create-subscription`
- **Webhook:** `POST /api/enach/webhook`
- **Cashfree Dashboard:** https://merchant.cashfree.com

## 📚 Full Documentation

See `ENACH_LIVE_SETUP_GUIDE.md` for complete setup instructions.

