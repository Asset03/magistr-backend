require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const yaml = require('js-yaml');
const fs = require('fs');

// Import configurations
const database = require('./config/database');
const redisClient = require('./config/redis');

// Import routes
const authRoutes = require('./routes/auth');
const publicationRoutes = require('./routes/publications');
const authorRoutes = require('./routes/authors');
const citationRoutes = require('./routes/citations');
const analyticsRoutes = require('./routes/analytics');
const topicsRoutes = require('./routes/topics');
const importRoutes = require('./routes/import');

// Import middleware
const { generalRateLimit, corsOptions } = require('./middleware/auth');

// Import utilities
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors(corsOptions));

// Compression
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim())
    }
  }));
}

// Rate limiting
app.use(generalRateLimit);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await database.healthCheck();
    const redisHealth = await redisClient.healthCheck();

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: {
        database: dbHealth,
        redis: redisHealth
      }
    };

    res.status(200).json(health);

  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/publications', publicationRoutes);
app.use('/api/authors', authorRoutes);
app.use('/api/citations', citationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/topics', topicsRoutes);
app.use('/api/import', importRoutes);

// Swagger documentation
try {
  const swaggerDocument = yaml.load(fs.readFileSync('./swagger.yaml', 'utf8'));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} catch (error) {
  logger.error('Error loading Swagger YAML:', error);
  // Fallback to basic swagger setup if YAML fails to load
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup({}));
}

// Static files for documentation
app.use('/api-docs-json', (req, res) => {
  try {
    const swaggerDocument = yaml.load(fs.readFileSync('./swagger.yaml', 'utf8'));
    res.setHeader('Content-Type', 'application/json');
    res.json(swaggerDocument);
  } catch (error) {
    logger.error('Error serving Swagger JSON:', error);
    res.status(500).json({ error: 'Failed to load API documentation' });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    availableEndpoints: [
      '/api/health',
      '/api/auth/*',
      '/api/publications/*',
      '/api/authors/*',
      '/api/citations/*',
      '/api/analytics/*',
      '/api/topics/*',
      '/api/import/*',
      '/api-docs'
    ]
  });
});

// Global error handler
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);

  // Mongoose validation error
  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map(err => ({
      field: err.path,
      message: err.message
    }));
    return res.status(400).json({
      error: 'Validation failed',
      errors
    });
  }

  // Mongoose duplicate key error
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    return res.status(409).json({
      error: 'Duplicate entry',
      field,
      value: error.keyValue[field]
    });
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token'
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expired'
    });
  }

  // Default error
  res.status(error.status || 500).json({
    error: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}, starting graceful shutdown...`);
  
  try {
    // Close database connection
    await database.disconnect();
    logger.info('Database connection closed');
    
    // Close Redis connection
    await redisClient.disconnect();
    logger.info('Redis connection closed');
    
    // Close server
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
    
    // Force close after 30 seconds
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 30000);
    
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Start server
const startServer = async () => {
  try {
    // Connect to database
    await database.connect();
    logger.info('Database connected successfully');
    
    // Connect to Redis
    await redisClient.connect();
    logger.info('Redis connected successfully');
    
    // Start HTTP server
    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`API Documentation: http://localhost:${PORT}/api-docs`);
    });
    
    // Handle graceful shutdown
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      gracefulShutdown('uncaughtException');
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('unhandledRejection');
    });
    
    return server;
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
if (require.main === module) {
  startServer();
}

module.exports = app;
