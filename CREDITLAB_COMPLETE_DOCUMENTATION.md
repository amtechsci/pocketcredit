# CreditLab - Complete Application Documentation

## Overview
CreditLab is a 5-year-old PHP-based digital lending platform that provides instant personal loans to salaried professionals. The application offers loans ranging from ₹5,000 to ₹1,00,000 with quick disbursal in 30 minutes.

## Business Model
- **Product**: Sonu Marketing Private Limited (NBFC)
- **Target Audience**: Salaried professionals earning minimum ₹25,000/month
- **Loan Range**: ₹5,000 - ₹1,00,000
- **Interest Rate**: 0.1% per day
- **Tenure**: 1 month to 1 year
- **Processing Fee**: 5% + 7% origination fee for new users

## Database Schema

### Core Tables

#### 1. User Management
```sql
-- Main user table
CREATE TABLE `user` (
  `id` int(11) NOT NULL,
  `rcid` text DEFAULT NULL,                    -- Customer ID (CL + timestamp)
  `name` text DEFAULT NULL,
  `father_name` text DEFAULT NULL,
  `pan_name` text NOT NULL,
  `mobile` varchar(20) DEFAULT NULL,
  `altmobile` varchar(20) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `altemail` varchar(255) DEFAULT NULL,
  `state` text DEFAULT NULL,
  `state_code` int(11) DEFAULT NULL,
  `dob` date DEFAULT NULL,
  `gender` int(11) DEFAULT 2,
  `pan` text DEFAULT NULL,
  `salary` text DEFAULT NULL,
  `salarystatus` text DEFAULT NULL,
  `present_address` text DEFAULT NULL,
  `permanent_address` text DEFAULT NULL,
  `graduation_year` varchar(25) DEFAULT NULL,
  `marital_status` varchar(25) DEFAULT NULL,
  `college_name` text DEFAULT NULL,
  `freq_app` text DEFAULT NULL,
  `experience` varchar(55) DEFAULT NULL,
  `residence_type` varchar(55) DEFAULT NULL,
  `credit_card` text DEFAULT NULL,
  `company` text DEFAULT NULL,
  `designation` text DEFAULT NULL,
  `office_number` bigint(20) DEFAULT NULL,
  `department` text DEFAULT NULL,
  `annual_income` varchar(55) DEFAULT NULL,
  `office_pincode` varchar(25) DEFAULT NULL,
  `office_address_line1` text DEFAULT NULL,
  `office_address_line2` text DEFAULT NULL,
  `conpanydocument` text DEFAULT NULL,        -- PAN document
  `personaldocument` text DEFAULT NULL,       -- Aadhar documents
  `salarydocument` text DEFAULT NULL,         -- Salary slip
  `bankdocument` text DEFAULT NULL,           -- Bank statement
  `bankdocument2` text DEFAULT NULL,
  `bankdocument3` text DEFAULT NULL,
  `addressdocument` text DEFAULT NULL,        -- Address proof
  `bank_name` text DEFAULT NULL,
  `branch_name` text DEFAULT NULL,
  `ifsc` text DEFAULT NULL,
  `account_no` text DEFAULT NULL,
  `account_type` text DEFAULT NULL,
  `account_name` text DEFAULT NULL,
  `validation` text DEFAULT NULL,
  `document_password` text DEFAULT NULL,      -- Document passwords
  `get_salary` text DEFAULT NULL,             -- Salary mode
  `loan` int(11) DEFAULT 0,                   -- Current loan status
  `loan_limit` int(11) DEFAULT 10000,         -- Credit limit
  `sloan` int(11) DEFAULT 0,                  -- Successful loans count
  `verify` int(11) DEFAULT 0,                 -- Verification status
  `active` int(11) DEFAULT 1,                 -- Account status
  `otp` int(11) DEFAULT 1111,                 -- OTP for verification
  `reg_date` text DEFAULT NULL,
  `status` text DEFAULT 'waiting',            -- User status
  `assign_account_manager` int(11) DEFAULT 1,
  `assign_recovery_officer` int(11) DEFAULT 1,
  `star_member` int(11) DEFAULT 2,            -- Membership tier
  `member` int(11) DEFAULT 0,                 -- Member type
  `approvenew` int(11) DEFAULT 0,             -- New user approval
  `limit_inc` int(11) DEFAULT 0,              -- Limit increase flag
  `credit_score` int(11) DEFAULT 0,           -- Credit score
  `salary_date` text DEFAULT NULL,            -- Salary date
  `signature` text DEFAULT NULL,              -- Digital signature
  `selfie` text DEFAULT NULL,                 -- Video KYC
  `easebuzz` int(11) DEFAULT 0,               -- E-mandate status
  `altmobile` varchar(20) NOT NULL,
  `altemail` varchar(255) DEFAULT NULL,
  `company` text DEFAULT NULL,
  `conpanydocument` text DEFAULT NULL,
  `personaldocument` text DEFAULT NULL,
  `salarydocument` text DEFAULT NULL,
  `bankdocument` text DEFAULT NULL,
  `bankdocument2` text DEFAULT NULL,
  `bankdocument3` text DEFAULT NULL,
  `addressdocument` text DEFAULT NULL
);
```

