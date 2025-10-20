# Visual Flow Comparison: Current vs Desired

## 🔴 CURRENT FLOW (Email/Password Based)

```
┌─────────────────────────────────────────────────────────────┐
│                    CURRENT AUTHENTICATION                    │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   Landing Page    │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │  Email + Password │
                    │   Registration    │
                    │  (Name, Email,    │
                    │  Phone, Password, │
                    │   DOB, Gender)    │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │   Login Success   │
                    └─────────┬─────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                PROFILE COMPLETION (Current)                  │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  Step 1: Basic    │
                    │  Profile (Name,   │
                    │  PAN, Pincode,    │
                    │     DOB)          │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │ Step 2: What do   │
                    │   you do?         │
                    │ (Employment Type) │
                    └─────────┬─────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
    ┌─────────▼─────────┐         ┌─────────▼─────────┐
    │  Salaried Branch  │         │  Student Branch   │
    │  (Some fields)    │         │  (Some fields)    │
    └─────────┬─────────┘         └─────────┬─────────┘
              │                               │
              └───────────────┬───────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  More Employment  │
                    │     Details       │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │  Profile Complete │
                    └─────────┬─────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                  LOAN APPLICATION (Current)                  │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  Apply for Loan   │
                    │  - User enters    │
                    │    loan amount    │
                    │    (editable)     │
                    │  - Select purpose │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │  Select Loan Plan │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │   Confirmation    │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │  Bank Details     │
                    │  (Manual entry)   │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │   References      │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │  Manual Document  │
                    │     Upload        │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │    Completed      │
                    └───────────────────┘

❌ NO HOLDS ❌ NO API INTEGRATIONS ❌ NO AUTO-VALIDATION
```

---

## ✅ DESIRED FLOW (OTP Based with Auto-Validation)

