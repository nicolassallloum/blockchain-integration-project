const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// Replace this with your existing Fabric helper if already available
const { submitTransactionToBlockchain } = require("../services/fabric.service");

function cleanNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  return Number(String(value).replace(/,/g, ""));
}

function cleanDate(value) {
  if (!value || value === "") return null;
  return value;
}

router.post("/create", async (req, res) => {
  const client = await pool.connect();

  try {
    const body = req.body;

    await client.query("BEGIN");

    const txIdResult = await client.query(`
      SELECT 'VB-TXN-' || LPAD(nextval('blockchain.dev_transaction_seq')::text, 6, '0') AS transaction_id
    `);

    const generatedTransactionId = txIdResult.rows[0].transaction_id;

    const insertResult = await client.query(
      `
      INSERT INTO blockchain.dev_transactions (
        transaction_id,

        sender_name,
        sender_first_name,
        sender_last_name,

        receiver_name,
        receiver_first_name,
        receiver_last_name,

        payout_country,
        country,
        city_address,

        amount_to_send,
        fees,
        transaction_amount,
        enter_total_amount,
        amount_to_receive,

        currency,
        transaction_type,
        transaction_purpose_code,
        source_of_funds,

        id_type,
        id_number,
        country_of_issue,
        issue_date,
        expiry_date,
        date_of_birth,

        phone_no,
        beneficiary_right_owner,

        ven_id,
        itm_id,
        party_type_code,

        occupation,
        company_name,
        vip_number,
        tax_id,

        media_path,
        promo_code,
        promo_code_validation,
        discounted_amount,

        method_log_id,
        casa,
        flag,

        dev_test_date,
        dev_test_2_date,
        transaction_date,

        raw_payload
      )
      VALUES (
        $1,

        $2, $3, $4,

        $5, $6, $7,

        $8, $9, $10,

        $11, $12, $13, $14, $15,

        $16, $17, $18, $19,

        $20, $21, $22, $23, $24, $25,

        $26, $27,

        $28, $29, $30,

        $31, $32, $33, $34,

        $35, $36, $37, $38,

        $39, $40, $41,

        $42, $43, $44,

        $45
      )
      RETURNING *
      `,
      [
        generatedTransactionId,

        body.SENDER_NAME,
        body.sender_first_name,
        body.sender_last_name,

        body.RECEIVER_NAME,
        body.receiver_first_name,
        body.receiver_last_name,

        body.PAYOUT_COUNTRY,
        body.country,
        body.city_address,

        cleanNumber(body.AMOUNT_TO_SEND),
        cleanNumber(body.FEES),
        cleanNumber(body.TRANSACTION_AMNT),
        cleanNumber(body.ENTER_TOTAL_AMOUNT),
        cleanNumber(body.amount_to_receive),

        body.currency,
        body.transaction_type,
        body.transaction_purpose_code,
        body.source_of_funds,

        body.id_type,
        body.id_number,
        body.country_of_issue,
        cleanDate(body.issue_date),
        cleanDate(body.expiry_date),
        cleanDate(body.date_of_birth),

        body.phone_no,
        body.beneficiary_right_owner,

        body.ven_id,
        body.itm_id,
        body.party_type_code,

        body.occupation,
        body.company_name,
        body.vip_number,
        body.tax_id,

        body.media_path,
        body.promo_code,
        body.promo_code_validation,
        cleanNumber(body.discounted_amount),

        body.method_log_id,
        body.casa,
        body.flag,

        cleanDate(body.test),
        cleanDate(body.TEST_2),
        cleanDate(body.transaction_date),

        body
      ]
    );

    const savedTransaction = insertResult.rows[0];

    const blockchainPayload = {
      transaction_id: generatedTransactionId,
      sender_name: body.SENDER_NAME,
      receiver_name: body.RECEIVER_NAME,
      payout_country: body.PAYOUT_COUNTRY,
      amount_to_send: cleanNumber(body.AMOUNT_TO_SEND),
      fees: cleanNumber(body.FEES),
      transaction_amount: cleanNumber(body.TRANSACTION_AMNT),
      amount_to_receive: cleanNumber(body.amount_to_receive),
      currency: body.currency,
      transaction_type: body.transaction_type,
      source_of_funds: body.source_of_funds,
      id_type: body.id_type,
      id_number: body.id_number,
      phone_no: body.phone_no,
      beneficiary_right_owner: body.beneficiary_right_owner,
      transaction_date: new Date().toISOString(),
      raw_payload: body
    };

    let blockchainResult = null;

    try {
      blockchainResult = await submitTransactionToBlockchain(
        "CreateDevTransaction",
        generatedTransactionId,
        JSON.stringify(blockchainPayload)
      );

      await client.query(
        `
        UPDATE blockchain.dev_transactions
        SET 
          blockchain_status = $1,
          blockchain_tx_id = $2,
          blockchain_response = $3,
          updated_at = CURRENT_TIMESTAMP
        WHERE transaction_id = $4
        `,
        [
          "SUCCESS",
          blockchainResult?.transactionId || null,
          blockchainResult,
          generatedTransactionId
        ]
      );
    } catch (blockchainError) {
      await client.query(
        `
        UPDATE blockchain.dev_transactions
        SET 
          blockchain_status = $1,
          blockchain_response = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE transaction_id = $3
        `,
        [
          "FAILED",
          {
            error: blockchainError.message
          },
          generatedTransactionId
        ]
      );

      throw blockchainError;
    }

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Transaction created successfully in PostgreSQL and Blockchain",
      data: {
        transaction_id: generatedTransactionId,
        postgresql: savedTransaction,
        blockchain: blockchainResult
      }
    });

  } catch (error) {
    await client.query("ROLLBACK");

    return res.status(500).json({
      success: false,
      message: "Failed to create transaction",
      error: error.message
    });

  } finally {
    client.release();
  }
});

module.exports = router;