const { Service } = require('feathers-mongoose');
const RoutingDecision = require('../models/routing-decision.model');
const RuleEngine = require('../engines/rule-engine');
const LoadBalancer = require('../algorithms/load-balancer');
const CircuitBreaker = require('../utils/circuit-breaker');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

class RoutingService extends Service {
  constructor(options, app) {
    super(options, app);
    this.app = app;
    this.ruleEngine = RuleEngine.getInstance();
    this.loadBalancer = LoadBalancer.getInstance();
    this.circuitBreaker = CircuitBreaker.getInstance();
  }

  /**
   * Route a transaction to the best PSP
   */
  async create(data, params) {
    try {
      const { transaction, criteria } = data;
      logger.info('Processing routing request', { 
        transactionId: transaction.transactionId,
        criteria 
      });

      // Start routing decision process
      const routingDecision = await this.makeRoutingDecision(transaction, criteria);
      
      // Save routing decision
      const savedDecision = await super.create(routingDecision, params);
      
      // Update PSP metrics
      await this.updatePSPMetrics(savedDecision);
      
      logger.info('Routing decision completed', {
        transactionId: transaction.transactionId,
        selectedPSP: savedDecision.selectedPSP,
        routingScore: savedDecision.routingScore
      });
      
      return savedDecision;
      
    } catch (error) {
      logger.error('Error in routing service:', error);
      throw error;
    }
  }

  /**
   * Make routing decision based on rules and algorithms
   */
  async makeRoutingDecision(transaction, criteria) {
    try {
      // Get available PSPs
      const availablePSPs = await this.getAvailablePSPs(criteria);
      
      if (availablePSPs.length === 0) {
        throw new Error('No available PSPs for routing');
      }
      
      // Apply routing rules
      const ruleResults = await this.ruleEngine.evaluateRules(transaction, criteria, availablePSPs);
      
      // Filter PSPs based on rule results
      const eligiblePSPs = this.filterEligiblePSPs(availablePSPs, ruleResults);
      
      if (eligiblePSPs.length === 0) {
        throw new Error('No eligible PSPs after rule evaluation');
      }
      
      // Apply load balancing algorithm
      const selectedPSP = await this.loadBalancer.selectPSP(eligiblePSPs, transaction, criteria);
      
      // Calculate routing score
      const routingScore = this.calculateRoutingScore(selectedPSP, ruleResults, criteria);
      
      // Get alternative PSPs for failover
      const alternativePSPs = eligiblePSPs
        .filter(psp => psp.id !== selectedPSP.id)
        .slice(0, 3)
        .map(psp => psp.id);
      
      const routingDecision = {
        transactionId: transaction.transactionId,
        selectedPSP: selectedPSP.id,
        selectedPSPDetails: selectedPSP,
        routingRules: ruleResults.appliedRules,
        alternativePSPs: alternativePSPs,
        routingScore: routingScore,
        decisionTime: new Date(),
        decisionMetadata: {
          availablePSPCount: availablePSPs.length,
          eligiblePSPCount: eligiblePSPs.length,
          loadBalancingAlgorithm: this.loadBalancer.getAlgorithmName(),
          ruleEngineVersion: this.ruleEngine.getVersion(),
          criteria: criteria
        }
      };
      
      return routingDecision;
      
    } catch (error) {
      logger.error('Error making routing decision:', error);
      throw error;
    }
  }

