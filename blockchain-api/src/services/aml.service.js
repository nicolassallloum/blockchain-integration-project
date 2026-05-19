'use strict';

/**
 * AML Service
 * ------------------------------------------------------
 * Purpose:
 * - Evaluate wallet transactions before submitting to Fabric
 * - Return ALLOW / REVIEW / BLOCK
 * - Check blacklist, amount limits, frequency, structuring, wallet risk
 * - Insert AML execution logs
 * - Insert AML alerts for REVIEW/BLOCK decisions
 */

const crypto = require('crypto');
const db = require('../config/database');

class AmlService {
  /**
   * Main AML evaluation function
   */
  async evaluateTransaction(payload) {
    const startedAt = new Date();

    const requestId = payload.requestId || this.generateRequestId();

    const fromWalletAddress = payload.fromWalletAddress || payload.walletAddress;
    const toWalletAddress = payload.toWalletAddress || payload.counterpartyWalletAddress || null;

    const customerId = payload.customerId || null;
    const counterpartyCustomerId = payload.counterpartyCustomerId || null;

    const organizationId = payload.organizationId || null;
    const organizationCode = payload.organizationCode || null;
    const organizationName = payload.organizationName || null;

    const transactionType = payload.transactionType || 'UNKNOWN';
    const amount = Number(payload.amount || payload.transactionAmount || 0);
    const currencyCode = payload.currencyCode || 'USD';

    const matchedRules = [];
    let finalDecision = 'ALLOW';
    let finalRiskScore = 0;

    try {
      const activeRules = await this.getActiveRules();

      const ruleMap = {};
      for (const rule of activeRules) {
        ruleMap[rule.rule_code] = rule;
      }

      /**
       * 1. BLACKLIST CHECKS
       */
      const blacklistMatches = await this.checkBlacklist({
        fromWalletAddress,
        toWalletAddress,
        customerId,
        counterpartyCustomerId,
        organizationId,
        organizationCode
      });

      if (blacklistMatches.length > 0) {
        for (const match of blacklistMatches) {
          let ruleCode = 'BLOCKED_WALLET';

          if (match.entity_type === 'CUSTOMER') {
            ruleCode = 'BLOCKED_CUSTOMER';
          }

          if (match.entity_type === 'ORGANIZATION') {
            ruleCode = 'BLOCKED_ORGANIZATION';
          }

          const rule = ruleMap[ruleCode];

          matchedRules.push(this.buildMatchedRule({
            rule,
            fallbackRuleCode: ruleCode,
            fallbackRuleType: 'BLACKLIST',
            fallbackAction: 'BLOCK',
            fallbackSeverity: 'CRITICAL',
            fallbackRiskScore: 100,
            reason: `Blacklisted entity detected: ${match.entity_type} = ${match.entity_value}`,
            details: match
          }));
        }
      }

      /**
       * 2. WALLET RISK PROFILE CHECK
       */
      const walletRisk = await this.checkWalletRisk(fromWalletAddress);

      if (walletRisk) {
        if (walletRisk.risk_level === 'BLOCKED') {
          matchedRules.push(this.buildMatchedRule({
            rule: ruleMap.BLOCKED_RISK_WALLET,
            fallbackRuleCode: 'BLOCKED_RISK_WALLET',
            fallbackRuleType: 'WALLET_RISK',
            fallbackAction: 'BLOCK',
            fallbackSeverity: 'CRITICAL',
            fallbackRiskScore: 100,
            reason: 'Wallet AML risk level is BLOCKED',
            details: walletRisk
          }));
        } else if (['HIGH', 'CRITICAL'].includes(walletRisk.risk_level)) {
          matchedRules.push(this.buildMatchedRule({
            rule: ruleMap.HIGH_RISK_WALLET,
            fallbackRuleCode: 'HIGH_RISK_WALLET',
            fallbackRuleType: 'WALLET_RISK',
            fallbackAction: 'REVIEW',
            fallbackSeverity: 'HIGH',
            fallbackRiskScore: 80,
            reason: `Wallet AML risk level is ${walletRisk.risk_level}`,
            details: walletRisk
          }));
        }
      }

      /**
       * 3. AMOUNT RULES
       */
      if (amount > 50000) {
        matchedRules.push(this.buildMatchedRule({
          rule: ruleMap.VERY_HIGH_VALUE_TXN,
          fallbackRuleCode: 'VERY_HIGH_VALUE_TXN',
          fallbackRuleType: 'AMOUNT',
          fallbackAction: 'BLOCK',
          fallbackSeverity: 'CRITICAL',
          fallbackRiskScore: 95,
          reason: 'Transaction amount exceeds 50,000',
          details: { amount, threshold: 50000 }
        }));
      } else if (amount > 10000) {
        matchedRules.push(this.buildMatchedRule({
          rule: ruleMap.HIGH_VALUE_TXN,
          fallbackRuleCode: 'HIGH_VALUE_TXN',
          fallbackRuleType: 'AMOUNT',
          fallbackAction: 'REVIEW',
          fallbackSeverity: 'HIGH',
          fallbackRiskScore: 60,
          reason: 'Transaction amount exceeds 10,000',
          details: { amount, threshold: 10000 }
        }));
      }

      /**
       * 4. HIGH FREQUENCY 1H
       */
      const txnCount1h = await this.countWalletTransactions({
        walletAddress: fromWalletAddress,
        minutes: 60
      });

      if (txnCount1h > 10) {
        matchedRules.push(this.buildMatchedRule({
          rule: ruleMap.HIGH_FREQ_1H,
          fallbackRuleCode: 'HIGH_FREQ_1H',
          fallbackRuleType: 'FREQUENCY',
          fallbackAction: 'REVIEW',
          fallbackSeverity: 'HIGH',
          fallbackRiskScore: 70,
          reason: 'More than 10 transactions in the last 1 hour',
          details: { transactionCount: txnCount1h, thresholdCount: 10, windowMinutes: 60 }
        }));
      }

      /**
       * 5. HIGH FREQUENCY 24H
       */
      const txnCount24h = await this.countWalletTransactions({
        walletAddress: fromWalletAddress,
        minutes: 1440
      });

      if (txnCount24h > 50) {
        matchedRules.push(this.buildMatchedRule({
          rule: ruleMap.HIGH_FREQ_24H,
          fallbackRuleCode: 'HIGH_FREQ_24H',
          fallbackRuleType: 'FREQUENCY',
          fallbackAction: 'REVIEW',
          fallbackSeverity: 'HIGH',
          fallbackRiskScore: 75,
          reason: 'More than 50 transactions in the last 24 hours',
          details: { transactionCount: txnCount24h, thresholdCount: 50, windowMinutes: 1440 }
        }));
      }

      /**
       * 6. STRUCTURING / SMURFING 24H
       */
      const structuring = await this.checkStructuring({
        walletAddress: fromWalletAddress,
        minutes: 1440,
        smallTxnLimit: 1000
      });

      if (structuring.small_txn_count > 10 && Number(structuring.total_small_amount) > 10000) {
        matchedRules.push(this.buildMatchedRule({
          rule: ruleMap.STRUCTURING_24H,
          fallbackRuleCode: 'STRUCTURING_24H',
          fallbackRuleType: 'STRUCTURING',
          fallbackAction: 'REVIEW',
          fallbackSeverity: 'CRITICAL',
          fallbackRiskScore: 90,
          reason: 'Possible structuring detected: many small transactions within 24 hours',
          details: {
            smallTransactionCount: structuring.small_txn_count,
            totalSmallAmount: structuring.total_small_amount,
            countThreshold: 10,
            amountThreshold: 10000
          }
        }));
      }

      /**
       * 7. DAILY AMOUNT LIMIT
       */
      const dailyOutgoingAmount = await this.sumWalletOutgoingAmount({
        walletAddress: fromWalletAddress,
        minutes: 1440
      });

      if (Number(dailyOutgoingAmount) > 20000) {
        matchedRules.push(this.buildMatchedRule({
          rule: ruleMap.DAILY_AMOUNT_LIMIT,
          fallbackRuleCode: 'DAILY_AMOUNT_LIMIT',
          fallbackRuleType: 'AMOUNT',
          fallbackAction: 'REVIEW',
          fallbackSeverity: 'HIGH',
          fallbackRiskScore: 70,
          reason: 'Daily outgoing wallet amount exceeds 20,000',
          details: {
            totalOutgoingAmount: dailyOutgoingAmount,
            thresholdAmount: 20000,
            windowMinutes: 1440
          }
        }));
      }

      /**
       * 8. MONTHLY AMOUNT LIMIT
       */
      const monthlyOutgoingAmount = await this.sumWalletOutgoingAmount({
        walletAddress: fromWalletAddress,
        minutes: 43200
      });

      if (Number(monthlyOutgoingAmount) > 100000) {
        matchedRules.push(this.buildMatchedRule({
          rule: ruleMap.MONTHLY_AMOUNT_LIMIT,
          fallbackRuleCode: 'MONTHLY_AMOUNT_LIMIT',
          fallbackRuleType: 'AMOUNT',
          fallbackAction: 'REVIEW',
          fallbackSeverity: 'HIGH',
          fallbackRiskScore: 80,
          reason: 'Monthly outgoing wallet amount exceeds 100,000',
          details: {
            totalOutgoingAmount: monthlyOutgoingAmount,
            thresholdAmount: 100000,
            windowMinutes: 43200
          }
        }));
      }

      /**
       * 9. REPEATED SAME RECEIVER 24H
       */
      if (toWalletAddress) {
        const repeatedSameReceiverCount = await this.countRepeatedReceiverTransactions({
          fromWalletAddress,
          toWalletAddress,
          minutes: 1440
        });

        if (repeatedSameReceiverCount > 15) {
          matchedRules.push(this.buildMatchedRule({
            rule: ruleMap.REPEATED_SAME_RECEIVER_24H,
            fallbackRuleCode: 'REPEATED_SAME_RECEIVER_24H',
            fallbackRuleType: 'FREQUENCY',
            fallbackAction: 'REVIEW',
            fallbackSeverity: 'MEDIUM',
            fallbackRiskScore: 55,
            reason: 'More than 15 transfers to same receiver within 24 hours',
            details: {
              transactionCount: repeatedSameReceiverCount,
              thresholdCount: 15,
              windowMinutes: 1440
            }
          }));
        }
      }

      /**
       * 10. FINAL DECISION
       */
      finalDecision = this.calculateFinalDecision(matchedRules);
      finalRiskScore = this.calculateFinalRiskScore(matchedRules);

      const finishedAt = new Date();

      /**
       * 11. INSERT EXECUTION LOG
       */
      const executionLog = await this.insertExecutionLog({
        requestId,
        transactionId: payload.transactionId || null,
        walletAddress: fromWalletAddress,
        counterpartyWalletAddress: toWalletAddress,
        customerId,
        counterpartyCustomerId,
        transactionType,
        transactionAmount: amount,
        currencyCode,
        rulesChecked: activeRules.length,
        matchedRules: matchedRules.length,
        finalDecision,
        finalRiskScore,
        executionDetails: {
          input: {
            requestId,
            fromWalletAddress,
            toWalletAddress,
            customerId,
            counterpartyCustomerId,
            organizationId,
            organizationCode,
            organizationName,
            transactionType,
            amount,
            currencyCode
          },
          matchedRules
        },
        executionStartedAt: startedAt,
        executionFinishedAt: finishedAt
      });

      /**
       * 12. INSERT ALERTS FOR REVIEW/BLOCK
       */
      let alertIds = [];

      if (['REVIEW', 'BLOCK'].includes(finalDecision) && matchedRules.length > 0) {
        alertIds = await this.createAlerts({
          transactionId: payload.transactionId || null,
          requestId,
          walletAddress: fromWalletAddress,
          counterpartyWalletAddress: toWalletAddress,
          customerId,
          counterpartyCustomerId,
          organizationId,
          organizationCode,
          organizationName,
          transactionAmount: amount,
          currencyCode,
          transactionType,
          matchedRules
        });
      }

      return {
        success: true,
        requestId,
        decision: finalDecision,
        riskScore: finalRiskScore,
        matchedRules,
        alertIds,
        executionLogId: executionLog?.log_id || null,
        amlProofHash: this.generateAmlProofHash({
          requestId,
          fromWalletAddress,
          toWalletAddress,
          customerId,
          amount,
          currencyCode,
          finalDecision,
          finalRiskScore,
          matchedRules
        })
      };
    } catch (error) {
      const finishedAt = new Date();

      await this.safeInsertExecutionErrorLog({
        requestId,
        walletAddress: fromWalletAddress,
        counterpartyWalletAddress: toWalletAddress,
        customerId,
        counterpartyCustomerId,
        transactionType,
        transactionAmount: amount,
        currencyCode,
        error,
        startedAt,
        finishedAt
      });

      throw error;
    }
  }

