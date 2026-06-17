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



router.get("/daily-created", async (req, res) => {
  try {
    const month = String(req.query.month || new Date().toISOString().slice(0, 7));

    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({
        success: false,
        message: "Invalid month format. Expected YYYY-MM.",
        data: null
      });
    }

    const startDate = `${month}-01`;
    const nextMonthResult = await pool.query(
      `SELECT ($1::date + INTERVAL '1 month')::date AS next_month`,
      [startDate]
    );
    const nextMonth = nextMonthResult.rows[0].next_month;

    const summaryResult = await pool.query(
      `
      SELECT
        COUNT(*)::int AS total_transactions_created,
        COUNT(*) FILTER (WHERE blockchain_status = 'SUCCESS')::int AS confirmed_transactions,
        COUNT(*) FILTER (WHERE blockchain_status = 'FAILED')::int AS failed_transactions,
        COUNT(*) FILTER (WHERE blockchain_status = 'PENDING')::int AS pending_transactions
      FROM blockchain.dev_transactions
      WHERE created_at >= $1::date
        AND created_at < $2::date
      `,
      [startDate, nextMonth]
    );

    const dailyResult = await pool.query(
      `
      WITH days AS (
        SELECT generate_series(
          $1::date,
          ($2::date - INTERVAL '1 day')::date,
          INTERVAL '1 day'
        )::date AS transaction_date
      ),
      daily_counts AS (
        SELECT
          created_at::date AS transaction_date,
          COUNT(*)::int AS total_transactions_created,
          COUNT(*) FILTER (WHERE blockchain_status = 'SUCCESS')::int AS confirmed_transactions,
          COUNT(*) FILTER (WHERE blockchain_status = 'FAILED')::int AS failed_transactions,
          COUNT(*) FILTER (WHERE blockchain_status = 'PENDING')::int AS pending_transactions
        FROM blockchain.dev_transactions
        WHERE created_at >= $1::date
          AND created_at < $2::date
        GROUP BY created_at::date
      )
      SELECT
        days.transaction_date::text AS transaction_date,
        COALESCE(daily_counts.total_transactions_created, 0)::int AS total_transactions_created,
        COALESCE(daily_counts.confirmed_transactions, 0)::int AS confirmed_transactions,
        COALESCE(daily_counts.failed_transactions, 0)::int AS failed_transactions,
        COALESCE(daily_counts.pending_transactions, 0)::int AS pending_transactions
      FROM days
      LEFT JOIN daily_counts
        ON daily_counts.transaction_date = days.transaction_date
      ORDER BY days.transaction_date ASC
      `,
      [startDate, nextMonth]
    );

    return res.json({
      success: true,
      message: "Transactions daily created report loaded successfully",
      data: {
        month,
        summary: summaryResult.rows[0] || {
          total_transactions_created: 0,
          confirmed_transactions: 0,
          failed_transactions: 0,
          pending_transactions: 0
        },
        daily: dailyResult.rows
      }
    });
  } catch (error) {
    console.error("[DEV_TRANSACTIONS_DAILY_CREATED_FAILED]", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load transactions daily created report",
      error: error.message
    });
  }
});


router.get("/", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const page = Math.max(Number(req.query.page || 1), 1);
    const offset = (page - 1) * limit;

    const status = req.query.status || null;
    const search = req.query.search || null;

    const params = [];
    const where = [];

    if (status) {
      params.push(status);
      where.push(`blockchain_status = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      where.push(`(
        transaction_id ILIKE $${params.length}
        OR sender_name ILIKE $${params.length}
        OR receiver_name ILIKE $${params.length}
        OR phone_no ILIKE $${params.length}
      )`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM blockchain.dev_transactions ${whereSql}`,
      params
    );

    params.push(limit);
    params.push(offset);

    const dataResult = await pool.query(
      `
      SELECT
        id,
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
        blockchain_status,
        blockchain_tx_id,
        blockchain_response,
        raw_payload,
        created_at,
        updated_at
      FROM blockchain.dev_transactions
      ${whereSql}
      ORDER BY id DESC
      LIMIT $${params.length - 1}
      OFFSET $${params.length}
      `,
      params
    );

    return res.json({
      success: true,
      message: "Dev transactions loaded successfully from PostgreSQL",
      data: dataResult.rows,
      meta: {
        total: countResult.rows[0].total,
        page,
        limit,
        pages: Math.ceil(countResult.rows[0].total / limit)
      }
    });
  } catch (error) {
    console.error("[DEV_TRANSACTIONS_GET_FAILED]", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load dev transactions",
      error: error.message
    });
  }
});

router.get("/:transactionId", async (req, res) => {
  try {
    const { transactionId } = req.params;

    const result = await pool.query(
      `
      SELECT *
      FROM blockchain.dev_transactions
      WHERE transaction_id = $1
      LIMIT 1
      `,
      [transactionId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Dev transaction not found",
        data: null
      });
    }

    return res.json({
      success: true,
      message: "Dev transaction loaded successfully",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("[DEV_TRANSACTION_GET_BY_ID_FAILED]", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load dev transaction",
      error: error.message
    });
  }
});


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