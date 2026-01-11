const redis = require('redis');
const { v4: uuidv4 } = require('uuid');

/**
 * Sanitize POST data to remove sensitive information but keep useful tracking data
 */
const sanitizePostData = (data) => {
  if (!data || typeof data !== 'object') return data;
  
  const sanitized = { ...data };
  
  // Remove sensitive fields
  const sensitiveFields = [
    'password', 'password_confirmation', 'token', 'secret', 'key',
    'otp', 'pin', 'cvv', 'card_number', 'account_number'
  ];
  
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  // Keep useful fields for tracking
  const keepFields = [
    'phone', 'email', 'first_name', 'last_name', 'amount', 
    'monthly_income', 'employment_type', 'loan_type', 'purpose'
  ];
  
  // Only keep useful fields and remove the rest
  const result = {};
  keepFields.forEach(field => {
    if (sanitized[field] !== undefined) {
      result[field] = sanitized[field];
    }
  });
  
  return Object.keys(result).length > 0 ? result : undefined;
};

// Redis client for activity logging
let redisClient;

// Initialize Redis client
const initializeRedis = async () => {
  if (!redisClient) {
    redisClient = redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          console.error('Redis server connection refused');
          return new Error('Redis server connection refused');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          console.error('Redis retry time exhausted');
          return new Error('Redis retry time exhausted');
        }
        if (options.attempt > 10) {
          console.error('Redis max retry attempts reached');
          return undefined;
        }
        return Math.min(options.attempt * 100, 3000);
      }
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
    });

    await redisClient.connect();
  }
  return redisClient;
};

// Activity types enum
const ACTIVITY_TYPES = {
  USER_REGISTRATION: 'user_registration',
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  LOAN_APPLICATION_CREATED: 'loan_application_created',
  LOAN_APPLICATION_UPDATED: 'loan_application_updated',
  LOAN_APPLICATION_APPROVED: 'loan_application_approved',
  LOAN_APPLICATION_REJECTED: 'loan_application_rejected',
  LOAN_APPLICATION_DISBURSED: 'loan_application_disbursed',
  DOCUMENT_UPLOADED: 'document_uploaded',
  DOCUMENT_VERIFIED: 'document_verified',
  DOCUMENT_REJECTED: 'document_rejected',
  KYC_COMPLETED: 'kyc_completed',
  KYC_FAILED: 'kyc_failed',
  PAYMENT_MADE: 'payment_made',
  PAYMENT_FAILED: 'payment_failed',
  ADMIN_LOGIN: 'admin_login',
  ADMIN_ACTION: 'admin_action',
  SYSTEM_EVENT: 'system_event'
};

// Activity priority levels
const PRIORITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

/**
 * Log activity to Redis
 * @param {Object} activityData - Activity data to log
 * @param {string} activityData.type - Activity type
 * @param {string} activityData.userId - User ID (optional)
 * @param {string} activityData.adminId - Admin ID (optional)
 * @param {string} activityData.action - Action description
 * @param {Object} activityData.metadata - Additional metadata
 * @param {string} activityData.priority - Priority level
 * @param {string} activityData.ipAddress - IP address
 * @param {string} activityData.userAgent - User agent
 */
const logActivity = async (activityData) => {
  try {
    const client = await initializeRedis();
    
    const activity = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      type: activityData.type || ACTIVITY_TYPES.SYSTEM_EVENT,
      userId: activityData.userId || null,
      adminId: activityData.adminId || null,
      action: activityData.action || 'Unknown action',
      metadata: activityData.metadata || {},
      priority: activityData.priority || PRIORITY_LEVELS.MEDIUM,
      ipAddress: activityData.ipAddress || null,
      userAgent: activityData.userAgent || null,
      processed: false
    };

    // Add to Redis list (FIFO queue)
    await client.lPush('activity_queue', JSON.stringify(activity));
    
    // Set expiration for the queue (24 hours)
    await client.expire('activity_queue', 86400);
    
    
  } catch (error) {
    console.error('❌ Failed to log activity:', error);
    // Don't throw error to avoid breaking the main request
  }
};

/**
 * Middleware to automatically log HTTP requests
 */
