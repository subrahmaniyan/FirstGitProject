/**
 * Advanced Rule Engine for Transaction Routing
 * Evaluates complex business rules to determine PSP routing decisions
 */

const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

class RuleEngine {
  constructor() {
    this.rules = [];
    this.ruleCache = new Map();
    this.version = '1.0.0';
    this.initialized = false;
  }

  static getInstance() {
    if (!RuleEngine.instance) {
      RuleEngine.instance = new RuleEngine();
    }
    return RuleEngine.instance;
  }

  /**
   * Initialize rule engine with application context
   */
  async initialize(app) {
    try {
      this.app = app;
      await this.loadRules();
      this.initialized = true;
      logger.info('Rule engine initialized successfully');
    } catch (error) {
      logger.error('Error initializing rule engine:', error);
      throw error;
    }
  }

  /**
   * Load routing rules from database or configuration
   */
  async loadRules() {
    try {
      // In a real implementation, this would load from database
      // For now, we'll use predefined rules
      this.rules = [
        {
          id: 'high-value-transaction',
          name: 'High Value Transaction Routing',
          priority: 1,
          conditions: [
            {
              field: 'amount',
              operator: 'gte',
              value: 10000
            }
          ],
          action: 'PREFER',
          targetPSPs: ['visa', 'mastercard'],
          weight: 25,
          enabled: true,
          description: 'Route high-value transactions to premium PSPs'
        },
        {
          id: 'low-risk-merchant',
          name: 'Low Risk Merchant Optimization',
          priority: 2,
          conditions: [
            {
              field: 'enrichmentData.riskScore',
              operator: 'lt',
              value: 30
            },
            {
              field: 'merchantCategory',
              operator: 'in',
              value: ['retail', 'grocery', 'pharmacy']
            }
          ],
          action: 'BOOST',
          targetPSPs: ['*'],
          weight: 15,
          enabled: true,
          description: 'Boost routing for low-risk merchants'
        },
        {
          id: 'high-risk-geography',
          name: 'High Risk Geography Restriction',
          priority: 3,
          conditions: [
            {
              field: 'enrichmentData.geoLocation.country',
              operator: 'in',
              value: ['XX', 'YY', 'ZZ'] // High-risk countries
            }
          ],
          action: 'BLOCK',
          targetPSPs: ['discover'],
          weight: 50,
          enabled: true,
          description: 'Block certain PSPs for high-risk geographies'
        },
        {
          id: 'peak-hours-load-balancing',
          name: 'Peak Hours Load Balancing',
          priority: 4,
          conditions: [
            {
              field: 'timestamp',
              operator: 'time_between',
              value: ['09:00', '17:00']
            }
          ],
          action: 'DISTRIBUTE',
          targetPSPs: ['visa', 'mastercard', 'amex'],
          weight: 10,
          enabled: true,
          description: 'Distribute load during peak hours'
        },
        {
          id: 'currency-optimization',
          name: 'Currency-Based Routing',
          priority: 5,
          conditions: [
            {
              field: 'currency',
              operator: 'eq',
              value: 'EUR'
            }
          ],
          action: 'PREFER',
          targetPSPs: ['visa', 'mastercard'],
          weight: 20,
          enabled: true,
          description: 'Prefer specific PSPs for EUR transactions'
        },
        {
          id: 'recurring-payment-optimization',
          name: 'Recurring Payment Optimization',
          priority: 6,
          conditions: [
            {
              field: 'transactionType',
              operator: 'eq',
              value: 'RECURRING'
            }
          ],
          action: 'PREFER',
          targetPSPs: ['visa', 'mastercard'],
          weight: 15,
          enabled: true,
          description: 'Optimize routing for recurring payments'
        },
        {
          id: 'weekend-routing',
          name: 'Weekend Routing Strategy',
          priority: 7,
          conditions: [
            {
              field: 'timestamp',
              operator: 'day_of_week',
              value: [6, 7] // Saturday, Sunday
            }
          ],
          action: 'AVOID',
          targetPSPs: ['amex'],
          weight: 10,
          enabled: true,
          description: 'Avoid certain PSPs during weekends'
        },
        {
          id: 'mobile-transaction-routing',
          name: 'Mobile Transaction Routing',
          priority: 8,
          conditions: [
            {
              field: 'enrichmentData.deviceInfo.userAgent',
              operator: 'contains',
              value: 'Mobile'
            }
          ],
          action: 'PREFER',
          targetPSPs: ['visa', 'mastercard'],
          weight: 12,
          enabled: true,
          description: 'Optimize routing for mobile transactions'
        },
        {
          id: 'failed-transaction-fallback',
          name: 'Failed Transaction Fallback',
          priority: 9,
          conditions: [
            {
              field: 'retryCount',
              operator: 'gt',
              value: 0
            }
          ],
          action: 'PREFER',
          targetPSPs: ['mastercard', 'visa'],
          weight: 30,
          enabled: true,
          description: 'Use reliable PSPs for retry attempts'
        },
        {
          id: 'cost-optimization',
          name: 'Cost Optimization Rule',
          priority: 10,
          conditions: [
            {
              field: 'amount',
              operator: 'lt',
              value: 100
            }
          ],
          action: 'PREFER',
          targetPSPs: ['visa', 'discover'],
          weight: 18,
          enabled: true,
          description: 'Use cost-effective PSPs for small transactions'
        }
      ];

      logger.info(`Loaded ${this.rules.length} routing rules`);
    } catch (error) {
      logger.error('Error loading rules:', error);
      throw error;
    }
  }

