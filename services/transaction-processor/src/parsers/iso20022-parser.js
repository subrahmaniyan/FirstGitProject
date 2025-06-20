/**
 * ISO 20022 Message Parser
 * Handles parsing and building of ISO 20022 XML financial messages
 */

const xml2js = require('xml2js');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

class ISO20022Parser {
  constructor() {
    // XML parser configuration
    this.xmlParser = new xml2js.Parser({
      explicitArray: false,
      ignoreAttrs: false,
      mergeAttrs: true,
      normalize: true,
      normalizeTags: true,
      trim: true
    });

    this.xmlBuilder = new xml2js.Builder({
      rootName: 'Document',
      xmldec: { version: '1.0', encoding: 'UTF-8' },
      renderOpts: { pretty: true, indent: '  ' }
    });

    // ISO 20022 message types
    this.messageTypes = {
      // Payment Initiation
      'pain.001.001.03': 'CustomerCreditTransferInitiationV03',
      'pain.001.001.09': 'CustomerCreditTransferInitiationV09',
      'pain.008.001.02': 'CustomerDirectDebitInitiationV02',
      'pain.008.001.08': 'CustomerDirectDebitInitiationV08',
      
      // Payment Status
      'pain.002.001.03': 'PaymentStatusReportV03',
      'pain.002.001.10': 'PaymentStatusReportV10',
      
      // Account Management
      'acmt.001.001.05': 'AccountOpeningInstructionV05',
      'acmt.002.001.05': 'AccountDetailsConfirmationV05',
      
      // Cash Management
      'camt.052.001.02': 'BankToCustomerAccountReportV02',
      'camt.053.001.02': 'BankToCustomerStatementV02',
      'camt.054.001.02': 'BankToCustomerDebitCreditNotificationV02',
      
      // Securities
      'sese.023.001.01': 'SecuritiesSettlementTransactionInstructionV01',
      'sese.025.001.01': 'SecuritiesSettlementTransactionConfirmationV01',
      
      // Trade Services
      'tsmt.018.001.03': 'BankToCustomerStatementV03',
      'tsmt.019.001.03': 'CustomerToBank StatementV03'
    };

    // Common namespaces
    this.namespaces = {
      'pain': 'urn:iso:std:iso:20022:tech:xsd:pain',
      'camt': 'urn:iso:std:iso:20022:tech:xsd:camt',
      'pacs': 'urn:iso:std:iso:20022:tech:xsd:pacs',
      'acmt': 'urn:iso:std:iso:20022:tech:xsd:acmt',
      'sese': 'urn:iso:std:iso:20022:tech:xsd:sese',
      'tsmt': 'urn:iso:std:iso:20022:tech:xsd:tsmt'
    };

    // Status codes
    this.statusCodes = {
      'ACCC': 'AcceptedCustomerProfile',
      'ACCP': 'AcceptedCustomerProfile',
      'ACSC': 'AcceptedSettlementCompleted',
      'ACSP': 'AcceptedSettlementInProcess',
      'ACTC': 'AcceptedTechnicalValidation',
      'ACWC': 'AcceptedWithChange',
      'ACWP': 'AcceptedWithoutPosting',
      'RCVD': 'Received',
      'PDNG': 'Pending',
      'RJCT': 'Rejected',
      'CANC': 'Cancelled'
    };

    // Reason codes
    this.reasonCodes = {
      'AC01': 'IncorrectAccountNumber',
      'AC04': 'ClosedAccountNumber',
      'AC06': 'BlockedAccount',
      'AG01': 'TransactionForbidden',
      'AG02': 'InvalidBankOperationCode',
      'AM01': 'ZeroAmount',
      'AM02': 'NotAllowedAmount',
      'AM03': 'NotAllowedCurrency',
      'AM04': 'InsufficientFunds',
      'AM05': 'Duplication',
      'AM06': 'TooLowAmount',
      'AM07': 'BlockedAmount',
      'BE01': 'InconsistentWithEndCustomer',
      'BE04': 'MissingCreditorAddress',
      'BE05': 'UnrecognisedInitiatingParty',
      'CH03': 'RequestedExecutionDateOrRequestedCollectionDateTooFarInFuture',
      'CH07': 'RequestedExecutionDateOrRequestedCollectionDateTooFarInPast',
      'CH09': 'InvalidCountryCode',
      'CH11': 'InvalidDebtorAccountType',
      'CH12': 'InvalidCreditorAccountType',
      'CH16': 'InvalidDebtorIdentification',
      'CH17': 'InvalidCreditorIdentification',
      'DT01': 'InvalidDate',
      'FF01': 'InvalidFileFormat',
      'FF05': 'InvalidLocalInstrumentCode',
      'MD01': 'NoMandate',
      'MD02': 'MissingMandatoryInformationInMandate',
      'MD06': 'RefundRequestByEndCustomer',
      'MD07': 'EndCustomerDeceased',
      'MS02': 'NotSpecifiedReasonCustomerGenerated',
      'MS03': 'NotSpecifiedReasonAgentGenerated',
      'RC01': 'BankIdentifierIncorrect',
      'RR01': 'MissingDebtorAccountOrIdentification',
      'RR02': 'MissingDebtorNameOrAddress',
      'RR03': 'MissingCreditorNameOrAddress',
      'RR04': 'RegulatoryReason',
      'SL01': 'SpecificServiceOfferedByDebtorAgent'
    };
  }

