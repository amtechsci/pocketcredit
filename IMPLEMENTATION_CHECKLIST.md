# Implementation Checklist

## 📋 Pre-Implementation Requirements

### External Services & Credentials
- [ ] Obtain Digitap API credentials
  - [ ] API Key
  - [ ] API Documentation
  - [ ] Test endpoint access
- [ ] Obtain Digilocker credentials
  - [ ] Register as Service Provider
  - [ ] Get Client ID
  - [ ] Get Client Secret
  - [ ] Test environment setup
- [ ] Select and setup SMS Gateway
  - [ ] Choose provider (Twilio/MSG91/Exotel)
  - [ ] Get API credentials
  - [ ] Test SMS sending
- [ ] Select and setup Email Service
  - [ ] Choose provider (SendGrid/AWS SES/Mailgun)
  - [ ] Get API credentials
  - [ ] Test email sending
  - [ ] Setup email templates

### Database Preparation
- [ ] Backup current database
- [ ] Create new tables
  - [ ] application_holds
  - [ ] digitap_responses
  - [ ] digilocker_kyc
  - [ ] email_otps
- [ ] Add new columns to users table
  - [ ] income_range
  - [ ] payment_mode
  - [ ] salary_date
  - [ ] personal_email
  - [ ] official_email
  - [ ] experian_score
  - [ ] eligible_loan_amount
  - [ ] graduation_status
  - [ ] And 7 more... (see full list in plan)
- [ ] Create indexes for performance
- [ ] Test database changes in staging

---

## 🚀 Phase 1: OTP Authentication (Week 1)

### Backend - Auth Routes
- [ ] Modify `/api/auth/send-otp` endpoint
  - [ ] Accept 10-digit mobile number
  - [ ] Validate Indian mobile format (6-9 as first digit)
  - [ ] Generate 6-digit OTP
  - [ ] Store in database with expiry (10 minutes)
  - [ ] Send via SMS gateway
  - [ ] Return success response
- [ ] Modify `/api/auth/verify-otp` endpoint
  - [ ] Verify OTP against database
  - [ ] Check expiry
  - [ ] Create user if doesn't exist (minimal data)
  - [ ] Generate JWT token
  - [ ] Return user data + token
- [ ] Test OTP flow end-to-end
- [ ] Add rate limiting (max 3 OTPs per mobile per hour)
- [ ] Add OTP resend functionality

### Frontend - OTP Auth Component
- [ ] Create `OTPAuthenticationPage.tsx`
  - [ ] Mobile number input (10 digits)
  - [ ] Input validation
  - [ ] "Send OTP" button
  - [ ] OTP input screen (6 boxes)
  - [ ] "Verify OTP" button
  - [ ] "Resend OTP" option (after 30 seconds)
  - [ ] Loading states
  - [ ] Error handling
  - [ ] Auto-navigate after successful verification
- [ ] Style to match modern OTP UIs
- [ ] Add keyboard support (auto-move between OTP boxes)
- [ ] Test on mobile devices

### Routing Updates
- [ ] Update `App.tsx` routes
  - [ ] Set OTPAuthenticationPage as default auth
  - [ ] Remove/hide old email/password route
  - [ ] Update protected route logic
- [ ] Test routing flow
- [ ] Update navigation guards

### Context Updates
- [ ] Update `AuthContext.tsx`
  - [ ] Add `sendOTP` function
  - [ ] Add `verifyOTP` function
  - [ ] Update user state management
  - [ ] Handle OTP-based authentication
- [ ] Test context functions

### Testing & QA
- [ ] Unit tests for OTP generation
- [ ] Integration tests for OTP flow
- [ ] E2E tests for authentication
- [ ] Test error scenarios
- [ ] Test rate limiting
- [ ] Test OTP expiry

---

## ⚡ Phase 2: Work Type Selection & Hold Logic (Week 2)

### Backend - Hold System
- [ ] Create `/api/applications/hold` endpoint
  - [ ] Accept: user_id, hold_type, hold_reason, hold_until
  - [ ] Store in application_holds table
  - [ ] Return hold details
- [ ] Create `/api/applications/hold-status` endpoint
  - [ ] Check if user has active holds
  - [ ] Return hold details if exists
  - [ ] Calculate remaining time for temporary holds
