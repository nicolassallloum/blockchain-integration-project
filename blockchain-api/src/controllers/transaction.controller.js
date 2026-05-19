'use strict';

const transactionService = require('../services/transaction.service');
const auditService = require('../services/audit.service');
const amlService = require('../services/aml.service');


const amlResult = await amlService.evaluateTransaction({
  requestId,
  fromWalletAddress,
  toWalletAddress,
  customerId,
  amount,
  currencyCode,
  transactionType: 'WALLET_TO_WALLET'
});

if (amlResult.decision === 'BLOCK') {
  return res.status(403).json({
    success: false,
    message: 'Transaction blocked by AML rules',
    amlDecision: amlResult.decision,
    matchedRules: amlResult.matchedRules
  });
}

if (amlResult.decision === 'REVIEW') {
  return res.status(202).json({
    success: false,
    message: 'Transaction requires AML review before processing',
    amlDecision: amlResult.decision,
    matchedRules: amlResult.matchedRules
  });
}


const {
  AUDIT_EVENT_TYPES,
  AUDIT_EVENT_STATUS,
  AUDIT_EVENT_CATEGORY
} = require('../constants/audit.constants');

function getRequestContext(req) {
  return auditService.buildRequestContext(req);
}

function resolveServiceMethod(service, methodNames = []) {
  for (const methodName of methodNames) {
    if (typeof service[methodName] === 'function') {
      return service[methodName].bind(service);
    }
  }

  return null;
}

class TransactionController {
  async walletTransfer(req, res, next) {
    const context = getRequestContext(req);

    try {
      await auditService.log({
        ...context,
        eventType: AUDIT_EVENT_TYPES.TRANSACTION_REQUEST,
        eventCategory: AUDIT_EVENT_CATEGORY.TRANSACTION,
        eventStatus: AUDIT_EVENT_STATUS.PENDING,
        walletAddress:
          req.body.senderWalletAddress ||
          req.body.fromWalletAddress ||
          null,
        requestPayload: req.body,
        controllerName: 'transaction.controller',
        serviceName: 'transaction.service',
        metadata: {
          transactionType: 'WALLET_TO_WALLET'
        }
      });

      const walletTransferMethod = resolveServiceMethod(transactionService, [
        'walletTransfer',
        'createWalletTransfer',
        'walletToWalletTransfer',
        'transferBetweenWallets',
        'executeWalletTransfer',
        'processWalletTransfer'
      ]);

      if (!walletTransferMethod) {
        throw new Error(
          'No wallet transfer method found in transaction.service.js. Expected one of: walletTransfer, createWalletTransfer, walletToWalletTransfer, transferBetweenWallets, executeWalletTransfer, processWalletTransfer'
        );
      }

      const result = await walletTransferMethod(req.body, {
        requestId: req.requestId,
        correlationId: req.correlationId,
        sourceSystem: req.sourceSystem,
        requestSource: req.requestSource,
        createdBy: req.body.createdBy || 'system'
      });

      await auditService.log({
        ...context,
        eventType: AUDIT_EVENT_TYPES.TRANSACTION_SUCCESS,
        eventCategory: AUDIT_EVENT_CATEGORY.TRANSACTION,
        eventStatus: AUDIT_EVENT_STATUS.SUCCESS,
        transactionId:
          result?.data?.transactionId ||
          result?.transactionId ||
          null,
        fabricTxId:
          result?.data?.fabricTxId ||
          result?.fabricTxId ||
          result?.txId ||
          null,
        walletAddress:
          req.body.senderWalletAddress ||
          req.body.fromWalletAddress ||
          null,
        responsePayload: result,
        controllerName: 'transaction.controller',
        serviceName: 'transaction.service',
        metadata: {
          transactionType: 'WALLET_TO_WALLET'
        }
      });

      return res.status(200).json({
        ...result,
        requestId: req.requestId,
        correlationId: req.correlationId
      });
    } catch (error) {
      await auditService.log({
        ...context,
        eventType: AUDIT_EVENT_TYPES.TRANSACTION_FAILED,
        eventCategory: AUDIT_EVENT_CATEGORY.TRANSACTION,
        eventStatus: AUDIT_EVENT_STATUS.FAILED,
        walletAddress:
          req.body.senderWalletAddress ||
          req.body.fromWalletAddress ||
          null,
        errorCode: error.code || 'WALLET_TRANSFER_ERROR',
        errorMessage: error.message,
        errorStack: error.stack,
        requestPayload: req.body,
        controllerName: 'transaction.controller',
        serviceName: 'transaction.service',
        metadata: {
          transactionType: 'WALLET_TO_WALLET'
        }
      });

      return next(error);
    }
  }

