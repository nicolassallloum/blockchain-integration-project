'use strict';
require('dotenv').config();
const amlService = require('../services/aml.service');

async function main() {
  const result = await amlService.evaluateTransaction({
    requestId: 'TEST-AML-001',
    fromWalletAddress: 'TEST-WALLET-SENDER-001',
    toWalletAddress: 'TEST-WALLET-RECEIVER-001',
    customerId: 'TEST-CUSTOMER-001',
    counterpartyCustomerId: 'TEST-CUSTOMER-002',
    transactionType: 'WALLET_TO_WALLET',
    amount: 15000,
    currencyCode: 'USD'
  });

  console.log(JSON.stringify(result, null, 2));
}

main()
  .then(() => {
    console.log('AML service test completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('AML service test failed:', error);
    process.exit(1);
  });
