const mysql = require('mysql2/promise');
require('dotenv').config();

/**
 * Database Configuration Module
 * Handles MySQL connection pool setup with robust error handling and connection validation
 */

// Database configuration from environment variables
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pocket_credit',
  port: process.env.DB_PORT || 3306,
  // Connection pool settings
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  acquireTimeout: 10000, // 10 seconds
  // Connection settings
  charset: 'utf8mb4',
  timezone: 'Asia/Kolkata',
  connectTimeout: 10000, // 10 seconds
  // Connection validation and retry settings
  reconnect: false, // Let our custom logic handle reconnection
  // Enable SSL if required
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

// Create connection pool
let pool;

/**
 * Initialize database connection pool
 * @returns {Promise<mysql.Pool>} MySQL connection pool
 */
const initializeDatabase = async () => {
  try {
    if (!pool) {
      pool = mysql.createPool(dbConfig);
      
      // Add connection pool event handlers for monitoring
      pool.on('connection', async (connection) => {
        console.log('🔌 New database connection established');
        // Set MySQL session timezone to Asia/Kolkata
        try {
          await connection.execute("SET time_zone = '+05:30'");
        } catch (error) {
          console.warn('⚠️  Failed to set MySQL timezone:', error.message);
        }
      });
      
      pool.on('acquire', (connection) => {
        console.log('📥 Connection acquired from pool');
      });
      
      pool.on('release', (connection) => {
        console.log('📤 Connection released back to pool');
      });
      
      pool.on('error', (err) => {
        console.error('❌ Database pool error:', err.message);
        // Don't exit the process on pool errors, let the retry logic handle it
      });
      
      // Test the connection with validation
      const connection = await getValidatedConnection();
      connection.release();
      
      console.log('✅ MySQL database connection pool initialized successfully');
      console.log(`📊 Connected to database: ${dbConfig.database}@${dbConfig.host}:${dbConfig.port}`);
      console.log(`🔧 Pool settings: ${dbConfig.connectionLimit} max connections, ${dbConfig.acquireTimeout}ms timeout`);
      
      return pool;
    }
    return pool;
  } catch (error) {
    console.error('❌ Failed to initialize database connection:');
    console.error('Error details:', error.message);
    console.error('Database config:', {
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      user: dbConfig.user
    });
    
    // Exit process if database connection fails
    console.error('🛑 Exiting process due to database connection failure');
    process.exit(1);
  }
};

/**
 * Get database connection pool
 * @returns {mysql.Pool} MySQL connection pool
 */
const getPool = () => {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializeDatabase() first.');
  }
  return pool;
};

/**
 * Test database connection
 * @returns {Promise<boolean>} Connection status
 */
const testConnection = async () => {
  try {
    const currentPool = getPool();
    const connection = await currentPool.getConnection();
    await connection.execute('SELECT 1');
    connection.release();
    console.log('✅ Database connection test successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', error.message);
    return false;
  }
};

/**
 * Close all database connections
 * @returns {Promise<void>}
 */
const closeConnections = async () => {
  if (pool) {
    await pool.end();
    console.log('🔌 Database connections closed');
    pool = null;
  }
};

/**
 * Validate and test a database connection
 * @param {mysql.PoolConnection} connection - Database connection
 * @returns {Promise<boolean>} Connection validity
 */
const validateConnection = async (connection) => {
  try {
    await connection.execute('SELECT 1');
    return true;
  } catch (error) {
    console.warn('⚠️  Connection validation failed:', error.message);
    return false;
  }
};

/**
 * Get a validated connection from the pool with retry logic
 * @param {number} maxRetries - Maximum number of retry attempts
 * @returns {Promise<mysql.PoolConnection>} Validated database connection
 */
const getValidatedConnection = async (maxRetries = 3) => {
  const currentPool = getPool();
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const connection = await currentPool.getConnection();
      
      // Set MySQL session timezone to Asia/Kolkata
      try {
        await connection.execute("SET time_zone = '+05:30'");
      } catch (error) {
        console.warn('⚠️  Failed to set MySQL timezone:', error.message);
      }
      
      // Validate the connection
      const isValid = await validateConnection(connection);
      
      if (isValid) {
        return connection;
      } else {
        // Connection is stale, release it and try again
        connection.release();
        console.warn(`⚠️  Stale connection detected, retrying... (attempt ${attempt}/${maxRetries})`);
      }
    } catch (error) {
      lastError = error;
      console.warn(`⚠️  Connection attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries) {
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }
  
  throw new Error(`Failed to get valid database connection after ${maxRetries} attempts. Last error: ${lastError?.message}`);
};

/**
 * Execute a query with robust connection handling
 * @param {string} query - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} Query results
 */
const executeQuery = async (query, params = []) => {
  let connection;
  
  try {
    // Get a validated connection
    connection = await getValidatedConnection();
    
    // Set query timeout to 5 seconds
    await connection.execute('SET SESSION wait_timeout = 5');
    
    // Execute the query
    const [rows] = await connection.execute(query, params);
    return rows;
  } catch (error) {
    console.error('Database query error:', error.message);
    console.error('Query:', query);
    console.error('Params:', params);
    throw error;
  } finally {
    // Always release the connection back to the pool
    if (connection) {
      connection.release();
    }
  }
};

/**
 * Get a connection from the pool
 * @returns {Promise<mysql.PoolConnection>} Database connection
 */
const getConnection = async () => {
  try {
    const currentPool = getPool();
    return await currentPool.getConnection();
  } catch (error) {
    console.error('Failed to get database connection:', error.message);
    throw error;
  }
};

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT. Closing database connections...');
  await closeConnections();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM. Closing database connections...');
  await closeConnections();
  process.exit(0);
});

module.exports = {
  initializeDatabase,
  getPool,
  testConnection,
  closeConnections,
  executeQuery,
  getConnection,
  getValidatedConnection,
  validateConnection
};
