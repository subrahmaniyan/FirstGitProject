/**
 * Advanced Load Balancing Algorithms for PSP Selection
 * Implements multiple load balancing strategies for optimal PSP distribution
 */

const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

class LoadBalancer {
  constructor() {
    this.algorithms = {
      'round-robin': this.roundRobin.bind(this),
      'weighted-round-robin': this.weightedRoundRobin.bind(this),
      'least-connections': this.leastConnections.bind(this),
      'weighted-least-connections': this.weightedLeastConnections.bind(this),
      'response-time': this.responseTimeBased.bind(this),
      'success-rate': this.successRateBased.bind(this),
      'cost-optimized': this.costOptimized.bind(this),
      'hybrid-score': this.hybridScore.bind(this),
      'adaptive': this.adaptive.bind(this)
    };
    
    this.currentAlgorithm = 'hybrid-score';
    this.roundRobinCounters = new Map();
    this.connectionCounts = new Map();
    this.responseTimeHistory = new Map();
    this.successRateHistory = new Map();
    this.initialized = false;
  }

  static getInstance() {
    if (!LoadBalancer.instance) {
      LoadBalancer.instance = new LoadBalancer();
    }
    return LoadBalancer.instance;
  }

  /**
   * Initialize load balancer with application context
   */
  initialize(app) {
    this.app = app;
    this.initialized = true;
    logger.info('Load balancer initialized successfully');
  }

  /**
   * Select PSP using configured algorithm
   */
  async selectPSP(eligiblePSPs, transaction, criteria) {
    try {
      if (!this.initialized) {
        throw new Error('Load balancer not initialized');
      }

      if (!eligiblePSPs || eligiblePSPs.length === 0) {
        throw new Error('No eligible PSPs provided');
      }

      logger.info('Selecting PSP using load balancer', {
        algorithm: this.currentAlgorithm,
        eligiblePSPCount: eligiblePSPs.length,
        transactionId: transaction.transactionId
      });

      // Get algorithm function
      const algorithmFunction = this.algorithms[this.currentAlgorithm];
      if (!algorithmFunction) {
        throw new Error(`Unknown algorithm: ${this.currentAlgorithm}`);
      }

      // Apply algorithm
      const selectedPSP = await algorithmFunction(eligiblePSPs, transaction, criteria);

      // Update metrics
      await this.updateMetrics(selectedPSP, transaction);

      logger.info('PSP selected successfully', {
        selectedPSP: selectedPSP.id,
        algorithm: this.currentAlgorithm,
        transactionId: transaction.transactionId
      });

      return selectedPSP;

    } catch (error) {
      logger.error('Error selecting PSP:', error);
      throw error;
    }
  }

  /**
   * Round Robin Algorithm
   */
  async roundRobin(eligiblePSPs, transaction, criteria) {
    const key = 'global';
    const currentIndex = this.roundRobinCounters.get(key) || 0;
    const selectedIndex = currentIndex % eligiblePSPs.length;
    
    this.roundRobinCounters.set(key, currentIndex + 1);
    
    return eligiblePSPs[selectedIndex];
  }

  /**
   * Weighted Round Robin Algorithm
   */
  async weightedRoundRobin(eligiblePSPs, transaction, criteria) {
    // Create weighted list based on PSP priority and success rate
    const weightedList = [];
    
    for (const psp of eligiblePSPs) {
      const weight = Math.round((psp.successRate || 0.95) * (psp.priority || 1) * 10);
      for (let i = 0; i < weight; i++) {
        weightedList.push(psp);
      }
    }
    
    if (weightedList.length === 0) {
      return eligiblePSPs[0];
    }
    
    const key = 'weighted';
    const currentIndex = this.roundRobinCounters.get(key) || 0;
    const selectedIndex = currentIndex % weightedList.length;
    
    this.roundRobinCounters.set(key, currentIndex + 1);
    
    return weightedList[selectedIndex];
  }

