const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '../data/database.json');

// Default database structure
const defaultDatabase = {
  users: [],
  admins: [],
  loans: [],
  documents: [],
  transactions: [],
  notes: [],
  followUps: [],
  smsLog: [],
  loginHistory: [],
  references: [],
  bankInfo: [],
  cibilData: [],
  panData: [],
  otpCodes: [],
  settings: {
    smsEnabled: true,
    emailEnabled: true,
    maxLoanAmount: 5000000,
    minCreditScore: 600,
    interestRates: {
      personal: { min: 12, max: 24 },
      business: { min: 14, max: 28 }
    }
  },
  metadata: {
    lastUpdated: new Date().toISOString(),
    version: '1.0.0'
  }
};

// Read database
const readDatabase = () => {
  try {
    if (!fs.existsSync(DB_PATH)) {
      writeDatabase(defaultDatabase);
      return defaultDatabase;
    }
    
    const data = fs.readFileSync(DB_PATH, 'utf8');
    const db = JSON.parse(data);
    
    // Ensure all required collections exist
    Object.keys(defaultDatabase).forEach(key => {
      if (!db[key]) {
        db[key] = defaultDatabase[key];
      }
    });
    
    return db;
  } catch (error) {
    console.error('Error reading database:', error);
    return defaultDatabase;
  }
};

// Write database
const writeDatabase = (data) => {
  try {
    // Update metadata
    data.metadata = {
      ...data.metadata,
      lastUpdated: new Date().toISOString()
    };
    
    // Ensure directory exists
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing database:', error);
    return false;
  }
};

// Generic CRUD operations
class DatabaseModel {
  constructor(collection) {
    this.collection = collection;
  }

  // Create a new record
  create(data) {
    const db = readDatabase();
    const newRecord = {
      id: uuidv4(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    db[this.collection].push(newRecord);
    writeDatabase(db);
    return newRecord;
  }

  // Find all records with optional filter
  findAll(filter = {}) {
    const db = readDatabase();
    let records = db[this.collection] || [];
    
    // Apply filters
    if (Object.keys(filter).length > 0) {
      records = records.filter(record => {
        return Object.keys(filter).every(key => {
          if (filter[key] === undefined || filter[key] === null) return true;
          
          // Handle array contains
          if (Array.isArray(record[key])) {
            return record[key].includes(filter[key]);
          }
          
          // Handle string partial match
          if (typeof filter[key] === 'string' && typeof record[key] === 'string') {
            return record[key].toLowerCase().includes(filter[key].toLowerCase());
          }
          
          return record[key] === filter[key];
        });
      });
    }
    
    return records;
  }

  // Find one record by ID
  findById(id) {
    const db = readDatabase();
    return db[this.collection].find(record => record.id === id) || null;
  }

  // Find one record by filter
  findOne(filter) {
    const records = this.findAll(filter);
    return records.length > 0 ? records[0] : null;
  }

  // Update a record
  update(id, data) {
    const db = readDatabase();
    const index = db[this.collection].findIndex(record => record.id === id);
    
    if (index === -1) {
      return null;
    }
    
    db[this.collection][index] = {
      ...db[this.collection][index],
      ...data,
      updatedAt: new Date().toISOString()
    };
    
    writeDatabase(db);
    return db[this.collection][index];
  }

  // Delete a record
  delete(id) {
    const db = readDatabase();
    const index = db[this.collection].findIndex(record => record.id === id);
    
    if (index === -1) {
      return false;
    }
    
    const deletedRecord = db[this.collection].splice(index, 1)[0];
    writeDatabase(db);
    return deletedRecord;
  }

  // Count records with optional filter
  count(filter = {}) {
    return this.findAll(filter).length;
  }

  // Paginated find
  findWithPagination(filter = {}, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc') {
    const records = this.findAll(filter);
    
    // Sort records
    records.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      
      if (sortOrder === 'desc') {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      } else {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      }
    });
    
    // Calculate pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedRecords = records.slice(startIndex, endIndex);
    
    return {
      data: paginatedRecords,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(records.length / limit),
        totalRecords: records.length,
        hasNext: endIndex < records.length,
        hasPrev: startIndex > 0,
        limit
      }
    };
  }

  // Bulk operations
  bulkCreate(dataArray) {
    const db = readDatabase();
    const newRecords = dataArray.map(data => ({
      id: uuidv4(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
    
    db[this.collection].push(...newRecords);
    writeDatabase(db);
    return newRecords;
  }

  bulkUpdate(filter, updateData) {
    const db = readDatabase();
    let updatedCount = 0;
    
    db[this.collection] = db[this.collection].map(record => {
      const shouldUpdate = Object.keys(filter).every(key => record[key] === filter[key]);
      
      if (shouldUpdate) {
        updatedCount++;
        return {
          ...record,
          ...updateData,
          updatedAt: new Date().toISOString()
        };
      }
      
      return record;
    });
    
    writeDatabase(db);
    return { updatedCount };
  }

  bulkDelete(filter) {
    const db = readDatabase();
    const originalLength = db[this.collection].length;
    
    db[this.collection] = db[this.collection].filter(record => {
      return !Object.keys(filter).every(key => record[key] === filter[key]);
    });
    
    const deletedCount = originalLength - db[this.collection].length;
    writeDatabase(db);
    return { deletedCount };
  }
}

// Model instances
const User = new DatabaseModel('users');
const Admin = new DatabaseModel('admins');
const Loan = new DatabaseModel('loans');
const Document = new DatabaseModel('documents');
const Transaction = new DatabaseModel('transactions');
const Note = new DatabaseModel('notes');
const FollowUp = new DatabaseModel('followUps');
const SmsLog = new DatabaseModel('smsLog');
const LoginHistory = new DatabaseModel('loginHistory');
const Reference = new DatabaseModel('references');
const BankInfo = new DatabaseModel('bankInfo');
const CibilData = new DatabaseModel('cibilData');
const PanData = new DatabaseModel('panData');
const OtpCode = new DatabaseModel('otpCodes');

// Utility functions
const generateId = () => uuidv4();

const getNextSequence = (sequenceName) => {
  const db = readDatabase();
  if (!db.sequences) {
    db.sequences = {};
  }
  
  if (!db.sequences[sequenceName]) {
    db.sequences[sequenceName] = 1000;
  }
  
  db.sequences[sequenceName] += 1;
  writeDatabase(db);
  return db.sequences[sequenceName];
};

// Clean up expired records (e.g., OTP codes)
const cleanupExpiredRecords = () => {
  const now = new Date();
  
  // Clean expired OTP codes (valid for 10 minutes)
  const db = readDatabase();
  db.otpCodes = db.otpCodes.filter(otp => {
    const expiryTime = new Date(otp.createdAt).getTime() + (10 * 60 * 1000);
    return now.getTime() < expiryTime;
  });
  
  writeDatabase(db);
};

// Run cleanup every hour
setInterval(cleanupExpiredRecords, 60 * 60 * 1000);

module.exports = {
  readDatabase,
  writeDatabase,
  DatabaseModel,
  User,
  Admin,
  Loan,
  Document,
  Transaction,
  Note,
  FollowUp,
  SmsLog,
  LoginHistory,
  Reference,
  BankInfo,
  CibilData,
  PanData,
  OtpCode,
  generateId,
  getNextSequence,
  cleanupExpiredRecords
};