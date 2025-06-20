const mongoose = require('mongoose');

// Transaction state enumeration
const TRANSACTION_STATES = [
  'INITIATED',
  'VALIDATED',
  'PROCESSING',
  'ROUTING',
  'PSP_SENT',
  'PSP_RESPONSE',
  'COMPLETED',
  'DECLINED',
  'FAILED',
  'CANCELLED',
  'TIMEOUT',
  'REFUNDED',
  'PARTIALLY_REFUNDED'
];

// Message format enumeration
const MESSAGE_FORMATS = [
  'ISO8583',
  'ISO20022',
  'PROPRIETARY',
  'JSON',
  'XML'
];

// Transaction type enumeration
const TRANSACTION_TYPES = [
  'PURCHASE',
  'REFUND',
  'REVERSAL',
  'AUTHORIZATION',
  'CAPTURE',
  'VOID',
  'INQUIRY',
  'BALANCE_INQUIRY',
  'CASH_ADVANCE',
  'TRANSFER'
];

// State history schema
const stateHistorySchema = new mongoose.Schema({
  state: {
    type: String,
    enum: TRANSACTION_STATES,
    required: true
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { _id: false });

// Routing decision schema
const routingDecisionSchema = new mongoose.Schema({
  selectedPSP: {
    type: String,
    required: true
  },
  routingRules: [{
    ruleId: String,
    ruleName: String,
    priority: Number,
    matched: Boolean
  }],
  alternativePSPs: [String],
  routingScore: Number,
  decisionTime: {
    type: Date,
    default: Date.now
  },
  decisionMetadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { _id: false });

// PSP response schema
const pspResponseSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['APPROVED', 'DECLINED', 'ERROR', 'TIMEOUT'],
    required: true
  },
  approvalCode: String,
  pspTransactionId: String,
  pspReferenceNumber: String,
  declineReason: String,
  errorCode: String,
  errorMessage: String,
  responseTime: Number,
  rawResponse: mongoose.Schema.Types.Mixed,
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

// Enrichment data schema
const enrichmentDataSchema = new mongoose.Schema({
  geoLocation: {
    country: String,
    region: String,
    city: String,
    latitude: Number,
    longitude: Number
  },
  riskScore: {
    type: Number,
    min: 0,
    max: 100
  },
  merchantInfo: {
    name: String,
    category: String,
    mcc: String,
    riskLevel: String
  },
  cardInfo: {
    bin: String,
    brand: String,
    type: String,
    issuer: String,
    country: String
  },
  deviceInfo: {
    fingerprint: String,
    ipAddress: String,
    userAgent: String
  }
}, { _id: false });

// Main transaction schema
const transactionSchema = new mongoose.Schema({
  // Core transaction identifiers
  transactionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  externalTransactionId: String,
  merchantTransactionId: String,
  
  // Transaction details
  transactionType: {
    type: String,
    enum: TRANSACTION_TYPES,
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    length: 3
  },
  
  // Message format and parsing
  messageFormat: {
    type: String,
    enum: MESSAGE_FORMATS,
    required: true
  },
  rawMessage: mongoose.Schema.Types.Mixed,
  parsedMessage: mongoose.Schema.Types.Mixed,
  
  // Merchant information
  merchantId: {
    type: String,
    required: true,
    index: true
  },
  terminalId: String,
  merchantName: String,
  merchantCategory: String,
  
  // Card/Payment information (tokenized)
  cardToken: String,
  cardLast4: String,
  cardBrand: String,
  cardType: String,
  
  // Transaction state management
  state: {
    type: String,
    enum: TRANSACTION_STATES,
    required: true,
    default: 'INITIATED',
    index: true
  },
  stateHistory: [stateHistorySchema],
  
  // Routing information
  routingDecision: routingDecisionSchema,
  selectedPSP: {
    type: String,
    index: true
  },
  
  // PSP response
  pspResponse: pspResponseSchema,
  
  // Response data
  responseData: {
    approvalCode: String,
    pspTransactionId: String,
    processingTime: Number,
    declineReason: String,
    pspErrorCode: String,
    errorMessage: String
  },
  
  // Enrichment data
  enrichmentData: enrichmentDataSchema,
  
  // Timestamps
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  processingStartTime: Date,
  processingEndTime: Date,
  completedAt: Date,
  
  // Error handling
  errorCode: String,
  errorMessage: String,
  retryCount: {
    type: Number,
    default: 0
  },
  maxRetries: {
    type: Number,
    default: 3
  },
  
  // Audit and compliance
  source: {
    type: String,
    required: true,
    default: 'unknown'
  },
  sourceIP: String,
  version: {
    type: String,
    default: '1.0'
  },
  
  // Additional metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Soft delete
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: Date

}, {
  timestamps: true,
  collection: 'transactions'
});

// Indexes for performance
transactionSchema.index({ transactionId: 1 });
transactionSchema.index({ merchantId: 1, timestamp: -1 });
transactionSchema.index({ state: 1, timestamp: -1 });
transactionSchema.index({ selectedPSP: 1, timestamp: -1 });
transactionSchema.index({ timestamp: -1 });
transactionSchema.index({ 'enrichmentData.riskScore': 1 });
transactionSchema.index({ amount: 1, currency: 1 });

// Compound indexes
transactionSchema.index({ 
  merchantId: 1, 
  state: 1, 
  timestamp: -1 
});

transactionSchema.index({ 
  selectedPSP: 1, 
  state: 1, 
  timestamp: -1 
});

// Text search index
transactionSchema.index({
  transactionId: 'text',
  merchantTransactionId: 'text',
  externalTransactionId: 'text',
  merchantName: 'text'
});

// Virtual for processing time
transactionSchema.virtual('processingTimeMs').get(function() {
  if (this.processingStartTime && this.processingEndTime) {
    return this.processingEndTime - this.processingStartTime;
  }
  return null;
});

// Virtual for current state duration
transactionSchema.virtual('currentStateDuration').get(function() {
  if (this.stateHistory && this.stateHistory.length > 0) {
    const lastStateChange = this.stateHistory[this.stateHistory.length - 1];
    return Date.now() - lastStateChange.timestamp;
  }
  return null;
});

// Pre-save middleware
transactionSchema.pre('save', function(next) {
  // Set processing end time when transaction is completed
  if (this.isModified('state') && 
      ['COMPLETED', 'DECLINED', 'FAILED', 'CANCELLED'].includes(this.state)) {
    this.processingEndTime = new Date();
    this.completedAt = new Date();
  }
  
  // Increment retry count on state change to failed
  if (this.isModified('state') && this.state === 'FAILED') {
    this.retryCount = (this.retryCount || 0) + 1;
  }
  
  next();
});

// Instance methods
transactionSchema.methods.canRetry = function() {
  return this.retryCount < this.maxRetries && 
         ['FAILED', 'TIMEOUT'].includes(this.state);
};

transactionSchema.methods.isCompleted = function() {
  return ['COMPLETED', 'DECLINED', 'CANCELLED', 'REFUNDED'].includes(this.state);
};

transactionSchema.methods.isInProgress = function() {
  return ['INITIATED', 'VALIDATED', 'PROCESSING', 'ROUTING', 'PSP_SENT'].includes(this.state);
};

transactionSchema.methods.addStateHistory = function(state, metadata = {}) {
  this.stateHistory.push({
    state: state,
    timestamp: new Date(),
    metadata: metadata
  });
  this.state = state;
};

// Static methods
transactionSchema.statics.findByMerchant = function(merchantId, options = {}) {
  const query = { merchantId, isDeleted: false };
  return this.find(query, null, options);
};

transactionSchema.statics.findByState = function(state, options = {}) {
  const query = { state, isDeleted: false };
  return this.find(query, null, options);
};

transactionSchema.statics.findByDateRange = function(startDate, endDate, options = {}) {
  const query = {
    timestamp: { $gte: startDate, $lte: endDate },
    isDeleted: false
  };
  return this.find(query, null, options);
};

transactionSchema.statics.getMetricsByPeriod = function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        timestamp: { $gte: startDate, $lte: endDate },
        isDeleted: false
      }
    },
    {
      $group: {
        _id: {
          state: '$state',
          psp: '$selectedPSP'
        },
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        avgProcessingTime: { $avg: '$responseData.processingTime' }
      }
    }
  ]);
};

// Export the model
module.exports = mongoose.model('Transaction', transactionSchema);

