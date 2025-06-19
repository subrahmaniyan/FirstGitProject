#!/usr/bin/env node

/**
 * Payment Switch Application - Main Entry Point
 * 
 * This is the main orchestrator for the payment switch application.
 * It manages the startup sequence and coordination between microservices.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Load environment variables
require('dotenv').config();

const services = [
  {
    name: 'Transaction Processor',
    path: './services/transaction-processor',
    port: process.env.TRANSACTION_PROCESSOR_PORT || 3001,
    command: 'npm',
    args: ['start']
  },
  {
    name: 'Routing Engine',
    path: './services/routing-engine',
    port: process.env.ROUTING_ENGINE_PORT || 3002,
    command: 'npm',
    args: ['start']
  },
  {
    name: 'PSP Gateway',
    path: './services/psp-gateway',
    port: process.env.PSP_GATEWAY_PORT || 3003,
    command: 'npm',
    args: ['start']
  },
  {
    name: 'Management API',
    path: './services/management-api',
    port: process.env.MANAGEMENT_API_PORT || 3004,
    command: 'npm',
    args: ['start']
  },
  {
    name: 'Monitoring Service',
    path: './services/monitoring',
    port: process.env.MONITORING_PORT || 3005,
    command: 'npm',
    args: ['start']
  }
];

const runningServices = [];

/**
 * Start a service
 */
function startService(service) {
  return new Promise((resolve, reject) => {
    console.log(`🚀 Starting ${service.name}...`);
    
    // Check if service directory exists
    if (!fs.existsSync(service.path)) {
      console.error(`❌ Service directory not found: ${service.path}`);
      reject(new Error(`Service directory not found: ${service.path}`));
      return;
    }

    const child = spawn(service.command, service.args, {
      cwd: path.resolve(service.path),
      stdio: ['inherit', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    // Handle service output
    child.stdout.on('data', (data) => {
      console.log(`[${service.name}] ${data.toString().trim()}`);
    });

    child.stderr.on('data', (data) => {
      console.error(`[${service.name}] ERROR: ${data.toString().trim()}`);
    });

    // Handle service exit
    child.on('close', (code) => {
      console.log(`[${service.name}] Process exited with code ${code}`);
      if (code !== 0) {
        console.error(`❌ ${service.name} failed to start`);
        reject(new Error(`${service.name} failed to start`));
      }
    });

    // Handle service errors
    child.on('error', (error) => {
      console.error(`❌ Failed to start ${service.name}:`, error.message);
      reject(error);
    });

    // Store reference to running service
    runningServices.push({
      ...service,
      process: child
    });

    // Give service time to start
    setTimeout(() => {
      console.log(`✅ ${service.name} started on port ${service.port}`);
      resolve();
    }, 2000);
  });
}

/**
 * Start all services
 */
async function startAllServices() {
  console.log('🏗️  Payment Switch Application Starting...\n');
  
  // Check prerequisites
  console.log('🔍 Checking prerequisites...');
  
  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  if (majorVersion < 18) {
    console.error('❌ Node.js 18.0.0 or higher is required');
    process.exit(1);
  }
  console.log(`✅ Node.js version: ${nodeVersion}`);

  // Check environment variables
  const requiredEnvVars = ['MONGODB_URI', 'REDIS_URI'];
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.warn(`⚠️  Environment variable ${envVar} is not set`);
    }
  }

  console.log('\n🚀 Starting microservices...\n');

  try {
    // Start services sequentially to avoid port conflicts
    for (const service of services) {
      await startService(service);
      // Small delay between service starts
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n✅ All services started successfully!');
    console.log('\n📊 Service Status:');
    runningServices.forEach(service => {
      console.log(`   • ${service.name}: http://localhost:${service.port}`);
    });

    console.log('\n🌐 Access Points:');
    console.log(`   • Management Interface: http://localhost:${process.env.FRONTEND_PORT || 8080}`);
    console.log(`   • Node-RED Workflows: http://localhost:${process.env.NODE_RED_PORT || 1880}`);
    console.log(`   • API Documentation: http://localhost:${process.env.MANAGEMENT_API_PORT || 3004}/docs`);

    console.log('\n💡 Tips:');
    console.log('   • Use Ctrl+C to stop all services');
    console.log('   • Check logs for any service issues');
    console.log('   • Ensure MongoDB and Redis are running');

  } catch (error) {
    console.error('\n❌ Failed to start services:', error.message);
    console.log('\n🛠️  Troubleshooting:');
    console.log('   • Check if all dependencies are installed: npm run install:all');
    console.log('   • Verify MongoDB and Redis are running');
    console.log('   • Check port availability');
    console.log('   • Review environment configuration');
    
    // Cleanup any started services
    cleanup();
    process.exit(1);
  }
}

/**
 * Cleanup function
 */
function cleanup() {
  console.log('\n🧹 Cleaning up services...');
  runningServices.forEach(service => {
    if (service.process && !service.process.killed) {
      console.log(`   • Stopping ${service.name}...`);
      service.process.kill('SIGTERM');
    }
  });
}

/**
 * Handle process termination
 */
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  cleanup();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  cleanup();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  cleanup();
  process.exit(1);
});

// Start the application
if (require.main === module) {
  startAllServices();
}

module.exports = {
  startAllServices,
  cleanup
};

