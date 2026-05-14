curl -X POST "http://127.0.0.1:3001/api/v1/wallets" \
  -H "Content-Type: application/json" \
  -H "x-api-key: 20bd6a16f56de09bba960ebf3994fc2354c0a3f91fb2bd5743ad82cdeece29b5ff69cea9b3c85f56c187abc46de4491a" \
  -H "x-request-id: REQ_CREATE_WALLET_B_3273944211" \
  -H "x-correlation-id: CORR_CREATE_WALLET_B_3273944211" \
  -H "x-source-system: BLOCKCHAIN_TEST_UI" \
  -H "x-request-source: BLOCKCHAIN_TEST_UI" \
  -d '{
    "customerId": "3273944215",
    "organizationType": "INTERNATIONAL_ORGANIZATION",
    "organizationId": "5c4beb22-cfcd-4473-9966-3e8ddcd7a304",
    "organizationCode": "149",
    "organizationName": "UNDP Lebanon",
    "fullName": "NADINE KHOURY",
    "initialBalance": 5000,
    "currencyCode": "USD",
    "mobileHash": "79170430",
    "emailHash": "NADINE@KHOURY.COM",
    "countryName": 'Lebanon',
  }'
"nationalIdHash":null,"mobileHash":null,"emailHash":null,
"countryName":null
curl -X POST "http://127.0.0.1:3001/api/v1/wallets/login" \
  -H "Content-Type: application/json" \
  -H "x-api-key: 20bd6a16f56de09bba960ebf3994fc2354c0a3f91fb2bd5743ad82cdeece29b5ff69cea9b3c85f56c187abc46de4491a" \
  -H "x-request-id: REQ_LOGIN_WALLET_B_BY_ADDRESS_WITH_PASSWORD" \
  -H "x-correlation-id: CORR_LOGIN_WALLET_B_BY_ADDRESS_WITH_PASSWORD" \
  -H "x-source-system: BLOCKCHAIN_TEST_UI" \
  -H "x-request-source: BLOCKCHAIN_TEST_UI" \
  -d '{
    "walletAddress": "WALLET_FAD21DF49311065CC6D54CF734585ECCC8338536",
    "password": "Wallet@4c17f00d7880"
  }'

STEP 3 — Check Wallet A Details
curl -X GET "http://127.0.0.1:3001/api/v1/wallets/WALLET_46AD0A85E42B21C242BE48EFA616621C0F26840B" \
  -H "Content-Type: application/json" \
  -H "x-api-key: 20bd6a16f56de09bba960ebf3994fc2354c0a3f91fb2bd5743ad82cdeece29b5ff69cea9b3c85f56c187abc46de4491a" \
  -H "x-request-id: REQ_DETAILS_WALLET_A" \
  -H "x-correlation-id: CORR_DETAILS_WALLET_A" \
  -H "x-source-system: BLOCKCHAIN_TEST_UI" \
  -H "x-request-source: BLOCKCHAIN_TEST_UI"