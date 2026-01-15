# Partner API Integration Guide

## Overview

This guide helps partners integrate with Pocket Credit's Partner API to check lead deduplication and share leads securely.

## Base URL

```
Production: https://pocketcredit.in/api/v1/partner
```

## Quick Start

1. Get your `client_id` and `client_secret` from Pocket Credit
2. Get Pocket Credit's public RSA key (for encryption)
3. Generate your own RSA key pair (for signing)
4. Share your public key with Pocket Credit
5. Start making API calls

---

## Step 1: Authentication

### Get Access Token

**Endpoint**: `POST /api/v1/partner/login`

**Request**:
```bash
curl --location 'https://pocketcredit.in/api/v1/partner/login' \
--header 'Authorization: Basic base64(client_id:client_secret)' \
--header 'Content-Type: application/json'
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

**Use the `access_token` in all subsequent requests:**
```
Authorization: Bearer {access_token}
```

### Refresh Token (When Access Token Expires)

**Endpoint**: `POST /api/v1/partner/refresh-token`

**Request**:
```bash
curl --location 'https://pocketcredit.in/api/v1/partner/refresh-token' \
--header 'Authorization: Basic base64(client_id:client_secret)' \
--header 'Content-Type: application/json' \
--data '{
    "refresh_token": "your_refresh_token_here"
}'
```

---

## Step 2: Generate Your RSA Key Pair

You need to generate an RSA key pair for signing requests.

### Using OpenSSL

```bash
# Generate 2048-bit RSA private key
openssl genrsa -out partner_private.pem 2048

# Extract public key
openssl rsa -in partner_private.pem -pubout -out partner_public.pem

# Set secure permissions
chmod 600 partner_private.pem
```

### Using Node.js

```javascript
const crypto = require('crypto');
const fs = require('fs');

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

fs.writeFileSync('partner_private.pem', privateKey, { mode: 0o600 });
fs.writeFileSync('partner_public.pem', publicKey);
```

### Share Your Public Key

Send your `partner_public.pem` to Pocket Credit

**Keep your `partner_private.pem` SECRET - never share it!**

---

## Step 3: Get Pocket Credit's Public Key

Pocket Credit will provide you with their public RSA key. Save it:

```
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxC8+3l6+K+U419Ndu1qC
f+GsWDpuQLXbC41KiEAqM3wgeWxtbhfIC6ZJXfX85Ot7U1TTlMudxzk22KB7L1dv
S17QCJTg7oYjpwEq+O0m39VHB5lObgoh+kxyGQSe1GvxvA7XJtDcppHcqxo+waS+
xyT/qtORf/F78HlE1+eh/EReDa3OCaHuWzorrqWBbSMvMWWmWjRXFBGAw7GfcX0m
uDtCEQ2257MpgWAP2KE8KO3VQcb6Hqt11Eqp208yPjd+wzmKPLGaaoJDhRZoBwTL
gL8k2VR2v4ZAGwrCap8lfiLFxtm7AM+y5LjkfnbJ7pKaXiMJZWGTOpEXW9xMrQFn
BwIDAQAB
-----END PUBLIC KEY-----
```

---

## Step 4: Lead Dedupe Check API

### Option A: Simple Request (Unencrypted)

**Endpoint**: `POST /api/v1/partner/lead-dedupe-check`

**Request**:
```bash
curl --location 'https://pocketcredit.in/api/v1/partner/lead-dedupe-check' \
--header 'Authorization: Bearer {access_token}' \
--header 'Content-Type: application/json' \
--data '{
    "first_name": "John",
    "last_name": "Doe",
    "mobile_number": "9876543210",
    "pan_number": "ABCDE1234F",
    "date_of_birth": "1990-01-15",
    "employment_type": "Salaried",
    "monthly_salary": 50000,
    "payment_mode": "Bank Transfer"
}'
```

**Response Examples**:

**Fresh Lead (2005)**:
```json
{
    "status": true,
    "code": 2005,
    "message": "Fresh Lead Registered Successfully!",
    "utm_link": "https://pocketcredit.in?utm_source=PC_3267MCL11&utm_medium=partner_api&utm_campaign=lead_9876543210_1234567890",
    "redirect_url": "https://pocketcredit.in?utm_source=PC_3267MCL11&utm_medium=partner_api&utm_campaign=lead_9876543210_1234567890"
}
```

**Registered User (2004)**:
```json
{
    "status": true,
    "code": 2004,
    "message": "Registered User"
}
```

**Active User (2006)**:
```json
{
    "status": false,
    "code": 2006,
    "message": "Active Loan User"
}
```

### Option B: Encrypted Request (Optional)

For enhanced security, you can encrypt the request payload.

**Complete Node.js Example**:

```javascript
const crypto = require('crypto');
const axios = require('axios');

