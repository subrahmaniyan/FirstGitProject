/**
 * Transaction State Machine
 * Manages valid state transitions for payment transactions
 */

class StateMachine {
  constructor() {
    // Define valid state transitions
    this.transitions = {
      'INITIATED': ['VALIDATED', 'FAILED', 'CANCELLED'],
      'VALIDATED': ['PROCESSING', 'FAILED', 'CANCELLED'],
      'PROCESSING': ['ROUTING', 'FAILED', 'CANCELLED'],
      'ROUTING': ['PSP_SENT', 'FAILED', 'CANCELLED'],
      'PSP_SENT': ['PSP_RESPONSE', 'TIMEOUT', 'FAILED', 'CANCELLED'],
      'PSP_RESPONSE': ['COMPLETED', 'DECLINED', 'FAILED'],
      'COMPLETED': ['REFUNDED', 'PARTIALLY_REFUNDED'],
      'DECLINED': [], // Terminal state
      'FAILED': ['INITIATED'], // Can retry
      'CANCELLED': [], // Terminal state
      'TIMEOUT': ['INITIATED', 'FAILED'], // Can retry or fail
      'REFUNDED': [], // Terminal state
      'PARTIALLY_REFUNDED': ['REFUNDED'] // Can be fully refunded
    };

    // Define terminal states (no further transitions allowed)
    this.terminalStates = [
      'DECLINED',
      'CANCELLED',
      'REFUNDED'
    ];

    // Define retry-able states
    this.retryableStates = [
      'FAILED',
      'TIMEOUT'
    ];

    // Define processing states (transaction in progress)
    this.processingStates = [
      'INITIATED',
      'VALIDATED',
      'PROCESSING',
      'ROUTING',
      'PSP_SENT',
      'PSP_RESPONSE'
    ];

    // Define success states
    this.successStates = [
      'COMPLETED'
    ];

    // Define failure states
    this.failureStates = [
      'DECLINED',
      'FAILED',
      'TIMEOUT',
      'CANCELLED'
    ];
  }

  /**
   * Check if a state transition is valid
   * @param {string} fromState - Current state
   * @param {string} toState - Target state
   * @returns {boolean} - True if transition is valid
   */
  canTransition(fromState, toState) {
    if (!fromState || !toState) {
      return false;
    }

    const allowedTransitions = this.transitions[fromState];
    return allowedTransitions && allowedTransitions.includes(toState);
  }

  /**
   * Get all possible next states from current state
   * @param {string} currentState - Current state
   * @returns {string[]} - Array of possible next states
   */
  getNextStates(currentState) {
    return this.transitions[currentState] || [];
  }

  /**
   * Check if state is terminal (no further transitions)
   * @param {string} state - State to check
   * @returns {boolean} - True if terminal state
   */
  isTerminalState(state) {
    return this.terminalStates.includes(state);
  }

  /**
   * Check if state allows retry
   * @param {string} state - State to check
   * @returns {boolean} - True if retry is allowed
   */
  isRetryableState(state) {
    return this.retryableStates.includes(state);
  }

  /**
   * Check if transaction is in processing
   * @param {string} state - State to check
   * @returns {boolean} - True if in processing
   */
  isProcessingState(state) {
    return this.processingStates.includes(state);
  }

  /**
   * Check if transaction is successful
   * @param {string} state - State to check
   * @returns {boolean} - True if successful
   */
  isSuccessState(state) {
    return this.successStates.includes(state);
  }

  /**
   * Check if transaction failed
   * @param {string} state - State to check
   * @returns {boolean} - True if failed
   */
  isFailureState(state) {
    return this.failureStates.includes(state);
  }

  /**
   * Get state category
   * @param {string} state - State to categorize
   * @returns {string} - State category
   */
  getStateCategory(state) {
    if (this.isSuccessState(state)) return 'SUCCESS';
    if (this.isFailureState(state)) return 'FAILURE';
    if (this.isProcessingState(state)) return 'PROCESSING';
    if (this.isTerminalState(state)) return 'TERMINAL';
    return 'UNKNOWN';
  }

