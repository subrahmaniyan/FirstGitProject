/**
 * ISO 8583 Message Parser
 * Handles parsing and building of ISO 8583 financial messages
 */

const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

class ISO8583Parser {
  constructor() {
    // ISO 8583 field definitions
    this.fieldDefinitions = {
      1: { name: 'Bitmap', type: 'bitmap', length: 8 },
      2: { name: 'Primary Account Number', type: 'llvar', maxLength: 19 },
      3: { name: 'Processing Code', type: 'fixed', length: 6 },
      4: { name: 'Amount Transaction', type: 'fixed', length: 12 },
      5: { name: 'Amount Settlement', type: 'fixed', length: 12 },
      6: { name: 'Amount Cardholder Billing', type: 'fixed', length: 12 },
      7: { name: 'Transmission Date Time', type: 'fixed', length: 10 },
      8: { name: 'Amount Cardholder Billing Fee', type: 'fixed', length: 8 },
      9: { name: 'Conversion Rate Settlement', type: 'fixed', length: 8 },
      10: { name: 'Conversion Rate Cardholder Billing', type: 'fixed', length: 8 },
      11: { name: 'System Trace Audit Number', type: 'fixed', length: 6 },
      12: { name: 'Time Local Transaction', type: 'fixed', length: 6 },
      13: { name: 'Date Local Transaction', type: 'fixed', length: 4 },
      14: { name: 'Date Expiration', type: 'fixed', length: 4 },
      15: { name: 'Date Settlement', type: 'fixed', length: 4 },
      16: { name: 'Date Conversion', type: 'fixed', length: 4 },
      17: { name: 'Date Capture', type: 'fixed', length: 4 },
      18: { name: 'Merchant Type', type: 'fixed', length: 4 },
      19: { name: 'Acquiring Institution Country Code', type: 'fixed', length: 3 },
      20: { name: 'PAN Extended Country Code', type: 'fixed', length: 3 },
      21: { name: 'Forwarding Institution Country Code', type: 'fixed', length: 3 },
      22: { name: 'Point of Service Entry Mode', type: 'fixed', length: 3 },
      23: { name: 'Application PAN Sequence Number', type: 'fixed', length: 3 },
      24: { name: 'Network International Identifier', type: 'fixed', length: 3 },
      25: { name: 'Point of Service Condition Code', type: 'fixed', length: 2 },
      26: { name: 'Point of Service Capture Code', type: 'fixed', length: 2 },
      27: { name: 'Authorization Identification Response Length', type: 'fixed', length: 1 },
      28: { name: 'Amount Transaction Fee', type: 'fixed', length: 9 },
      29: { name: 'Amount Settlement Fee', type: 'fixed', length: 9 },
      30: { name: 'Amount Transaction Processing Fee', type: 'fixed', length: 9 },
      31: { name: 'Amount Settlement Processing Fee', type: 'fixed', length: 9 },
      32: { name: 'Acquiring Institution Identification Code', type: 'llvar', maxLength: 11 },
      33: { name: 'Forwarding Institution Identification Code', type: 'llvar', maxLength: 11 },
      34: { name: 'Primary Account Number Extended', type: 'llvar', maxLength: 28 },
      35: { name: 'Track 2 Data', type: 'llvar', maxLength: 37 },
      36: { name: 'Track 3 Data', type: 'lllvar', maxLength: 104 },
      37: { name: 'Retrieval Reference Number', type: 'fixed', length: 12 },
      38: { name: 'Authorization Identification Response', type: 'fixed', length: 6 },
      39: { name: 'Response Code', type: 'fixed', length: 2 },
      40: { name: 'Service Restriction Code', type: 'fixed', length: 3 },
      41: { name: 'Card Acceptor Terminal Identification', type: 'fixed', length: 8 },
      42: { name: 'Card Acceptor Identification Code', type: 'fixed', length: 15 },
      43: { name: 'Card Acceptor Name/Location', type: 'fixed', length: 40 },
      44: { name: 'Additional Response Data', type: 'llvar', maxLength: 25 },
      45: { name: 'Track 1 Data', type: 'llvar', maxLength: 76 },
      46: { name: 'Additional Data ISO', type: 'lllvar', maxLength: 999 },
      47: { name: 'Additional Data National', type: 'lllvar', maxLength: 999 },
      48: { name: 'Additional Data Private', type: 'lllvar', maxLength: 999 },
      49: { name: 'Currency Code Transaction', type: 'fixed', length: 3 },
      50: { name: 'Currency Code Settlement', type: 'fixed', length: 3 },
      51: { name: 'Currency Code Cardholder Billing', type: 'fixed', length: 3 },
      52: { name: 'Personal Identification Number Data', type: 'fixed', length: 8 },
      53: { name: 'Security Related Control Information', type: 'fixed', length: 16 },
      54: { name: 'Additional Amounts', type: 'lllvar', maxLength: 120 },
      55: { name: 'Reserved ISO', type: 'lllvar', maxLength: 999 },
      56: { name: 'Reserved ISO', type: 'lllvar', maxLength: 999 },
      57: { name: 'Reserved National', type: 'lllvar', maxLength: 999 },
      58: { name: 'Reserved National', type: 'lllvar', maxLength: 999 },
      59: { name: 'Reserved National', type: 'lllvar', maxLength: 999 },
      60: { name: 'Reserved Private', type: 'lllvar', maxLength: 999 },
      61: { name: 'Reserved Private', type: 'lllvar', maxLength: 999 },
      62: { name: 'Reserved Private', type: 'lllvar', maxLength: 999 },
      63: { name: 'Reserved Private', type: 'lllvar', maxLength: 999 },
      64: { name: 'Message Authentication Code', type: 'fixed', length: 8 }
    };

    // Message Type Indicators
    this.mtiDefinitions = {
      '0100': 'Authorization Request',
      '0110': 'Authorization Response',
      '0120': 'Authorization Advice',
      '0130': 'Authorization Advice Response',
      '0200': 'Financial Transaction Request',
      '0210': 'Financial Transaction Response',
      '0220': 'Financial Transaction Advice',
      '0230': 'Financial Transaction Advice Response',
      '0400': 'Reversal Request',
      '0410': 'Reversal Response',
      '0420': 'Reversal Advice',
      '0430': 'Reversal Advice Response',
      '0800': 'Network Management Request',
      '0810': 'Network Management Response',
      '0820': 'Network Management Advice',
      '0830': 'Network Management Advice Response'
    };

    // Response codes
    this.responseCodes = {
      '00': 'Approved',
      '01': 'Refer to card issuer',
      '02': 'Refer to card issuer, special condition',
      '03': 'Invalid merchant',
      '04': 'Pick up card',
      '05': 'Do not honor',
      '06': 'Error',
      '07': 'Pick up card, special condition',
      '08': 'Honor with identification',
      '09': 'Request in progress',
      '10': 'Approved, partial',
      '11': 'Approved, VIP',
      '12': 'Invalid transaction',
      '13': 'Invalid amount',
      '14': 'Invalid card number',
      '15': 'No such issuer',
      '19': 'Re-enter transaction',
      '20': 'Invalid response',
      '21': 'No action taken',
      '22': 'Suspected malfunction',
      '25': 'Unable to locate record on file',
      '30': 'Format error',
      '41': 'Lost card, pick up',
      '43': 'Stolen card, pick up',
      '51': 'Insufficient funds',
      '54': 'Expired card',
      '55': 'Incorrect PIN',
      '57': 'Transaction not permitted to cardholder',
      '58': 'Transaction not permitted to terminal',
      '61': 'Exceeds withdrawal amount limit',
      '62': 'Restricted card',
      '63': 'Security violation',
      '65': 'Exceeds withdrawal frequency limit',
      '68': 'Response received too late',
      '75': 'Allowable number of PIN tries exceeded',
      '76': 'Invalid/nonexistent "To Account" specified',
      '77': 'Invalid/nonexistent "From Account" specified',
      '78': 'Invalid/nonexistent account specified',
      '91': 'Issuer or switch is inoperative',
      '92': 'Financial institution or intermediate network facility cannot be found',
      '93': 'Transaction cannot be completed',
      '94': 'Duplicate transmission',
      '95': 'Reconcile error',
      '96': 'System malfunction'
    };
  }

