# Pocket Credit - User Flow Guide

This document outlines the complete user journey from Login to Repayment for both first-time users and returning users.

## 1. First-Time User Journey

### Step 1: Authentication & Registration
1.  **Login/Register:** User enters their Mobile Number (`/login`).
2.  **OTP Verification:** User enters the OTP received.
    *   *System Check:* If the user is new, a new account is created.

### Step 2: Eligibility & Identity Verification
1.  **Employment Type Selection:**
    *   **Fields:** Employment Type (Salaried), Gross Monthly Income, Salary Payment Mode, Date of Birth.
    *   **Check:** Immediate validation ("You must be at least 18 years old").
2.  **Basic Information (Auto-Fetch):**
    *   **System Action:** Fetches details automatically using Mobile Number (via Digitap).
    *   **Displayed Data:** Name, PAN, DOB, Gender, Credit Score (Experian).
    *   **User Action:** User reviews and clicks "Use These Details" (or "Enter Manually").
    *   *Result:* User Profile is verified and marked as complete.

### Step 3: Loan Application
1.  **Dashboard:** User lands on the Dashboard.
2.  **Apply for Loan:** User clicks "Apply Now".
3.  **Loan Selection:** User selects Loan Amount and Tenure.
4.  **Submission:**
    *   Status updates to `submitted`.
    *   User sees a "Under Review" card on the Dashboard.

### Step 4: Admin Approval (Back-office)
1.  **Underwriting:** Admin reviews the application, credit score, and documents.
2.  **Approval:** Admin changes status to `approved` (or `rejected`).

### Step 5: Post-Approval & Pre-Disbursal
1.  **User Action:** User logs in and sees "Loan Approved" status.
2.  **Post-Disbursal Flow:** User clicks "Proceed to Disbursement".
    *   **Step 1: E-NACH Registration:** User sets up auto-debit for repayment.
    *   **Step 2: Selfie Verification:** Live selfie capture for liveness check.
    *   **Step 3: References:** User provides 2 references (Family/Friend).
    *   **Step 4: KFS (Key Fact Statement):** User reviews interest rate, fees, and total repayment.
    *   **Step 5: Agreement Signing:** User digitally signs the loan agreement.
    *   **Step 6: Confirmation:** System confirms "You will get funds shortly".
    *   *System Action:* Loan Status updates to `disbursal` (Ready for Disbursement).

### Step 6: Disbursement (Back-office)
1.  **Admin Action:** Admin sees the loan is "Ready for Disbursement".
2.  **Disburse Funds:** Admin records the transaction (UTRN/Reference No).
3.  **Status Update:** System updates Loan Status to `account_manager`.

### Step 7: Repayment
1.  **User Dashboard:** User logs in.
    *   *Auto-Redirect:* Dashboard automatically redirects to the **Repayment Screen**.
2.  **Repayment Screen:**
    *   Shows: Loan ID, Outstanding Amount, Due Date.
    *   **Repay Now:** User clicks to pay (via Payment Gateway).
    *   **Extend Tenure:** User can extend if eligible (D-5 to D+15 days).
3.  **Closure:** Once fully repaid, the loan status moves to `closed`.

---

## 2. Returning User Journey (Second Loan)

### Step 1: Login
1.  User enters Mobile Number & OTP.
2.  **Profile Check:** System skips Eligibility & Identity Verification (data already exists).

### Step 2: Dashboard & Application
1.  **No Active Loan:** User sees the "Apply for New Loan" card directly.
2.  **Apply:**
    *   User selects Amount/Tenure.
3.  **Submission:** Status updates to `submitted`.

### Step 3: Processing (Faster)
1.  **Admin Approval:** Admin approves the loan.
2.  **Post-Disbursal:**
    *   **E-NACH:** Re-used if valid, or new mandate required.
    *   **Agreement:** New Agreement signed for the specific loan.
    *   **References:** Confirmed or updated.

### Step 4: Disbursement & Repayment
*   Follows the same flow as the first-time user: Admin Disburses -> User Repays via Repayment Screen.

---

## System Status Lifecycle
1.  `submitted` - Application received.
2.  `under_review` - Admin checking details.
3.  `approved` - Approved, waiting for user to complete post-approval steps.
4.  `disbursal` - User completed steps (E-NACH, Agreement), waiting for Admin to send money.
5.  `account_manager` - Money sent, Loan is Active (Repayment phase).
6.  `closed` - Loan fully repaid.
