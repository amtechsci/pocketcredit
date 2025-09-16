# Pocket Credit API Documentation

## Base URL
```
http://localhost:3002/api
```

## Authentication
The API uses mobile-based OTP authentication with 24-hour session cookies.

## Endpoints

### 1. Send OTP
**POST** `/api/auth/send-otp`

Sends an OTP to the provided mobile number for authentication.

#### Request Body
```json
{
  "mobile": "9876543210"
}
```

#### Response
```json
{
  "status": "success",
  "message": "OTP sent successfully",
  "data": {
    "mobile": "9876543210",
    "expiresIn": 300
  }
}
```

#### Error Response
```json
{
  "status": "error",
  "message": "Valid 10-digit mobile number is required"
}
```

#### cURL Example
```bash
curl -X POST http://localhost:3002/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"mobile": "9876543210"}'
```

---

### 2. Verify OTP
**POST** `/api/auth/verify-otp`

Verifies the OTP and creates a user session.

#### Request Body
```json
{
  "mobile": "9876543210",
  "otp": "123456"
}
```

#### Response (New User)
```json
{
  "status": "success",
  "message": "OTP verified successfully. Please complete your profile.",
  "data": {
    "user": {
      "id": 1,
      "phone": "9876543210",
      "phone_verified": true,
      "profile_completed": false,
      "profile_completion_step": 2,
      "first_name": null,
      "last_name": null,
      "email": null
    },
    "requires_profile_completion": true,
    "session_created": true
  }
}
```

#### Response (Existing User)
```json
{
  "status": "success",
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "phone": "9876543210",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@example.com",
      "phone_verified": true,
      "profile_completion_step": 4,
      "profile_completed": true
    },
    "requires_profile_completion": false,
    "session_created": true
  }
}
```

#### Error Response
```json
{
  "status": "error",
  "message": "Invalid or expired OTP"
}
```

#### cURL Example
```bash
curl -X POST http://localhost:3002/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"mobile": "9876543210", "otp": "123456"}'
```

---

### 3. Get User Profile
**GET** `/api/auth/profile`

Retrieves the current user's profile information.

#### Headers
```
Cookie: pocket-credit-session=session_id_here
```

#### Response
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": 1,
      "phone": "9876543210",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@example.com",
      "date_of_birth": "1990-01-01",
      "gender": "male",
      "marital_status": "single",
      "phone_verified": true,
      "email_verified": false,
      "kyc_completed": false,
      "status": "active",
      "created_at": "2025-01-27T10:00:00.000Z",
      "last_login_at": "2025-01-27T10:00:00.000Z",
      "profile_completed": true
    }
  }
}
```

#### Error Response
```json
{
  "status": "error",
  "message": "Not authenticated"
}
```

#### cURL Example
```bash
curl -X GET http://localhost:3002/api/auth/profile \
  -H "Cookie: pocket-credit-session=your_session_id"
```

---

### 4. Logout
**POST** `/api/auth/logout`

Logs out the current user and invalidates the session.

#### Headers
```
Cookie: pocket-credit-session=session_id_here
```

#### Response
```json
{
  "status": "success",
  "message": "Logged out successfully"
}
```

#### cURL Example
```bash
curl -X POST http://localhost:3002/api/auth/logout \
  -H "Cookie: pocket-credit-session=your_session_id"
```

---

---

### 5. Update Basic Profile
**PUT** `/api/user/profile/basic`

Updates basic profile details (Step 2 of profile completion).

#### Headers
```
Cookie: pocket-credit-session=session_id_here
```

#### Request Body
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john.doe@example.com",
  "date_of_birth": "1990-01-01",
  "gender": "male",
  "marital_status": "single"
}
```

#### Response
```json
{
  "status": "success",
  "message": "Basic profile updated successfully",
  "data": {
    "user": {
      "id": 1,
      "phone": "9876543210",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@example.com",
      "date_of_birth": "1990-01-01",
      "gender": "male",
      "marital_status": "single",
      "phone_verified": true,
      "profile_completion_step": 3,
      "profile_completed": false
    },
    "next_step": "additional_details",
    "step_completed": "basic_details"
  }
}
```

#### cURL Example
```bash
curl -X PUT http://localhost:3002/api/user/profile/basic \
  -H "Content-Type: application/json" \
  -H "Cookie: pocket-credit-session=your_session_id" \
  -d '{
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "date_of_birth": "1990-01-01",
    "gender": "male",
    "marital_status": "single"
  }'
```

