#!/bin/bash

set -e

PROJECT_DIR="/home/nix/u01/blockchain-integration/chaincode/kyc-wallet-chaincode-js"

echo "Creating STEP 12 JavaScript Chaincode..."
mkdir -p "$PROJECT_DIR/lib"

cd "$PROJECT_DIR"

cat > package.json <<'PKG'
{
  "name": "kyc-wallet-chaincode-js",
  "version": "1.0.0",
  "description": "Hyperledger Fabric JavaScript chaincode for Blockchain Integration Project - KYC Wallet and Transactions",
  "main": "index.js",
  "scripts": {
    "start": "fabric-chaincode-node start",
    "test": "echo \"No test configured yet\" && exit 0"
  },
  "dependencies": {
    "fabric-contract-api": "^2.5.4",
    "fabric-shim": "^2.5.4"
  },
  "engines": {
    "node": ">=16.0.0"
  },
  "author": "Nix",
  "license": "UNLICENSED"
}
PKG

cat > index.js <<'IDX'
'use strict';

const KycWalletContract = require('./lib/kycWalletContract');

module.exports.contracts = [KycWalletContract];
IDX

cat > lib/kycWalletContract.js <<'CHAINCODE'
'use strict';

const { Contract } = require('fabric-contract-api');
const crypto = require('crypto');

class KycWalletContract extends Contract {

    constructor() {
        super('KycWalletContract');
    }

    async InitLedger(ctx) {
        const metadata = {
            docType: 'CHAINCODE_METADATA',
            project: 'Blockchain Integration Project',
            chaincodeName: 'kyc-wallet-chaincode-js',
            version: '1.0.0',
            initializedAt: this._getTxTimestamp(ctx),
            initializedByTxId: ctx.stub.getTxID()
        };

        await ctx.stub.putState('CHAINCODE_METADATA', Buffer.from(JSON.stringify(metadata)));

        return this._successResponse('Ledger initialized successfully', metadata);
    }

    async CreateWallet(ctx, customerId, organizationId, fullName, nationalIdHash, mobileHash, emailHash, passwordHash, initialBalance) {
        this._required(customerId, 'customerId');
        this._required(organizationId, 'organizationId');
        this._required(fullName, 'fullName');
        this._required(passwordHash, 'passwordHash');

        const parsedInitialBalance = this._parseAmount(initialBalance, 'initialBalance');

        if (parsedInitialBalance < 0) {
            throw new Error('Initial balance cannot be negative');
        }

        const existingWalletByCustomer = await this._getWalletByCustomerId(ctx, customerId);

        if (existingWalletByCustomer) {
            throw new Error(`Wallet already exists for customerId: ${customerId}`);
        }

        const txId = ctx.stub.getTxID();
        const createdAt = this._getTxTimestamp(ctx);
        const walletAddress = this._generateWalletAddress(customerId, organizationId, txId);

        const wallet = {
            docType: 'WALLET',
            walletAddress,
            customerId,
            organizationId,
            fullName,
            nationalIdHash: nationalIdHash || null,
            mobileHash: mobileHash || null,
            emailHash: emailHash || null,
            passwordHash,
            balance: parsedInitialBalance,
            currency: 'TOKEN',
            status: 'ACTIVE',
            createdAt,
            updatedAt: createdAt,
            createdTxId: txId,
            updatedTxId: txId
        };

        await ctx.stub.putState(this._walletKey(walletAddress), Buffer.from(JSON.stringify(wallet)));

        const transaction = {
            docType: 'TRANSACTION',
            transactionId: txId,
            transactionType: 'WALLET_CREATED',
            fromWallet: null,
            toWallet: walletAddress,
            organizationId,
            amount: parsedInitialBalance,
            currency: 'TOKEN',
            status: 'SUCCESS',
            riskLevel: 'LOW',
            description: 'Wallet created',
            createdAt,
            createdTxId: txId
        };

        await ctx.stub.putState(this._transactionKey(txId), Buffer.from(JSON.stringify(transaction)));

        return this._successResponse('Wallet created successfully', {
            wallet: this._removeSensitiveWalletFields(wallet),
            transaction
        });
    }

