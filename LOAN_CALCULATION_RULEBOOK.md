# Loan Calculation Rulebook

## Overview

This document defines the complete set of rules, formulas, and logic for loan calculations in the Pocket Credit system. All loan calculations must follow these rules to ensure consistency and accuracy.

## Table of Contents

1. [Core Principles](#core-principles)
2. [Loan Lifecycle and Data Management](#loan-lifecycle-and-data-management)
3. [Basic Loan Calculations](#basic-loan-calculations)
4. [Interest Calculation](#interest-calculation)
5. [Fee Calculations](#fee-calculations)
6. [EMI Calculations](#emi-calculations)
7. [APR Calculation](#apr-calculation)
8. [Date Calculations](#date-calculations)
9. [Multi-EMI Loans](#multi-emi-loans)
10. [Single Payment Loans](#single-payment-loans)
11. [Salary Date Handling](#salary-date-handling)
12. [Rounding Rules](#rounding-rules)
13. [Validation Rules](#validation-rules)
14. [Calculation Examples](#calculation-examples)

---

## Core Principles

### 1. Interest Calculation Base

**CRITICAL RULE:** Interest is ALWAYS calculated on the **PRINCIPAL** amount, NOT on the disbursal amount.

```
Interest = Principal × Interest Rate Per Day × Days
```

**Rationale:** The principal is the sanctioned loan amount. Interest accrues on the full principal, regardless of fees deducted at disbursal.

### 2. Fee Application Methods

Fees can be applied in two ways:

1. **`deduct_from_disbursal`**: Fee is deducted from the principal before disbursement
   - User receives: `Principal - Fee Amount - GST`
   - Example: Processing Fee

2. **`add_to_total`**: Fee is added to the total repayable amount
   - User repays: `Principal + Interest + Fee Amount + GST`
   - Example: Post Service Fee

### 3. GST Application

**GST Rate:** 18% (0.18)

GST is calculated on ALL fees:
```
GST on Fee = Fee Amount × 0.18
```

GST is applied separately to each fee, then summed.

---

## Loan Lifecycle and Data Management

### Loan Status Lifecycle

Loans progress through different statuses, which determine what can be edited and how calculations are performed.

#### Pre-Account Manager States (Editable)

These statuses allow admin to modify loan details:

- **`submitted`** - Loan application submitted by user
- **`under_review`** - Application under review by admin
- **`disbursal`** - Loan ready for disbursal processing
- **`ready_for_disbursement`** - All checks complete, ready to disburse
- **`to_disbursement`** - Scheduled for disbursement

**Rules for Pre-Account Manager States:**

1. **Admin Can Edit:**
   - ✅ Loan plan (can change plan)
   - ✅ Loan amount (can change sanctioned amount)
   - ✅ Repayment date (can change due dates)
   - ✅ Recalculate all values (interest, fees, etc.)
   - ✅ Change dates (disbursement date, EMI dates)

2. **Calculations:**
   - Calculations are performed **on-demand** when requested
   - Values are calculated from current loan data (plan, amount, dates)
   - No processed data is stored yet

3. **Data Storage:**
   - Uses live loan data: `loan_amount`, `plan_snapshot`, `disbursed_at`
   - Calculations reference current plan and user data
   - Changes to plan or amount immediately affect calculations

#### Post-Account Manager States (Frozen)

Once loan reaches account manager, all data is frozen and stored in processed columns:

- **`account_manager`** - Loan assigned to account manager
- **`cleared`** - Loan fully repaid
- **`active`** - Loan is active and being serviced

**CRITICAL RULE:** Once `processed_at` is set, **NOTHING can be edited**.

**Rules for Post-Account Manager States:**

1. **Cannot Edit:**
   - ❌ Loan plan (frozen at processing time)
   - ❌ Loan amount (frozen at processing time)
   - ❌ Repayment dates (frozen at processing time)
   - ❌ Any calculation parameters

2. **Processed Data Storage:**

   When loan is processed (moves to account_manager), all calculation values are stored in dedicated columns:

   ```
   processed_at                    - Timestamp when loan was processed
   processed_amount              - Principal amount at processing time
   processed_p_fee               - Processing fee amount at processing time
   processed_post_service_fee    - Post service fee amount at processing time
   processed_gst                 - Total GST amount at processing time
   processed_due_date            - Single due date (for single payment) OR JSON array of dates (for multi-EMI)
   processed_interest            - Interest amount (updated daily by cron)
   processed_penalty             - Late penalty amount (updated daily by cron)
   last_calculated_at            - Timestamp of last daily calculation
   ```

3. **Processed Due Dates Format:**

   - **Single Payment:** Store as single date string: `"2026-01-15"`
   - **Multi-EMI:** Store as JSON array: `["2026-01-31", "2026-02-28", "2026-03-31"]`

4. **Data Usage:**
   - All calculations use processed data, NOT live loan data
   - Interest and penalty are updated daily by cron job
   - Processed values remain constant (except interest/penalty which accrue)

### Daily Calculation Cron Job

**CRITICAL RULE:** Interest and penalty are calculated **once daily** by a central cron job, not on every request.

#### Cron Job Specifications

- **Schedule:** Run at `00:00:01` IST daily
- **Purpose:** Calculate and update `processed_interest` and `processed_penalty` for all active loans
- **Scope:** Only loans with `processed_at IS NOT NULL` (post-account manager loans)

#### Calculation Logic

```javascript
// For each loan with processed_at set:
// 1. Calculate days since last calculation (or since processed_at if first time)
// 2. Calculate interest for the period
// 3. Calculate penalty if overdue
// 4. Update processed_interest and processed_penalty
// 5. Update last_calculated_at
```

#### Interest Calculation (Daily Cron)

For processed loans, interest is calculated based on:

```
Days Since Last Calculation = Current Date - MAX(processed_at, last_calculated_at)
Interest for Period = processed_amount × Interest Rate Per Day × Days Since Last Calculation
processed_interest = processed_interest + Interest for Period
```

**Rules:**
- If `last_calculated_at` is NULL, calculate from `processed_at` to today
- If `last_calculated_at` exists, calculate from `last_calculated_at` to today
- Interest rate comes from `plan_snapshot` stored at processing time
- Days are counted inclusively (date only, time ignored)

#### Penalty Calculation (Daily Cron)

Penalty is calculated if loan is overdue:

```
Overdue Days = Current Date - processed_due_date (for single payment)
              OR Current Date - Next Unpaid EMI Date (for multi-EMI)

If Overdue Days > 0:
  Penalty = processed_amount × Penalty Rate Per Day × Overdue Days
  processed_penalty = processed_penalty + Penalty for Period
```

**Rules:**
- Penalty only applies to overdue amounts
- For multi-EMI, check each EMI date to determine which are overdue
- Penalty rate comes from `plan_snapshot` (late penalty tiers)
- Penalty is calculated daily and accumulated

#### Cron Job Implementation

```javascript
// Pseudo-code for daily cron job
async function dailyLoanCalculationCron() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Get all processed loans (active loans)
  const processedLoans = await executeQuery(`
    SELECT 
      id,
      processed_at,
      processed_amount,
      processed_due_date,
      processed_interest,
      processed_penalty,
      last_calculated_at,
      plan_snapshot
    FROM loan_applications
    WHERE processed_at IS NOT NULL
      AND status IN ('account_manager', 'active')
  `);
  
  for (const loan of processedLoans) {
    // Determine calculation start date
    const lastCalcDate = loan.last_calculated_at 
      ? new Date(loan.last_calculated_at)
      : new Date(loan.processed_at);
    lastCalcDate.setHours(0, 0, 0, 0);
    
    // Calculate days (inclusive)
    const days = Math.ceil((today - lastCalcDate) / (1000 * 60 * 60 * 24)) + 1;
    
    // Get interest rate from plan snapshot
    const planSnapshot = JSON.parse(loan.plan_snapshot);
    const interestRatePerDay = planSnapshot.interest_percent_per_day;
    
    // Calculate interest
    const interestForPeriod = loan.processed_amount * interestRatePerDay * days;
    const newInterest = (loan.processed_interest || 0) + interestForPeriod;
    
    // Calculate penalty if overdue
    let penaltyForPeriod = 0;
    const todayDate = new Date(today);
    todayDate.setHours(0, 0, 0, 0);
    
    // Parse due dates (single date or JSON array)
    let dueDates = [];
    try {
      dueDates = typeof loan.processed_due_date === 'string' 
        ? JSON.parse(loan.processed_due_date) 
        : loan.processed_due_date;
      // If single date, convert to array
      if (!Array.isArray(dueDates)) {
        dueDates = [dueDates];
      }
    } catch (e) {
      // If not JSON, treat as single date string
      dueDates = [loan.processed_due_date];
    }
    
    // Find overdue EMIs (for multi-EMI) or check single due date
    for (const dueDateStr of dueDates) {
      const dueDate = new Date(dueDateStr);
      dueDate.setHours(0, 0, 0, 0);
      
      if (todayDate > dueDate) {
        // Loan is overdue
        const overdueDays = Math.ceil((todayDate - dueDate) / (1000 * 60 * 60 * 24));
        
        // Get penalty rate from plan snapshot (late penalty tiers)
        const penaltyRate = getPenaltyRate(planSnapshot, overdueDays);
        
        // Calculate penalty for this period (only for days since last calculation)
        // Penalty is calculated on outstanding principal for this EMI
        const outstandingPrincipal = calculateOutstandingPrincipal(loan, dueDateStr);
        penaltyForPeriod += outstandingPrincipal * penaltyRate * days;
      }
    }
    
    const newPenalty = (loan.processed_penalty || 0) + penaltyForPeriod;
    
    // Update database
    await executeQuery(`
      UPDATE loan_applications
      SET 
        processed_interest = ?,
        processed_penalty = ?,
        last_calculated_at = NOW()
      WHERE id = ?
    `, [newInterest, newPenalty, loan.id]);
  }
}
```

### Data Access Rules

#### For Pre-Account Manager Loans

```javascript
// Use live data
const principal = loan.loan_amount;
const planData = loan.plan_snapshot;
const disbursementDate = loan.disbursed_at || new Date();

// Calculate on-demand
const calculations = calculateCompleteLoanValues(loanData, planData, userData);
```

#### For Post-Account Manager Loans

```javascript
// Use processed data
const principal = loan.processed_amount;
const processingFee = loan.processed_p_fee;
const postServiceFee = loan.processed_post_service_fee;
const gst = loan.processed_gst;
const interest = loan.processed_interest; // Updated daily by cron
const penalty = loan.processed_penalty; // Updated daily by cron
const dueDates = JSON.parse(loan.processed_due_date); // Array for multi-EMI

// Total Repayable = processed_amount + processed_interest + processed_penalty + processed_post_service_fee + processed_gst
```

### Status Transition Rules

#### Moving to Account Manager

When loan status changes to `account_manager`:

1. **Freeze All Data:**
   ```javascript
   processed_at = NOW()
   processed_amount = loan_amount
   processed_p_fee = current_processing_fee
   processed_post_service_fee = current_post_service_fee
   processed_gst = current_gst
   processed_due_date = calculated_due_date(s) // Single date or JSON array
   processed_interest = 0 // Will be calculated by cron
   processed_penalty = 0 // Will be calculated by cron
   last_calculated_at = NULL // First calculation will be from processed_at
   ```

2. **Prevent Future Edits:**
   - All edit operations must check `processed_at IS NULL`
   - If `processed_at` exists, return error: "Cannot edit processed loan"

3. **Start Daily Calculations:**
   - Cron job will begin calculating interest and penalty daily

### Best Practices

1. **Always Check processed_at:**
   ```javascript
   if (loan.processed_at) {
     // Use processed data
   } else {
     // Use live data and calculate on-demand
   }
   ```

2. **Use Processed Data for Display:**
   - For processed loans, always display `processed_*` values
   - Never recalculate from live data for processed loans

3. **Cron Job Reliability:**
   - Ensure cron job runs daily without fail
   - Log all calculations for audit
   - Handle errors gracefully (don't skip loans)

4. **Data Consistency:**
   - Once `processed_at` is set, it should never be unset
   - Processed values should never be manually edited
   - Only cron job updates `processed_interest` and `processed_penalty`

---

## Basic Loan Calculations

**CRITICAL RULE:** Day calculations are based on **DATE only**, not time. The time portion of timestamps is ignored when calculating days.

**Rationale:** 
- EC2 server and MySQL are set to IST (Indian Standard Time), so no timezone conversion is needed
- Days are calculated by comparing dates only, regardless of the time component
- Example: If loan is disbursed on `2025-12-27 20:12:00` and current time is `2025-12-28 04:36:00`, it counts as **2 days** (27th is day 1, 28th is day 2)

**Implementation:**
- Extract date portion only: `date.setHours(0, 0, 0, 0)` to normalize to start of day
- Calculate days by comparing date values, ignoring time

---

## Basic Loan Calculations

### Principal Amount

The principal is the sanctioned loan amount, as specified in the loan application.

```
Principal = loan_amount (from loan application)
```

### Processing Fee

Processing fee is deducted from the principal at disbursal.

```
Processing Fee = Principal × (Processing Fee % / 100)
```

**Example:**
- Principal: ₹20,000
- Processing Fee: 5%
- Processing Fee Amount: ₹20,000 × 0.05 = ₹1,000

### Disbursal Amount

The amount the customer actually receives after deducting fees.

```
Disbursal Amount = Principal - (All Deduct Fees + GST on Deduct Fees)
```

**Example:**
- Principal: ₹20,000
- Processing Fee: ₹1,000
- GST on Processing Fee: ₹1,000 × 0.18 = ₹180
- Disbursal Amount: ₹20,000 - ₹1,000 - ₹180 = ₹18,820

### Total Repayable Amount

The total amount the customer must repay.

```
Total Repayable = Principal + Interest + (All Add Fees + GST on Add Fees)
```

**Note:** Processing fee is NOT included in total repayable because it's already deducted from disbursal.

**Example:**
- Principal: ₹20,000
- Interest: ₹530
- Post Service Fee: ₹1,400
- GST on Post Service Fee: ₹1,400 × 0.18 = ₹252
- Total Repayable: ₹20,000 + ₹530 + ₹1,400 + ₹252 = ₹22,082

---

## Interest Calculation

### Single Payment Loans

For single payment loans, interest is calculated using:

```
Interest = Principal × Interest Rate Per Day × Days
```

**Where:**
- `Interest Rate Per Day` is in decimal format (e.g., 0.001 = 0.1% per day)
- `Days` is the number of days from disbursement to repayment date (inclusive)

**Example:**
- Principal: ₹20,000
- Interest Rate: 0.001 per day (0.1% per day)
- Days: 15
- Interest: ₹20,000 × 0.001 × 15 = ₹300

### Multi-EMI Loans

For multi-EMI loans, interest is calculated **per period** on the **outstanding principal** for that period.

```
Interest for Period i = Outstanding Principal at Start of Period × Interest Rate Per Day × Days in Period
Total Interest = Sum of Interest for All Periods
```

**Key Rules:**
1. Interest is calculated on outstanding principal at the START of each period
2. After each EMI payment, outstanding principal is reduced by the principal portion of that EMI
3. Each period's interest is calculated separately and summed

**Example (2 EMIs):**
- Principal: ₹20,000
- Interest Rate: 0.001 per day
- EMI 1: Due in 15 days, Principal portion: ₹10,000
- EMI 2: Due in 45 days (30 days after EMI 1), Principal portion: ₹10,000

**Calculation:**
- Period 1 (Days 1-15): Interest = ₹20,000 × 0.001 × 15 = ₹300
- Outstanding after EMI 1: ₹20,000 - ₹10,000 = ₹10,000
- Period 2 (Days 16-45): Interest = ₹10,000 × 0.001 × 30 = ₹300
- **Total Interest: ₹300 + ₹300 = ₹600**

### Interest Calculation Days

#### Inclusive Counting

**CRITICAL RULE:** Days are counted **inclusively**, meaning both the start date and end date are included. **Time is ignored** - only the date portion matters.

```
// Normalize dates to start of day (ignore time)
startDate.setHours(0, 0, 0, 0);
endDate.setHours(0, 0, 0, 0);
Days = Math.ceil((End Date - Start Date) / (1000 * 60 * 60 * 24)) + 1
```

**Example:**
- Disbursement: `2025-12-27 20:12:00` → Normalized to `2025-12-27 00:00:00`
- Current: `2025-12-28 04:36:00` → Normalized to `2025-12-28 00:00:00`
- Days: 2 (Dec 27 is day 1, Dec 28 is day 2) - **Time is ignored**

**Another Example:**
- Start Date: January 1, 2026 (any time)
- End Date: January 15, 2026 (any time)
- Days: 15 (Jan 1, 2, 3, ..., 15)

#### Period Boundaries for Multi-EMI

For multi-EMI loans, period boundaries are defined as:

1. **First Period:** From disbursement date to first EMI date (inclusive)
2. **Subsequent Periods:** From the day AFTER previous EMI date to current EMI date (inclusive)

**Example:**
- Disbursement: January 1, 2026
- EMI 1: January 31, 2026
- EMI 2: February 28, 2026

**Period 1:**
- Start: January 1, 2026
- End: January 31, 2026
- Days: 31 (inclusive)

**Period 2:**
- Start: February 1, 2026 (day AFTER January 31)
- End: February 28, 2026
- Days: 28 (inclusive)

---

## Fee Calculations

### Fee Structure

Each fee has:
- `fee_name`: Name of the fee
- `fee_percent`: Percentage of principal
- `application_method`: `deduct_from_disbursal` or `add_to_total`

### Fee Amount Calculation

```
Fee Amount = Principal × (Fee Percent / 100)
GST on Fee = Fee Amount × 0.18
Total Fee with GST = Fee Amount + GST on Fee
```

### Fee Categorization

Fees are categorized based on `application_method`:

1. **Deduct from Disbursal Fees:**
   - Processing Fee
   - Any fee with `application_method = 'deduct_from_disbursal'`
   - These reduce the disbursal amount

2. **Add to Total Fees:**
   - Post Service Fee
   - Any fee with `application_method = 'add_to_total'`
   - These increase the total repayable amount

### Fee Totals

```
Total Disbursal Fee = Sum of all deduct_from_disbursal fee amounts
Total Disbursal Fee GST = Sum of all GST on deduct_from_disbursal fees
Total Disbursal Deduction = Total Disbursal Fee + Total Disbursal Fee GST

Total Repayable Fee = Sum of all add_to_total fee amounts
Total Repayable Fee GST = Sum of all GST on add_to_total fees
Total Repayable Addition = Total Repayable Fee + Total Repayable Fee GST
```

### Multi-EMI Fee Handling

**CRITICAL RULE:** For multi-EMI loans, fees with `add_to_total` are multiplied by the number of EMIs.

```
Repayable Fee for Multi-EMI = Fee Amount × EMI Count
GST for Multi-EMI = (Fee Amount × EMI Count) × 0.18
```

**Rationale:** Post Service Fee is charged per EMI, so for 2 EMIs, the fee is charged twice.

**Example:**
- Principal: ₹20,000
- Post Service Fee: 7% (₹1,400)
- EMI Count: 2
- Total Post Service Fee: ₹1,400 × 2 = ₹2,800
- GST: ₹2,800 × 0.18 = ₹504

---

## EMI Calculations

### Principal Distribution

For multi-EMI loans, principal is divided equally across all EMIs, with any remainder added to the last EMI.

```
Principal Per EMI = Floor(Principal / EMI Count × 100) / 100
Remainder = Principal - (Principal Per EMI × EMI Count)
Last EMI Principal = Principal Per EMI + Remainder
```

**Example (3 EMIs, Principal ₹10,000):**
- Principal Per EMI: Floor(₹10,000 / 3 × 100) / 100 = Floor(333.33) = ₹3,333.33
- Remainder: ₹10,000 - (₹3,333.33 × 3) = ₹10,000 - ₹9,999.99 = ₹0.01
- EMI 1 Principal: ₹3,333.33
- EMI 2 Principal: ₹3,333.33
- EMI 3 Principal: ₹3,333.33 + ₹0.01 = ₹3,333.34

### EMI Amount Calculation

For each EMI period:

```
EMI Amount = Principal Portion + Interest for Period + (Repayable Fee / EMI Count) + (GST on Repayable Fee / EMI Count)
```

**Example:**
- Principal Portion: ₹10,000
- Interest for Period: ₹300
- Post Service Fee (per EMI): ₹1,400
- GST on Post Service Fee (per EMI): ₹252
- EMI Amount: ₹10,000 + ₹300 + ₹1,400 + ₹252 = ₹11,952

### Outstanding Principal Tracking

After each EMI payment, outstanding principal is reduced:

```
Outstanding Principal After EMI i = Outstanding Principal Before EMI i - Principal Portion of EMI i
```

**Example:**
- Initial Principal: ₹20,000
- After EMI 1 (Principal: ₹10,000): ₹20,000 - ₹10,000 = ₹10,000
- After EMI 2 (Principal: ₹10,000): ₹10,000 - ₹10,000 = ₹0

---

## APR Calculation

### Formula

```
APR = ((Total Charges / Principal) / Loan Term Days) × 36500
```

**Where:**
- `Total Charges = Processing Fee + GST + Repayable Fees + Total Interest`
- `Loan Term Days = Days from disbursement to last repayment date (inclusive)`

### Loan Term Days

#### Single Payment Loans

```
Loan Term Days = Interest Calculation Days
```

#### Multi-EMI Loans

```
Loan Term Days = Days from Disbursement Date to Last EMI Date (inclusive)
```

**Example:**
- Disbursement: January 1, 2026
- Last EMI: March 31, 2026
- Loan Term Days: 90 (Jan 1 to Mar 31, inclusive)

### Total Charges Breakdown

```
Total Charges = 
  Processing Fee +
  GST on Processing Fee +
  (Repayable Fee × EMI Count) +
  (GST on Repayable Fee × EMI Count) +
  Total Interest
```

**Note:** For multi-EMI loans, use `interestForAPR` (sum of all period interests), not the first period interest.

### APR Example

**Single Payment Loan:**
- Principal: ₹20,000
- Processing Fee: ₹1,000
- GST: ₹180
- Interest: ₹300
- Days: 15
- Total Charges: ₹1,000 + ₹180 + ₹300 = ₹1,480
- APR: ((₹1,480 / ₹20,000) / 15) × 36500 = 18.03%

**Multi-EMI Loan (2 EMIs):**
- Principal: ₹20,000
- Processing Fee: ₹1,000
- GST: ₹180
- Post Service Fee: ₹1,400 × 2 = ₹2,800
- GST on Post Service Fee: ₹252 × 2 = ₹504
- Total Interest: ₹600 (sum of both periods)
- Loan Term Days: 45
- Total Charges: ₹1,000 + ₹180 + ₹2,800 + ₹504 + ₹600 = ₹5,084
- APR: ((₹5,084 / ₹20,000) / 45) × 36500 = 20.62%

---

## Date Calculations

### Salary Date Functions

#### getNextSalaryDate(startDate, targetDay)

Returns the next valid salary date on or after the start date.

**Rules:**
1. If salary date has passed or is today, move to next month
2. Handle edge cases where day doesn't exist in month (e.g., Feb 31 → Feb 28/29)
3. Normalize dates to start of day (00:00:00) for consistent date comparison

**Example:**
- Start Date: January 15, 2026
- Target Day: 31
- Result: January 31, 2026 (if not passed) or February 28, 2026 (if passed)

#### getSalaryDateForMonth(startDate, targetDay, monthOffset)

Returns the salary date for a specific month offset from the start date.

**Rules:**
1. `monthOffset = 0`: Current month
2. `monthOffset = 1`: Next month
3. Handle year rollover (month > 11 or month < 0)
4. Handle edge cases where day doesn't exist in month

**Example:**
- Start Date: January 15, 2026
- Target Day: 31
- Month Offset: 1
- Result: February 28, 2026 (Feb doesn't have 31 days)

### Interest Calculation Days

#### calculateInterestDays(planData, userData, calculationDate)

Determines the number of days for interest calculation based on plan type and salary date settings.

**Rules:**

1. **Fixed Days (Default):**
   ```
   Days = planData.repayment_days || planData.total_duration_days || 15
   ```

2. **Single Payment with Salary Date:**
   - Calculate days to next salary date
   - If days < minimum duration, extend to following month(s) until duration is met
   - Days are counted inclusively

3. **Multi-EMI with Salary Date:**
   - Calculate days to next salary date (first EMI date)
   - If days < minimum duration, move to next month's salary date
   - Ensure the date matches the salary date exactly

**Example (Single Payment):**
- Today: December 14, 2025
- Salary Date: 4
- Minimum Duration: 15 days
- Next Salary Date: January 4, 2026
- Days to Next Salary: 22 days (Dec 14 to Jan 4, inclusive)
- Result: 22 days (meets minimum)

**Example (Multi-EMI):**
- Today: December 14, 2025
- Salary Date: 31
- Minimum Duration: 15 days
- Next Salary Date: December 31, 2025
- Days to Next Salary: 18 days (meets minimum)
- Result: 18 days, First EMI Date: December 31, 2025

---

## Multi-EMI Loans

### EMI Date Generation

#### Salary-Based Monthly EMIs

For monthly EMIs with salary date calculation:

1. Calculate first EMI date from disbursement date:
   ```
   First EMI Date = getNextSalaryDate(disbursementDate, salaryDate)
   ```

2. If days to first EMI < minimum duration, move to next month:
   ```
   First EMI Date = getSalaryDateForMonth(disbursementDate, salaryDate, 1)
   ```

3. Generate subsequent EMI dates:
   ```
   EMI Date i = getSalaryDateForMonth(firstEMIDate, salaryDate, i)
   ```

4. Ensure all dates match the salary date exactly (handle month-end edge cases)

**Example:**
- Disbursement: January 1, 2026
- Salary Date: 31
- EMI Count: 3
- First EMI: January 31, 2026
- Second EMI: February 28, 2026 (Feb doesn't have 31 days)
- Third EMI: March 31, 2026

#### Non-Salary-Based EMIs

For EMIs without salary date calculation:

1. Calculate first EMI date:
   ```
   First EMI Date = Disbursement Date + repayment_days
   ```

2. Generate subsequent EMI dates based on frequency:
   - **Monthly:** Add 1 month for each EMI
   - **Weekly:** Add 7 days for each EMI
   - **Biweekly:** Add 14 days for each EMI
   - **Daily:** Add 1 day for each EMI

### Total Interest Calculation for Multi-EMI

**CRITICAL RULE:** Total interest for multi-EMI loans is the SUM of interest for each period, NOT the first period multiplied by EMI count.

**Algorithm:**

```javascript
let outstandingPrincipal = principal;
let totalInterest = 0;

for (let i = 0; i < emiCount; i++) {
  // Calculate days for this period
  let previousDate = (i === 0) ? disbursementDate : (emiDates[i-1] + 1 day);
  let daysForPeriod = (emiDates[i] - previousDate) + 1; // inclusive
  
  // Calculate principal for this EMI
  let principalForThisEmi = (i === emiCount - 1) 
    ? principalPerEmi + remainder 
    : principalPerEmi;
  
  // Calculate interest for this period
  let interestForPeriod = outstandingPrincipal × interestRatePerDay × daysForPeriod;
  totalInterest += interestForPeriod;
  
  // Reduce outstanding principal
  outstandingPrincipal -= principalForThisEmi;
}
```

**Example (2 EMIs):**
- Principal: ₹20,000
- Interest Rate: 0.001 per day
- EMI 1: 15 days, Principal: ₹10,000
- EMI 2: 30 days after EMI 1, Principal: ₹10,000

**Calculation:**
- Period 1: ₹20,000 × 0.001 × 15 = ₹300
- Outstanding after EMI 1: ₹20,000 - ₹10,000 = ₹10,000
- Period 2: ₹10,000 × 0.001 × 30 = ₹300
- **Total Interest: ₹300 + ₹300 = ₹600**

**NOT:** ₹300 × 2 = ₹600 (this only works by coincidence if periods are equal)

---

## Single Payment Loans

### Interest Calculation

For single payment loans, interest is straightforward:

```
Interest = Principal × Interest Rate Per Day × Days
```

### Repayment Date

The repayment date is determined by:

1. **Fixed Days:** Disbursement Date + repayment_days
2. **Salary Date:** Next salary date (or extended if minimum duration not met)

### Total Repayable

```
Total Repayable = Principal + Interest + (Repayable Fees + GST)
```

**Note:** Processing fee is NOT included (already deducted from disbursal).

---

## Salary Date Handling

### Salary Date Format

Salary date is stored as a day of month (1-31) in the user's profile.

### Salary Date Validation

- Valid range: 1-31
- If day doesn't exist in month (e.g., Feb 31), use last day of month
- If salary date is null or invalid, fall back to fixed days calculation

### Month-End Edge Cases

**CRITICAL RULE:** When a salary date doesn't exist in a month, use the last day of that month.

**Examples:**
- Salary Date: 31
- February: Use February 28 (or 29 in leap year)
- April: Use April 30
- January: Use January 31

**Implementation:**
```javascript
let salaryDate = new Date(year, month, targetDay);
if (salaryDate.getDate() !== targetDay) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  salaryDate = new Date(year, month, Math.min(targetDay, lastDay));
}
```

### Date Normalization

**CRITICAL RULE:** All date calculations normalize timestamps to start of day (00:00:00) to ignore time component.

**Rationale:**
- Server and MySQL are set to IST, so no timezone conversion is needed
- Day calculations are based on date only, not time
- Example: `2025-12-27 20:12:00` and `2025-12-28 04:36:00` = 2 days (27th and 28th)

**Implementation:**
```javascript
// Normalize date to start of day for comparison
date.setHours(0, 0, 0, 0);
```

### Date Formatting

When formatting dates for display or logs, extract the date portion:

```javascript
function formatDateLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
```

**Note:** Since server is in IST, `.toISOString().split('T')[0]` can be used, but `formatDateLocal()` is preferred for clarity.

---

## Rounding Rules

### General Rounding

All monetary amounts are rounded to 2 decimal places:

```javascript
amount = Math.round(amount * 100) / 100
```

### Principal Distribution

When dividing principal across EMIs:

```javascript
principalPerEmi = Math.floor(principal / emiCount * 100) / 100;
remainder = Math.round((principal - (principalPerEmi * emiCount)) * 100) / 100;
```

**Example:**
- Principal: ₹10,000
- EMI Count: 3
- Principal Per EMI: Math.floor(₹10,000 / 3 × 100) / 100 = Math.floor(333.33) = ₹3,333.33
- Remainder: Math.round((₹10,000 - ₹9,999.99) × 100) / 100 = ₹0.01

### Interest Calculation

Interest is rounded to 2 decimal places after calculation:

```javascript
interest = Math.round(principal * rate * days * 100) / 100;
```

### Fee Calculations

Fees and GST are rounded to 2 decimal places:

```javascript
feeAmount = Math.round((principal * feePercent / 100) * 100) / 100;
gstAmount = Math.round(feeAmount * 0.18 * 100) / 100;
```

### APR Calculation

APR is rounded to 2 decimal places:

```javascript
apr = Math.round(((totalCharges / principal) / loanTermDays) * 36500 * 100) / 100;
```

---

## Validation Rules

### Input Validation

1. **Principal Amount:**
   - Must be > 0
   - Must be a valid number

2. **Interest Rate:**
   - Must be >= 0
   - Must be in decimal format (e.g., 0.001 for 0.1% per day)

3. **Days:**
   - Must be >= 0
   - Must be an integer

4. **Fee Percentage:**
   - Must be >= 0 and <= 100
   - Must be a valid number

5. **EMI Count:**
   - Must be >= 1
   - Must be an integer

6. **Salary Date:**
   - Must be between 1 and 31 (if provided)
   - Can be null (falls back to fixed days)

### Calculation Validation

1. **Disbursal Amount:**
   - Must be > 0
   - Must be <= Principal

2. **Total Repayable:**
   - Must be > Principal
   - Must be >= Disbursal Amount

3. **Interest:**
   - Must be >= 0
   - For multi-EMI, must equal sum of all period interests

4. **APR:**
   - Must be >= 0
   - Should be reasonable (typically 10-50% for short-term loans)

---

## Calculation Examples

### Example 1: Single Payment Loan

**Input:**
- Principal: ₹20,000
- Processing Fee: 5%
- Interest Rate: 0.001 per day (0.1% per day)
- Days: 15
- Post Service Fee: 7%

**Calculation:**

1. **Processing Fee:**
   - Fee Amount: ₹20,000 × 0.05 = ₹1,000
   - GST: ₹1,000 × 0.18 = ₹180
   - Total: ₹1,180

2. **Disbursal Amount:**
   - ₹20,000 - ₹1,180 = ₹18,820

3. **Interest:**
   - ₹20,000 × 0.001 × 15 = ₹300

4. **Post Service Fee:**
   - Fee Amount: ₹20,000 × 0.07 = ₹1,400
   - GST: ₹1,400 × 0.18 = ₹252
   - Total: ₹1,652

5. **Total Repayable:**
   - ₹20,000 + ₹300 + ₹1,652 = ₹21,952

6. **APR:**
   - Total Charges: ₹1,000 + ₹180 + ₹1,400 + ₹252 + ₹300 = ₹3,132
   - APR: ((₹3,132 / ₹20,000) / 15) × 36500 = 38.11%

---

### Example 2: Multi-EMI Loan (2 EMIs)

**Input:**
- Principal: ₹20,000
- Processing Fee: 5%
- Interest Rate: 0.001 per day (0.1% per day)
- EMI Count: 2
- EMI Frequency: Monthly
- Salary Date: 31
- Disbursement: January 1, 2026
- Post Service Fee: 7%

**Calculation:**

1. **Processing Fee:**
   - Fee Amount: ₹20,000 × 0.05 = ₹1,000
   - GST: ₹1,000 × 0.18 = ₹180
   - Total: ₹1,180

2. **Disbursal Amount:**
   - ₹20,000 - ₹1,180 = ₹18,820

3. **EMI Dates:**
   - EMI 1: January 31, 2026 (30 days from disbursement)
   - EMI 2: February 28, 2026 (58 days from disbursement)

4. **Principal Distribution:**
   - Principal Per EMI: ₹20,000 / 2 = ₹10,000
   - EMI 1 Principal: ₹10,000
   - EMI 2 Principal: ₹10,000

5. **Interest Calculation:**
   - Period 1 (Jan 1-31, 31 days): ₹20,000 × 0.001 × 31 = ₹620
   - Outstanding after EMI 1: ₹20,000 - ₹10,000 = ₹10,000
   - Period 2 (Feb 1-28, 28 days): ₹10,000 × 0.001 × 28 = ₹280
   - **Total Interest: ₹620 + ₹280 = ₹900**

6. **Post Service Fee:**
   - Fee Per EMI: ₹20,000 × 0.07 = ₹1,400
   - GST Per EMI: ₹1,400 × 0.18 = ₹252
   - Total Fee: ₹1,400 × 2 = ₹2,800
   - Total GST: ₹252 × 2 = ₹504

7. **EMI Amounts:**
   - EMI 1: ₹10,000 + ₹620 + ₹1,400 + ₹252 = ₹12,272
   - EMI 2: ₹10,000 + ₹280 + ₹1,400 + ₹252 = ₹11,932

8. **Total Repayable:**
   - ₹12,272 + ₹11,932 = ₹24,204

9. **Loan Term Days:**
   - January 1 to February 28 = 59 days (inclusive)

10. **APR:**
    - Total Charges: ₹1,000 + ₹180 + ₹2,800 + ₹504 + ₹900 = ₹5,384
    - APR: ((₹5,384 / ₹20,000) / 59) × 36500 = 16.66%

---

### Example 3: Multi-EMI Loan (3 EMIs, Uneven Principal)

**Input:**
- Principal: ₹10,000
- EMI Count: 3
- Interest Rate: 0.001 per day
- EMI Dates: Day 15, Day 45, Day 75

**Calculation:**

1. **Principal Distribution:**
   - Principal Per EMI: Math.floor(₹10,000 / 3 × 100) / 100 = ₹3,333.33
   - Remainder: ₹10,000 - (₹3,333.33 × 3) = ₹0.01
   - EMI 1 Principal: ₹3,333.33
   - EMI 2 Principal: ₹3,333.33
   - EMI 3 Principal: ₹3,333.33 + ₹0.01 = ₹3,333.34

2. **Interest Calculation:**
   - Period 1 (Days 1-15): ₹10,000 × 0.001 × 15 = ₹150
   - Outstanding after EMI 1: ₹10,000 - ₹3,333.33 = ₹6,666.67
   - Period 2 (Days 16-45): ₹6,666.67 × 0.001 × 30 = ₹200
   - Outstanding after EMI 2: ₹6,666.67 - ₹3,333.33 = ₹3,333.34
   - Period 3 (Days 46-75): ₹3,333.34 × 0.001 × 30 = ₹100
   - **Total Interest: ₹150 + ₹200 + ₹100 = ₹450**

---

## Implementation Checklist

When implementing loan calculations, ensure:

- [ ] Interest is calculated on PRINCIPAL, not disbursal amount
- [ ] Dates are normalized to start of day (00:00:00) to ignore time component
- [ ] Days are counted inclusively based on date only, not time
- [ ] Multi-EMI interest is sum of all periods, not first period × count
- [ ] Fees are properly categorized (deduct vs add)
- [ ] GST (18%) is applied to all fees
- [ ] Multi-EMI repayable fees are multiplied by EMI count
- [ ] Principal distribution handles remainders correctly
- [ ] Month-end edge cases are handled for salary dates
- [ ] All amounts are rounded to 2 decimal places
- [ ] APR uses total charges and loan term days (not interest days for multi-EMI)
- [ ] Period boundaries for multi-EMI start from day AFTER previous EMI
- [ ] Check `processed_at` before allowing edits (pre vs post account manager)
- [ ] Use processed data for processed loans, live data for pre-processed loans
- [ ] Daily cron job calculates interest and penalty for all processed loans
- [ ] Processed due dates stored as single date (single payment) or JSON array (multi-EMI)

---

## Common Pitfalls

### ❌ Wrong: Interest on Disbursal

```javascript
// WRONG
interest = disbursalAmount * rate * days;
```

```javascript
// CORRECT
interest = principal * rate * days;
```

### ❌ Wrong: Multi-EMI Interest

```javascript
// WRONG - Only calculates first period
interest = principal * rate * daysForFirstPeriod;
totalInterest = interest * emiCount;
```

```javascript
// CORRECT - Sum of all periods
let totalInterest = 0;
for (let i = 0; i < emiCount; i++) {
  let interestForPeriod = outstandingPrincipal * rate * daysForPeriod;
  totalInterest += interestForPeriod;
  outstandingPrincipal -= principalForThisEmi;
}
```

### ❌ Wrong: Date Calculation with Time

```javascript
// WRONG - Calculating days with time component
let days = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));
// This may give incorrect results if times are different
```

```javascript
// CORRECT - Normalize to start of day, then calculate
startDate.setHours(0, 0, 0, 0);
endDate.setHours(0, 0, 0, 0);
let days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1; // inclusive
```

### ❌ Wrong: Period Boundaries

```javascript
// WRONG - Overlaps periods
let previousDate = emiDates[i - 1];
let daysForPeriod = (emiDates[i] - previousDate) / (1000 * 60 * 60 * 24);
```

```javascript
// CORRECT - Start from day after previous EMI
let previousDate = new Date(emiDates[i - 1]);
previousDate.setDate(previousDate.getDate() + 1);
let daysForPeriod = Math.ceil((emiDates[i] - previousDate) / (1000 * 60 * 60 * 24)) + 1;
```

### ❌ Wrong: Using Live Data for Processed Loans

```javascript
// WRONG - Recalculating from live data for processed loan
if (loan.status === 'account_manager') {
  const calculations = calculateCompleteLoanValues(
    { loan_amount: loan.loan_amount }, // Using live data
    loan.plan_snapshot,
    userData
  );
}
```

```javascript
// CORRECT - Use processed data for processed loans
if (loan.processed_at) {
  // Use frozen processed values
  const principal = loan.processed_amount;
  const interest = loan.processed_interest; // Updated by cron
  const penalty = loan.processed_penalty; // Updated by cron
  const totalRepayable = principal + interest + penalty + loan.processed_post_service_fee + loan.processed_gst;
} else {
  // Calculate on-demand from live data
  const calculations = calculateCompleteLoanValues(loanData, planData, userData);
}
```

### ❌ Wrong: Allowing Edits After Processing

```javascript
// WRONG - Not checking processed_at
router.put('/loan-amount/:id', async (req, res) => {
  await executeQuery('UPDATE loan_applications SET loan_amount = ? WHERE id = ?', [amount, id]);
});
```

```javascript
// CORRECT - Check processed_at before allowing edits
router.put('/loan-amount/:id', async (req, res) => {
  const loan = await executeQuery('SELECT processed_at FROM loan_applications WHERE id = ?', [id]);
  
  if (loan[0].processed_at) {
    return res.status(400).json({
      status: 'error',
      message: 'Cannot edit loan amount after loan has been processed'
    });
  }
  
  await executeQuery('UPDATE loan_applications SET loan_amount = ? WHERE id = ?', [amount, id]);
});
```

---

## Version History

- **v1.2** (2026-01-XX): Added loan lifecycle and processed data management
  - Added pre-account manager vs post-account manager rules
  - Documented processed data storage columns
  - Added daily cron job calculation rules
  - Defined what can/cannot be edited in each phase
  - Added processed due dates format (single date vs JSON array)

- **v1.1** (2026-01-XX): Updated date handling rules
  - Clarified that server/MySQL use IST, no timezone conversion needed
  - Updated to use date-only calculations (time ignored)
  - Changed from midday normalization to start-of-day normalization
  - Added concrete example: `2025-12-27 20:12:00` to `2025-12-28 04:36:00` = 2 days

- **v1.0** (2026-01-XX): Initial rulebook creation
  - Documented all core calculation rules
  - Added examples and validation rules
  - Included rounding guidelines

---

## References

- `src/server/utils/loanCalculations.js` - Core calculation functions
- `src/server/routes/kfs.js` - KFS generation with calculations
- `src/components/shared/SharedKFSDocument.tsx` - Frontend calculation display

