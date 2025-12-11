# Backend-Only Calculations - Implementation Guide

## Overview

**All loan calculations MUST be performed on the backend only.** The frontend should never perform any calculations - it only displays the results received from the backend API.

## Architecture

```
Frontend (React)
    ↓ API Call
Backend API Endpoint
    ↓ Uses
Centralized Calculation Function (loanCalculations.js)
    ↓ Returns
Complete Calculation Results
    ↓ Display
Frontend UI
```

## Backend Calculation Function

**Location:** `src/server/utils/loanCalculations.js`

**Function:** `calculateCompleteLoanValues(loanData, planData, userData, options)`

**Returns:** Complete calculation breakdown including:
- Principal amount
- All fees with GST (separated by application method)
- Disbursal amount
- Interest calculation
- Total repayable amount

## API Endpoints

### GET /api/loan-calculations/:loanId

**Purpose:** Get complete calculation for a specific loan

**Authentication:** Required (Admin)

**Response:**
```json
{
  "success": true,
  "data": {
    "loan_id": 123,
    "principal": 10000,
    "fees": {
      "deductFromDisbursal": [...],
      "addToTotal": [...]
    },
    "totals": {
      "disbursalFee": 1400,
      "disbursalFeeGST": 252,
      "repayableFee": 0,
      "repayableFeeGST": 0,
      "totalDisbursalDeduction": 1652,
      "totalRepayableAddition": 0
    },
    "disbursal": {
      "amount": 8348,
      "calculation": "Principal (10000) - Deduct Fees (1652) = 8348"
    },
    "interest": {
      "amount": 150,
      "days": 15,
      "rate_per_day": 0.001,
      "calculation_method": "fixed",
      "calculation_date": "2025-01-05T00:00:00.000Z",
      "repayment_date": "2025-01-20T00:00:00.000Z"
    },
    "total": {
      "repayable": 10150,
      "breakdown": "Principal (10000) + Interest (150) + Repayable Fees (0) = 10150"
    }
  }
}
```

## Frontend Implementation

### ✅ DO:
- Fetch calculations from API: `GET /api/loan-calculations/:loanId`
- Display values directly from API response
- Show loading states while fetching
- Handle API errors gracefully

### ❌ DON'T:
- Perform any calculations in frontend
- Calculate fees, GST, interest, or totals in React components
- Use client-side calculation functions
- Manipulate calculation results before displaying

## Example: Applied Loans Tab

### Before (❌ Wrong - Frontend Calculation):
```typescript
const calculateValues = (principal, pfPercent, intPercent, days) => {
  const processingFee = (principal * pfPercent) / 100;
  const gst = processingFee * 0.18;
  const disbAmount = principal - processingFee - gst;
  const interest = (disbAmount + processingFee) * days * (intPercent / 100);
  const totalAmount = disbAmount + processingFee + interest + gst;
  return { disbAmount, processingFee, gst, interest, totalAmount };
};
```

### After (✅ Correct - Backend Only):
```typescript
// Fetch calculation from backend
const fetchLoanCalculation = async (loanId: number) => {
  try {
    const response = await adminApiService.getLoanCalculation(loanId);
    if (response.success && response.data) {
      return response.data;
    }
  } catch (error) {
    console.error('Error fetching loan calculation:', error);
  }
  return null;
};

// Display values from backend
const calculation = await fetchLoanCalculation(loan.id);
if (calculation) {
  // Use calculation.disbursal.amount
  // Use calculation.totals.disbursalFee
  // Use calculation.totals.disbursalFeeGST
  // Use calculation.interest.amount
  // Use calculation.total.repayable
}
```

## Benefits of Backend-Only Calculations

1. **Consistency**: Same calculation logic everywhere
2. **Security**: Calculation logic not exposed to clients
3. **Maintainability**: Single place to update calculation rules
4. **Accuracy**: No rounding differences between frontend/backend
5. **Audit Trail**: All calculations logged on backend
6. **Business Logic Protection**: GST rates, fee rules protected

## Migration Checklist

- [ ] Remove all frontend calculation functions
- [ ] Update Applied Loans tab to use API
- [ ] Update KFS generation to use centralized function
- [ ] Update Loan Agreement generation to use centralized function
- [ ] Update loan preview/confirmation pages to use API
- [ ] Remove any client-side calculation utilities
- [ ] Test all calculation displays use backend data
- [ ] Verify no calculations in browser console

## Testing

### Test Cases:
1. **Applied Loans Tab**: Verify all values come from API
2. **KFS Generation**: Verify uses backend calculation
3. **Loan Agreement**: Verify uses backend calculation
4. **Loan Preview**: Verify uses backend calculation
5. **Multiple Fees**: Verify GST calculated correctly
6. **Salary Date**: Verify interest days calculated correctly

### How to Verify:
1. Open browser DevTools → Network tab
2. Check API calls to `/api/loan-calculations/:loanId`
3. Verify frontend displays exact values from API response
4. Search codebase for calculation functions in frontend (should find none)

---

**Last Updated:** January 2025
**Version:** 1.0.0

