# Loan Calculation System

## Overview
This document describes the centralized loan calculation system that provides consistent calculations across both user and admin interfaces.

## Architecture

### Backend Components

#### 1. Calculation Utilities (`src/server/utils/loanCalculations.js`)
Core calculation logic with the following functions:

- **`calculateTotalDays(disbursedDate)`**: Calculates the number of days from disbursement to today (inclusive counting).
- **`calculateLoanValues(loanData, days)`**: Performs all loan calculations based on principal, fees, and days.
- **`getLoanCalculation(db, loanId, customDays)`**: Fetches loan data and returns calculated values.
- **`updateLoanCalculation(db, loanId, updates)`**: Updates loan parameters and recalculates derived values.

#### 2. API Routes (`src/server/routes/loanCalculations.js`)
RESTful endpoints for loan calculations:

- `GET /api/loan-calculations/:loanId?days=X` - Get calculated values
- `PUT /api/loan-calculations/:loanId` - Update loan parameters
- `POST /api/loan-calculations/calculate` - Preview calculation without saving
- `GET /api/loan-calculations/:loanId/days` - Get days since disbursement

### Frontend Components

#### 1. Admin API Service (`src/services/adminApi.ts`)
TypeScript methods for calling calculation APIs:

- `getLoanCalculation(loanId, days?)` - Fetch calculated values
- `updateLoanCalculation(loanId, data)` - Update PF% and Interest%
- `calculateLoanPreview(data)` - Preview calculations
- `getLoanDays(loanId)` - Get elapsed days

#### 2. Admin User Profile (`src/admin/pages/UserProfileDetail.tsx`)
Two loan tabs with integrated calculations:

- **Applied Loans Tab**: Uses fixed plan days (e.g., 15 days)
- **Loans Tab**: Uses actual elapsed days since disbursement

## Calculation Formulas

### Input Parameters
- **Principal Amount** (`loan_amount`): The loan amount requested
- **Processing Fee %** (`processing_fee_percent`): Percentage fee (default: 14%)
- **Interest % per Day** (`interest_percent_per_day`): Daily interest rate (default: 0.3%)
- **Days**: Number of days for interest calculation

### Calculation Steps

1. **Processing Fee**
   ```
   Processing Fee = Principal × (PF% / 100)
   ```

2. **GST** (18% on Processing Fee)
   ```
   GST = Processing Fee × 0.18
   ```

3. **Disbursement Amount** (What user receives)
   ```
   Disb Amount = Principal - Processing Fee - GST
   ```

4. **Interest** (Based on days)
   ```
   Interest = (Disb Amount + Processing Fee) × Days × (Interest% / 100)
   ```

5. **Total Repayable**
   ```
   Total Amount = Disb Amount + Processing Fee + Interest + GST
   ```

## Two Calculation Modes

### Mode 1: Applied Loans (Fixed Days)
For loans in application process (Submitted, Under Review, Follow Up, Disbursal):
- Uses **fixed plan days** from `plan_snapshot.repayment_days`
- Default: 15 days if plan not available
- Days remain constant throughout application process

### Mode 2: Running Loans (Actual Days)
For disbursed loans (Account Manager, Cleared):
- Uses **actual elapsed days** from `disbursed_at` date
- Calculated as: `(Today - Disbursed Date) + 1` (inclusive)
- Interest increases daily as loan runs

## Database Schema

### Required Columns in `loan_applications` Table

```sql
-- Input parameters (editable by admin)
processing_fee_percent DECIMAL(5,2) DEFAULT 14.00
interest_percent_per_day DECIMAL(5,4) DEFAULT 0.3000

-- Calculated values (auto-updated)
processing_fee DECIMAL(10,2) DEFAULT 0.00
total_interest DECIMAL(10,2) DEFAULT 0.00
total_repayable DECIMAL(10,2) DEFAULT 0.00

-- Supporting fields
disbursed_at DATETIME NULL
plan_snapshot JSON NULL
```

## Usage Examples

### Example 1: Calculate Applied Loan
```javascript
// Loan with ₹12,000 principal, 14% PF, 0.3% daily interest, 15 days
const loanData = {
  loan_amount: 12000,
  processing_fee_percent: 14,
  interest_percent_per_day: 0.3
};
const days = 15;

const result = calculateLoanValues(loanData, days);
// Result:
// {
//   principal: 12000,
//   processingFee: 1680,
//   gst: 302.40,
//   disbAmount: 10017.60,
//   interest: 527.64,
//   totalAmount: 12527.64
// }
```

### Example 2: Calculate Running Loan (Actual Days)
```javascript
// Same loan, but disbursed 20 days ago
const disbursedDate = '2025-09-29'; // 20 days ago from Oct 19
const actualDays = calculateTotalDays(disbursedDate); // Returns 21 (inclusive)

const result = calculateLoanValues(loanData, actualDays);
// Interest will be higher due to more days elapsed
```

### Example 3: Update Loan Parameters (Admin)
```javascript
// Admin updates processing fee and interest rate
await adminApiService.updateLoanCalculation(loanId, {
  processing_fee_percent: 12.5,
  interest_percent_per_day: 0.25
});
// Backend automatically recalculates all derived values
```

## API Integration

### Frontend (Admin Panel)
```typescript
// Fetch calculation for a loan
const response = await adminApiService.getLoanCalculation(loanId);
console.log(response.data); // { disbAmount, processingFee, interest, ... }

// Update loan parameters
await adminApiService.updateLoanCalculation(loanId, {
  processing_fee_percent: 15,
  interest_percent_per_day: 0.35
});
```

### Backend (API Route)
```javascript
// Get calculation
router.get('/:loanId', async (req, res) => {
  const calculation = await getLoanCalculation(db, loanId, customDays);
  res.json({ success: true, data: calculation });
});

// Update parameters
router.put('/:loanId', async (req, res) => {
  const result = await updateLoanCalculation(db, loanId, updates);
  res.json(result);
});
```

## Benefits

1. **Consistency**: Single source of truth for all calculations
2. **Flexibility**: Supports both fixed-day and actual-day calculations
3. **Maintainability**: Changes to formulas only need to be made in one place
4. **Accuracy**: Eliminates calculation discrepancies between frontend and backend
5. **Scalability**: Easy to add new calculation parameters or formulas

## Future Enhancements

- Add support for variable interest rates based on credit score
- Implement early repayment calculations
- Add penalty/late fee calculations
- Support for multiple disbursement tranches
- Integration with payment gateway for auto-deduction

## Migration

To add the calculation system to existing database:
```bash
cd src/server
node scripts/add_loan_calculation_columns.js
```

This will add all required columns with default values.

## Testing

### Manual Testing Checklist
- [ ] Applied loan shows correct calculations with plan days
- [ ] Running loan shows correct calculations with actual days
- [ ] Admin can edit PF% and Interest%
- [ ] Calculations update in real-time when editing
- [ ] Save button updates database and refreshes display
- [ ] Days counter increases daily for running loans
- [ ] GST is always 18% of processing fee
- [ ] Total amount formula is correct

### Test Cases
1. **New Loan Application**: Verify 15-day default calculation
2. **Disbursed Loan**: Verify actual days calculation
3. **Parameter Update**: Change PF% and verify all values recalculate
4. **Edge Cases**: Test with 0 days, 1 day, 365 days
5. **Precision**: Verify decimal places are consistent

## Support

For questions or issues with the loan calculation system:
1. Check this documentation first
2. Review calculation formulas in `src/server/utils/loanCalculations.js`
3. Test calculations manually using provided examples
4. Check API responses in browser DevTools Network tab