    async LoginWallet(ctx, walletAddress, passwordHash) {
        this._required(walletAddress, 'walletAddress');
        this._required(passwordHash, 'passwordHash');

        const wallet = await this._getWalletByAddress(ctx, walletAddress);

        if (!wallet) {
            throw new Error(`Wallet not found: ${walletAddress}`);
        }

        if (wallet.status !== 'ACTIVE') {
            throw new Error(`Wallet is not active. Current status: ${wallet.status}`);
        }

        if (wallet.passwordHash !== passwordHash) {
            throw new Error('Invalid wallet credentials');
        }

        const authId = ctx.stub.getTxID();

        const loginAudit = {
            docType: 'AUTH_AUDIT',
            authId,
            walletAddress,
            customerId: wallet.customerId,
            organizationId: wallet.organizationId,
            loginStatus: 'SUCCESS',
            createdAt: this._getTxTimestamp(ctx),
            createdTxId: authId
        };

        await ctx.stub.putState(this._authAuditKey(authId), Buffer.from(JSON.stringify(loginAudit)));

        return this._successResponse('Wallet login successful', {
            wallet: this._removeSensitiveWalletFields(wallet),
            authAudit: loginAudit
        });
    }

    async TransferBetweenWallets(ctx, fromWalletAddress, toWalletAddress, amount, description) {
        this._required(fromWalletAddress, 'fromWalletAddress');
        this._required(toWalletAddress, 'toWalletAddress');

        if (fromWalletAddress === toWalletAddress) {
            throw new Error('Sender wallet and receiver wallet cannot be the same');
        }

        const parsedAmount = this._parseAmount(amount, 'amount');

        if (parsedAmount <= 0) {
            throw new Error('Transfer amount must be greater than zero');
        }

        const fromWallet = await this._getWalletByAddress(ctx, fromWalletAddress);
        const toWallet = await this._getWalletByAddress(ctx, toWalletAddress);

        if (!fromWallet) {
            throw new Error(`Sender wallet not found: ${fromWalletAddress}`);
        }

        if (!toWallet) {
            throw new Error(`Receiver wallet not found: ${toWalletAddress}`);
        }

        this._validateWalletActive(fromWallet, 'Sender wallet');
        this._validateWalletActive(toWallet, 'Receiver wallet');

        if (fromWallet.balance < parsedAmount) {
            throw new Error('Insufficient wallet balance');
        }

        const txId = ctx.stub.getTxID();
        const createdAt = this._getTxTimestamp(ctx);

        fromWallet.balance = this._roundAmount(fromWallet.balance - parsedAmount);
        toWallet.balance = this._roundAmount(toWallet.balance + parsedAmount);

        fromWallet.updatedAt = createdAt;
        fromWallet.updatedTxId = txId;
        toWallet.updatedAt = createdAt;
        toWallet.updatedTxId = txId;

        const transaction = {
            docType: 'TRANSACTION',
            transactionId: txId,
            transactionType: 'WALLET_TO_WALLET',
            fromWallet: fromWalletAddress,
            toWallet: toWalletAddress,
            organizationId: null,
            amount: parsedAmount,
            currency: 'TOKEN',
            status: 'SUCCESS',
            riskLevel: this._calculateRiskLevel(parsedAmount),
            description: description || 'Wallet-to-wallet transfer',
            fromWalletBalanceAfter: fromWallet.balance,
            toWalletBalanceAfter: toWallet.balance,
            createdAt,
            createdTxId: txId
        };

        await ctx.stub.putState(this._walletKey(fromWalletAddress), Buffer.from(JSON.stringify(fromWallet)));
        await ctx.stub.putState(this._walletKey(toWalletAddress), Buffer.from(JSON.stringify(toWallet)));
        await ctx.stub.putState(this._transactionKey(txId), Buffer.from(JSON.stringify(transaction)));

        return this._successResponse('Wallet-to-wallet transfer completed successfully', {
            transaction,
            fromWalletBalance: fromWallet.balance,
            toWalletBalance: toWallet.balance
        });
    }