  /**
   * Get available PSPs based on criteria
   */
  async getAvailablePSPs(criteria) {
    try {
      // Get PSP health status
      const pspHealthService = this.app.service('psp-health');
      const healthStatus = await pspHealthService.getHealthStatus();
      
      // Get PSP configurations
      const pspConfigs = await this.getPSPConfigurations();
      
      // Filter available PSPs
      const availablePSPs = pspConfigs.filter(psp => {
        // Check if PSP is healthy
        const health = healthStatus[psp.id];
        if (!health || !health.isHealthy) {
          return false;
        }
        
        // Check circuit breaker status
        if (this.circuitBreaker.isOpen(psp.id)) {
          return false;
        }
        
        // Check if PSP supports the transaction type
        if (!psp.supportedTransactionTypes.includes(criteria.transactionType)) {
          return false;
        }
        
        // Check currency support
        if (!psp.supportedCurrencies.includes(criteria.currency)) {
          return false;
        }
        
        // Check amount limits
        if (criteria.amount < psp.minAmount || criteria.amount > psp.maxAmount) {
          return false;
        }
        
        // Check geographic restrictions
        if (psp.restrictedCountries && 
            psp.restrictedCountries.includes(criteria.geography?.country)) {
          return false;
        }
        
        return true;
      });
      
      return availablePSPs;
      
    } catch (error) {
      logger.error('Error getting available PSPs:', error);
      throw error;
    }
  }

  /**
   * Get PSP configurations
   */
  async getPSPConfigurations() {
    // This would typically come from a database or configuration service
    // For now, return mock data
    return [
      {
        id: 'visa',
        name: 'Visa',
        priority: 1,
        supportedTransactionTypes: ['PURCHASE', 'AUTHORIZATION', 'REFUND'],
        supportedCurrencies: ['USD', 'EUR', 'GBP'],
        minAmount: 0.01,
        maxAmount: 10000.00,
        processingFee: 0.025,
        successRate: 0.98,
        averageResponseTime: 150,
        restrictedCountries: [],
        capabilities: ['3DS', 'TOKENIZATION', 'RECURRING']
      },
      {
        id: 'mastercard',
        name: 'Mastercard',
        priority: 2,
        supportedTransactionTypes: ['PURCHASE', 'AUTHORIZATION', 'REFUND'],
        supportedCurrencies: ['USD', 'EUR', 'GBP'],
        minAmount: 0.01,
        maxAmount: 15000.00,
        processingFee: 0.023,
        successRate: 0.97,
        averageResponseTime: 180,
        restrictedCountries: [],
        capabilities: ['3DS', 'TOKENIZATION', 'RECURRING']
      },
      {
        id: 'amex',
        name: 'American Express',
        priority: 3,
        supportedTransactionTypes: ['PURCHASE', 'AUTHORIZATION', 'REFUND'],
        supportedCurrencies: ['USD', 'EUR'],
        minAmount: 1.00,
        maxAmount: 25000.00,
        processingFee: 0.035,
        successRate: 0.96,
        averageResponseTime: 200,
        restrictedCountries: [],
        capabilities: ['3DS', 'TOKENIZATION']
      },
      {
        id: 'discover',
        name: 'Discover',
        priority: 4,
        supportedTransactionTypes: ['PURCHASE', 'AUTHORIZATION', 'REFUND'],
        supportedCurrencies: ['USD'],
        minAmount: 0.01,
        maxAmount: 5000.00,
        processingFee: 0.028,
        successRate: 0.95,
        averageResponseTime: 220,
        restrictedCountries: [],
        capabilities: ['3DS']
      }
    ];
  }

  /**
   * Filter eligible PSPs based on rule results
   */
  filterEligiblePSPs(availablePSPs, ruleResults) {
    const eligiblePSPs = [];
    
    for (const psp of availablePSPs) {
      let isEligible = true;
      
      // Check if any blocking rules apply to this PSP
      for (const rule of ruleResults.appliedRules) {
        if (rule.action === 'BLOCK' && 
            (rule.targetPSPs.includes(psp.id) || rule.targetPSPs.includes('*'))) {
          isEligible = false;
          break;
        }
      }
      
      if (isEligible) {
        // Add rule-based scoring
        psp.ruleScore = this.calculateRuleScore(psp, ruleResults);
        eligiblePSPs.push(psp);
      }
    }
    
    return eligiblePSPs;
  }

