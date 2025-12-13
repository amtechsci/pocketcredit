# API Audit & Gap Analysis

## 1. Current APIs (Implemented)

### Authentication (`/auth`)
*   `POST /auth/send-otp` - Send OTP for login.
*   `POST /auth/verify-otp` - Verify OTP and login.
*   `GET /auth/profile` - Get user profile.
*   `POST /auth/logout` - Logout.

### User Profile (`/user`)
*   `PUT /user/profile/basic` - Update basic details.
*   `PUT /user/profile/additional` - Update address/PAN.
*   `PUT /user/profile/student` - Update student specific details.
*   `PUT /user/graduation-status` - Update graduation status.
*   `GET /user/profile/status` - Get overall profile completion status.

### Employment & Bank (`/employment`, `/bank-details`)
*   `POST /employment-quick-check` - Check eligibility.
*   `POST /employment-details` - Save employment info.
*   `GET /employment-details` - Get employment info.
*   `POST /bank-details` - Save bank account for application.
*   `GET /bank-details/user/:userId` - Get all user bank accounts.
*   `GET /bank-details/enach-status` - Check E-NACH status.
*   `POST /bank-details/register-enach` - Register E-NACH.

### Loans & Applications (`/loans`, `/loan-applications`)
*   `POST /loan-applications/apply` - Submit new loan application.
*   `GET /loan-applications` - Get all user applications.
*   `GET /loan-applications/:id` - Get specific application.
*   `GET /loans/pending` - Get pending loans.
*   `GET /loan-applications/stats/summary` - Get stats.
*   `GET /loans/:id` - Get active loan details.

### Documents (`/documents`)
*   `POST /student-documents/upload` - Upload student docs.
*   `GET /student-documents` - List student docs.
*   `DELETE /student-documents/:id` - Delete doc.
*   `POST /loan-documents/upload` - Upload loan docs.
*   `GET /loan-documents/:id` - List loan docs.

### Dashboard (`/dashboard`)
*   `GET /dashboard` - Get comprehensive dashboard data (summary, active loans, upcoming payments).

### Post Disbursal (`/post-disbursal` & `/references`)
*   `GET /post-disbursal/progress/:appId` - Get flow progress.
*   `POST /post-disbursal/progress/:appId` - Update flow progress.
*   `POST /post-disbursal/complete/:appId` - Mark flow as complete.
*   `POST /references` - Save user references.
*   `GET /references` - Get user references.

---

## 2. Missing APIs (Required for Complete Flow)

### Repayment Module (Critical)
The "Repayment Screen" currently displays calculated data but lacks backend integration for actions.
*   **[MISSING]** `POST /repayments/initiate`
    *   **Purpose:** Initiate a payment via Payment Gateway (Razorpay/Cashfree).
    *   **Input:** `loan_id`, `amount`, `payment_method`.
    *   **Output:** `payment_link` or `order_id`.
*   **[MISSING]** `POST /repayments/verify`
    *   **Purpose:** Webhook or callback to verify payment success.
    *   **Action:** Update `transactions` table, update Loan Status (if fully paid).
*   **[MISSING]** `GET /repayments/history/:loanId`
    *   **Purpose:** Show past repayment transactions on the Repayment Screen or Dashboard.

### Tenure Extension (Feature Request)
The "Extend your loan tenure" button is currently a placeholder.
*   **[MISSING]** `POST /loans/:id/extend-tenure`
    *   **Purpose:** Request a tenure extension.
    *   **Validation:** Check if within eligible window (D-5 to D+15).
    *   **Action:** Create a request for Admin or auto-extend based on rules.

### Admin Notifications
*   **[MISSING]** `POST /admin/notifications/send`
    *   **Purpose:** Send manual SMS/Email to user (e.g., "Funds Disbursed", "Payment Due").
    *   Currently relying on simulated console logs or basic transactional emails.

### Loan Closure
*   **[MISSING]** `PUT /loans/:id/close`
    *   **Purpose:** Explicitly close a loan if not automated via repayment logic.
    *   **Access:** Admin only.

---

## 3. Recommended Next Steps
1.  **Implement Repayment APIs:** Prioritize `POST /repayments/initiate` and `POST /repayments/verify` to enable the "Repay Now" button.
2.  **Transactions Table:** Ensure the `transactions` table (recently created) is fully utilized by these new APIs.
3.  **Tenure Extension:** Decide if this is an automated fee-based extension or a request queue for Admins.
