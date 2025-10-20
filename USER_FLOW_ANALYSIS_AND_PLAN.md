# User Flow Analysis & Implementation Plan

## Current vs Desired Flow Comparison

---

## PAGE 1: USER AUTHENTICATION

### **DESIRED FLOW:**
- OTP-based login/registration only
- User enters 10-digit mobile number
- System sends OTP via SMS
- User enters OTP on verification screen
- Upon successful validation → proceed to application
- Reference: Similar to creditlab application

### **CURRENT FLOW:**
- **Multiple authentication methods:**
  - Email + Password based login
  - Registration requires: email, phone, password, first_name, last_name, date_of_birth, gender
  - Mobile OTP verification exists but is secondary
- **Location:** `src/components/pages/AuthPageNew.tsx`
- **Backend:** `src/server/routes/auth.js` has `/verify-otp` endpoint

### **GAP ANALYSIS:**
❌ Current flow uses email/password as primary authentication  
❌ Registration form is too complex upfront  
✅ OTP infrastructure exists but not used as primary auth  
❌ No similarity to creditlab's simple OTP-only flow  

### **REQUIRED CHANGES:**
1. **Create new OTP-only authentication page** replacing AuthPageNew.tsx
   - Single input: 10-digit mobile number
   - Send OTP button
   - OTP verification screen (6-digit input)
   - Auto-login after OTP verification
   
2. **Backend modifications:**
   - Ensure `/send-otp` endpoint works properly
   - Ensure `/verify-otp` creates user with minimal data (just phone number)
   - Remove email/password requirement from initial registration

3. **Remove or hide:**
   - Email/password login forms
   - Complex registration forms with multiple fields

---

## PAGE 2: LOAN APPLICATION JOURNEY

---

### **STEP 1: WORK TYPE SELECTION**

