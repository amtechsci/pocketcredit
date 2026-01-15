# Pocket Credit - Partner API Setup Guide

## Overview

This guide is for **Pocket Credit** (you) to set up and manage the Partner API system.

## Step 1: Generate Your RSA Key Pair

You need one RSA key pair that all partners will use to encrypt their AES keys.

### Generate Keys

```bash
cd /var/www/pocket/src
mkdir -p partner_keys
cd partner_keys

# Generate private key
openssl genrsa -out pocketcredit_private.pem 2048

# Extract public key
openssl rsa -in pocketcredit_private.pem -pubout -out pocketcredit_public.pem

# Set secure permissions
chmod 600 pocketcredit_private.pem
chmod 644 pocketcredit_public.pem
```

### Your Keys

- **Private Key**: `/var/www/pocket/src/partner_keys/pocketcredit_private.pem`
  - Keep this SECRET - never share!
  - Used to decrypt AES keys from partners

- **Public Key**: `/var/www/pocket/src/partner_keys/pocketcredit_public.pem`
  - Share this with ALL partners
  - Partners use it to encrypt their AES keys

## Step 2: Configure Environment

Add to your `.env` file:

```bash
PARTNER_PRIVATE_KEY_PATH=/var/www/pocket/src/partner_keys/pocketcredit_private.pem
PARTNER_API_ENCRYPTION_ENABLED=true
```

## Step 3: Share Your Public Key with Partners

Send your public key to partners via secure email or portal:

```bash
cat /var/www/pocket/src/partner_keys/pocketcredit_public.pem
```

**Your Public Key:**
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

## Step 4: Receive Partner's Public Key

When a partner shares their public key with you:

### Store Partner's Public Key

```bash
# Create partners directory
mkdir -p /var/www/pocket/src/partner_keys/partners

# Save partner's public key
nano /var/www/pocket/src/partner_keys/partners/PC_3267MCL11_public.pem
# Paste partner's public key, save and exit

chmod 644 /var/www/pocket/src/partner_keys/partners/PC_3267MCL11_public.pem
```

### Update Database

```sql
UPDATE partners 
SET public_key_path = '/var/www/pocket/src/partner_keys/partners/PC_3267MCL11_public.pem'
WHERE partner_uuid = 'PC_3267MCL11';
```

## Step 5: Restart Server

After configuration:

```bash
# If using PM2
pm2 restart pocket-api

# If using systemd
sudo systemctl restart pocket-api
```

## Step 6: Verify Setup

Check that everything is configured:

```sql
SELECT 
    partner_uuid,
    name,
    public_key_path,
    CASE 
        WHEN public_key_path IS NOT NULL THEN '✅ Configured'
        ELSE '❌ Not Configured'
    END as encryption_status
FROM partners
WHERE is_active = 1;
```

## File Structure

```
/var/www/pocket/src/partner_keys/
├── pocketcredit_private.pem          ← Your private key (KEEP SECRET)
├── pocketcredit_public.pem            ← Your public key (SHARE WITH PARTNERS)
└── partners/
    ├── PC_3267MCL11_public.pem       ← Partner 1's public key
    ├── PC_7588_public.pem            ← Partner 2's public key
    └── ...
```

## Key Management Summary

### Your Keys (Pocket Credit)
- **One key pair** for all partners
- **Public key**: Share with all partners
- **Private key**: Keep secret, never share

### Partner Keys
- **One public key per partner** (stored by you)
- **Partner's private key**: Partner keeps it (you never see it)

## Testing Encrypted API

### Extract Partner Public Key (For Testing)

If you're testing and have `partner_private.pem`:

```bash
node src/server/scripts/extractPartnerPublicKey.js
```

This extracts the public key and saves it to the partners directory.

### Decrypt Test Response

If you receive an encrypted response during testing:

```bash
# Update encryptedResponse in decryptResponse.js with your response
node src/server/scripts/decryptResponse.js
```

## Troubleshooting

### Error: "Missing Parameters!"
- Check partner has `public_key_path` in database
- Verify partner's public key file exists at that path
- Check server logs for decryption errors

### Error: "Invalid signature"
- Partner's public key doesn't match their private key
- Signature verification failed
- Check partner is using correct private key

### Error: "Decryption failed"
- Your private key path is incorrect
- Partner used wrong public key to encrypt
- Check environment variable `PARTNER_PRIVATE_KEY_PATH`

## Quick Reference

**Generate Your Keys:**
```bash
openssl genrsa -out pocketcredit_private.pem 2048
openssl rsa -in pocketcredit_private.pem -pubout -out pocketcredit_public.pem
```

**Share with Partners:**
- `pocketcredit_public.pem` (your public key)

**Store from Partners:**
- `partners/{PARTNER_UUID}_public.pem` (partner's public key)

**Environment Variables:**
```bash
PARTNER_PRIVATE_KEY_PATH=/var/www/pocket/src/partner_keys/pocketcredit_private.pem
PARTNER_API_ENCRYPTION_ENABLED=true
```

## Security Checklist

- ✅ Private key permissions: `600` (owner read/write only)
- ✅ Public keys: `644` (readable)
- ✅ Private key never committed to git
- ✅ Public key shared via secure channel
- ✅ Partner public keys stored securely
- ✅ Environment variables set correctly
