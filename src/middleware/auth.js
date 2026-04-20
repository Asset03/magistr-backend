const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

// Authentication middleware
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({ error: 'Invalid token. User not found.' });
    }

    if (user.status !== 'active') {
      return res.status(401).json({ error: 'Account is not active.' });
    }

    req.user = user;
    next();

  } catch (error) {
    logger.error('Authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token.' });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired.' });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      
      if (user && user.status === 'active') {
        req.user = user;
      }
    }

    next();

  } catch (error) {
    // Continue without authentication for optional auth
    next();
  }
};

// Role-based authorization middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Access denied. Authentication required.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Access denied. Insufficient permissions.',
        required_roles: roles,
        user_role: req.user.role
      });
    }

    next();
  };
};

// Resource ownership check
const checkOwnership = (resourceModel, resourceIdParam = 'id', ownerField = 'user_id') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required.' });
      }

      const resourceId = req.params[resourceIdParam];
      const resource = await resourceModel.findById(resourceId);

      if (!resource) {
        return res.status(404).json({ error: 'Resource not found.' });
      }

      // Admin can access all resources
      if (req.user.role === 'admin') {
        req.resource = resource;
        return next();
      }

      // Check ownership
      const ownerId = resource[ownerField];
      if (!ownerId || ownerId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: 'Access denied. You do not own this resource.' });
      }

      req.resource = resource;
      next();

    } catch (error) {
      logger.error('Ownership check error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

// Rate limiting middleware
const rateLimit = require('express-rate-limit');

const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for localhost requests
      const clientIp = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
      return clientIp === '::1' || clientIp === '127.0.0.1' || clientIp === '::ffff:127.0.0.1';
    },
    handler: (req, res) => {
      logger.warn(`Rate limit exceeded for IP: ${req.ip}, Path: ${req.path}`);
      res.status(429).json({ error: message });
    }
  });
};

// Different rate limits for different endpoints
const authRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  5, // 5 attempts
  'Too many authentication attempts. Please try again later.'
);

const generalRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  100, // 100 requests
  'Too many requests. Please try again later.'
);

const uploadRateLimit = createRateLimit(
  60 * 60 * 1000, // 1 hour
  10, // 10 uploads
  'Too many upload attempts. Please try again later.'
);

// API Key authentication for external services
const apiKeyAuth = async (req, res, next) => {
  try {
    const apiKey = req.header('X-API-Key');

    if (!apiKey) {
      return res.status(401).json({ error: 'API key required.' });
    }

    // In a real implementation, you would validate against a database of API keys
    const validApiKeys = {
      'nlp-service-key': { service: 'nlp', permissions: ['read', 'write'] },
      'etl-service-key': { service: 'etl', permissions: ['read', 'write'] }
    };

    const keyInfo = validApiKeys[apiKey];

    if (!keyInfo) {
      return res.status(401).json({ error: 'Invalid API key.' });
    }

    req.apiKey = keyInfo;
    next();

  } catch (error) {
    logger.error('API key authentication error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// JWT token generation
const generateToken = (userId, expiresIn = process.env.JWT_EXPIRES_IN || '7d') => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn }
  );
};

// Refresh token generation
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { id: userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );
};

// Token verification
const verifyToken = (token, secret = process.env.JWT_SECRET) => {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    throw error;
  }
};

// Extract user from token (for WebSocket connections)
const extractUserFromToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.id;
  } catch (error) {
    return null;
  }
};

// Check if user has specific permission
const hasPermission = (user, permission) => {
  const rolePermissions = {
    admin: [
      'read:all', 'write:all', 'delete:all', 'manage:users',
      'manage:system', 'access:analytics', 'import:data', 'export:data'
    ],
    researcher: [
      'read:public', 'write:own', 'delete:own', 'access:analytics',
      'import:data', 'export:data'
    ],
    user: [
      'read:public', 'write:own', 'delete:own', 'export:own'
    ],
    guest: [
      'read:public'
    ]
  };

  return rolePermissions[user.role]?.includes(permission) || false;
};

// Permission-based authorization
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (!hasPermission(req.user, permission)) {
      return res.status(403).json({ 
        error: 'Access denied. Insufficient permissions.',
        required_permission: permission,
        user_role: req.user.role
      });
    }

    next();
  };
};

// CORS middleware for specific origins
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.CORS_ORIGIN ? 
      process.env.CORS_ORIGIN.split(',') : 
      ['http://localhost:3000'];

    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

module.exports = {
  auth,
  optionalAuth,
  authorize,
  checkOwnership,
  generateToken,
  generateRefreshToken,
  verifyToken,
  extractUserFromToken,
  hasPermission,
  requirePermission,
  apiKeyAuth,
  authRateLimit,
  generalRateLimit,
  uploadRateLimit,
  corsOptions
};