#### 2. Loan Management
```sql
-- Loan applications
CREATE TABLE `loan_apply` (
  `id` int(11) NOT NULL,
  `uid` bigint(20) NOT NULL,                  -- User ID
  `amount` decimal(10,3) DEFAULT NULL,        -- Loan amount
  `processing_fees` decimal(10,3) DEFAULT NULL,
  `pro_fee_per` int(11) DEFAULT 14,           -- Processing fee percentage
  `origination_fee` decimal(10,3) DEFAULT 0.000,
  `account_management_fee` decimal(10,3) DEFAULT NULL,
  `service_charge` text NOT NULL,             -- Service charges
  `days` bigint(20) NOT NULL,                 -- Loan tenure in days
  `apply_date` varchar(255) NOT NULL,
  `status` varchar(55) NOT NULL,              -- pending, disbursal, account manager, recovery officer, cleared
  `status_date` varchar(255) NOT NULL,
  `follow_up_date` varchar(25) NOT NULL,
  `created_by` text NOT NULL,                 -- Created by user/admin
  `reason` text NOT NULL,                     -- Application reason
  `agreement` int(11) NOT NULL DEFAULT 0,     -- Agreement signed
  `keyid` int(11) NOT NULL DEFAULT 0,         -- Key fact statement ID
  `lat` varchar(85) DEFAULT NULL,             -- Latitude
  `longt` varchar(85) DEFAULT NULL,           -- Longitude
  `ubank_id` int(11) DEFAULT 0                -- User bank ID
);

-- Active loans
CREATE TABLE `loan` (
  `id` int(11) NOT NULL,
  `lid` int(11) NOT NULL,                     -- Loan application ID
  `uid` bigint(20) NOT NULL,                  -- User ID
  `processed_date` datetime DEFAULT NULL,     -- Disbursal date
  `processed_amount` text NOT NULL,           -- Disbursed amount
  `exhausted_period` text NOT NULL,           -- Days since disbursal
  `p_fee` text NOT NULL,                      -- Processing fee
  `origination_fee` int(11) DEFAULT NULL,
  `account_management_fee` int(11) DEFAULT NULL,
  `service_charge` text NOT NULL,             -- Service charges
  `penality_charge` text NOT NULL,            -- Penalty charges
  `total_amount` text NOT NULL,               -- Total outstanding
  `status_log` text NOT NULL,                 -- Current status
  `action` text NOT NULL,                     -- Last action
  `follow_up_mess` text NOT NULL,             -- Follow-up message
  `advance_amount` text NOT NULL,             -- Advance payment
  `total_time` varchar(25) NOT NULL,          -- Total tenure
  `femi` int(11) NOT NULL DEFAULT 0,          -- First EMI
  `semi` int(11) NOT NULL DEFAULT 0,          -- Second EMI
  `is_emi` int(11) DEFAULT NULL,              -- EMI mode
  `enach_request` int(11) DEFAULT 0           -- E-Nach request status
);
```