    async TransferToOrganization(ctx, fromWalletAddress, organizationId, amount, description) {
        this._required(fromWalletAddress, 'fromWalletAddress');
        this._required(organizationId, 'organizationId');

        const parsedAmount = this._parseAmount(amount, 'amount');

        if (parsedAmount <= 0) {
            throw new Error('Transfer amount must be greater than zero');
        }

        const fromWallet = await this._getWalletByAddress(ctx, fromWalletAddress);

        if (!fromWallet) {
            throw new Error(`Wallet not found: ${fromWalletAddress}`);
        }

        this._validateWalletActive(fromWallet, 'Wallet');

        if (fromWallet.balance < parsedAmount) {
            throw new Error('Insufficient wallet balance');
        }

        const txId = ctx.stub.getTxID();
        const createdAt = this._getTxTimestamp(ctx);

        fromWallet.balance = this._roundAmount(fromWallet.balance - parsedAmount);
        fromWallet.updatedAt = createdAt;
        fromWallet.updatedTxId = txId;

        const organizationLedgerKey = this._organizationBalanceKey(organizationId);
        const organizationBalanceBytes = await ctx.stub.getState(organizationLedgerKey);

        let organizationBalance;

        if (!organizationBalanceBytes || organizationBalanceBytes.length === 0) {
            organizationBalance = {
                docType: 'ORGANIZATION_BALANCE',
                organizationId,
                balance: 0,
                currency: 'TOKEN',
                createdAt,
                updatedAt: createdAt,
                createdTxId: txId,
                updatedTxId: txId
            };
        } else {
            organizationBalance = JSON.parse(organizationBalanceBytes.toString());
        }

        organizationBalance.balance = this._roundAmount(organizationBalance.balance + parsedAmount);
        organizationBalance.updatedAt = createdAt;
        organizationBalance.updatedTxId = txId;

        const transaction = {
            docType: 'TRANSACTION',
            transactionId: txId,
            transactionType: 'WALLET_TO_ORGANIZATION',
            fromWallet: fromWalletAddress,
            toWallet: null,
            organizationId,
            amount: parsedAmount,
            currency: 'TOKEN',
            status: 'SUCCESS',
            riskLevel: this._calculateRiskLevel(parsedAmount),
            description: description || 'Wallet-to-organization transfer',
            fromWalletBalanceAfter: fromWallet.balance,
            organizationBalanceAfter: organizationBalance.balance,
            createdAt,
            createdTxId: txId
        };

        await ctx.stub.putState(this._walletKey(fromWalletAddress), Buffer.from(JSON.stringify(fromWallet)));
        await ctx.stub.putState(organizationLedgerKey, Buffer.from(JSON.stringify(organizationBalance)));
        await ctx.stub.putState(this._transactionKey(txId), Buffer.from(JSON.stringify(transaction)));

        return this._successResponse('Wallet-to-organization transfer completed successfully', {
            transaction,
            walletBalance: fromWallet.balance,
            organizationBalance: organizationBalance.balance
        });
    }

    async GetWalletBalance(ctx, walletAddress) {
        this._required(walletAddress, 'walletAddress');

        const wallet = await this._getWalletByAddress(ctx, walletAddress);

        if (!wallet) {
            throw new Error(`Wallet not found: ${walletAddress}`);
        }

        return this._successResponse('Wallet balance retrieved successfully', {
            walletAddress: wallet.walletAddress,
            customerId: wallet.customerId,
            organizationId: wallet.organizationId,
            balance: wallet.balance,
            currency: wallet.currency,
            status: wallet.status,
            updatedAt: wallet.updatedAt
        });
    }

    async GetTransactionHistory(ctx, walletAddress) {
        this._required(walletAddress, 'walletAddress');

        const wallet = await this._getWalletByAddress(ctx, walletAddress);

        if (!wallet) {
            throw new Error(`Wallet not found: ${walletAddress}`);
        }

        const query = {
            selector: {
                docType: 'TRANSACTION',
                $or: [
                    { fromWallet: walletAddress },
                    { toWallet: walletAddress }
                ]
            },
            sort: [
                { createdAt: 'desc' }
            ]
        };

        const transactions = await this._queryLedger(ctx, query);

        return this._successResponse('Transaction history retrieved successfully', {
            walletAddress,
            totalTransactions: transactions.length,
            transactions
        });
    }

    async GetWalletByCustomerId(ctx, customerId) {
        this._required(customerId, 'customerId');

        const wallet = await this._getWalletByCustomerId(ctx, customerId);

        if (!wallet) {
            throw new Error(`Wallet not found for customerId: ${customerId}`);
        }

        return this._successResponse('Wallet retrieved successfully', {
            wallet: this._removeSensitiveWalletFields(wallet)
        });
    }

    async GetOrganizationBalance(ctx, organizationId) {
        this._required(organizationId, 'organizationId');

        const organizationBalanceBytes = await ctx.stub.getState(this._organizationBalanceKey(organizationId));

        if (!organizationBalanceBytes || organizationBalanceBytes.length === 0) {
            return this._successResponse('Organization balance retrieved successfully', {
                organizationId,
                balance: 0,
                currency: 'TOKEN'
            });
        }

        return this._successResponse(
            'Organization balance retrieved successfully',
            JSON.parse(organizationBalanceBytes.toString())
        );
    }

