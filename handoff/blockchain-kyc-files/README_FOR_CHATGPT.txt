Goal:
Update the new Blockchain KYC flow so it reuses the old Wallet Create flow.

Old Wallet Create saves into:
1. SDEDBA.CFG_CUSTOMER
2. SDEDBA.REF_CUSTOMER
3. BLOCKCHAIN.WALLETS
4. Hyperledger Fabric wallet ledger record

New Blockchain KYC currently saves only into:
blockchain.blockchain_kyc_wallet_requests

Required:
Make the new POST /api/v1/kyc/blockchain-wallet create the full customer + wallet + Fabric ledger record, same as old wallet create screen.

Please inspect:
- backend wallet route/controller/service/repository
- Fabric service
- database table structures
- current Blockchain KYC route/controller/service
- frontend Blockchain KYC component
- old Wallet Create component
