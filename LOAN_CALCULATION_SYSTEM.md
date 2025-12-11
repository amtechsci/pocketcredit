# Loan Calculation System - Complete Documentation

## Table of Contents
1. [Overview](#overview)
2. [Requirements](#requirements)
3. [Calculation Rules](#calculation-rules)
4. [Implementation Plan](#implementation-plan)
5. [API Specifications](#api-specifications)
6. [Database Schema](#database-schema)
7. [Examples](#examples)
8. [Testing](#testing)

---

## Overview

This document describes the centralized loan calculation system that serves as a **single source of truth** for all loan-related calculations across the application, including:
- KFS (Key Facts Statement) generation
- Loan Agreement generation
- Applied Loans display
- Real-time loan interest calculations

### Key Principles
- **Backend-Only Calculations**: ALL calculations are performed on the backend. Frontend only displays results.
- **Single Source of Truth**: One centralized function handles all calculations
- **GST Compliance**: All fees and penalties include 18% GST
- **Fee Types**: Fees can be either "Deduct from Disbursal" or "Add to Total Repayable"
- **Flexible Interest Calculation**: Supports fixed days and salary date-based calculations
- **API-Driven**: Frontend fetches calculated values via API endpoints

---

## Requirements

### 1. Centralized Calculation Function
- Single function that calculates all loan values
- Used by KFS, Loan Agreement, Applied Loans, and real-time calculations
- Handles multiple fees with GST
- Supports both fixed days and salary date-based interest calculation

### 2. GST Rules
- **All Fees**: Include 18% GST
- **All Penalties**: Include 18% GST
- GST is calculated on the fee amount, then added to the fee

### 3. Fee Application Methods

#### Deduct from Disbursal
- Fee amount + GST is deducted from the principal amount
- Reduces the disbursal amount (what user receives)
- Example: Processing Fee, Software Fee (if set to deduct)

#### Add to Total Repayable Amount
- Fee amount + GST is added to the total repayable amount
- Does not affect disbursal amount
- Example: Software Fee (if set to add to total)

### 4. Applied Loans Tab Updates
The Applied Loans tab in User Profile should display:
- **Loan ID**: Unique loan application identifier
- **Principal Amount**: Original loan amount requested
- **Loan Plan**: Plan code (clickable, shows plan details modal)
- **Disbursal Amount**: Calculated amount user receives
- **Disbursal Fee**: Sum of all "Deduct from Disbursal" fees
- **Disbursal Fee GST**: Sum of GST on disbursal fees
- **Repayable Fee**: Sum of all "Add to Total Repayable" fees
- **Repayable Fee GST**: Sum of GST on repayable fees
- **Interest**: Calculated interest amount
- **Total Amount**: Total repayable amount
- **Status**: Current loan status
- **Status Date**: Date when status was last updated
- **Action**: Available actions (Edit, Approve, Reject, etc.)

### 5. Interest Calculation Logic

#### Fixed Days Loan
- Simple calculation: `Interest = Principal × Interest% per day × Days`
- Days are fixed (e.g., 15 days, 30 days)

#### Salary Date-Based Loan
- Calculate from today's date to salary date
- **If minimum days > days until salary date**: Use same salary date
- **Else**: Use next salary date
- Example:
  - Today: Jan 5
  - Salary Date: Jan 15
  - Plan Duration: 15 days
  - Calculation: Jan 5 to Jan 15 = 10 days < 15 days → Use next salary date (Feb 15)
  - Interest calculated for: Jan 5 to Feb 15 = 41 days

---

## Calculation Rules

### Formula Breakdown

#### 1. Fee Calculation (with GST)
```
Fee Amount = Principal × (Fee Percentage / 100)
GST Amount = Fee Amount × 0.18
Total Fee with GST = Fee Amount + GST Amount
```

#### 2. Disbursal Amount Calculation
```
Disbursal Amount = Principal - Σ(All "Deduct from Disbursal" fees with GST)
```

#### 3. Interest Calculation

**Fixed Days:**
```
Interest = Principal × Interest% per day × Days
```

**Salary Date-Based:**
```
Days = Calculate days from today to appropriate salary date
Interest = Principal × Interest% per day × Days
```

#### 4. Total Repayable Amount
```
Total Repayable = Principal + Interest + Σ(All "Add to Total Repayable" fees with GST)
```

### Complete Example

**Loan Details:**
- Principal: ₹10,000
- Processing Fee: 14% (Deduct from Disbursal)
- Software Fee: 2% (Deduct from Disbursal)
- Interest Rate: 0.1% per day
- Duration: 15 days

**Step 1: Calculate Processing Fee**
```
PF Amount = ₹10,000 × 14% = ₹1,400
PF GST = ₹1,400 × 18% = ₹252
Total PF = ₹1,400 + ₹252 = ₹1,652
```

**Step 2: Calculate Software Fee**
```
SF Amount = ₹10,000 × 2% = ₹200
SF GST = ₹200 × 18% = ₹36
Total SF = ₹200 + ₹36 = ₹236
```

**Step 3: Calculate Disbursal Amount**
```
Disbursal = ₹10,000 - ₹1,652 - ₹236 = ₹8,112
```

**Step 4: Calculate Interest**
```
Interest = ₹10,000 × 0.001 × 15 = ₹150
```

**Step 5: Calculate Total Repayable**
```
Total Repayable = ₹10,000 + ₹150 = ₹10,150
(No "Add to Total" fees in this example)
```

**Alternative: Software Fee "Add to Total Repayable"**

If Software Fee was set to "Add to Total Repayable":
```
Disbursal = ₹10,000 - ₹1,652 = ₹8,348
Total Repayable = ₹10,000 + ₹150 + ₹236 = ₹10,386
```

---

## Implementation Plan

### Phase 1: Create Centralized Calculation Function

**File:** `src/server/utils/loanCalculations.js`

**New Function:** `calculateCompleteLoanValues(loanData, planData, userData, options)`

**Parameters:**
```javascript
{
  loanData: {
    loan_amount: number,
    loan_id: number,
    status: string,
    disbursed_at: Date | null,
    plan_snapshot: Object | null
  },
  planData: {
    plan_id: number,
    plan_type: 'single' | 'multi_emi',
    repayment_days: number | null,
    emi_count: number | null,
    emi_frequency: string | null,
    interest_percent_per_day: number,
    calculate_by_salary_date: boolean,
    fees: Array<{
      fee_name: string,
      fee_percent: number,
      application_method: 'deduct_from_disbursal' | 'add_to_total'
    }>
  },
  userData: {
    user_id: number,
    salary_date: number | null // Day of month (1-31)
  },
  options: {
    customDays: number | null, // Override days calculation
    calculationDate: Date | null // Date to calculate from (default: today)
  }
}
```

**Returns:**
```javascript
{
  principal: number,
  fees: {
    deductFromDisbursal: Array<{
      fee_name: string,
      fee_percent: number,
      fee_amount: number,
      gst_amount: number,
      total_with_gst: number
    }>,
    addToTotal: Array<{
      fee_name: string,
      fee_percent: number,
      fee_amount: number,
      gst_amount: number,
      total_with_gst: number
    }>
  },
  totals: {
    disbursalFee: number, // Sum of all deduct fees (without GST)
    disbursalFeeGST: number, // Sum of GST on deduct fees
    repayableFee: number, // Sum of all add fees (without GST)
    repayableFeeGST: number, // Sum of GST on add fees
    totalDisbursalDeduction: number, // Sum of all deduct fees with GST
    totalRepayableAddition: number // Sum of all add fees with GST
  },
  disbursal: {
    amount: number,
    calculation: string // Explanation
  },
  interest: {
    amount: number,
    days: number,
    rate_per_day: number,
    calculation_method: 'fixed' | 'salary_date',
    calculation_date: Date,
    repayment_date: Date | null
  },
  total: {
    repayable: number,
    breakdown: string // Explanation
  }
}
```

### Phase 2: Update Existing Usages

#### 2.1 Update KFS Generation
**File:** `src/server/routes/kfs.js`
- Replace existing calculation logic with `calculateCompleteLoanValues()`
- Use returned values for KFS data structure

#### 2.2 Update Loan Plans Route
**File:** `src/server/routes/loanPlans.js`
- Replace calculation logic in `/calculate` endpoint
- Use centralized function for consistency

#### 2.3 Update Loan Agreement (if exists)
- Use centralized function for all calculations

### Phase 3: Create/Update API Endpoint

**File:** `src/server/routes/loanCalculations.js`

**New Endpoint:** `GET /api/loan-calculations/:loanId`

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
      "calculation_date": "2025-01-05",
      "repayment_date": "2025-01-20"
    },
    "total": {
      "repayable": 10150,
      "breakdown": "Principal (10000) + Interest (150) + Repayable Fees (0) = 10150"
    }
  }
}
```

### Phase 4: Update Applied Loans Tab (Backend-Only)

**File:** `src/admin/pages/UserProfileDetail.tsx`

**Changes:**
1. **Remove** frontend `calculateValues()` function completely
2. **Remove** all client-side calculation logic
3. Fetch loan calculations from `/api/loan-calculations/:loanId` for each loan
4. Display backend-calculated values only
5. Update table columns to show:
   - Loan ID
   - Principal Amount
   - Loan Plan (clickable, shows modal with plan details from backend)
   - Disbursal Amount (from backend)
   - Disbursal Fee (from backend)
   - Disbursal Fee GST (from backend)
   - Repayable Fee (from backend)
   - Repayable Fee GST (from backend)
   - Interest (from backend)
   - Total Amount (from backend)
   - Status
   - Status Date
   - Action

**Implementation:**
- For each loan in Applied Loans tab, make API call: `GET /api/loan-calculations/:loanId`
- Store calculation results in component state
- Display values directly from API response
- No calculations performed in frontend

**Loan Plan Modal:**
- Fetch plan details from backend API
- Show plan code and name
- Display all fees with percentages (from backend)
- Show interest rate (from backend)
- Show plan type and duration (from backend)
- Display extension options (if applicable, from backend)

---

## API Specifications

### GET /api/loan-calculations/:loanId

**Description:** Get complete loan calculation breakdown for a loan application.

**Authentication:** Required (Admin or User)

**Parameters:**
- `loanId` (path): Loan application ID

**Query Parameters:**
- `customDays` (optional): Override days calculation
- `calculationDate` (optional): Date to calculate from (ISO format)

**Response:**
```json
{
  "success": true,
  "data": {
    "loan_id": 123,
    "principal": 10000,
    "fees": {
      "deductFromDisbursal": [
        {
          "fee_name": "Processing Fee",
          "fee_percent": 14,
          "fee_amount": 1400,
          "gst_amount": 252,
          "total_with_gst": 1652
        }
      ],
      "addToTotal": []
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

**Error Response:**
```json
{
  "success": false,
  "message": "Loan not found"
}
```

---

## Database Schema

### loan_applications Table
```sql
- id (INT, PRIMARY KEY)
- user_id (INT, FOREIGN KEY)
- loan_amount (DECIMAL) -- Principal amount
- plan_snapshot (JSON) -- Snapshot of plan at time of application
- fees_breakdown (JSON) -- Breakdown of all fees
- disbursal_amount (DECIMAL) -- Calculated disbursal amount
- total_deduct_from_disbursal (DECIMAL) -- Sum of deduct fees with GST
- total_add_to_total (DECIMAL) -- Sum of add fees with GST
- interest_percent_per_day (DECIMAL) -- Interest rate
- processing_fee_percent (DECIMAL) -- Legacy field (deprecated)
- processing_fee (DECIMAL) -- Legacy field (deprecated)
- total_interest (DECIMAL) -- Calculated interest
- total_repayable (DECIMAL) -- Total repayable amount
- status (VARCHAR) -- Loan status
- disbursed_at (DATETIME) -- When loan was disbursed
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### loan_plans Table
```sql
- id (INT, PRIMARY KEY)
- plan_name (VARCHAR)
- plan_code (VARCHAR)
- plan_type (ENUM: 'single', 'multi_emi')
- repayment_days (INT) -- For single payment plans
- emi_frequency (ENUM) -- For multi-EMI plans
- emi_count (INT) -- For multi-EMI plans
- interest_percent_per_day (DECIMAL)
- calculate_by_salary_date (TINYINT) -- 0 or 1
- is_active (TINYINT)
- is_default (TINYINT)
- allow_extension (TINYINT)
- extension_show_from_days (INT)
- extension_show_till_days (INT)
```

### loan_plan_fees Table
```sql
- id (INT, PRIMARY KEY)
- loan_plan_id (INT, FOREIGN KEY)
- fee_type_id (INT, FOREIGN KEY)
- fee_percent (DECIMAL) -- Fee percentage
```

### fee_types Table
```sql
- id (INT, PRIMARY KEY)
- fee_name (VARCHAR) -- e.g., "Processing Fee", "Software Fee"
- application_method (ENUM: 'deduct_from_disbursal', 'add_to_total')
- is_active (TINYINT)
- description (TEXT)
```

### users Table
```sql
- id (INT, PRIMARY KEY)
- salary_date (INT) -- Day of month (1-31)
- selected_loan_plan_id (INT, FOREIGN KEY)
```

---

## Examples

### Example 1: Single Payment Plan with Multiple Fees

**Input:**
- Principal: ₹10,000
- Plan: PC30 (Single, 15 days)
- Fees:
  - Processing Fee: 14% (Deduct from Disbursal)
  - Software Fee: 2% (Deduct from Disbursal)
- Interest Rate: 0.1% per day

**Calculation:**
```
Processing Fee:
  Amount: ₹1,400
  GST: ₹252
  Total: ₹1,652

Software Fee:
  Amount: ₹200
  GST: ₹36
  Total: ₹236

Disbursal Amount:
  ₹10,000 - ₹1,652 - ₹236 = ₹8,112

Interest:
  ₹10,000 × 0.001 × 15 = ₹150

Total Repayable:
  ₹10,000 + ₹150 = ₹10,150
```

### Example 2: Fee Added to Total Repayable

**Input:**
- Principal: ₹10,000
- Plan: PC30 (Single, 15 days)
- Fees:
  - Processing Fee: 14% (Deduct from Disbursal)
  - Software Fee: 2% (Add to Total Repayable)
- Interest Rate: 0.1% per day

**Calculation:**
```
Processing Fee:
  Amount: ₹1,400
  GST: ₹252
  Total: ₹1,652

Software Fee:
  Amount: ₹200
  GST: ₹36
  Total: ₹236

Disbursal Amount:
  ₹10,000 - ₹1,652 = ₹8,348

Interest:
  ₹10,000 × 0.001 × 15 = ₹150

Total Repayable:
  ₹10,000 + ₹150 + ₹236 = ₹10,386
```

### Example 3: Salary Date-Based Calculation

**Input:**
- Principal: ₹10,000
- Plan: PC30 (Single, 15 days, Calculate by Salary Date)
- User Salary Date: 15th of month
- Today: January 5, 2025
- Fees:
  - Processing Fee: 14% (Deduct from Disbursal)
- Interest Rate: 0.1% per day

**Calculation:**
```
Next Salary Date: January 15, 2025
Days from today: 10 days
Minimum days required: 15 days
Since 10 < 15, use next salary date: February 15, 2025
Actual days: 41 days (Jan 5 to Feb 15)

Processing Fee:
  Amount: ₹1,400
  GST: ₹252
  Total: ₹1,652

Disbursal Amount:
  ₹10,000 - ₹1,652 = ₹8,348

Interest:
  ₹10,000 × 0.001 × 41 = ₹410

Total Repayable:
  ₹10,000 + ₹410 = ₹10,410
```

---

## Testing

### Test Cases

#### Test Case 1: Basic Calculation
- Principal: ₹10,000
- Processing Fee: 14% (Deduct)
- Interest: 0.1% per day, 15 days
- Expected Disbursal: ₹8,348
- Expected Interest: ₹150
- Expected Total: ₹10,150

#### Test Case 2: Multiple Deduct Fees
- Principal: ₹10,000
- Processing Fee: 14% (Deduct)
- Software Fee: 2% (Deduct)
- Interest: 0.1% per day, 15 days
- Expected Disbursal: ₹8,112
- Expected Interest: ₹150
- Expected Total: ₹10,150

#### Test Case 3: Add to Total Fee
- Principal: ₹10,000
- Processing Fee: 14% (Deduct)
- Software Fee: 2% (Add to Total)
- Interest: 0.1% per day, 15 days
- Expected Disbursal: ₹8,348
- Expected Interest: ₹150
- Expected Total: ₹10,386

#### Test Case 4: Salary Date Calculation
- Principal: ₹10,000
- Today: Jan 5
- Salary Date: Jan 15
- Plan Duration: 15 days
- Expected: Use Feb 15 (next salary date)
- Expected Days: 41 days

#### Test Case 5: GST Verification
- Principal: ₹10,000
- Fee: 14%
- Fee Amount: ₹1,400
- Expected GST: ₹252 (18% of ₹1,400)
- Expected Total Fee: ₹1,652

---

## Implementation Checklist

### Phase 1: Core Function
- [ ] Create `calculateCompleteLoanValues()` function
- [ ] Implement fee calculation with GST
- [ ] Implement disbursal amount calculation
- [ ] Implement interest calculation (fixed days)
- [ ] Implement interest calculation (salary date)
- [ ] Add validation and error handling
- [ ] Write unit tests

### Phase 2: Integration
- [ ] Update KFS route to use new function
- [ ] Update loan plans route to use new function
- [ ] Update loan agreement generation (if exists)
- [ ] Test all integrations

### Phase 3: API Endpoint
- [ ] Create `/api/loan-calculations/:loanId` endpoint
- [ ] Add authentication middleware
- [ ] Add error handling
- [ ] Add API documentation

### Phase 4: Frontend Updates
- [ ] Update Applied Loans tab UI
- [ ] Add Loan Plan modal
- [ ] Replace static calculation with API call
- [ ] Add loading states
- [ ] Add error handling
- [ ] Test UI with real data

### Phase 5: Testing & Documentation
- [ ] Test all calculation scenarios
- [ ] Test edge cases
- [ ] Update API documentation
- [ ] Create user guide
- [ ] Performance testing

---

## Notes

1. **Rounding**: All amounts should be rounded to 2 decimal places
2. **GST Rate**: Currently 18%, but should be configurable in the future
3. **Backward Compatibility**: Legacy fields (`processing_fee_percent`) should still work but are deprecated
4. **Performance**: Calculation function should be optimized for frequent calls
5. **Caching**: Consider caching calculations for disbursed loans (they don't change)

---

## Future Enhancements

1. **Configurable GST Rate**: Store GST rate in database configuration
2. **Penalty Calculations**: Integrate penalty calculations with GST
3. **Multi-EMI Support**: Full support for multi-EMI calculations
4. **Loan Extension**: Calculate extension fees and interest
5. **Historical Calculations**: Store calculation snapshots for audit
6. **Bulk Calculations**: API endpoint for calculating multiple loans at once

---

## Contact & Support

For questions or issues related to loan calculations, please contact the development team or refer to the code documentation in `src/server/utils/loanCalculations.js`.

---

**Last Updated:** January 2025
**Version:** 1.0.0