// Configuration
const POCKET_CREDIT_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxC8+3l6+K+U419Ndu1qC
f+GsWDpuQLXbC41KiEAqM3wgeWxtbhfIC6ZJXfX85Ot7U1TTlMudxzk22KB7L1dv
S17QCJTg7oYjpwEq+O0m39VHB5lObgoh+kxyGQSe1GvxvA7XJtDcppHcqxo+waS+
xyT/qtORf/F78HlE1+eh/EReDa3OCaHuWzorrqWBbSMvMWWmWjRXFBGAw7GfcX0m
uDtCEQ2257MpgWAP2KE8KO3VQcb6Hqt11Eqp208yPjd+wzmKPLGaaoJDhRZoBwTL
gL8k2VR2v4ZAGwrCap8lfiLFxtm7AM+y5LjkfnbJ7pKaXiMJZWGTOpEXW9xMrQFn
BwIDAQAB
-----END PUBLIC KEY-----`;

const PARTNER_ID = 'PC_3267MCL11'; // Your partner UUID
const PARTNER_PRIVATE_KEY = fs.readFileSync('partner_private.pem', 'utf8');
const ACCESS_TOKEN = 'your_access_token_here';

// Lead data
const leadData = {
    first_name: "John",
    last_name: "Doe",
    mobile_number: "9876543210",
    pan_number: "ABCDE1234F"
};

// Step 1: Generate AES key
const aesKey = crypto.randomBytes(32);

// Step 2: Encrypt lead data
const plaintext = JSON.stringify(leadData);
const iv = crypto.randomBytes(12);
const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
let encryptedData = cipher.update(plaintext, 'utf8', 'base64');
encryptedData += cipher.final('base64');
const authTag = cipher.getAuthTag();

// Step 3: Encrypt AES key with Pocket Credit's public key
const encryptedKey = crypto.publicEncrypt({
    key: POCKET_CREDIT_PUBLIC_KEY,
    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: 'sha256'
}, aesKey).toString('base64');

// Step 4: Sign payload
const timestamp = Date.now();
const payloadToSign = JSON.stringify({
    version: '1.0',
    partnerId: PARTNER_ID,
    timestamp,
    encryptedKey,
    encryptedData,
    authTag: authTag.toString('base64'),
    iv: iv.toString('base64'),
    algorithm: 'RSA-OAEP-AES256-GCM'
});

const signature = crypto.createSign('SHA256')
    .update(payloadToSign)
    .sign(PARTNER_PRIVATE_KEY, 'base64');

// Step 5: Send encrypted request
const response = await axios.post(
    'https://pocketcredit.in/api/v1/partner/lead-dedupe-check',
    {
        partnerId: PARTNER_ID,
        encryptedData,
        encryptedKey,
        authTag: authTag.toString('base64'),
        iv: iv.toString('base64'),
        signature,
        timestamp,
        version: '1.0',
        algorithm: 'RSA-OAEP-AES256-GCM'
    },
    {
        headers: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
        }
    }
);

console.log(response.data);
```

**Note**: If the response is encrypted, you'll need to decrypt it using Pocket Credit's public key and your private key.

---

## API Response Codes

| Code | Status | Meaning | Action |
|------|--------|---------|--------|
| 2004 | `registered_user` | User exists but no active loans | No UTM link provided |
| 2005 | `fresh_lead` | New user, doesn't exist | ✅ Share UTM link with customer |
| 2006 | `active_user` | User has active loans | ❌ Reject lead, don't share UTM link |

**Important**: Only share the UTM link when you receive code **2005** (Fresh Lead).

---

## Required Fields

### Minimum Required
- `first_name` (string)
- `last_name` (string)
- `mobile_number` (string, 10 digits)
- `pan_number` (string, format: ABCDE1234F)

### Optional (Funnel Checks)
- `date_of_birth` (string, format: YYYY-MM-DD)
- `employment_type` (string, must be "Salaried")
- `monthly_salary` (number, minimum: 20000)
- `payment_mode` (string, must contain "Bank Transfer")