  /**
   * Evaluate all applicable rules for a transaction
   */
  async evaluateRules(transaction, criteria, availablePSPs) {
    try {
      if (!this.initialized) {
        throw new Error('Rule engine not initialized');
      }

      logger.info('Evaluating routing rules', { 
        transactionId: transaction.transactionId,
        ruleCount: this.rules.length 
      });

      const context = this.buildEvaluationContext(transaction, criteria);
      const appliedRules = [];
      const ruleResults = {
        appliedRules: [],
        blockedPSPs: [],
        preferredPSPs: [],
        avoidedPSPs: [],
        totalScore: 0
      };

      // Sort rules by priority
      const sortedRules = this.rules
        .filter(rule => rule.enabled)
        .sort((a, b) => a.priority - b.priority);

      for (const rule of sortedRules) {
        const ruleResult = await this.evaluateRule(rule, context);
        
        if (ruleResult.matched) {
          appliedRules.push({
            ruleId: rule.id,
            ruleName: rule.name,
            priority: rule.priority,
            action: rule.action,
            targetPSPs: rule.targetPSPs,
            weight: rule.weight,
            matched: true,
            matchedConditions: ruleResult.matchedConditions
          });

          // Apply rule actions
          this.applyRuleAction(rule, ruleResults, availablePSPs);
        }
      }

      ruleResults.appliedRules = appliedRules;

      logger.info('Rule evaluation completed', {
        transactionId: transaction.transactionId,
        appliedRulesCount: appliedRules.length,
        blockedPSPs: ruleResults.blockedPSPs.length,
        preferredPSPs: ruleResults.preferredPSPs.length
      });

      return ruleResults;

    } catch (error) {
      logger.error('Error evaluating rules:', error);
      throw error;
    }
  }

  /**
   * Evaluate a single rule against the context
   */
  async evaluateRule(rule, context) {
    try {
      const result = {
        matched: false,
        matchedConditions: []
      };

      // Check if rule is cached
      const cacheKey = `${rule.id}_${JSON.stringify(context)}`;
      if (this.ruleCache.has(cacheKey)) {
        return this.ruleCache.get(cacheKey);
      }

      // Evaluate all conditions (AND logic)
      let allConditionsMet = true;

      for (const condition of rule.conditions) {
        const conditionResult = this.evaluateCondition(condition, context);
        
        if (conditionResult.matched) {
          result.matchedConditions.push({
            field: condition.field,
            operator: condition.operator,
            value: condition.value,
            actualValue: conditionResult.actualValue
          });
        } else {
          allConditionsMet = false;
          break;
        }
      }

      result.matched = allConditionsMet;

      // Cache result for performance
      this.ruleCache.set(cacheKey, result);

      return result;

    } catch (error) {
      logger.error('Error evaluating rule:', error);
      return { matched: false, matchedConditions: [] };
    }
  }

