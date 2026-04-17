const redis = require('redis');
const logger = require('../utils/logger');

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      
      this.client = redis.createClient({
        url: redisUrl,
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            logger.error('Redis server connection refused');
            return new Error('Redis server connection refused');
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            logger.error('Redis retry time exhausted');
            return new Error('Retry time exhausted');
          }
          if (options.attempt > 10) {
            logger.error('Redis max retry attempts reached');
            return undefined;
          }
          // Retry after 3 seconds
          return Math.min(options.attempt * 100, 3000);
        }
      });

      this.client.on('error', (err) => {
        logger.error('Redis Client Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis Client Connected');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        logger.info('Redis Client Ready');
      });

      this.client.on('end', () => {
        logger.info('Redis Client Disconnected');
        this.isConnected = false;
      });

      await this.client.connect();
      
      return this.client;
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      this.isConnected = false;
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.disconnect();
      this.isConnected = false;
    }
  }

  async set(key, value, ttl = 3600) {
    if (!this.isConnected) {
      logger.warn('Redis not connected, skipping cache set');
      return false;
    }

    try {
      const serializedValue = JSON.stringify(value);
      if (ttl > 0) {
        await this.client.setEx(key, ttl, serializedValue);
      } else {
        await this.client.set(key, serializedValue);
      }
      return true;
    } catch (error) {
      logger.error('Redis set error:', error);
      return false;
    }
  }

  async get(key) {
    if (!this.isConnected) {
      logger.warn('Redis not connected, skipping cache get');
      return null;
    }

    try {
      const value = await this.client.get(key);
      if (value === null) {
        return null;
      }
      return JSON.parse(value);
    } catch (error) {
      logger.error('Redis get error:', error);
      return null;
    }
  }

  async del(key) {
    if (!this.isConnected) {
      logger.warn('Redis not connected, skipping cache delete');
      return false;
    }

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error('Redis delete error:', error);
      return false;
    }
  }

  async exists(key) {
    if (!this.isConnected) {
      return false;
    }

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis exists error:', error);
      return false;
    }
  }

  async flushAll() {
    if (!this.isConnected) {
      logger.warn('Redis not connected, skipping flush all');
      return false;
    }

    try {
      await this.client.flushAll();
      return true;
    } catch (error) {
      logger.error('Redis flush all error:', error);
      return false;
    }
  }

  async incr(key) {
    if (!this.isConnected) {
      logger.warn('Redis not connected, skipping increment');
      return null;
    }

    try {
      return await this.client.incr(key);
    } catch (error) {
      logger.error('Redis increment error:', error);
      return null;
    }
  }

  async expire(key, ttl) {
    if (!this.isConnected) {
      logger.warn('Redis not connected, skipping expire');
      return false;
    }

    try {
      await this.client.expire(key, ttl);
      return true;
    } catch (error) {
      logger.error('Redis expire error:', error);
      return false;
    }
  }

  // Cache middleware factory
  cacheMiddleware(ttl = 3600) {
    return async (req, res, next) => {
      if (!this.isConnected) {
        return next();
      }

      const cacheKey = `cache:${req.method}:${req.originalUrl}`;
      
      try {
        const cachedData = await this.get(cacheKey);
        
        if (cachedData) {
          logger.info(`Cache hit for key: ${cacheKey}`);
          return res.json(cachedData);
        }
        
        // Override res.json to cache the response
        const originalJson = res.json;
        res.json = function(data) {
          // Only cache successful responses
          if (res.statusCode === 200) {
            this.set(cacheKey, data, ttl).catch(err => {
              logger.error('Failed to cache response:', err);
            });
          }
          return originalJson.call(this, data);
        };
        
        next();
      } catch (error) {
        logger.error('Cache middleware error:', error);
        next();
      }
    };
  }

  // Invalidate cache by pattern
  async invalidatePattern(pattern) {
    if (!this.isConnected) {
      logger.warn('Redis not connected, skipping pattern invalidation');
      return false;
    }

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
        logger.info(`Invalidated ${keys.length} cache keys matching pattern: ${pattern}`);
      }
      return true;
    } catch (error) {
      logger.error('Redis pattern invalidation error:', error);
      return false;
    }
  }
}

// Create singleton instance
const redisClient = new RedisClient();

module.exports = redisClient;
