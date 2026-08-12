# Bank API Client Integration (Account Aggregator)

Pocket Credit provides a **B2B HTTP API** so your platform (e.g. AssuredSum) can run **Account Aggregator / bank statement** flows for your end users.

**Your backend** calls Pocket → Pocket calls Digitap → the user completes verification on Digitap’s hosted page.

This is **not** the [Lead Partner API](./Partner_API_Documentation.md) (dedupe, UTM, lead dashboard).

---

## Base URL

```text
Production: https://pocketcredit.in/api/v1/bank-api
Development: http://localhost:3002/api/v1/bank-api
```

All paths below are relative to this base (e.g. `POST /login` → `{BASE}/login`).

---

## Credentials (from Pocket)

Pocket creates one row per integrator in **`api_clients`**. You receive **once** at onboarding:

| Credential | Your env variable | Usage |
|------------|-------------------|--------|
| `client_id` | `BANK_API_CLIENT_ID` | Basic auth username for login |
| `client_secret` | `BANK_API_CLIENT_SECRET` | Basic auth password for login |
| `client_uuid` | `BANK_API_CLIENT_UUID` | Webhook HMAC + reference in login response |
| `webhook_signing_secret` | `BANK_API_WEBHOOK_SIGNING_SECRET` | Verify `X-Pocket-Signature` on callbacks |

Example integrator `.env`:

```env
BANK_API_BASE=https://pocketcredit.in/api/v1/bank-api
BANK_API_CLIENT_ID=ASSUREDSUM
BANK_API_CLIENT_SECRET=<from Pocket — store securely>
BANK_API_CLIENT_UUID=<uuid from Pocket>
BANK_API_WEBHOOK_SIGNING_SECRET=<webhook_signing_secret from Pocket>
```

You do **not** need any Pocket server secrets. Access tokens are obtained via **`/login`** and used as Bearer tokens.

---

## Integration flow

```text
1. POST /login          → access_token (15 min)
2. POST /initiate       → redirect_url for end user
3. Browser/WebView      → user completes Digitap (AA / net banking / upload)
4. User lands on        → your return_url
5. Optional: POST       → your callback_url (signed webhook)
6. GET /status or /report → poll until complete
```

---

## Authentication

### Login

`POST /login`

```http
Authorization: Basic base64(client_id:client_secret)
Content-Type: application/json
```

**Success (200):**

```json
{
  "status": true,
  "code": 2000,
  "message": "Success",
  "data": {
    "access_token": "eyJ...",
    "refresh_token": "eyJ...",
    "token_type": "Bearer",
    "expires_in": 900,
    "client_uuid": "acc9b47f-aa91-41c6-a8fe-d3af5bd5e012"
  }
}
```

- **`expires_in`**: 900 seconds (15 minutes).
- Use **`access_token`** on all other endpoints.

### Refresh token

`POST /refresh-token`

```http
Authorization: Basic base64(client_id:client_secret)
refresh_token: <refresh_token from login>
```

Returns a new `access_token`.

### Authenticated requests

```http
Authorization: Bearer <access_token>
```

---

## API endpoints

Requires Bearer token except login and refresh.

### Initiate bank statement / AA

`POST /initiate`

**Body (JSON):**

| Field | Required | Description |
|-------|----------|-------------|
| `external_ref` | Yes | Your unique id for this attempt (idempotency) |
| `mobile_number` | Yes | Indian mobile: 10 digits, starts with 6–9 |
| `return_url` | Yes | HTTPS URL where Digitap sends the user after completion |
| `callback_url` | No | HTTPS URL for Pocket server-to-server status events |
| `destination` | No | `accountaggregator` (default), `netbanking`, or `statementupload` |
| `bank_name` | No | Optional hint |

**Success (200):**

```json
{
  "status": true,
  "code": 2000,
  "message": "Bank statement collection initiated successfully",
  "data": {
    "redirect_url": "https://...",
    "request_id": 123456,
    "client_ref_num": "AK0000011730123456789",
    "external_ref": "your-ref-001",
    "expires_at": "2026-07-29T12:00:00.000Z",
    "status": "pending"
  }
}
```

**Your app:** redirect the end user to **`data.redirect_url`** (full page or WebView).

**Idempotency:** Same `external_ref` while the session is still pending and not expired returns the same `redirect_url`. After completion, re-initiate with a new `external_ref` if the user must verify again.

---

### Status

`GET /status?request_id={id}` **or** `GET /status?external_ref={ref}`

Provide **exactly one** query parameter.

**Success (200) — example:**

```json
{
  "status": true,
  "code": 2000,
  "message": "Success",
  "data": {
    "external_ref": "your-ref-001",
    "request_id": 123456,
    "client_ref_num": "AK...",
    "status": "InProgress",
    "has_report": false,
    "destination": "accountaggregator",
    "created_at": "...",
    "updated_at": "..."
  }
}
```

