# Pocket Credit Backend API

A comprehensive Node.js backend for the Pocket Credit lending platform with JSON file-based database storage.

## 🚀 Features

- **Complete REST API** for lending platform operations
- **JSON File Database** - No external database required
- **Authentication & Authorization** with JWT tokens
- **Admin Panel APIs** with role-based access control
- **File Upload Support** for document management
- **Mock External Integrations** (CIBIL, PAN verification, SMS)
- **Comprehensive Validation** with Joi
- **Rate Limiting** and security middleware
- **Auto-initialization** with sample data

## 📋 Prerequisites

- Node.js 16+ 
- npm or yarn

## 🛠 Installation & Setup

1. **Navigate to server directory:**
   ```bash
   cd server
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the server:**
   ```bash
   # Development mode with auto-reload
   npm run dev
   
   # Production mode
   npm start
   ```

4. **Initialize database (automatic on first run):**
   ```bash
   npm run init-db
   ```

## 🌐 API Endpoints

### Base URL: `http://localhost:3001/api`

### Authentication Routes (`/auth`)
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/admin/login` - Admin login
- `POST /auth/send-otp` - Send OTP
- `POST /auth/verify-otp` - Verify OTP
- `POST /auth/mobile-login` - Login with mobile + OTP
- `POST /auth/refresh-token` - Refresh JWT token
- `POST /auth/forgot-password` - Forgot password
- `POST /auth/reset-password` - Reset password

### User Management (`/users`)
- `GET /users/profile` - Get user profile
- `PUT /users/profile` - Update profile
- `GET /users/dashboard` - Dashboard data
- `GET /users/bank-info` - Bank information
- `POST /users/bank-info` - Add/update bank info
- `GET /users/references` - Get references
- `POST /users/references` - Add reference
- `GET /users/documents` - Get documents
- `GET /users/transactions` - Get transactions
- `GET /users/loans` - Get user loans
- `POST /users/change-password` - Change password

### Loan Management (`/loans`)
- `POST /loans/apply` - Apply for loan
- `POST /loans/eligibility` - Check eligibility
- `GET /loans/offers` - Get personalized offers
- `GET /loans/:loanId/status` - Get loan status
- `POST /loans/:loanId/cancel` - Cancel loan
- `GET /loans/:loanId/emi-schedule` - EMI schedule
- `GET /loans/:loanId/preclosure` - Pre-closure calculation

### Document Management (`/documents`)
- `GET /documents` - Get user documents
- `POST /documents/upload` - Upload document
- `GET /documents/:id` - Get document details
- `GET /documents/:id/download` - Download document
- `GET /documents/:id/view` - View document
- `PUT /documents/:id` - Update document
- `DELETE /documents/:id` - Delete document
- `GET /documents/requirements/:loanType` - Get requirements

### Admin APIs (`/admin`) 🔒
- `GET /admin/dashboard` - Admin dashboard stats
- `GET /admin/users` - Get all users (paginated)
- `GET /admin/users/:id` - Get user profile detail
- `PUT /admin/users/:id` - Update user profile
- `GET /admin/loans` - Get all loans (filtered)
- `GET /admin/loans/:loanId` - Get loan details
- `POST /admin/loans/:loanId/approve` - Approve loan
- `POST /admin/loans/:loanId/reject` - Reject loan
- `POST /admin/users/:userId/notes` - Add admin note
- `POST /admin/users/:userId/follow-ups` - Schedule follow-up
- `POST /admin/users/:userId/send-sms` - Send SMS
- `POST /admin/documents/:docId/verify` - Verify/reject document
- `GET /admin/team` - Get admin team
- `GET /admin/settings` - System settings

### Calculators (`/calculators`)
- `POST /calculators/emi` - EMI calculator
- `POST /calculators/eligibility` - Eligibility calculator
- `GET /calculators/interest-rates` - Interest rate matrix
- `POST /calculators/compare` - Loan comparison
- `POST /calculators/prepayment` - Prepayment calculator

### Verification Services (`/verification`)
- `POST /verification/cibil` - Verify CIBIL score
- `POST /verification/pan` - Verify PAN details
- `POST /verification/bank` - Verify bank account
- `GET /verification/status` - Get verification status
- `GET /verification/eligibility` - Check verification eligibility

### Transactions (`/transactions`)
- `GET /transactions` - Get transactions (paginated)
- `GET /transactions/:id` - Get transaction details
- `POST /transactions/emi-payment` - Make EMI payment
- `POST /transactions/prepayment` - Make prepayment
- `GET /transactions/summary/analytics` - Transaction analytics
- `POST /transactions/:id/retry` - Retry failed transaction

### Dashboard (`/dashboard`)
- `GET /dashboard` - User dashboard data
- `GET /dashboard/loans` - Loan portfolio
- `GET /dashboard/payment-calendar` - Payment calendar
- `GET /dashboard/credit-score` - Credit score details
- `PUT /dashboard/notifications/:id/read` - Mark notification read

### Notifications (`/notifications`)
- `POST /notifications/sms/send` - Send SMS
- `GET /notifications/sms/templates` - SMS templates
- `GET /notifications/sms/history` - SMS history
- `POST /notifications/admin/sms/send/:userId` - Admin send SMS
- `POST /notifications/admin/sms/bulk` - Bulk SMS
- `POST /notifications/automated/loan-status` - Automated notifications
- `GET /notifications/statistics` - Notification stats

## 🔐 Authentication

### User Authentication
```bash
# Register
POST /api/auth/register
{
  "name": "John Doe",
  "email": "john@example.com",
  "mobile": "9876543210",
  "password": "password123",
  "dateOfBirth": "1990-01-01",
  "panNumber": "ABCDE1234F"
}