  /**
   * Check if message is ISO 8583 format
   * @param {string|Buffer} message - Message to check
   * @returns {boolean} - True if ISO 8583 format
   */
  isISO8583(message) {
    try {
      if (!message) return false;
      
      // Convert to string if buffer
      const msgStr = Buffer.isBuffer(message) ? message.toString('hex') : message;
      
      // Check minimum length (MTI + bitmap = 20 hex chars minimum)
      if (msgStr.length < 20) return false;
      
      // Check if first 4 characters are valid MTI
      const mti = msgStr.substring(0, 4);
      return this.mtiDefinitions.hasOwnProperty(mti);
      
    } catch (error) {
      return false;
    }
  }

  /**
   * Parse ISO 8583 message
   * @param {string|Buffer} message - ISO 8583 message to parse
   * @returns {Object} - Parsed message object
   */
  async parse(message) {
    try {
      logger.info('Parsing ISO 8583 message');
      
      // Convert to hex string if buffer
      const hexMessage = Buffer.isBuffer(message) ? message.toString('hex') : message;
      
      // Parse MTI
      const mti = hexMessage.substring(0, 4);
      if (!this.mtiDefinitions[mti]) {
        throw new Error(`Invalid MTI: ${mti}`);
      }
      
      // Parse primary bitmap
      const primaryBitmap = hexMessage.substring(4, 20);
      const bitmap = this.parseBitmap(primaryBitmap);
      
      let position = 20;
      const fields = {};
      
      // Check for secondary bitmap
      if (bitmap[1]) {
        const secondaryBitmap = hexMessage.substring(position, position + 16);
        const secondaryBits = this.parseBitmap(secondaryBitmap);
        // Merge secondary bitmap (fields 65-128)
        for (let i = 65; i <= 128; i++) {
          if (secondaryBits[i - 64]) {
            bitmap[i] = true;
          }
        }
        position += 16;
      }
      
      // Parse fields based on bitmap
      for (let fieldNum = 2; fieldNum <= 128; fieldNum++) {
        if (bitmap[fieldNum]) {
          const fieldDef = this.fieldDefinitions[fieldNum];
          if (fieldDef) {
            const fieldResult = this.parseField(hexMessage, position, fieldDef);
            fields[fieldNum] = {
              name: fieldDef.name,
              value: fieldResult.value,
              rawValue: fieldResult.rawValue
            };
            position = fieldResult.nextPosition;
          }
        }
      }
      
      const parsedMessage = {
        mti: mti,
        mtiDescription: this.mtiDefinitions[mti],
        bitmap: primaryBitmap,
        fields: fields,
        rawMessage: hexMessage
      };
      
      // Add semantic parsing
      this.addSemanticData(parsedMessage);
      
      logger.info('ISO 8583 message parsed successfully', { mti, fieldCount: Object.keys(fields).length });
      
      return parsedMessage;
      
    } catch (error) {
      logger.error('Error parsing ISO 8583 message:', error);
      throw new Error(`ISO 8583 parsing failed: ${error.message}`);
    }
  }

