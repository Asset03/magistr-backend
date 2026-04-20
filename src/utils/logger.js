const winston = require('winston');
const path = require('path');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    return `${timestamp} [${level}]: ${stack || message}`;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'scientific-publications-api' },
  transports: [
    // Write all logs with level 'error' and below to error.log
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Write all logs with level 'info' and below to combined.log
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Write access logs to access.log
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'access.log'),
      level: 'http',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    })
  ],
  
  // Exception handling
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'exceptions.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ],
  
  // Rejection handling
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'rejections.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: 'debug'
  }));
}

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom logging methods for different contexts
logger.auth = (message, meta = {}) => {
  logger.info(`[AUTH] ${message}`, { context: 'authentication', ...meta });
};

logger.db = (message, meta = {}) => {
  logger.info(`[DB] ${message}`, { context: 'database', ...meta });
};

logger.nlp = (message, meta = {}) => {
  logger.info(`[NLP] ${message}`, { context: 'nlp-service', ...meta });
};

logger.api = (message, meta = {}) => {
  logger.info(`[API] ${message}`, { context: 'api-request', ...meta });
};

logger.security = (message, meta = {}) => {
  logger.warn(`[SECURITY] ${message}`, { context: 'security', ...meta });
};

logger.performance = (message, meta = {}) => {
  logger.info(`[PERF] ${message}`, { context: 'performance', ...meta });
};

// Request logging middleware
logger.requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      contentLength: res.get('Content-Length')
    };
    
    if (res.statusCode >= 400) {
      logger.warn(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`, logData);
    } else {
      logger.http(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`, logData);
    }
  });
  
  next();
};

// Error logging helper
logger.logError = (error, context = {}) => {
  const errorData = {
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString()
  };
  
  logger.error('[ERROR] Application error', errorData);
};

// Performance monitoring
logger.logPerformance = (operation, duration, metadata = {}) => {
  logger.performance(`${operation} completed in ${duration}ms`, {
    operation,
    duration,
    ...metadata
  });
};

// Security event logging
logger.logSecurityEvent = (event, details = {}) => {
  logger.security(`Security event: ${event}`, {
    event,
    timestamp: new Date().toISOString(),
    ...details
  });
};

module.exports = logger;