---

### 6. Update Additional Profile
**PUT** `/api/user/profile/additional`

Updates additional profile details (Step 3 of profile completion).

#### Headers
```
Cookie: pocket-credit-session=session_id_here
```

#### Request Body
```json
{
  "address_line1": "123 Main Street",
  "address_line2": "Apt 4B",
  "city": "Mumbai",
  "state": "Maharashtra",
  "pincode": "400001",
  "country": "India",
  "pan_number": "ABCDE1234F"
}
```

#### Response
```json
{
  "status": "success",
  "message": "Profile completed successfully",
  "data": {
    "user": {
      "id": 1,
      "phone": "9876543210",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@example.com",
      "phone_verified": true,
      "profile_completion_step": 4,
      "profile_completed": true
    },
    "profile_completed": true,
    "step_completed": "additional_details"
  }
}
```

#### cURL Example
```bash
curl -X PUT http://localhost:3002/api/user/profile/additional \
  -H "Content-Type: application/json" \
  -H "Cookie: pocket-credit-session=your_session_id" \
  -d '{
    "address_line1": "123 Main Street",
    "address_line2": "Apt 4B",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001",
    "country": "India",
    "pan_number": "ABCDE1234F"
  }'
```

---

### 7. Get Profile Status
**GET** `/api/user/profile/status`

Gets the current profile completion status and progress.

#### Headers
```
Cookie: pocket-credit-session=session_id_here
```

#### Response
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": 1,
      "phone": "9876543210",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@example.com",
      "phone_verified": true,
      "profile_completion_step": 3,
      "profile_completed": false
    },
    "profile_status": {
      "current_step": 3,
      "step_name": "additional_details",
      "next_step": "complete",
      "is_complete": false,
      "progress_percentage": 75
    }
  }
}
```

#### cURL Example
```bash
curl -X GET http://localhost:3002/api/user/profile/status \
  -H "Cookie: pocket-credit-session=your_session_id"
```

---

## Loan Application Management

### 8. Apply for Loan
**POST** `/api/loan-applications/apply`

Submits a new loan application. **Requires complete profile (profile_completion_step = 4)**.

#### Headers
```
Cookie: pocket-credit-session=session_id_here
```

#### Request Body
```json
{
  "loan_amount": 500000,
  "tenure_months": 24,
  "loan_purpose": "Home renovation and furniture purchase",
  "interest_rate": 12.5,
  "emi_amount": 25000
}
```

#### Response (Success)
```json
{
  "status": "success",
  "message": "Loan application submitted successfully",
  "data": {
    "application": {
      "id": 1,
      "application_number": "PC12345678",
      "loan_amount": 500000,
      "loan_purpose": "Home renovation and furniture purchase",
      "tenure_months": 24,
      "interest_rate": 12.5,
      "emi_amount": 25000,
      "status": "submitted",
      "created_at": "2025-01-27T10:00:00.000Z"
    },
    "next_steps": [
      "Your application is under review",
      "You will receive updates via SMS and email",
      "Check your application status regularly"
    ]
  }
}
```

#### Response (Profile Incomplete - 403 Forbidden)
```json
{
  "status": "error",
  "message": "Please complete your profile before applying for a loan",
  "data": {
    "profile_completion_step": 2,
    "required_step": 4,
    "profile_completed": false
  }
}
```

#### Response (Validation Error)
```json
{
  "status": "error",
  "message": "Validation failed",
  "details": [
    "Minimum loan amount is ₹50,000",
    "Maximum tenure is 60 months"
  ]
}
```

#### cURL Example
```bash
curl -X POST http://localhost:3002/api/loan-applications/apply \
  -H "Content-Type: application/json" \
  -H "Cookie: pocket-credit-session=your_session_id" \
  -d '{
    "loan_amount": 500000,
    "tenure_months": 24,
    "loan_purpose": "Home renovation and furniture purchase",
    "interest_rate": 12.5
  }'
```

---

### 9. Get All Loan Applications
**GET** `/api/loan-applications`

Retrieves all loan applications for the current user.

#### Headers
```
Cookie: pocket-credit-session=session_id_here
```

#### Response
```json
{
  "status": "success",
  "data": {
    "applications": [
      {
        "id": 1,
        "application_number": "PC12345678",
        "loan_amount": 500000,
        "loan_purpose": "Home renovation",
        "tenure_months": 24,
        "interest_rate": 12.5,
        "emi_amount": 25000,
        "status": "submitted",
        "created_at": "2025-01-27T10:00:00.000Z"
      }
    ],
    "statistics": {
      "total_applications": 1,
      "submitted_count": 1,
      "under_review_count": 0,
      "approved_count": 0,
      "rejected_count": 0,
      "disbursed_count": 0,
      "total_approved_amount": 0
    },
    "total_applications": 1
  }
}
```

#### cURL Example
```bash
curl -X GET http://localhost:3002/api/loan-applications \
  -H "Cookie: pocket-credit-session=your_session_id"
