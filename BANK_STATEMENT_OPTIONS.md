# Bank Statement Upload Options - Explanation

## Overview
The bank statement page (`/loan-application/bank-statement`) has **3 options** for uploading bank statements:

---

## Option 1: **Account Aggregator (By Mobile)** 
**Location:** Online Upload tab → "By Mobile (Account Aggregator)" radio button  
**Destination:** `accountaggregator`  
**Status:** ✅ Recommended - "For Faster Processing"

### What it does:
1. **Uses RBI-approved Account Aggregator framework**
   - Secure, government-regulated method
   - Connects through authorized Account Aggregators (AA)

2. **Requires mobile number** linked to salary bank account
   - User enters mobile number (10 digits)
   - Must be the number linked to the bank account

3. **Process:**
   - User enters mobile number
   - Redirects to Digitap's secure page
   - User selects their bank from list
   - User authenticates via OTP (sent to mobile)
   - System automatically fetches last 6 months of bank statements
   - Data is analyzed automatically by Digitap

4. **Benefits:**
   - ✅ Fastest method
   - ✅ Automatic data extraction
   - ✅ No manual file upload needed
   - ✅ RBI-approved secure method
   - ✅ Real-time bank data

5. **Backend API:**
   - Calls: `POST /api/user/initiate-bank-statement`
   - Destination: `accountaggregator`
   - Generates Digitap URL with consent request for bank data

---

## Option 2: **Net Banking**
**Location:** Online Upload tab → "Net Banking" radio button  
**Destination:** `netbanking`  
**Status:** Alternative online method

### What it does:
1. **Direct bank login method**
   - User logs into their bank's net banking portal
   - No Account Aggregator involved

2. **Requires mobile number** linked to bank account
   - User enters mobile number
   - Used for verification

3. **Process:**
   - User enters mobile number
   - Redirects to Digitap's secure page
   - User selects their bank
   - User logs in with net banking credentials
   - System fetches bank statements automatically
   - Data is analyzed by Digitap

4. **Benefits:**
   - ✅ Automatic data extraction
   - ✅ No manual file upload
   - ✅ Direct bank connection
   - ✅ Real-time data

5. **Backend API:**
   - Calls: `POST /api/user/initiate-bank-statement`
   - Destination: `netbanking`
   - Generates Digitap URL for net banking flow

---

## Option 3: **Manual Upload**
**Location:** "Manual Upload" tab  
**Destination:** `statementupload`  
**Status:** Fallback option

### What it does:
1. **PDF file upload method**
   - User uploads their bank statement PDF manually
   - Last 6 months statement required

2. **No mobile number required** (optional)
   - Uses user's registered phone if available
   - Not mandatory for this method

3. **Process:**
   - User clicks "Continue to Upload"
   - Redirects to Digitap's upload page
   - User uploads PDF file (max 10MB)
   - Optionally enter bank name and PDF password
   - System analyzes the PDF automatically
   - Extracts transaction data, account details, etc.

4. **Benefits:**
   - ✅ Works when online methods fail
   - ✅ User has control over file
   - ✅ Can upload encrypted PDFs (with password)
   - ✅ Automatic PDF analysis

5. **Backend API:**
   - Calls: `POST /api/user/initiate-bank-statement`
   - Destination: `statementupload`
   - Generates Digitap URL for PDF upload page
   - After upload, PDF is sent to Digitap for analysis

---

## Comparison Table

| Feature | Account Aggregator | Net Banking | Manual Upload |
|---------|-------------------|------------|---------------|
| **Speed** | ⚡ Fastest | ⚡ Fast | 🐌 Slower |
| **Mobile Required** | ✅ Yes | ✅ Yes | ❌ No |
| **Data Source** | Real-time from bank | Real-time from bank | PDF file |
| **Security** | 🔒 RBI-approved | 🔒 Bank login | 🔒 File upload |
| **Auto Analysis** | ✅ Yes | ✅ Yes | ✅ Yes |
| **User Control** | Low | Low | High |
| **Best For** | Most users | Users with net banking | When online fails |

---

## Technical Details

### All methods use the same backend endpoint:
- **Route:** `POST /api/user/initiate-bank-statement`
- **Service:** `generateBankStatementURL()` in `digitapBankStatementService.js`
- **Digitap API:** `POST /bank-data/generate-url`

### Differences:
1. **`destination` parameter:**
   - `accountaggregator` → Uses AA framework
   - `netbanking` → Direct bank login
   - `statementupload` → PDF upload page

2. **Consent Request:**
   - Online methods: Full consent request with date range (last 6 months)
   - Manual: Just upload page, no consent needed

3. **Data Flow:**
   - **Account Aggregator/Net Banking:**
     - User authenticates → Bank provides data → Digitap analyzes → Webhook callback
   
   - **Manual Upload:**
     - User uploads PDF → Digitap analyzes PDF → Extracts data → Webhook callback

---

## Important Notes

1. **Mobile Number:**
   - Must be linked to the **salary bank account**
   - Only enter the mobile number linked to the bank account you want to verify
   - Select only the **salary bank account** from the list

2. **Date Range:**
   - All methods fetch/analyze **last 6 months** of bank statements
   - Automatically calculated from current date

3. **Webhook:**
   - All methods trigger webhook when complete: `/api/bank-statement/bank-data/webhook`
   - Webhook processes the data and saves to database

4. **Status Tracking:**
   - All methods save status to `user_bank_statements` table
   - Statuses: `pending`, `InProgress`, `completed`, `failed`

---

## Code References

- **Frontend:** `src/components/pages/BankStatementUploadPage.tsx`
- **Backend Route:** `src/server/routes/userBankStatement.js`
- **Service:** `src/server/services/digitapBankStatementService.js`
- **API Service:** `src/services/api.ts` → `initiateUserBankStatement()`