  /**
   * Build ISO 8583 message from object
   * @param {Object} messageObj - Message object to build
   * @returns {string} - ISO 8583 hex string
   */
  async build(messageObj) {
    try {
      logger.info('Building ISO 8583 message', { mti: messageObj.mti });
      
      let message = messageObj.mti;
      
      // Determine which fields are present
      const presentFields = Object.keys(messageObj.fields).map(f => parseInt(f)).sort((a, b) => a - b);
      
      // Build bitmap
      const bitmap = this.buildBitmap(presentFields);
      message += bitmap;
      
      // Build fields in order
      for (const fieldNum of presentFields) {
        if (fieldNum === 1) continue; // Skip bitmap field
        
        const fieldData = messageObj.fields[fieldNum];
        const fieldDef = this.fieldDefinitions[fieldNum];
        
        if (fieldDef) {
          const fieldHex = this.buildField(fieldData.value, fieldDef);
          message += fieldHex;
        }
      }
      
      logger.info('ISO 8583 message built successfully', { 
        mti: messageObj.mti, 
        length: message.length,
        fieldCount: presentFields.length 
      });
      
      return message;
      
    } catch (error) {
      logger.error('Error building ISO 8583 message:', error);
      throw new Error(`ISO 8583 building failed: ${error.message}`);
    }
  }

  /**
   * Parse bitmap to determine present fields
   * @param {string} bitmapHex - Bitmap in hex format
   * @returns {Object} - Object with field numbers as keys
   */
  parseBitmap(bitmapHex) {
    const bitmap = {};
    const bitmapBuffer = Buffer.from(bitmapHex, 'hex');
    
    for (let byteIndex = 0; byteIndex < bitmapBuffer.length; byteIndex++) {
      const byte = bitmapBuffer[byteIndex];
      for (let bitIndex = 0; bitIndex < 8; bitIndex++) {
        const fieldNum = (byteIndex * 8) + bitIndex + 1;
        const bitValue = (byte >> (7 - bitIndex)) & 1;
        if (bitValue === 1) {
          bitmap[fieldNum] = true;
        }
      }
    }
    
    return bitmap;
  }