  /**
   * Load active AML rules
   */
  async getActiveRules() {
    const result = await db.query(
      `
      SELECT
        rule_id,
        rule_code,
        rule_name,
        rule_type,
        description,
        threshold_amount,
        threshold_count,
        time_window_minutes,
        risk_action,
        severity,
        risk_score,
        is_active
      FROM blockchain.aml_rules
      WHERE is_active = TRUE
      ORDER BY rule_code
      `
    );

    return result.rows;
  }

  /**
   * Check blacklist table
   */
  async checkBlacklist({
    fromWalletAddress,
    toWalletAddress,
    customerId,
    counterpartyCustomerId,
    organizationId,
    organizationCode
  }) {
    const values = [
      fromWalletAddress,
      toWalletAddress,
      customerId,
      counterpartyCustomerId,
      organizationId,
      organizationCode
    ];

    const result = await db.query(
      `
      SELECT
        blacklist_id,
        entity_type,
        entity_value,
        reason,
        source_system,
        status,
        created_at
      FROM blockchain.aml_blacklist
      WHERE status = 'ACTIVE'
      AND (
          (entity_type = 'WALLET' AND entity_value IN ($1, $2))
          OR (entity_type = 'CUSTOMER' AND entity_value IN ($3, $4))
          OR (entity_type = 'ORGANIZATION' AND entity_value IN ($5::text, $6))
      )
      `,
      values
    );

    return result.rows;
  }

