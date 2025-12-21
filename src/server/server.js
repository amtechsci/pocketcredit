const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');

// function to load env from multiple possible paths
const loadEnv = () => {
  const possiblePaths = [
    path.join(__dirname, '.env'), // Current dir
    path.join(__dirname, '../.env'), // src/
    path.join(__dirname, '../../.env'), // project root
    path.join(process.cwd(), '.env') // CWD
  ];

  let loaded = false;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      console.log(`Trying to load .env from: ${p}`);
      const result = require('dotenv').config({ path: p });
      if (!result.error) {
        console.log(`✅ Loaded .env from ${p}`);
        loaded = true;
        break;
      }
    }
  }

  // Fallback to default load
  if (!loaded) {
    console.log('Trying default dotenv load...');
    require('dotenv').config();
  }
};

loadEnv();

// Validate required environment variables
const requiredEnvVars = ['JWT_SECRET', 'DB_HOST', 'DB_USER', 'DB_NAME'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0 && process.env.NODE_ENV === 'production') {
  console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
  console.error('💡 Please set these variables in your .env file');
  process.exit(1);
} else if (missingEnvVars.length > 0) {
  console.warn('⚠️  Missing environment variables (using defaults):', missingEnvVars.join(', '));
}

// Import configuration
const { initializeDatabase } = require('./config/database');
const { initializeRedis } = require('./config/redis');
const { initializeSession, sessionCleanup } = require('./middleware/session');

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const userInfoRoutes = require('./routes/userInfo');
const loanApplicationRoutes = require('./routes/loanApplicationRoutes');
const loanRoutes = require('./routes/loans');
const adminAuthRoutes = require('./routes/adminAuth');
const adminManagementRoutes = require('./routes/adminManagement');
const dashboardRoutes = require('./routes/dashboardRoutes');
const calculatorRoutes = require('./routes/calculators');
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
const adminFeeTypesRoutes = require('./routes/adminFeeTypes');
const adminLateFeesRoutes = require('./routes/adminLateFees');
const activityLogsRoutes = require('./routes/activityLogsSimple');
const eligibilityRoutes = require('./routes/eligibilityConfig');
const employmentQuickCheckRoutes = require('./routes/employmentQuickCheck');
const loanPlansRoutes = require('./routes/loanPlans');
const validationRoutes = require('./routes/validation');
const loanCalculationsRoutes = require('./routes/loanCalculations');
const kfsRoutes = require('./routes/kfs');
const postDisbursalRoutes = require('./routes/postDisbursal');
const { activityLoggerMiddleware } = require('./middleware/activityLogger');
const activityProcessor = require('./workers/activityProcessor');

const app = express();
const PORT = process.env.PORT || 3002;

// Trust proxy - required when behind reverse proxy (nginx, load balancer, etc.)
// Set to 1 to trust only the first proxy (more secure than true)
// This allows express-rate-limit to correctly identify client IPs from X-Forwarded-For header
// while preventing IP spoofing attacks
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate limiting (configurable via environment variables)
const rateLimitWindowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || (15 * 60 * 1000); // Default: 15 minutes
const rateLimitMax = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) ||
  (process.env.NODE_ENV === 'production' ? 200 : 5000); // Increased limits: 200 in prod, 5000 in dev

const limiter = rateLimit({
  windowMs: rateLimitWindowMs,
  max: rateLimitMax,
  message: {
    status: 'error',
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil(rateLimitWindowMs / 1000) // seconds
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false,
  // Fix trust proxy warning by using a custom key generator
  // This prevents IP spoofing when trust proxy is enabled
  keyGenerator: (req) => {
    // Use req.ip which respects trust proxy but is safer than X-Forwarded-For
    // For additional security, you could also validate the IP format
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    return ip;
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/api/health';
  },
  handler: (req, res) => {
    res.status(429).json({
      status: 'error',
      message: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil(rateLimitWindowMs / 1000),
      limit: rateLimitMax,
      window: Math.ceil(rateLimitWindowMs / 60000) + ' minutes'
    });
  }
});

console.log(`🛡️  Rate limiting: ${rateLimitMax} requests per ${Math.ceil(rateLimitWindowMs / 60000)} minutes (${process.env.NODE_ENV || 'development'} mode)`);
app.use('/api/', limiter);

// CORS configuration - Allow localhost and local network IPs
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, curl)
    if (!origin) return callback(null, true);

    // Allow localhost in any port
    if (origin.match(/^http:\/\/localhost(:\d+)?$/)) return callback(null, true);
    if (origin.match(/^https:\/\/localhost(:\d+)?$/)) return callback(null, true);
    if (origin.match(/^http:\/\/127\.0\.0\.1(:\d+)?$/)) return callback(null, true);

    // Allow local network IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    if (origin.match(/^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/)) return callback(null, true);
    if (origin.match(/^http:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/)) return callback(null, true);
    if (origin.match(/^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+(:\d+)?$/)) return callback(null, true);

    // Allow production domain
    if (origin === 'https://pocketcredit.in') return callback(null, true);

    // Reject all others
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
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
app.use('/api/user-info', userInfoRoutes);
app.use('/api/loan-applications', loanApplicationRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin', adminManagementRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/calculators', calculatorRoutes);
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
app.use('/api/admin/fee-types', adminFeeTypesRoutes);
app.use('/api/admin/late-fees', adminLateFeesRoutes);
app.use('/api/admin/activities', activityLogsRoutes);
app.use('/api/eligibility', eligibilityRoutes);
app.use('/api/employment-quick-check', employmentQuickCheckRoutes);
app.use('/api/loan-plans', loanPlansRoutes);
app.use('/api/validation', validationRoutes);
app.use('/api/admin/loan-calculations', loanCalculationsRoutes);
app.use('/api/kfs', kfsRoutes);
app.use('/api/post-disbursal', postDisbursalRoutes);