  /**
   * Check if message is ISO 20022 format
   * @param {string} message - Message to check
   * @returns {boolean} - True if ISO 20022 format
   */
  isISO20022(message) {
    try {
      if (!message || typeof message !== 'string') return false;
      
      // Check for XML structure
      if (!message.trim().startsWith('<?xml') && !message.trim().startsWith('<Document')) {
        return false;
      }
      
      // Check for ISO 20022 namespace or message type
      const hasNamespace = Object.values(this.namespaces).some(ns => message.includes(ns));
      const hasMessageType = Object.keys(this.messageTypes).some(mt => message.includes(mt));
      
      return hasNamespace || hasMessageType || message.includes('Document');
      
    } catch (error) {
      return false;
    }
  }

  /**
   * Parse ISO 20022 XML message
   * @param {string} xmlMessage - ISO 20022 XML message
   * @returns {Object} - Parsed message object
   */
  async parse(xmlMessage) {
    try {
      logger.info('Parsing ISO 20022 message');
      
      // Parse XML
      const parsedXml = await this.xmlParser.parseStringPromise(xmlMessage);
      
      // Extract document root
      const document = parsedXml.Document || parsedXml;
      
      // Identify message type
      const messageType = this.identifyMessageType(document);
      
      // Parse based on message type
      let parsedMessage;
      switch (messageType.category) {
        case 'pain':
          parsedMessage = await this.parsePainMessage(document, messageType);
          break;
        case 'camt':
          parsedMessage = await this.parseCamtMessage(document, messageType);
          break;
        case 'pacs':
          parsedMessage = await this.parsePacsMessage(document, messageType);
          break;
        default:
          parsedMessage = await this.parseGenericMessage(document, messageType);
      }
      
      // Add metadata
      parsedMessage.messageType = messageType;
      parsedMessage.rawMessage = xmlMessage;
      parsedMessage.parsedAt = new Date().toISOString();
      
      logger.info('ISO 20022 message parsed successfully', { 
        messageType: messageType.type,
        category: messageType.category 
      });
      
      return parsedMessage;
      
    } catch (error) {
      logger.error('Error parsing ISO 20022 message:', error);
      throw new Error(`ISO 20022 parsing failed: ${error.message}`);
    }
  }

  /**
   * Build ISO 20022 XML message from object
   * @param {Object} messageObj - Message object to build
   * @returns {string} - ISO 20022 XML string
   */
  async build(messageObj) {
    try {
      logger.info('Building ISO 20022 message', { messageType: messageObj.messageType?.type });
      
      let documentStructure;
      
      // Build based on message type
      switch (messageObj.messageType?.category) {
        case 'pain':
          documentStructure = this.buildPainMessage(messageObj);
          break;
        case 'camt':
          documentStructure = this.buildCamtMessage(messageObj);
          break;
        case 'pacs':
          documentStructure = this.buildPacsMessage(messageObj);
          break;
        default:
          documentStructure = this.buildGenericMessage(messageObj);
      }
      
      // Add namespace
      if (messageObj.messageType?.category) {
        const namespace = this.namespaces[messageObj.messageType.category];
        if (namespace) {
          documentStructure.$ = { xmlns: namespace };
        }
      }
      
      // Build XML
      const xmlMessage = this.xmlBuilder.buildObject({ Document: documentStructure });
      
      logger.info('ISO 20022 message built successfully', { 
        messageType: messageObj.messageType?.type,
        length: xmlMessage.length 
      });
      
      return xmlMessage;
      
    } catch (error) {
      logger.error('Error building ISO 20022 message:', error);
      throw new Error(`ISO 20022 building failed: ${error.message}`);
    }
  }