  /**
   * Get wallet risk profile
   */
  async checkWalletRisk(walletAddress) {
    if (!walletAddress) return null;

    const result = await db.query(
      `
      SELECT
        wallet_address,
        customer_id,
        risk_level,
        risk_score,
        country_code,
        occupation_code,
        source_of_funds_code,
        is_pep,
        is_sanctioned,
        is_blacklisted,
        last_transaction_at,
        last_review_date,
        notes
      FROM blockchain.aml_wallet_risk_profiles
      WHERE wallet_address = $1
      LIMIT 1
      `,
      [walletAddress]
    );

    return result.rows[0] || null;
  }

  /**
   * Count outgoing wallet transactions in time window
   */
  async countWalletTransactions({ walletAddress, minutes }) {
    if (!walletAddress) return 0;

    const result = await db.query(
      `
      SELECT COUNT(*)::int AS txn_count
      FROM blockchain.transactions
      WHERE from_wallet_address = $1
      AND created_at >= NOW() - ($2::int * INTERVAL '1 minute')
      `,
      [walletAddress, minutes]
    );

    return Number(result.rows[0]?.txn_count || 0);
  }

  /**
   * Count repeated transactions to same receiver
   */
  async countRepeatedReceiverTransactions({
    fromWalletAddress,
    toWalletAddress,
    minutes
  }) {
    if (!fromWalletAddress || !toWalletAddress) return 0;

    const result = await db.query(
      `
      SELECT COUNT(*)::int AS txn_count
      FROM blockchain.transactions
      WHERE from_wallet_address = $1
      AND to_wallet_address = $2
      AND created_at >= NOW() - ($3::int * INTERVAL '1 minute')
      `,
      [fromWalletAddress, toWalletAddress, minutes]
    );

    return Number(result.rows[0]?.txn_count || 0);
  }

