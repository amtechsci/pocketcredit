# Hold Status Middleware Implementation Guide

## Overview

The `checkHoldStatus` middleware prevents users on hold from progressing in their application while still allowing them to view their dashboard and profile.

---

## Middleware Files

### 1. `middleware/checkHoldStatus.js` ✅ CREATED
- **`checkHoldStatus`** - Blocks progress if user is on hold
- **`addHoldInfo`** - Adds hold info to request (non-blocking)

### 2. `middleware/jwtAuth.js` ✅ UPDATED
- Now allows `status = 'on_hold'` users to authenticate
- Users can view dashboard but can't progress (enforced by `checkHoldStatus`)

---

## Where to Apply `checkHoldStatus` Middleware

### ✅ **MUST BLOCK (Apply middleware)**

These routes should **NOT** work if user is on hold:

#### **Profile Completion & Updates**
```javascript
// src/server/routes/userProfile.js
router.post('/basic-info/:userId', requireAuth, checkHoldStatus, ...);
router.post('/address/:userId', requireAuth, checkHoldStatus, ...);
router.post('/employment/:userId', requireAuth, checkHoldStatus, ...);
router.post('/bank-details/:userId', requireAuth, checkHoldStatus, ...);
```

#### **Loan Applications**
```javascript
// src/server/routes/loans.js
router.post('/apply', requireAuth, checkHoldStatus, ...);
router.post('/submit-application', requireAuth, checkHoldStatus, ...);
```

#### **Document Uploads**
```javascript
// src/server/routes/verification.js
router.post('/upload-document', requireAuth, checkHoldStatus, ...);
router.post('/submit-kyc', requireAuth, checkHoldStatus, ...);
```

#### **References**
```javascript
// src/server/routes/references.js
router.post('/', requireAuth, checkHoldStatus, ...);
router.put('/:id', requireAuth, checkHoldStatus, ...);
```

#### **Bank Details**
```javascript
// src/server/routes/bankDetails.js
router.post('/', requireAuth, checkHoldStatus, ...);
router.put('/', requireAuth, checkHoldStatus, ...);
```

#### **Digitap Pre-fill SAVE (not fetch)**
```javascript
// src/server/routes/digitap.js
router.post('/save-prefill', requireAuth, checkHoldStatus, ...);
```

---

### ❌ **ALLOW (Don't apply middleware)**

These routes should **still work** even if user is on hold:

#### **Dashboard & Profile Views (Read-only)**
```javascript
// src/server/routes/dashboardController.js
router.get('/summary', requireAuth, ...); // ❌ Don't block

// src/server/routes/userProfile.js
router.get('/:userId', requireAuth, ...); // ❌ Don't block

// src/server/routes/auth.js
router.get('/profile', requireAuth, ...); // ❌ Don't block
```

#### **Digitap Pre-fill FETCH (read-only)**
```javascript
// src/server/routes/digitap.js
router.post('/prefill', requireAuth, ...); // ❌ Don't block (just fetching data)
```

#### **Authentication**
```javascript
// src/server/routes/auth.js
router.post('/login', ...); // ❌ Don't block
router.post('/logout', ...); // ❌ Don't block
router.post('/verify-otp', ...); // ❌ Don't block
```

---

## Implementation Steps

### Step 1: Apply to Profile Routes

```javascript
// src/server/routes/userProfile.js

const { requireAuth } = require('../middleware/jwtAuth');
const { checkHoldStatus } = require('../middleware/checkHoldStatus'); // ADD THIS

// GET routes - allow viewing
router.get('/:userId', requireAuth, async (req, res) => { ... });

// POST/PUT routes - block if on hold
router.post('/basic-info/:userId', requireAuth, checkHoldStatus, async (req, res) => { ... });
router.post('/address/:userId', requireAuth, checkHoldStatus, async (req, res) => { ... });
router.post('/employment/:userId', requireAuth, checkHoldStatus, async (req, res) => { ... });
router.post('/bank-details/:userId', requireAuth, checkHoldStatus, async (req, res) => { ... });
```

### Step 2: Apply to Loan Routes

```javascript
// src/server/routes/loans.js

const { checkHoldStatus } = require('../middleware/checkHoldStatus'); // ADD THIS

router.post('/apply', requireAuth, checkHoldStatus, async (req, res) => { ... });
router.post('/submit-application', requireAuth, checkHoldStatus, async (req, res) => { ... });
```

### Step 3: Apply to References Route

```javascript
// src/server/routes/references.js

const { checkHoldStatus } = require('../middleware/checkHoldStatus'); // ADD THIS

router.post('/', requireAuth, checkHoldStatus, async (req, res) => { ... });
router.put('/:id', requireAuth, checkHoldStatus, async (req, res) => { ... });
```

### Step 4: Apply to Bank Details Route

```javascript
// src/server/routes/bankDetails.js

const { checkHoldStatus } = require('../middleware/checkHoldStatus'); // ADD THIS

router.post('/', requireAuth, checkHoldStatus, async (req, res) => { ... });
router.put('/', requireAuth, checkHoldStatus, async (req, res) => { ... });
```