  /**
   * Identify message type from parsed XML
   * @param {Object} document - Parsed XML document
   * @returns {Object} - Message type information
   */
  identifyMessageType(document) {
    // Try to find message type from root elements
    const rootKeys = Object.keys(document);
    
    for (const key of rootKeys) {
      // Check if key matches known message types
      for (const [typeCode, typeName] of Object.entries(this.messageTypes)) {
        if (key.toLowerCase().includes(typeCode.replace(/\./g, '')) || 
            key.includes(typeName)) {
          return {
            type: typeCode,
            name: typeName,
            category: typeCode.split('.')[0],
            rootElement: key
          };
        }
      }
    }
    
    // Try to identify by namespace or structure
    const firstKey = rootKeys[0];
    if (firstKey) {
      const category = firstKey.substring(0, 4).toLowerCase();
      if (this.namespaces[category]) {
        return {
          type: 'unknown',
          name: 'Unknown Message Type',
          category: category,
          rootElement: firstKey
        };
      }
    }
    
    return {
      type: 'generic',
      name: 'Generic ISO 20022 Message',
      category: 'generic',
      rootElement: rootKeys[0] || 'Document'
    };
  }

  /**
   * Parse PAIN (Payment Initiation) messages
   * @param {Object} document - Parsed XML document
   * @param {Object} messageType - Message type information
   * @returns {Object} - Parsed PAIN message
   */
  async parsePainMessage(document, messageType) {
    const rootElement = document[messageType.rootElement];
    
    const painMessage = {
      messageIdentification: this.extractValue(rootElement, 'GrpHdr.MsgId'),
      creationDateTime: this.extractValue(rootElement, 'GrpHdr.CreDtTm'),
      numberOfTransactions: this.extractValue(rootElement, 'GrpHdr.NbOfTxs'),
      controlSum: this.extractValue(rootElement, 'GrpHdr.CtrlSum'),
      initiatingParty: this.extractPartyInfo(rootElement, 'GrpHdr.InitgPty'),
      paymentInformation: []
    };
    
    // Extract payment information
    const pmtInf = this.extractArray(rootElement, 'PmtInf');
    for (const payment of pmtInf) {
      const paymentInfo = {
        paymentInformationId: this.extractValue(payment, 'PmtInfId'),
        paymentMethod: this.extractValue(payment, 'PmtMtd'),
        requestedExecutionDate: this.extractValue(payment, 'ReqdExctnDt'),
        debtor: this.extractPartyInfo(payment, 'Dbtr'),
        debtorAccount: this.extractAccountInfo(payment, 'DbtrAcct'),
        debtorAgent: this.extractAgentInfo(payment, 'DbtrAgt'),
        creditTransferTransactionInformation: []
      };
      
      // Extract credit transfer transactions
      const cdtTrfTxInf = this.extractArray(payment, 'CdtTrfTxInf');
      for (const transaction of cdtTrfTxInf) {
        const txInfo = {
          paymentId: this.extractValue(transaction, 'PmtId'),
          amount: this.extractAmountInfo(transaction, 'Amt'),
          creditor: this.extractPartyInfo(transaction, 'Cdtr'),
          creditorAccount: this.extractAccountInfo(transaction, 'CdtrAcct'),
          creditorAgent: this.extractAgentInfo(transaction, 'CdtrAgt'),
          remittanceInformation: this.extractValue(transaction, 'RmtInf.Ustrd')
        };
        paymentInfo.creditTransferTransactionInformation.push(txInfo);
      }
      
      painMessage.paymentInformation.push(paymentInfo);
    }
    
    return painMessage;
  }