  /**
   * Check structuring/smurfing behavior
   */
  async checkStructuring({ walletAddress, minutes, smallTxnLimit }) {
    if (!walletAddress) {
      return {
        small_txn_count: 0,
        total_small_amount: 0
      };
    }

    const result = await db.query(
      `
      SELECT
        COUNT(*)::int AS small_txn_count,
        COALESCE(SUM(amount), 0)::numeric AS total_small_amount
      FROM blockchain.transactions
      WHERE from_wallet_address = $1
      AND amount < $2
      AND created_at >= NOW() - ($3::int * INTERVAL '1 minute')
      `,
      [walletAddress, smallTxnLimit, minutes]
    );

    return {
      small_txn_count: Number(result.rows[0]?.small_txn_count || 0),
      total_small_amount: Number(result.rows[0]?.total_small_amount || 0)
    };
  }

  /**
   * Sum outgoing amount for wallet in time window
   */
  async sumWalletOutgoingAmount({ walletAddress, minutes }) {
    if (!walletAddress) return 0;

    const result = await db.query(
      `
      SELECT COALESCE(SUM(amount), 0)::numeric AS total_amount
      FROM blockchain.transactions
      WHERE from_wallet_address = $1
      AND created_at >= NOW() - ($2::int * INTERVAL '1 minute')
      `,
      [walletAddress, minutes]
    );

    return Number(result.rows[0]?.total_amount || 0);
  }