  /**
   * Build bitmap from field numbers
   * @param {number[]} fieldNumbers - Array of field numbers
   * @returns {string} - Bitmap in hex format
   */
  buildBitmap(fieldNumbers) {
    const maxField = Math.max(...fieldNumbers);
    const bitmapSize = maxField > 64 ? 16 : 8; // Secondary bitmap if fields > 64
    const bitmap = Buffer.alloc(bitmapSize);
    
    // Set secondary bitmap indicator if needed
    if (maxField > 64) {
      fieldNumbers.unshift(1); // Add secondary bitmap indicator
    }
    
    for (const fieldNum of fieldNumbers) {
      if (fieldNum === 1 && maxField <= 64) continue; // Skip if no secondary bitmap
      
      const byteIndex = Math.floor((fieldNum - 1) / 8);
      const bitIndex = (fieldNum - 1) % 8;
      
      if (byteIndex < bitmap.length) {
        bitmap[byteIndex] |= (1 << (7 - bitIndex));
      }
    }
    
    return bitmap.toString('hex').toUpperCase();
  }

  /**
   * Parse individual field based on its definition
   * @param {string} message - Full message hex string
   * @param {number} position - Current position in message
   * @param {Object} fieldDef - Field definition
   * @returns {Object} - Parsed field data
   */
  parseField(message, position, fieldDef) {
    let value, rawValue, nextPosition;
    
    switch (fieldDef.type) {
      case 'fixed':
        const length = fieldDef.length * 2; // Convert to hex length
        rawValue = message.substring(position, position + length);
        value = this.hexToAscii(rawValue);
        nextPosition = position + length;
        break;
        
      case 'llvar':
        const llLength = parseInt(message.substring(position, position + 2), 16) * 2;
        rawValue = message.substring(position + 2, position + 2 + llLength);
        value = this.hexToAscii(rawValue);
        nextPosition = position + 2 + llLength;
        break;
        
      case 'lllvar':
        const lllLength = parseInt(message.substring(position, position + 4), 16) * 2;
        rawValue = message.substring(position + 4, position + 4 + lllLength);
        value = this.hexToAscii(rawValue);
        nextPosition = position + 4 + lllLength;
        break;
        
      case 'bitmap':
        rawValue = message.substring(position, position + 16);
        value = rawValue;
        nextPosition = position + 16;
        break;
        
      default:
        throw new Error(`Unknown field type: ${fieldDef.type}`);
    }
    
    return { value, rawValue, nextPosition };
  }

  /**
   * Build individual field
   * @param {string} value - Field value
   * @param {Object} fieldDef - Field definition
   * @returns {string} - Field in hex format
   */
  buildField(value, fieldDef) {
    const asciiHex = this.asciiToHex(value);
    
    switch (fieldDef.type) {
      case 'fixed':
        return asciiHex.padEnd(fieldDef.length * 2, '0');
        
      case 'llvar':
        const llLen = (asciiHex.length / 2).toString(16).padStart(2, '0');
        return llLen + asciiHex;
        
      case 'lllvar':
        const lllLen = (asciiHex.length / 2).toString(16).padStart(4, '0');
        return lllLen + asciiHex;
        
      default:
        return asciiHex;
    }
  }

  /**
   * Add semantic data to parsed message
   * @param {Object} parsedMessage - Parsed message object
   */
  addSemanticData(parsedMessage) {
    // Add response code description
    if (parsedMessage.fields[39]) {
      const responseCode = parsedMessage.fields[39].value;
      parsedMessage.responseCodeDescription = this.responseCodes[responseCode] || 'Unknown';
    }
    
    // Add transaction type
    if (parsedMessage.fields[3]) {
      const processingCode = parsedMessage.fields[3].value;
      parsedMessage.transactionType = this.getTransactionType(processingCode);
    }
    
    // Add amount in readable format
    if (parsedMessage.fields[4]) {
      const amount = parsedMessage.fields[4].value;
      parsedMessage.formattedAmount = this.formatAmount(amount);
    }
    
    // Add card information (masked)
    if (parsedMessage.fields[2]) {
      const pan = parsedMessage.fields[2].value;
      parsedMessage.maskedPAN = this.maskPAN(pan);
    }
  }