  async organizationTransfer(req, res, next) {
    const context = getRequestContext(req);

    try {
      await auditService.log({
        ...context,
        eventType: AUDIT_EVENT_TYPES.TRANSACTION_REQUEST,
        eventCategory: AUDIT_EVENT_CATEGORY.TRANSACTION,
        eventStatus: AUDIT_EVENT_STATUS.PENDING,
        walletAddress:
          req.body.senderWalletAddress ||
          req.body.fromWalletAddress ||
          null,
        organizationId: req.body.organizationId || null,
        organizationCode: req.body.organizationCode || null,
        requestPayload: req.body,
        controllerName: 'transaction.controller',
        serviceName: 'transaction.service',
        metadata: {
          transactionType: 'WALLET_TO_ORGANIZATION'
        }
      });

      const organizationTransferMethod = resolveServiceMethod(transactionService, [
        'organizationTransfer',
        'createOrganizationTransfer',
        'walletToOrganizationTransfer',
        'transferToOrganization',
        'executeOrganizationTransfer',
        'processOrganizationTransfer'
      ]);

      if (!organizationTransferMethod) {
        throw new Error(
          'No organization transfer method found in transaction.service.js. Expected one of: organizationTransfer, createOrganizationTransfer, walletToOrganizationTransfer, transferToOrganization, executeOrganizationTransfer, processOrganizationTransfer'
        );
      }

      const result = await organizationTransferMethod(req.body, {
        requestId: req.requestId,
        correlationId: req.correlationId,
        sourceSystem: req.sourceSystem,
        requestSource: req.requestSource,
        createdBy: req.body.createdBy || 'system'
      });

      await auditService.log({
        ...context,
        eventType: AUDIT_EVENT_TYPES.TRANSACTION_SUCCESS,
        eventCategory: AUDIT_EVENT_CATEGORY.TRANSACTION,
        eventStatus: AUDIT_EVENT_STATUS.SUCCESS,
        transactionId:
          result?.data?.transactionId ||
          result?.transactionId ||
          null,
        fabricTxId:
          result?.data?.fabricTxId ||
          result?.fabricTxId ||
          result?.txId ||
          null,
        walletAddress:
          req.body.senderWalletAddress ||
          req.body.fromWalletAddress ||
          null,
        organizationId: req.body.organizationId || null,
        organizationCode: req.body.organizationCode || null,
        responsePayload: result,
        controllerName: 'transaction.controller',
        serviceName: 'transaction.service',
        metadata: {
          transactionType: 'WALLET_TO_ORGANIZATION'
        }
      });

      return res.status(200).json({
        ...result,
        requestId: req.requestId,
        correlationId: req.correlationId
      });
    } catch (error) {
      await auditService.log({
        ...context,
        eventType: AUDIT_EVENT_TYPES.TRANSACTION_FAILED,
        eventCategory: AUDIT_EVENT_CATEGORY.TRANSACTION,
        eventStatus: AUDIT_EVENT_STATUS.FAILED,
        walletAddress:
          req.body.senderWalletAddress ||
          req.body.fromWalletAddress ||
          null,
        organizationId: req.body.organizationId || null,
        organizationCode: req.body.organizationCode || null,
        errorCode: error.code || 'ORGANIZATION_TRANSFER_ERROR',
        errorMessage: error.message,
        errorStack: error.stack,
        requestPayload: req.body,
        controllerName: 'transaction.controller',
        serviceName: 'transaction.service',
        metadata: {
          transactionType: 'WALLET_TO_ORGANIZATION'
        }
      });

      return next(error);
    }
  }

  async getTransactionHistory(req, res, next) {
    try {
      const getHistoryMethod = resolveServiceMethod(transactionService, [
        'getTransactionHistory',
        'searchTransactions',
        'getTransactions'
      ]);

      if (!getHistoryMethod) {
        throw new Error(
          'No transaction history method found in transaction.service.js'
        );
      }

      const result = await getHistoryMethod(req.query, {
        requestId: req.requestId,
        correlationId: req.correlationId,
        sourceSystem: req.sourceSystem,
        requestSource: req.requestSource
      });

      return res.status(200).json({
        ...result,
        requestId: req.requestId,
        correlationId: req.correlationId
      });
    } catch (error) {
      return next(error);
    }
  }

  async getTransactionById(req, res, next) {
    try {
      const getByIdMethod = resolveServiceMethod(transactionService, [
        'getTransactionById',
        'findTransactionById',
        'getTransaction'
      ]);

      if (!getByIdMethod) {
        throw new Error(
          'No get transaction by ID method found in transaction.service.js'
        );
      }

      const result = await getByIdMethod(req.params.transactionId, {
        requestId: req.requestId,
        correlationId: req.correlationId,
        sourceSystem: req.sourceSystem,
        requestSource: req.requestSource
      });

      return res.status(200).json({
        success: true,
        message: 'Transaction retrieved successfully',
        data: result?.data || result,
        requestId: req.requestId,
        correlationId: req.correlationId
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new TransactionController();