#### 3. User Roles & Staff
```sql
-- Account Managers
CREATE TABLE `account_manager` (
  `id` int(11) NOT NULL,
  `name` text NOT NULL,
  `email` text NOT NULL,
  `mobile` varchar(25) DEFAULT NULL,
  `otp` int(11) DEFAULT NULL,
  `password` text NOT NULL,
  `reg_date` text NOT NULL
);

-- Recovery Officers
CREATE TABLE `recovery_officer` (
  `id` int(11) NOT NULL,
  `name` text NOT NULL,
  `email` text NOT NULL,
  `mobile` varchar(25) DEFAULT NULL,
  `otp` int(11) DEFAULT NULL,
  `password` text NOT NULL,
  `reg_date` text NOT NULL
);

-- Verification Staff
CREATE TABLE `verify_user` (
  `id` int(11) NOT NULL,
  `name` text NOT NULL,
  `email` text NOT NULL,
  `mobile` varchar(25) DEFAULT NULL,
  `otp` int(11) DEFAULT NULL,
  `password` text NOT NULL,
  `reg_date` text NOT NULL
);
```

#### 4. Banking & Payments
```sql
-- User bank details
CREATE TABLE `user_bank` (
  `id` int(11) NOT NULL,
  `uid` int(11) NOT NULL,
  `ac_name` text NOT NULL,                    -- Account holder name
  `ac_no` text NOT NULL,                      -- Account number
  `ifsc_code` text NOT NULL,                  -- IFSC code
  `ac_type` text NOT NULL,                    -- Account type
  `branch_name` text NOT NULL,                -- Branch name
  `bank_name` text NOT NULL,                  -- Bank name
  `bank_statment` varchar(55) DEFAULT NULL,   -- Bank statement
  `date` varchar(25) NOT NULL,
  `verify` int(11) NOT NULL DEFAULT 0         -- Verification status
);

-- Bank names reference
CREATE TABLE `bank_name` (
  `id` int(11) NOT NULL,
  `bank_name` varchar(55) DEFAULT NULL,
  `bank_code` varchar(15) DEFAULT NULL
);

-- Payment gateway transactions
CREATE TABLE `pg_transaction` (
  `id` int(11) NOT NULL,
  `txnid` varchar(255) NOT NULL,              -- Transaction ID
  `loan_id` int(11) NOT NULL,                 -- Loan ID
  `amount` decimal(10,2) NOT NULL,            -- Amount
  `firstname` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(20) NOT NULL,
  `productinfo` varchar(255) NOT NULL,
  `status` varchar(50) NOT NULL,              -- initiated, success, failed
  `created_at` timestamp DEFAULT current_timestamp
);

-- Easebuzz auto-debit details
CREATE TABLE `easebuzz_adtd` (
  `id` int(11) NOT NULL,
  `uid` int(11) NOT NULL,                     -- User ID
  `customer_authentication_id` varchar(255) NOT NULL,
  `bank_code` varchar(10) NOT NULL,
  `account_no` varchar(20) NOT NULL,
  `account_type` varchar(10) NOT NULL,
  `ifsc` varchar(15) NOT NULL,
  `created_at` timestamp DEFAULT current_timestamp
);
```

