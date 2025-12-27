const mysql = require('mysql2/promise');
require('dotenv').config();

// Remote Database Configuration
const dbConfig = {
  host: process.env.DB_HOST || '13.235.194.211',
  user: process.env.DB_USER || 'pocket',
  password: process.env.DB_PASSWORD || 'Pocket@9988',
  database: process.env.DB_NAME || 'pocket',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 20, // Increased from 10
  queueLimit: 0,
  acquireTimeout: 30000, // Reduced from 60000
  timeout: 30000, // Reduced from 60000
  reconnect: true,
  // MySQL2 specific options
  charset: 'utf8mb4',
  timezone: 'Asia/Kolkata',
  connectTimeout: 30000, // Reduced from 60000
  // Remove duplicate acquireTimeout and timeout
  idleTimeout: 300000, // 5 minutes
  maxReconnects: 3,
  reconnectDelay: 2000
};

// Create connection pool
let pool;

const initializePool = () => {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
    
    pool.on('connection', async (connection) => {
      console.log('🔌 New database connection established');
    });
    
    console.log('✅ MySQL connection pool initialized');
  }
  return pool;
};

// Get connection from pool
const getConnection = async () => {
  const pool = initializePool();
  return await pool.getConnection();
};

// Generic CRUD operations for MySQL
class MySQLModel {
  constructor(tableName) {
    this.tableName = tableName;
    this.pool = initializePool();
  }

  // Execute query with error handling
  async execute(query, params = []) {
    try {
      const [rows] = await this.pool.execute(query, params);
      return rows;
    } catch (error) {
      console.error(`Database error in ${this.tableName}:`, error.message);
      throw error;
    }
  }

  // Create a new record
  async create(data) {
    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data);

    const query = `INSERT INTO ${this.tableName} (${columns}) VALUES (${placeholders})`;
    const result = await this.execute(query, values);
    
