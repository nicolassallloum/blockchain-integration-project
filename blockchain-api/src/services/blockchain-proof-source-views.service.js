const sourceViewsConfig = require('../config/blockchain-proof-source-views.config');

function getSourceViews() {
  return sourceViewsConfig;
}

function getSourceViewByRecordType(recordType) {
  return sourceViewsConfig.sourceViews[recordType] || null;
}

function validateSourceViewsConfig() {
  const requiredRecordTypes = [
    'AML',
    'CUSTOMER_DATA',
    'TRANSACTION_DATA',
    'SCREENING_ACTIVITY'
  ];

  const missingRecordTypes = requiredRecordTypes.filter(
    (recordType) => !sourceViewsConfig.sourceViews[recordType]
  );

  const confirmedViews = Object.values(sourceViewsConfig.sourceViews).filter(
    (view) => view.confirmed === true
  );

  const pendingViews = Object.values(sourceViewsConfig.sourceViews).filter(
    (view) => view.confirmed === false
  );

  return {
    valid: missingRecordTypes.length === 0,
    message:
      missingRecordTypes.length === 0
        ? 'Source views configuration is complete'
        : 'Source views configuration is missing required record types',
    requiredRecordTypes,
    missingRecordTypes,
    confirmedCount: confirmedViews.length,
    pendingCount: pendingViews.length,
    confirmedViews: confirmedViews.map((view) => ({
      recordType: view.recordType,
      fullViewName: view.fullViewName,
      sourcePrimaryKey: view.sourcePrimaryKey
    })),
    pendingViews: pendingViews.map((view) => ({
      recordType: view.recordType,
      implementationOrder: view.implementationOrder,
      description: view.description
    }))
  };
}

module.exports = {
  getSourceViews,
  getSourceViewByRecordType,
  validateSourceViewsConfig
};