#### 5. Communication & Tracking
```sql
-- User login tracking
CREATE TABLE `user_login_details` (
  `id` int(11) NOT NULL,
  `uid` text NOT NULL,                        -- User ID
  `browser` text NOT NULL,                    -- Browser info
  `ip_address` text NOT NULL,                 -- IP address
  `login_time` text NOT NULL,                 -- Login timestamp
  `mobile_handset_uid` varchar(25) NOT NULL,  -- Device ID
  `latitude` varchar(50) NOT NULL,            -- GPS latitude
  `longitude` varchar(50) NOT NULL            -- GPS longitude
);

-- Account manager interactions
CREATE TABLE `loan_acc_man` (
  `id` int(11) NOT NULL,
  `uid` int(11) DEFAULT NULL,                 -- User ID
  `lid` int(11) DEFAULT NULL,                 -- Loan ID
  `customer_response` text DEFAULT NULL,      -- Customer response
  `commitment_date` varchar(25) DEFAULT NULL, -- Commitment date
  `commitment_text` text DEFAULT NULL,        -- Commitment details
  `default_type` varchar(25) DEFAULT NULL,    -- Default type
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp
);

-- Transaction details
CREATE TABLE `transaction_details` (
  `id` int(11) NOT NULL,
  `uid` int(11) NOT NULL,                     -- User ID
  `cllid` int(11) NOT NULL,                   -- Loan ID
  `transaction_number` varchar(255) NOT NULL, -- Transaction number
  `transaction_date` varchar(255) NOT NULL,   -- Transaction date
  `transaction_amount` decimal(10,2) NOT NULL, -- Amount
  `transaction_flow` varchar(255) NOT NULL    -- Payment direction
);
```

## User Roles & Permissions

### 1. Regular Users (active = 1)
- **Access**: User dashboard (`/user/`)
- **Features**: 
  - Apply for loans
  - Upload documents
  - View loan status
  - Make payments
  - Update profile

### 2. Admin Users (active = 2)
- **Access**: Admin dashboard (`/admin/`)
- **Features**:
  - User management
  - Loan approval/rejection
  - Transaction management
  - Staff management
  - Reports and analytics

### 3. Account Managers
- **Access**: Account manager dashboard (`/account_manager/`)
- **Features**:
  - Follow up with customers
  - Update loan status
  - Send SMS notifications
  - View customer details

### 4. Recovery Officers
- **Access**: Recovery dashboard (`/recovery_officer/`)
- **Features**:
  - Handle default cases
  - Recovery follow-ups
  - Payment collection

### 5. Verification Staff
- **Access**: Verification dashboard (`/verify_user/`)
- **Features**:
  - Document verification
  - KYC processing
  - User verification

## Core Features & Workflows

### 1. User Registration & Onboarding
```php
// Registration flow
1. User enters mobile number
2. System generates OTP (default: 1111)
3. User verifies OTP
4. System creates user account with auto-assigned account manager and recovery officer
5. User completes profile information step by step
```

**Profile Completion Steps:**
- Personal information (salary, employment details)
- PAN card details
- Bank account information
- Document uploads (PAN, Aadhar, salary slip, bank statement)
- Reference contacts
- Video KYC (selfie)
- E-mandate setup

### 2. Loan Application Process
```php
// Loan application workflow
1. User applies for loan with amount and tenure
2. System calculates processing fees and origination fees
3. For new users: Status = 'pending'
4. For repeat users: Status = 'disbursal' (instant approval)
5. Admin/Account manager reviews application
6. Documents verification
7. Loan disbursal
8. E-mandate setup for auto-debit
```

**Loan Calculation Logic:**
```php
// Processing fee calculation
$p_f = ($amount / 100) * 5;  // 5% processing fee

// For new users
$origination_fee = ($amount / 100) * 7;  // 7% origination fee
$total_fees = $p_f + $origination_fee;

// For repeat users
$origination_fee = 0;
$total_fees = $p_f;

// Service charges (daily)
$service_charge = $total_amount * $days * 0.1;  // 0.1% per day
```

### 3. Document Management
**Supported Documents:**
- PAN Card (PDF/Image)
- Aadhar Card (Front & Back)
- Salary Slip (PDF/Image)
- Bank Statement (PDF/Image)
- Address Proof (PDF/Image)

**Document Upload Process:**
```php
// Document upload with S3 integration
1. User selects document type
2. System validates file type (PDF, JPG, PNG)
3. File uploaded to AWS S3
4. Document password stored if provided
5. Verification status updated
```

### 4. Payment Integration

