const db = require('../config/database');

class AmlService {
  async evaluateTransaction({
    requestId,
    fromWalletAddress,
    toWalletAddress,
    customerId,
    amount,
    currencyCode,
    transactionType
  }) {
    const matchedRules = [];
    let finalDecision = 'ALLOW';

    const numericAmount = Number(amount);

    // 1. Check blacklist
    const blacklistResult = await db.query(
      `
      SELECT *
      FROM blockchain.aml_blacklist
      WHERE status = 'ACTIVE'
      AND (
        (entity_type = 'WALLET' AND entity_value IN ($1, $2))
        OR (entity_type = 'CUSTOMER' AND entity_value = $3)
      )
      LIMIT 1
      `,
      [fromWalletAddress, toWalletAddress, customerId]
    );

    if (blacklistResult.rows.length > 0) {
      matchedRules.push({
        ruleCode: 'BLOCKED_WALLET',
        action: 'BLOCK',
        severity: 'CRITICAL',
        reason: 'Wallet or customer is blacklisted'
      });

      finalDecision = 'BLOCK';
    }

    // 2. High amount rule
    if (numericAmount > 50000) {
      matchedRules.push({
        ruleCode: 'VERY_HIGH_VALUE_TXN',
        action: 'BLOCK',
        severity: 'CRITICAL',
        reason: 'Transaction amount exceeds 50,000'
      });

      finalDecision = 'BLOCK';
    } else if (numericAmount > 10000) {
      matchedRules.push({
        ruleCode: 'HIGH_VALUE_TXN',
        action: 'REVIEW',
        severity: 'HIGH',
        reason: 'Transaction amount exceeds 10,000'
      });

      if (finalDecision !== 'BLOCK') {
        finalDecision = 'REVIEW';
      }
    }

    // 3. Frequency rule - last 1 hour
    const frequencyResult = await db.query(
      `
      SELECT COUNT(*)::int AS txn_count
      FROM blockchain.transactions
      WHERE from_wallet_address = $1
      AND created_at >= NOW() - INTERVAL '1 hour'
      `,
      [fromWalletAddress]
    );

    const txnCount1h = frequencyResult.rows[0]?.txn_count || 0;

    if (txnCount1h > 10) {
      matchedRules.push({
        ruleCode: 'HIGH_FREQ_1H',
        action: 'REVIEW',
        severity: 'HIGH',
        reason: 'More than 10 transactions in the last hour'
      });

      if (finalDecision !== 'BLOCK') {
        finalDecision = 'REVIEW';
      }
    }

    // 4. Structuring rule - many small transactions
    const structuringResult = await db.query(
      `
      SELECT 
        COUNT(*)::int AS small_txn_count,
        COALESCE(SUM(amount), 0)::numeric AS total_small_amount
      FROM blockchain.transactions
      WHERE from_wallet_address = $1
      AND amount < 1000
      AND created_at >= NOW() - INTERVAL '24 hours'
      `,
      [fromWalletAddress]
    );

    const smallTxnCount = Number(structuringResult.rows[0]?.small_txn_count || 0);
    const totalSmallAmount = Number(structuringResult.rows[0]?.total_small_amount || 0);

    if (smallTxnCount > 10 && totalSmallAmount > 10000) {
      matchedRules.push({
        ruleCode: 'STRUCTURING_24H',
        action: 'REVIEW',
        severity: 'CRITICAL',
        reason: 'Possible structuring detected from many small transactions'
      });

      if (finalDecision !== 'BLOCK') {
        finalDecision = 'REVIEW';
      }
    }

    // 5. Insert AML execution log
    await db.query(
      `
      INSERT INTO blockchain.aml_rule_execution_logs
      (
        request_id,
        wallet_address,
        transaction_amount,
        rules_checked,
        matched_rules,
        final_decision,
        execution_details
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        requestId,
        fromWalletAddress,
        numericAmount,
        4,
        matchedRules.length,
        finalDecision,
        JSON.stringify(matchedRules)
      ]
    );

    return {
      decision: finalDecision,
      matchedRules
    };
  }

  async createAlerts({
    transactionId,
    walletAddress,
    customerId,
    matchedRules
  }) {
    for (const rule of matchedRules) {
      await db.query(
        `
        INSERT INTO blockchain.aml_alerts
        (
          transaction_id,
          wallet_address,
          customer_id,
          rule_code,
          risk_action,
          severity,
          reason
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          transactionId,
          walletAddress,
          customerId,
          rule.ruleCode,
          rule.action,
          rule.severity,
          rule.reason
        ]
      );
    }
  }
}

module.exports = new AmlService();