- [ ] Create hold checking middleware
  - [ ] Check holds before allowing loan application
  - [ ] Auto-release expired holds
- [ ] Test hold system

### Frontend - Work Type Selection
- [ ] Create `WorkTypeSelectionPage.tsx`
  - [ ] Dropdown with all work types
  - [ ] Validation
  - [ ] Submit button
  - [ ] Hold message display for non-eligible types
- [ ] Add hold logic
  - [ ] If Self-employed → Show permanent hold message
  - [ ] If Part-time → Show permanent hold message
  - [ ] If Freelancer → Show permanent hold message
  - [ ] If Home Maker → Show permanent hold message
  - [ ] If Retired → Show permanent hold message
  - [ ] If No Job → Show permanent hold message
  - [ ] If Others → Show permanent hold message
  - [ ] If Salaried → Route to salaried flow
  - [ ] If Student → Route to student flow
- [ ] Create `ApplicationHoldPage.tsx`
  - [ ] Display hold type
  - [ ] Display hold reason
  - [ ] Display release date (if temporary)
  - [ ] Display support contact
- [ ] Update routing

### Payment Mode Hold Logic
- [ ] Add payment mode selection
  - [ ] Bank Transfer option
  - [ ] Cash option
  - [ ] Cheque option
- [ ] Implement hold logic
  - [ ] Cash → Create permanent hold
  - [ ] Cheque → Create 90-day hold
  - [ ] Bank Transfer → Proceed
- [ ] Test all scenarios

### Age Validation Hold Logic
- [ ] Create age calculation utility function
- [ ] Add age validation for Salaried
  - [ ] Calculate age from DOB
  - [ ] If > 45 → Create permanent hold
  - [ ] If ≤ 45 → Proceed
- [ ] Add age validation for Student
  - [ ] Calculate age from DOB
  - [ ] If < 19 → Create hold until 19th birthday
  - [ ] If ≥ 19 → Proceed
- [ ] Test age calculations and holds

### Database & State Management
- [ ] Update user profile with work type
- [ ] Store payment mode
- [ ] Store hold records
- [ ] Test data persistence

### Testing & QA
- [ ] Test all work type options
- [ ] Test hold creation and retrieval
- [ ] Test payment mode scenarios
- [ ] Test age validation scenarios
- [ ] Test hold expiry logic
- [ ] E2E test complete flow from auth to hold

---

## 🔌 Phase 3: External API Integrations (Week 3)

### Digitap API Integration
- [ ] Create backend service: `digitapService.js`
  - [ ] API client setup
  - [ ] Authentication handling
  - [ ] Error handling
- [ ] Create `/api/digitap/prefill` endpoint
  - [ ] Accept mobile number
  - [ ] Call Digitap API
  - [ ] Parse response
  - [ ] Store in digitap_responses table
  - [ ] Extract: age, email, address, experian_score
  - [ ] Return to frontend
- [ ] Handle API failures gracefully
- [ ] Add retry logic (max 3 attempts)
- [ ] Test with various mobile numbers

### Credit Score Checking
- [ ] Parse experian_score from Digitap response
- [ ] Implement credit score logic
  - [ ] If score < 630 → Create 60-day hold
  - [ ] If score ≥ 630 → Proceed
  - [ ] If score is null → Proceed (give benefit of doubt)
- [ ] Store score in users table
- [ ] Test all credit score scenarios

### Frontend - Digitap Integration
- [ ] Create `DigitapPrefillComponent.tsx`
  - [ ] Auto-trigger after DOB validation passes
  - [ ] Show loading state during API call
  - [ ] Display pre-filled data if successful
  - [ ] Confirmation UI: "Is this information correct?"
  - [ ] Yes button → Proceed
  - [ ] No button → Show manual PAN entry
  - [ ] Handle API failure → Show manual PAN entry
- [ ] Pre-fill form fields
  - [ ] Name
  - [ ] DOB
  - [ ] PAN
  - [ ] Gender
- [ ] Test UI flow

### Digilocker API Integration
- [ ] Create backend service: `digilockerService.js`
  - [ ] OAuth client setup
  - [ ] API methods
  - [ ] Document handling
- [ ] Create `/api/digilocker/initiate` endpoint
  - [ ] Accept user_id and aadhaar mobile
  - [ ] Generate OAuth URL
  - [ ] Store attempt in database
  - [ ] Return OAuth URL
