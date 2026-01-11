const Redis = require('ioredis');
require('dotenv').config();

/**
 * Redis Configuration Module
 * Handles Redis connection setup with robust error handling
 */

// Redis configuration from environment variables
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: 0, // Default database
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  keepAlive: 30000,
  connectTimeout: 10000,
  commandTimeout: 5000,
  // Enable retry on connection failure
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError(err) {
    const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
    if (targetErrors.some(targetError => err.message.includes(targetError))) {
      return true; // Reconnect
    }
    return false;
  },
  // Enable offline queue - this is critical for unstable connections
  enableOfflineQueue: true,
  enableReadyCheck: true,
  autoResubscribe: true,
  autoResendUnfulfilledCommands: true
};

// Redis client instance
let redisClient;

/**
 * Initialize Redis connection
 * @returns {Promise<Redis>} Redis client instance
 */
const initializeRedis = async () => {
  try {
    if (!redisClient) {
      redisClient = new Redis(redisConfig);
      
      // Set up event listeners
      redisClient.on('connect', () => {
      });
      
      redisClient.on('ready', () => {
      });
      
      redisClient.on('error', (error) => {
        console.error('❌ Redis client error:', error.message);
      });
      
      redisClient.on('close', () => {
      });
      
      redisClient.on('reconnecting', () => {
      });
      
      // Test the connection
      await redisClient.ping();
      
      return redisClient;
    }
    return redisClient;
  } catch (error) {
    console.error('❌ Failed to initialize Redis connection:');
    console.error('Error details:', error.message);
    console.error('Redis config:', {
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password ? '***' : 'none'
    });
    
    // Don't exit process for Redis failure, just log error
    // Redis is used for caching, not critical for basic functionality
    console.warn('⚠️  Continuing without Redis. Some features may be limited.');
    return null;
  }
};

/**
 * Get Redis client instance
 * @returns {Redis|null} Redis client or null if not initialized
 */
const getRedisClient = () => {
  return redisClient;
};

/**
 * Test Redis connection
 * @returns {Promise<boolean>} Connection status
 */
const testConnection = async () => {
  try {
    if (!redisClient) {
      console.warn('⚠️  Redis client not initialized');
      return false;
    }
    
    const result = await redisClient.ping();
    if (result === 'PONG') {
      return true;
    } else {
      console.error('❌ Redis ping failed');
      return false;
    }
  } catch (error) {
    console.error('❌ Redis connection test failed:', error.message);
    return false;
  }
};

/**
 * Close Redis connection
 * @returns {Promise<void>}
 */
const closeConnection = async () => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
};

/**
 * Set a key-value pair with optional expiry
 * @param {string} key - Redis key
 * @param {string|Object} value - Value to store
 * @param {number} ttl - Time to live in seconds (optional)
 * @returns {Promise<boolean>} Success status
 */
const set = async (key, value, ttl = null) => {
  try {
    if (!redisClient) {
      console.warn('⚠️  Redis not available, skipping set operation');
      return false;
    }
    
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : value;
    
    if (ttl) {
      await redisClient.setex(key, ttl, stringValue);
    } else {
      await redisClient.set(key, stringValue);
    }
    
    return true;
  } catch (error) {
    console.error('Redis set error:', error.message);
    return false;
  }
};

/**
 * Get a value by key
 * @param {string} key - Redis key
 * @returns {Promise<string|Object|null>} Retrieved value
 */
const get = async (key) => {
  try {
    if (!redisClient) {
      console.warn('⚠️  Redis not available, skipping get operation');
      return null;
    }
    
    const value = await redisClient.get(key);
    
    if (value === null) {
      return null;
    }
    
    // Try to parse as JSON, fallback to string
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  } catch (error) {
    console.error('Redis get error:', error.message);
    return null;
  }
};

/**
 * Delete a key
 * @param {string} key - Redis key
 * @returns {Promise<boolean>} Success status
 */
const del = async (key) => {
  try {
    if (!redisClient) {
      console.warn('⚠️  Redis not available, skipping delete operation');
      return false;
    }
    
    const result = await redisClient.del(key);
    return result > 0;
  } catch (error) {
    console.error('Redis delete error:', error.message);
    return false;
  }
};

/**
 * Check if a key exists
 * @param {string} key - Redis key
 * @returns {Promise<boolean>} Existence status
 */
const exists = async (key) => {
  try {
    if (!redisClient) {
      console.warn('⚠️  Redis not available, skipping exists check');
      return false;
    }
    
    const result = await redisClient.exists(key);
    return result === 1;
  } catch (error) {
    console.error('Redis exists error:', error.message);
    return false;
  }
};

/**
 * Set expiry for a key
 * @param {string} key - Redis key
 * @param {number} ttl - Time to live in seconds
 * @returns {Promise<boolean>} Success status
 */
const expire = async (key, ttl) => {
  try {
    if (!redisClient) {
      console.warn('⚠️  Redis not available, skipping expire operation');
      return false;
    }
    
    const result = await redisClient.expire(key, ttl);
    return result === 1;
  } catch (error) {
    console.error('Redis expire error:', error.message);
    return false;
  }
};

// Handle process termination
process.on('SIGINT', async () => {
  await closeConnection();
});

process.on('SIGTERM', async () => {
  await closeConnection();
});

module.exports = {
  initializeRedis,
  getRedisClient,
  testConnection,
  closeConnection,
  set,
  get,
  del,
  exists,
  expire
};