    async GetTransactionById(ctx, transactionId) {
        this._required(transactionId, 'transactionId');

        const transactionBytes = await ctx.stub.getState(this._transactionKey(transactionId));

        if (!transactionBytes || transactionBytes.length === 0) {
            throw new Error(`Transaction not found: ${transactionId}`);
        }

        return this._successResponse(
            'Transaction retrieved successfully',
            JSON.parse(transactionBytes.toString())
        );
    }

    async WalletExists(ctx, walletAddress) {
        this._required(walletAddress, 'walletAddress');

        const walletBytes = await ctx.stub.getState(this._walletKey(walletAddress));

        return walletBytes && walletBytes.length > 0;
    }

    _walletKey(walletAddress) {
        return `WALLET_${walletAddress}`;
    }

    _transactionKey(transactionId) {
        return `TRANSACTION_${transactionId}`;
    }

    _authAuditKey(authId) {
        return `AUTH_AUDIT_${authId}`;
    }

    _organizationBalanceKey(organizationId) {
        return `ORGANIZATION_BALANCE_${organizationId}`;
    }

    _required(value, fieldName) {
        if (value === undefined || value === null || String(value).trim() === '') {
            throw new Error(`${fieldName} is required`);
        }
    }

    _parseAmount(value, fieldName) {
        this._required(value, fieldName);

        const parsed = Number(value);

        if (Number.isNaN(parsed)) {
            throw new Error(`${fieldName} must be a valid number`);
        }

        return this._roundAmount(parsed);
    }

    _roundAmount(value) {
        return Math.round(Number(value) * 100) / 100;
    }

    _validateWalletActive(wallet, label) {
        if (!wallet) {
            throw new Error(`${label} does not exist`);
        }

        if (wallet.status !== 'ACTIVE') {
            throw new Error(`${label} is not active. Current status: ${wallet.status}`);
        }
    }

    _generateWalletAddress(customerId, organizationId, txId) {
        const rawValue = `${customerId}|${organizationId}|${txId}`;
        const hash = crypto.createHash('sha256').update(rawValue).digest('hex');

        return `WALLET_${hash.substring(0, 40).toUpperCase()}`;
    }

    _calculateRiskLevel(amount) {
        const numericAmount = Number(amount);

        if (numericAmount >= 100000) {
            return 'HIGH';
        }

        if (numericAmount >= 10000) {
            return 'MEDIUM';
        }

        return 'LOW';
    }

    _getTxTimestamp(ctx) {
        const timestamp = ctx.stub.getTxTimestamp();
        const milliseconds = timestamp.seconds.low * 1000 + Math.floor(timestamp.nanos / 1000000);

        return new Date(milliseconds).toISOString();
    }

    async _getWalletByAddress(ctx, walletAddress) {
        const walletBytes = await ctx.stub.getState(this._walletKey(walletAddress));

        if (!walletBytes || walletBytes.length === 0) {
            return null;
        }

        return JSON.parse(walletBytes.toString());
    }

    async _getWalletByCustomerId(ctx, customerId) {
        const query = {
            selector: {
                docType: 'WALLET',
                customerId
            },
            limit: 1
        };

        const results = await this._queryLedger(ctx, query);

        if (!results || results.length === 0) {
            return null;
        }

        return results[0];
    }

    async _queryLedger(ctx, query) {
        const iterator = await ctx.stub.getQueryResult(JSON.stringify(query));
        const results = [];

        while (true) {
            const result = await iterator.next();

            if (result.value && result.value.value.toString()) {
                const record = JSON.parse(result.value.value.toString('utf8'));
                results.push(record);
            }

            if (result.done) {
                await iterator.close();
                break;
            }
        }

        return results;
    }

    _removeSensitiveWalletFields(wallet) {
        const safeWallet = Object.assign({}, wallet);

        delete safeWallet.passwordHash;
        delete safeWallet.nationalIdHash;
        delete safeWallet.mobileHash;
        delete safeWallet.emailHash;

        return safeWallet;
    }

    _successResponse(message, data) {
        return {
            success: true,
            message,
            data
        };
    }
}

module.exports = KycWalletContract;
CHAINCODE

echo "Installing npm dependencies..."
npm install

echo "Checking JavaScript syntax..."
node -c index.js
node -c lib/kycWalletContract.js

echo "STEP 12 JavaScript chaincode created successfully."
echo "Location: $PROJECT_DIR"

