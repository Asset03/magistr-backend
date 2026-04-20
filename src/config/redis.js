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
          return Math.min(options.attempt * 100, 3000);
        }
      });

      this.client.on('error', (error) => {
        logger.error('Redis error:', error);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis connected');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        logger.info('Redis ready for commands');
      });

      this.client.on('end', () => {
        logger.warn('Redis connection ended');
        this.isConnected = false;
      });

      await this.client.connect();
      return this.client;
    } catch (error) {
      logger.error('Redis connection failed:', error);
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.client) {
        await this.client.quit();
        logger.info('Redis disconnected');
      }
    } catch (error) {
      logger.error('Error disconnecting Redis:', error);
      throw error;
    }
  }

  async set(key, value, ttl = null) {
    try {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      
      if (ttl) {
        await this.client.setEx(key, ttl, stringValue);
      } else {
        await this.client.set(key, stringValue);
      }
      
      return true;
    } catch (error) {
      logger.error(`Redis SET error for key ${key}:`, error);
      throw error;
    }
  }

  async get(key, parseJson = true) {
    try {
      const value = await this.client.get(key);
      
      if (!value) return null;
      
      if (parseJson) {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      
      return value;
    } catch (error) {
      logger.error(`Redis GET error for key ${key}:`, error);
      throw error;
    }
  }

  async del(key) {
    try {
      const result = await this.client.del(key);
      return result > 0;
    } catch (error) {
      logger.error(`Redis DEL error for key ${key}:`, error);
      throw error;
    }
  }

  async exists(key) {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Redis EXISTS error for key ${key}:`, error);
      throw error;
    }
  }

  async expire(key, seconds) {
    try {
      const result = await this.client.expire(key, seconds);
      return result === 1;
    } catch (error) {
      logger.error(`Redis EXPIRE error for key ${key}:`, error);
      throw error;
    }
  }

  async flushAll() {
    try {
      await this.client.flushAll();
      logger.info('Redis database flushed');
      return true;
    } catch (error) {
      logger.error('Redis FLUSHALL error:', error);
      throw error;
    }
  }

  async healthCheck() {
    try {
      if (!this.client) {
        throw new Error('Redis client not initialized');
      }
      
      const pong = await this.client.ping();
      const info = await this.client.info('server');
      
      return {
        status: this.isConnected ? 'connected' : 'disconnected',
        response: pong,
        info: this.parseRedisInfo(info)
      };
    } catch (error) {
      throw new Error(`Redis health check failed: ${error.message}`);
    }
  }

  parseRedisInfo(info) {
    const lines = info.split('\r\n');
    const result = {};
    
    lines.forEach(line => {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        if (key && value) {
          result[key] = value;
        }
      }
    });
    
    return {
      version: result.redis_version,
      uptime: result.uptime_in_seconds,
      connected_clients: result.connected_clients,
      used_memory: result.used_memory_human
    };
  }

  getClient() {
    return this.client;
  }

  isReady() {
    return this.isConnected && this.client;
  }
}

module.exports = new RedisClient();