    return {
      id: result.insertId,
      ...data,
      created_at: new Date(),
      updated_at: new Date()
    };
  }

  // Find all records with optional filter
  async findAll(filter = {}, options = {}) {
    let query = `SELECT * FROM ${this.tableName}`;
    const params = [];
    const conditions = [];

    // Build WHERE clause
    Object.keys(filter).forEach(key => {
      if (filter[key] !== undefined && filter[key] !== null) {
        if (Array.isArray(filter[key])) {
          const placeholders = filter[key].map(() => '?').join(', ');
          conditions.push(`${key} IN (${placeholders})`);
          params.push(...filter[key]);
        } else if (typeof filter[key] === 'string' && filter[key].includes('%')) {
          conditions.push(`${key} LIKE ?`);
          params.push(filter[key]);
        } else {
          conditions.push(`${key} = ?`);
          params.push(filter[key]);
        }
      }
    });

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Add ORDER BY
    if (options.orderBy) {
      const direction = options.orderDirection || 'ASC';
      query += ` ORDER BY ${options.orderBy} ${direction}`;
    }

    // Add LIMIT
    if (options.limit) {
      query += ` LIMIT ${options.limit}`;
      if (options.offset) {
        query += ` OFFSET ${options.offset}`;
      }
    }

    return await this.execute(query, params);
  }

  // Find one record by ID
  async findById(id) {
    const query = `SELECT * FROM ${this.tableName} WHERE id = ?`;
    const rows = await this.execute(query, [id]);
    return rows.length > 0 ? rows[0] : null;
  }

  // Find one record by filter
  async findOne(filter) {
    const rows = await this.findAll(filter, { limit: 1 });
    return rows.length > 0 ? rows[0] : null;
  }

  // Update a record
  async update(id, data) {
    const columns = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(data), id];

    const query = `UPDATE ${this.tableName} SET ${columns}, updated_at = NOW() WHERE id = ?`;
    const result = await this.execute(query, values);
    
    if (result.affectedRows === 0) {
      return null;
    }

    return await this.findById(id);
  }

  // Delete a record
  async delete(id) {
    const query = `DELETE FROM ${this.tableName} WHERE id = ?`;
    const result = await this.execute(query, [id]);
    return result.affectedRows > 0;
  }

  // Count records with optional filter
  async count(filter = {}) {
    let query = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    const params = [];
    const conditions = [];

    Object.keys(filter).forEach(key => {
      if (filter[key] !== undefined && filter[key] !== null) {
        conditions.push(`${key} = ?`);
        params.push(filter[key]);
      }
    });

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    const rows = await this.execute(query, params);
    return rows[0].count;
  }

  // Paginated find
  async findWithPagination(filter = {}, page = 1, limit = 10, sortBy = 'created_at', sortOrder = 'DESC') {
    const offset = (page - 1) * limit;
    const data = await this.findAll(filter, { 
      orderBy: sortBy, 
      orderDirection: sortOrder, 
      limit, 
      offset 
    });
    
    const totalRecords = await this.count(filter);
    const totalPages = Math.ceil(totalRecords / limit);

    return {
      data,
      pagination: {
        currentPage: page,
        totalPages,
        totalRecords,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        limit
      }
    };
  }

  // Bulk operations
  async bulkCreate(dataArray) {
    if (dataArray.length === 0) return [];

    const columns = Object.keys(dataArray[0]).join(', ');
    const values = dataArray.map(data => 
      `(${Object.values(data).map(() => '?').join(', ')})`
    ).join(', ');
    
    const allValues = dataArray.flatMap(data => Object.values(data));
    const query = `INSERT INTO ${this.tableName} (${columns}) VALUES ${values}`;
    
    await this.execute(query, allValues);
    return dataArray;
  }

  // Transaction support
  async transaction(callback) {
    const connection = await getConnection();
    
    try {
      await connection.beginTransaction();
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

// Model instances for each table
const User = new MySQLModel('users');
const EmploymentDetails = new MySQLModel('employment_details');
const FinancialDetails = new MySQLModel('financial_details');
const LoanApplication = new MySQLModel('loan_applications');
const VerificationRecord = new MySQLModel('verification_records');
const VideoKycRecord = new MySQLModel('video_kyc_records');
const DigitalSignature = new MySQLModel('digital_signatures');
const Loan = new MySQLModel('loans');
const Transaction = new MySQLModel('transactions');
const Notification = new MySQLModel('notifications');
const AdminUser = new MySQLModel('admin_users');
const ApiLog = new MySQLModel('api_logs');
const SystemSetting = new MySQLModel('system_settings');

// Utility functions
const generateApplicationNumber = () => {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `PC${timestamp}${random}`;
};

const generateLoanNumber = () => {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `LN${timestamp}${random}`;
};

// Get system setting
const getSystemSetting = async (key, defaultValue = null) => {
  try {
    const setting = await SystemSetting.findOne({ setting_key: key });
    if (!setting) return defaultValue;

    // Parse based on data type
    switch (setting.data_type) {
      case 'number':
        return parseFloat(setting.setting_value);
      case 'boolean':
        return setting.setting_value === 'true';
      case 'json':
        return JSON.parse(setting.setting_value);
      default:
        return setting.setting_value;
    }
  } catch (error) {
    console.error(`Error getting system setting ${key}:`, error);
    return defaultValue;
  }
};

// Set system setting
const setSystemSetting = async (key, value, description = '', dataType = 'string') => {
  try {
    let settingValue = value;
    
    // Convert based on data type
    if (dataType === 'json') {
      settingValue = JSON.stringify(value);
    } else if (typeof value !== 'string') {
      settingValue = String(value);
    }

    const existingSetting = await SystemSetting.findOne({ setting_key: key });
    
    if (existingSetting) {
      return await SystemSetting.update(existingSetting.id, {
        setting_value: settingValue,
        description,
        data_type: dataType
      });
    } else {
      return await SystemSetting.create({
        setting_key: key,
        setting_value: settingValue,
        description,
        data_type: dataType
      });
    }
  } catch (error) {
    console.error(`Error setting system setting ${key}:`, error);
    throw error;
  }
};

// Test database connection
const testConnection = async () => {
  try {
    const connection = await getConnection();
    await connection.execute('SELECT 1');
    connection.release();
    console.log('✅ Database connection test successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', error.message);
    return false;
  }
};

// Close all connections
const closeConnections = async () => {
  if (pool) {
    await pool.end();
    console.log('🔌 Database connections closed');
  }
};

module.exports = {
  initializePool,
  getConnection,
  MySQLModel,
  User,
  EmploymentDetails,
  FinancialDetails,
  LoanApplication,
  VerificationRecord,
  VideoKycRecord,
  DigitalSignature,
  Loan,
  Transaction,
  Notification,
  AdminUser,
  ApiLog,
  SystemSetting,
  generateApplicationNumber,
  generateLoanNumber,
  getSystemSetting,
  setSystemSetting,
  testConnection,
  closeConnections
};