  /**
   * Calculate rule-based score for PSP
   */
  calculateRuleScore(psp, ruleResults) {
    let score = 100; // Base score
    
    for (const rule of ruleResults.appliedRules) {
      if (rule.targetPSPs.includes(psp.id) || rule.targetPSPs.includes('*')) {
        switch (rule.action) {
          case 'PREFER':
            score += rule.weight || 10;
            break;
          case 'AVOID':
            score -= rule.weight || 10;
            break;
          case 'BOOST':
            score += rule.weight || 20;
            break;
          case 'PENALIZE':
            score -= rule.weight || 20;
            break;
        }
      }
    }
    
    return Math.max(0, score); // Ensure non-negative score
  }

  /**
   * Calculate overall routing score
   */
  calculateRoutingScore(selectedPSP, ruleResults, criteria) {
    let score = 0;
    
    // Rule-based score (40% weight)
    score += (selectedPSP.ruleScore || 100) * 0.4;
    
    // Success rate score (25% weight)
    score += selectedPSP.successRate * 100 * 0.25;
    
    // Response time score (20% weight) - lower is better
    const responseTimeScore = Math.max(0, 100 - (selectedPSP.averageResponseTime / 10));
    score += responseTimeScore * 0.2;
    
    // Cost score (15% weight) - lower fee is better
    const costScore = Math.max(0, 100 - (selectedPSP.processingFee * 1000));
    score += costScore * 0.15;
    
    return Math.round(score);
  }

  /**
   * Update PSP metrics after routing decision
   */
  async updatePSPMetrics(routingDecision) {
    try {
      // Update routing statistics
      const redis = require('../utils/redis');
      const key = `psp:routing:${routingDecision.selectedPSP}`;
      
      await redis.hincrby(key, 'total_routed', 1);
      await redis.hincrby(key, `routed_${new Date().toISOString().split('T')[0]}`, 1);
      await redis.expire(key, 86400 * 30); // 30 days TTL
      
    } catch (error) {
      logger.error('Error updating PSP metrics:', error);
      // Don't throw error as this is not critical
    }
  }

  /**
   * Get routing metrics
   */
  async getMetrics() {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const metrics = {
        totalRoutingDecisions: await this.Model.countDocuments(),
        routingDecisionsLastHour: await this.Model.countDocuments({
          decisionTime: { $gte: oneHourAgo }
        }),
        routingDecisionsLastDay: await this.Model.countDocuments({
          decisionTime: { $gte: oneDayAgo }
        }),
        pspDistribution: await this.Model.aggregate([
          { $group: { _id: '$selectedPSP', count: { $sum: 1 } } }
        ]),
        averageRoutingScore: await this.Model.aggregate([
          {
            $group: {
              _id: null,
              avgScore: { $avg: '$routingScore' }
            }
          }
        ]),
        routingRuleUsage: await this.Model.aggregate([
          { $unwind: '$routingRules' },
          { $group: { _id: '$routingRules.ruleId', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ])
      };
      
      return metrics;
      
    } catch (error) {
      logger.error('Error getting routing metrics:', error);
      throw error;
    }
  }

  /**
   * Get routing decision by transaction ID
   */
  async findByTransactionId(transactionId) {
    try {
      return await this.Model.findOne({ transactionId });
    } catch (error) {
      logger.error('Error finding routing decision:', error);
      throw error;
    }
  }

  /**
   * Get routing performance analytics
   */
  async getPerformanceAnalytics(startDate, endDate) {
    try {
      const analytics = await this.Model.aggregate([
        {
          $match: {
            decisionTime: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: {
              psp: '$selectedPSP',
              date: { $dateToString: { format: '%Y-%m-%d', date: '$decisionTime' } }
            },
            count: { $sum: 1 },
            avgScore: { $avg: '$routingScore' },
            alternativeCount: { $avg: { $size: '$alternativePSPs' } }
          }
        },
        {
          $sort: { '_id.date': 1, '_id.psp': 1 }
        }
      ]);
      
      return analytics;
      
    } catch (error) {
      logger.error('Error getting performance analytics:', error);
      throw error;
    }
  }
}

module.exports = function(app) {
  const options = {
    Model: RoutingDecision,
    paginate: app.get('paginate')
  };

  app.use('/routing', new RoutingService(options, app));
};