  /**
   * Parse CAMT (Cash Management) messages
   * @param {Object} document - Parsed XML document
   * @param {Object} messageType - Message type information
   * @returns {Object} - Parsed CAMT message
   */
  async parseCamtMessage(document, messageType) {
    const rootElement = document[messageType.rootElement];
    
    const camtMessage = {
      messageIdentification: this.extractValue(rootElement, 'GrpHdr.MsgId'),
      creationDateTime: this.extractValue(rootElement, 'GrpHdr.CreDtTm'),
      messageRecipient: this.extractPartyInfo(rootElement, 'GrpHdr.MsgRcpt'),
      reports: []
    };
    
    // Extract reports/statements
    const rpts = this.extractArray(rootElement, 'Rpt') || this.extractArray(rootElement, 'Stmt');
    for (const report of rpts) {
      const reportInfo = {
        identification: this.extractValue(report, 'Id'),
        account: this.extractAccountInfo(report, 'Acct'),
        balance: this.extractBalanceInfo(report, 'Bal'),
        entries: []
      };
      
      // Extract entries
      const ntries = this.extractArray(report, 'Ntry');
      for (const entry of ntries) {
        const entryInfo = {
          amount: this.extractAmountInfo(entry, 'Amt'),
          creditDebitIndicator: this.extractValue(entry, 'CdtDbtInd'),
          status: this.extractValue(entry, 'Sts'),
          bookingDate: this.extractValue(entry, 'BookgDt'),
          valueDate: this.extractValue(entry, 'ValDt'),
          accountServicerReference: this.extractValue(entry, 'AcctSvcrRef'),
          bankTransactionCode: this.extractValue(entry, 'BkTxCd.Domn.Cd'),
          relatedParties: this.extractRelatedParties(entry),
          remittanceInformation: this.extractValue(entry, 'RmtInf.Ustrd')
        };
        reportInfo.entries.push(entryInfo);
      }
      
      camtMessage.reports.push(reportInfo);
    }
    
    return camtMessage;
  }

  /**
   * Parse PACS (Payment Clearing and Settlement) messages
   * @param {Object} document - Parsed XML document
   * @param {Object} messageType - Message type information
   * @returns {Object} - Parsed PACS message
   */
  async parsePacsMessage(document, messageType) {
    const rootElement = document[messageType.rootElement];
    
    return {
      messageIdentification: this.extractValue(rootElement, 'GrpHdr.MsgId'),
      creationDateTime: this.extractValue(rootElement, 'GrpHdr.CreDtTm'),
      numberOfTransactions: this.extractValue(rootElement, 'GrpHdr.NbOfTxs'),
      settlementInformation: this.extractSettlementInfo(rootElement, 'SttlmInf'),
      instructingAgent: this.extractAgentInfo(rootElement, 'InstgAgt'),
      instructedAgent: this.extractAgentInfo(rootElement, 'InstdAgt'),
      transactions: this.extractTransactionInfo(rootElement)
    };
  }

  /**
   * Parse generic ISO 20022 message
   * @param {Object} document - Parsed XML document
   * @param {Object} messageType - Message type information
   * @returns {Object} - Parsed generic message
   */
  async parseGenericMessage(document, messageType) {
    return {
      messageType: messageType,
      content: document,
      extractedFields: this.extractCommonFields(document)
    };
  }

  /**
   * Build PAIN message structure
   * @param {Object} messageObj - Message object
   * @returns {Object} - PAIN message structure
   */
  buildPainMessage(messageObj) {
    // Implementation for building PAIN messages
    return {
      CstmrCdtTrfInitn: {
        GrpHdr: {
          MsgId: messageObj.messageIdentification,
          CreDtTm: messageObj.creationDateTime || new Date().toISOString(),
          NbOfTxs: messageObj.numberOfTransactions,
          CtrlSum: messageObj.controlSum,
          InitgPty: this.buildPartyInfo(messageObj.initiatingParty)
        },
        PmtInf: messageObj.paymentInformation?.map(pi => ({
          PmtInfId: pi.paymentInformationId,
          PmtMtd: pi.paymentMethod || 'TRF',
          ReqdExctnDt: pi.requestedExecutionDate,
          Dbtr: this.buildPartyInfo(pi.debtor),
          DbtrAcct: this.buildAccountInfo(pi.debtorAccount),
          DbtrAgt: this.buildAgentInfo(pi.debtorAgent),
          CdtTrfTxInf: pi.creditTransferTransactionInformation?.map(tx => ({
            PmtId: tx.paymentId,
            Amt: this.buildAmountInfo(tx.amount),
            Cdtr: this.buildPartyInfo(tx.creditor),
            CdtrAcct: this.buildAccountInfo(tx.creditorAccount),
            CdtrAgt: this.buildAgentInfo(tx.creditorAgent),
            RmtInf: { Ustrd: tx.remittanceInformation }
          }))
        }))
      }
    };
  }