- [ ] Create `/api/digilocker/callback` endpoint
  - [ ] Handle OAuth callback
  - [ ] Exchange code for token
  - [ ] Fetch Aadhaar details
  - [ ] Download documents
  - [ ] Store in database
  - [ ] Update user KYC status
- [ ] Test OAuth flow

### Frontend - Digilocker Component
- [ ] Create `DigilockerKYCComponent.tsx`
  - [ ] Mobile number input (Aadhaar-linked)
  - [ ] "Start Verification" button
  - [ ] Redirect to Digilocker
  - [ ] Handle callback
  - [ ] Show success/failure
  - [ ] Retry button (max 3 attempts)
  - [ ] "Continue anyway" after 3 failures
  - [ ] Display fetched documents
- [ ] Track attempt count
- [ ] Test retry logic
- [ ] Test skip option

### Error Handling & Fallbacks
- [ ] Digitap API failure scenarios
  - [ ] Network error
  - [ ] Invalid response
  - [ ] Timeout
  - [ ] Rate limit
- [ ] Digilocker API failure scenarios
  - [ ] User cancels
  - [ ] Invalid mobile
  - [ ] Server error
- [ ] User-friendly error messages
- [ ] Logging for debugging

### Testing & QA
- [ ] Mock API responses for testing
- [ ] Test successful API calls
- [ ] Test API failures
- [ ] Test retry mechanisms
- [ ] Test data storage
- [ ] Test pre-fill functionality
- [ ] E2E test with real APIs (if possible)

---

## 💰 Phase 4: Loan Amount & Employment Details (Week 4)

### Income Range & Loan Amount
- [ ] Create income range dropdown
  - [ ] "₹1,000 to ₹15,000"
  - [ ] "₹15,000 to ₹25,000"
  - [ ] "₹25,000 to ₹35,000"
  - [ ] "Above ₹35,000"
- [ ] Implement loan amount calculation logic
  - [ ] ₹1k-₹15k → ₹6,000
  - [ ] ₹15k-₹25k → ₹10,000
  - [ ] ₹25k-₹35k → ₹15,000
  - [ ] >₹35k → ₹50,000
- [ ] Display calculated amount (non-editable)
- [ ] Store both income_range and eligible_loan_amount
- [ ] Test calculation logic

### Email OTP Validation
- [ ] Backend - Create email OTP service
  - [ ] Create `/api/send-email-otp` endpoint
  - [ ] Create `/api/verify-email-otp` endpoint
  - [ ] Generate 6-digit OTP
  - [ ] Store in email_otps table
  - [ ] Send via email service
  - [ ] Verify OTP
- [ ] Frontend - Create EmailOTPVerification component
  - [ ] Email input
  - [ ] Send OTP button
  - [ ] OTP input (6 digits)
  - [ ] Verify button
  - [ ] Resend option
  - [ ] Loading states
- [ ] Implement for personal email
- [ ] Implement for official email
- [ ] Test email delivery
- [ ] Test verification flow

### Personal Details Section
- [ ] Personal email with OTP validation
- [ ] Marital status dropdown
  - [ ] Single
  - [ ] Married
  - [ ] Divorced
  - [ ] Widow
- [ ] Salary date picker (1-31)
- [ ] Official email with OTP validation
- [ ] Form validation
- [ ] Store all fields in database
- [ ] Test form submission

### Employment Details Dropdowns
- [ ] Update Industry dropdown with exact list
  - [ ] IT/Software
  - [ ] Health care
  - [ ] Education
  - [ ] E-commerce
  - [ ] (15 total options - see plan)
- [ ] Update Department dropdown with exact list
  - [ ] Administration
  - [ ] Business Development
  - [ ] Client Relations
  - [ ] (27 total options - see plan)
- [ ] Update Designation dropdown with exact list
  - [ ] Executive level 1
  - [ ] Executive level 2
  - [ ] Team Leader
  - [ ] (9 total options - see plan)
- [ ] Company name input with autocomplete
- [ ] Make all fields mandatory
- [ ] Test dropdowns

### Loan Purpose Update
- [ ] Research creditlab loan purposes
- [ ] Update loan purpose dropdown
- [ ] Store selected purpose
- [ ] Test selection