  /**
   * Least Connections Algorithm
   */
  async leastConnections(eligiblePSPs, transaction, criteria) {
    let selectedPSP = eligiblePSPs[0];
    let minConnections = this.connectionCounts.get(selectedPSP.id) || 0;
    
    for (const psp of eligiblePSPs) {
      const connections = this.connectionCounts.get(psp.id) || 0;
      if (connections < minConnections) {
        minConnections = connections;
        selectedPSP = psp;
      }
    }
    
    // Increment connection count
    this.connectionCounts.set(selectedPSP.id, minConnections + 1);
    
    return selectedPSP;
  }

  /**
   * Weighted Least Connections Algorithm
   */
  async weightedLeastConnections(eligiblePSPs, transaction, criteria) {
    let selectedPSP = eligiblePSPs[0];
    let minRatio = Infinity;
    
    for (const psp of eligiblePSPs) {
      const connections = this.connectionCounts.get(psp.id) || 0;
      const weight = (psp.successRate || 0.95) * (psp.priority || 1);
      const ratio = weight > 0 ? connections / weight : Infinity;
      
      if (ratio < minRatio) {
        minRatio = ratio;
        selectedPSP = psp;
      }
    }
    
    // Increment connection count
    const currentConnections = this.connectionCounts.get(selectedPSP.id) || 0;
    this.connectionCounts.set(selectedPSP.id, currentConnections + 1);
    
    return selectedPSP;
  }

  /**
   * Response Time Based Algorithm
   */
  async responseTimeBased(eligiblePSPs, transaction, criteria) {
    let selectedPSP = eligiblePSPs[0];
    let bestResponseTime = selectedPSP.averageResponseTime || Infinity;
    
    for (const psp of eligiblePSPs) {
      const responseTime = await this.getAverageResponseTime(psp.id);
      if (responseTime < bestResponseTime) {
        bestResponseTime = responseTime;
        selectedPSP = psp;
      }
    }
    
    return selectedPSP;
  }

  /**
   * Success Rate Based Algorithm
   */
  async successRateBased(eligiblePSPs, transaction, criteria) {
    let selectedPSP = eligiblePSPs[0];
    let bestSuccessRate = selectedPSP.successRate || 0;
    
    for (const psp of eligiblePSPs) {
      const successRate = await this.getRecentSuccessRate(psp.id);
      if (successRate > bestSuccessRate) {
        bestSuccessRate = successRate;
        selectedPSP = psp;
      }
    }
    
    return selectedPSP;
  }

  /**
   * Cost Optimized Algorithm
   */
  async costOptimized(eligiblePSPs, transaction, criteria) {
    let selectedPSP = eligiblePSPs[0];
    let lowestCost = selectedPSP.processingFee || Infinity;
    
    for (const psp of eligiblePSPs) {
      const cost = this.calculateTransactionCost(psp, transaction);
      if (cost < lowestCost) {
        lowestCost = cost;
        selectedPSP = psp;
      }
    }
    
    return selectedPSP;
  }

  /**
   * Hybrid Score Algorithm (Default)
   */
  async hybridScore(eligiblePSPs, transaction, criteria) {
    let selectedPSP = eligiblePSPs[0];
    let bestScore = -Infinity;
    
    for (const psp of eligiblePSPs) {
      const score = await this.calculateHybridScore(psp, transaction, criteria);
      if (score > bestScore) {
        bestScore = score;
        selectedPSP = psp;
      }
    }
    
    return selectedPSP;
  }

  /**
   * Adaptive Algorithm
   */
  async adaptive(eligiblePSPs, transaction, criteria) {
    // Choose algorithm based on current conditions
    const currentHour = new Date().getHours();
    const transactionAmount = transaction.amount || criteria.amount || 0;
    
    // Peak hours: use response time based
    if (currentHour >= 9 && currentHour <= 17) {
      return await this.responseTimeBased(eligiblePSPs, transaction, criteria);
    }
    
    // High value transactions: use success rate based
    if (transactionAmount > 1000) {
      return await this.successRateBased(eligiblePSPs, transaction, criteria);
    }
    
    // Low value transactions: use cost optimized
    if (transactionAmount < 100) {
      return await this.costOptimized(eligiblePSPs, transaction, criteria);
    }
    
    // Default: use hybrid score
    return await this.hybridScore(eligiblePSPs, transaction, criteria);
  }