  /**
   * Build CAMT message structure
   * @param {Object} messageObj - Message object
   * @returns {Object} - CAMT message structure
   */
  buildCamtMessage(messageObj) {
    // Implementation for building CAMT messages
    return {
      BkToCstmrStmt: {
        GrpHdr: {
          MsgId: messageObj.messageIdentification,
          CreDtTm: messageObj.creationDateTime || new Date().toISOString(),
          MsgRcpt: this.buildPartyInfo(messageObj.messageRecipient)
        },
        Stmt: messageObj.reports?.map(report => ({
          Id: report.identification,
          Acct: this.buildAccountInfo(report.account),
          Bal: this.buildBalanceInfo(report.balance),
          Ntry: report.entries?.map(entry => ({
            Amt: this.buildAmountInfo(entry.amount),
            CdtDbtInd: entry.creditDebitIndicator,
            Sts: entry.status,
            BookgDt: entry.bookingDate,
            ValDt: entry.valueDate,
            AcctSvcrRef: entry.accountServicerReference,
            RmtInf: { Ustrd: entry.remittanceInformation }
          }))
        }))
      }
    };
  }

  /**
   * Build PACS message structure
   * @param {Object} messageObj - Message object
   * @returns {Object} - PACS message structure
   */
  buildPacsMessage(messageObj) {
    // Implementation for building PACS messages
    return {
      FIToFICstmrCdtTrf: {
        GrpHdr: {
          MsgId: messageObj.messageIdentification,
          CreDtTm: messageObj.creationDateTime || new Date().toISOString(),
          NbOfTxs: messageObj.numberOfTransactions,
          SttlmInf: this.buildSettlementInfo(messageObj.settlementInformation),
          InstgAgt: this.buildAgentInfo(messageObj.instructingAgent),
          InstdAgt: this.buildAgentInfo(messageObj.instructedAgent)
        },
        CdtTrfTxInf: messageObj.transactions?.map(tx => this.buildTransactionInfo(tx))
      }
    };
  }

  /**
   * Build generic message structure
   * @param {Object} messageObj - Message object
   * @returns {Object} - Generic message structure
   */
  buildGenericMessage(messageObj) {
    return messageObj.content || messageObj;
  }

  // Utility methods for extracting data
  extractValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  extractArray(obj, path) {
    const value = this.extractValue(obj, path);
    return Array.isArray(value) ? value : (value ? [value] : []);
  }

  extractPartyInfo(obj, path) {
    const party = this.extractValue(obj, path);
    if (!party) return null;
    
    return {
      name: party.Nm,
      identification: party.Id,
      address: party.PstlAdr
    };
  }

  extractAccountInfo(obj, path) {
    const account = this.extractValue(obj, path);
    if (!account) return null;
    
    return {
      identification: account.Id?.IBAN || account.Id?.Othr?.Id,
      currency: account.Ccy,
      name: account.Nm
    };
  }

  extractAgentInfo(obj, path) {
    const agent = this.extractValue(obj, path);
    if (!agent) return null;
    
    return {
      identification: agent.FinInstnId?.BIC || agent.FinInstnId?.Othr?.Id,
      name: agent.FinInstnId?.Nm
    };
  }

  extractAmountInfo(obj, path) {
    const amount = this.extractValue(obj, path);
    if (!amount) return null;
    
    return {
      value: amount.InstdAmt || amount._,
      currency: amount.Ccy || amount.$?.Ccy
    };
  }

  extractBalanceInfo(obj, path) {
    const balance = this.extractValue(obj, path);
    if (!balance) return null;
    
    return {
      amount: this.extractAmountInfo(balance, 'Amt'),
      creditDebitIndicator: balance.CdtDbtInd,
      date: balance.Dt
    };
  }

  extractRelatedParties(entry) {
    return {
      debtor: this.extractPartyInfo(entry, 'RltdPties.Dbtr'),
      creditor: this.extractPartyInfo(entry, 'RltdPties.Cdtr'),
      debtorAccount: this.extractAccountInfo(entry, 'RltdPties.DbtrAcct'),
      creditorAccount: this.extractAccountInfo(entry, 'RltdPties.CdtrAcct')
    };
  }

