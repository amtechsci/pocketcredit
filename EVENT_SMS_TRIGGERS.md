# Event-Based SMS Triggers - Implementation Status

## Overview
This document lists all event-based SMS templates and where they should automatically trigger in the system.

---

## ✅ IMPLEMENTED (Auto-Triggers Working)

### 1. **loan_cleared** - Loan Cleared
- **Template Key**: `loan_cleared`
- **Status**: ✅ **IMPLEMENTED**
- **Triggers When**: Loan is fully paid/cleared
- **Trigger Locations**:
  - `src/server/routes/payment.js` (line ~877, ~1750, ~2185)
    - When payment webhook processes full payment
    - When order-status check confirms full payment
  - `src/server/routes/userProfile.js` (line ~3156, ~3445)
    - When admin adds full_payment/settlement transaction
    - When all EMIs are paid via admin transaction

---

### 2. **emi_cleared** - EMI Cleared
- **Template Key**: `emi_cleared`
- **Status**: ✅ **IMPLEMENTED**
- **Triggers When**: An EMI is paid (but loan is NOT fully cleared yet)
- **Trigger Locations**:
  - `src/server/routes/payment.js` (line ~1697, ~2155)
    - When payment webhook processes EMI payment (not last EMI)
  - `src/server/routes/userProfile.js` (line ~3433)
    - When admin adds EMI transaction (but not all EMIs paid)

---

## ❌ NOT IMPLEMENTED (Manual Only - Need Auto-Triggers)

### 3. **otp** - OTP Verification
- **Template Key**: `otp`
- **Status**: ✅ **WORKING** (using direct SMS, not event template system)
- **Current Implementation**: 
  - OTP SMS is sent via `smsService.sendSMS()` (OneXtel API) directly in:
    - `src/server/controllers/authController.js` (line 71) - User login OTP
      - Route: `POST /api/auth/send-otp`
      - Template ID: `1107900001243800002`
    - `src/server/routes/adminAuth.js` (line 230) - Admin login OTP
      - Route: `POST /api/admin/auth/send-otp`
      - Template ID: `1107900001243800002`
- **Note**: Both user and admin OTP are working correctly with the new OneXtel API. They use direct SMS sending (not event template system) which is fine for OTP since it needs to be immediate and doesn't need template management.

---

### 4. **acc_manager_assigned** - Account Manager Assigned
- **Template Key**: `acc_manager_assigned`
- **Status**: ❌ **NOT IMPLEMENTED**
- **Should Trigger When**: Loan status changes to `'account_manager'`
- **Trigger Locations Needed**:
  - `src/server/routes/adminApplications.js` (line ~575)
    - When admin updates application status to `'account_manager'`
  - `src/server/routes/userProfile.js` (line ~2968)
    - When loan is disbursed and status set to `'account_manager'`
  - `src/server/routes/payout.js` (line ~224)
    - When loan is disbursed via Cashfree payout
- **Variables Needed**:
  - `acc_manager_name`: Name of assigned account manager
  - `acc_manager_phone`: Phone number of account manager
  - `loan_id`: Loan application ID

---

### 5. **bank_linked** - Bank Account Linked
- **Template Key**: `bank_linked`
- **Status**: ✅ **IMPLEMENTED**
- **Triggers When**: Bank account is successfully saved/linked
- **Trigger Locations**:
  - `src/server/routes/bankDetails.js` (line ~247)
    - When user saves bank details for loan application (`POST /api/bank-details`)
  - `src/server/routes/bankDetails.js` (line ~476)
    - When user saves bank details at user level (`POST /api/bank-details/user`)
- **Variables Used**:
  - `bank_name`: Bank name
  - `account_number`: Last 4 digits of account (masked as ****XXXX)

---

### 6. **limit_increase** - Credit Limit Update
- **Template Key**: `limit_increase`
- **Status**: ✅ **IMPLEMENTED**
- **Triggers When**: Credit limit is increased
- **Trigger Locations**:
  - `src/server/routes/creditLimit.js` (line ~455)
    - When admin recalculates credit limit and new limit is higher
  - `src/server/routes/userProfile.js` (line ~3097)
    - When loan is disbursed and credit limit increases
- **Variables Used**:
  - `new_limit`: New credit limit amount (formatted as ₹X,XXX)

---

### 7. **membership_update** - Membership Status Update
- **Template Key**: `membership_update`
- **Status**: ❌ **NOT IMPLEMENTED**
- **Should Trigger When**: User's membership tier/status changes
- **Trigger Locations Needed**:
  - **TO BE DETERMINED**: Need to find where membership status is updated
  - Possible locations:
    - When user reaches premium limit (₹1,50,000)
    - When user is moved to/from cooling period
    - When membership tier changes based on loan count
- **Variables Needed**:
  - `membership_tier`: New membership tier/status
  - `new_limit`: New credit limit (if applicable)

---

### 8. **part_payment** - Part Payment Received
- **Template Key**: `part_payment`
- **Status**: ✅ **IMPLEMENTED**
- **Triggers When**: General repayment payment is received but doesn't clear the loan
- **Trigger Locations**:
  - `src/server/routes/payment.js` (line ~1787)
    - When payment webhook processes `loan_repayment` type payment that doesn't clear the loan
  - `src/server/routes/payment.js` (line ~2277)
    - When order-status check processes `loan_repayment` type payment that doesn't clear the loan
- **Variables Used**:
  - `amount`: Payment amount received (formatted as ₹X,XXX)
- **Note**: Only triggers for `loan_repayment` payment type (not for EMI payments which trigger `emi_cleared`, or full payments which trigger `loan_cleared`)

---

## Summary

| Template Key | Template Name | Status | Auto-Trigger |
|-------------|---------------|--------|--------------|
| `loan_cleared` | Loan Cleared | ✅ Implemented | ✅ Yes |
| `emi_cleared` | EMI Cleared | ✅ Implemented | ✅ Yes |
| `otp` | OTP Verification | ✅ Working | ✅ Yes (direct SMS) |
| `acc_manager_assigned` | Account Manager Assigned | ❌ Not Implemented | ❌ No |
| `bank_linked` | Bank Account Linked | ✅ Implemented | ✅ Yes |
| `limit_increase` | Credit Limit Update | ✅ Implemented | ✅ Yes |
| `membership_update` | Membership Status Update | ❌ Not Implemented | ❌ No |
| `part_payment` | Part Payment Received | ✅ Implemented | ✅ Yes |

---

## Next Steps

1. **acc_manager_assigned**: Add trigger when loan status → `'account_manager'`
2. **bank_linked**: Add trigger when bank account is saved
3. **limit_increase**: Add trigger when credit limit increases
4. **membership_update**: Determine where membership changes and add trigger
5. **part_payment**: Determine where partial payments are processed and add trigger
6. **otp**: Consider migrating to event template system (optional)

---

## Implementation Notes

- All triggers should use `triggerEventSMS()` from `src/server/utils/eventSmsTrigger.js`
- Triggers should be wrapped in try-catch blocks to prevent failures from blocking main operations
- SMS failures should be logged but not cause the main operation to fail
- All triggers should log to `sms_logs` table with status `'auto'`
