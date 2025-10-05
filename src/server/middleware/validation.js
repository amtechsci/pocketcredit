const Joi = require('joi');

// Common validation schemas
const schemas = {
  // User registration
  userRegistration: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    mobile: Joi.string().pattern(/^[6-9]\d{9}$/).required(),
    password: Joi.string().min(6).required(),
    dateOfBirth: Joi.date().max('now').required(),
    panNumber: Joi.string().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).required()
  }),

  // User login
  userLogin: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  // OTP verification
  otpVerification: Joi.object({
    mobile: Joi.string().pattern(/^[6-9]\d{9}$/).required(),
    otp: Joi.string().length(6).required()
  }),

  // Loan application
  loanApplication: Joi.object({
    amount: Joi.number().min(10000).max(5000000).required(),
    tenure: Joi.number().min(6).max(60).required(),
    purpose: Joi.string().min(5).max(200).required(),
    type: Joi.string().valid('personal', 'business').required(),
    monthlyIncome: Joi.number().min(15000).required(),
    employmentType: Joi.string().valid('salaried', 'self-employed').required(),
    companyName: Joi.string().min(2).max(100).required()
  }),

  // Profile update
  profileUpdate: Joi.object({
    name: Joi.string().min(2).max(100),
    dateOfBirth: Joi.date().max('now'),
    fatherName: Joi.string().min(2).max(100),
    motherName: Joi.string().min(2).max(100),
    spouseName: Joi.string().min(2).max(100).allow(''),
    address: Joi.string().min(10).max(200),
    city: Joi.string().min(2).max(50),
    state: Joi.string().min(2).max(50),
    pincode: Joi.string().pattern(/^\d{6}$/),
    maritalStatus: Joi.string().valid('single', 'married', 'divorced', 'widowed')
  }),

  // Admin login
  adminLogin: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  // User Profile Detail schemas
  userDocument: Joi.object({
    type: Joi.string().min(2).max(100).required(),
    description: Joi.string().min(5).max(500).required(),
    fileName: Joi.string().min(1).max(255).required(),
    fileSize: Joi.string().min(1).max(50).required(),
    priority: Joi.string().valid('low', 'medium', 'high').default('medium')
  }),

  userBankDetail: Joi.object({
    bankName: Joi.string().min(2).max(100).required(),
    accountNumber: Joi.string().min(9).max(20).required(),
    ifscCode: Joi.string().pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/).required(),
    accountType: Joi.string().valid('savings', 'current', 'salary').required(),
    branchName: Joi.string().min(2).max(100).required(),
    accountHolderName: Joi.string().min(2).max(100).required(),
    averageBalance: Joi.number().min(0).default(0),
    relationshipLength: Joi.string().min(1).max(50).default('0 years'),
    loanAccounts: Joi.number().min(0).default(0),
    overdueAmount: Joi.number().min(0).default(0),
    currentEMIs: Joi.number().min(0).default(0),
    networth: Joi.number().min(0).default(0),
    notes: Joi.string().max(1000).allow('')
  }),

  userReference: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    relationship: Joi.string().min(2).max(50).required(),
    phone: Joi.string().pattern(/^[6-9]\d{9}$/).required(),
    email: Joi.string().email().allow(''),
    address: Joi.string().min(5).max(200).required(),
    occupation: Joi.string().min(2).max(100).allow(''),
    company: Joi.string().min(2).max(100).allow(''),
    contactPreference: Joi.string().valid('phone', 'email', 'both').default('phone'),
    notes: Joi.string().max(1000).allow('')
  }),

  userTransaction: Joi.object({
    type: Joi.string().valid('loan_disbursement', 'emi_payment', 'processing_fee', 'penalty', 'refund', 'other').required(),
    amount: Joi.number().min(0).required(),
    description: Joi.string().min(5).max(200).required(),
    category: Joi.string().min(2).max(50).required(),
    paymentMethod: Joi.string().valid('bank_transfer', 'upi', 'cheque', 'cash', 'card').required(),
    referenceNumber: Joi.string().min(1).max(100).required(),
    status: Joi.string().valid('pending', 'completed', 'failed', 'cancelled').default('pending'),
    priority: Joi.string().valid('low', 'medium', 'high').default('medium'),
    bankDetails: Joi.string().max(200).allow(''),
    notes: Joi.string().max(1000).allow('')
  }),

  userFollowUp: Joi.object({
    type: Joi.string().valid('call', 'email', 'sms', 'meeting', 'other').required(),
    priority: Joi.string().valid('low', 'medium', 'high').required(),
    subject: Joi.string().min(5).max(200).required(),
    description: Joi.string().min(10).max(1000).required(),
    assignedTo: Joi.string().min(2).max(100).required(),
    dueDate: Joi.date().min('now').required(),
    scheduledTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).allow(''),
    estimatedDuration: Joi.number().min(5).max(480).allow(null),
    contactMethod: Joi.string().valid('phone', 'email', 'sms', 'meeting', 'other').required(),
    status: Joi.string().valid('pending', 'in_progress', 'completed', 'cancelled').default('pending'),
    reminderSettings: Joi.object({
      enabled: Joi.boolean().default(true),
      reminderTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).allow(''),
      reminderType: Joi.string().valid('email', 'sms', 'both').default('email')
    }).allow(null),
    notes: Joi.string().max(1000).allow('')
  }),

  userNote: Joi.object({
    category: Joi.string().valid('general', 'loan', 'payment', 'follow_up', 'document', 'other').required(),
    priority: Joi.string().valid('low', 'medium', 'high').required(),
    subject: Joi.string().min(5).max(200).required(),
    content: Joi.string().min(10).max(2000).required(),
    visibility: Joi.string().valid('private', 'team', 'public').default('private'),
    status: Joi.string().valid('active', 'archived', 'deleted').default('active')
  }),

  userSms: Joi.object({
    message: Joi.string().min(10).max(160).required(),
    templateId: Joi.string().min(1).max(100).allow(''),
    scheduledTime: Joi.date().min('now').allow(null),
    priority: Joi.string().valid('low', 'medium', 'high').default('medium')
  }),

  // Admin Applications schemas
  updateApplicationStatus: Joi.object({
    status: Joi.string().valid('applied', 'under_review', 'approved', 'rejected', 'disbursed', 'pending_documents').required(),
    reason: Joi.string().max(500).allow(''),
    assignedManager: Joi.string().min(2).max(100).allow(''),
    recoveryOfficer: Joi.string().min(2).max(100).allow('')
  }),

  assignApplication: Joi.object({
    assignedManager: Joi.string().min(2).max(100).required(),
    recoveryOfficer: Joi.string().min(2).max(100).required()
  }),

  // Admin note
  adminNote: Joi.object({
    note: Joi.string().min(5).max(1000).required(),
    type: Joi.string().valid('general', 'assessment', 'verification', 'warning', 'approval', 'rejection').required(),
    category: Joi.string().valid('positive', 'neutral', 'negative', 'critical').required(),
    visibility: Joi.string().valid('internal', 'team', 'customer').required()
  }),

  // Follow-up
  followUp: Joi.object({
    note: Joi.string().min(5).max(1000).required(),
    nextFollowUp: Joi.date().min('now').required(),
    priority: Joi.string().valid('low', 'medium', 'high', 'urgent').required(),
    type: Joi.string().valid('phone_call', 'email', 'sms', 'document_check', 'reference_call').required(),
    assignedOfficer: Joi.string().required()
  }),

  // SMS message
  smsMessage: Joi.object({
    message: Joi.string().min(1).max(160).required(),
    type: Joi.string().valid('application_received', 'document_request', 'document_received', 'loan_approved', 'loan_rejected', 'custom').required()
  }),

  // Bank information
  bankInfo: Joi.object({
    bankName: Joi.string().min(2).max(100).required(),
    accountNumber: Joi.string().min(8).max(20).required(),
    ifscCode: Joi.string().pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/).required(),
    accountType: Joi.string().valid('savings', 'current').required(),
    accountHolderName: Joi.string().min(2).max(100).required(),
    branchName: Joi.string().min(2).max(100).required()
  }),

  // Reference information
  reference: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    relationship: Joi.string().valid('friend', 'colleague', 'family', 'neighbor', 'other').required(),
    phone: Joi.string().pattern(/^[6-9]\d{9}$/).required(),
    email: Joi.string().email().required(),
    address: Joi.string().min(10).max(200).required()
  })
};

