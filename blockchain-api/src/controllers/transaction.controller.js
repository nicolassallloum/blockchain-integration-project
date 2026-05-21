'use strict';

const transactionService = require('../services/transaction.service');
const auditService = require('../services/audit.service');
const amlService = require('../services/aml.service');

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

function getTransferAmount(body) {
  return Number(body.amount || body.transferAmount || body.transactionAmount || 0);
}

function getCurrencyCode(body) {
  return body.currencyCode || body.currency || 'LBP';
}

function getSenderWallet(body) {
  return body.senderWalletAddress || body.fromWalletAddress || body.walletAddress || null;
}

function getReceiverWallet(body) {
  return body.receiverWalletAddress || body.toWalletAddress || body.destinationWalletAddress || null;
}

function getCustomerId(body) {
  return body.customerId || body.senderCustomerId || body.fromCustomerId || null;
}

async function evaluateAml(req, transactionType) {
  const body = req.body || {};

  if (!amlService || typeof amlService.evaluateTransaction !== 'function') {
    return {
      decision: 'ALLOW',
      matchedRules: [],
      message: 'AML service not available. Transaction allowed by fallback.'
    };
  }

  return amlService.evaluateTransaction({
    requestId: req.requestId,
    correlationId: req.correlationId,
    fromWalletAddress: getSenderWallet(body),
    toWalletAddress: getReceiverWallet(body),
    organizationId: body.organizationId || null,
    organizationCode: body.organizationCode || null,
    customerId: getCustomerId(body),
    amount: getTransferAmount(body),
    currencyCode: getCurrencyCode(body),
    transactionType,
    metadata: body
  });
}

function handleAmlDecision(res, amlResult) {
  if (!amlResult) {
    return false;
  }

  if (amlResult.decision === 'BLOCK') {
    res.status(403).json({
      success: false,
      message: 'Transaction blocked by AML rules',
      amlDecision: amlResult.decision,
      matchedRules: amlResult.matchedRules || [],
      amlResult
    });

    return true;
  }

  if (amlResult.decision === 'REVIEW') {
    res.status(202).json({
      success: false,
      message: 'Transaction requires AML review before processing',
      amlDecision: amlResult.decision,
      matchedRules: amlResult.matchedRules || [],
      amlResult
    });

    return true;
  }

  return false;
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
        walletAddress: getSenderWallet(req.body),
        requestPayload: req.body,
        controllerName: 'transaction.controller',
        serviceName: 'transaction.service',
        metadata: {
          transactionType: 'WALLET_TO_WALLET'
        }
      });

      const amlResult = await evaluateAml(req, 'WALLET_TO_WALLET');

      if (handleAmlDecision(res, amlResult)) {
        return;
      }

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
        createdBy: req.body.createdBy || 'system',
        amlResult
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
        walletAddress: getSenderWallet(req.body),
        responsePayload: result,
        controllerName: 'transaction.controller',
        serviceName: 'transaction.service',
        metadata: {
          transactionType: 'WALLET_TO_WALLET',
          amlDecision: amlResult?.decision || null
        }
      });

      return res.status(200).json({
        ...result,
        amlDecision: amlResult?.decision || null,
        amlResult,
        requestId: req.requestId,
        correlationId: req.correlationId
      });
    } catch (error) {
      await auditService.log({
        ...context,
        eventType: AUDIT_EVENT_TYPES.TRANSACTION_FAILED,
        eventCategory: AUDIT_EVENT_CATEGORY.TRANSACTION,
        eventStatus: AUDIT_EVENT_STATUS.FAILED,
        walletAddress: getSenderWallet(req.body),
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
        walletAddress: getSenderWallet(req.body),
        organizationId: req.body.organizationId || null,
        organizationCode: req.body.organizationCode || null,
        requestPayload: req.body,
        controllerName: 'transaction.controller',
        serviceName: 'transaction.service',
        metadata: {
          transactionType: 'WALLET_TO_ORGANIZATION'
        }
      });

      const amlResult = await evaluateAml(req, 'WALLET_TO_ORGANIZATION');

      if (handleAmlDecision(res, amlResult)) {
        return;
      }

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
        createdBy: req.body.createdBy || 'system',
        amlResult
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
        walletAddress: getSenderWallet(req.body),
        organizationId: req.body.organizationId || null,
        organizationCode: req.body.organizationCode || null,
        responsePayload: result,
        controllerName: 'transaction.controller',
        serviceName: 'transaction.service',
        metadata: {
          transactionType: 'WALLET_TO_ORGANIZATION',
          amlDecision: amlResult?.decision || null
        }
      });

      return res.status(200).json({
        ...result,
        amlDecision: amlResult?.decision || null,
        amlResult,
        requestId: req.requestId,
        correlationId: req.correlationId
      });
    } catch (error) {
      await auditService.log({
        ...context,
        eventType: AUDIT_EVENT_TYPES.TRANSACTION_FAILED,
        eventCategory: AUDIT_EVENT_CATEGORY.TRANSACTION,
        eventStatus: AUDIT_EVENT_STATUS.FAILED,
        walletAddress: getSenderWallet(req.body),
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