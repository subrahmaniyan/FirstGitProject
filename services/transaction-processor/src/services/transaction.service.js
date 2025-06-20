const { Service } = require('feathers-mongoose');
const Transaction = require('../models/transaction.model');
const StateMachine = require('../utils/state-machine');
const EventBus = require('../utils/event-bus');
const ISO8583Parser = require('../parsers/iso8583-parser');
const ISO20022Parser = require('../parsers/iso20022-parser');
const MessageTransformer = require('../parsers/message-transformer');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console()
  ]
});

class TransactionService extends Service {
  constructor(options, app) {
    super(options, app);
    this.app = app;
    this.stateMachine = new StateMachine();
    this.eventBus = EventBus.getInstance();
    this.iso8583Parser = new ISO8583Parser();
    this.iso20022Parser = new ISO20022Parser();
    this.messageTransformer = new MessageTransformer();
  }

  /**
   * Create a new transaction
   */
  async create(data, params) {
    try {
      logger.info('Creating new transaction', { transactionId: data.transactionId });

      // Validate incoming message format
      const validatedData = await this.validateAndParseMessage(data);
      
      // Enrich transaction data
      const enrichedData = await this.enrichTransaction(validatedData);
      
      // Initialize transaction state
      enrichedData.state = 'INITIATED';
      enrichedData.stateHistory = [{
        state: 'INITIATED',
        timestamp: new Date(),
        metadata: { source: 'transaction-processor' }
      }];
      
      // Create transaction in database
      const transaction = await super.create(enrichedData, params);
      
      // Emit transaction created event
      this.eventBus.emit('transaction.created', {
        transactionId: transaction.transactionId,
        transaction: transaction
      });
      
      // Start transaction processing
      this.processTransaction(transaction);
      
      return transaction;
      
    } catch (error) {
      logger.error('Error creating transaction:', error);
      throw error;
    }
  }

  /**
   * Update transaction state
   */
  async patch(id, data, params) {
    try {
      const transaction = await this.get(id, params);
      
      // Validate state transition
      if (data.state && !this.stateMachine.canTransition(transaction.state, data.state)) {
        throw new Error(`Invalid state transition from ${transaction.state} to ${data.state}`);
      }
      
      // Update state history
      if (data.state) {
        data.stateHistory = transaction.stateHistory || [];
        data.stateHistory.push({
          state: data.state,
          timestamp: new Date(),
          metadata: data.stateMetadata || {}
        });
      }
      
      const updatedTransaction = await super.patch(id, data, params);
      
      // Emit state change event
      if (data.state) {
        this.eventBus.emit('transaction.state.changed', {
          transactionId: updatedTransaction.transactionId,
          oldState: transaction.state,
          newState: data.state,
          transaction: updatedTransaction
        });
      }
      
      return updatedTransaction;
      
    } catch (error) {
      logger.error('Error updating transaction:', error);
      throw error;
    }
  }

  /**
   * Validate and parse incoming message
   */
  async validateAndParseMessage(data) {
    try {
      let parsedData = data;
      
      // Detect message format
      if (data.messageFormat === 'ISO8583' || this.iso8583Parser.isISO8583(data.rawMessage)) {
        parsedData = await this.iso8583Parser.parse(data.rawMessage);
        parsedData.messageFormat = 'ISO8583';
      } else if (data.messageFormat === 'ISO20022' || this.iso20022Parser.isISO20022(data.rawMessage)) {
        parsedData = await this.iso20022Parser.parse(data.rawMessage);
        parsedData.messageFormat = 'ISO20022';
      }
      
      // Transform to internal format
      const transformedData = await this.messageTransformer.toInternal(parsedData);
      
      return transformedData;
      
    } catch (error) {
      logger.error('Error validating/parsing message:', error);
      throw new Error(`Message validation failed: ${error.message}`);
    }
  }

  /**
   * Enrich transaction with additional data
   */
  async enrichTransaction(data) {
    const enrichedData = {
      ...data,
      transactionId: data.transactionId || this.generateTransactionId(),
      timestamp: new Date(),
      processingStartTime: new Date(),
      version: '1.0',
      source: data.source || 'unknown',
      enrichmentData: {
        geoLocation: await this.getGeoLocation(data.sourceIP),
        riskScore: await this.calculateRiskScore(data),
        merchantInfo: await this.getMerchantInfo(data.merchantId)
      }
    };
    
    return enrichedData;
  }