  /**
   * Evaluate a single condition
   */
  evaluateCondition(condition, context) {
    try {
      const actualValue = this.getValueFromContext(condition.field, context);
      let matched = false;

      switch (condition.operator) {
        case 'eq':
          matched = actualValue === condition.value;
          break;
        case 'ne':
          matched = actualValue !== condition.value;
          break;
        case 'gt':
          matched = actualValue > condition.value;
          break;
        case 'gte':
          matched = actualValue >= condition.value;
          break;
        case 'lt':
          matched = actualValue < condition.value;
          break;
        case 'lte':
          matched = actualValue <= condition.value;
          break;
        case 'in':
          matched = Array.isArray(condition.value) && condition.value.includes(actualValue);
          break;
        case 'not_in':
          matched = Array.isArray(condition.value) && !condition.value.includes(actualValue);
          break;
        case 'contains':
          matched = typeof actualValue === 'string' && actualValue.includes(condition.value);
          break;
        case 'starts_with':
          matched = typeof actualValue === 'string' && actualValue.startsWith(condition.value);
          break;
        case 'ends_with':
          matched = typeof actualValue === 'string' && actualValue.endsWith(condition.value);
          break;
        case 'regex':
          matched = new RegExp(condition.value).test(actualValue);
          break;
        case 'time_between':
          matched = this.isTimeBetween(actualValue, condition.value[0], condition.value[1]);
          break;
        case 'day_of_week':
          matched = this.isDayOfWeek(actualValue, condition.value);
          break;
        case 'exists':
          matched = actualValue !== undefined && actualValue !== null;
          break;
        case 'not_exists':
          matched = actualValue === undefined || actualValue === null;
          break;
        default:
          logger.warn(`Unknown operator: ${condition.operator}`);
          matched = false;
      }

      return { matched, actualValue };

    } catch (error) {
      logger.error('Error evaluating condition:', error);
      return { matched: false, actualValue: null };
    }
  }

  /**
   * Build evaluation context from transaction and criteria
   */
  buildEvaluationContext(transaction, criteria) {
    const now = new Date();
    
    return {
      // Transaction fields
      transactionId: transaction.transactionId,
      transactionType: transaction.transactionType,
      amount: transaction.amount || criteria.amount,
      currency: transaction.currency || criteria.currency,
      merchantId: transaction.merchantId,
      merchantCategory: transaction.merchantCategory || criteria.merchantType,
      timestamp: transaction.timestamp || now,
      retryCount: transaction.retryCount || 0,
      
      // Enrichment data
      enrichmentData: transaction.enrichmentData || {},
      
      // Criteria
      ...criteria,
      
      // Time-based context
      currentTime: now,
      currentHour: now.getHours(),
      currentDayOfWeek: now.getDay(),
      currentDate: now.toISOString().split('T')[0]
    };
  }