  /**
   * Insert AML execution log
   */
  async insertExecutionLog({
    requestId,
    transactionId,
    walletAddress,
    counterpartyWalletAddress,
    customerId,
    counterpartyCustomerId,
    transactionType,
    transactionAmount,
    currencyCode,
    rulesChecked,
    matchedRules,
    finalDecision,
    finalRiskScore,
    executionDetails,
    executionStartedAt,
    executionFinishedAt
  }) {
    const result = await db.query(
      `
      INSERT INTO blockchain.aml_rule_execution_logs
      (
        request_id,
        transaction_id,
        wallet_address,
        counterparty_wallet_address,
        customer_id,
        counterparty_customer_id,
        transaction_type,
        transaction_amount,
        currency_code,
        rules_checked,
        matched_rules,
        final_decision,
        final_risk_score,
        execution_details,
        execution_started_at,
        execution_finished_at
      )
      VALUES
      (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16
      )
      RETURNING log_id
      `,
      [
        requestId,
        transactionId,
        walletAddress,
        counterpartyWalletAddress,
        customerId,
        counterpartyCustomerId,
        transactionType,
        transactionAmount,
        currencyCode,
        rulesChecked,
        matchedRules,
        finalDecision,
        finalRiskScore,
        JSON.stringify(executionDetails),
        executionStartedAt,
        executionFinishedAt
      ]
    );

    return result.rows[0];
  }

  /**
   * Insert AML alerts
   */
  async createAlerts({
    transactionId,
    requestId,
    walletAddress,
    counterpartyWalletAddress,
    customerId,
    counterpartyCustomerId,
    organizationId,
    organizationCode,
    organizationName,
    transactionAmount,
    currencyCode,
    transactionType,
    matchedRules
  }) {
    const alertIds = [];

    for (const rule of matchedRules) {
      const result = await db.query(
        `
        INSERT INTO blockchain.aml_alerts
        (
          transaction_id,
          request_id,
          wallet_address,
          counterparty_wallet_address,
          customer_id,
          counterparty_customer_id,
          organization_id,
          organization_code,
          organization_name,
          rule_id,
          rule_code,
          alert_status,
          risk_action,
          severity,
          risk_score,
          transaction_amount,
          currency_code,
          transaction_type,
          reason,
          alert_details
        )
        VALUES
        (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, 'OPEN', $12, $13, $14,
          $15, $16, $17, $18, $19
        )
        RETURNING alert_id
        `,
        [
          transactionId,
          requestId,
          walletAddress,
          counterpartyWalletAddress,
          customerId,
          counterpartyCustomerId,
          organizationId,
          organizationCode,
          organizationName,
          rule.ruleId || null,
          rule.ruleCode,
          rule.action,
          rule.severity,
          rule.riskScore,
          transactionAmount,
          currencyCode,
          transactionType,
          rule.reason,
          JSON.stringify(rule)
        ]
      );

      alertIds.push(result.rows[0].alert_id);
    }

    return alertIds;
  }

