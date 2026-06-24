const blockchainProofSourceViewsConfig = {
  project: {
    name: 'PostgreSQL Blockchain Proof Integration',
    rule: 'PostgreSQL source views remain the operational source of truth'
  },

  sourceViews: {
    AML: {
      recordType: 'AML',
      priority: 1,
      enabled: true,
      confirmed: true,
      sourceSchema: 'blockchain',
      sourceView: 'valoores_aml_rules',
      fullViewName: 'blockchain.valoores_aml_rules',
      sourcePrimaryKey: ['rule_id', 'query_id'],
      implementationOrder: 'FIRST',
      description: 'Valoores AML rules source view used for first blockchain proof sync implementation',
      allowedForBlockchain: false,
      blockchainSubmissionRule: 'Submit only proof hash and metadata, never full AML rule details'
    },

    CUSTOMER_DATA: {
      recordType: 'CUSTOMER_DATA',
      priority: 2,
      enabled: false,
      confirmed: false,
      sourceSchema: null,
      sourceView: null,
      fullViewName: null,
      sourcePrimaryKey: [],
      implementationOrder: 'SECOND',
      description: 'Customer Data source view pending confirmation',
      allowedForBlockchain: false,
      blockchainSubmissionRule: 'Submit only proof hash and metadata, never full customer details'
    },

    TRANSACTION_DATA: {
      recordType: 'TRANSACTION_DATA',
      priority: 3,
      enabled: false,
      confirmed: false,
      sourceSchema: null,
      sourceView: null,
      fullViewName: null,
      sourcePrimaryKey: [],
      implementationOrder: 'THIRD',
      description: 'Transaction Data source view pending confirmation',
      allowedForBlockchain: false,
      blockchainSubmissionRule: 'Submit only proof hash and metadata, never full transaction details'
    },

    SCREENING_ACTIVITY: {
      recordType: 'SCREENING_ACTIVITY',
      priority: 4,
      enabled: false,
      confirmed: false,
      sourceSchema: null,
      sourceView: null,
      fullViewName: null,
      sourcePrimaryKey: [],
      implementationOrder: 'FOURTH',
      description: 'Screening Activity source view pending confirmation',
      allowedForBlockchain: false,
      blockchainSubmissionRule: 'Submit only proof hash and metadata, never full screening details'
    }
  }
};

module.exports = blockchainProofSourceViewsConfig;
