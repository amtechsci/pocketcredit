# Post-Disbursal Flow and Repayment Schedule Implementation

## Overview
This document provides a complete overview of the post-disbursal flow, admin transaction management, and repayment schedule features implemented in the Pocket Credit application.

---

## Table of Contents
1. [Post-Disbursal Flow](#post-disbursal-flow)
2. [Admin Transaction Management](#admin-transaction-management)
3. [Repayment Schedule Page](#repayment-schedule-page)
4. [Database Changes](#database-changes)
5. [API Endpoints](#api-endpoints)
6. [Frontend Components](#frontend-components)
7. [User Flow](#user-flow)
8. [Admin Flow](#admin-flow)

---

## Post-Disbursal Flow

### Description
A sequential multi-step wizard that users must complete after their loan application reaches "disbursal" status. The flow includes E-NACH registration, selfie verification, references collection, KFS viewing, loan agreement signing, and a confirmation screen.

### Steps (Total: 6 Steps)

#### Step 1: E-NACH Registration
- **Component**: `ENachStep` in `PostDisbursalFlowPage.tsx`
- **Functionality**: Mocked with a "Complete" button
- **Data Saved**: `enach_done: 1` in database
- **API Endpoint**: `PUT /api/post-disbursal/progress/:applicationId`

#### Step 2: Selfie Verification
- **Component**: `SelfieCaptureStep.tsx`
- **Functionality**: 
  - Real-time camera access using `getUserMedia`
  - Captures selfie from camera only (no file upload)
  - Uploads to S3 via backend
  - Face Match API call (mocked for now)
  - Retry functionality if face match fails
- **Data Saved**: 
  - `selfie_captured: 1`
  - `selfie_verified: 1` (if face match succeeds)
  - `selfie_url`: S3 URL of captured selfie
- **API Endpoint**: `POST /api/post-disbursal/upload-selfie`

#### Step 3: References & Alternate Number
- **Component**: `EnhancedUserReferencesPage.tsx` (embedded mode)
- **Functionality**: 
  - Collects 3 references (name, phone, relationship, address)
  - Collects 1 alternate phone number
  - Uses existing references page component
- **Data Saved**: `references_completed: 1`
- **API Endpoint**: `PUT /api/post-disbursal/progress/:applicationId`

#### Step 4: Key Facts Statement (KFS)
- **Component**: `UserKFSDocument.tsx`
- **Functionality**: 
  - Displays complete KFS document matching admin version
  - Shows loan details, calculations, fees, interest
  - User must view before proceeding
- **Data Saved**: `kfs_viewed: 1`
- **API Endpoint**: `GET /api/kfs/user/:loanId`

#### Step 5: Loan Agreement
- **Component**: `UserLoanAgreementDocument.tsx`
- **Functionality**: 
  - Displays complete loan agreement document
  - OTP-based e-signature (mocked for now)
  - User must sign to proceed
- **Data Saved**: 
  - `agreement_viewed: 1`
  - `agreement_signed: 1`
- **API Endpoint**: `GET /api/loan-agreement/user/:loanId`

#### Step 6: Confirmation
- **Component**: `ConfirmationStep` in `PostDisbursalFlowPage.tsx`
- **Functionality**: 
  - Displays "You will get funds shortly" message
  - No continue button (user stays on this screen)
  - Final step of user-facing flow
- **Status**: User waits here until admin processes transaction

### Progress Tracking
- **Database Columns**: 
  - `post_disbursal_step` (current step number)
  - `enach_done`, `selfie_captured`, `selfie_verified`, `references_completed`, `kfs_viewed`, `agreement_viewed`, `agreement_signed`
- **API Endpoint**: `GET /api/post-disbursal/progress/:applicationId`
- **Auto-save**: Progress is saved after each step completion

### Status Flow
1. **disbursal** → User completes post-disbursal flow (steps 1-6)
2. **ready_for_disbursement** → After all steps completed, status changes automatically
3. **account_manager** → Admin adds "loan_disbursement" transaction, status changes
4. User sees repayment schedule

---

## Admin Transaction Management

### Add Transaction Feature
**Location**: `UserProfileDetail.tsx` → Transactions Tab

### Transaction Modal
- **Trigger**: "Add Transaction" button in Transactions tab
- **Fields**:
  - Transaction Type (required): credit, debit, emi_payment, loan_disbursement, refund, penalty, interest, processing_fee, other
  - Loan Application (required for loan_disbursement): Dropdown showing loans with `ready_for_disbursement` status
  - Amount (required)
  - Description (required)
  - Category (optional)
  - Payment Method (required): upi, net_banking, debit_card, credit_card, neft, rtgs, imps, cash, cheque, other
  - Reference Number (optional)
  - Transaction Date (required)
  - Transaction Time (optional)
  - Status (required): pending, completed, failed, processing, cancelled
  - Priority (optional): normal, high, urgent
  - Bank Details (optional): bank_name, account_number
  - Additional Notes (optional)

### Loan Disbursement Logic
When admin adds a transaction with:
- **Type**: `loan_disbursement`
- **Loan Application**: Selected from dropdown

**Backend Actions**:
1. Transaction saved to database (when transactions table is created)
2. Loan status automatically updated to `account_manager`
3. `disbursed_at` timestamp set to current date/time
4. Success notification shown to admin

**Frontend Code**:
```typescript
if (transactionType === 'loan_disbursement' && loanApplicationId) {
  await adminApiService.updateApplicationStatus(loanApplicationId, 'account_manager');
  toast.success('Transaction added successfully! Loan status updated to Account Manager.');
}
```

### Transaction Status Options
- `pending` - Transaction pending
- `completed` - Transaction completed
- `failed` - Transaction failed
- `processing` - Transaction being processed
- `cancelled` - Transaction cancelled

---

## Repayment Schedule Page

### Route
`/repayment-schedule?applicationId={loanId}`

### Access Control
- User must be authenticated
- Automatically redirects if loan status is `account_manager`
- Shows error if no active loan found

### Page Components

#### 1. Main Repayment Card
- **Header**: Blue gradient with "Repayment Screen" title
- **Loan ID**: Displayed in header
- **Exhausted Days**: Days since disbursement
- **Total Outstanding**: Large, prominent display
- **Due Date**: Shown below total outstanding
- **Default Status**: Red alert if loan is defaulted
- **Loan Details Grid**:
  - Loan Amount
  - Disbursed Amount
  - Interest
- **Action Buttons**:
  - "Repay Now" (green gradient button)
  - "Extend your loan tenure" (conditional, available D-5 to D+15)

#### 2. Loan Information Card
- **Fields**:
  - Loan Term (days/months)
  - Disbursed Date
  - Due Date
  - Days Remaining

#### 3. Loan Breakdown Card
- **Breakdown**:
  - Principal Amount
  - Interest
  - Processing Fee (if applicable)
  - GST (if applicable)
  - **Total Repayable** (highlighted)

#### 4. Important Information Card
- **Bullet Points**:
  - Timely repayment helps improve credit scores
  - Get higher loan limits & faster approvals
  - Build Pocket Credit Score & Trust Quotient
  - Avoid penalty, late fee & recovery actions
  - Prevent E-NACH bounce charges & bank penalties
  - Stay stress-free — no calls, no follow-ups

### Interest Calculation
- **Method**: Calculates interest based on actual days elapsed from `disbursed_at` date
- **Formula**: `Interest = Principal × Interest Rate per day × Actual Days Elapsed`
- **Days Calculation**: Uses `calculateTotalDays()` function (inclusive counting)
- **Example**: If loan disbursed 1 day ago → calculates 1 day of interest

### Data Source
- Fetches data from `GET /api/kfs/user/:loanId`
- KFS endpoint calculates interest based on actual elapsed days
- Uses `calculateCompleteLoanValues()` with `customDays` option

---

## Database Changes

### 1. Post-Disbursal Progress Columns
**File**: `src/server/migrations/add_post_disbursal_columns_simple.sql`

**Columns Added to `loan_applications` table**:
```sql
ALTER TABLE loan_applications
ADD COLUMN post_disbursal_step INT DEFAULT 1 COMMENT 'Current step in post-disbursal flow (1-6)',
ADD COLUMN enach_done TINYINT(1) DEFAULT 0 COMMENT 'E-NACH registration completed',
ADD COLUMN selfie_captured TINYINT(1) DEFAULT 0 COMMENT 'Selfie captured',
ADD COLUMN selfie_verified TINYINT(1) DEFAULT 0 COMMENT 'Selfie verified via face match',
ADD COLUMN selfie_url VARCHAR(500) NULL COMMENT 'S3 URL of captured selfie',
ADD COLUMN references_completed TINYINT(1) DEFAULT 0 COMMENT 'References and alternate number collected',
ADD COLUMN kfs_viewed TINYINT(1) DEFAULT 0 COMMENT 'KFS document viewed',
ADD COLUMN agreement_viewed TINYINT(1) DEFAULT 0 COMMENT 'Loan agreement viewed',
ADD COLUMN agreement_signed TINYINT(1) DEFAULT 0 COMMENT 'Loan agreement signed';
```

### 2. Loan Application Documents Table
**File**: `src/server/migrations/create_loan_application_documents_table.sql`

**Table**: `loan_application_documents`
```sql
CREATE TABLE IF NOT EXISTS loan_application_documents (
  id INT PRIMARY KEY AUTO_INCREMENT,
  loan_application_id INT NOT NULL,
  document_type VARCHAR(100) NOT NULL,
  document_name VARCHAR(255) NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  file_size BIGINT,
  uploaded_by INT,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (loan_application_id) REFERENCES loan_applications(id) ON DELETE CASCADE
);
```

### 3. Transactions Table (Planned)
**File**: `src/server/migrations/create_transactions_table.sql` (to be created)

**Table**: `transactions`
- Stores all financial transactions
- Links to loan applications
- Tracks admin who created transaction
- See `ADMIN_TRANSACTION_IMPLEMENTATION_PLAN.md` for full schema

### 4. New Loan Status
- **`ready_for_disbursement`**: Added to status enum
  - Set when user completes all post-disbursal steps
  - Appears in admin panel status dropdown
  - Loans with this status appear in transaction modal dropdown

---

## API Endpoints

### Post-Disbursal Endpoints

#### 1. Get Progress
```
GET /api/post-disbursal/progress/:applicationId
```
- **Auth**: User (requireAuth)
- **Response**: 
```json
{
  "success": true,
  "data": {
    "current_step": 3,
    "enach_done": 1,
    "selfie_captured": 1,
    "selfie_verified": 1,
    "references_completed": 1,
    "kfs_viewed": 0,
    "agreement_viewed": 0,
    "agreement_signed": 0
  }
}
```

#### 2. Update Progress
```
PUT /api/post-disbursal/progress/:applicationId
```
- **Auth**: User (requireAuth)
- **Body**:
```json
{
  "current_step": 2,
  "enach_done": 1
}
```

#### 3. Upload Selfie
```
POST /api/post-disbursal/upload-selfie
```
- **Auth**: User (requireAuth)
- **Content-Type**: multipart/form-data
- **Body**: FormData with `selfie` file and `applicationId`
- **Response**:
```json
{
  "success": true,
  "data": {
    "selfie_url": "https://s3.../selfie.jpg",
    "face_match_result": true
  }
}
```

#### 4. Complete Flow
```
POST /api/post-disbursal/complete/:applicationId
```
- **Auth**: User (requireAuth)
- **Functionality**: Sets loan status to `ready_for_disbursement`
- **Note**: Currently not used (status updated via progress endpoint)

### KFS Endpoints

#### 1. User KFS
```
GET /api/kfs/user/:loanId
```
- **Auth**: User (requireAuth)
- **Functionality**: 
  - Verifies loan belongs to user
  - Calculates interest based on actual days elapsed if disbursed
  - Returns complete KFS data
- **Response**: Full KFS object with calculations

#### 2. Admin KFS
```
GET /api/kfs/:loanId
```
- **Auth**: Admin (authenticateAdmin)
- **Functionality**: Same as user endpoint but for admin access

### Loan Agreement Endpoints

#### 1. User Loan Agreement
```
GET /api/loan-agreement/user/:loanId
```
- **Auth**: User (requireAuth)
- **Functionality**: Returns loan agreement data for user's loan

#### 2. Admin Loan Agreement
```
GET /api/loan-agreement/:loanId
```
- **Auth**: Admin (authenticateAdmin)
- **Functionality**: Returns loan agreement data for any loan

### Transaction Endpoints

#### 1. Add Transaction (Admin)
```
POST /api/user-profile/:userId/transactions
```
- **Auth**: Admin (authenticateAdmin)
- **Body**:
```json
{
  "transaction_type": "loan_disbursement",
  "loan_application_id": 38,
  "amount": 15000.00,
  "description": "Loan disbursement",
  "payment_method": "neft",
  "transaction_date": "2025-01-15",
  "status": "completed"
}
```
- **Note**: Currently stores in memory (database table to be created)

---

## Frontend Components

### 1. PostDisbursalFlowPage
**File**: `src/components/pages/PostDisbursalFlowPage.tsx`

**Features**:
- Multi-step wizard (6 steps)
- Progress auto-save
- Resume from saved step on refresh
- Redirects based on loan status
- No progress indicator at top (removed per user request)

**State Management**:
- `currentStep`: Current step (1-6)
- `progress`: Saved progress from backend
- `applicationId`: Loan application ID
- `loading`: Loading state

**Key Functions**:
- `fetchProgress()`: Loads saved progress from backend
- `handleStepComplete()`: Saves progress after each step
- `saveProgress()`: Calls API to save progress

### 2. SelfieCaptureStep
**File**: `src/components/pages/SelfieCaptureStep.tsx`

**Features**:
- Real-time camera access
- Live preview
- Capture button
- Retry on face match failure
- Loading states
- Error handling

**Camera Access**:
```typescript
const stream = await navigator.mediaDevices.getUserMedia({ 
  video: { facingMode: 'user' } 
});
```

### 3. EnhancedUserReferencesPage
**File**: `src/components/pages/EnhancedUserReferencesPage.tsx`

**Features**:
- Embedded mode for wizard integration
- Collects 3 references
- Collects 1 alternate number
- Form validation
- `onComplete` callback for wizard integration

**Props**:
- `embedded`: Boolean to hide DashboardHeader
- `onComplete`: Callback when form submitted

### 4. UserKFSDocument
**File**: `src/components/UserKFSDocument.tsx`

**Features**:
- Displays complete KFS document
- Matches admin version design
- Shows all loan calculations
- Loading and error states

### 5. UserLoanAgreementDocument
**File**: `src/components/UserLoanAgreementDocument.tsx`

**Features**:
- Displays complete loan agreement
- OTP-based e-signature (mocked)
- Loading and error states

### 6. RepaymentSchedulePage
**File**: `src/components/pages/RepaymentSchedulePage.tsx`

**Features**:
- Displays loan repayment details
- Shows total outstanding
- Loan breakdown
- Loan information
- Action buttons (Repay Now, Extend Tenure)
- Auto-redirects from dashboard if status is `account_manager`

**Data Fetching**:
- Fetches KFS data which includes all calculations
- Interest calculated based on actual days elapsed

### 7. DynamicDashboardPage
**File**: `src/components/pages/DynamicDashboardPage.tsx`

**Redirect Logic**:
```typescript
// Redirect to repayment schedule if status is account_manager
if (accountManagerApp) {
  navigate(`/repayment-schedule?applicationId=${accountManagerApp.id}`);
  return;
}

// Redirect to post-disbursal if status is disbursal
if (disbursalApp) {
  // Check if user completed step 6
  if (progress.current_step === 6 && progress.agreement_signed) {
    navigate(`/post-disbursal?applicationId=${disbursalApp.id}`);
    return;
  }
  navigate(`/post-disbursal?applicationId=${disbursalApp.id}`);
  return;
}
```

---

## User Flow

### Complete User Journey

1. **Loan Application Submitted**
   - Status: `pending` → `under_review` → `disbursal`

2. **Post-Disbursal Flow (Status: `disbursal`)**
   - User redirected to `/post-disbursal`
   - Step 1: E-NACH Registration (Complete button)
   - Step 2: Selfie Verification (Camera capture)
   - Step 3: References & Alternate Number
   - Step 4: View KFS Document
   - Step 5: View & Sign Loan Agreement
   - Step 6: Confirmation ("You will get funds shortly")
   - Status changes to `ready_for_disbursement` (after step 6)

3. **Waiting for Admin (Status: `ready_for_disbursement`)**
   - User sees confirmation screen
   - Cannot access dashboard
   - Waits for admin to add transaction

4. **Admin Processes Transaction**
   - Admin adds "loan_disbursement" transaction
   - Status changes to `account_manager`
   - `disbursed_at` timestamp set

5. **Repayment Schedule (Status: `account_manager`)**
   - User redirected to `/repayment-schedule`
   - Sees total outstanding (Principal + Interest for actual days)
   - Can view loan breakdown
   - Can make repayment
   - Can extend tenure (if within window)

---

## Admin Flow

### Admin Actions

1. **View User Profile**
   - Navigate to `/admin/user-profile/:userId`
   - See all loan applications

2. **Change Loan Status**
   - Use status dropdown in "Applied Loans" table
   - Can change to: `follow_up`, `disbursal`, `ready_for_disbursement`, etc.

3. **Quick Follow-up**
   - Section below "Applied Loans" table
   - Select action: "Need Document" → Updates status to `follow_up`
   - User sees document upload form

4. **Add Transaction**
   - Click "Add Transaction" in Transactions tab
   - Fill transaction details
   - If type is "loan_disbursement":
     - Select loan application (only `ready_for_disbursement` loans shown)
     - Submit → Status automatically changes to `account_manager`
     - `disbursed_at` timestamp set

5. **View Documents**
   - Click "View Docs" in Applied Loans table
   - See all uploaded documents for loan

---

## Key Features Implemented

### 1. Sequential Multi-Step Flow
- Users must complete steps in order
- Progress saved after each step
- Resume from saved step on refresh

### 2. Real-Time Selfie Capture
- Camera access via getUserMedia
- No file upload option (camera only)
- Face match verification (mocked)
- Retry functionality

### 3. Interest Calculation Based on Actual Days
- Calculates from `disbursed_at` date to today
- Uses `calculateTotalDays()` for inclusive counting
- Formula: `Principal × Interest Rate per day × Actual Days`
- Example: 1 day elapsed = 1 day interest

### 4. Status-Based Redirects
- Dashboard automatically redirects based on loan status
- `account_manager` → Repayment Schedule
- `disbursal` → Post-Disbursal Flow
- `ready_for_disbursement` → Confirmation Screen

### 5. Admin Transaction Integration
- Transaction modal with all required fields
- Auto-status update for loan disbursement
- Loan selector for `ready_for_disbursement` loans

### 6. Complete KFS and Agreement Display
- User-facing KFS matches admin version
- User-facing loan agreement matches admin version
- All calculations displayed correctly

---

## Files Modified/Created

### Backend Files

1. **`src/server/routes/postDisbursal.js`** (Created)
   - Post-disbursal progress endpoints
   - Selfie upload endpoint

2. **`src/server/routes/kfs.js`** (Modified)
   - Added user-facing KFS endpoint
   - Updated to calculate interest based on actual days

3. **`src/server/routes/loanAgreement.js`** (Created)
   - User-facing loan agreement endpoint

4. **`src/server/routes/userProfile.js`** (Modified)
   - Added transaction endpoint (mock)

5. **`src/server/utils/loanCalculations.js`** (Used)
   - `calculateTotalDays()` function
   - `calculateCompleteLoanValues()` function

6. **`src/server/migrations/add_post_disbursal_columns_simple.sql`** (Created)
   - Database migration for post-disbursal columns

7. **`src/server/migrations/create_loan_application_documents_table.sql`** (Created)
   - Database migration for documents table

### Frontend Files

1. **`src/components/pages/PostDisbursalFlowPage.tsx`** (Created)
   - Main post-disbursal wizard

2. **`src/components/pages/SelfieCaptureStep.tsx`** (Created)
   - Selfie capture component

3. **`src/components/pages/EnhancedUserReferencesPage.tsx`** (Modified)
   - Added embedded mode
   - Added onComplete callback

4. **`src/components/UserKFSDocument.tsx`** (Created)
   - User-facing KFS display

5. **`src/components/UserLoanAgreementDocument.tsx`** (Created)
   - User-facing loan agreement display

6. **`src/components/pages/RepaymentSchedulePage.tsx`** (Created)
   - Repayment schedule page

7. **`src/components/pages/DynamicDashboardPage.tsx`** (Modified)
   - Added redirect logic for post-disbursal and repayment

8. **`src/admin/pages/UserProfileDetail.tsx`** (Modified)
   - Added transaction modal
   - Added status update logic
   - Added loan selector in transaction modal

9. **`src/services/api.ts`** (Modified)
   - Added post-disbursal API methods
   - Added KFS and loan agreement methods
   - Fixed FormData handling

10. **`src/services/adminApi.ts`** (Modified)
    - Added transaction methods

11. **`src/App.tsx`** (Modified)
    - Added `/post-disbursal` route
    - Added `/repayment-schedule` route

---

## Configuration

### Environment Variables
No new environment variables required. Uses existing:
- AWS S3 credentials (for selfie upload)
- Database connection
- JWT secret

### Dependencies
No new dependencies added. Uses existing:
- `react-router-dom` (routing)
- `axios` (API calls)
- `sonner` (toast notifications)
- `lucide-react` (icons)

---

## Testing Checklist

### Post-Disbursal Flow
- [ ] User can access post-disbursal flow when status is `disbursal`
- [ ] Progress saves after each step
- [ ] User can resume from saved step on refresh
- [ ] Selfie capture works with camera
- [ ] Face match retry works
- [ ] References form submits correctly
- [ ] KFS displays correctly
- [ ] Loan agreement displays correctly
- [ ] Confirmation screen shows after step 6
- [ ] User cannot access dashboard after completing step 6

### Admin Transaction
- [ ] Admin can add transaction
- [ ] Loan selector shows only `ready_for_disbursement` loans
- [ ] Status updates to `account_manager` when loan_disbursement added
- [ ] `disbursed_at` timestamp is set

### Repayment Schedule
- [ ] Page loads with correct loan data
- [ ] Interest calculated based on actual days elapsed
- [ ] Total outstanding shows correctly (Principal + Interest)
- [ ] Loan breakdown displays all fees
- [ ] Repay Now button works
- [ ] Extend tenure button shows/hides correctly

### Redirects
- [ ] Dashboard redirects to repayment schedule if status is `account_manager`
- [ ] Dashboard redirects to post-disbursal if status is `disbursal`
- [ ] Dashboard redirects to confirmation if step 6 completed

---

## Known Issues / Future Improvements

### 1. Transactions Table
- **Status**: Planned (see `ADMIN_TRANSACTION_IMPLEMENTATION_PLAN.md`)
- **Issue**: Currently stores transactions in memory
- **Solution**: Create `transactions` table and update backend

### 2. Face Match API
- **Status**: Mocked
- **Issue**: Real face match API not integrated
- **Solution**: Integrate actual face match service

### 3. E-NACH Registration
- **Status**: Mocked
- **Issue**: Real E-NACH API not integrated
- **Solution**: Integrate actual E-NACH service

### 4. OTP E-Signature
- **Status**: Mocked
- **Issue**: Real OTP service not integrated
- **Solution**: Integrate actual OTP and e-signature service

### 5. Payment Gateway
- **Status**: Not implemented
- **Issue**: "Repay Now" button shows toast only
- **Solution**: Integrate payment gateway

---

## API Response Examples

### Post-Disbursal Progress
```json
{
  "success": true,
  "data": {
    "current_step": 3,
    "enach_done": 1,
    "selfie_captured": 1,
    "selfie_verified": 1,
    "references_completed": 1,
    "kfs_viewed": 0,
    "agreement_viewed": 0,
    "agreement_signed": 0
  }
}
```

### KFS Data
```json
{
  "success": true,
  "data": {
    "loan": {
      "loan_id": "LOAN38",
      "sanctioned_amount": 15000,
      "disbursed_at": "2025-01-15T10:00:00.000Z"
    },
    "calculations": {
      "principal": 15000,
      "interest": 15.00,
      "total_repayable": 15015.00,
      "disbursed_amount": 12876.00
    },
    "interest": {
      "rate_per_day": 0.001,
      "days": 1,
      "amount": 15.00
    }
  }
}
```

---

## Summary

This implementation provides a complete post-disbursal flow for users, admin transaction management, and a repayment schedule page. The system:

1. **Guides users** through 6 sequential steps after loan approval
2. **Tracks progress** and allows users to resume
3. **Calculates interest** based on actual days elapsed from disbursement
4. **Enables admins** to process loan disbursements via transactions
5. **Shows repayment details** with accurate calculations
6. **Handles redirects** based on loan status automatically

All features are functional with mocked APIs where real integrations are pending. The system is ready for production once payment gateway, face match, E-NACH, and OTP services are integrated.

---

## Contact & Support

For questions or issues related to this implementation, refer to:
- Backend routes: `src/server/routes/`
- Frontend components: `src/components/pages/`
- Database migrations: `src/server/migrations/`

---

**Document Version**: 1.0  
**Last Updated**: January 2025  
**Author**: Development Team

