const blockchainProofOwnershipConfig = {
  project: {
    name: 'PostgreSQL Blockchain Proof Integration',
    architectureRule: 'PostgreSQL remains source of truth; blockchain stores proof only'
  },

  ownershipModel: {
    postgresqlSourceViews: {
      owner: 'PostgreSQL / Data Owner',
      responsibility: [
        'Own source views',
        'Approve source primary keys',
        'Approve fields used for stable hash generation',
        'Ensure source views do not expose unnecessary sensitive fields'
      ],
      systemOfRecord: true
    },

    postgresqlHistoryTables: {
      owner: 'Backend Integration Service',
      responsibility: [
        'Create history records',
        'Store old hash and new hash',
        'Store sync status',
        'Store blockchain key',
        'Store blockchain transaction ID',
        'Store retry count and error message'
      ],
      systemOfRecord: false
    },

    backendSyncService: {
      owner: 'Backend Integration Service',
      responsibility: [
        'Read from PostgreSQL source views',
        'Detect CREATE events',
        'Detect UPDATE events',
        'Skip unchanged records',
        'Generate stable hashes',
        'Submit proof to blockchain',
        'Update PostgreSQL history after blockchain submission'
      ],
      serviceName: 'postgres-blockchain-proof-sync-service'
    },

    hashGeneration: {
      owner: 'Backend Integration Service',
      responsibility: [
        'Normalize approved source fields',
        'Generate deterministic stable hash',
        'Exclude sensitive fields',
        'Ensure same input always creates same hash'
      ],
      algorithm: 'SHA-256'
    },

    blockchainChaincode: {
      owner: 'Hyperledger Fabric Chaincode',
      responsibility: [
        'Save proof records',
        'Return proof records',
        'Return proof history',
        'Verify proof hash',
        'Query proof records by record type',
        'Query proof records by source record ID'
      ],
      storesSensitiveData: false
    },

    blockchainProofRecord: {
      owner: 'Blockchain Proof Layer',
      responsibility: [
        'Store immutable proof only',
        'Store blockchain key',
        'Store record type',
        'Store source record ID',
        'Store stable hash',
        'Store action type',
        'Store PostgreSQL history ID',
        'Store timestamp',
        'Store submitting service name',
        'Store optional non-sensitive metadata'
      ],
      prohibited: [
        'Full AML details',
        'Full customer details',
        'Full transaction details',
        'Full screening details',
        'PII',
        'Raw PostgreSQL records',
        'Passwords',
        'Tokens',
        'Secrets'
      ]
    },

    retryLogic: {
      owner: 'Backend Integration Service',
      responsibility: [
        'Find failed records',
        'Retry failed blockchain submissions',
        'Increase retry count',
        'Preserve original proof hash',
        'Avoid duplicate proof records where possible'
      ]
    },

    verificationLogic: {
      owner: 'Backend Integration Service',
      responsibility: [
        'Regenerate PostgreSQL hash',
        'Read blockchain proof',
        'Compare PostgreSQL hash with blockchain hash',
        'Return VERIFIED, MISMATCHED, or TAMPERED status'
      ]
    },

    dashboardAndMonitoring: {
      owner: 'Backend API and Frontend Dashboard',
      responsibility: [
        'Show synced records',
        'Show failed records',
        'Show retry count',
        'Show last sync date',
        'Show verification status',
        'Show records by type',
        'Show records by status'
      ]
    },

    securityValidation: {
      owner: 'Security / Backend Integration Service',
      responsibility: [
        'Block sensitive data from blockchain payloads',
        'Protect API routes',
        'Avoid sensitive data in logs',
        'Validate stable hash generation',
        'Validate tampering detection'
      ]
    }
  }
};

module.exports = blockchainProofOwnershipConfig;
