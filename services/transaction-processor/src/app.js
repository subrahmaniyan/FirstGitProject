const feathers = require('@feathersjs/feathers');
const express = require('@feathersjs/express');
const socketio = require('@feathersjs/socketio');
const configuration = require('@feathersjs/configuration');
const cors = require('cors');
const helmet = require('helmet');
const compress = require('compression');
const winston = require('winston');

// Import services
const transactionService = require('./services/transaction.service');
const stateService = require('./services/state.service');
const validationService = require('./services/validation.service');

// Import hooks
const transactionHooks = require('./hooks/transaction.hooks');
const errorHandler = require('./middleware/error-handler');
const auditLogger = require('./middleware/audit-logger');

// Import utilities
const database = require('./utils/database');
const redis = require('./utils/redis');
const eventBus = require('./utils/event-bus');

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/transaction-processor-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/transaction-processor.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Create Feathers application
const app = express(feathers());

// Load app configuration
app.configure(configuration());

// Enable security, CORS, compression, favicon and body parsing
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(compress());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configure Feathers services
app.configure(express.rest());
app.configure(socketio({
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
  }
}));

// Add audit logging middleware
app.use(auditLogger(logger));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'transaction-processor',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    const metrics = await app.service('transactions').getMetrics();
    res.json(metrics);
  } catch (error) {
    logger.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// Configure services
app.use('/transactions', transactionService);
app.use('/transaction-states', stateService);
app.use('/validation', validationService);

// Configure hooks
app.service('transactions').hooks(transactionHooks);

// Configure error handling
app.use(errorHandler(logger));

// Initialize database and Redis connections
async function initializeConnections() {
  try {
    await database.connect();
    logger.info('MongoDB connected successfully');
    
    await redis.connect();
    logger.info('Redis connected successfully');
    
    // Initialize event bus
    eventBus.initialize(app);
    logger.info('Event bus initialized');
    
  } catch (error) {
    logger.error('Failed to initialize connections:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await database.disconnect();
  await redis.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await database.disconnect();
  await redis.disconnect();
  process.exit(0);
});

// Start server
const port = app.get('port') || 3001;
const server = app.listen(port);

server.on('listening', async () => {
  logger.info(`Transaction Processor service started on http://localhost:${port}`);
  await initializeConnections();
});

// Export app for testing
module.exports = app;