```
┌─────────────────────────────────────────────────────────────┐
│              DESIRED AUTHENTICATION (OTP Only)               │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   Landing Page    │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │ Enter 10-digit    │
                    │  Mobile Number    │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │  OTP Sent via SMS │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │   Enter 6-digit   │
                    │       OTP         │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │  Auto Login/      │
                    │  Registration     │
                    └─────────┬─────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│           STEP 1: WORK TYPE SELECTION (Critical!)           │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  What do you do?  │
                    │   ┌──────────┐    │
                    │   │ Dropdown │    │
                    │   └──────────┘    │
                    └─────────┬─────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
┌────────▼────────┐  ┌───────▼────────┐  ┌───────▼───────┐
│   🔴 HOLD       │  │  ✅ SALARIED   │  │  ✅ STUDENT   │
│ Self-employed,  │  │     FLOW       │  │     FLOW      │
│  Part-time,     │  │                │  │               │
│  Freelancer,    │  └───────┬────────┘  └───────┬───────┘
│  Home Maker,    │          │                    │
│   Retired,      │          │                    │
│ No Job, Others  │          │                    │
└─────────────────┘          │                    │
  "Application               │                    │
   on hold"                  │                    │
                             │                    │
┌────────────────────────────────────────────────────────────┐
│               SALARIED FLOW WITH AUTO-CHECKS               │
└────────────────────────────────────────────────────────────┘
                             │
                   ┌─────────▼─────────┐
                   │ Income Payment    │
                   │      Mode         │
                   └─────────┬─────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
┌────────▼────────┐  ┌──────▼───────┐  ┌───────▼───────┐
│  🔴 Cash        │  │ 🟡 Cheque    │  │ ✅ Bank       │
│ → HOLD Forever  │  │ → HOLD 90d   │  │ → Proceed     │
└─────────────────┘  └──────────────┘  └───────┬───────┘
                                                │
                                      ┌─────────▼─────────┐
                                      │ Gross Monthly     │
                                      │   Income Range    │
                                      │ ┌──────────────┐  │
                                      │ │ ₹1k-₹15k     │  │
                                      │ │ ₹15k-₹25k    │  │
                                      │ │ ₹25k-₹35k    │  │
                                      │ │ Above ₹35k   │  │
                                      │ └──────────────┘  │
                                      └─────────┬─────────┘
                                                │
                                      ┌─────────▼─────────┐
                                      │  Date of Birth    │
                                      │  (Enter DOB)      │
                                      └─────────┬─────────┘
                                                │
                                  ┌─────────────┴─────────────┐
                                  │                           │
                        ┌─────────▼─────────┐   ┌───────────▼──────────┐
                        │  🔴 Age > 45      │   │  ✅ Age ≤ 45        │
                        │  → HOLD Forever   │   │  → Proceed           │
                        └───────────────────┘   └───────────┬──────────┘
                                                            │
                                              ┌─────────────▼────────────┐
                                              │ 🔌 DIGITAP API CALL     │
                                              │ (Automatic)              │
                                              │ - Fetch user data        │
                                              │ - Get Experian score     │
                                              │ - Pre-fill: Name, DOB,   │
                                              │   PAN, Gender            │
                                              └─────────────┬────────────┘
                                                            │
                                              ┌─────────────▼────────────┐
                                              │ Credit Score Check       │
                                              └─────────────┬────────────┘
                                                            │
                                    ┌───────────────────────┼───────────────────────┐
                                    │                       │                       │
                          ┌─────────▼─────────┐   ┌────────▼────────┐   ┌─────────▼─────────┐
                          │ 🔴 Score < 630    │   │ ✅ Score ≥ 630  │   │ ✅ Score NULL     │
                          │ → HOLD 60 days    │   │ → Proceed       │   │ → Proceed         │
                          └───────────────────┘   └────────┬────────┘   └─────────┬─────────┘
                                                            │                       │
                                                            └───────────┬───────────┘
                                                                        │
                                                          ┌─────────────▼────────────┐
                                                          │ "Is this info correct?"  │
                                                          │ (Pre-filled data shown)  │
                                                          └─────────────┬────────────┘
                                                                        │
                                                       ┌────────────────┴────────────────┐
                                                       │                                 │
                                              ┌────────▼────────┐              ┌────────▼────────┐
                                              │  ✅ Yes         │              │  ❌ No          │
                                              │  → Proceed      │              │  → Manual PAN   │
                                              └────────┬────────┘              └────────┬────────┘
                                                       │                                 │
                                                       └────────────────┬────────────────┘
                                                                        │
                                                          ┌─────────────▼────────────┐
                                                          │ Personal Email           │
                                                          │ + OTP Verification       │
                                                          └─────────────┬────────────┘
                                                                        │
                                                          ┌─────────────▼────────────┐
                                                          │ Marital Status           │
                                                          └─────────────┬────────────┘
                                                                        │
                                                          ┌─────────────▼────────────┐
                                                          │ Salary Date (1-31)       │
                                                          └─────────────┬────────────┘
                                                                        │
                                                          ┌─────────────▼────────────┐
                                                          │ Official Email           │
                                                          │ + OTP Verification       │
                                                          └─────────────┬────────────┘
                                                                        │
                                                          ┌─────────────▼────────────┐
                                                          │ Reason for Loan          │
                                                          │ (Dropdown)               │
                                                          └─────────────┬────────────┘
                                                                        │
                                                          ┌─────────────▼────────────┐
                                                          │ 💰 AUTO-CALCULATED      │
                                                          │    LOAN AMOUNT           │
                                                          │ Based on Income Range:   │
                                                          │ ₹1k-₹15k  → ₹6,000     │
                                                          │ ₹15k-₹25k → ₹10,000    │
                                                          │ ₹25k-₹35k → ₹15,000    │
                                                          │ >₹35k     → ₹50,000    │
                                                          │ (NOT EDITABLE)           │
                                                          └─────────────┬────────────┘
                                                                        │
                                                          ┌─────────────▼────────────┐
                                                          │ Bank Account Linking     │
                                                          └─────────────┬────────────┘
                                                                        │
                                                          ┌─────────────▼────────────┐
                                                          │ 🔌 DIGILOCKER KYC       │
                                                          │ - Enter Aadhaar mobile   │
                                                          │ - Digilocker auth        │
                                                          │ - Auto fetch documents   │
                                                          │ - Max 3 attempts         │
                                                          │ - Skip after 3 fails     │
                                                          └─────────────┬────────────┘
                                                                        │
                                                          ┌─────────────▼────────────┐
                                                          │ Employment Details       │
                                                          │ - Company Name           │
                                                          │ - Industry (dropdown)    │
                                                          │ - Department (dropdown)  │
                                                          │ - Designation (dropdown) │
                                                          └─────────────┬────────────┘
                                                                        │
                                                          ┌─────────────▼────────────┐
                                                          │ ✅ Application Complete  │
                                                          └──────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│                    STUDENT FLOW                             │
└────────────────────────────────────────────────────────────┘
                             │
                   ┌─────────▼─────────┐
                   │  Date of Birth    │
                   └─────────┬─────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                                       │
┌────────▼────────┐                  ┌──────────▼─────────┐
│  🔴 Age < 19    │                  │  ✅ Age ≥ 19       │
│ → HOLD until    │                  │  → Proceed         │
│   19th birthday │                  └──────────┬─────────┘
└─────────────────┘                             │
                                      ┌─────────▼─────────┐
                                      │  College Name     │
                                      └─────────┬─────────┘
                                                │
                                      ┌─────────▼─────────┐
                                      │ Document Uploads: │
                                      │ - College ID Front│
                                      │ - College ID Back │
                                      │ - Marks Memo      │
                                      └─────────┬─────────┘
                                                │
                                      ┌─────────▼─────────┐
                                      │ Student Dashboard │
                                      │                   │
                                      │ 📢 Upsell Prompt: │
                                      │ "Are you          │
                                      │  graduated?"      │
                                      │  [Apply Now]      │
                                      └─────────┬─────────┘
                                                │
                                      ┌─────────▼─────────┐
                                      │ Active Loans /    │
                                      │ Repayment Screen  │
                                      └───────────────────┘

✅ AUTOMATIC HOLDS ✅ API INTEGRATIONS ✅ AUTO-VALIDATION ✅ PRE-FILL
```