  /**
   * Calculate hybrid score for PSP
   */
  async calculateHybridScore(psp, transaction, criteria) {
    try {
      let score = 0;
      
      // Success rate component (30% weight)
      const successRate = await this.getRecentSuccessRate(psp.id);
      score += successRate * 30;
      
      // Response time component (25% weight) - lower is better
      const responseTime = await this.getAverageResponseTime(psp.id);
      const responseTimeScore = Math.max(0, 100 - (responseTime / 10));
      score += responseTimeScore * 0.25;
      
      // Cost component (20% weight) - lower is better
      const cost = this.calculateTransactionCost(psp, transaction);
      const costScore = Math.max(0, 100 - (cost * 100));
      score += costScore * 0.2;
      
      // Load component (15% weight) - lower load is better
      const currentLoad = this.connectionCounts.get(psp.id) || 0;
      const loadScore = Math.max(0, 100 - currentLoad);
      score += loadScore * 0.15;
      
      // Rule-based score component (10% weight)
      const ruleScore = psp.ruleScore || 100;
      score += ruleScore * 0.1;
      
      return score;
      
    } catch (error) {
      logger.error('Error calculating hybrid score:', error);
      return 0;
    }
  }

  /**
   * Get recent success rate for PSP
   */
  async getRecentSuccessRate(pspId) {
    try {
      // In a real implementation, this would query recent transaction data
      // For now, return the configured success rate with some variation
      const basePSPData = await this.getBasePSPData(pspId);
      const baseRate = basePSPData?.successRate || 0.95;
      
      // Add some realistic variation based on recent performance
      const variation = (Math.random() - 0.5) * 0.1; // ±5% variation
      return Math.max(0, Math.min(1, baseRate + variation));
      
    } catch (error) {
      logger.error('Error getting success rate:', error);
      return 0.95; // Default fallback
    }
  }

  /**
   * Get average response time for PSP
   */
  async getAverageResponseTime(pspId) {
    try {
      // In a real implementation, this would query recent response time data
      const basePSPData = await this.getBasePSPData(pspId);
      const baseTime = basePSPData?.averageResponseTime || 200;
      
      // Add some realistic variation
      const variation = (Math.random() - 0.5) * 100; // ±50ms variation
      return Math.max(50, baseTime + variation);
      
    } catch (error) {
      logger.error('Error getting response time:', error);
      return 200; // Default fallback
    }
  }

  /**
   * Calculate transaction cost for PSP
   */
  calculateTransactionCost(psp, transaction) {
    try {
      const amount = transaction.amount || 100; // Default amount
      const feeRate = psp.processingFee || 0.025;
      const fixedFee = psp.fixedFee || 0;
      
      return (amount * feeRate) + fixedFee;
      
    } catch (error) {
      logger.error('Error calculating transaction cost:', error);
      return 0;
    }
  }

  /**
   * Get base PSP data
   */
  async getBasePSPData(pspId) {
    // This would typically come from a database or cache
    const pspData = {
      'visa': { successRate: 0.98, averageResponseTime: 150, processingFee: 0.025 },
      'mastercard': { successRate: 0.97, averageResponseTime: 180, processingFee: 0.023 },
      'amex': { successRate: 0.96, averageResponseTime: 200, processingFee: 0.035 },
      'discover': { successRate: 0.95, averageResponseTime: 220, processingFee: 0.028 }
    };
    
    return pspData[pspId] || { successRate: 0.95, averageResponseTime: 200, processingFee: 0.03 };
  }

