# Third-Party API Integration List

This document lists all third-party services and APIs integrated (or planned) within the Pocket Credit platform.

## 1. Identity & Verification
*   **Provider:** **Digitap**
*   **Services Used:**
    *   **KYC / Prefill:** Fetches user details (Name, Address, DOB, etc.) via Mobile Number.
    *   **PAN Validation:** Validates PAN card details and name matching.
    *   **Credit Check:** Fetches Experian Credit Score and history.
    *   *Bank Statement Analysis:* (Likely via `digitapBankStatementService.js`)

## 2. Payments & Banking
*   **Provider:** **Cashfree** (Primary) / **Razorpay** (Alternative)
*   **Services Used:**
    *   **Payment Gateway:** Collecting Loan Repayments.
    *   **Payouts (Disbursal):** Disbursing loan amounts to user bank accounts.
    *   **E-NACH:** Automated recurring payments registration (Mandate).
    *   **Penny Drop:** Bank Account verification (verifying beneficiary name).
    *   **Cashfree Wrap (proposed):** For Loan Agreement e-Signing.

## 3. Storage & Infrastructure
*   **Provider:** **AWS (Amazon Web Services)**
*   **Services Used:**
    *   **S3 (Simple Storage Service):** Storing user documents (Selfies, PAN, Aadhar, Student IDs, Loan Agreements).

## 4. Communication
*   **Provider:** **Nodemailer** (via SMTP)
*   **Services Used:**
    *   **Email:** Sending OTPs, Welcome emails, Loan Agreements, and Notifications.
*   **Provider:** **Fast2SMS / Twilio / Other** (To Be Confirmed)
*   **Services Used:**
    *   **SMS:** Sending Login OTPs and critical alerts.

## 5. Government Services
*   **Provider:** **Digilocker**
*   **Services Used:**
    *   **Document Fetching:** Verified fetching of Aadhar/PAN documents directly from government source.