---

## 🔍 KEY DIFFERENCES HIGHLIGHTED

| Aspect | Current | Desired |
|--------|---------|---------|
| **Auth Method** | Email + Password | Mobile OTP only |
| **First Step** | Profile info | Work type selection |
| **Eligibility Check** | None | Immediate (work type) |
| **Payment Mode Check** | None | Automatic holds |
| **Age Validation** | None | Auto-check with holds |
| **Credit Score** | Not checked | Digitap API (auto) |
| **Pre-fill** | Manual entry | Digitap API (auto) |
| **Loan Amount** | User enters | Auto-calculated |
| **KYC Method** | Manual upload | Digilocker API |
| **Email Verify** | No | Yes (OTP for both) |
| **Student Path** | Same as all | Specialized flow |
| **Holds System** | None | Comprehensive |

---

## 📊 HOLD CONDITIONS MATRIX

| Condition | Hold Type | Duration | Release Condition |
|-----------|-----------|----------|-------------------|
| Employment: Non-Salaried/Student | Permanent | Forever | Manual override |
| Payment Mode: Cash | Permanent | Forever | Manual override |
| Payment Mode: Cheque | Temporary | 90 days | Auto after 90 days |
| Age: >45 (Salaried) | Permanent | Forever | Manual override |
| Age: <19 (Student) | Temporary | Until 19th birthday | Auto on birthday |
| Credit Score: <630 | Temporary | 60 days | Auto after 60 days |

---

## 🎯 AUTO-CALCULATED LOAN AMOUNTS