  /**
   * Update metrics after PSP selection
   */
  async updateMetrics(selectedPSP, transaction) {
    try {
      // Update connection count
      const currentConnections = this.connectionCounts.get(selectedPSP.id) || 0;
      this.connectionCounts.set(selectedPSP.id, currentConnections + 1);
      
      // Store selection for analytics
      const redis = require('../utils/redis');
      const key = `lb:selection:${selectedPSP.id}`;
      
      await redis.hincrby(key, 'total_selected', 1);
      await redis.hincrby(key, `selected_${new Date().toISOString().split('T')[0]}`, 1);
      await redis.expire(key, 86400 * 30); // 30 days TTL
      
    } catch (error) {
      logger.error('Error updating load balancer metrics:', error);
      // Don't throw error as this is not critical
    }
  }

  /**
   * Decrement connection count (called when transaction completes)
   */
  async releaseConnection(pspId) {
    try {
      const currentConnections = this.connectionCounts.get(pspId) || 0;
      this.connectionCounts.set(pspId, Math.max(0, currentConnections - 1));
    } catch (error) {
      logger.error('Error releasing connection:', error);
    }
  }

  /**
   * Set load balancing algorithm
   */
  setAlgorithm(algorithm) {
    if (!this.algorithms[algorithm]) {
      throw new Error(`Unknown algorithm: ${algorithm}`);
    }
    
    this.currentAlgorithm = algorithm;
    logger.info('Load balancing algorithm changed', { algorithm });
  }

  /**
   * Get current algorithm name
   */
  getAlgorithmName() {
    return this.currentAlgorithm;
  }

  /**
   * Get available algorithms
   */
  getAvailableAlgorithms() {
    return Object.keys(this.algorithms);
  }

  /**
   * Get load balancer statistics
   */
  getStatistics() {
    return {
      currentAlgorithm: this.currentAlgorithm,
      availableAlgorithms: this.getAvailableAlgorithms(),
      connectionCounts: Object.fromEntries(this.connectionCounts),
      roundRobinCounters: Object.fromEntries(this.roundRobinCounters),
      totalSelections: Array.from(this.connectionCounts.values()).reduce((sum, count) => sum + count, 0)
    };
  }

  /**
   * Reset all counters and metrics
   */
  reset() {
    this.roundRobinCounters.clear();
    this.connectionCounts.clear();
    this.responseTimeHistory.clear();
    this.successRateHistory.clear();
    logger.info('Load balancer metrics reset');
  }

  /**
   * Get PSP load distribution
   */
  getLoadDistribution() {
    const total = Array.from(this.connectionCounts.values()).reduce((sum, count) => sum + count, 0);
    const distribution = {};
    
    for (const [pspId, count] of this.connectionCounts) {
      distribution[pspId] = {
        connections: count,
        percentage: total > 0 ? (count / total * 100).toFixed(2) : 0
      };
    }
    
    return distribution;
  }

  /**
   * Predict optimal PSP for given criteria
   */
  async predictOptimalPSP(eligiblePSPs, criteria) {
    try {
      const predictions = [];
      
      for (const psp of eligiblePSPs) {
        const score = await this.calculateHybridScore(psp, { amount: criteria.amount }, criteria);
        predictions.push({
          pspId: psp.id,
          predictedScore: score,
          confidence: this.calculatePredictionConfidence(psp, criteria)
        });
      }
      
      return predictions.sort((a, b) => b.predictedScore - a.predictedScore);
      
    } catch (error) {
      logger.error('Error predicting optimal PSP:', error);
      throw error;
    }
  }

  /**
   * Calculate prediction confidence
   */
  calculatePredictionConfidence(psp, criteria) {
    // Simple confidence calculation based on historical data availability
    let confidence = 0.5; // Base confidence
    
    // Increase confidence if we have recent data
    if (this.connectionCounts.has(psp.id)) {
      confidence += 0.2;
    }
    
    // Increase confidence for well-known PSPs
    if (['visa', 'mastercard'].includes(psp.id)) {
      confidence += 0.2;
    }
    
    // Increase confidence for matching transaction patterns
    if (psp.supportedTransactionTypes?.includes(criteria.transactionType)) {
      confidence += 0.1;
    }
    
    return Math.min(1.0, confidence);
  }
}

module.exports = LoadBalancer;