Poll until `has_report` is true or `status` indicates completion, then call **report**.

---

### Report

`GET /report?request_id={id}` **or** `GET /report?external_ref={ref}`

Optional: `include_xml=true` for raw AA/FI XML (large).

**Success (200):** `data.report` contains Digitap’s JSON analysis.

**Not ready (409):** `code` 4090 — retry with backoff.

**Not found (404):** Wrong id/ref or belongs to another client.

---

## Webhooks (`callback_url`)

If you set **`callback_url`** on initiate, Pocket sends **POST** requests when status updates.

**Body:**

```json
{
  "event": "bank_statement.completed",
  "external_ref": "your-ref-001",
  "request_id": 123456,
  "client_ref_num": "AK...",
  "status": "completed"
}
```

**Events:** `bank_statement.in_progress`, `bank_statement.completed`

**Header:** `X-Pocket-Signature: sha256=<hex>`

### Verify signature

1. Read the **raw HTTP body** (before re-serializing JSON).
2. HMAC-SHA256 with key:

   ```text
   {BANK_API_WEBHOOK_SIGNING_SECRET}:{BANK_API_CLIENT_UUID}
   ```

3. Compare (constant-time) to the hex value after `sha256=` in the header.

**Node example:**

```javascript
const crypto = require('crypto');

function verifyWebhook(rawBody, signatureHeader, webhookSigningSecret, clientUuid) {
  const expected = signatureHeader.replace(/^sha256=/i, '');
  const hmac = crypto
    .createHmac('sha256', `${webhookSigningSecret}:${clientUuid}`)
    .update(rawBody, 'utf8')
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(hmac, 'hex'));
}
```

Respond with **2xx** quickly. Fetch full report via **`GET /report`** if needed.

Digitap does **not** call your servers; only Pocket does.

---

## Example (cURL)

```bash
BASE=https://pocketcredit.in/api/v1/bank-api

TOKEN=$(curl -s -X POST "$BASE/login" \
  -u "$BANK_API_CLIENT_ID:$BANK_API_CLIENT_SECRET" \
  | jq -r '.data.access_token')

curl -s -X POST "$BASE/initiate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "external_ref": "loan-app-98765-v1",
    "mobile_number": "9876543210",
    "return_url": "https://yourapp.com/bank-verify/done",
    "callback_url": "https://yourapp.com/api/webhooks/pocket-bank",
    "destination": "accountaggregator"
  }'

curl -s "$BASE/status?external_ref=loan-app-98765-v1" \
  -H "Authorization: Bearer $TOKEN"

curl -s "$BASE/report?external_ref=loan-app-98765-v1" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Error codes

### Auth

| HTTP | `code` | Meaning |
|------|--------|---------|
| 401 | 4210 | Authentication failed |
| 401 | 4211 | Invalid `client_id` / `client_secret` |
| 403 | 4212 | IP not allowlisted |
| 401 | 4214 | Bearer token missing |
| 401 | 4215 | Invalid token |
| 401 | 4217 | Token expired |

### Business

| HTTP | `code` | Meaning |
|------|--------|---------|
| 400 | 2003 | Validation error |
| 404 | 4040 | Request not found |
| 409 | 4090 | Report not ready |
| 503 | 5001 | Digitap initiate failed |
| 500 | 5000 | Internal error |

---

## Optional request encryption

If Pocket enables encryption for your client (RSA public key on file), **`POST /initiate`** may accept an encrypted envelope (`clientId`, `encryptedKey`, `encryptedData`, …) matching the [Lead Partner encryption](./Partner_API_Documentation.md#encryption-optional) format, with `clientId` = your `client_uuid` or `client_id`. Status and report remain plain JSON unless agreed otherwise.

---

## Pocket operations (internal)

- Create clients: `POST /api/admin/api-clients` (superadmin) or `node src/server/scripts/createApiClient.js`
- Migrations: `add_api_clients_and_bank_statement.sql`, `add_api_client_webhook_signing_secret.sql` if upgrading
- Optional IP allowlist on the client record

---

## Integrator checklist

- [ ] Received `client_id`, `client_secret`, `client_uuid`, `webhook_signing_secret`
- [ ] Configured env vars on your server
- [ ] Implemented login + token refresh
- [ ] Implemented initiate + user redirect to `redirect_url`
- [ ] Implemented status/report polling and/or webhook verification
- [ ] Tested end-to-end in staging or production

---

## Deprecated

Do not use `/api/v1/partner/bank-statement/*` or lead **partners** credentials for this product. Use **`/api/v1/bank-api`** only.
