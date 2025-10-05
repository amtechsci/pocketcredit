// Load environment variables first
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const redis = require('redis');
const { executeQuery, initializeDatabase } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class ActivityProcessor {
  constructor() {
    this.redisClient = null;
    this.isProcessing = false;
    this.batchSize = 100;
    this.processingInterval = 5 * 60 * 1000; // 5 minutes
    this.intervalId = null;
  }

  /**
   * Initialize Redis connection
   */
  async initializeRedis() {
    if (!this.redisClient) {
      this.redisClient = redis.createClient({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            console.error('Redis server connection refused in worker');
            return new Error('Redis server connection refused');
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            console.error('Redis retry time exhausted in worker');
            return new Error('Redis retry time exhausted');
          }
          if (options.attempt > 10) {
            console.error('Redis max retry attempts reached in worker');
            return undefined;
          }
          return Math.min(options.attempt * 100, 3000);
        }
      });

      this.redisClient.on('error', (err) => {
        console.error('Redis Worker Error:', err);
      });

      this.redisClient.on('connect', () => {
        console.log('✅ Redis connected for activity processing');
      });

      await this.redisClient.connect();
    }
    return this.redisClient;
  }

  /**
   * Process activities from Redis queue
   */
  async processActivities() {
    if (this.isProcessing) {
      console.log('⏳ Activity processing already in progress, skipping...');
      return;
    }

    try {
      this.isProcessing = true;
      console.log('🔄 Starting activity processing...');

      const client = await this.initializeRedis();
      await initializeDatabase();

      // Get batch of activities from Redis
      const activities = await this.getActivityBatch(client);
      
      if (activities.length === 0) {
        console.log('📭 No activities to process');
        return;
      }

      console.log(`📦 Processing ${activities.length} activities...`);

      // Process activities in batches
      await this.processBatch(activities);

      console.log(`✅ Successfully processed ${activities.length} activities`);

    } catch (error) {
      console.error('❌ Error processing activities:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get batch of activities from Redis queue
   */
  async getActivityBatch(client) {
    const activities = [];
    
    // Get up to batchSize activities from the queue
    for (let i = 0; i < this.batchSize; i++) {
      const activityData = await client.rPop('activity_queue');
      if (!activityData) break;
      
      try {
        const activity = JSON.parse(activityData);
        activities.push(activity);
      } catch (error) {
        console.error('❌ Failed to parse activity data:', error);
      }
    }
    
    return activities;
  }

  /**
   * Process a batch of activities
   */
  async processBatch(activities) {
    if (activities.length === 0) return;

    try {
      console.log(`📦 Processing ${activities.length} activities...`);
      
      // Process activities individually for better MySQL compatibility
      await this.processIndividualActivities(activities);
      
      console.log(`💾 Inserted ${activities.length} activities into database`);

    } catch (error) {
      console.error('❌ Error processing activities:', error);
      throw error;
    }
  }

  /**
   * Process activities individually if batch insert fails
   */
  async processIndividualActivities(activities) {
    console.log('🔄 Falling back to individual activity processing...');
    
    for (const activity of activities) {
      try {
        const query = `
          INSERT INTO activity_logs (
            id, timestamp, type, user_id, admin_id, action, 
            metadata, priority, ip_address, user_agent, processed
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        // Convert ISO timestamp to MySQL datetime format
        const mysqlTimestamp = new Date(activity.timestamp).toISOString().slice(0, 19).replace('T', ' ');

        await executeQuery(query, [
          activity.id,
          mysqlTimestamp,
          activity.type,
          activity.userId,
          activity.adminId,
          activity.action,
          JSON.stringify(activity.metadata),
          activity.priority,
          activity.ipAddress,
          activity.userAgent,
          activity.processed
        ]);

      } catch (error) {
        console.error(`❌ Failed to insert activity ${activity.id}:`, error);
        
        // Put failed activity back to Redis for retry
        try {
          const client = await this.initializeRedis();
          await client.lPush('activity_queue', JSON.stringify(activity));
        } catch (redisError) {
          console.error('❌ Failed to requeue activity:', redisError);
        }
      }
    }
  }

  /**
   * Start the activity processor
   */
  async start() {
    console.log('🚀 Starting Activity Processor...');
    
    // Process immediately on start
    await this.processActivities();
    
    // Set up interval for regular processing
    this.intervalId = setInterval(async () => {
      await this.processActivities();
    }, this.processingInterval);

    console.log(`⏰ Activity processor started (interval: ${this.processingInterval / 1000}s)`);
  }

  /**
   * Stop the activity processor
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    if (this.redisClient) {
      this.redisClient.quit();
    }
    
    console.log('🛑 Activity processor stopped');
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    try {
      const client = await this.initializeRedis();
      const queueLength = await client.lLen('activity_queue');
      
      return {
        queueLength,
        isProcessing: this.isProcessing,
        batchSize: this.batchSize,
        processingInterval: this.processingInterval
      };
    } catch (error) {
      console.error('❌ Error getting queue stats:', error);
      return null;
    }
  }
}

// Create singleton instance
const activityProcessor = new ActivityProcessor();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down activity processor...');
  activityProcessor.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down activity processor...');
  activityProcessor.stop();
  process.exit(0);
});

module.exports = activityProcessor;