const activityLoggerMiddleware = (options = {}) => {
  return async (req, res, next) => {
    
    // Skip logging for certain paths
    const skipPaths = [
      '/api/health',
      '/api/admin/dashboard/stats',
      '/api/admin/applications/stats',
      '/favicon.ico'
    ];
    
    if (skipPaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // Capture original response methods
    const originalSend = res.send;
    const originalJson = res.json;
    
    // Track response
    res.send = function(data) {
      logRequestActivity(req, res, data);
      return originalSend.call(this, data);
    };
    
    res.json = function(data) {
      logRequestActivity(req, res, data);
      return originalJson.call(this, data);
    };

    next();
  };
};

/**
 * Log request activity based on the endpoint and response
 */
const logRequestActivity = async (req, res, data) => {
  try {
    
    const { method, path, user, admin } = req;
    
    // Safely parse response data
    let responseData;
    try {
      responseData = typeof data === 'string' ? JSON.parse(data) : data;
    } catch (parseError) {
      // If parsing fails, treat as non-JSON response
      console.warn('⚠️ Failed to parse response data as JSON:', parseError.message);
      responseData = { raw: data };
    }
    
    let activityType = ACTIVITY_TYPES.SYSTEM_EVENT;
    let action = `${method} ${path}`;
    let userId = null;
    let adminId = null;
    let metadata = {};

    // Only log important actions that change data - filter out GET requests and noise
    
    // USER AUTHENTICATION & REGISTRATION (Important!)
    if (path.includes('/login') && method === 'POST' && res.statusCode < 400) {
      activityType = ACTIVITY_TYPES.USER_LOGIN;
      action = 'User Login';
      userId = responseData?.data?.user?.id || responseData?.user?.id;
      metadata.phone = req.body?.mobile || req.body?.phone;
    } else if (path.includes('/verify-otp') && method === 'POST' && res.statusCode < 400) {
      activityType = ACTIVITY_TYPES.USER_LOGIN;
      action = 'User Verified OTP & Logged In';
      userId = responseData?.data?.user?.id || responseData?.user?.id;
      metadata.phone = req.body?.mobile;
      
    } else if (path.includes('/register') && method === 'POST' && res.statusCode < 400) {
      activityType = ACTIVITY_TYPES.USER_REGISTRATION;
      action = 'New User Registered';
      userId = responseData?.data?.user?.id || responseData?.user?.id;
      metadata.phone = req.body?.mobile || req.body?.phone;
      metadata.email = req.body?.email;
    
    // PROFILE UPDATES (Important!)
    } else if (path.includes('/profile/basic') && method === 'PUT' && res.statusCode < 400) {
      activityType = ACTIVITY_TYPES.USER_ACTION;
      action = 'Profile Basic Details Updated';
      userId = user?.id;
      metadata.firstName = req.body?.first_name;
      metadata.lastName = req.body?.last_name;
      metadata.email = req.body?.email;
    } else if (path.includes('/profile/additional') && method === 'PUT' && res.statusCode < 400) {
      activityType = ACTIVITY_TYPES.USER_ACTION;
      action = 'Profile Additional Details Updated';
      userId = user?.id;
      metadata.panNumber = req.body?.pan_number;
      metadata.city = req.body?.current_city;
    } else if (path.includes('/employment-details') && method === 'POST' && res.statusCode < 400) {
      activityType = ACTIVITY_TYPES.USER_ACTION;
      action = 'Employment Details Added';
      userId = user?.id;
      metadata.monthlyIncome = req.body?.monthly_income;
      metadata.employmentType = req.body?.employment_type;
      metadata.companyName = req.body?.company_name;
    
    // LOAN APPLICATIONS (Important!)
    } else if (path.includes('/loan-application') && method === 'POST' && res.statusCode < 400) {
      activityType = ACTIVITY_TYPES.LOAN_APPLICATION_CREATED;
      action = 'Loan Application Submitted';
      userId = user?.id;
      metadata.amount = req.body?.amount;
      metadata.loanType = req.body?.loan_type;
      metadata.purpose = req.body?.purpose;
    
    // ADMIN LOGIN (Important!)
    } else if (path.includes('/admin/login') && method === 'POST' && res.statusCode < 400) {
      activityType = ACTIVITY_TYPES.ADMIN_LOGIN;
      action = 'Admin Login';
      adminId = responseData?.data?.admin?.id || responseData?.admin?.id;
      metadata.email = req.body?.email;
    
    // ADMIN ACTIONS ON APPLICATIONS (Important!)
    } else if (path.includes('/admin/applications') && method === 'PATCH' && res.statusCode < 400) {
      activityType = ACTIVITY_TYPES.ADMIN_ACTION;
      const status = req.body?.status;
      if (status === 'approved') {
        action = 'Loan Application Approved';
      } else if (status === 'rejected') {
        action = 'Loan Application Rejected';
      } else {
        action = 'Loan Application Status Updated';
      }
      adminId = admin?.id;
      metadata.applicationId = req.params.id;
      metadata.newStatus = status;
      metadata.notes = req.body?.notes;
    
    // ADMIN ACTIONS ON USERS (Important!)
    } else if (path.includes('/admin/users') && method === 'PUT' && res.statusCode < 400) {
      activityType = ACTIVITY_TYPES.ADMIN_ACTION;
      action = 'User Profile Updated by Admin';
      adminId = admin?.id;
      metadata.targetUserId = req.params.id;
      metadata.updatedFields = Object.keys(req.body || {});
    
    // DOCUMENT UPLOADS (Important!)
    } else if (path.includes('/documents') && method === 'POST' && res.statusCode < 400) {
      activityType = ACTIVITY_TYPES.DOCUMENT_UPLOADED;
      action = 'Document Uploaded';
      userId = user?.id;
      metadata.documentType = req.body?.documentType;
    } else {
      // Skip logging for GET requests, health checks, and other non-important actions
      return;
    }

    // Log the activity
    await logActivity({
      type: activityType,
      userId,
      adminId,
      action,
      metadata: {
        ...metadata,
        method,
        path,
        statusCode: res.statusCode,
        responseTime: Date.now() - req.startTime,
        // Include sanitized POST data for tracking
        data: method === 'POST' && req.body ? sanitizePostData(req.body) : undefined
      },
      priority: res.statusCode >= 400 ? PRIORITY_LEVELS.HIGH : PRIORITY_LEVELS.MEDIUM,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    });

  } catch (error) {
    console.error('❌ Failed to log request activity:', error);
  }
};

/**
 * Manual activity logging function for specific events
 */
const logManualActivity = async (type, action, options = {}) => {
  await logActivity({
    type,
    action,
    userId: options.userId,
    adminId: options.adminId,
    metadata: options.metadata || {},
    priority: options.priority || PRIORITY_LEVELS.MEDIUM,
    ipAddress: options.ipAddress,
    userAgent: options.userAgent
  });
};

module.exports = {
  activityLoggerMiddleware,
  logActivity,
  logManualActivity,
  ACTIVITY_TYPES,
  PRIORITY_LEVELS,
  initializeRedis
};