  /**
   * Process transaction through the payment switch
   */
  async processTransaction(transaction) {
    try {
      logger.info('Processing transaction', { transactionId: transaction.transactionId });
      
      // Update state to PROCESSING
      await this.patch(transaction._id, { 
        state: 'PROCESSING',
        stateMetadata: { startTime: new Date() }
      });
      
      // Route transaction to appropriate PSP
      const routingDecision = await this.routeTransaction(transaction);
      
      // Update transaction with routing info
      await this.patch(transaction._id, {
        routingDecision: routingDecision,
        selectedPSP: routingDecision.selectedPSP
      });
      
      // Send to PSP Gateway
      const pspResponse = await this.sendToPSP(transaction, routingDecision);
      
      // Process PSP response
      await this.processPSPResponse(transaction, pspResponse);
      
    } catch (error) {
      logger.error('Error processing transaction:', error);
      
      // Update state to FAILED
      await this.patch(transaction._id, {
        state: 'FAILED',
        errorCode: error.code || 'PROCESSING_ERROR',
        errorMessage: error.message,
        stateMetadata: { error: error.message, timestamp: new Date() }
      });
      
      // Emit error event
      this.eventBus.emit('transaction.error', {
        transactionId: transaction.transactionId,
        error: error.message
      });
    }
  }

  /**
   * Route transaction to appropriate PSP
   */
  async routeTransaction(transaction) {
    try {
      // Call routing engine service
      const routingResponse = await this.app.service('routing-engine').create({
        transaction: transaction,
        criteria: {
          amount: transaction.amount,
          currency: transaction.currency,
          merchantType: transaction.merchantType,
          geography: transaction.enrichmentData?.geoLocation,
          riskScore: transaction.enrichmentData?.riskScore
        }
      });
      
      return routingResponse;
      
    } catch (error) {
      logger.error('Error routing transaction:', error);
      throw new Error(`Routing failed: ${error.message}`);
    }
  }

  /**
   * Send transaction to PSP
   */
  async sendToPSP(transaction, routingDecision) {
    try {
      // Call PSP Gateway service
      const pspResponse = await this.app.service('psp-gateway').create({
        transaction: transaction,
        psp: routingDecision.selectedPSP,
        routingDecision: routingDecision
      });
      
      return pspResponse;
      
    } catch (error) {
      logger.error('Error sending to PSP:', error);
      throw new Error(`PSP communication failed: ${error.message}`);
    }
  }

  /**
   * Process PSP response
   */
  async processPSPResponse(transaction, pspResponse) {
    try {
      let finalState = 'COMPLETED';
      let responseData = {};
      
      if (pspResponse.status === 'APPROVED') {
        finalState = 'COMPLETED';
        responseData = {
          approvalCode: pspResponse.approvalCode,
          pspTransactionId: pspResponse.pspTransactionId,
          processingTime: new Date() - transaction.processingStartTime
        };
      } else if (pspResponse.status === 'DECLINED') {
        finalState = 'DECLINED';
        responseData = {
          declineReason: pspResponse.declineReason,
          pspErrorCode: pspResponse.errorCode
        };
      } else {
        finalState = 'FAILED';
        responseData = {
          errorMessage: pspResponse.errorMessage || 'Unknown PSP error'
        };
      }
      
      // Update transaction with final state
      await this.patch(transaction._id, {
        state: finalState,
        pspResponse: pspResponse,
        responseData: responseData,
        completedAt: new Date(),
        stateMetadata: { pspResponse: pspResponse }
      });
      
      // Emit completion event
      this.eventBus.emit('transaction.completed', {
        transactionId: transaction.transactionId,
        state: finalState,
        transaction: transaction
      });
      
    } catch (error) {
      logger.error('Error processing PSP response:', error);
      throw error;
    }
  }

  /**
   * Get transaction metrics
   */
  async getMetrics() {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const metrics = {
        totalTransactions: await this.Model.countDocuments(),
        transactionsLastHour: await this.Model.countDocuments({
          timestamp: { $gte: oneHourAgo }
        }),
        transactionsLastDay: await this.Model.countDocuments({
          timestamp: { $gte: oneDayAgo }
        }),
        stateDistribution: await this.Model.aggregate([
          { $group: { _id: '$state', count: { $sum: 1 } } }
        ]),
        averageProcessingTime: await this.Model.aggregate([
          {
            $match: {
              state: 'COMPLETED',
              'responseData.processingTime': { $exists: true }
            }
          },
          {
            $group: {
              _id: null,
              avgTime: { $avg: '$responseData.processingTime' }
            }
          }
        ])
      };
      
      return metrics;
      
    } catch (error) {
      logger.error('Error getting metrics:', error);
      throw error;
    }
  }

  // Utility methods
  generateTransactionId() {
    return `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async getGeoLocation(ip) {
    // Placeholder for geo-location service
    return { country: 'US', region: 'CA', city: 'San Francisco' };
  }

  async calculateRiskScore(data) {
    // Placeholder for risk scoring algorithm
    return Math.floor(Math.random() * 100);
  }

  async getMerchantInfo(merchantId) {
    // Placeholder for merchant information lookup
    return { name: 'Sample Merchant', category: 'retail' };
  }
}

module.exports = function(app) {
  const options = {
    Model: Transaction,
    paginate: app.get('paginate')
  };

  app.use('/transactions', new TransactionService(options, app));
};

