'use strict';

const walletService = require('../services/wallet.service');
const auditService = require('../services/audit.service');
const walletAuthService = require('../services/wallet-auth.service');

const {
  AUDIT_EVENT_TYPES,
  AUDIT_EVENT_STATUS,
  AUDIT_EVENT_CATEGORY
} = require('../constants/audit.constants');

function getRequestContext(req) {
  return auditService.buildRequestContext(req);
}

class WalletController {
  /**
   * Create wallet
   * POST /api/v1/wallets
   */
  async createWallet(req, res, next) {
    const context = getRequestContext(req);

    try {
      await auditService.log({
        ...context,
        eventType: AUDIT_EVENT_TYPES.WALLET_CREATE_REQUEST,
        eventCategory: AUDIT_EVENT_CATEGORY.WALLET,
        eventStatus: AUDIT_EVENT_STATUS.PENDING,
        customerId: req.body.customerId,
        organizationCode: req.body.organizationId,
        requestPayload: req.body,
        controllerName: 'wallet.controller',
        serviceName: 'wallet.service'
      });

      const result = await walletService.createWallet(req.body, {
        requestId: req.requestId,
        correlationId: req.correlationId,
        sourceSystem: req.sourceSystem,
        requestSource: req.requestSource,
        createdBy: req.body.createdBy || 'system'
      });

      await auditService.log({
        ...context,
        eventType: AUDIT_EVENT_TYPES.WALLET_CREATE_SUCCESS,
        eventCategory: AUDIT_EVENT_CATEGORY.WALLET,
        eventStatus: AUDIT_EVENT_STATUS.SUCCESS,
        customerId:
          result?.data?.wallet?.customerId ||
          result?.wallet?.customerId ||
          req.body.customerId,
        organizationId:
          result?.data?.wallet?.organizationId ||
          result?.wallet?.organizationId ||
          null,
        organizationCode:
          result?.data?.wallet?.organizationCode ||
          result?.wallet?.organizationCode ||
          req.body.organizationId,
        walletAddress:
          result?.data?.wallet?.walletAddress ||
          result?.wallet?.walletAddress ||
          null,
        fabricTxId:
          result?.data?.fabricTxId ||
          result?.fabricTxId ||
          result?.txId ||
          null,
        responsePayload: result,
        controllerName: 'wallet.controller',
        serviceName: 'wallet.service'
      });

      return res.status(201).json({
        ...result,
        requestId: req.requestId,
        correlationId: req.correlationId
      });
    } catch (error) {
      await auditService.log({
        ...context,
        eventType: AUDIT_EVENT_TYPES.WALLET_CREATE_FAILED,
        eventCategory: AUDIT_EVENT_CATEGORY.WALLET,
        eventStatus: AUDIT_EVENT_STATUS.FAILED,
        customerId: req.body.customerId,
        organizationCode: req.body.organizationId,
        errorCode: error.code || 'WALLET_CREATE_ERROR',
        errorMessage: error.message,
        errorStack: error.stack,
        requestPayload: req.body,
        controllerName: 'wallet.controller',
        serviceName: 'wallet.service'
      });

      return next(error);
    }
  }

