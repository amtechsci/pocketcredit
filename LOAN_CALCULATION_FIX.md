# Loan Calculation Fix

## Issues Fixed

### 1. **Interest Rate Calculation Error**
**Problem:** Interest rate was being divided by 100 when it was already in decimal format
```javascript
// ❌ WRONG (Old)
const interest = (disbAmount + processingFee) * days * (interestPercentPerDay / 100);
// With 0.001 rate: 10,000 × 15 × (0.001/100) = 1.5 ❌

// ✅ CORRECT (Fixed)
const interest = principal * interestPercentPerDay * days;
// With 0.001 rate: 10,000 × 0.001 × 15 = 150 ✅
```

### 2. **Wrong Base Amount for Interest**
**Problem:** Interest was calculated on `(disbAmount + processingFee)` instead of `principal`
- **Fixed:** Interest is now calculated on the principal amount only

### 3. **GST on Processing Fee**
**Problem:** GST (18%) was being added to processing fee
- **Fixed:** Removed GST calculation entirely (processing fee is flat %)

### 4. **Wrong Total Repayable**
**Problem:** Total included processing fee + interest + GST
```javascript
// ❌ WRONG (Old)
totalRepayable = disbAmount + processingFee + interest + gst;

// ✅ CORRECT (Fixed)
totalRepayable = principal + interest;
```

## Correct Calculation Flow

### Example: ₹10,000 loan for 15 days (Bronze tier)

**Member Tier Rates:**
- Processing Fee: **10%**
- Interest Rate: **0.001** per day (which is **0.1%** per day)

**Calculation:**
```
1. Loan Amount (Principal):        ₹10,000
2. Processing Fee (10%):            ₹1,000  (deducted upfront)
3. Disbursement to User:            ₹9,000  (10,000 - 1,000)
4. Interest Calculation:
   = Principal × Interest Rate × Days
   = 10,000 × 0.001 × 15
   = ₹150
5. Total Repayable:
   = Principal + Interest
   = 10,000 + 150
   = ₹10,150
```

### What User Sees:
```
Loan Amount:        ₹10,000
Processing Fee:     ₹1,000
Interest:           ₹150
Total Repayable:    ₹10,150
```

### What Happens Behind the Scenes:
```
1. User applies for ₹10,000
2. Processing fee ₹1,000 is deducted
3. User receives ₹9,000 in bank (NOT shown to user)
4. User must repay ₹10,150
```

## Files Changed

### 1. `src/server/utils/loanCalculations.js`
- Fixed interest calculation formula
- Removed GST calculation
- Fixed total repayable calculation
- Added detailed comments

### 2. `src/server/routes/loanPlans.js`
- Fixed interest calculation in plan preview
- Updated default interest rate from 0.01 to 0.001
- Updated default processing fee from 3% to 10%
- Removed processing fee from total repayable

## Database Interest Rate Format

The `interest_percent_per_day` column stores values as **decimal rates**, not percentages:

| DB Value | Meaning | Display | Calculation |
|----------|---------|---------|-------------|
| 0.001 | 0.1% per day | 0.10% | × 0.001 × days |
| 0.0001 | 0.01% per day | 0.01% | × 0.0001 × days |
| 0.01 | 1% per day | 1.00% | × 0.01 × days |

**Key Point:** Do NOT divide by 100 in calculations - the DB value is already in the correct format!

## Verification Test

Created test script: `src/server/scripts/test_loan_calculation.js`

**Test Results:**
```
✅ Processing Fee: ₹1,000 (10% of 10,000)
✅ Disbursement: ₹9,000 (10,000 - 1,000)
✅ Interest: ₹150 (10,000 × 0.001 × 15)
✅ Total Repayable: ₹10,150 (10,000 + 150)

✅ ALL CALCULATIONS CORRECT!
```

## Impact

- All existing loan applications will use the correct calculation
- Loan plan previews will show correct amounts
- Admin loan calculations will be accurate
- KFS and loan agreement documents will have correct figures

## Next Steps

1. ✅ Fixed calculation logic
2. ✅ Updated both calculation utilities and routes
3. ✅ Tested and verified
4. 🔄 Refresh frontend to see correct amounts
5. ⚠️ May need to recalculate existing pending applications if they were created with old formula

---

**Date Fixed:** January 2025
**Tested:** ✅ Verified with Bronze tier (10% PF, 0.001 interest)

