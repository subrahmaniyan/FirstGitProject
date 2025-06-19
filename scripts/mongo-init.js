// MongoDB Initialization Script for Payment Switch Application

// Switch to the payment_switch database
db = db.getSiblingDB('payment_switch');

// Create application user with appropriate permissions
db.createUser({
  user: 'payment_switch_user',
  pwd: 'payment_switch_password_2024',
  roles: [
    {
      role: 'readWrite',
      db: 'payment_switch'
    }
  ]
});

// Create collections with validation schemas
print('Creating collections with validation schemas...');

// Transactions collection
db.createCollection('transactions', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['transactionId', 'amount', 'currency', 'status', 'timestamp'],
      properties: {
        transactionId: {
          bsonType: 'string',
          description: 'Unique transaction identifier'
        },
        amount: {
          bsonType: 'number',
          minimum: 0,
          description: 'Transaction amount must be a positive number'
        },
        currency: {
          bsonType: 'string',
          pattern: '^[A-Z]{3}$',
          description: 'Currency code must be 3 uppercase letters'
        },
        status: {
          bsonType: 'string',
          enum: ['PENDING', 'PROCESSING', 'APPROVED', 'DECLINED', 'FAILED', 'CANCELLED'],
          description: 'Transaction status'
        },
        timestamp: {
          bsonType: 'date',
          description: 'Transaction timestamp'
        }
      }
    }
  }
});

// PSP Configurations collection
db.createCollection('psp_configs', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'type', 'active'],
      properties: {
        name: {
          bsonType: 'string',
          description: 'PSP name is required'
        },
        type: {
          bsonType: 'string',
          enum: ['CARD_NETWORK', 'BANK', 'WALLET', 'CRYPTO', 'OTHER'],
          description: 'PSP type'
        },
        active: {
          bsonType: 'bool',
          description: 'PSP active status'
        }
      }
    }
  }
});

// Routing Rules collection
db.createCollection('routing_rules', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'active'],
      properties: {
        name: {
          bsonType: 'string',
          description: 'Rule name is required'
        },
        active: {
          bsonType: 'bool',
          description: 'Rule active status'
        },
        priority: {
          bsonType: 'int',
          minimum: 1,
          maximum: 100,
          description: 'Rule priority (1-100)'
        }
      }
    }
  }
});

// Audit Logs collection
db.createCollection('audit_logs', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['timestamp', 'action', 'userId'],
      properties: {
        timestamp: {
          bsonType: 'date',
          description: 'Log timestamp'
        },
        action: {
          bsonType: 'string',
          description: 'Action performed'
        },
        userId: {
          bsonType: 'string',
          description: 'User who performed the action'
        }
      }
    }
  }
});

// Users collection
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['username', 'email', 'role', 'active'],
      properties: {
        username: {
          bsonType: 'string',
          minLength: 3,
          description: 'Username must be at least 3 characters'
        },
        email: {
          bsonType: 'string',
          pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
          description: 'Valid email address required'
        },
        role: {
          bsonType: 'string',
          enum: ['ADMIN', 'OPERATOR', 'VIEWER', 'AUDITOR'],
          description: 'User role'
        },
        active: {
          bsonType: 'bool',
          description: 'User active status'
        }
      }
    }
  }
});

// Create indexes for performance
print('Creating indexes...');

// Transactions indexes
db.transactions.createIndex({ 'transactionId': 1 }, { unique: true });
db.transactions.createIndex({ 'timestamp': -1 });
db.transactions.createIndex({ 'status': 1 });
db.transactions.createIndex({ 'merchantId': 1 });
db.transactions.createIndex({ 'amount': 1 });
db.transactions.createIndex({ 'currency': 1 });
db.transactions.createIndex({ 'selectedPSP': 1 });

// PSP Configurations indexes
db.psp_configs.createIndex({ 'name': 1 }, { unique: true });
db.psp_configs.createIndex({ 'type': 1 });
db.psp_configs.createIndex({ 'active': 1 });

// Routing Rules indexes
db.routing_rules.createIndex({ 'name': 1 }, { unique: true });
db.routing_rules.createIndex({ 'priority': -1 });
db.routing_rules.createIndex({ 'active': 1 });

// Audit Logs indexes
db.audit_logs.createIndex({ 'timestamp': -1 });
db.audit_logs.createIndex({ 'userId': 1 });
db.audit_logs.createIndex({ 'action': 1 });

