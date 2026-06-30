const blockchainProofOwnershipConfig = {
  project: {
    name: 'VALOORES Blockchain Integration Ownership Model',
    phase: 'Phase 2',
    architectureRule:
      'PostgreSQL owns full business data; Hyperledger Fabric stores immutable proof only; Backend owns integration logic; Frontend owns user interaction; Compliance/Audit users approve records before blockchain submission.'
  },

  phase2Rules: [
    'PostgreSQL owns the full business data.',
    'Hyperledger Fabric owns immutable proof only.',
    'Backend owns validation, hash generation, blockchain submission, retry, and verification logic.',
    'Frontend owns user interaction, dashboard display, verification buttons, and audit screens.',
    'Compliance/Audit users approve records before blockchain submission.'
  ],

  requiredAreas: [
    'postgresqlBusinessData',
    'hyperledgerFabricProof',
    'backendIntegrationLogic',
    'frontendUserInteraction',
    'complianceAuditApproval',
    'dataFlowOwnership',
    'approvalOwnership',
    'verificationOwnership',
    'errorRetryOwnership',
    'securityValidation'
  ],

  ownershipModel: {
    postgresqlBusinessData: {
      owner: 'PostgreSQL',
      primaryOwnership: true,
      responsibility: [
        'Own full VALOORES business records',
        'Own PostgreSQL source views',
        'Own PostgreSQL history tables',
        'Own approval status',
        'Own blockchain submission status',
        'Own Fabric transaction ID reference',
        'Own retry metadata',
        'Own verification result',
        'Own dashboard source data'
      ],
      storedData: [
        'Full AML records',
        'Full customer records',
        'Full transaction records',
        'Full screening activity records',
        'History records',
        'Approval status',
        'Blockchain transaction references',
        'Retry count and error message',
        'Verification result and timestamp'
      ],
      prohibitedFromFabric: [
        'Full customer personal data',
        'Full AML business data',
        'Full transaction details',
        'Full screening details',
        'Passwords',
        'Tokens',
        'Secrets'
      ],
      systemOfRecord: true
    },

    hyperledgerFabricProof: {
      owner: 'Hyperledger Fabric',
      primaryOwnership: true,
      responsibility: [
        'Store immutable proof only',
        'Store blockchain ledger key',
        'Store source module name',
        'Store source record reference',
        'Store stable hash',
        'Store proof timestamp',
        'Store submitted-by identity',
        'Store Fabric transaction metadata',
        'Support proof lookup and proof history'
      ],
      storedData: [
        'Ledger key',
        'Stable hash',
        'Source module',
        'Source record ID/reference',
        'Action type',
        'PostgreSQL history ID/reference',
        'Proof timestamp',
        'Submitting service/user reference',
        'Non-sensitive metadata only'
      ],
      storesSensitiveData: false,
      systemOfRecord: false
    },

    backendIntegrationLogic: {
      owner: 'Backend API',
      primaryOwnership: true,
      responsibility: [
        'Read approved records from PostgreSQL',
        'Validate record eligibility',
        'Validate approval status before blockchain submission',
        'Generate deterministic stable hash',
        'Create proof-only blockchain payload',
        'Submit proof to Hyperledger Fabric',
        'Link Fabric transaction ID back to PostgreSQL',
        'Detect failed submissions',
        'Retry eligible failed records',
        'Recalculate hash for verification',
        'Compare PostgreSQL recalculated hash with Fabric proof',
        'Protect API routes and enforce permissions'
      ],
      ownsBusinessApprovalDecision: false,
      ownsHashGeneration: true,
      ownsFabricSubmission: true,
      ownsRetryLogic: true,
      ownsVerificationLogic: true
    },

    frontendUserInteraction: {
      owner: 'VALOORES UI',
      primaryOwnership: true,
      responsibility: [
        'Display pending approval records',
        'Display approved, rejected, submitted, failed, retry, and verified statuses',
        'Display blockchain dashboard',
        'Display audit screens',
        'Display proof history screens',
        'Display verification buttons',
        'Display retry buttons based on permissions',
        'Display success and error messages',
        'Provide filtering and search for audit users'
      ],
      doesNotOwn: [
        'Full business data storage',
        'Stable hash generation',
        'Direct Fabric submission',
        'Blockchain immutability',
        'Backend validation logic'
      ],
      userFacingOnly: true
    },

    complianceAuditApproval: {
      owner: 'Compliance/Audit Users',
      primaryOwnership: true,
      responsibility: [
        'Review records before blockchain submission',
        'Approve eligible records',
        'Reject records that should not be submitted',
        'Review proof history',
        'Review verification status',
        'Review failed submissions and retry status',
        'Review audit exceptions'
      ],
      approvalRequiredBeforeSubmission: true,
      approvalStatuses: [
        'PENDING_APPROVAL',
        'APPROVED',
        'REJECTED',
        'SUBMITTED',
        'FAILED',
        'RETRY_PENDING',
        'VERIFIED',
        'VERIFICATION_FAILED'
      ]
    },

    dataFlowOwnership: {
      owner: 'PostgreSQL + Backend API + Hyperledger Fabric + Frontend UI',
      responsibility: [
        'PostgreSQL stores source business data and history',
        'Frontend displays pending records and user actions',
        'Compliance/Audit users approve records',
        'Backend validates approved records',
        'Backend generates stable hash',
        'Backend submits proof-only payload to Fabric',
        'Fabric stores immutable proof only',
        'Backend stores Fabric transaction ID and status in PostgreSQL',
        'Frontend displays submission and verification status'
      ],
      flow: [
        'Business data is created or updated in PostgreSQL',
        'Backend detects eligible history records',
        'Frontend displays pending records',
        'Compliance/Audit user approves or rejects the record',
        'PostgreSQL stores approval decision',
        'Backend reads approved record',
        'Backend validates required fields',
        'Backend generates stable hash',
        'Backend submits proof-only payload to Hyperledger Fabric',
        'Hyperledger Fabric stores immutable proof only',
        'Backend stores Fabric transaction ID in PostgreSQL',
        'Frontend displays blockchain status and audit result'
      ]
    },

    approvalOwnership: {
      owner: 'Compliance/Audit Users + Backend API + PostgreSQL + Frontend UI',
      responsibility: [
        'Compliance/Audit users own approval decision',
        'PostgreSQL owns approval storage',
        'Backend validates that only approved records are submitted',
        'Frontend displays approval screens and approval status',
        'PostgreSQL stores approval audit trail'
      ],
      rule: 'No record can be submitted to Hyperledger Fabric before Compliance/Audit approval.',
      approvalRequiredBeforeBlockchainSubmission: true
    },

    verificationOwnership: {
      owner: 'Backend API',
      responsibility: [
        'Receive verification request from Frontend UI',
        'Read source/history record from PostgreSQL',
        'Recalculate stable hash',
        'Read immutable proof from Hyperledger Fabric',
        'Compare PostgreSQL hash with Fabric hash',
        'Return verification result',
        'Store verification result in PostgreSQL'
      ],
      frontendResponsibility: [
        'Display verify button',
        'Display verified status',
        'Display mismatch status',
        'Display proof not found status',
        'Display verification error message'
      ],
      verificationStatuses: [
        'VERIFIED',
        'HASH_MISMATCH',
        'FABRIC_PROOF_NOT_FOUND',
        'POSTGRES_RECORD_NOT_FOUND',
        'VERIFICATION_ERROR'
      ]
    },

    errorRetryOwnership: {
      owner: 'Backend API + PostgreSQL + Frontend UI',
      responsibility: [
        'Backend catches validation and Fabric submission errors',
        'Backend marks failed records',
        'Backend decides retry eligibility',
        'Backend retries eligible failed records',
        'PostgreSQL stores retry count, last retry date, next retry date, and error message',
        'Frontend displays failed records and retry actions based on role',
        'Audit users can review retry history and final failed records'
      ],
      retryRules: [
        'Only approved records can be retried',
        'Rejected records must not be submitted or retried',
        'Records with unchanged hash must not be resubmitted unless previous Fabric submission failed',
        'Retry count must be tracked in PostgreSQL',
        'Final failed records must remain visible to Audit users',
        'Fabric must not store full business data during retry'
      ]
    },

    securityValidation: {
      owner: 'Security + Backend API',
      responsibility: [
        'Block sensitive data from blockchain payloads',
        'Protect ownership, approval, retry, and verification API routes',
        'Avoid sensitive data in logs',
        'Validate stable hash generation',
        'Validate tampering detection',
        'Ensure Fabric payload remains proof-only',
        'Ensure frontend cannot bypass backend approval validation'
      ],
      sensitiveDataAllowedOnFabric: false
    }
  }
};

module.exports = blockchainProofOwnershipConfig;