  /**
   * Validate state transition with context
   * @param {string} fromState - Current state
   * @param {string} toState - Target state
   * @param {Object} context - Additional context for validation
   * @returns {Object} - Validation result with success flag and message
   */
  validateTransition(fromState, toState, context = {}) {
    const result = {
      success: false,
      message: '',
      warnings: []
    };

    // Check basic transition validity
    if (!this.canTransition(fromState, toState)) {
      result.message = `Invalid transition from ${fromState} to ${toState}`;
      return result;
    }

    // Additional context-based validations
    if (toState === 'REFUNDED' && context.refundAmount > context.originalAmount) {
      result.message = 'Refund amount cannot exceed original transaction amount';
      return result;
    }

    if (toState === 'COMPLETED' && !context.pspApproval) {
      result.message = 'Cannot complete transaction without PSP approval';
      return result;
    }

    if (toState === 'DECLINED' && !context.declineReason) {
      result.warnings.push('Decline reason not provided');
    }

    if (this.isRetryableState(fromState) && toState === 'INITIATED') {
      if (context.retryCount >= context.maxRetries) {
        result.message = 'Maximum retry attempts exceeded';
        return result;
      }
      result.warnings.push(`Retry attempt ${context.retryCount + 1} of ${context.maxRetries}`);
    }

    result.success = true;
    result.message = `Valid transition from ${fromState} to ${toState}`;
    return result;
  }

  /**
   * Get state transition path
   * @param {string} fromState - Starting state
   * @param {string} toState - Target state
   * @returns {string[]|null} - Array of states in transition path, or null if no path exists
   */
  getTransitionPath(fromState, toState) {
    if (fromState === toState) {
      return [fromState];
    }

    const visited = new Set();
    const queue = [[fromState]];

    while (queue.length > 0) {
      const path = queue.shift();
      const currentState = path[path.length - 1];

      if (visited.has(currentState)) {
        continue;
      }

      visited.add(currentState);

      const nextStates = this.getNextStates(currentState);
      
      for (const nextState of nextStates) {
        const newPath = [...path, nextState];
        
        if (nextState === toState) {
          return newPath;
        }
        
        if (!visited.has(nextState)) {
          queue.push(newPath);
        }
      }
    }

    return null; // No path found
  }

  /**
   * Get state machine statistics
   * @returns {Object} - Statistics about the state machine
   */
  getStatistics() {
    const allStates = Object.keys(this.transitions);
    
    return {
      totalStates: allStates.length,
      terminalStates: this.terminalStates.length,
      retryableStates: this.retryableStates.length,
      processingStates: this.processingStates.length,
      successStates: this.successStates.length,
      failureStates: this.failureStates.length,
      totalTransitions: Object.values(this.transitions).reduce((sum, transitions) => sum + transitions.length, 0),
      stateDistribution: {
        terminal: this.terminalStates,
        retryable: this.retryableStates,
        processing: this.processingStates,
        success: this.successStates,
        failure: this.failureStates
      }
    };
  }

  /**
   * Export state machine configuration
   * @returns {Object} - Complete state machine configuration
   */
  exportConfiguration() {
    return {
      transitions: this.transitions,
      terminalStates: this.terminalStates,
      retryableStates: this.retryableStates,
      processingStates: this.processingStates,
      successStates: this.successStates,
      failureStates: this.failureStates
    };
  }

  /**
   * Import state machine configuration
   * @param {Object} config - State machine configuration
   */
  importConfiguration(config) {
    if (config.transitions) this.transitions = config.transitions;
    if (config.terminalStates) this.terminalStates = config.terminalStates;
    if (config.retryableStates) this.retryableStates = config.retryableStates;
    if (config.processingStates) this.processingStates = config.processingStates;
    if (config.successStates) this.successStates = config.successStates;
    if (config.failureStates) this.failureStates = config.failureStates;
  }
}

module.exports = StateMachine;

