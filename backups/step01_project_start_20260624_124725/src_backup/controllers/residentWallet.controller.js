const pool = require('../config/postgres');

const getResidentWallets = async (req, res, next) => {
  try {
    const {
      walletAddress = null,
      residentId = null,
      residentName = null,
      walletStatus = null,
      blockchainStatus = null,
    } = req.query;

    const sql = `
      SELECT
          r.wallet_address,
          r.resident_id,
          CONCAT_WS(' ', r.first_name, r.father_name, r.last_name) AS resident_name,
          r.wallet_currency,
          COALESCE(r.monthly_income, 0) AS current_balance,
          r.wallet_status,
          CASE
              WHEN r.blockchain_status IS NOT NULL THEN 'synced'
              ELSE 'pending'
          END AS blockchain_status,
          r.created_at
      FROM blockchain.residents r
      WHERE 1 = 1
        AND (
              $1::text IS NULL
              OR UPPER(r.wallet_address) LIKE UPPER('%' || $1 || '%')
            )
        AND (
              $2::text IS NULL
              OR UPPER(r.resident_id) LIKE UPPER('%' || $2 || '%')
            )
        AND (
              $3::text IS NULL
              OR UPPER(CONCAT_WS(' ', r.first_name, r.father_name, r.last_name)) LIKE UPPER('%' || $3 || '%')
            )
        AND (
              $4::text IS NULL
              OR UPPER(r.wallet_status) = UPPER($4)
            )
        AND (
              $5::text IS NULL
              OR UPPER(
                  CASE
                      WHEN r.blockchain_status IS NOT NULL THEN 'synced'
                      ELSE 'pending'
                  END
              ) = UPPER($5)
            )
      ORDER BY r.created_at DESC;
    `;

    const values = [
      walletAddress || null,
      residentId || null,
      residentName || null,
      walletStatus || null,
      blockchainStatus || null,
    ];

    const result = await pool.query(sql, values);

    const wallets = result.rows.map((row) => ({
      walletAddress: row.wallet_address,
      residentId: row.resident_id,
      residentName: row.resident_name,
      currency: row.wallet_currency,
      currentBalance: Number(row.current_balance),
      walletStatus: row.wallet_status,
      blockchainStatus: row.blockchain_status,
      createdAt: row.created_at,
    }));

    const summary = {
      totalWallets: wallets.length,
      activeWallets: wallets.filter(w => String(w.walletStatus).toLowerCase() === 'active').length,
      suspendedWallets: wallets.filter(w => String(w.walletStatus).toLowerCase() === 'suspended').length,
      blockedWallets: wallets.filter(w => String(w.walletStatus).toLowerCase() === 'blocked').length,
      blockchainSynced: wallets.filter(w => String(w.blockchainStatus).toLowerCase() === 'synced').length,
    };

    return res.status(200).json({
      success: true,
      message: 'Resident wallets loaded successfully',
      summary,
      data: wallets,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getResidentWallets,
};