#### **DESIRED FLOW:**
- Dropdown to select employment status:
  - **Salaried** → Proceed to Salaried Flow
  - **Student** → Proceed to Student Flow
  - **All others (Self-employed, Part-time, Freelancer, Home Maker, Retired, Don't have Job, Others)** → Hold application permanently

#### **CURRENT FLOW:**
- Located in: `ProfileCompletionPageSimple.tsx` (Step 2 - "What do you do?")
- Options available but no automatic hold logic for non-Salaried/Student types
- Flow branches exist but not properly enforced

#### **GAP ANALYSIS:**
⚠️ Work type selection exists but at wrong position (should be first)  
❌ No automatic hold for non-eligible employment types  
⚠️ Branching logic exists but incomplete  

#### **REQUIRED CHANGES:**
1. **Move work type selection to be the FIRST step** after authentication
2. **Add hold logic:**
   - If Self-employed, Part-time, Freelancer, Home Maker, Retired, Don't have Job, Others → Show message "Application on hold" and stop flow
3. **Only allow Salaried and Student to proceed**

---

### **SALARIED EMPLOYEE FLOW**

---

### **STEP 2.2.1: INCOME PAYMENT MODE**

#### **DESIRED FLOW:**
- Select how salary is received:
  - **Bank Transfer** → Proceed
  - **Cash** → Hold permanently
  - **Cheque** → Hold for 90 days

#### **CURRENT FLOW:**
- Partially exists in `ProfileCompletionPageSimple.tsx` as `payment_mode`
- Options: bank_transfer, cash, cheque
- No hold logic implemented

#### **GAP ANALYSIS:**
❌ No automatic hold logic for Cash (permanent)  
❌ No automatic hold logic for Cheque (90 days)  
⚠️ Field exists but enforcement missing  

#### **REQUIRED CHANGES:**
1. **Add hold logic:**
   - Cash → Permanent hold, show message, store in database
   - Cheque → 90-day hold, show message with date, store in database
   - Bank Transfer → Proceed to next step
2. **Create holds table** if doesn't exist:
   - user_id, hold_type, hold_reason, hold_until_date, created_at

---

### **STEP 2.2.2: GROSS MONTHLY INCOME**

#### **DESIRED FLOW:**
- Dropdown with income ranges:
  - ₹1,000 to ₹15,000
  - ₹15,000 to ₹25,000
  - ₹25,000 to ₹35,000
  - Above ₹35,000

#### **CURRENT FLOW:**
- Field exists as `monthly_salary` in ProfileCompletionPageSimple
- Currently free text input, not dropdown with ranges

#### **GAP ANALYSIS:**
❌ Not implemented as dropdown with specific ranges  
⚠️ Field exists but format is different  

#### **REQUIRED CHANGES:**
1. **Convert to dropdown** with exactly 4 options as specified
2. **Store selected range** (will be used later to determine max loan amount)

---

### **STEP 2.2.3: DATE OF BIRTH (DOB)**

#### **DESIRED FLOW:**
- User enters DOB
- **Age validation:**
  - If age > 45 years → Hold permanently
  - If age ≤ 45 years → Proceed

#### **CURRENT FLOW:**
- DOB field exists in basic profile (Step 1)
- No age validation against 45-year threshold

#### **GAP ANALYSIS:**
❌ No age validation logic  
❌ No automatic hold for age > 45  
⚠️ Field exists but validation missing  

#### **REQUIRED CHANGES:**
1. **Add age calculation function**
2. **Add validation:**
   - Calculate age from DOB
   - If > 45 years → Permanent hold with reason "Age exceeds limit"
   - If ≤ 45 years → Proceed
3. **Store hold reason** in database

---

### **STEP 2.2.4: MOBILE PRE-FILL & CREDIT CHECK**

#### **DESIRED FLOW:**
- **API Call:** Digitap API using mobile number
- **Endpoint:** `https://testapis.digitap.ai/mobiletoprefill`
- **Backend Logic:**
  - Store: age, email_id, all address objects, experian_score
- **Credit Score Check:**
  - If experian_score < 630 → Hold for 60 days (store reason)
  - If experian_score ≥ 630 OR null → Proceed
- **Frontend Journey:**
  - If API success → Pre-fill: Name, DOB, PAN, Gender
  - Show: "Is this information correct?" → Yes/No
  - If Yes → Proceed
  - If No → Manual PAN entry
  - If API fails/null → Manual PAN entry

#### **CURRENT FLOW:**
- **NO DIGITAP API integration exists**
- PAN entry is manual
- No credit score fetching from external API
- No pre-fill logic

#### **GAP ANALYSIS:**
❌ Digitap API integration doesn't exist  
❌ No credit score checking  
❌ No hold logic for low credit score  
❌ No pre-fill functionality  

#### **REQUIRED CHANGES:**
1. **Create new backend route:** `/api/digitap/prefill`
   - Accept mobile number
   - Call Digitap API: `https://testapis.digitap.ai/mobiletoprefill`
   - Store response in database (new table: `digitap_responses`)
   - Return data to frontend
   
2. **Frontend implementation:**
   - After DOB validation passes, auto-call Digitap API
   - Show loading spinner
   - If success:
     - Display pre-filled data (Name, DOB, PAN, Gender)
     - Show confirmation: "Is this information correct?"
     - Two buttons: Yes / No
   - If No or API fails:
     - Show manual PAN input field
     
3. **Credit score validation:**
   - Check experian_score from API response
   - If < 630 → 60-day hold
   - If ≥ 630 or null → Proceed
   
4. **Database changes:**
   - Create `digitap_responses` table
   - Add `experian_score` column to users table
   - Add hold record if score is low

---

### **STEP 2.2.5: PERSONAL DETAILS**

#### **DESIRED FLOW:**
- **Personal Email:**
  - User enters email
  - Send OTP to email for validation
- **Marital Status:**
  - Dropdown: Single, Married, Divorced, Widow
- **Salary Date:**
  - Select monthly salary credit date (1-31) from calendar
- **Official Email:**
  - User enters work email
  - Send OTP to email for validation

#### **CURRENT FLOW:**
- Email field exists but no OTP validation
- Marital status field exists
- No salary date field
- No official email field

#### **GAP ANALYSIS:**
❌ No email OTP validation  
✅ Marital status exists  
❌ No salary date field  
❌ No official email field  
❌ No distinction between personal and official email  

#### **REQUIRED CHANGES:**
1. **Add email OTP validation:**
   - Create backend endpoint: `/api/send-email-otp`
   - Create backend endpoint: `/api/verify-email-otp`
   - Frontend: Show OTP input after email entered
   - Verify before proceeding
   
2. **Add new fields:**
   - `salary_date` (1-31, dropdown or date picker showing days only)
   - `official_email` (with separate OTP validation)
   
3. **Database columns:**
   - Add `personal_email` (rename existing email)
   - Add `official_email`
   - Add `salary_date` (integer 1-31)
   - Add `personal_email_verified` (boolean)
   - Add `official_email_verified` (boolean)

---

### **STEP 2.2.6: LOAN DETAILS & APPLICATION**

#### **DESIRED FLOW:**
- **Reason for Loan:**
  - Dropdown with options from creditlab application
- **Loan Amount Display:**
  - Based on income selected in 2.2.2:
    - ₹1k-₹15k → ₹6,000
    - ₹15k-₹25k → ₹10,000
    - ₹25k-₹35k → ₹15,000
    - >₹35k → ₹50,000
  - **Display only, not editable**
- **Bank Account Linking:**
  - Initiate bank account linking process

#### **CURRENT FLOW:**
- Loan purpose field exists with generic options
- Loan amount is user-input (editable)
- Bank details page exists but separate

#### **GAP ANALYSIS:**
❌ Loan amount is editable (should be auto-calculated and display-only)  
❌ No automatic calculation based on income range  
⚠️ Loan purpose exists but options may differ  
⚠️ Bank linking exists but at wrong position  

#### **REQUIRED CHANGES:**
1. **Loan amount calculation logic:**
   - Based on income_range selected:
     - "₹1,000 to ₹15,000" → Show ₹6,000 (not editable)
     - "₹15,000 to ₹25,000" → Show ₹10,000
     - "₹25,000 to ₹35,000" → Show ₹15,000
     - "Above ₹35,000" → Show ₹50,000
   - Store as `eligible_loan_amount`
   
2. **Update loan purpose dropdown:**
   - Research creditlab application's loan purpose options
   - Update dropdown to match
   
3. **Move bank account linking** to this step
   - Currently it's in separate page, integrate here

---

### **STEP 2.2.7: KYC VERIFICATION**

#### **DESIRED FLOW:**
- **Primary Method:** Digilocker
  - User enters mobile number linked to Aadhaar
  - Complete Digilocker authentication flow
  - Fetch and store KYC response and documents in admin panel
- **Fallback Logic:**
  - If Digilocker fails → Allow retry up to 2 times
  - If fails 3rd time → Show "Continue to next step" button

#### **CURRENT FLOW:**
- No Digilocker integration exists
- Manual document upload for KYC
- No retry logic

#### **GAP ANALYSIS:**
❌ No Digilocker integration  
❌ No mobile-based Aadhaar verification  
❌ No retry logic  
❌ Using manual upload instead of API  

#### **REQUIRED CHANGES:**
1. **Digilocker API integration:**
   - Research and integrate Digilocker API
   - Create backend endpoint: `/api/digilocker/initiate`
   - Create backend endpoint: `/api/digilocker/callback`
   - Store documents and response in database
   
2. **Retry logic:**
   - Track number of attempts (max 3)
   - Show retry button if fails
   - After 3 failures, show "Continue anyway" button
   
3. **Database:**
   - Create `digilocker_kyc` table
   - Store: user_id, attempt_number, status, response_data, documents, created_at
   
4. **Frontend:**
   - Create Digilocker flow component
   - Mobile number input (linked to Aadhaar)
   - Redirect to Digilocker
   - Handle callback
   - Show retry/continue buttons based on status

---

### **STEP 2.2.8: EMPLOYMENT DETAILS**

#### **DESIRED FLOW:**
- **Company Name:** Type or select from pre-populated list
- **Industry:** Dropdown (specific list provided)
- **Department:** Dropdown (specific list provided)
- **Designation:** Dropdown (specific list provided)

**Dropdown Lists:**

**Industry:** IT/Software, Health care, Education, E-commerce, Hospitality, Automotive, Food service, Manufacturing, Transport/Logistics, Banking/Finance, Construction, Farming/Agriculture, Medical/Pharmacy, Textiles, Entertainment, Others

**Department:** Administration, Business Development, Client Relations, Customer Support, Data Analytics, Engineering/Software, Executive/Management, Finance & Accounts, Human Resources (HR), IT, Internal Audit/Risk, Legal & Compliance, Logistics & Warehouse, Marketing, Office Administration, Operations, Procurement/Purchase, Product Management, Production, Project Management, Quality Control, Research & Development, Sales, Security & Housekeeping, Strategy & Planning, Supply Chain, Transport/Fleet, Others

**Designation:** Executive level 1, Executive level 2, Team Leader, Manager, Senior Manager, CEO/Director/VP, CBO/CFO/CS, Authorised signatory, Others

#### **CURRENT FLOW:**
- Partial employment details exist
- Company name is free text
- No comprehensive industry/department/designation lists
- Located in ProfileCompletionPageSimple (various steps)

#### **GAP ANALYSIS:**
⚠️ Employment fields exist but incomplete  
❌ Industry dropdown doesn't match specified list  
❌ Department dropdown doesn't exist or is incomplete  
❌ Designation dropdown doesn't match specified list  

#### **REQUIRED CHANGES:**
1. **Update dropdown options** to exactly match specified lists
2. **Add company name autocomplete** with pre-populated companies
3. **Ensure all three dropdowns are mandatory**
4. **Update database schema** if needed to accommodate these fields

---

### **STUDENT FLOW**

---

### **STEP 2.3.1: DATE OF BIRTH (DOB)**

#### **DESIRED FLOW:**
- User enters DOB
- **Age validation:**
  - If age < 19 years → Hold application with message "You can proceed once you turn 19"
  - If age ≥ 19 years → Proceed

#### **CURRENT FLOW:**
- DOB exists in basic profile
- No specific age validation for students

#### **GAP ANALYSIS:**
❌ No minimum age validation for students  
❌ No hold logic for under-19 students  

#### **REQUIRED CHANGES:**
1. **Add student-specific age validation:**
   - If employment_type === "Student":
     - Calculate age
     - If < 19 → Hold with message and future date
     - If ≥ 19 → Proceed
2. **Store hold** with release date (19th birthday)

---

### **STEP 2.3.2: EDUCATION DETAILS**

#### **DESIRED FLOW:**
- **College Name:** Free text input
- **Document Upload:**
  - College ID card (Front & Back images)
  - Marks Memo / latest educational memo / certificate

#### **CURRENT FLOW:**
- Some student fields exist in ProfileCompletionPageSimple
- Document upload exists but not specific to students

#### **GAP ANALYSIS:**
❌ No specific student document upload section  
❌ No college ID card upload (front & back)  
⚠️ Generic document upload exists  

#### **REQUIRED CHANGES:**
1. **Add student-specific document uploads:**
   - College ID Card (Front)
   - College ID Card (Back)
   - Marks Memo / Educational Certificate
   
2. **Update document upload page** to handle student-specific documents
3. **Store document types** properly in database

---

### **STEP 2.3.3: STUDENT DASHBOARD & NEXT STEPS**

#### **DESIRED FLOW:**
- Upon submission → Student-specific dashboard
- **Primary Action:** Show repayment screen for active loans
- **Upsell Opportunity:**
  - Prompt: "Are you graduated? If yes, Apply for a higher loan limit."
  - "Apply Now" button
- **Market Research Note:** Review Mpokket app for feature enhancements

#### **CURRENT FLOW:**
- Generic dashboard for all users
- No student-specific dashboard
- No graduation status check
- No upsell prompt

#### **GAP ANALYSIS:**
❌ No student-specific dashboard  
❌ No graduation status tracking  
❌ No upsell functionality for graduated students  
❌ No higher limit offer logic  

#### **REQUIRED CHANGES:**
1. **Create student-specific dashboard component:**
   - Check if user.employment_type === "Student"
   - Show different layout/options
   
2. **Add graduation status:**
   - Add `graduation_status` field (enum: 'not_graduated', 'graduated')
   - Add `graduation_date` field
   
3. **Add upsell prompt:**
   - If student dashboard AND graduation_status === 'not_graduated':
     - Show card: "Are you graduated? Apply for higher limit"
     - Button: "Apply Now" → Update status to graduated → Increase limit
     
4. **Loan limit logic:**
   - Students (not graduated): Lower limit (e.g., ₹10,000)
   - Students (graduated): Higher limit (e.g., ₹25,000)
   
5. **Research Mpokket:** Study their student flow and features

---

## SUMMARY OF ALL REQUIRED CHANGES

### **HIGH PRIORITY (Core Flow Changes):**

1. ✅ **Create OTP-only authentication** (replace email/password)
2. ✅ **Move work type selection to first step**
3. ✅ **Add hold logic** for non-eligible employment types
4. ✅ **Add income payment mode hold logic** (Cash/Cheque)
5. ✅ **Add age validation** (>45 for salaried, <19 for students)
6. ✅ **Digitap API integration** for pre-fill and credit score
7. ✅ **Email OTP validation** (personal and official)
8. ✅ **Auto-calculate loan amount** based on income (non-editable)
9. ✅ **Digilocker KYC integration** with retry logic
10. ✅ **Update employment dropdowns** to match exact lists

### **MEDIUM PRIORITY (Enhanced Features):**

11. ⚠️ Add salary date field
12. ⚠️ Add student-specific document uploads
13. ⚠️ Create student-specific dashboard
14. ⚠️ Add graduation status and upsell logic
15. ⚠️ Update loan purpose dropdown
16. ⚠️ Move bank linking to proper position in flow

### **LOW PRIORITY (Nice to Have):**

17. 📝 Research and replicate creditlab UX
18. 📝 Research Mpokket student features
19. 📝 Add company name autocomplete
20. 📝 Improve error messages and user guidance

---

## DATABASE SCHEMA CHANGES REQUIRED

### **New Tables:**

```sql
-- Holds table
CREATE TABLE application_holds (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  hold_type VARCHAR(50), -- 'permanent', 'temporary'
  hold_reason VARCHAR(255),
  hold_until_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  released_at TIMESTAMP
);

-- Digitap responses table
CREATE TABLE digitap_responses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  mobile_number VARCHAR(20),
  age INTEGER,
  email_id VARCHAR(255),
  address_data JSONB,
  experian_score INTEGER,
  full_response JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Digilocker KYC table
CREATE TABLE digilocker_kyc (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  attempt_number INTEGER DEFAULT 1,
  status VARCHAR(50), -- 'pending', 'success', 'failed'
  aadhaar_mobile VARCHAR(20),
  response_data JSONB,
  documents JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Email OTP table
CREATE TABLE email_otps (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  email VARCHAR(255),
  otp VARCHAR(6),
  email_type VARCHAR(50), -- 'personal', 'official'
  purpose VARCHAR(50),
  verified BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### **Column Additions to users table:**

```sql
ALTER TABLE users
ADD COLUMN income_range VARCHAR(50),
ADD COLUMN payment_mode VARCHAR(50),
ADD COLUMN salary_date INTEGER, -- 1-31
ADD COLUMN personal_email VARCHAR(255),
ADD COLUMN official_email VARCHAR(255),
ADD COLUMN personal_email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN official_email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN experian_score INTEGER,
ADD COLUMN eligible_loan_amount DECIMAL(10,2),
ADD COLUMN graduation_status VARCHAR(50), -- 'not_graduated', 'graduated'
ADD COLUMN graduation_date DATE,
ADD COLUMN digitap_prefill_done BOOLEAN DEFAULT FALSE,
ADD COLUMN digilocker_kyc_attempts INTEGER DEFAULT 0,
ADD COLUMN digilocker_kyc_status VARCHAR(50);
```

---

## FRONTEND COMPONENT STRUCTURE CHANGES

### **New Components to Create:**

1. `OTPAuthenticationPage.tsx` - Simple OTP-only auth
2. `WorkTypeSelectionPage.tsx` - First step after auth
3. `SalariedApplicationFlow.tsx` - Complete salaried flow
4. `StudentApplicationFlow.tsx` - Complete student flow
5. `DigitapPrefillComponent.tsx` - Handle Digitap API
6. `EmailOTPVerification.tsx` - Email OTP component
7. `DigilockerKYCComponent.tsx` - Digilocker integration
8. `StudentDashboard.tsx` - Student-specific dashboard
9. `ApplicationHoldPage.tsx` - Show hold messages

### **Components to Modify:**

1. `AuthPageNew.tsx` - Replace or remove
2. `ProfileCompletionPageSimple.tsx` - Restructure completely
3. `SimplifiedLoanApplicationPage.tsx` - Update loan amount logic
4. `DynamicDashboardPage.tsx` - Add student dashboard routing
5. `App.tsx` - Update routing for new flow

### **Backend Routes to Create/Modify:**

**New Routes:**
- `POST /api/digitap/prefill` - Digitap API integration
- `POST /api/send-email-otp` - Send email OTP
- `POST /api/verify-email-otp` - Verify email OTP
- `POST /api/digilocker/initiate` - Start Digilocker flow
- `GET /api/digilocker/callback` - Digilocker callback
- `POST /api/applications/hold` - Create application hold
- `GET /api/applications/hold-status` - Check hold status
- `POST /api/students/update-graduation` - Update graduation status

**Routes to Modify:**
- `/api/auth/verify-otp` - Should be primary auth method
- `/api/profile/complete` - Update to handle new flow
- `/api/loans/eligible-amount` - Calculate based on income
- `/api/loans/apply` - Update validation logic

---

## IMPLEMENTATION SEQUENCE (Recommended Order)

### **Phase 1: Authentication & Initial Flow (Week 1)**
1. Create OTP-only authentication
2. Create work type selection as first step
3. Add basic hold logic for non-eligible types
4. Update routing and navigation

### **Phase 2: Salaried Flow - Core Validations (Week 2)**
5. Add payment mode with hold logic
6. Add income range dropdown
7. Add age validation with holds
8. Add email OTP validation

### **Phase 3: External API Integrations (Week 3)**
9. Integrate Digitap API
10. Add credit score checking
11. Implement pre-fill logic
12. Integrate Digilocker KYC

### **Phase 4: Loan Amount & Employment (Week 4)**
13. Auto-calculate loan amount
14. Update employment dropdowns
15. Add salary date field
16. Update loan purpose options

### **Phase 5: Student Flow (Week 5)**
17. Add student-specific age validation
18. Add student document uploads
19. Create student dashboard
20. Add graduation status and upsell

### **Phase 6: Testing & Refinement (Week 6)**
21. End-to-end testing
22. Bug fixes
23. UX improvements
24. Documentation

---

## THIRD-PARTY SERVICES NEEDED

1. **SMS Gateway** (for OTP) - Currently mock
   - Options: Twilio, MSG91, Exotel
   
2. **Email Service** (for email OTPs)
   - Options: SendGrid, AWS SES, Mailgun
   
3. **Digitap API** - Credit bureau and pre-fill
   - Endpoint: `https://testapis.digitap.ai/mobiletoprefill`
   - Need API key and documentation
   
4. **Digilocker API** - KYC verification
   - Need to register as Service Provider
   - Get Client ID and Client Secret
   
5. **Bank Verification API** (optional)
   - For bank account verification

---

## RISK & CONSIDERATIONS

### **Technical Risks:**
- Digitap API reliability and response time
- Digilocker integration complexity
- SMS delivery success rate
- Email deliverability

### **UX Risks:**
- Simplified OTP-only auth may lack password recovery
- Too many holds may frustrate users
- External API failures may block users

### **Business Risks:**
- Strict eligibility may reduce conversion
- 60-day/90-day holds may lose customers
- Student flow may need more flexibility

### **Mitigation Strategies:**
- Add fallback options for API failures
- Clear communication for holds
- Allow manual override for edge cases
- Comprehensive error handling and logging

---

## TESTING CHECKLIST

### **Authentication:**
- [ ] OTP sent successfully to mobile
- [ ] OTP verification works
- [ ] Invalid OTP rejected
- [ ] OTP expiry working
- [ ] User created after OTP verification

### **Work Type Selection:**
- [ ] All work types displayed
- [ ] Salaried → Salaried flow
- [ ] Student → Student flow
- [ ] Other types → Hold message
- [ ] Hold stored in database

### **Salaried Flow:**
- [ ] Payment mode validation
- [ ] Cash → Permanent hold
- [ ] Cheque → 90-day hold
- [ ] Bank Transfer → Proceed
- [ ] Income range dropdown
- [ ] Age validation (>45 hold)
- [ ] Digitap API called
- [ ] Pre-fill working
- [ ] Credit score checked
- [ ] Score <630 → 60-day hold
- [ ] Email OTP sent and verified
- [ ] Loan amount auto-calculated
- [ ] Digilocker integration
- [ ] Employment dropdowns updated

### **Student Flow:**
- [ ] Age validation (<19 hold)
- [ ] College name input
- [ ] Document uploads working
- [ ] Student dashboard displayed
- [ ] Graduation status update
- [ ] Upsell prompt shown
- [ ] Limit increase after graduation

---

## QUESTIONS FOR CLARIFICATION

1. **Digitap API:**
   - Do we have API credentials?
   - What's the rate limit?
   - What's the cost per call?
   
2. **Digilocker:**
   - Are we registered as Service Provider?
   - Do we have test credentials?
   
3. **Loan Amounts:**
   - Are the amounts fixed or can they vary?
   - Is there any flexibility based on credit score?
   
4. **Holds:**
   - Can admin manually release holds?
   - Should users be notified when hold expires?
   
5. **Student Limits:**
   - What are exact limits for students?
   - What's the difference between graduated and non-graduated?
   
6. **Creditlab Reference:**
   - Do we have access to their app for testing?
   - Any specific features to replicate?

---

## CONCLUSION

This is a **major overhaul** of the current user flow. The current system is more complex and traditional (email/password), while the desired flow is modern, OTP-based, and heavily automated with external APIs.

**Estimated Effort:** 6-8 weeks for complete implementation  
**Priority:** Start with Phase 1 (Authentication) as it affects all subsequent flows  
**Dependencies:** External API credentials (Digitap, Digilocker)

Once you approve this plan, we can start implementing phase by phase. I recommend beginning with Phase 1 to establish the new authentication flow, then proceeding sequentially through the phases.