### Testing & QA
- [ ] Test income range selection
- [ ] Test loan amount calculation
- [ ] Test email OTP flow (both emails)
- [ ] Test all dropdowns
- [ ] Test form validation
- [ ] Test data persistence
- [ ] E2E test complete salaried flow

---

## 🎓 Phase 5: Student Flow (Week 5)

### Student Age Validation
- [ ] Implement student-specific age check
  - [ ] Calculate age from DOB
  - [ ] If < 19 → Create hold with 19th birthday as release date
  - [ ] If ≥ 19 → Proceed
- [ ] Display age-appropriate message
- [ ] Test age validation

### Student Education Details
- [ ] College name input field
- [ ] Document upload section
  - [ ] College ID Card (Front)
  - [ ] College ID Card (Back)
  - [ ] Marks Memo / Educational Certificate
- [ ] File validation
  - [ ] File type (image/PDF)
  - [ ] File size limit
- [ ] Upload to server
- [ ] Store document references
- [ ] Test uploads

### Student Dashboard
- [ ] Create `StudentDashboard.tsx`
  - [ ] Different layout than regular dashboard
  - [ ] Show active loans (if any)
  - [ ] Repayment screen
  - [ ] Graduation status check
- [ ] Add graduation status field
  - [ ] not_graduated (default)
  - [ ] graduated
- [ ] Upsell prompt component
  - [ ] "Are you graduated? If yes, Apply for higher loan limit"
  - [ ] "Apply Now" button
  - [ ] Only show if not_graduated
- [ ] Test dashboard display

### Graduation Status & Upsell
- [ ] Create `/api/students/update-graduation` endpoint
  - [ ] Update graduation_status to 'graduated'
  - [ ] Update graduation_date
  - [ ] Increase loan limit
- [ ] Frontend - Graduation update flow
  - [ ] Confirmation dialog
  - [ ] Update status
  - [ ] Show success message
  - [ ] Refresh dashboard
- [ ] Loan limit logic for students
  - [ ] Not graduated: Lower limit (₹10,000)
  - [ ] Graduated: Higher limit (₹25,000)
- [ ] Test graduation update
- [ ] Test limit increase

### Student-Specific Validations
- [ ] Ensure student flow is separate from salaried
- [ ] Skip employment-related fields for students
- [ ] Different document requirements
- [ ] Test complete student flow

### Mpokket Research
- [ ] Download and test Mpokket app
- [ ] Document their student flow
- [ ] Identify unique features
- [ ] Consider implementing similar features
- [ ] Document findings

### Testing & QA
- [ ] Test student age validation
- [ ] Test document uploads
- [ ] Test student dashboard
- [ ] Test graduation status update
- [ ] Test loan limit changes
- [ ] E2E test complete student flow

---

## ✅ Phase 6: Testing & Refinement (Week 6)

### Comprehensive Testing
- [ ] End-to-end testing
  - [ ] Complete salaried flow (happy path)
  - [ ] Complete student flow (happy path)
  - [ ] All hold scenarios
  - [ ] All error scenarios
- [ ] Cross-browser testing
  - [ ] Chrome
  - [ ] Firefox
  - [ ] Safari
  - [ ] Edge
- [ ] Mobile responsiveness
  - [ ] iOS Safari
  - [ ] Android Chrome
  - [ ] Various screen sizes
- [ ] Performance testing
  - [ ] Page load times
  - [ ] API response times
  - [ ] Large file uploads
- [ ] Security testing
  - [ ] OTP brute force protection
  - [ ] SQL injection tests
  - [ ] XSS tests
  - [ ] API rate limiting

### Bug Fixes
- [ ] Create bug tracking sheet
- [ ] Prioritize bugs (Critical/High/Medium/Low)
- [ ] Fix critical bugs
- [ ] Fix high priority bugs
- [ ] Fix medium priority bugs
- [ ] Retest after fixes

### UX Improvements
- [ ] Review all error messages
- [ ] Improve loading states
- [ ] Add helpful tooltips
- [ ] Improve form validation messages
- [ ] Add progress indicators
- [ ] Optimize mobile UX
- [ ] Add accessibility features (ARIA labels, keyboard nav)

### Documentation
- [ ] API documentation
  - [ ] All endpoints
  - [ ] Request/response formats
  - [ ] Error codes
