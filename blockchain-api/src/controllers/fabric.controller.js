'use strict';

const fabricService = require('../services/fabric.service');

class FabricController {
  async evaluate(req, res, next) {
    try {
      const { functionName, args = [] } = req.body;

      if (!functionName) {
        return res.status(400).json({
          success: false,
          message: 'functionName is required',
          errorCode: 'FUNCTION_NAME_REQUIRED',
          requestId: req.requestId,
          correlationId: req.correlationId
        });
      }

      const result = await fabricService.evaluateTransaction(
        functionName,
        Array.isArray(args) ? args : [],
        {
          requestId: req.requestId,
          correlationId: req.correlationId,
          sourceSystem: req.sourceSystem,
          requestSource: req.requestSource,
          createdBy: req.body.createdBy || 'system'
        }
      );

      return res.status(200).json({
        ...result,
        requestId: req.requestId,
        correlationId: req.correlationId
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Fabric evaluate transaction failed.',
        error: {
          message: error.message
        },
        requestId: req.requestId,
        correlationId: req.correlationId
      });
    }
  }

  async submit(req, res, next) {
    try {
      const { functionName, args = [] } = req.body;

      if (!functionName) {
        return res.status(400).json({
          success: false,
          message: 'functionName is required',
          errorCode: 'FUNCTION_NAME_REQUIRED',
          requestId: req.requestId,
          correlationId: req.correlationId
        });
      }

      const result = await fabricService.submitTransaction(
        functionName,
        Array.isArray(args) ? args : [],
        {
          requestId: req.requestId,
          correlationId: req.correlationId,
          sourceSystem: req.sourceSystem,
          requestSource: req.requestSource,
          createdBy: req.body.createdBy || 'system'
        }
      );

      return res.status(200).json({
        ...result,
        requestId: req.requestId,
        correlationId: req.correlationId
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Fabric submit transaction failed.',
        error: {
          message: error.message
        },
        requestId: req.requestId,
        correlationId: req.correlationId
      });
    }
  }
}

module.exports = new FabricController();