```
Income Range Selection:
├── "₹1,000 to ₹15,000"     → Eligible: ₹6,000
├── "₹15,000 to ₹25,000"    → Eligible: ₹10,000
├── "₹25,000 to ₹35,000"    → Eligible: ₹15,000
└── "Above ₹35,000"         → Eligible: ₹50,000

⚠️ Amount is DISPLAY-ONLY, user cannot edit
```

---

## 🔌 API INTEGRATION POINTS

```
1. Mobile OTP
   └── SMS Gateway (Twilio/MSG91/Exotel)
       └── Send OTP → Verify OTP

2. Digitap API
   └── https://testapis.digitap.ai/mobiletoprefill
       ├── Input: Mobile number
       └── Output: Name, DOB, PAN, Gender, Address, Experian Score

3. Email OTP
   └── Email Service (SendGrid/AWS SES)
       └── Send OTP → Verify OTP

4. Digilocker
   └── Government KYC API
       ├── OAuth flow
       ├── Fetch Aadhaar details
       └── Download documents
       
5. Bank Verification (Optional)
   └── Penny drop / NPCI APIs
```

---

## ⚡ DECISION TREE

```
User Authenticated via OTP
    │
    └──> Work Type = ?
         │
         ├──> Salaried?
         │    ├──> Payment Mode = Bank Transfer? ✅
         │    │    ├──> Age ≤ 45? ✅
         │    │    │    ├──> Credit Score ≥ 630? ✅
         │    │    │    │    └──> PROCEED to loan application
         │    │    │    │
         │    │    │    ├──> Credit Score < 630? 🔴
         │    │    │    │    └──> HOLD 60 days
         │    │    │    │
         │    │    │    └──> Age > 45? 🔴
         │    │    │         └──> HOLD Forever
         │    │    │
         │    │    ├──> Payment Mode = Cash? 🔴
         │    │    │    └──> HOLD Forever
         │    │    │
         │    │    └──> Payment Mode = Cheque? 🟡
         │    │         └──> HOLD 90 days
         │    │
         │    └──> [Continue with salaried flow...]
         │
         ├──> Student?
         │    ├──> Age ≥ 19? ✅
         │    │    └──> PROCEED to student flow
         │    │
         │    └──> Age < 19? 🔴
         │         └──> HOLD until 19th birthday
         │
         └──> Other employment types? 🔴
              └──> HOLD Forever
```

---

## 🎨 UI/UX COMPARISON

### Current UI Flow:
```
┌──────────────────────┐
│  Complex Form with   │
│  Multiple Fields     │
│  (Email, Password,   │
│   Name, DOB, etc.)   │
└──────────────────────┘
         │
         ▼
┌──────────────────────┐
│   Profile Steps      │
│   (Multiple pages)   │
└──────────────────────┘
         │
         ▼
┌──────────────────────┐
│  Loan Application    │
│  (User enters amount)│
└──────────────────────┘
         │
         ▼
┌──────────────────────┐
│  Manual Documents    │
└──────────────────────┘
```

### Desired UI Flow:
```
┌──────────────────────┐
│   Simple Mobile      │
│   Number Input       │
│   (10 digits)        │
└──────────────────────┘
         │
         ▼
┌──────────────────────┐
│    OTP Input         │
│    (6 digits)        │
└──────────────────────┘
         │
         ▼
┌──────────────────────┐
│  Work Type Picker    │
│  (Single dropdown)   │
└──────────────────────┘
         │
         ▼
┌──────────────────────┐
│  Guided Flow with    │
│  Auto-validations    │
│  and API Pre-fills   │
└──────────────────────┘
         │
         ▼
┌──────────────────────┐
│  API-based KYC       │
│  (Digilocker)        │
└──────────────────────┘
```

---

**Recommendation:** Start with Phase 1 (OTP Authentication) as it's the foundation for the entire new flow. Once authentication is working, proceed to work type selection and hold logic, as these are critical gates that determine the user's journey.