  /**
   * Get transaction type from processing code
   * @param {string} processingCode - Processing code
   * @returns {string} - Transaction type
   */
  getTransactionType(processingCode) {
    const txnType = processingCode.substring(0, 2);
    const typeMap = {
      '00': 'Purchase',
      '01': 'Cash Advance',
      '09': 'Purchase with Cashback',
      '20': 'Refund',
      '21': 'Deposit',
      '30': 'Balance Inquiry',
      '31': 'Available Balance Inquiry',
      '40': 'Transfer'
    };
    return typeMap[txnType] || 'Unknown';
  }

  /**
   * Format amount for display
   * @param {string} amount - Amount string
   * @returns {string} - Formatted amount
   */
  formatAmount(amount) {
    const numAmount = parseInt(amount) / 100;
    return numAmount.toFixed(2);
  }

  /**
   * Mask PAN for security
   * @param {string} pan - Primary Account Number
   * @returns {string} - Masked PAN
   */
  maskPAN(pan) {
    if (pan.length < 8) return pan;
    return pan.substring(0, 6) + '*'.repeat(pan.length - 10) + pan.substring(pan.length - 4);
  }

  /**
   * Convert hex to ASCII
   * @param {string} hex - Hex string
   * @returns {string} - ASCII string
   */
  hexToAscii(hex) {
    return Buffer.from(hex, 'hex').toString('ascii');
  }

  /**
   * Convert ASCII to hex
   * @param {string} ascii - ASCII string
   * @returns {string} - Hex string
   */
  asciiToHex(ascii) {
    return Buffer.from(ascii, 'ascii').toString('hex').toUpperCase();
  }

  /**
   * Validate ISO 8583 message
   * @param {Object} parsedMessage - Parsed message object
   * @returns {Object} - Validation result
   */
  validate(parsedMessage) {
    const errors = [];
    const warnings = [];
    
    // Check required fields based on MTI
    const requiredFields = this.getRequiredFields(parsedMessage.mti);
    for (const fieldNum of requiredFields) {
      if (!parsedMessage.fields[fieldNum]) {
        errors.push(`Required field ${fieldNum} (${this.fieldDefinitions[fieldNum]?.name}) is missing`);
      }
    }
    
    // Validate field formats
    for (const [fieldNum, fieldData] of Object.entries(parsedMessage.fields)) {
      const fieldDef = this.fieldDefinitions[parseInt(fieldNum)];
      if (fieldDef) {
        const validation = this.validateField(fieldData.value, fieldDef);
        if (!validation.valid) {
          errors.push(`Field ${fieldNum}: ${validation.error}`);
        }
        if (validation.warning) {
          warnings.push(`Field ${fieldNum}: ${validation.warning}`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get required fields for MTI
   * @param {string} mti - Message Type Indicator
   * @returns {number[]} - Array of required field numbers
   */
  getRequiredFields(mti) {
    const requiredFieldsMap = {
      '0100': [2, 3, 4, 7, 11, 18, 22, 25, 41, 42, 49], // Authorization Request
      '0110': [3, 4, 7, 11, 12, 13, 37, 39, 41, 42], // Authorization Response
      '0200': [2, 3, 4, 7, 11, 18, 22, 25, 41, 42, 49], // Financial Request
      '0210': [3, 4, 7, 11, 12, 13, 37, 39, 41, 42] // Financial Response
    };
    
    return requiredFieldsMap[mti] || [];
  }

  /**
   * Validate individual field
   * @param {string} value - Field value
   * @param {Object} fieldDef - Field definition
   * @returns {Object} - Validation result
   */
  validateField(value, fieldDef) {
    const result = { valid: true };
    
    // Check length constraints
    if (fieldDef.type === 'fixed' && value.length !== fieldDef.length) {
      result.valid = false;
      result.error = `Expected length ${fieldDef.length}, got ${value.length}`;
    }
    
    if ((fieldDef.type === 'llvar' || fieldDef.type === 'lllvar') && 
        value.length > fieldDef.maxLength) {
      result.valid = false;
      result.error = `Exceeds maximum length ${fieldDef.maxLength}`;
    }
    
    // Field-specific validations
    if (fieldDef.name === 'Primary Account Number' && !/^\d+$/.test(value)) {
      result.valid = false;
      result.error = 'PAN must contain only digits';
    }
    
    if (fieldDef.name === 'Amount Transaction' && !/^\d{12}$/.test(value)) {
      result.valid = false;
      result.error = 'Amount must be 12 digits';
    }
    
    return result;
  }
}

module.exports = ISO8583Parser;