  /**
   * Get value from context using dot notation
   */
  getValueFromContext(field, context) {
    try {
      return field.split('.').reduce((obj, key) => obj?.[key], context);
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Apply rule action to results
   */
  applyRuleAction(rule, ruleResults, availablePSPs) {
    const targetPSPs = rule.targetPSPs.includes('*') 
      ? availablePSPs.map(psp => psp.id)
      : rule.targetPSPs;

    switch (rule.action) {
      case 'BLOCK':
        ruleResults.blockedPSPs.push(...targetPSPs);
        break;
      case 'PREFER':
        ruleResults.preferredPSPs.push(...targetPSPs.map(psp => ({ psp, weight: rule.weight })));
        break;
      case 'AVOID':
        ruleResults.avoidedPSPs.push(...targetPSPs.map(psp => ({ psp, weight: rule.weight })));
        break;
      case 'BOOST':
        ruleResults.preferredPSPs.push(...targetPSPs.map(psp => ({ psp, weight: rule.weight * 1.5 })));
        break;
      case 'PENALIZE':
        ruleResults.avoidedPSPs.push(...targetPSPs.map(psp => ({ psp, weight: rule.weight * 1.5 })));
        break;
      case 'DISTRIBUTE':
        // This is handled by the load balancer
        break;
    }

    ruleResults.totalScore += rule.weight || 0;
  }

  /**
   * Check if time is between two time strings
   */
  isTimeBetween(timestamp, startTime, endTime) {
    try {
      const date = new Date(timestamp);
      const currentTime = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      return currentTime >= startTime && currentTime <= endTime;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if date is on specified days of week
   */
  isDayOfWeek(timestamp, daysOfWeek) {
    try {
      const date = new Date(timestamp);
      const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
      return Array.isArray(daysOfWeek) ? daysOfWeek.includes(dayOfWeek) : daysOfWeek === dayOfWeek;
    } catch (error) {
      return false;
    }
  }

  /**
   * Add new rule
   */
  async addRule(rule) {
    try {
      // Validate rule structure
      this.validateRule(rule);
      
      // Add to rules array
      this.rules.push({
        ...rule,
        id: rule.id || `rule_${Date.now()}`,
        enabled: rule.enabled !== false
      });
      
      // Clear cache
      this.ruleCache.clear();
      
      logger.info('Rule added successfully', { ruleId: rule.id });
      
    } catch (error) {
      logger.error('Error adding rule:', error);
      throw error;
    }
  }

  /**
   * Update existing rule
   */
  async updateRule(ruleId, updates) {
    try {
      const ruleIndex = this.rules.findIndex(rule => rule.id === ruleId);
      
      if (ruleIndex === -1) {
        throw new Error(`Rule not found: ${ruleId}`);
      }
      
      // Validate updates
      const updatedRule = { ...this.rules[ruleIndex], ...updates };
      this.validateRule(updatedRule);
      
      // Update rule
      this.rules[ruleIndex] = updatedRule;
      
      // Clear cache
      this.ruleCache.clear();
      
      logger.info('Rule updated successfully', { ruleId });
      
    } catch (error) {
      logger.error('Error updating rule:', error);
      throw error;
    }
  }

  /**
   * Delete rule
   */
  async deleteRule(ruleId) {
    try {
      const ruleIndex = this.rules.findIndex(rule => rule.id === ruleId);
      
      if (ruleIndex === -1) {
        throw new Error(`Rule not found: ${ruleId}`);
      }
      
      // Remove rule
      this.rules.splice(ruleIndex, 1);
      
      // Clear cache
      this.ruleCache.clear();
      
      logger.info('Rule deleted successfully', { ruleId });
      
    } catch (error) {
      logger.error('Error deleting rule:', error);
      throw error;
    }
  }

  /**
   * Validate rule structure
   */
  validateRule(rule) {
    if (!rule.id) {
      throw new Error('Rule ID is required');
    }
    
    if (!rule.name) {
      throw new Error('Rule name is required');
    }
    
    if (!rule.conditions || !Array.isArray(rule.conditions) || rule.conditions.length === 0) {
      throw new Error('Rule must have at least one condition');
    }
    
    if (!rule.action) {
      throw new Error('Rule action is required');
    }
    
    const validActions = ['BLOCK', 'PREFER', 'AVOID', 'BOOST', 'PENALIZE', 'DISTRIBUTE'];
    if (!validActions.includes(rule.action)) {
      throw new Error(`Invalid rule action: ${rule.action}`);
    }
    
    if (!rule.targetPSPs || !Array.isArray(rule.targetPSPs) || rule.targetPSPs.length === 0) {
      throw new Error('Rule must specify target PSPs');
    }
    
    // Validate conditions
    for (const condition of rule.conditions) {
      if (!condition.field || !condition.operator) {
        throw new Error('Condition must have field and operator');
      }
    }
  }

  /**
   * Get all rules
   */
  getRules() {
    return this.rules;
  }

  /**
   * Get rule by ID
   */
  getRule(ruleId) {
    return this.rules.find(rule => rule.id === ruleId);
  }

  /**
   * Get rule engine version
   */
  getVersion() {
    return this.version;
  }

  /**
   * Clear rule cache
   */
  clearCache() {
    this.ruleCache.clear();
    logger.info('Rule cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.ruleCache.size,
      maxSize: 1000 // Could be configurable
    };
  }
}

module.exports = RuleEngine;