#### Easebuzz Payment Gateway
```php
// Payment configuration
$MERCHANT_KEY = "9BIB9D914T";
$SALT = "GGW1QF6ONH";
$ENV = "prod";

// Payment flow
1. User initiates payment
2. System generates transaction ID
3. Redirect to Easebuzz payment page
4. Payment processing
5. Webhook callback for status update
6. Loan status updated
```

#### E-Nach Auto Debit
```php
// E-Nach setup process
1. User provides bank details
2. Easebuzz E-Nach API call
3. Customer authentication
4. Mandate creation
5. Auto-debit on due dates
```

### 5. SMS & Communication System
```php
// SMS Gateway Integration
$sender = "CREDLB";
$url = "https://sms.smswala.in/app/smsapi/index.php?key=2683C705E7CB39&campaign=16613&routeid=30&type=text&contacts=$mobile&senderid=$sender&msg=".urlencode($message)."&template_id=$template_id&pe_id=1401337620000065797";

// SMS Templates
- OTP verification
- Loan approval
- Payment reminders
- Default notices
- Birthday wishes
- Limit enhancement notifications
```

### 6. Loan Management & Recovery

#### Account Manager Workflow
```php
// Daily follow-up process
1. View assigned customers
2. Check loan status and outstanding amounts
3. Contact customers via SMS/phone
4. Update customer responses
5. Set commitment dates
6. Escalate to recovery if needed
```

#### Recovery Process
```php
// Recovery workflow
1. Loans older than 65 days moved to recovery
2. Recovery officers handle default cases
3. Payment collection attempts
4. Legal action if required
5. CIBIL reporting for defaults
```

## API Endpoints

### Mobile API (`zzzzzapi`)
```php
// Base URL: https://creditlab.in/zzzzzapi

// Authentication
POST /zzzzzapi?call=Login
{
  "mobile": "9876543210",
  "otp": "1111",
  "platform": "Android",
  "userip": "192.168.1.1",
  "unique_id": "device_id",
  "lat": "28.6139",
  "long": "77.2090"
}

// Profile Update
POST /zzzzzapi?call=Profile_update
{
  "user_id": 123,
  "page": 1,
  "salary": 50000,
  "salarystatus": "Salaried",
  "get_salary": "Bank Transfer"
}

// Loan Application
POST /zzzzzapi?call=apply
{
  "user_id": 123,
  "amount": 25000,
  "days": 30,
  "reason": "Emergency"
}

// Document Upload
POST /zzzzzapi?call=document
{
  "user_id": 123,
  "pan_img": "file",
  "aadhar_img1": "file",
  "aadhar_img2": "file"
}

// Bank Details
POST /zzzzzapi?call=bank_details
{
  "user_id": 123,
  "ac_no": "1234567890",
  "ifsc_code": "HDFC0001234",
  "bank_name": "HDFC Bank"
}

// Dashboard Data
GET /zzzzzapi?call=dashboard&id=123
GET /zzzzzapi?call=dashboard2&id=123

// Agreement Acceptance
POST /zzzzzapi?call=agreement
{
  "user_id": 123,
  "loan_id": 456,
  "agreed": 1
}
```

## Security Features

### 1. Authentication
- OTP-based mobile verification
- Session management with cookies
- CSRF token protection
- Input sanitization with `towreal()` function

### 2. Data Protection
- SQL injection prevention
- XSS protection
- File upload validation
- Secure password hashing

### 3. Access Control
- Role-based access control
- Session timeout
- IP address tracking
- Device fingerprinting

## File Structure