# Login
POST /api/auth/login
{
  "email": "john@example.com",
  "password": "password123"
}
```

### Admin Authentication
```bash
POST /api/auth/admin/login
{
  "email": "admin@pocketcredit.com",
  "password": "admin123"
}
```

## 🎭 Demo Credentials

### Admin Users
- **Super Admin:** `admin@pocketcredit.com` / `admin123`
- **Manager:** `manager@pocketcredit.com` / `admin123`  
- **Officer:** `officer@pocketcredit.com` / `admin123`

### Regular Users
- **User:** `rajesh.kumar@email.com` / `password123`
- **User:** `anjali.sharma@email.com` / `password123`

## 📁 File Structure

```
server/
├── routes/           # API route handlers
│   ├── auth.js      # Authentication routes
│   ├── users.js     # User management
│   ├── loans.js     # Loan operations
│   ├── admin.js     # Admin panel APIs
│   ├── documents.js # Document management
│   ├── dashboard.js # Dashboard data
│   ├── calculators.js # Loan calculators
│   ├── verification.js # External verifications
│   ├── transactions.js # Payment transactions
│   └── notifications.js # SMS/Email notifications
├── middleware/      # Custom middleware
│   ├── auth.js     # JWT authentication
│   └── validation.js # Request validation
├── utils/          # Utility functions
│   └── database.js # JSON database operations
├── scripts/        # Database scripts
│   └── initDatabase.js # Sample data setup
├── data/           # JSON database files
│   └── database.json # Main database
├── uploads/        # File uploads
│   └── documents/  # Document uploads
└── server.js       # Main server file
```

## 🗄️ Database Schema

The JSON database contains the following collections:

- **users** - User accounts and profiles
- **admins** - Admin users with roles/permissions
- **loans** - Loan applications and details
- **documents** - Uploaded document metadata
- **transactions** - Payment and financial transactions
- **notes** - Admin notes on users
- **followUps** - Admin follow-up schedules
- **smsLog** - SMS communication history
- **loginHistory** - User login tracking
- **references** - User reference contacts
- **bankInfo** - Bank account information
- **cibilData** - Credit score data
- **panData** - PAN verification data
- **otpCodes** - OTP verification codes (temporary)

## 🔧 Configuration

### Environment Variables
```env
PORT=3001
NODE_ENV=development
JWT_SECRET=pocket-credit-secret-key-2025
```

### Rate Limiting
- **General API:** 100 requests per 15 minutes per IP
- **File uploads:** 10MB max file size
- **SMS:** Realistic delays and success rates

## 🧪 Testing the API

### Using curl:
```bash
# Health check
curl http://localhost:3001/api/health

# Register user
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","mobile":"9876543210","password":"test123","dateOfBirth":"1990-01-01","panNumber":"ABCDE1234F"}'

# Login and get token
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# Use token for authenticated requests
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3001/api/users/profile
```

## 🚀 Production Deployment

For production deployment:

1. **Set environment variables:**
   ```bash
   export NODE_ENV=production
   export JWT_SECRET=your-secure-secret-key
   export PORT=3001
   ```

2. **Use PM2 for process management:**
   ```bash
   npm install -g pm2
   pm2 start server.js --name pocket-credit-api
   ```

3. **Setup reverse proxy (Nginx):**
   ```nginx
   location /api {
     proxy_pass http://localhost:3001;
     proxy_set_header Host $host;
     proxy_set_header X-Real-IP $remote_addr;
   }
   ```

## 📈 Monitoring & Logs

- API logs are output to console
- Error handling with appropriate HTTP status codes
- Request/response logging for debugging
- Health check endpoint for monitoring

## 🤝 Integration with Frontend

The API is designed to work seamlessly with the React frontend. Key integration points:

- **CORS enabled** for frontend origins
- **JWT tokens** for session management
- **File upload endpoints** for document management
- **Real-time status updates** via polling
- **Comprehensive error responses**

---

**🔗 API Documentation:** Access `http://localhost:3001/api/health` to verify the server is running.

**📞 Support:** Check logs in console for detailed error information and debugging.