# Monthly Salary to Income Range Migration Fix

## Problem

After migrating from `monthly_salary` (numeric) to `income_range` (text ranges like '1k-15k', '15k-25k', etc.), many backend routes were still referencing the old `monthly_salary` column, causing SQL errors like:

```
Unknown column 'ed.monthly_salary' in 'field list'
```

## Solution

### Helper Function Created

Added a conversion function in multiple files to convert income ranges to approximate monthly income values:

```javascript
const getMonthlyIncomeFromRange = (range) => {
  if (!range) return 0;
  const rangeMap = {
    '1k-15k': 7500,    // Midpoint: ~7.5K
    '15k-25k': 20000,  // Midpoint: ~20K
    '25k-35k': 30000,  // Midpoint: ~30K
    'above-35k': 40000 // Conservative estimate: 40K
  };
  return rangeMap[range] || 0;
};
```

## Files Fixed

### 1. ✅ `src/server/routes/kfs.js`
- **Changes:**
  - Added JOIN to get `income_range` from users table
  - Added `getMonthlyIncomeFromRange()` helper function
  - Updated employment.monthly_income calculation to use converted value

### 2. ✅ `src/server/routes/userProfile.js`
- **Changes:**
  - Added JOIN to get `income_range` from users table
  - Added `getMonthlyIncomeFromRange()` helper function
  - Updated `monthlyIncomeValue` calculation
  - Updated `personalInfo.monthlyIncome` to use converted value

### 3. ✅ `src/server/routes/adminApplications.js`
- **Changes:**
  - Removed `ed.monthly_salary` from SELECT query, added `u.income_range`
  - Added `getMonthlyIncomeFromRange()` helper function at top of file
  - Updated `monthlyIncome` field to use `getMonthlyIncomeFromRange(app.income_range)`
  - Fixed both list view and detail view queries
  - Updated `employment.monthlySalary` in detailed response

### 4. ✅ `src/server/routes/eligibilityConfig.js`
- **Changes:**
  - Changed query parameter from `monthly_salary` to `income_range`
  - Added `getMonthlyIncomeFromRange()` helper function
  - Converted income_range to monthly income for eligibility comparison
  - **Note:** Config keys `min_monthly_salary` remain unchanged (they're settings, not user data)

### 5. ✅ `src/server/routes/employment.js`
- **Changes:**
  - Removed `monthly_salary` column from UPDATE query
  - Removed `monthly_salary` column from INSERT query
  - Removed `monthly_salary` from response data
  - **Note:** Employment details no longer stores salary (now in users.income_range)

### 6. ✅ `src/server/routes/users.js`
- **Changes:**
  - Removed `monthly_salary` from request body destructuring
  - Removed `monthly_salary` from UPDATE conditional logic
  - Removed `monthly_salary` from INSERT query and values
  - Removed `monthly_salary` from response data

### 7. ✅ `src/server/routes/loans.js` (Previously Fixed)
- **Changes:**
  - Removed `ed.monthly_salary` from SELECT query

## Income Range Mapping

| Range | Display | Approximate Monthly Income |
|-------|---------|---------------------------|
| `1k-15k` | ₹1,000 - ₹15,000 | **₹7,500** (midpoint) |
| `15k-25k` | ₹15,000 - ₹25,000 | **₹20,000** (midpoint) |
| `25k-35k` | ₹25,000 - ₹35,000 | **₹30,000** (midpoint) |
| `above-35k` | Above ₹35,000 | **₹40,000** (conservative) |

## What Was Not Changed

### Configuration Settings (OK to keep)
- `eligibility_config.min_monthly_salary` - This is a configuration key, not user data
- Any eligibility criteria that reference salary thresholds

### Tables Not Modified
- `employment_details` table structure - Column may or may not exist depending on schema
- `user_employment` table structure - Same as above
- These tables now store company/role info, not salary (salary/income is in `users.income_range`)

## Testing

After these fixes:
1. ✅ Loan applications submit successfully
2. ✅ KFS documents generate correctly
3. ✅ User profiles load without errors
4. ✅ Admin application lists and details work
5. ✅ Employment details can be saved
6. ✅ Eligibility checks work with income ranges

## Future Considerations

### If More Precision Needed
Currently using range midpoints and conservative estimates. If exact values are needed:
1. Consider adding a numeric `monthly_income_estimate` field to users table
2. Capture it alongside `income_range` for calculations
3. Keep `income_range` for display/filtering

### Database Cleanup (Optional)
If you want to fully remove old columns:
```sql
-- Only run if you're sure monthly_salary is no longer needed
ALTER TABLE employment_details DROP COLUMN IF EXISTS monthly_salary;
ALTER TABLE user_employment DROP COLUMN IF EXISTS monthly_salary;
```

## Status

✅ **COMPLETE** - All `monthly_salary` user data references have been replaced with `income_range` conversions.

---

**Date Fixed:** January 2025  
**Files Modified:** 7 route files  
**Lines Changed:** ~50+ references fixed