```
creditlab/
├── account/                 # User authentication
│   ├── login.php           # Login page
│   ├── forget.php          # Password reset
│   └── confirm.php         # Email confirmation
├── user/                   # User dashboard
│   ├── index.php           # Main dashboard
│   ├── dashboard.php       # Loan dashboard
│   ├── document.php        # Document upload
│   ├── autopay.php         # Payment page
│   └── uploads/            # Document storage
├── admin/                  # Admin panel
│   ├── index.php           # Admin dashboard
│   ├── profile.php         # User management
│   ├── loan.php            # Loan management
│   └── users.php           # User listing
├── account_manager/        # Account manager panel
│   ├── index.php           # AM dashboard
│   ├── profile.php         # Customer management
│   └── sms.php             # SMS sending
├── recovery_officer/       # Recovery panel
│   ├── index.php           # Recovery dashboard
│   └── profile.php         # Default management
├── verify_user/            # Verification panel
│   ├── index.php           # Verification dashboard
│   └── verify_profile.php  # Document verification
├── payment/                # Payment processing
│   ├── easebuzz_payment.php
│   ├── auto_enach.php      # E-Nach processing
│   └── response.php        # Payment response
├── payeasebuzz/            # Easebuzz integration
│   ├── easebuzz.php        # Payment initiation
│   └── response.php        # Payment callback
├── lib/                    # Libraries
│   ├── s3_aws_sdk.php      # AWS S3 integration
│   └── uploads.php         # File upload helper
├── zzzzzapi                # Mobile API
├── send_sms.php            # SMS service
├── db.php                  # Database connection
└── config_s3.php           # S3 configuration
```

## Business Rules & Logic

### 1. Loan Eligibility
- Minimum salary: ₹25,000/month
- Age: 18+ years
- Employment: Salaried or Self-employed
- Credit score: 650+ (default for new users)

### 2. Loan Limits
- New users: 40% of monthly salary
- Repeat users: Based on payment history
- Maximum limit: ₹1,00,000

### 3. Interest & Charges
- Interest rate: 0.1% per day
- Processing fee: 5% of loan amount
- Origination fee: 7% for new users, 0% for repeat users
- Service charge: 0.1% per day after disbursal
- Penalty: 3% for overdue loans

### 4. Loan Tenure
- Minimum: 1 month
- Maximum: 1 year
- Flexible repayment based on salary date

### 5. Membership Tiers
- Silver (0): New users
- Gold (1): 1 successful loan
- Diamond (2): 2+ successful loans
- Platinum (3): 5+ successful loans
- Risky (4): Default cases

## Integration Points

### 1. AWS S3
- Document storage
- File upload/download
- CDN for static assets

### 2. Easebuzz Payment Gateway
- Payment processing
- E-Nach setup
- Webhook handling

### 3. SMS Gateway
- OTP delivery
- Payment reminders
- Status notifications

### 4. Email Service
- Application confirmations
- Document requests
- System notifications

## Reporting & Analytics

### 1. Admin Dashboard Metrics
- Total users
- New registrations
- Loan applications
- Disbursed loans
- Recovery cases
- Revenue tracking

### 2. Account Manager Reports
- Assigned customers
- Follow-up status
- Payment collections
- Customer responses

### 3. Recovery Reports
- Default cases
- Recovery amounts
- Collection efficiency
- Legal actions

## Migration Considerations for Node.js/React

### 1. Database Migration
- Convert MySQL to PostgreSQL/MongoDB
- Update data types and constraints
- Implement proper indexing

### 2. API Redesign
- RESTful API endpoints
- JWT authentication
- Rate limiting
- Input validation

### 3. File Storage
- Migrate from S3 to cloud storage
- Implement CDN
- File compression and optimization

### 4. Payment Integration
- Modern payment gateway integration
- Webhook security
- Payment retry logic

### 5. Security Enhancements
- OAuth 2.0 implementation
- API security best practices
- Data encryption
- Audit logging

### 6. Frontend Modernization
- React components
- State management (Redux/Zustand)
- Responsive design
- Progressive Web App features

## Technical Debt & Improvements

### 1. Code Quality
- Replace procedural PHP with OOP
- Implement design patterns
- Add unit tests
- Code documentation

### 2. Performance
- Database query optimization
- Caching implementation
- CDN integration
- Image optimization

### 3. Scalability
- Microservices architecture
- Load balancing
- Database sharding
- Caching layers

### 4. Monitoring
- Application monitoring
- Error tracking
- Performance metrics
- Business analytics

This documentation provides a comprehensive overview of the CreditLab application, covering all major aspects from database schema to business logic, which will be essential for recreating the system in Node.js and React.