---

## Error Codes

| Code | Message | Solution |
|------|---------|----------|
| 2003 | Missing Parameters! | Check all required fields are present |
| 4110 | Authentication failed | Check Basic Auth credentials |
| 4111 | Invalid API credentials | Verify client_id and client_secret |
| 4114 | Token is Required | Include refresh_token in request |
| 4118 | Invalid access or refresh token | Get new token via login |
| 4119 | Invalid Mobile Number or Format | Mobile must be exactly 10 digits |
| 4120 | Invalid Pan Number or Format | PAN must be format: ABCDE1234F |
| 4121 | Basic Funnel Check Failed | Check age (18-45), employment, salary, payment mode |

---

## UTM Link Usage

When you receive a UTM link (code 2005):

1. **Share the link** with your customer
2. **Customer clicks** the link and visits Pocket Credit
3. **UTM parameters** are automatically captured
4. **When customer registers**, they're linked to your partner account
5. **Track conversions** in your partner dashboard

**Example UTM Link:**
```
https://pocketcredit.in?utm_source=PC_3267MCL11&utm_medium=partner_api&utm_campaign=lead_9876543210_1234567890
```

---

## Partner Dashboard

Access your dashboard at:
```
https://pocketcredit.in/partner/login
```

Use your `client_id` and `client_secret` to log in and view:
- Lead statistics
- Conversion tracking
- Payout information
- Lead details

---

## Testing

### Test with cURL

```bash
# 1. Login
curl --location 'https://pocketcredit.in/api/v1/partner/login' \
--header 'Authorization: Basic base64(client_id:client_secret)'

# 2. Check Lead (replace {access_token})
curl --location 'https://pocketcredit.in/api/v1/partner/lead-dedupe-check' \
--header 'Authorization: Bearer {access_token}' \
--header 'Content-Type: application/json' \
--data '{
    "first_name": "John",
    "last_name": "Doe",
    "mobile_number": "9876543210",
    "pan_number": "ABCDE1234F"
}'
```

### Test with Postman

Import the Postman collection: `Partner_API_Postman_Collection.json`

---

## Troubleshooting Login Issues

If you're getting "Login failed" or "Invalid API credentials":

1. **Verify your Client ID exists:**
   ```bash
   # On Pocket Credit server
   node src/server/scripts/checkPartner.js PC_7588
   ```

2. **Check if partner is active:**
   - Partner must have `is_active = 1` in database

3. **Verify Client Secret:**
   - Make sure you're using the correct Client Secret
   - Client Secret is case-sensitive
   - If you've forgotten it, contact Pocket Credit support to reset it

4. **Check server logs:**
   - Look for authentication errors in server console
   - Error messages will indicate if Client ID not found or secret mismatch

5. **Reset Client Secret (if you have server access):**
   ```bash
   node src/server/scripts/updatePartnerSecret.js PC_7588 YourNewSecret
   ```

## Support

For API support, contact:
- Email: support@pocketcredit.in
- Documentation: See `Partner_API_Documentation.md` for complete API reference

---

## Security Best Practices

1. **Store keys securely**: Never commit private keys to version control
2. **Use HTTPS**: Always use HTTPS for API calls
3. **Rotate keys**: Regularly rotate your RSA keys
4. **Monitor access**: Keep track of API usage and access tokens
5. **Error handling**: Implement proper error handling for all API calls

---

## Complete Integration Checklist

- [ ] Received `client_id` and `client_secret` from Pocket Credit
- [ ] Received Pocket Credit's public RSA key
- [ ] Generated your own RSA key pair
- [ ] Shared your public key with Pocket Credit
- [ ] Tested login endpoint
- [ ] Tested lead dedupe check endpoint
- [ ] Implemented UTM link sharing for fresh leads
- [ ] Set up error handling
- [ ] Integrated with your system

---

## Quick Reference

**Base URL**: `https://pocketcredit.in/api/v1/partner`

**Authentication**: Basic Auth for login, Bearer token for API calls

**Key Endpoints**:
- `POST /login` - Get access token
- `POST /refresh-token` - Refresh access token
- `POST /lead-dedupe-check` - Check if lead exists

**Response Codes**:
- `2005` = Fresh Lead (share UTM link)
- `2004` = Registered User (no UTM link)
- `2006` = Active User (reject lead)