```

---

### 10. Get Loan Application by ID
**GET** `/api/loan-applications/:applicationId`

Retrieves a specific loan application by ID.

#### Headers
```
Cookie: pocket-credit-session=session_id_here
```

#### Response
```json
{
  "status": "success",
  "data": {
    "application": {
      "id": 1,
      "application_number": "PC12345678",
      "loan_amount": 500000,
      "loan_purpose": "Home renovation",
      "tenure_months": 24,
      "interest_rate": 12.5,
      "emi_amount": 25000,
      "status": "submitted",
      "rejection_reason": null,
      "approved_at": null,
      "disbursed_at": null,
      "created_at": "2025-01-27T10:00:00.000Z",
      "updated_at": "2025-01-27T10:00:00.000Z"
    }
  }
}
```

#### cURL Example
```bash
curl -X GET http://localhost:3002/api/loan-applications/1 \
  -H "Cookie: pocket-credit-session=your_session_id"
```

---

### 11. Get Loan Application Statistics
**GET** `/api/loan-applications/stats/summary`

Retrieves loan application statistics for the current user.

#### Headers
```
Cookie: pocket-credit-session=session_id_here
```

#### Response
```json
{
  "status": "success",
  "data": {
    "statistics": {
      "total_applications": 3,
      "submitted_count": 1,
      "under_review_count": 1,
      "approved_count": 1,
      "rejected_count": 0,
      "disbursed_count": 0,
      "total_approved_amount": 500000
    }
  }
}
```

#### cURL Example
```bash
curl -X GET http://localhost:3002/api/loan-applications/stats/summary \
  -H "Cookie: pocket-credit-session=your_session_id"
```

---

### 4. Get User Profile
**GET** `/auth/profile`

Retrieves the current user's profile information.

#### Headers
```
Cookie: session_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Response
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": 1,
      "phone": "9876543210",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@example.com",
      "date_of_birth": "1990-01-01",
      "gender": "male",
      "marital_status": "single",
      "phone_verified": true,
      "profile_completed": true,
      "created_at": "2025-01-27T10:00:00.000Z"
    }
  }
}
```

#### cURL Example
```bash
curl -X GET http://localhost:3002/api/auth/profile \
  -H "Cookie: session_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### 5. Logout
**POST** `/auth/logout`

Logs out the current user and invalidates the session.

#### Headers
```
Cookie: session_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Response
```json
{
  "status": "success",
  "message": "Logged out successfully"
}
```

#### cURL Example
```bash
curl -X POST http://localhost:3002/api/auth/logout \
  -H "Cookie: session_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### 6. Health Check
**GET** `/health`

Checks if the API is running.

#### Response
```json
{
  "status": "success",
  "message": "Pocket Credit API is running",
  "timestamp": "2025-01-27T10:00:00.000Z",
  "version": "1.0.0"
}
```

#### cURL Example
```bash
curl -X GET http://localhost:3002/api/health
```

---

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid input data |
| 401 | Unauthorized - Invalid or missing session |
| 403 | Forbidden - Access denied |
| 404 | Not Found - Resource not found |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Server error |

## Rate Limiting
- 100 requests per 15 minutes per IP address
- OTP endpoints have additional rate limiting (5 requests per minute per mobile number)

## Security Features
- HTTP-only session cookies
- CORS protection
- Helmet security headers
- Input validation with Joi
- Rate limiting
- OTP expiry (5 minutes)
- Session expiry (24 hours)

## Database Schema
The API uses the following key tables:
- `users` - User profiles and authentication
- `otp_codes` - Temporary OTP storage (Redis)
- `sessions` - User session management
- `employment_details` - Employment information
- `financial_details` - Financial information
- `bank_details` - Banking information

## Environment Variables
```env
DB_HOST=localhost
DB_USER=pocket
DB_PASSWORD=your_password
DB_NAME=pocket
DB_PORT=3306
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your_jwt_secret
NODE_ENV=development
```