// Validation middleware factory
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body);
    
    if (error) {
      const errorMessage = error.details.map(detail => detail.message).join(', ');
      return res.status(400).json({
        status: 'error',
        message: 'Validation error',
        details: errorMessage
      });
    }
    
    req.validatedData = value;
    next();
  };
};

// Query parameter validation
const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query);
    
    if (error) {
      const errorMessage = error.details.map(detail => detail.message).join(', ');
      return res.status(400).json({
        status: 'error',
        message: 'Query validation error',
        details: errorMessage
      });
    }
    
    req.validatedQuery = value;
    next();
  };
};

// Common query schemas
const querySchemas = {
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sortBy: Joi.string().valid('createdAt', 'updatedAt', 'name', 'email', 'amount', 'status').default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
  }),

  loanFilter: Joi.object({
    status: Joi.string().valid('pending', 'under_review', 'approved', 'rejected', 'disbursed', 'active', 'closed'),
    type: Joi.string().valid('personal', 'business'),
    minAmount: Joi.number().min(0),
    maxAmount: Joi.number().min(0),
    fromDate: Joi.date(),
    toDate: Joi.date(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10)
  }),

  userFilter: Joi.object({
    kycStatus: Joi.string().valid('pending', 'submitted', 'verified', 'rejected'),
    riskCategory: Joi.string().valid('low', 'medium', 'high'),
    memberLevel: Joi.string().valid('bronze', 'silver', 'gold', 'platinum'),
    search: Joi.string().min(2).max(100),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10)
  })
};

module.exports = {
  validate,
  validateQuery,
  schemas,
  querySchemas
};