  /**
   * Wallet login
   * POST /api/v1/wallets/login
   */
  /**
   * Wallet login
   * POST /api/v1/wallets/login
   */
  async loginWallet(req, res, next) {
    const context = getRequestContext(req);

    try {
      await auditService.log({
        ...context,
        eventType: AUDIT_EVENT_TYPES.WALLET_LOGIN_REQUEST,
        eventCategory: AUDIT_EVENT_CATEGORY.AUTHENTICATION,
        eventStatus: AUDIT_EVENT_STATUS.PENDING,
        customerId: req.body.customerId,
        requestPayload: req.body,
        controllerName: 'wallet.controller',
        serviceName: 'wallet-auth.service'
      });

      const result = await walletAuthService.loginWallet(req.body, {
        requestId: req.requestId,
        correlationId: req.correlationId,
        sourceSystem: req.sourceSystem,
        requestSource: req.requestSource,
        ipAddress:
          req.headers['x-forwarded-for'] ||
          req.socket?.remoteAddress ||
          req.ip ||
          null,
        userAgent: req.headers['user-agent'] || null
      });

      const normalizedStatusCode =
        result?.statusCode || (result?.success === false ? 401 : 200);

      const normalizedBody = result?.body || result;

      const isLoginSuccess =
        normalizedStatusCode >= 200 &&
        normalizedStatusCode < 300 &&
        normalizedBody?.success !== false;

      if (!normalizedBody || !isLoginSuccess) {
        await auditService.log({
          ...context,
          eventType: AUDIT_EVENT_TYPES.WALLET_LOGIN_FAILED,
          eventCategory: AUDIT_EVENT_CATEGORY.AUTHENTICATION,
          eventStatus: AUDIT_EVENT_STATUS.FAILED,
          customerId: req.body.customerId,
          errorCode: normalizedBody?.errorCode || 'INVALID_CREDENTIALS',
          errorMessage:
            normalizedBody?.message || 'Invalid wallet login credentials',
          requestPayload: req.body,
          responsePayload: normalizedBody,
          controllerName: 'wallet.controller',
          serviceName: 'wallet-auth.service'
        });

        return res.status(normalizedStatusCode || 401).json({
          success: false,
          message: normalizedBody?.message || 'Invalid login credentials',
          errorCode: normalizedBody?.errorCode || 'INVALID_CREDENTIALS',
          data: normalizedBody?.data || null,
          requestId: req.requestId,
          correlationId: req.correlationId
        });
      }

      await auditService.log({
        ...context,
        eventType: AUDIT_EVENT_TYPES.WALLET_LOGIN_SUCCESS,
        eventCategory: AUDIT_EVENT_CATEGORY.AUTHENTICATION,
        eventStatus: AUDIT_EVENT_STATUS.SUCCESS,
        customerId:
          normalizedBody?.data?.customerId ||
          normalizedBody?.customerId ||
          req.body.customerId,
        walletAddress:
          normalizedBody?.data?.walletAddress ||
          normalizedBody?.walletAddress ||
          null,
        responsePayload: {
          success: true,
          message: 'Wallet login successful',
          token: '***MASKED***'
        },
        controllerName: 'wallet.controller',
        serviceName: 'wallet-auth.service'
      });

      return res.status(normalizedStatusCode || 200).json({
        ...normalizedBody,
        requestId: req.requestId,
        correlationId: req.correlationId
      });
    } catch (error) {
      await auditService.log({
        ...context,
        eventType: AUDIT_EVENT_TYPES.WALLET_LOGIN_FAILED,
        eventCategory: AUDIT_EVENT_CATEGORY.AUTHENTICATION,
        eventStatus: AUDIT_EVENT_STATUS.ERROR,
        customerId: req.body.customerId,
        errorCode: error.code || 'WALLET_LOGIN_ERROR',
        errorMessage: error.message,
        errorStack: error.stack,
        requestPayload: req.body,
        controllerName: 'wallet.controller',
        serviceName: 'wallet-auth.service'
      });

      return next(error);
    }
  }

  /**
   * Get wallet by customer ID
   * GET /api/v1/wallets/customer/:customerId
   */
  async getWalletByCustomerId(req, res, next) {
    try {
      const customerId = req.params.customerId || req.query.customerId;

      const result = await walletService.getWalletByCustomerId(customerId, {
        requestId: req.requestId,
        correlationId: req.correlationId,
        sourceSystem: req.sourceSystem,
        requestSource: req.requestSource
      });

      return res.status(200).json({
        success: true,
        message: 'Wallet retrieved successfully',
        data: result?.data || result,
        requestId: req.requestId,
        correlationId: req.correlationId
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get wallet by wallet address
   * GET /api/v1/wallets/:walletAddress
   */
  async getWalletByAddress(req, res, next) {
    try {
      const walletAddress = req.params.walletAddress;

      const result = await walletService.getWalletByAddress(walletAddress, {
        requestId: req.requestId,
        correlationId: req.correlationId,
        sourceSystem: req.sourceSystem,
        requestSource: req.requestSource
      });

      return res.status(200).json({
        success: true,
        message: 'Wallet retrieved successfully',
        data: result?.data || result,
        requestId: req.requestId,
        correlationId: req.correlationId
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get wallet balance
   * GET /api/v1/wallets/:walletAddress/balance
   */
  async getWalletBalance(req, res, next) {
    try {
      const walletAddress = req.params.walletAddress;

      const result = await walletService.getWalletBalance(walletAddress, {
        requestId: req.requestId,
        correlationId: req.correlationId,
        sourceSystem: req.sourceSystem,
        requestSource: req.requestSource
      });

      return res.status(200).json({
        success: true,
        message: 'Wallet balance retrieved successfully',
        data: result?.data || result,
        requestId: req.requestId,
        correlationId: req.correlationId
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new WalletController();