// eNACH Subscription routes
// IMPORTANT: Register webhook routes FIRST to ensure they match before other routes
const enachWebhookRoutes = require('./routes/enachWebhooks');
const enachRoutes = require('./routes/enach');
app.use('/api/enach', enachWebhookRoutes);  // Webhooks on /api/enach/webhook - must be first!
app.use('/api/enach', enachRoutes);

// Cashfree Payout routes (loan disbursement)
const payoutRoutes = require('./routes/payout');
const payoutWebhookRoutes = require('./routes/payoutWebhooks');
app.use('/api/payout', payoutWebhookRoutes);  // Webhooks on /api/payout/webhook - must be first!
app.use('/api/payout', payoutRoutes);

// ClickWrap (e-Signature) routes
const clickWrapRoutes = require('./routes/clickWrap');
const clickWrapWebhookRoutes = require('./routes/clickWrapWebhooks');
app.use('/api/clickwrap', clickWrapRoutes);
app.use('/api/clickwrap', clickWrapWebhookRoutes);  // Webhooks on /api/clickwrap/webhook

// Payment Gateway routes (One-time payments)
const paymentRoutes = require('./routes/payment');
app.use('/api/payment', paymentRoutes);



// Digitap API routes
const digitapRoutes = require('./routes/digitap');
app.use('/api/digitap', digitapRoutes);

const studentDocumentsRoutes = require('./routes/studentDocuments');
app.use('/api/student-documents', studentDocumentsRoutes);

const loanApplicationDocumentsRoutes = require('./routes/loanApplicationDocuments');
app.use('/api/loan-documents', loanApplicationDocumentsRoutes);

// Admin route for loan documents
const { authenticateAdmin } = require('./middleware/auth');
const adminLoanDocumentsRouter = express.Router();
adminLoanDocumentsRouter.get('/:applicationId', authenticateAdmin, async (req, res) => {
  try {
    const { executeQuery, initializeDatabase } = require('./config/database');
    await initializeDatabase();
    const { applicationId } = req.params;

    // Verify loan application exists
    const applications = await executeQuery(
      'SELECT id, user_id FROM loan_applications WHERE id = ?',
      [applicationId]
    );

    if (!applications || applications.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Loan application not found'
      });
    }

    // Get all documents for this application
    const documents = await executeQuery(
      `SELECT id, document_name, document_type, file_name, file_size, mime_type, 
              upload_status, uploaded_at, verified_at, verification_notes
       FROM loan_application_documents 
       WHERE loan_application_id = ? 
       ORDER BY uploaded_at DESC`,
      [applicationId]
    );

    console.log(`📄 Admin documents response: ${documents?.length || 0} documents found for loan ${applicationId}`);
    if (documents && documents.length > 0) {
      documents.forEach((doc) => {
        console.log(`  - ${doc.document_name} (${doc.document_type}) - ${doc.upload_status}`);
      });
    }

    res.json({
      status: 'success',
      success: true,
      data: {
        documents: documents || []
      }
    });

  } catch (error) {
    console.error('Get documents error (admin):', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to fetch documents'
    });
  }
});
app.use('/api/admin/loan-documents', adminLoanDocumentsRouter);

// Email OTP routes
const emailOtpRoutes = require('./routes/emailOtp');
app.use('/api/email-otp', emailOtpRoutes);

// User Residence routes (merged with userRoutes, but keeping separate for clarity)
const userResidenceRoutes = require('./routes/userResidence');
app.use('/api/user', userResidenceRoutes);

// Digilocker KYC routes
const digilockerRoutes = require('./routes/digilocker');
app.use('/api/digilocker', digilockerRoutes);

// Digilocker Webhook (callback from Digilocker after KYC)
const digiwebhookRoutes = require('./routes/digiwebhook');
app.use('/api/digiwebhook', digiwebhookRoutes);

// Account Aggregator routes (bank statement verification)
const accountAggregatorRoutes = require('./routes/accountAggregator');
app.use('/api/aa', accountAggregatorRoutes);

// User Bank Statement routes (profile-level, one-time)
const userBankStatementRoutes = require('./routes/userBankStatement');
app.use('/api/bank-statement', userBankStatementRoutes);

// Development-only routes (disabled in production for security)
if (process.env.NODE_ENV !== 'production') {
  const testDigitapRoutes = require('./routes/testDigitap');
  app.use('/api/test-digitap', testDigitapRoutes);

  const checkTableRoutes = require('./routes/checkTable');
  app.use('/api/check-table', checkTableRoutes);

  console.log('🧪 Development routes enabled');
}

// Companies autocomplete
const companiesRoutes = require('./routes/companies');
app.use('/api/companies', companiesRoutes);

// Credit Analytics (Experian credit check)
const creditAnalyticsRoutes = require('./routes/creditAnalytics');
app.use('/api/credit-analytics', creditAnalyticsRoutes);

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
  console.error('Error handler caught error:', err);
  console.error('Error stack:', err.stack);
  console.error('Request path:', req.path);
  console.error('Request method:', req.method);

  // Don't send response if it's already been sent
  if (res.headersSent) {
    console.error('Response already sent, skipping error handler');
    return next(err);
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      status: 'error',
      message: 'File size too large. Maximum size is 10MB.'
    });
  }

  res.status(500).json({
    success: false,
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