- [ ] Developer documentation
  - [ ] Setup instructions
  - [ ] Environment variables
  - [ ] Database schema
- [ ] User flow documentation
  - [ ] Flowcharts
  - [ ] Screenshots
- [ ] Admin documentation
  - [ ] How to manage holds
  - [ ] How to check API logs
  - [ ] How to override decisions

### Deployment Preparation
- [ ] Environment variables setup
  - [ ] Production API keys
  - [ ] SMS gateway credentials
  - [ ] Email service credentials
  - [ ] Digitap API keys
  - [ ] Digilocker credentials
- [ ] Database migration scripts
- [ ] Backup procedures
- [ ] Rollback plan
- [ ] Monitoring setup
  - [ ] Error logging
  - [ ] API monitoring
  - [ ] SMS delivery tracking
  - [ ] Email delivery tracking

### Final QA
- [ ] Stakeholder review
- [ ] Final user acceptance testing
- [ ] Performance verification
- [ ] Security audit
- [ ] Accessibility audit
- [ ] Legal/compliance review

---

## 🚀 Post-Implementation

### Deployment
- [ ] Deploy to staging
- [ ] Staging testing
- [ ] Fix any staging issues
- [ ] Deploy to production
- [ ] Smoke test production
- [ ] Monitor for errors

### Monitoring
- [ ] Set up alerts for errors
- [ ] Monitor API success rates
- [ ] Monitor SMS delivery rates
- [ ] Monitor email delivery rates
- [ ] Track user drop-off points
- [ ] Monitor application completion rates

### Analytics
- [ ] Track authentication success rate
- [ ] Track hold rates by type
- [ ] Track Digitap API success rate
- [ ] Track Digilocker success rate
- [ ] Track loan approval rates
- [ ] Track student vs salaried conversion

### Optimization
- [ ] Review analytics
- [ ] Identify bottlenecks
- [ ] Optimize slow API calls
- [ ] Improve conversion rates
- [ ] A/B test variations
- [ ] Iterate based on data

### Support
- [ ] Create support documentation
- [ ] Train support team
- [ ] Create FAQ
- [ ] Set up support ticket system
- [ ] Monitor support tickets
- [ ] Address common issues

---

## 📊 Success Metrics

Track these metrics to measure success:

- [ ] Authentication completion rate
- [ ] Average time to complete OTP
- [ ] Work type distribution
- [ ] Hold rate by category
- [ ] Digitap API success rate
- [ ] Digilocker completion rate
- [ ] Email OTP verification rate
- [ ] Overall application completion rate
- [ ] Student vs Salaried ratio
- [ ] Graduation conversion rate
- [ ] Loan approval rate
- [ ] User satisfaction score

---

## ⚠️ Known Risks & Mitigation

- [ ] **Risk:** Digitap API downtime
  - **Mitigation:** Manual PAN entry fallback ✓
  
- [ ] **Risk:** Digilocker API failures
  - **Mitigation:** Retry logic + skip option ✓
  
- [ ] **Risk:** SMS delivery failures
  - **Mitigation:** Multiple SMS provider fallback
  
- [ ] **Risk:** Email delivery failures
  - **Mitigation:** Multiple email provider fallback
  
- [ ] **Risk:** Too many holds reducing conversions
  - **Mitigation:** Monitor rates, adjust thresholds
  
- [ ] **Risk:** User frustration with holds
  - **Mitigation:** Clear communication, support contact
  
- [ ] **Risk:** Performance issues with external APIs
  - **Mitigation:** Caching, async processing
  
- [ ] **Risk:** Database migration issues
  - **Mitigation:** Test in staging, backup, rollback plan ✓

---

## 📞 Support & Escalation

### Technical Issues
- **Primary:** Development Team
- **Secondary:** DevOps Team
- **Escalation:** CTO

### API Issues
- **Digitap:** Contact Digitap support
- **Digilocker:** Government helpline
- **SMS Gateway:** Provider support
- **Email Service:** Provider support

### Business Issues
- **Hold Policy:** Product Manager
- **Loan Amounts:** Finance Team
- **Compliance:** Legal Team

---

**Last Updated:** [Date]  
**Version:** 1.0  
**Next Review:** After Phase 1 completion