  /**
   * Insert execution error log safely
   */
  async safeInsertExecutionErrorLog({
    requestId,
    walletAddress,
    counterpartyWalletAddress,
    customerId,
    counterpartyCustomerId,
    transactionType,
    transactionAmount,
    currencyCode,
    error,
    startedAt,
    finishedAt
  }) {
    try {
      await db.query(
        `
        INSERT INTO blockchain.aml_rule_execution_logs
        (
          request_id,
          wallet_address,
          counterparty_wallet_address,
          customer_id,
          counterparty_customer_id,
          transaction_type,
          transaction_amount,
          currency_code,
          rules_checked,
          matched_rules,
          final_decision,
          final_risk_score,
          execution_details,
          execution_started_at,
          execution_finished_at
        )
        VALUES
        (
          $1, $2, $3, $4, $5,
          $6, $7, $8, 0, 0,
          'BLOCK', 100, $9, $10, $11
        )
        `,
        [
          requestId,
          walletAddress,
          counterpartyWalletAddress,
          customerId,
          counterpartyCustomerId,
          transactionType,
          transactionAmount,
          currencyCode,
          JSON.stringify({
            error: true,
            message: error.message,
            stack: error.stack
          }),
          startedAt,
          finishedAt
        ]
      );
    } catch (logError) {
      console.error('Failed to insert AML error log:', logError.message);
    }
  }

  /**
   * Build matched rule object
   */
  buildMatchedRule({
    rule,
    fallbackRuleCode,
    fallbackRuleType,
    fallbackAction,
    fallbackSeverity,
    fallbackRiskScore,
    reason,
    details
  }) {
    return {
      ruleId: rule?.rule_id || null,
      ruleCode: rule?.rule_code || fallbackRuleCode,
      ruleName: rule?.rule_name || fallbackRuleCode,
      ruleType: rule?.rule_type || fallbackRuleType,
      action: rule?.risk_action || fallbackAction,
      severity: rule?.severity || fallbackSeverity,
      riskScore: Number(rule?.risk_score || fallbackRiskScore || 0),
      reason,
      details: details || {}
    };
  }

  /**
   * Calculate final AML decision
   */
  calculateFinalDecision(matchedRules) {
    const hasBlock = matchedRules.some((rule) => rule.action === 'BLOCK');
    if (hasBlock) return 'BLOCK';

    const hasReview = matchedRules.some((rule) => rule.action === 'REVIEW');
    if (hasReview) return 'REVIEW';

    return 'ALLOW';
  }

  /**
   * Calculate final risk score
   */
  calculateFinalRiskScore(matchedRules) {
    if (!matchedRules || matchedRules.length === 0) return 0;

    const maxScore = Math.max(
      ...matchedRules.map((rule) => Number(rule.riskScore || 0))
    );

    return Math.min(maxScore, 100);
  }

  /**
   * Generate AML proof hash for later Fabric storage
   */
  generateAmlProofHash(payload) {
    const normalizedPayload = JSON.stringify(payload, Object.keys(payload).sort());

    return crypto
      .createHash('sha256')
      .update(normalizedPayload)
      .digest('hex');
  }

  /**
   * Generate request ID
   */
  generateRequestId() {
    return `AML-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  }
}

module.exports = new AmlService();
