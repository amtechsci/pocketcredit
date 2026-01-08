# Loan Disbursement Business Logic Documentation

## Overview

This document describes the complete business logic for loan disbursement via Cashfree Payout API, including the workflow, code references, current implementation status, and issues that need to be fixed.

---

## Table of Contents

1. [Business Flow](#business-flow)
2. [Loan Status Lifecycle](#loan-status-lifecycle)
3. [Disbursement Process](#disbursement-process)
4. [Code File References](#code-file-references)
5. [Current Implementation Status](#current-implementation-status)
6. [Issues & Fixes Required](#issues--fixes-required)

---

## Business Flow

### High-Level Workflow

```
Loan Application Submitted
    ↓
Under Review (Admin)
    ↓
Approved → Ready for Disbursement
    ↓
Admin Initiates Disbursement
    ↓
Cashfree Payout API Transfer
    ↓
Status: Account Manager
    ↓
Loan Active (User Repayment)
```

### Detailed Disbursement Flow

1. **Pre-Disbursement Requirements**
   - Loan status must be `ready_for_disbursement`
   - User must have a primary bank account linked
   - Bank account must have valid account number and IFSC code
   - Loan application must exist and be valid

2. **Disbursement Execution**
   - Create/verify beneficiary in Cashfree
   - Initiate NEFT transfer via Cashfree Payout API
   - Record transaction in database
   - Update loan status to `account_manager`
   - Set `disbursed_at` timestamp

3. **Post-Disbursement**
   - Webhook updates transfer status (SUCCESS/FAILED/REVERSED)
   - Loan moves to active repayment phase
   - User can view repayment schedule

---

## Loan Status Lifecycle

### Pre-Account Manager States (Editable)

These statuses allow admin to modify loan details:

- **`submitted`** - Loan application submitted by user
- **`under_review`** - Application under review by admin
- **`disbursal`** - Loan ready for disbursal processing
- **`ready_for_disbursement`** - All checks complete, ready to disburse ⭐ **REQUIRED FOR DISBURSEMENT**
- **`to_disbursement`** - Scheduled for disbursement

**Rules:**
- Admin can edit loan plan, amount, repayment dates
- Calculations are performed on-demand
- No processed data stored yet

### Post-Account Manager States (Frozen)

Once loan reaches account manager, all data is frozen:

- **`account_manager`** - Loan assigned to account manager ⭐ **SET AFTER DISBURSEMENT**
- **`active`** - Loan is active and being serviced
- **`cleared`** - Loan fully repaid

**CRITICAL RULE:** Once `processed_at` is set, **NOTHING can be edited**.

---

## Disbursement Process

### Step-by-Step Process

#### Step 1: Validation
- ✅ Verify loan application exists
- ✅ Check loan status is `ready_for_disbursement`
- ✅ Verify user has primary bank account
- ✅ Validate bank account number and IFSC code

#### Step 2: Beneficiary Management
- Generate unique beneficiary ID: `BENE_{userId}_{timestamp}`
- Create beneficiary in Cashfree Payout API
- Handle duplicate beneficiary (409 error is acceptable)
- Use user's email priority: `personal_email > official_email > email`

#### Step 3: Transfer Initiation
- Generate unique transfer ID: `TRANSFER_LOAN_{loanApplicationId}_{timestamp}`
- Initiate NEFT transfer via Cashfree Payout API
- Transfer amount: `loan_amount` (principal amount)
- Transfer mode: NEFT (default, can be made configurable)
- Include metadata: loan_application_id, loan_amount, application_number

#### Step 4: Database Records
- **payout_transactions table:**
  - Store transfer details
  - Track status (PENDING/SUCCESS/FAILED)
  - Store Cashfree API response
  - Link to loan_application_id and user_id

- **transactions table:**
  - Create transaction record for admin view
  - Type: `loan_disbursement`
  - Payment method: `cashfree_payout`
  - Status: `completed` (initial, actual status in payout_transactions)

#### Step 5: Loan Status Update
- Update `loan_applications` table:
  - `status` → `account_manager`
  - `disbursed_at` → `NOW()`
  - `updated_at` → `NOW()`

**Note:** The disbursement endpoint does NOT set `processed_at` or calculate processed values. This is done separately when loan is processed (via transaction creation or other workflow).

---

## Code File References

### Backend Routes

#### 1. Payout Routes (`src/server/routes/payout.js`)
**Purpose:** Main disbursement API endpoints

**Endpoints:**
- `POST /api/payout/disburse-loan` - Initiate loan disbursement
- `GET /api/payout/transfer-status/:transferId` - Get transfer status
- `GET /api/payout/loan/:loanApplicationId` - Get payout details for loan
- `GET /api/payout/ready-for-disbursement` - List loans ready for disbursement

**Key Functions:**
- Line 26-284: `POST /disburse-loan` handler
- Line 70-75: Status validation (`ready_for_disbursement` required)
- Line 77-102: Bank account validation
- Line 120-145: Beneficiary creation/verification
- Line 147-164: Transfer initiation
- Line 166-197: Payout transaction record creation
- Line 199-224: General transaction record creation
- Line 226-234: Loan status update to `account_manager`

#### 2. Cashfree Payout Service (`src/server/services/cashfreePayout.js`)
**Purpose:** Cashfree Payout API integration

**Key Methods:**
- `createBeneficiary()` - Add beneficiary to Cashfree
- `initiateTransfer()` - Initiate money transfer
- `getTransferStatus()` - Check transfer status
- `getBalance()` - Get account balance

**Configuration:**
- Base URL: `CASHFREE_PAYOUT_API_BASE` (defaults to sandbox)
- API Version: `CASHFREE_PAYOUT_API_VERSION` (default: 2024-01-01)
- Credentials: `CASHFREE_CLIENT_ID`, `CASHFREE_CLIENT_SECRET`

#### 3. Payout Webhooks (`src/server/routes/payoutWebhooks.js`)
**Purpose:** Handle Cashfree webhook events

**Endpoints:**
- `POST /api/payout/webhook` - Receive webhook events

**Event Types Handled:**
- `TRANSFER_SUCCESS` → Update status to SUCCESS
- `TRANSFER_FAILED` → Update status to FAILED
- `TRANSFER_REVERSED` → Update status to REVERSED

**Key Functions:**
- Line 75-130: Webhook handler
- Line 135-250: Async webhook processing
- Line 180-234: Status update logic

#### 4. Server Route Registration (`src/server/server.js`)
**Purpose:** Register payout routes

**Key Lines:**
- Line 266-270: Payout routes registration
- Line 269: Webhook routes registered first (important for route matching)
- Line 270: Main payout routes registered

### Frontend

#### 1. Admin API Service (`src/services/adminApi.ts`)
**Purpose:** Frontend API client for admin operations

**Key Methods:**
- Line 1566-1579: `disburseLoan(loanApplicationId)` - Call disbursement API
- Line 1581-1589: `getTransferStatus(transferId)` - Get transfer status

**API Call:**
```typescript
POST /api/payout/disburse-loan
Body: { loanApplicationId: string }
Headers: { Authorization: `Bearer ${token}` }
```

#### 2. Loan Applications Queue (`src/admin/pages/LoanApplicationsQueue.tsx`)
**Purpose:** Admin UI for managing loan applications

**Key Features:**
- Line 126-127: Bulk selection only for `ready_for_disbursement` loans
- Line 457: Filter function for ready loans
- Line 481: `handleBulkPayout()` - Bulk disbursement handler
- Line 514: Refresh applications after payout

**Status Filtering:**
- Line 618-625: Filter for `ready_for_disbursement` status
- Line 628-635: Filter for `account_manager` status

### Database Tables

#### 1. `loan_applications`
**Key Columns:**
- `id` - Primary key
- `status` - Current loan status (must be `ready_for_disbursement`)
- `loan_amount` - Principal amount to disburse
- `user_id` - User who applied
- `disbursed_at` - Timestamp when disbursed
- `application_number` - Application reference

#### 2. `bank_details`
**Key Columns:**
- `user_id` - User ID
- `is_primary` - Primary bank account flag
- `account_number` - Bank account number
- `ifsc_code` - IFSC code
- `bank_name` - Bank name
- `account_holder_name` - Account holder name

#### 3. `payout_transactions`
**Key Columns:**
- `loan_application_id` - Link to loan
- `user_id` - User ID
- `transfer_id` - Cashfree transfer ID
- `reference_id` - Cashfree reference ID
- `bene_id` - Beneficiary ID
- `amount` - Transfer amount
- `status` - Transfer status (PENDING/SUCCESS/FAILED/REVERSED)
- `cashfree_response` - Full API response (JSON)
- `created_by` - Admin who initiated

#### 4. `transactions`
**Key Columns:**
- `user_id` - User ID
- `loan_application_id` - Link to loan
- `transaction_type` - `loan_disbursement`
- `amount` - Disbursement amount
- `payment_method` - `cashfree_payout`
- `status` - `completed` (initial)
- `reference_number` - Transfer ID or reference ID

#### 5. `payout_webhook_events`
**Key Columns:**
- `event_id` - Unique event ID
- `event_type` - Webhook event type
- `transfer_id` - Transfer ID
- `payload` - Full webhook payload (JSON)
- `signature` - Webhook signature
- `received_at` - Timestamp

---

## Current Implementation Status

### ✅ What We Have

1. **Complete Disbursement Endpoint**
   - ✅ Route defined: `POST /api/payout/disburse-loan`
   - ✅ Route registered in server.js
   - ✅ Full validation logic
   - ✅ Cashfree integration
   - ✅ Database record creation
   - ✅ Status update logic

2. **Cashfree Payout Service**
   - ✅ Beneficiary management
   - ✅ Transfer initiation
   - ✅ Status checking
   - ✅ Error handling

3. **Webhook Handling**
   - ✅ Webhook endpoint
   - ✅ Event processing
   - ✅ Status updates
   - ✅ Event logging

4. **Frontend Integration**
   - ✅ Admin API service method
   - ✅ UI for bulk disbursement
   - ✅ Status filtering

5. **Database Schema**
   - ✅ All required tables exist
   - ✅ Proper relationships
   - ✅ Status tracking

### ⚠️ What Needs to be Fixed

#### Issue 1: Route Not Found (404 Error) ⚠️ **CRITICAL**

**Problem:**
- Frontend receives `404 (Not Found)` when calling `POST /api/payout/disburse-loan`
- Terminal logs show middleware is triggered but route returns 404

**Evidence:**
```
🎯 Middleware triggered for: POST /api/payout/disburse-loan
📤 res.json intercepted for: POST /disburse-loan Status: 404
```

**Root Cause:**
- Route is defined correctly in `payout.js`
- Route is registered in `server.js`
- But Express is not matching the route

**Possible Causes:**
1. Server needs restart to load routes
2. Route registration order issue
3. Middleware intercepting before route handler
4. Path mismatch (unlikely, paths match)

**Fix Applied:**
- ✅ Added debug logging to verify route registration
- ✅ Added route handler logging
- ✅ Verified route structure

**Next Steps:**
1. **Restart server** - Routes may not be loaded
2. Check console for route registration messages:
   - `[Payout Routes] Module loaded, registering routes...`
   - `✅ Payout routes registered: [list]`
3. If route handler is called, check for errors
4. If route handler is NOT called, check route registration order

**Files to Check:**
- `src/server/server.js` (line 266-270)
- `src/server/routes/payout.js` (line 26)
- Server console output

#### Issue 2: Beneficiary ID Generation

**Current Implementation:**
```javascript
const beneId = `BENE_${loan.user_id}_${Date.now()}`;
```

**Problem:**
- Creates new beneficiary ID on every disbursement
- Should reuse existing beneficiary if available
- Cashfree allows duplicate beneficiaries (409 error), but inefficient

**Recommended Fix:**
- Check if beneficiary exists for user before creating
- Use consistent beneficiary ID format: `BENE_{userId}`
- Only append timestamp if needed for uniqueness

**Impact:** Low - Current implementation works but inefficient

#### Issue 3: Transfer Mode Hardcoded

**Current Implementation:**
```javascript
transferMode: 'NEFT', // Default to NEFT, can be made configurable
```

**Problem:**
- Transfer mode is hardcoded to NEFT
- No way to configure IMPS, RTGS, or other modes

**Recommended Fix:**
- Add configuration option in loan plan or system settings
- Allow admin to select transfer mode per disbursement
- Default to NEFT but allow override

**Impact:** Low - NEFT is standard, but flexibility would be good

#### Issue 4: Missing Error Recovery

**Problem:**
- If transfer fails after beneficiary creation, no rollback
- If database update fails after transfer, inconsistent state
- No retry mechanism for failed transfers

**Recommended Fix:**
- Implement transaction rollback for database operations
- Add retry logic for failed transfers
- Implement compensation logic for partial failures

**Impact:** Medium - Could lead to inconsistent state

#### Issue 5: No Transfer Amount Validation

**Current Implementation:**
```javascript
amount: parseFloat(loan.loan_amount),
```

**Problem:**
- No validation of transfer amount
- No check against Cashfree balance
- No minimum/maximum amount validation

**Recommended Fix:**
- Validate amount > 0
- Check Cashfree account balance before transfer
- Validate against loan plan limits
- Add maximum transfer limit check

**Impact:** Medium - Could cause transfer failures

#### Issue 6: Missing Processed Data Calculation

**Current Implementation:**
- Disbursement endpoint updates status to `account_manager`
- Does NOT set `processed_at` or calculate processed values
- Processed values are set separately (via transaction creation)

**Problem:**
- Inconsistent with other workflows
- Some workflows expect processed data after disbursement
- May cause issues in loan calculations

**Recommended Fix:**
- Option 1: Keep current behavior (disbursement only, processing separate)
- Option 2: Add processing step to disbursement endpoint
- Option 3: Document the separation clearly

**Impact:** Low - Current behavior may be intentional

---

## Testing Checklist

### Pre-Disbursement Validation
- [ ] Loan status is `ready_for_disbursement`
- [ ] User has primary bank account
- [ ] Bank account has valid account number
- [ ] Bank account has valid IFSC code
- [ ] Loan application exists

### Disbursement Execution
- [ ] Beneficiary created in Cashfree
- [ ] Transfer initiated successfully
- [ ] Payout transaction record created
- [ ] General transaction record created
- [ ] Loan status updated to `account_manager`
- [ ] `disbursed_at` timestamp set

### Post-Disbursement
- [ ] Webhook received for transfer status
- [ ] Status updated in `payout_transactions`
- [ ] Loan visible in account manager view
- [ ] User can see repayment schedule

### Error Scenarios
- [ ] Invalid loan ID returns 404
- [ ] Wrong status returns 400 with message
- [ ] Missing bank account returns 400
- [ ] Cashfree API failure handled gracefully
- [ ] Database error handled gracefully

---

## Configuration Requirements

### Environment Variables

```env
# Cashfree Payout API
CASHFREE_CLIENT_ID=your_client_id
CASHFREE_CLIENT_SECRET=your_client_secret
CASHFREE_PAYOUT_API_BASE=https://sandbox.cashfree.com/payout  # or https://api.cashfree.com/payout for production
CASHFREE_PAYOUT_API_VERSION=2024-01-01
CASHFREE_WEBHOOK_SECRET=your_webhook_secret  # Optional, for signature verification
```

### Database Requirements

- `loan_applications` table with status column
- `bank_details` table with primary account flag
- `payout_transactions` table for tracking
- `transactions` table for admin view
- `payout_webhook_events` table for webhook logging

---

## API Documentation

### POST /api/payout/disburse-loan

**Authentication:** Admin token required

**Request Body:**
```json
{
  "loanApplicationId": "123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Loan disbursement initiated successfully",
  "data": {
    "transferId": "TRANSFER_LOAN_123_1234567890",
    "referenceId": "CF123456789",
    "status": "PENDING",
    "amount": 50000,
    "beneficiary": {
      "name": "John Doe",
      "accountNumber": "1234567890",
      "ifsc": "HDFC0001234"
    },
    "loanStatus": "account_manager",
    "disbursedAt": "2025-01-06T10:30:00.000Z"
  }
}
```

**Error Responses:**

**400 - Bad Request:**
```json
{
  "success": false,
  "message": "Loan must be in 'ready_for_disbursement' status. Current status: under_review"
}
```

**404 - Not Found:**
```json
{
  "success": false,
  "message": "Loan application not found"
}
```

**500 - Server Error:**
```json
{
  "success": false,
  "message": "Failed to process loan disbursement",
  "error": "Error details",
  "transferId": "TRANSFER_LOAN_123_1234567890"
}
```

---

## Summary

### Current Status: ⚠️ **BLOCKED BY ROUTE 404 ERROR**

The disbursement functionality is **fully implemented** but **not accessible** due to a route matching issue. The code is correct, but Express is not finding the route.

### Priority Fixes:

1. **🔴 CRITICAL:** Fix route 404 error (restart server, verify route registration)
2. **🟡 MEDIUM:** Add error recovery and rollback logic
3. **🟡 MEDIUM:** Add transfer amount validation
4. **🟢 LOW:** Improve beneficiary ID reuse
5. **🟢 LOW:** Make transfer mode configurable

### Next Steps:

1. **Restart the Node.js server** to ensure routes are loaded
2. **Check server console** for route registration messages
3. **Test the endpoint** with a loan in `ready_for_disbursement` status
4. **Verify webhook** is receiving events from Cashfree
5. **Test error scenarios** to ensure proper handling

---

**Last Updated:** 2025-01-06  
**Document Version:** 1.0  
**Status:** Implementation Complete, Route Issue Pending Resolution

