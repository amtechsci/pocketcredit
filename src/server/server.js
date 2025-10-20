const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import configuration
const { initializeDatabase } = require('./config/database');
const { initializeRedis } = require('./config/redis');
const { initializeSession, sessionCleanup } = require('./middleware/session');

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const loanApplicationRoutes = require('./routes/loanApplicationRoutes');
const loanRoutes = require('./routes/loans');
const adminAuthRoutes = require('./routes/adminAuth');
const adminManagementRoutes = require('./routes/adminManagement');
const documentRoutes = require('./routes/documents');
const dashboardRoutes = require('./routes/dashboard');
const calculatorRoutes = require('./routes/calculators');
const verificationRoutes = require('./routes/verification');
const transactionRoutes = require('./routes/transactions');
const notificationRoutes = require('./routes/notifications');
const employmentRoutes = require('./routes/employment');
const bankDetailsRoutes = require('./routes/bankDetails');
const referencesRoutes = require('./routes/references');
const userProfileRoutes = require('./routes/userProfile');
const adminApplicationsRoutes = require('./routes/adminApplications');
const adminDashboardRoutes = require('./routes/adminDashboard');
const adminUsersRoutes = require('./routes/adminUsers');
const adminSettingsRoutes = require('./routes/adminSettings');
const adminLoanTiersRoutes = require('./routes/adminLoanTiers');
const adminLoanPlansRoutes = require('./routes/adminLoanPlans');
const adminLateFeesRoutes = require('./routes/adminLateFees');
const activityLogsRoutes = require('./routes/activityLogsSimple');
const eligibilityRoutes = require('./routes/eligibilityConfig');
const employmentQuickCheckRoutes = require('./routes/employmentQuickCheck');
const loanPlansRoutes = require('./routes/loanPlans');
const validationRoutes = require('./routes/validation');
const loanCalculationsRoutes = require('./routes/loanCalculations');
const kfsRoutes = require('./routes/kfs');
const { activityLoggerMiddleware } = require('./middleware/activityLogger');
const activityProcessor = require('./workers/activityProcessor');

const app = express();
const PORT = process.env.PORT || 3002;

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate limiting (more lenient for development)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs (increased for development)
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// CORS configuration
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'https://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'Accept', 'Origin', 'X-Requested-With'],
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
}));

// Handle preflight requests manually
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, Accept, Origin, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser middleware
app.use(cookieParser());

// Activity logging middleware
app.use(activityLoggerMiddleware());

// Session middleware
app.use(initializeSession());

// Session cleanup middleware
// app.use(sessionCleanup());

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/loan-applications', loanApplicationRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin', adminManagementRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/calculators', calculatorRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/employment-details', employmentRoutes);
app.use('/api/bank-details', bankDetailsRoutes);
app.use('/api/references', referencesRoutes);
app.use('/api/admin/user-profile', userProfileRoutes);
app.use('/api/admin/applications', adminApplicationsRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/admin/users', adminUsersRoutes);
app.use('/api/admin/settings', adminSettingsRoutes);
app.use('/api/admin/loan-tiers', adminLoanTiersRoutes);
app.use('/api/admin/loan-plans', adminLoanPlansRoutes);
app.use('/api/admin/late-fees', adminLateFeesRoutes);
app.use('/api/admin/activities', activityLogsRoutes);
app.use('/api/eligibility', eligibilityRoutes);
app.use('/api/employment-quick-check', employmentQuickCheckRoutes);
app.use('/api/loan-plans', loanPlansRoutes);
app.use('/api/validation', validationRoutes);
app.use('/api/loan-calculations', loanCalculationsRoutes);
app.use('/api/kfs', kfsRoutes);

// Digitap API routes
const digitapRoutes = require('./routes/digitap');
app.use('/api/digitap', digitapRoutes);

const studentDocumentsRoutes = require('./routes/studentDocuments');
app.use('/api/student-documents', studentDocumentsRoutes);

// Email OTP routes
const emailOtpRoutes = require('./routes/emailOtp');
app.use('/api/email-otp', emailOtpRoutes);

// Digilocker KYC routes
const digilockerRoutes = require('./routes/digilocker');
app.use('/api/digilocker', digilockerRoutes);

// Digilocker Webhook (callback from Digilocker after KYC)
const digiwebhookRoutes = require('./routes/digiwebhook');
app.use('/api/digiwebhook', digiwebhookRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'success',
    message: 'Pocket Credit API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      status: 'error',
      message: 'File size too large. Maximum size is 10MB.'
    });
  }
  
  res.status(500).json({
    status: 'error',
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'API endpoint not found'
  });
});

// Initialize database and Redis connections
const startServer = async () => {
  try {
    // Initialize database connection
    await initializeDatabase();
    
    // Initialize Redis connection
    await initializeRedis();
    
    // Start activity processor
    await activityProcessor.start();
    
    // Start the server
    app.listen(PORT, () => {
      console.log(`🚀 Pocket Credit API server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
      console.log(`📚 API Base URL: http://localhost:${PORT}/api`);
      console.log(`🔐 Authentication: http://localhost:${PORT}/api/auth`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

// Start the server
startServer();

module.exports = app;