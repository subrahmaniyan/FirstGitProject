const feathers = require('@feathersjs/feathers');
const express = require('@feathersjs/express');
const socketio = require('@feathersjs/socketio');
const configuration = require('@feathersjs/configuration');
const cors = require('cors');
const helmet = require('helmet');
const compress = require('compression');
const winston = require('winston');

// Import services
const routingService = require('./services/routing.service');
const routingRulesService = require('./services/routing-rules.service');
const pspHealthService = require('./services/psp-health.service');

// Import utilities
const database = require('./utils/database');
const redis = require('./utils/redis');
const ruleEngine = require('./engines/rule-engine');
const loadBalancer = require('./algorithms/load-balancer');
const circuitBreaker = require('./utils/circuit-breaker');

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/routing-engine-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/routing-engine.log' }),
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

// Enable security, CORS, compression and body parsing
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'routing-engine',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    const metrics = await app.service('routing').getMetrics();
    res.json(metrics);
  } catch (error) {
    logger.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// PSP Health status endpoint
app.get('/psp-health', async (req, res) => {
  try {
    const healthStatus = await app.service('psp-health').getHealthStatus();
    res.json(healthStatus);
  } catch (error) {
    logger.error('Error fetching PSP health:', error);
    res.status(500).json({ error: 'Failed to fetch PSP health status' });
  }
});

// Configure services
app.use('/routing', routingService);
app.use('/routing-rules', routingRulesService);
app.use('/psp-health', pspHealthService);

// Initialize components
async function initializeComponents() {
  try {
    await database.connect();
    logger.info('MongoDB connected successfully');
    
    await redis.connect();
    logger.info('Redis connected successfully');
    
    // Initialize rule engine
    await ruleEngine.initialize(app);
    logger.info('Rule engine initialized');
    
    // Initialize load balancer
    loadBalancer.initialize(app);
    logger.info('Load balancer initialized');
    
    // Initialize circuit breakers
    circuitBreaker.initialize(app);
    logger.info('Circuit breakers initialized');
    
    // Start PSP health monitoring
    app.service('psp-health').startHealthMonitoring();
    logger.info('PSP health monitoring started');
    
  } catch (error) {
    logger.error('Failed to initialize components:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await app.service('psp-health').stopHealthMonitoring();
  await database.disconnect();
  await redis.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await app.service('psp-health').stopHealthMonitoring();
  await database.disconnect();
  await redis.disconnect();
  process.exit(0);
});

// Start server
const port = app.get('port') || 3002;
const server = app.listen(port);

server.on('listening', async () => {
  logger.info(`Routing Engine service started on http://localhost:${port}`);
  await initializeComponents();
});

// Export app for testing
module.exports = app;

