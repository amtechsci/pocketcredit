# API Data Storage Documentation

This document maps all APIs in the loan application flow, showing what data is received and where it's stored in the database.

---

## 📋 Table of Contents

1. [Authentication & Profile](#authentication--profile)
2. [Profile Completion](#profile-completion)
3. [Employment Details](#employment-details)
4. [Bank Statement & Account Aggregator](#bank-statement--account-aggregator)
5. [Bank Details & e-NACH](#bank-details--e-nach)
6. [Email Verification](#email-verification)
7. [Residence Address](#residence-address)
8. [Additional Information](#additional-information)
9. [Loan Application](#loan-application)
10. [External APIs (Digitap)](#external-apis-digitap)

---

## 🔐 Authentication & Profile

### 1. POST `/api/auth/login` (Mobile OTP)
**Receives:**
- `mobile`: Mobile number
- `otp`: OTP code

**Stores in:**
- `users.phone` - Mobile number
- `users.phone_verified` - Set to `1` after OTP verification
- `users.last_login_at` - Updated on successful login

---

## 👤 Profile Completion

### 2. POST `/api/digitap/prefill`
**Receives from Digitap API:**
- `name`: Full name
- `dob`: Date of birth
- `pan`: PAN number
- `gender`: Gender
- `email`: Email address
- `address`: Address array
- `experian_score`: Credit score

**Stores in:**
- `digitap_responses` table:
  - `user_id`
  - `mobile_number`
  - `response_data` (JSON) - Full API response
  - `experian_score`
  - `created_at`

**Also updates:**
- `users.experian_score` - If score < 630, user is put on hold
- `users.status` - Set to `'on_hold'` if score < 630
- `users.eligibility_status` - Set to `'not_eligible'` if score < 630
- `users.application_hold_reason` - Hold reason
- `users.hold_until_date` - 60 days from now if score < 630

### 3. POST `/api/digitap/save-prefill`
**Receives:**
- `name`: Full name
- `dob`: Date of birth
- `pan`: PAN number
- `gender`: Gender
- `email`: Email address
- `address`: Address array

**Stores in:**
- `users` table:
  - `first_name` - Extracted from name
  - `last_name` - Extracted from name
  - `email`
  - `date_of_birth`
  - `gender`
  - `pan_number`
  - `pincode` - Extracted from address
  - `address_data` (JSON) - Full address data
  - `profile_completion_step` - Set to `5`
  - `profile_completed` - Set to `true`

### 4. POST `/api/digitap/pan-validation`
**Receives from Digitap PAN Validation API:**
- `pan`: PAN number
- `fullname`: Full name
- `first_name`: First name
- `last_name`: Last name
- `gender`: Gender
- `dob`: Date of birth (format: "DD/MM/YYYY")
- `address`: Address object with:
  - `building_name`
  - `locality`
  - `street_name`
  - `pincode`
  - `city`
  - `state`
  - `country`

**Stores in:**
- `users` table:
  - `pan_number`
  - `first_name`
  - `last_name`
  - `gender`
  - `date_of_birth` - Converted from "DD/MM/YYYY" format
  - `address_data` (JSON) - Full address object
  - `pincode`
  - `profile_completion_step` - Updated
  - `profile_completed` - Updated if all data available

### 5. POST `/api/user/basic-profile`
**Receives:**
- `first_name`: First name
- `last_name`: Last name
- `date_of_birth`: Date of birth
- `gender`: Gender
- `pan_number`: PAN number
- `latitude`: Latitude
- `longitude`: Longitude

**Stores in:**
- `users` table:
  - `first_name`
  - `last_name`
  - `date_of_birth`
  - `gender`
  - `pan_number`
  - `latlong` - Format: "latitude,longitude"
  - `profile_completion_step` - Updated based on employment type
  - `profile_completed` - Updated

- `verification_records` table:
  - `user_id`
  - `document_type` - Set to `'pan'`
  - `document_number` - PAN number
  - `verification_status` - Set to `'pending'`

---

## 💼 Employment Details

### 6. POST `/api/employment-quick-check`
**Receives:**
- `employment_type`: Employment type (salaried/self_employed/business/student)
- `age`: Age
- `income_range`: Income range (e.g., "1k-20k", "20k-30k", "30k-40k", "above-40k")
- `payment_mode`: Payment mode

**Stores in:**
- `users` table:
  - `employment_type`
  - `income_range`
  - `eligibility_status` - Based on checks
  - `eligibility_reason` - Reason if not eligible
  - `status` - May be set to `'on_hold'` if conditions not met
  - `hold_until_date` - If temporary hold
  - `application_hold_reason` - Hold reason
  - `loan_limit` - Calculated from `loan_limit_tiers` table
  - `profile_completion_step` - Updated to `2`

**Queries:**
- `loan_limit_tiers` table - To get `loan_limit` and `hold_permanent` for the income range

### 7. POST `/api/employment-details/details`
**Receives:**
- `company_name`: Company name
- `monthly_net_income`: Monthly net income
- `income_confirmed`: Boolean (not stored, only validated)
- `education`: Education level
- `salary_date`: Salary date (1-31)
- `industry`: Industry
- `department`: Department
- `designation`: Designation
- `application_id`: Loan application ID
- `industry_other`: Other industry (if industry is "Others")
- `department_other`: Other department (if department is "Others")

**Stores in:**
- `users` table:
  - `monthly_net_income`
  - `salary_date`

- `application_employment_details` table:
  - `application_id`
  - `user_id`
  - `company_name`
  - `education`
  - `industry` - Uses `industry_other` if industry is "Others"
  - `department` - Uses `department_other` if department is "Others"
  - `designation`
  - `created_at`
  - `updated_at`

---

## 🏦 Bank Statement & Account Aggregator

### 8. POST `/api/user/init-bank-statement-table`
**Receives:**
- `mobile_number`: Mobile number linked to bank account
- `bank_name`: Bank name (optional)

**Stores in:**
- `user_bank_statements` table:
  - `user_id`
  - `mobile_number`
  - `bank_name`
  - `status` - Set to `'initiated'`
  - `request_id` - Generated client reference number
  - `created_at`

### 9. POST `/api/aa/initiate` (Account Aggregator)
**Receives:**
- `mobile_number`: Mobile number
- `bank_name`: Selected bank

**Calls Digitap API:**
- Generates bank statement URL via Digitap

**Stores in:**
- `user_bank_statements` table:
  - `user_id`
  - `mobile_number`
  - `bank_name`
  - `request_id` - Client reference number
  - `status` - Set to `'pending'`
  - `transaction_data` (JSON) - Initial response
  - `created_at`

### 10. Webhook: `/api/user/bank-statement-webhook` (Digitap Callback)
**Receives from Digitap:**
- `request_id`: Request ID
- `txn_id`: Transaction ID
- `status`: Status (pending/completed/failed)
- `transaction_data`: Full transaction data

**Stores in:**
- `webhook_logs` table:
  - `user_id`
  - `webhook_type` - Set to `'bank_statement'`
  - `payload` (JSON) - Full webhook payload
  - `processed` - Set to `false` initially
  - `created_at`

- `user_bank_statements` table:
  - `status` - Updated from webhook
  - `transaction_data` (JSON) - Updated from webhook
  - `txn_id` - Extracted from webhook
  - `updated_at`

**Auto-triggers:**
- If `status === 'completed'`, automatically calls `retrieveBankStatementReport` API
- Saves full report to `user_bank_statements.report_data` (JSON)
- Extracts and saves bank details to `bank_details` table

### 11. POST `/api/user/fetch-bank-report`
**Receives:**
- `txn_id`: Transaction ID (optional)

**Calls Digitap API:**
- `POST https://svcdemo.digitap.work/bank-data/retrievereport`
- Sends: `txn_id`, `report_type: 'json'`, `report_subtype: 'type3'`

**Receives from Digitap:**
- Full bank statement report with:
  - `banks`: Array of bank accounts
  - `status`: Report status
  - `request_level_summary_var`: Summary variables
  - `source_report`: Source report data
  - `statement_start_date`: Statement start date
  - `multiple_accounts_found`: Boolean

**Stores in:**
- `user_bank_statements` table:
  - `report_data` (JSON) - Full report data
  - `status` - Updated to `'completed'`
  - `updated_at`

**Auto-extracts and saves:**
- `bank_details` table:
  - `user_id`
  - `account_number`
  - `ifsc_code`
  - `bank_name`
  - `account_holder_name`
  - `branch_name`
  - `account_type`
  - `source` - Set to `'digitap_report'`
  - `created_at`

### 12. GET `/api/user/bank-statement-status`
**Returns:**
- Current status from `user_bank_statements` table

**Auto-triggers if needed:**
- If `status === 'completed'` but `report_data` is empty:
  - Automatically calls `retrieveBankStatementReport` API
  - Saves report to `report_data`
  - Extracts and saves bank details

---

## 🏦 Bank Details & e-NACH

### 13. POST `/api/bank-details/user`
**Receives:**
- `account_number`: Account number
- `ifsc_code`: IFSC code
- `bank_name`: Bank name (optional)
- `account_holder_name`: Account holder name (optional)
- `branch_name`: Branch name (optional)
- `account_type`: Account type (optional)

**Stores in:**
- `bank_details` table:
  - `user_id`
  - `account_number`
  - `ifsc_code`
  - `bank_name` - Auto-determined from IFSC if not provided
  - `account_holder_name` - Uses user's name if not provided
  - `branch_name`
  - `account_type`
  - `source` - Set to `'manual'`
  - `is_primary` - Set to `false`
  - `created_at`

### 14. POST `/api/bank-details/register-enach`
**Receives:**
- `bank_detail_id`: Bank detail ID to register for e-NACH

**Stores in:**
- `enach_registrations` table:
  - `user_id`
  - `application_id` - May be null
  - `bank_detail_id`
  - `account_number` - From bank_details
  - `ifsc_code` - From bank_details
  - `bank_name` - From bank_details
  - `account_holder_name` - From bank_details
  - `account_type` - From bank_details
  - `status` - Set to `'pending'`
  - `created_at`

**Also updates:**
- `bank_details.is_primary` - Set to `true` for selected bank
- `bank_details.is_primary` - Set to `false` for other banks of same user

---

## 📧 Email Verification

### 15. POST `/api/email-otp/send`
**Receives:**
- `email`: Email address
- `type`: Type (`'personal'` or `'official'`)

**Stores in:**
- `email_otp_verification` table:
  - `user_id`
  - `email`
  - `otp` - 6-digit OTP
  - `type` - `'personal'` or `'official'`
  - `expires_at` - 10 minutes from now
  - `verified` - Set to `false`
  - `created_at`

**Sends:**
- Email via SMTP with OTP code

### 16. POST `/api/email-otp/verify`
**Receives:**
- `email`: Email address
- `otp`: OTP code
- `type`: Type (`'personal'` or `'official'`)

**Stores in:**
- `email_otp_verification` table:
  - `verified` - Set to `true`

- `users` table:
  - `personal_email` - If type is `'personal'`
  - `personal_email_verified` - Set to `true` if type is `'personal'`
  - `official_email` - If type is `'official'`
  - `official_email_verified` - Set to `true` if type is `'official'`

---

## 🏠 Residence Address

### 17. GET `/api/user/available-addresses`
**Fetches from:**
- `kyc_verifications` table - Digilocker address from `verification_data`
- `credit_checks` table - Experian addresses from `full_report`
- `digitap_responses` table - Digitap addresses from `response_data`
- `users` table - Address from `address_data`

**Returns:**
- Array of available addresses from all sources

### 18. POST `/api/user/residence-address`
**Receives:**
- `residence_type`: `'owned'` or `'rented'`
- `source`: Source of address (`'digilocker'`, `'experian'`, `'digitap'`, `'manual'`)
- `address_line1`: Address line 1
- `address_line2`: Address line 2 (optional)
- `city`: City
- `state`: State
- `pincode`: Pincode
- `country`: Country (default: `'India'`)
- `full_address`: Full address string (optional)

**Stores in:**
- `users` table:
  - `residence_type`
  - `address_data` (JSON) - Full address object
  - `pincode`

- `addresses` table:
  - `user_id`
  - `address_type` - Set to `'current'`
  - `address_line1`
  - `address_line2`
  - `city`
  - `state`
  - `pincode`
  - `country`
  - `is_primary` - Set to `true`
  - `created_at`
  - `updated_at`

**Also creates/updates:**
- `loan_applications` table:
  - Creates new application with `status = 'under_review'` if doesn't exist
  - Updates existing application `status = 'under_review'` if exists

---

## ℹ️ Additional Information

### 19. POST `/api/user/additional-information`
**Receives:**
- `marital_status`: `'single'`, `'married'`, `'divorced'`, or `'widow'`
- `spoken_language`: Comma-separated string (e.g., `'English,Hindi'`)
- `work_experience`: `'0-2'`, `'2-5'`, `'5-8'`, or `'8+'`

**Stores in:**
- `users` table:
  - `marital_status`
  - `spoken_language` - Stored as comma-separated string
  - `work_experience_range` - Stored as range string
  - `updated_at`

---

## 📝 Loan Application

### 20. POST `/api/loans/apply`
**Receives:**
- `loan_amount`: Loan amount
- `loan_purpose`: Loan purpose
- `selected_plan_id`: Selected loan plan ID
- `tenure_months`: Tenure in months (optional)
- `interest_rate`: Interest rate (optional)

**Stores in:**
- `loan_applications` table:
  - `user_id`
  - `application_number` - Auto-generated (format: `PC{timestamp}{random}`)
  - `loan_amount`
  - `loan_purpose`
  - `tenure_months`
  - `interest_rate`
  - `status` - Set to `'pending'`
  - `plan_snapshot` (JSON) - Selected plan details
  - `created_at`
  - `updated_at`

---

## 🔄 External APIs (Digitap)

### Digitap Prefill API
**Endpoint:** `POST https://svcint.digitap.work/wrap/demo/svc/validation/kyc/v1/prefill`

**Sends:**
- `mobile`: Mobile number

**Receives:**
- `name`: Full name
- `dob`: Date of birth
- `pan`: PAN number
- `gender`: Gender
- `email`: Email
- `address`: Address array
- `experian_score`: Credit score

**Stored in:** `digitap_responses` table

### Digitap PAN Validation API
**Endpoint:** `POST https://svcint.digitap.work/wrap/demo/svc/validation/kyc/v1/pan_details`

**Sends:**
- `pan`: PAN number
- `father_name`: `"false"`
- `pan_display_name`: `"false"`
- `client_ref_num`: Client reference number

**Receives:**
- `pan`: PAN number
- `pan_type`: PAN type
- `fullname`: Full name
- `first_name`: First name
- `last_name`: Last name
- `gender`: Gender
- `dob`: Date of birth (format: "DD/MM/YYYY")
- `address`: Address object

**Stored in:** `users` table

### Digitap Bank Statement Initiate API
**Endpoint:** `POST https://svcdemo.digitap.work/bank-data/initiate`

**Sends:**
- `mobile_number`: Mobile number
- `bank_name`: Bank name
- `client_ref_num`: Client reference number

**Receives:**
- Bank statement URL
- Request ID

**Stored in:** `user_bank_statements` table

### Digitap Bank Statement Retrieve Report API
**Endpoint:** `POST https://svcdemo.digitap.work/bank-data/retrievereport`

**Sends:**
- `txn_id`: Transaction ID
- `report_type`: `'json'`
- `report_subtype`: `'type3'`

**Receives:**
- Full bank statement report JSON with:
  - `banks`: Array of bank accounts
  - `status`: Report status
  - `request_level_summary_var`: Summary variables
  - `source_report`: Source report
  - `statement_start_date`: Statement start date
  - `multiple_accounts_found`: Boolean

**Stored in:**
- `user_bank_statements.report_data` (JSON)
- `bank_details` table (extracted bank accounts)

---

## 📊 Database Tables Summary

### Core Tables:
- **`users`** - Main user information
- **`loan_applications`** - Loan application records
- **`application_employment_details`** - Employment details per application
- **`addresses`** - User addresses
- **`bank_details`** - Bank account details
- **`user_bank_statements`** - Bank statement metadata and reports
- **`enach_registrations`** - e-NACH registration records

### Verification Tables:
- **`email_otp_verification`** - Email OTP verification records
- **`verification_records`** - Document verification records
- **`kyc_verifications`** - KYC verification data (Digilocker)
- **`credit_checks`** - Credit check results (Experian)

### External API Response Tables:
- **`digitap_responses`** - Digitap API responses
- **`webhook_logs`** - Webhook payload logs

### Configuration Tables:
- **`loan_limit_tiers`** - Income range and loan limit configuration
- **`loan_plans`** - Loan repayment plans

---

## 🔍 Data Flow Summary

1. **User Registration** → `users` table (phone, OTP verification)
2. **Profile Completion** → `users` table (name, DOB, PAN, gender, address)
3. **Employment Check** → `users` table (employment_type, income_range, loan_limit)
4. **Employment Details** → `users` table (monthly_net_income, salary_date) + `application_employment_details` table
5. **Bank Statement** → `user_bank_statements` table (metadata) → `bank_details` table (extracted accounts)
6. **Bank Selection** → `bank_details` table (user-selected bank)
7. **e-NACH Registration** → `enach_registrations` table
8. **Email Verification** → `users` table (personal_email, official_email, verification flags)
9. **Residence Address** → `users` table (residence_type) + `addresses` table
10. **Additional Information** → `users` table (marital_status, spoken_language, work_experience_range)
11. **Loan Application** → `loan_applications` table

---

**Last Updated:** 2025-11-30
**Version:** 1.0

