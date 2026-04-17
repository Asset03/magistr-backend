const redisClient = require('../config/redis');

// Cache middleware for GET requests
const cache = (ttl = 3600) => {
  return redisClient.cacheMiddleware(ttl);
};

// Cache invalidation middleware for POST/PUT/DELETE requests
const invalidateCache = (patterns = []) => {
  return async (req, res, next) => {
    const originalJson = res.json;
    
    res.json = function(data) {
      // Invalidate cache after successful operations
      if (res.statusCode >= 200 && res.statusCode < 300) {
        invalidateCachePatterns(patterns, req).catch(err => {
          console.error('Cache invalidation error:', err);
        });
      }
      
      return originalJson.call(this, data);
    };
    
    next();
  };
};

// Helper function to invalidate cache patterns
async function invalidateCachePatterns(patterns, req) {
  for (const pattern of patterns) {
    // Replace placeholders in patterns with actual values
    let resolvedPattern = pattern;
    
    if (pattern.includes(':id')) {
      resolvedPattern = pattern.replace(':id', req.params.id);
    }
    
    if (pattern.includes(':userId')) {
      resolvedPattern = pattern.replace(':userId', req.user?.id || 'anonymous');
    }
    
    await redisClient.invalidatePattern(resolvedPattern);
  }
}

// Cache key generators
const cacheKeys = {
  publications: (page = 1, limit = 20) => `cache:GET:/api/publications?page=${page}&limit=${limit}`,
  publication: (id) => `cache:GET:/api/publications/${id}`,
  author: (id) => `cache:GET:/api/authors/${id}`,
  authors: (page = 1, limit = 20) => `cache:GET:/api/authors?page=${page}&limit=${limit}`,
  dashboardStats: () => 'cache:GET:/api/dashboard/stats',
  analytics: (timeRange = 'year') => `cache:GET:/api/analytics?timeRange=${timeRange}`,
  search: (query) => `cache:GET:/api/search?q=${encodeURIComponent(query)}`,
  userPublications: (userId, page = 1) => `cache:GET:/api/authors/${userId}/publications?page=${page}`
};

// Cache invalidation patterns
const cachePatterns = {
  publications: [
    'cache:GET:/api/publications*',
    'cache:GET:/api/dashboard/stats',
    'cache:GET:/api/analytics*'
  ],
  publication: (id) => [
    `cache:GET:/api/publications/${id}`,
    `cache:GET:/api/publications/${id}/*`,
    'cache:GET:/api/publications*',
    'cache:GET:/api/dashboard/stats',
    'cache:GET:/api/analytics*'
  ],
  authors: [
    'cache:GET:/api/authors*',
    'cache:GET:/api/dashboard/stats'
  ],
  author: (id) => [
    `cache:GET:/api/authors/${id}`,
    `cache:GET:/api/authors/${id}/*`,
    'cache:GET:/api/authors*',
    'cache:GET:/api/dashboard/stats'
  ],
  search: [
    'cache:GET:/api/search*'
  ],
  dashboard: [
    'cache:GET:/api/dashboard*'
  ],
  analytics: [
    'cache:GET:/api/analytics*'
  ]
};

module.exports = {
  cache,
  invalidateCache,
  cacheKeys,
  cachePatterns
};
