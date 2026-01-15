# Partner API & Dedupe API Documentation

## Table of Contents
1. [Overview](#overview)
2. [Base URL](#base-url)
3. [Authentication](#authentication)
4. [API Endpoints](#api-endpoints)
5. [Error Codes](#error-codes)
6. [Request/Response Examples](#requestresponse-examples)
7. [Encryption (Optional)](#encryption-optional)
8. [Testing Guide](#testing-guide)

---

## Overview

The Partner API allows lead sourcing partners to:
- Check if leads already exist in the system (Dedupe API)
- Track leads and their conversion status
- View statistics and analytics
- Receive UTM links for lead tracking

### Key Features
- **Dedupe Checking**: Check if a lead (mobile number/PAN) already exists
- **UTM Tracking**: Automatic UTM link generation for lead attribution
- **Dashboard**: View leads, statistics, and payout information
- **Encryption**: Optional RSA-OAEP + AES-256-GCM encryption support
- **Payout Tracking**: Automatic payout eligibility calculation (20-day rule)

---

## Base URL

```
Production: https://pocketcredit.in/api/v1/partner
Development: http://localhost:3000/api/v1/partner
```

---

## Authentication

The Partner API uses a two-step authentication process:

### Step 1: Get Access Token

**Endpoint**: `POST /api/v1/partner/login`

**Authentication**: Basic Auth
- Username: `client_id`
- Password: `client_secret`

**Request Headers**:
```
Authorization: Basic base64(client_id:client_secret)
Content-Type: application/json
```

**Response**:
```json
{
    "status": true,
    "code": 2000,
    "message": "Success",
    "data": {
        "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "token_type": "Bearer",
        "expires_in": 900
    }
}
```

**Token Details**:
- Access Token: Valid for 15 minutes (900 seconds)
- Refresh Token: Valid for 30 days
- Token Type: Bearer

### Step 2: Use Access Token

Include the access token in all subsequent API requests:

```
Authorization: Bearer {access_token}
```

### Refresh Token

**Endpoint**: `POST /api/v1/partner/refresh-token`

**Request Headers**:
```
Authorization: Basic base64(client_id:client_secret)
refresh_token: {refresh_token}
Content-Type: application/json
```

**Response**:
```json
{
    "status": true,
    "code": 2000,
    "message": "Success",
    "data": {
        "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "token_type": "Bearer",
        "expires_in": 900
    }
}
```

---

## API Endpoints

### 1. Lead Dedupe Check

**Endpoint**: `POST /api/v1/partner/lead-dedupe-check`

**Description**: Check if a lead already exists in the system. Returns dedupe status and UTM link for fresh/registered leads.

**Authentication**: Bearer Token (Access Token)

**Request Body** (Required Fields):
```json
{
    "first_name": "John",
    "last_name": "Doe",
    "mobile_number": "9876543210",
    "pan_number": "ABCDE1234F"
}
```

**Request Body** (With Optional Funnel Checks):
```json
{
    "first_name": "John",
    "last_name": "Doe",
    "mobile_number": "9876543210",
    "pan_number": "ABCDE1234F",
    "date_of_birth": "1990-01-15",
    "employment_type": "Salaried",
    "monthly_salary": 35000,
    "payment_mode": "Bank Transfer"
}
```

**Field Validations**:
- `mobile_number`: Must be exactly 10 digits (numeric only)
- `pan_number`: Must match format `[A-Z]{5}[0-9]{4}[A-Z]{1}` (e.g., ABCDE1234F)
- `date_of_birth`: Format `YYYY-MM-DD` (optional, for funnel check)
- `employment_type`: Must be "Salaried" (optional, for funnel check)
- `monthly_salary`: Minimum ₹20,000 (optional, for funnel check)
- `payment_mode`: Must contain "bank" or "transfer" (optional, for funnel check)

**Funnel Check Rules**:
- Age: Must be between 18-45 years (calculated from `date_of_birth`)
- Employment Type: Must be "Salaried"
- Monthly Salary: Minimum ₹20,000
- Payment Mode: Must be "Bank Transfer"

**Response - Fresh Lead (2005)**:
```json
{
    "status": true,
    "code": 2005,
    "message": "Fresh Lead Registered Successfully!",
    "utm_link": "https://pocketcredit.in?utm_source=partner_uuid&utm_medium=partner_api&utm_campaign=lead_9876543210_1234567890",
    "redirect_url": "https://pocketcredit.in?utm_source=partner_uuid&utm_medium=partner_api&utm_campaign=lead_9876543210_1234567890"
}
```

**Response - Registered User (2004)**:
```json
{
    "status": true,
    "code": 2004,
    "message": "Registered User",
    "utm_link": "https://pocketcredit.in?utm_source=partner_uuid&utm_medium=partner_api&utm_campaign=lead_9876543210_1234567890",
    "redirect_url": "https://pocketcredit.in?utm_source=partner_uuid&utm_medium=partner_api&utm_campaign=lead_9876543210_1234567890"
}
```

**Response - Active User (2006)**:
```json
{
    "status": false,
    "code": 2006,
    "message": "Active Loan User"
}
```

**Dedupe Status Codes**:
- `2005`: Fresh Lead - User doesn't exist in system
- `2004`: Registered User - User exists but has no active loans
- `2006`: Active User - User has active loans or is on hold/suspended

**Notes**:
- UTM link is only provided for codes 2004 and 2005
- UTM link includes partner UUID for tracking
- Lead is automatically stored in `partner_leads` table

---

### 2. Get All Leads

**Endpoint**: `GET /api/v1/partner/dashboard/leads`

**Description**: Get all leads shared by this partner with optional filters.

**Authentication**: Bearer Token (Access Token)

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50)
- `status` (optional): Filter by dedupe status (`fresh_lead`, `registered_user`, `active_user`)
- `start_date` (optional): Start date filter (format: `YYYY-MM-DD`)
- `end_date` (optional): End date filter (format: `YYYY-MM-DD`)

**Example Request**:
```
GET /api/v1/partner/dashboard/leads?page=1&limit=50&status=fresh_lead&start_date=2025-01-01&end_date=2025-01-31
```

**Response**:
```json
{
    "status": true,
    "code": 2000,
    "message": "Success",
    "data": {
        "leads": [
            {
                "id": 1,
                "first_name": "John",
                "last_name": "Doe",
                "mobile_number": "9876543210",
                "pan_number": "ABCDE1234F",
                "dedupe_status": "fresh_lead",
                "dedupe_code": 2005,
                "utm_link": "https://pocketcredit.in?utm_source=partner_uuid&utm_medium=partner_api&utm_campaign=lead_9876543210_1234567890",
                "lead_shared_at": "2025-01-15T10:30:00.000Z",
                "user_registered_at": null,
                "loan_application_id": null,
                "loan_status": null,
                "disbursed_at": null,
                "disbursal_amount": null,
                "payout_eligible": 0,
                "payout_amount": null,
                "payout_grade": null,
                "payout_status": null,
                "user_id": null,
                "email": null,
                "application_number": null,
                "days_to_disbursal": null
            }
        ],
        "pagination": {
            "page": 1,
            "limit": 50,
            "total": 100,
            "total_pages": 2
        }
    }
}
```

---

### 3. Get Statistics

**Endpoint**: `GET /api/v1/partner/dashboard/stats`

**Description**: Get partner statistics including total leads, conversions, and payout information.

**Authentication**: Bearer Token (Access Token)

**Response**:
```json
{
    "status": true,
    "code": 2000,
    "message": "Success",
    "data": {
        "total_leads": 1000,
        "fresh_leads": 600,
        "registered_users": 200,
        "active_users": 200,
        "loan_applications": 150,
        "disbursed_loans": 100,
        "payout_eligible_leads": 80,
        "total_payout_amount": 50000.00
    }
}
```

**Statistics Fields**:
- `total_leads`: Total number of leads shared
- `fresh_leads`: Leads that were new users
- `registered_users`: Leads that were existing users without active loans
- `active_users`: Leads that were existing users with active loans
- `loan_applications`: Number of leads that applied for loans
- `disbursed_loans`: Number of loans that were disbursed
- `payout_eligible_leads`: Number of leads eligible for payout (disbursed within 20 days)
- `total_payout_amount`: Total payout amount for eligible leads

---

### 4. Get Lead Details

**Endpoint**: `GET /api/v1/partner/dashboard/lead/:leadId`

**Description**: Get detailed information about a specific lead.

**Authentication**: Bearer Token (Access Token)

**Path Parameters**:
- `leadId`: Lead ID (integer)

**Example Request**:
```
GET /api/v1/partner/dashboard/lead/1
```

**Response**:
```json
{
    "status": true,
    "code": 2000,
    "message": "Success",
    "data": {
        "id": 1,
        "partner_id": 1,
        "partner_uuid": "partner_uuid_12345",
        "user_id": 123,
        "first_name": "John",
        "last_name": "Doe",
        "mobile_number": "9876543210",
        "pan_number": "ABCDE1234F",
        "dedupe_status": "fresh_lead",
        "dedupe_code": 2005,
        "utm_link": "https://pocketcredit.in?utm_source=partner_uuid&utm_medium=partner_api&utm_campaign=lead_9876543210_1234567890",
        "lead_shared_at": "2025-01-15T10:30:00.000Z",
        "user_registered_at": "2025-01-15T11:00:00.000Z",
        "loan_application_id": 456,
        "loan_status": "disbursed",
        "disbursed_at": "2025-01-20T14:00:00.000Z",
        "disbursal_amount": 50000,
        "payout_eligible": 1,
        "payout_amount": 1000.00,
        "payout_grade": "A",
        "payout_status": "eligible",
        "email": "john.doe@example.com",
        "user_status": "active",
        "application_number": "APP123456",
        "loan_amount": 50000,
        "loan_created_at": "2025-01-15T11:30:00.000Z"
    }
}
```

**Error Response (Lead Not Found)**:
```json
{
    "status": false,
    "code": 4040,
    "message": "Lead not found"
}
```

---

## Error Codes

### Authentication Errors

| Code | Message | Description |
|------|---------|-------------|
| 4110 | Authentication failed | General authentication error |
| 4111 | Invalid API credentials | Invalid client_id or client_secret |
| 4113 | Token Generation Failed | Error generating JWT token |
| 4114 | Token is Required | Missing or invalid Bearer token |
| 4115 | Invalid token type | Token type mismatch |
| 4116 | Partner not found or inactive | Partner account is inactive |
| 4117 | Token expired | Access token has expired |
| 4118 | Invalid access or refresh token | Invalid or malformed token |

### Validation Errors

| Code | Message | Description |
|------|---------|-------------|
| 2003 | Missing Parameters! | Required fields are missing |
| 4119 | Invalid Mobile Number or Format | Mobile number must be 10 digits |
| 4120 | Invalid Pan Number or Format | PAN format is invalid |
| 4121 | Basic Funnel Check Failed | Funnel validation failed (age, salary, etc.) |

### Dedupe Status Codes

| Code | Status | Description |
|------|--------|-------------|
| 2004 | Registered User | User exists but no active loans |
| 2005 | Fresh Lead | New user, doesn't exist |
| 2006 | Active User | User has active loans or on hold |

### Other Errors

| Code | Message | Description |
|------|---------|-------------|
| 2000 | Success | Request successful |
| 4040 | Lead not found | Lead ID doesn't exist |
| 5000 | Internal Server Error | Server-side error |

---

## Request/Response Examples

### Example 1: Complete Flow

**Step 1: Login**
```bash
curl -X POST https://pocketcredit.in/api/v1/partner/login \
  -H "Authorization: Basic base64(client_id:client_secret)" \
  -H "Content-Type: application/json"
```

**Step 2: Check Dedupe**
```bash
curl -X POST https://pocketcredit.in/api/v1/partner/lead-dedupe-check \
  -H "Authorization: Bearer {access_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Doe",
    "mobile_number": "9876543210",
    "pan_number": "ABCDE1234F"
  }'
```

**Step 3: Get Leads**
```bash
curl -X GET "https://pocketcredit.in/api/v1/partner/dashboard/leads?page=1&limit=50" \
  -H "Authorization: Bearer {access_token}"
```

---

## Encryption (Optional)

If encryption is enabled for your partner account, requests and responses can be encrypted using RSA-OAEP + AES-256-GCM.

### Encryption Algorithm
- **Key Encryption**: RSA-OAEP with SHA-256
- **Data Encryption**: AES-256-GCM
- **Algorithm Name**: `RSA-OAEP-AES256-GCM`

### Encrypted Request Format

```json
{
    "version": "1.0",
    "partnerId": "partner_uuid",
    "timestamp": 1234567890,
    "encryptedKey": "base64_encrypted_aes_key",
    "encryptedData": "base64_encrypted_data",
    "authTag": "base64_auth_tag",
    "iv": "base64_initialization_vector",
    "signature": "base64_signature",
    "algorithm": "RSA-OAEP-AES256-GCM"
}
```

### Encryption Process

1. Generate random AES-256 key
2. Encrypt data with AES-256-GCM
3. Encrypt AES key with partner's public key (RSA-OAEP)
4. Sign the payload with our private key
5. Send encrypted payload

### Decryption Process

1. Verify signature using partner's public key
2. Decrypt AES key using our private key (RSA-OAEP)
3. Decrypt data using AES-256-GCM
4. Parse JSON response

**Note**: Encryption is optional and must be enabled per partner. Contact support to enable encryption for your partner account.

---

## Partner Dashboard Access

Partners can access a web-based dashboard to view their leads, statistics, and payout information.

### Dashboard URL

```
Production: https://pocketcredit.in/partner/dashboard
Development: http://localhost:3000/partner/dashboard
```

### Login Process

1. Navigate to `/partner/login`
2. Enter your **Client ID** and **Client Secret** (same credentials used for API)
3. Click "Sign In"
4. You'll be redirected to the dashboard

### Dashboard Features

- **Statistics Overview**: View total leads, fresh leads, disbursed loans, and total payout
- **Leads List**: Browse all your leads with filters and search
- **Lead Details**: View detailed information about each lead including:
  - Lead information (name, mobile, PAN)
  - Dedupe status
  - Loan application status
  - Disbursal information
  - Payout eligibility and amount
  - UTM tracking link
- **Filters**: Filter leads by status, date range
- **Search**: Search leads by name, mobile number, or PAN
- **Pagination**: Navigate through large lists of leads

### Dashboard Pages

- **Dashboard**: `/partner/dashboard` - Main dashboard with statistics and leads list
- **Lead Details**: `/partner/lead/:leadId` - Detailed view of a specific lead

### Authentication

The dashboard uses the same authentication system as the API:
- Login with Client ID and Client Secret
- Access token stored in browser (valid for 15 minutes)
- Automatic token refresh when needed
- Logout clears all stored tokens

---

## Testing Guide

### Using Postman

1. **Import Collection**: Import `Partner_API_Postman_Collection.json` into Postman
2. **Set Environment Variables**:
   - `base_url`: Your API base URL
   - `client_id`: Your partner client ID
   - `client_secret`: Your partner client secret
   - `partner_uuid`: Your partner UUID
3. **Run Login Request**: Execute "Login - Get Access Token" to get access token
4. **Test Endpoints**: Access token is automatically saved and used in subsequent requests

### Using cURL

**Login**:
```bash
curl -X POST http://localhost:3000/api/v1/partner/login \
  -u "client_id:client_secret" \
  -H "Content-Type: application/json"
```

**Dedupe Check**:
```bash
curl -X POST http://localhost:3000/api/v1/partner/lead-dedupe-check \
  -H "Authorization: Bearer {access_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Doe",
    "mobile_number": "9876543210",
    "pan_number": "ABCDE1234F"
  }'
```

### Test Data

**Valid Test Cases**:
- Fresh Lead: Use a new mobile number and PAN
- Registered User: Use existing mobile/PAN without active loans
- Active User: Use existing mobile/PAN with active loans

**Invalid Test Cases**:
- Mobile number: Less than 10 digits or non-numeric
- PAN: Invalid format (not matching `[A-Z]{5}[0-9]{4}[A-Z]{1}`)
- Missing required fields: Omit `first_name`, `last_name`, `mobile_number`, or `pan_number`
- Funnel check failures: Age < 18 or > 45, salary < 20000, etc.

---

## Payout System

### Payout Eligibility

Payout is calculated automatically when a loan is disbursed. A lead is eligible for payout if:
- Loan is disbursed within **20 days** from lead share date
- Loan status is `disbursed`

### Payout Calculation

- Payout amount is calculated as a percentage of disbursal amount (configurable, default: 2%)
- Payout grade is determined based on disbursal amount
- Payout status is automatically updated in the lead record

### Payout Tracking

Partners can track payout information through:
- Dashboard statistics (`/dashboard/stats`)
- Lead details (`/dashboard/lead/:leadId`)
- Leads list (`/dashboard/leads`)

---

## Support

For API support, please contact:
- Email: support@pocketcredit.in
- Documentation: https://pocketcredit.in/api-docs

---

## Changelog

### Version 1.0 (2025-01-15)
- Initial release
- Authentication endpoints
- Dedupe API
- Dashboard endpoints
- Encryption support

---

**Last Updated**: January 15, 2025