  extractSettlementInfo(obj, path) {
    const settlement = this.extractValue(obj, path);
    if (!settlement) return null;
    
    return {
      settlementMethod: settlement.SttlmMtd,
      settlementAccount: this.extractAccountInfo(settlement, 'SttlmAcct'),
      clearingSystem: settlement.ClrSys
    };
  }

  extractTransactionInfo(obj) {
    const transactions = this.extractArray(obj, 'CdtTrfTxInf');
    return transactions.map(tx => ({
      paymentId: this.extractValue(tx, 'PmtId'),
      amount: this.extractAmountInfo(tx, 'Amt'),
      debtor: this.extractPartyInfo(tx, 'Dbtr'),
      creditor: this.extractPartyInfo(tx, 'Cdtr'),
      debtorAccount: this.extractAccountInfo(tx, 'DbtrAcct'),
      creditorAccount: this.extractAccountInfo(tx, 'CdtrAcct'),
      remittanceInformation: this.extractValue(tx, 'RmtInf.Ustrd')
    }));
  }

  extractCommonFields(obj) {
    const fields = {};
    
    // Try to extract common fields from any structure
    const traverse = (current, path = '') => {
      if (typeof current === 'object' && current !== null) {
        for (const [key, value] of Object.entries(current)) {
          const currentPath = path ? `${path}.${key}` : key;
          
          if (typeof value === 'string' || typeof value === 'number') {
            // Store leaf values
            if (key.toLowerCase().includes('id') || 
                key.toLowerCase().includes('amt') ||
                key.toLowerCase().includes('nm') ||
                key.toLowerCase().includes('cd')) {
              fields[currentPath] = value;
            }
          } else if (Array.isArray(value)) {
            // Handle arrays
            value.forEach((item, index) => {
              traverse(item, `${currentPath}[${index}]`);
            });
          } else {
            // Recurse into objects
            traverse(value, currentPath);
          }
        }
      }
    };
    
    traverse(obj);
    return fields;
  }

  // Utility methods for building data
  buildPartyInfo(party) {
    if (!party) return null;
    
    return {
      Nm: party.name,
      Id: party.identification,
      PstlAdr: party.address
    };
  }

  buildAccountInfo(account) {
    if (!account) return null;
    
    return {
      Id: {
        IBAN: account.identification
      },
      Ccy: account.currency,
      Nm: account.name
    };
  }

  buildAgentInfo(agent) {
    if (!agent) return null;
    
    return {
      FinInstnId: {
        BIC: agent.identification,
        Nm: agent.name
      }
    };
  }

  buildAmountInfo(amount) {
    if (!amount) return null;
    
    return {
      InstdAmt: {
        _: amount.value,
        $: { Ccy: amount.currency }
      }
    };
  }

  buildBalanceInfo(balance) {
    if (!balance) return null;
    
    return {
      Amt: this.buildAmountInfo(balance.amount),
      CdtDbtInd: balance.creditDebitIndicator,
      Dt: balance.date
    };
  }

  buildSettlementInfo(settlement) {
    if (!settlement) return null;
    
    return {
      SttlmMtd: settlement.settlementMethod,
      SttlmAcct: this.buildAccountInfo(settlement.settlementAccount),
      ClrSys: settlement.clearingSystem
    };
  }

  buildTransactionInfo(transaction) {
    return {
      PmtId: transaction.paymentId,
      Amt: this.buildAmountInfo(transaction.amount),
      Dbtr: this.buildPartyInfo(transaction.debtor),
      Cdtr: this.buildPartyInfo(transaction.creditor),
      DbtrAcct: this.buildAccountInfo(transaction.debtorAccount),
      CdtrAcct: this.buildAccountInfo(transaction.creditorAccount),
      RmtInf: { Ustrd: transaction.remittanceInformation }
    };
  }

  /**
   * Validate ISO 20022 message
   * @param {Object} parsedMessage - Parsed message object
   * @returns {Object} - Validation result
   */
  validate(parsedMessage) {
    const errors = [];
    const warnings = [];
    
    // Basic structure validation
    if (!parsedMessage.messageType) {
      errors.push('Message type not identified');
    }
    
    // Message-specific validation
    if (parsedMessage.messageType?.category === 'pain') {
      if (!parsedMessage.messageIdentification) {
        errors.push('Message identification is required');
      }
      if (!parsedMessage.paymentInformation || parsedMessage.paymentInformation.length === 0) {
        errors.push('At least one payment information block is required');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

module.exports = ISO20022Parser;