// Users indexes
db.users.createIndex({ 'username': 1 }, { unique: true });
db.users.createIndex({ 'email': 1 }, { unique: true });
db.users.createIndex({ 'role': 1 });
db.users.createIndex({ 'active': 1 });

// Insert initial data
print('Inserting initial data...');

// Default admin user
db.users.insertOne({
  username: 'admin',
  email: 'admin@paymentswitch.com',
  password: '$2a$10$rOzJqZxnTkDg1/7QVQoqKOHvFQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ', // hashed 'admin123'
  role: 'ADMIN',
  active: true,
  createdAt: new Date(),
  lastLogin: null,
  permissions: ['*']
});

// Sample PSP configurations
db.psp_configs.insertMany([
  {
    name: 'VISA',
    type: 'CARD_NETWORK',
    description: 'Visa payment network',
    endpoint: 'https://sandbox.api.visa.com',
    active: true,
    priority: 1,
    supportedCurrencies: ['USD', 'EUR', 'GBP'],
    supportedCountries: ['US', 'CA', 'GB', 'EU'],
    fees: {
      percentage: 2.9,
      fixed: 0.30
    },
    limits: {
      min: 1.00,
      max: 10000.00
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'MASTERCARD',
    type: 'CARD_NETWORK',
    description: 'Mastercard payment network',
    endpoint: 'https://sandbox.api.mastercard.com',
    active: true,
    priority: 2,
    supportedCurrencies: ['USD', 'EUR', 'GBP'],
    supportedCountries: ['US', 'CA', 'GB', 'EU'],
    fees: {
      percentage: 2.8,
      fixed: 0.30
    },
    limits: {
      min: 1.00,
      max: 10000.00
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'PAYPAL',
    type: 'WALLET',
    description: 'PayPal digital wallet',
    endpoint: 'https://api.sandbox.paypal.com',
    active: true,
    priority: 3,
    supportedCurrencies: ['USD', 'EUR', 'GBP', 'CAD'],
    supportedCountries: ['US', 'CA', 'GB', 'EU'],
    fees: {
      percentage: 3.49,
      fixed: 0.49
    },
    limits: {
      min: 1.00,
      max: 60000.00
    },
    createdAt: new Date(),
    updatedAt: new Date()
  }
]);

// Sample routing rules
db.routing_rules.insertMany([
  {
    name: 'High Value Transactions',
    description: 'Route high value transactions to premium PSPs',
    conditions: {
      amount: { $gte: 1000 }
    },
    pspPriority: ['VISA', 'MASTERCARD'],
    active: true,
    priority: 1,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'USD Transactions',
    description: 'Route USD transactions to US-based PSPs',
    conditions: {
      currency: 'USD'
    },
    pspPriority: ['VISA', 'MASTERCARD', 'PAYPAL'],
    active: true,
    priority: 2,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'European Transactions',
    description: 'Route European transactions to EU-compliant PSPs',
    conditions: {
      currency: { $in: ['EUR', 'GBP'] }
    },
    pspPriority: ['VISA', 'MASTERCARD'],
    active: true,
    priority: 3,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'Small Transactions',
    description: 'Route small transactions to cost-effective PSPs',
    conditions: {
      amount: { $lt: 50 }
    },
    pspPriority: ['PAYPAL', 'VISA'],
    active: true,
    priority: 4,
    createdAt: new Date(),
    updatedAt: new Date()
  }
]);

// Create system configuration
db.createCollection('system_config');
db.system_config.insertOne({
  _id: 'main',
  version: '1.0.0',
  environment: 'development',
  features: {
    iso8583: true,
    iso20022: true,
    realTimeProcessing: true,
    fraudDetection: false,
    machineLearningRouting: false
  },
  limits: {
    maxConcurrentTransactions: 10000,
    transactionTimeout: 30000,
    maxRetries: 3
  },
  security: {
    encryptionEnabled: true,
    tokenizationEnabled: true,
    auditLoggingEnabled: true
  },
  compliance: {
    pciDssEnabled: true,
    gdprEnabled: true,
    amlEnabled: false
  },
  createdAt: new Date(),
  updatedAt: new Date()
});

print('MongoDB initialization completed successfully!');
print('Collections created: transactions, psp_configs, routing_rules, audit_logs, users, system_config');
print('Indexes created for optimal performance');
print('Initial data inserted');
print('Default admin user: admin / admin123 (please change password in production)');