### Step 5: Apply to Digitap Save Route

```javascript
// src/server/routes/digitap.js

const { checkHoldStatus } = require('../middleware/checkHoldStatus'); // ADD THIS

// Fetching is OK (read-only)
router.post('/prefill', requireAuth, async (req, res) => { ... });

// Saving should be blocked if on hold
router.post('/save-prefill', requireAuth, checkHoldStatus, async (req, res) => { ... });
```

---

## Response Format

### User on PERMANENT Hold
```json
{
  "status": "error",
  "message": "Your application is permanently on hold",
  "hold_status": {
    "is_on_hold": true,
    "hold_type": "permanent",
    "hold_reason": "Cash payment mode not allowed",
    "can_reapply": false
  }
}
```

### User on TEMPORARY Hold (e.g., Cheque payment - 90 days)
```json
{
  "status": "error",
  "message": "Your application is currently on hold",
  "hold_status": {
    "is_on_hold": true,
    "hold_type": "temporary",
    "hold_reason": "Cheque payment mode",
    "hold_until": "2025-01-18T00:00:00.000Z",
    "hold_until_formatted": "18 January 2025",
    "remaining_days": 45,
    "can_reapply_after": "2025-01-18T00:00:00.000Z"
  }
}
```

### Hold EXPIRED (Auto-released)
```
✅ Hold expired and released for user 23
→ User status changed to 'active'
→ Request proceeds normally
```

---

## Frontend Handling

### Display Hold Banner on Dashboard

```typescript
// If API returns 403 with hold_status
if (error.response?.status === 403 && error.response?.data?.hold_status) {
  const holdInfo = error.response.data.hold_status;
  
  if (holdInfo.hold_type === 'permanent') {
    showBanner({
      type: 'error',
      message: `Your application is on hold: ${holdInfo.hold_reason}`,
      permanent: true
    });
  } else {
    showBanner({
      type: 'warning',
      message: `Your application is on hold until ${holdInfo.hold_until_formatted}`,
      remaining: holdInfo.remaining_days + ' days',
      reason: holdInfo.hold_reason
    });
  }
}
```

---

## Testing

### Test Permanent Hold (Cash Payment)
1. Select employment type: Salaried
2. Select payment mode: Cash
3. Try to continue → ✅ Should show hold message
4. Try to access dashboard → ✅ Should work
5. Try to apply for loan → ❌ Should be blocked with hold message

### Test Temporary Hold (Cheque Payment)
1. Select employment type: Salaried
2. Select payment mode: Cheque
3. Try to continue → ✅ Should show hold message with expiry date
4. Try to access dashboard → ✅ Should work
5. Try to apply for loan → ❌ Should be blocked with hold message
6. Wait for hold to expire (or manually update hold_until_date in DB)
7. Try to apply for loan → ✅ Should work (auto-released)

### Test Low Credit Score Hold
1. Complete Step 1
2. Digitap API returns score < 630
3. Try to continue → ✅ Should show 60-day hold message
4. Try to access dashboard → ✅ Should work

---

## Database Hold Management

### Check User Hold Status
```sql
SELECT 
  id, 
  phone,
  status, 
  eligibility_status,
  application_hold_reason,
  hold_until_date,
  CASE 
    WHEN hold_until_date IS NULL THEN 'Permanent'
    WHEN hold_until_date > NOW() THEN CONCAT('Temporary (', DATEDIFF(hold_until_date, NOW()), ' days)')
    ELSE 'Expired'
  END as hold_type
FROM users 
WHERE status = 'on_hold';
```

### Manually Release Hold
```sql
UPDATE users 
SET 
  status = 'active',
  eligibility_status = 'pending',
  application_hold_reason = NULL,
  hold_until_date = NULL,
  updated_at = NOW()
WHERE id = ?;
```

### Find Expired Holds
```sql
SELECT 
  id, 
  phone,
  application_hold_reason,
  hold_until_date
FROM users 
WHERE status = 'on_hold' 
  AND hold_until_date IS NOT NULL 
  AND hold_until_date < NOW();
```

---

## Priority Routes to Update

### 🔴 HIGH PRIORITY (Block immediately)
1. ✅ `/api/user-profile/basic-info/:userId` (POST)
2. ✅ `/api/loans/apply` (POST)
3. ✅ `/api/references` (POST)
4. ✅ `/api/bank-details` (POST)
5. ✅ `/api/digitap/save-prefill` (POST)

### 🟡 MEDIUM PRIORITY
6. `/api/verification/upload-document` (POST)
7. `/api/employment` (POST)
8. `/api/user-profile/employment/:userId` (POST)

### 🟢 LOW PRIORITY (Future)
9. Loan amendment requests
10. Loan top-up requests
11. Additional document submissions

---

## Summary

✅ **Middleware Created:** `checkHoldStatus.js`  
✅ **Auth Updated:** `jwtAuth.js` now allows on-hold users to authenticate  
🔄 **Next Step:** Apply `checkHoldStatus` to routes listed above  
📝 **Testing:** Test permanent, temporary, and expired holds  

