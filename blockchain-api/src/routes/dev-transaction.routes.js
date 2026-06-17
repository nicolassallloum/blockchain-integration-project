const express = require("express");
const router = express.Router();
const pool = require("../db/postgres");

// Replace this with your existing Fabric helper if already available
const fabricService = require("../services/fabric.service");

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
  let pgTransactionOpen = false;

  try {
    const body = req.body;

    await client.query("BEGIN");
    pgTransactionOpen = true;

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

    await client.query("COMMIT");
    pgTransactionOpen = false;

    const blockchainPayload = {
      transactionReference: generatedTransactionId,
      transaction_id: generatedTransactionId,

      residentId: body.id_number || body.phone_no || generatedTransactionId,
      residentWalletAddress: body.phone_no || null,
      residentFullName: body.SENDER_NAME || null,
      residentNationalId: body.id_number || null,

      serviceId: body.itm_id || null,
      serviceCode: body.transaction_type || null,
      serviceName: body.transaction_purpose_code || "DEV_MONEY_TRANSFER",

      amount: cleanNumber(body.TRANSACTION_AMNT),
      baseAmount: cleanNumber(body.AMOUNT_TO_SEND),
      fees: cleanNumber(body.FEES),
      amountToReceive: cleanNumber(body.amount_to_receive),
      currency: body.currency || "84",

      paymentMethod: "DEV_API",
      transactionType: body.transaction_type || "1501",
      transactionStatus: "CREATED_FROM_DEV",
      blockchainStatus: "PENDING",

      senderName: body.SENDER_NAME,
      senderFirstName: body.sender_first_name,
      senderLastName: body.sender_last_name,

      receiverName: body.RECEIVER_NAME,
      receiverFirstName: body.receiver_first_name,
      receiverLastName: body.receiver_last_name,

      payoutCountry: body.PAYOUT_COUNTRY,
      country: body.country,
      cityAddress: body.city_address,

      sourceOfFunds: body.source_of_funds,
      idType: body.id_type,
      idNumber: body.id_number,
      countryOfIssue: body.country_of_issue,
      phoneNo: body.phone_no,
      beneficiaryRightOwner: body.beneficiary_right_owner,

      venId: body.ven_id,
      itmId: body.itm_id,
      partyTypeCode: body.party_type_code,
      flag: body.flag,

      transactionDate: new Date().toISOString(),
      rawPayload: body
    };

    let blockchainResult = null;
    let blockchainErrorMessage = null;

    try {
      blockchainResult = await fabricService.submitTransaction(
        "CreateGovernmentTransaction",
        [
          JSON.stringify(blockchainPayload)
        ],
        {
          requestId: req.headers["x-request-id"] || null,
          sourceSystem: "DEV_TRANSACTION_API",
          requestSource: "API",
          createdBy: "DEV_INTEGRATION"
        }
      );

      const cleanBlockchainResponse = {
        success: true,
        type: blockchainResult?.type || "submit",
        channelName: blockchainResult?.channelName || null,
        chaincodeName: blockchainResult?.chaincodeName || null,
        functionName: blockchainResult?.functionName || "CreateGovernmentTransaction",
        transactionId: blockchainResult?.transactionId || blockchainResult?.txId || null,
        txId: blockchainResult?.txId || blockchainResult?.transactionId || null,
        durationMs: blockchainResult?.durationMs || null,
        data: blockchainResult?.data || null,
        commitStatus: blockchainResult?.commitStatus ? {
          successful: blockchainResult.commitStatus.successful,
          code: blockchainResult.commitStatus.code,
          transactionId: blockchainResult.commitStatus.transactionId
        } : null
      };

      console.log("[DEV_TRANSACTION_UPDATE_SUCCESS_START]", generatedTransactionId);

      await client.query(
        `
        UPDATE blockchain.dev_transactions
        SET
          blockchain_status = $1,
          blockchain_tx_id = $2,
          blockchain_response = $3::jsonb,
          updated_at = CURRENT_TIMESTAMP
        WHERE transaction_id = $4
        `,
        [
          "SUCCESS",
          cleanBlockchainResponse.transactionId,
          JSON.stringify(cleanBlockchainResponse),
          generatedTransactionId
        ]
      );

      console.log("[DEV_TRANSACTION_UPDATE_SUCCESS_DONE]", generatedTransactionId);
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

      blockchainErrorMessage = blockchainError.message;
      console.error("[DEV_TRANSACTION_BLOCKCHAIN_FAILED]", blockchainError.message);
    }

    return res.status(blockchainErrorMessage ? 202 : 201).json({
      success: !blockchainErrorMessage,
      message: blockchainErrorMessage ? "Transaction saved in PostgreSQL but Blockchain failed" : "Transaction created successfully in PostgreSQL and Blockchain",
      data: {
        transaction_id: generatedTransactionId,
        postgresql: savedTransaction,
        blockchain: blockchainResult ? {
          success: true,
          transactionId: blockchainResult.transactionId || blockchainResult.txId || null,
          txId: blockchainResult.txId || blockchainResult.transactionId || null,
          functionName: blockchainResult.functionName || "CreateGovernmentTransaction",
          data: blockchainResult.data || null
        } : null,
        blockchain_error: blockchainErrorMessage
      }
    });

  } catch (error) {
    if (pgTransactionOpen) {
      await client.query("ROLLBACK");
      pgTransactionOpen = false;
    }

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