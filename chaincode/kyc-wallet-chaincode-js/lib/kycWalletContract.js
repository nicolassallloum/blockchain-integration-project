'use strict';

const { Contract } = require('fabric-contract-api');
const crypto = require('crypto');

class KycWalletContract extends Contract {
    constructor() {
        super('KycWalletContract');
    }

    async InitLedger(ctx) {
        const metadata = {
            docType: 'metadata',
            project: 'Blockchain Integration Project',
            chaincodeName: 'kyc-wallet-chaincode-js',
            version: '2.0.0',
            initializedAt: this._getTxTimestamp(ctx),
            initializedByTxId: ctx.stub.getTxID()
        };

        await ctx.stub.putState(
            'CHAINCODE_METADATA',
            Buffer.from(JSON.stringify(metadata))
        );

        return this._successResponse('Ledger initialized successfully', metadata);
    }

    async CreateWallet(
        ctx,
        customerId,
        organizationId,
        fullName,
        nationalIdHash,
        mobileHash,
        emailHash,
        passwordHash,
        initialBalance
    ) {
        this._required(customerId, 'customerId');
        this._required(organizationId, 'organizationId');
        this._required(fullName, 'fullName');
        this._required(passwordHash, 'passwordHash');

        const parsedInitialBalance = this._parseAmount(
            initialBalance || '0',
            'initialBalance'
        );

        if (parsedInitialBalance < 0) {
            throw new Error('Initial balance cannot be negative');
        }

        const existingWalletByCustomer = await this._getWalletByCustomerId(
            ctx,
            customerId
        );

        if (existingWalletByCustomer) {
            throw new Error(`Wallet already exists for customerId: ${customerId}`);
        }

        const txId = ctx.stub.getTxID();
        const createdAt = this._getTxTimestamp(ctx);
        const walletAddress = this._generateWalletAddress(
            customerId,
            organizationId,
            txId
        );

        const wallet = {
            docType: 'wallet',
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

        await ctx.stub.putState(
            this._walletKey(walletAddress),
            Buffer.from(JSON.stringify(wallet))
        );

        const transaction = {
            docType: 'transaction',
            transactionId: txId,
            transactionType: 'WALLET_CREATED',
            fromWalletAddress: null,
            toWalletAddress: walletAddress,
            organizationId,
            amount: parsedInitialBalance,
            currency: 'TOKEN',
            status: 'SUCCESS',
            riskStatus: 'LOW',
            description: 'Wallet created',
            createdAt,
            createdTxId: txId
        };

        await ctx.stub.putState(
            this._transactionKey(txId),
            Buffer.from(JSON.stringify(transaction))
        );

        return this._successResponse('Wallet created successfully', {
            wallet: this._removeSensitiveWalletFields(wallet),
            transaction
        });
    }




    /**
     * Query current VALOORES customers through Fabric.
     *
     * The query uses deterministic world-state key ranges:
     * KYC_VALOORES-...
     */
    async QueryValooresCustomers(
        ctx,
        pageSize = '100',
        bookmark = ''
    ) {
        const parsedPageSize = Number.parseInt(
            String(pageSize || '100'),
            10
        );

        const normalizedPageSize = Number.isFinite(parsedPageSize)
            ? Math.min(Math.max(parsedPageSize, 1), 1000)
            : 100;

        const normalizedBookmark = String(bookmark || '');
        const startKey = 'KYC_VALOORES-';
        const endKey = 'KYC_VALOORES-\uffff';

        const queryResult =
            await ctx.stub.getStateByRangeWithPagination(
                startKey,
                endKey,
                normalizedPageSize,
                normalizedBookmark
            );

        const iterator = queryResult.iterator;
        const metadata = queryResult.metadata || {};
        const customers = [];

        try {
            while (true) {
                const item = await iterator.next();

                if (
                    item.value &&
                    item.value.value &&
                    item.value.value.length > 0
                ) {
                    const ledgerKey = item.value.key;
                    const value = JSON.parse(
                        item.value.value.toString('utf8')
                    );

                    customers.push({
                        ...value,
                        ledgerKey,
                        customerId: String(
                            value.residentId || ''
                        ).replace(/^VALOORES-/, '')
                    });
                }

                if (item.done) {
                    break;
                }
            }
        } finally {
            await iterator.close();
        }

        return JSON.stringify({
            source: 'FABRIC_BLOCKCHAIN',
            customers,
            pagination: {
                pageSize: normalizedPageSize,
                fetchedRecordsCount: Number(
                    metadata.fetchedRecordsCount ||
                    customers.length
                ),
                bookmark: String(metadata.bookmark || '')
            }
        });
    }

    /**
     * Count current VALOORES customer records through Fabric.
     */
    async CountValooresCustomers(ctx) {
        const startKey = 'KYC_VALOORES-';
        const endKey = 'KYC_VALOORES-\uffff';

        const iterator = await ctx.stub.getStateByRange(
            startKey,
            endKey
        );

        let totalCustomers = 0;

        try {
            while (true) {
                const item = await iterator.next();

                if (
                    item.value &&
                    item.value.value &&
                    item.value.value.length > 0
                ) {
                    totalCustomers += 1;
                }

                if (item.done) {
                    break;
                }
            }
        } finally {
            await iterator.close();
        }

        return JSON.stringify({
            source: 'FABRIC_BLOCKCHAIN',
            totalCustomers
        });
    }


    /* VALOORES_CUSTOMER_CRUD_CHAINCODE_V1 */

    _customerCrudTimestamp(ctx) {
        const timestamp = ctx.stub.getTxTimestamp();
        const rawSeconds = timestamp.seconds;

        const seconds =
            rawSeconds &&
            typeof rawSeconds.toNumber === 'function'
                ? rawSeconds.toNumber()
                : Number(rawSeconds || 0);

        const nanos = Number(timestamp.nanos || 0);

        return new Date(
            (seconds * 1000) + Math.floor(nanos / 1000000)
        ).toISOString();
    }



    /* END VALOORES_CUSTOMER_CRUD_CHAINCODE_V1 */


    async GetResidentWallet(ctx, residentId) {
        const walletKey = `RESIDENT_WALLET_${residentId}`;
        const data = await ctx.stub.getState(walletKey);

        if (!data || data.length === 0) {
            throw new Error(`Resident wallet not found on blockchain: ${residentId}`);
        }

        return data.toString();
    }


    async CreateGovernmentTransaction(ctx, transactionJson) {
        this._required(transactionJson, 'transactionJson');

        let transaction;

        try {
            transaction = JSON.parse(transactionJson);
        } catch (error) {
            throw new Error(`Invalid government transaction JSON: ${error.message}`);
        }

        this._required(transaction.transactionReference, 'transactionReference');
        this._required(transaction.residentId, 'residentId');
        this._required(transaction.serviceCode, 'serviceCode');
        this._required(transaction.serviceName, 'serviceName');

        const key = `GOV_TXN_${transaction.transactionReference}`;

        const exists = await ctx.stub.getState(key);
        if (exists && exists.length > 0) {
            throw new Error(
                `Government transaction already exists: ${transaction.transactionReference}`
            );
        }

        const txId = ctx.stub.getTxID();
        const createdAt = transaction.createdAt || this._getTxTimestamp(ctx);

        const record = {
            docType: 'GOVERNMENT_TRANSACTION',
            ledgerReference: key,

            transactionReference: transaction.transactionReference,
            blockchainTxId: txId,

            residentId: transaction.residentId || null,
            residentWalletAddress: transaction.residentWalletAddress || null,
            residentFullName: transaction.residentFullName || null,
            residentNationalId: transaction.residentNationalId || null,
            residentMobile: transaction.residentMobile || null,
            residentEmail: transaction.residentEmail || null,

            serviceId: transaction.serviceId || null,
            servicePublicId: transaction.servicePublicId || null,
            serviceCode: transaction.serviceCode || null,
            serviceName: transaction.serviceName || null,
            serviceArabicName: transaction.serviceArabicName || null,
            ministryId: transaction.ministryId || null,
            administrationId: transaction.administrationId || null,
            categoryId: transaction.categoryId || null,

            amount: transaction.amount || '0',
            currencyCode: transaction.currencyCode || 'GOV',
            paymentMethod: transaction.paymentMethod || 'WALLET',
            transactionType: transaction.transactionType || 'GOVERNMENT_SERVICE',
            transactionStatus: transaction.transactionStatus || 'PENDING',

            notes: transaction.notes || null,
            documentHash: transaction.documentHash || null,

            createdByAccountType: transaction.createdByAccountType || null,
            createdByLoginUsername: transaction.createdByLoginUsername || null,
            createdByWalletAddress: transaction.createdByWalletAddress || null,

            blockchainStatus: 'CONFIRMED',
            createdAt,
            updatedAt: createdAt,
            createdTxId: txId,
            updatedTxId: txId
        };

        await ctx.stub.putState(key, Buffer.from(JSON.stringify(record)));

        return this._successResponse(
            'Government transaction created on blockchain successfully',
            {
                key,
                transactionReference: record.transactionReference,
                blockchainTxId: txId,
                record
            }
        );
    }

    async GetGovernmentTransaction(ctx, transactionReference) {
        this._required(transactionReference, 'transactionReference');

        const key = `GOV_TXN_${transactionReference}`;
        const data = await ctx.stub.getState(key);

        if (!data || data.length === 0) {
            throw new Error(
                `Government transaction not found: ${transactionReference}`
            );
        }

        return data.toString();
    }

    async GovernmentTransactionExists(ctx, transactionReference) {
        this._required(transactionReference, 'transactionReference');

        const key = `GOV_TXN_${transactionReference}`;
        const data = await ctx.stub.getState(key);

        return data && data.length > 0;
    }

    async QueryGovernmentTransactionsByResident(ctx, residentId) {
        this._required(residentId, 'residentId');

        const query = {
            selector: {
                docType: 'GOVERNMENT_TRANSACTION',
                residentId
            }
        };

        const results = await this._queryLedgerWithKeys(ctx, query);

        return JSON.stringify(results);
    }

    async QueryGovernmentTransactionsByService(ctx, serviceCode) {
        this._required(serviceCode, 'serviceCode');

        const query = {
            selector: {
                docType: 'GOVERNMENT_TRANSACTION',
                serviceCode
            }
        };

        const results = await this._queryLedgerWithKeys(ctx, query);

        return JSON.stringify(results);
    }

    async CreateMinistry(ctx, ministryJson) {
        if (!ministryJson) {
            throw new Error('ministryJson is required');
        }

        let ministry;

        try {
            ministry = JSON.parse(ministryJson);
        } catch (error) {
            throw new Error(`Invalid ministry JSON: ${error.message}`);
        }

        const ledgerReference =
            ministry.ledgerReference ||
            `MINISTRY_${ministry.ministryReferenceId || ministry.ministryCode}`;

        if (!ledgerReference) {
            throw new Error(
                'ledgerReference, ministryReferenceId, or ministryCode is required'
            );
        }

        const existingMinistry = await ctx.stub.getState(ledgerReference);

        if (existingMinistry && existingMinistry.length > 0) {
            throw new Error(
                `Ministry already exists on blockchain: ${ledgerReference}`
            );
        }

        const txId = ctx.stub.getTxID();
        const createdAt = ministry.createdAt || this._getTxTimestamp(ctx);

        const blockchainRecord = {
            docType: 'MINISTRY',
            ledgerReference,
            ministryId: ministry.ministryId || null,
            ministryReferenceId: ministry.ministryReferenceId || null,
            ministryCode: ministry.ministryCode || null,
            ministryName: ministry.ministryName || null,
            arabicName: ministry.arabicName || null,
            ministryType: ministry.ministryType || null,
            parentMinistry: ministry.parentMinistry || null,
            ministerName: ministry.ministerName || null,
            contactPerson: ministry.contactPerson || null,
            contactEmail: ministry.contactEmail || null,
            contactMobile: ministry.contactMobile || null,
            countryCode: ministry.countryCode || null,
            countryName: ministry.countryName || null,
            governorateCode: ministry.governorateCode || null,
            governorateName: ministry.governorateName || null,
            address: ministry.address || null,
            walletAddress: ministry.walletAddress || null,
            walletCurrency: ministry.walletCurrency || null,
            walletStatus: ministry.walletStatus || 'ACTIVE',
            institutionStatus:
                ministry.institutionStatus || 'PENDING_APPROVAL',
            status: ministry.status || 'ACTIVE',
            blockchainStatus: 'CONFIRMED',
            createdAt,
            updatedAt: createdAt,
            createdTxId: txId,
            updatedTxId: txId
        };

        await ctx.stub.putState(
            ledgerReference,
            Buffer.from(JSON.stringify(blockchainRecord))
        );

        return this._successResponse(
            'Ministry created on blockchain successfully',
            {
                ledgerReference,
                docType: 'MINISTRY',
                ministryReferenceId: blockchainRecord.ministryReferenceId,
                ministryCode: blockchainRecord.ministryCode,
                ministryName: blockchainRecord.ministryName,
                txId,
                record: blockchainRecord
            }
        );
    }

    async GetMinistry(ctx, ledgerReference) {
        this._required(ledgerReference, 'ledgerReference');

        const data = await ctx.stub.getState(ledgerReference);

        if (!data || data.length === 0) {
            throw new Error(
                `Ministry not found on blockchain: ${ledgerReference}`
            );
        }

        return data.toString();
    }

    async CreatePublicAdministration(ctx, administrationJson) {
        if (!administrationJson) {
            throw new Error('administrationJson is required');
        }

        let administration;

        try {
            administration = JSON.parse(administrationJson);
        } catch (error) {
            throw new Error(`Invalid public administration JSON: ${error.message}`);
        }

        this._required(administration.administrationId, 'administrationId');
        this._required(administration.administrationCode, 'administrationCode');
        this._required(administration.administrationName, 'administrationName');

        const ledgerReference =
            administration.ledgerReference ||
            `PUBLIC_ADMINISTRATION_${administration.administrationId}`;

        const existingAdministration = await ctx.stub.getState(ledgerReference);

        if (existingAdministration && existingAdministration.length > 0) {
            throw new Error(
                `Public Administration already exists on blockchain: ${ledgerReference}`
            );
        }

        const txId = ctx.stub.getTxID();
        const createdAt = administration.createdAt || this._getTxTimestamp(ctx);

        const generatedNumber = this._generatePublicAdministrationNumber(
            administration.administrationId,
            txId
        );

        const generatedWalletAddress = `GOV-ADM-${generatedNumber}`;

        const generatedPassword = this._generateTemporaryPassword(
            administration.administrationId,
            txId
        );

        const passwordHash = this._hashValue(generatedPassword);

        const loginUsername =
            administration.loginUsername ||
            administration.contactEmail ||
            administration.administrationCode;

        const blockchainRecord = {
            docType: 'PUBLIC_ADMINISTRATION',
            ledgerReference,
            administrationId: administration.administrationId,
            administrationCode: administration.administrationCode,
            administrationName: administration.administrationName,
            arabicName: administration.arabicName || null,
            parentMinistry: administration.parentMinistry || null,
            administrationType: administration.administrationType || null,
            directorName: administration.directorName || null,
            contactPerson: administration.contactPerson || null,
            contactEmail: administration.contactEmail || null,
            contactMobile: administration.contactMobile || null,
            country: administration.country || null,
            governorate: administration.governorate || null,
            municipality: administration.municipality || null,
            address: administration.address || null,

            walletAddress: generatedWalletAddress,
            walletCurrency: administration.walletCurrency || 'LBP',
            walletStatus: administration.walletStatus || 'PENDING',

            loginUsername,
            passwordHash,

            status: administration.status || 'ACTIVE',
            blockchainStatus: 'CONFIRMED',
            createdAt,
            updatedAt: createdAt,
            createdTxId: txId,
            updatedTxId: txId
        };

        await ctx.stub.putState(
            ledgerReference,
            Buffer.from(JSON.stringify(blockchainRecord))
        );

        return this._successResponse(
            'Public Administration created on blockchain successfully',
            {
                ledgerReference,
                docType: 'PUBLIC_ADMINISTRATION',
                administrationId: blockchainRecord.administrationId,
                administrationCode: blockchainRecord.administrationCode,
                administrationName: blockchainRecord.administrationName,
                loginUsername: blockchainRecord.loginUsername,
                generatedPassword,
                walletAddress: blockchainRecord.walletAddress,
                walletCurrency: blockchainRecord.walletCurrency,
                walletStatus: blockchainRecord.walletStatus,
                txId,
                record: blockchainRecord
            }
        );
    }

    async GetPublicAdministration(ctx, administrationId) {
        this._required(administrationId, 'administrationId');

        const ledgerReference = `PUBLIC_ADMINISTRATION_${administrationId}`;
        const data = await ctx.stub.getState(ledgerReference);

        if (!data || data.length === 0) {
            throw new Error(
                `Public Administration not found on blockchain: ${administrationId}`
            );
        }

        return data.toString();
    }

    async PublicAdministrationExists(ctx, administrationId) {
        this._required(administrationId, 'administrationId');

        const ledgerReference = `PUBLIC_ADMINISTRATION_${administrationId}`;
        const data = await ctx.stub.getState(ledgerReference);

        return data && data.length > 0;
    }

    async QueryPublicAdministrationByCode(ctx, administrationCode) {
        this._required(administrationCode, 'administrationCode');

        const query = {
            selector: {
                docType: 'PUBLIC_ADMINISTRATION',
                administrationCode
            }
        };

        const results = await this._queryLedgerWithKeys(ctx, query);

        return JSON.stringify(results);
    }

    async QueryPublicAdministrationsByParentMinistry(ctx, parentMinistry) {
        this._required(parentMinistry, 'parentMinistry');

        const query = {
            selector: {
                docType: 'PUBLIC_ADMINISTRATION',
                parentMinistry
            }
        };

        const results = await this._queryLedgerWithKeys(ctx, query);

        return JSON.stringify(results);
    }

    async TransferBetweenWallets(
        ctx,
        fromWalletAddress,
        toWalletAddress,
        amount,
        description
    ) {
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
            docType: 'transaction',
            transactionId: txId,
            transactionType: 'WALLET_TO_WALLET',
            fromWalletAddress,
            toWalletAddress,
            organizationId: null,
            amount: parsedAmount,
            currency: 'TOKEN',
            status: 'SUCCESS',
            riskStatus: this._calculateRiskStatus(parsedAmount),
            description: description || 'Wallet-to-wallet transfer',
            fromWalletBalanceAfter: fromWallet.balance,
            toWalletBalanceAfter: toWallet.balance,
            createdAt,
            createdTxId: txId
        };

        await ctx.stub.putState(
            this._walletKey(fromWalletAddress),
            Buffer.from(JSON.stringify(fromWallet))
        );

        await ctx.stub.putState(
            this._walletKey(toWalletAddress),
            Buffer.from(JSON.stringify(toWallet))
        );

        await ctx.stub.putState(
            this._transactionKey(txId),
            Buffer.from(JSON.stringify(transaction))
        );

        return this._successResponse(
            'Wallet-to-wallet transfer completed successfully',
            {
                transaction,
                fromWalletBalance: fromWallet.balance,
                toWalletBalance: toWallet.balance
            }
        );
    }

    async TransferToOrganization(
        ctx,
        fromWalletAddress,
        organizationId,
        amount,
        description
    ) {
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
        const organizationBalanceBytes = await ctx.stub.getState(
            organizationLedgerKey
        );

        let organizationBalance;

        if (!organizationBalanceBytes || organizationBalanceBytes.length === 0) {
            organizationBalance = {
                docType: 'organization',
                organizationId,
                balance: 0,
                currency: 'TOKEN',
                status: 'ACTIVE',
                createdAt,
                updatedAt: createdAt,
                createdTxId: txId,
                updatedTxId: txId
            };
        } else {
            organizationBalance = JSON.parse(
                organizationBalanceBytes.toString()
            );
        }

        organizationBalance.balance = this._roundAmount(
            organizationBalance.balance + parsedAmount
        );
        organizationBalance.updatedAt = createdAt;
        organizationBalance.updatedTxId = txId;

        const transaction = {
            docType: 'transaction',
            transactionId: txId,
            transactionType: 'WALLET_TO_ORGANIZATION',
            fromWalletAddress,
            toWalletAddress: null,
            organizationId,
            amount: parsedAmount,
            currency: 'TOKEN',
            status: 'SUCCESS',
            riskStatus: this._calculateRiskStatus(parsedAmount),
            description: description || 'Wallet-to-organization transfer',
            fromWalletBalanceAfter: fromWallet.balance,
            organizationBalanceAfter: organizationBalance.balance,
            createdAt,
            createdTxId: txId
        };

        await ctx.stub.putState(
            this._walletKey(fromWalletAddress),
            Buffer.from(JSON.stringify(fromWallet))
        );

        await ctx.stub.putState(
            organizationLedgerKey,
            Buffer.from(JSON.stringify(organizationBalance))
        );

        await ctx.stub.putState(
            this._transactionKey(txId),
            Buffer.from(JSON.stringify(transaction))
        );

        return this._successResponse(
            'Wallet-to-organization transfer completed successfully',
            {
                transaction,
                walletBalance: fromWallet.balance,
                organizationBalance: organizationBalance.balance
            }
        );
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

        const outgoingQuery = {
            selector: {
                docType: 'transaction',
                fromWalletAddress: walletAddress
            },
            use_index: [
                'indexTransactionByFromWalletDoc',
                'indexTransactionByFromWallet'
            ]
        };

        const incomingQuery = {
            selector: {
                docType: 'transaction',
                toWalletAddress: walletAddress
            },
            use_index: [
                'indexTransactionByToWalletDoc',
                'indexTransactionByToWallet'
            ]
        };

        const outgoingTransactions = await this._queryLedger(ctx, outgoingQuery);
        const incomingTransactions = await this._queryLedger(ctx, incomingQuery);

        const mergedMap = new Map();

        for (const tx of outgoingTransactions.concat(incomingTransactions)) {
            mergedMap.set(tx.transactionId, tx);
        }

        const transactions = Array.from(mergedMap.values()).sort((a, b) => {
            return String(b.createdAt).localeCompare(String(a.createdAt));
        });

        return this._successResponse(
            'Transaction history retrieved successfully',
            {
                walletAddress,
                totalTransactions: transactions.length,
                transactions
            }
        );
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

        const organizationBalanceBytes = await ctx.stub.getState(
            this._organizationBalanceKey(organizationId)
        );

        if (!organizationBalanceBytes || organizationBalanceBytes.length === 0) {
            return this._successResponse(
                'Organization balance retrieved successfully',
                {
                    organizationId,
                    balance: 0,
                    currency: 'TOKEN'
                }
            );
        }

        return this._successResponse(
            'Organization balance retrieved successfully',
            JSON.parse(organizationBalanceBytes.toString())
        );
    }

    async GetTransactionById(ctx, transactionId) {
        this._required(transactionId, 'transactionId');

        const transactionBytes = await ctx.stub.getState(
            this._transactionKey(transactionId)
        );

        if (!transactionBytes || transactionBytes.length === 0) {
            throw new Error(`Transaction not found: ${transactionId}`);
        }

        return this._successResponse(
            'Transaction retrieved successfully',
            JSON.parse(transactionBytes.toString())
        );
    }

    _generatePublicAdministrationNumber(administrationId, txId) {
        const rawValue = `${administrationId}|${txId}|PUBLIC_ADMINISTRATION_WALLET`;
        const hash = crypto.createHash('sha256').update(rawValue).digest('hex');

        const hexPart = hash.substring(0, 15);
        const numericValue = BigInt(`0x${hexPart}`).toString();

        return numericValue.substring(0, 12);
    }

    _generateTemporaryPassword(administrationId, txId) {
        const rawValue = `${administrationId}|${txId}|PUBLIC_ADMINISTRATION_PASSWORD`;
        const hash = crypto.createHash('sha256').update(rawValue).digest('hex');

        const partOne = hash.substring(0, 6);
        const partTwo = hash.substring(6, 10).toUpperCase();

        return `Gov@${partOne}${partTwo}`;
    }

    _hashValue(value) {
        return crypto.createHash('sha256').update(String(value)).digest('hex');
    }

    async WalletExists(ctx, walletAddress) {
        this._required(walletAddress, 'walletAddress');

        const walletBytes = await ctx.stub.getState(this._walletKey(walletAddress));

        return walletBytes && walletBytes.length > 0;
    }

    async QueryWalletByAddress(ctx, walletAddress) {
        this._required(walletAddress, 'walletAddress');

        const query = {
            selector: {
                docType: 'wallet',
                walletAddress
            },
            use_index: [
                'indexWalletByAddressDoc',
                'indexWalletByAddress'
            ]
        };

        const results = await this._queryLedgerWithKeys(ctx, query);

        return JSON.stringify(results);
    }

    async QueryWalletByCustomerId(ctx, customerId) {
        this._required(customerId, 'customerId');

        const query = {
            selector: {
                docType: 'wallet',
                customerId
            },
            use_index: [
                'indexWalletByCustomerIdDoc',
                'indexWalletByCustomerId'
            ]
        };

        const results = await this._queryLedgerWithKeys(ctx, query);

        return JSON.stringify(results);
    }

    async QueryOrganizationById(ctx, organizationId) {
        this._required(organizationId, 'organizationId');

        const query = {
            selector: {
                docType: 'organization',
                organizationId
            },
            use_index: [
                'indexOrganizationByIdDoc',
                'indexOrganizationById'
            ]
        };

        const results = await this._queryLedgerWithKeys(ctx, query);

        return JSON.stringify(results);
    }

    async QueryTransactionById(ctx, transactionId) {
        this._required(transactionId, 'transactionId');

        const query = {
            selector: {
                docType: 'transaction',
                transactionId
            },
            use_index: [
                'indexTransactionByIdDoc',
                'indexTransactionById'
            ]
        };

        const results = await this._queryLedgerWithKeys(ctx, query);

        return JSON.stringify(results);
    }

    async QueryTransactionsByStatus(ctx, status) {
        this._required(status, 'status');

        const query = {
            selector: {
                docType: 'transaction',
                status
            },
            use_index: [
                'indexTransactionByStatusDoc',
                'indexTransactionByStatus'
            ]
        };

        const results = await this._queryLedgerWithKeys(ctx, query);

        return JSON.stringify(results);
    }

    async QueryTransactionsByType(ctx, transactionType) {
        this._required(transactionType, 'transactionType');

        const query = {
            selector: {
                docType: 'transaction',
                transactionType
            },
            use_index: [
                'indexTransactionByTypeDoc',
                'indexTransactionByType'
            ]
        };

        const results = await this._queryLedgerWithKeys(ctx, query);

        return JSON.stringify(results);
    }

    async QueryTransactionsByRiskStatus(ctx, riskStatus) {
        this._required(riskStatus, 'riskStatus');

        const query = {
            selector: {
                docType: 'transaction',
                riskStatus
            },
            use_index: [
                'indexTransactionByRiskStatusDoc',
                'indexTransactionByRiskStatus'
            ]
        };

        const results = await this._queryLedgerWithKeys(ctx, query);

        return JSON.stringify(results);
    }

    async QueryTransactionsByDateRange(ctx, startDate, endDate) {
        this._required(startDate, 'startDate');
        this._required(endDate, 'endDate');

        const query = {
            selector: {
                docType: 'transaction',
                createdAt: {
                    '$gte': startDate,
                    '$lte': endDate
                }
            },
            use_index: [
                'indexTransactionByCreatedDateDoc',
                'indexTransactionByCreatedDate'
            ]
        };

        const results = await this._queryLedgerWithKeys(ctx, query);

        return JSON.stringify(results);
    }

    async QueryTransactionHistoryByWallet(ctx, walletAddress) {
        this._required(walletAddress, 'walletAddress');

        const outgoingQuery = {
            selector: {
                docType: 'transaction',
                fromWalletAddress: walletAddress
            },
            use_index: [
                'indexTransactionByFromWalletDoc',
                'indexTransactionByFromWallet'
            ]
        };

        const incomingQuery = {
            selector: {
                docType: 'transaction',
                toWalletAddress: walletAddress
            },
            use_index: [
                'indexTransactionByToWalletDoc',
                'indexTransactionByToWallet'
            ]
        };

        const outgoingResults = await this._queryLedgerWithKeys(
            ctx,
            outgoingQuery
        );

        const incomingResults = await this._queryLedgerWithKeys(
            ctx,
            incomingQuery
        );

        const mergedMap = new Map();

        for (const item of outgoingResults.concat(incomingResults)) {
            mergedMap.set(item.record.transactionId, item);
        }

        const results = Array.from(mergedMap.values()).sort((a, b) => {
            return String(b.record.createdAt).localeCompare(
                String(a.record.createdAt)
            );
        });

        return JSON.stringify(results);
    }

    async QueryMinistryByCode(ctx, ministryCode) {
        this._required(ministryCode, 'ministryCode');

        const query = {
            selector: {
                docType: 'MINISTRY',
                ministryCode
            }
        };

        const results = await this._queryLedgerWithKeys(ctx, query);

        return JSON.stringify(results);
    }

    async QueryMinistryByReferenceId(ctx, ministryReferenceId) {
        this._required(ministryReferenceId, 'ministryReferenceId');

        const query = {
            selector: {
                docType: 'MINISTRY',
                ministryReferenceId
            }
        };

        const results = await this._queryLedgerWithKeys(ctx, query);

        return JSON.stringify(results);
    }


    async SaveAmlRule(ctx, amlRuleJson) {
        this._required(amlRuleJson, 'amlRuleJson');

        let amlRule;

        try {
            amlRule = JSON.parse(amlRuleJson);
        } catch (error) {
            throw new Error(`Invalid AML rule JSON: ${error.message}`);
        }

        const ruleId =
            amlRule.ruleId ||
            amlRule.rule_id ||
            amlRule['RULE ID'];

        this._required(ruleId, 'ruleId');

        const key = this._amlRuleKey(ruleId);
        const existingBytes = await ctx.stub.getState(key);

        let existingRecord = null;

        if (existingBytes && existingBytes.length > 0) {
            existingRecord = JSON.parse(existingBytes.toString());
        }

        const txId = ctx.stub.getTxID();
        const now = this._getTxTimestamp(ctx);
        const sourcePayloadHash = this._hashValue(amlRuleJson);

        const record = {
            docType: 'AML_RULE',
            ledgerReference: key,

            ruleId: String(ruleId),
            ruleDesc:
                amlRule.ruleDesc ||
                amlRule.rule_desc ||
                amlRule['RULE DESC'] ||
                null,

            ruleStatus:
                amlRule.ruleStatus ||
                amlRule.rule_status ||
                amlRule['RULE STATUS'] ||
                null,

            ruleStartDate:
                amlRule.ruleStartDate ||
                amlRule.rule_start_date ||
                amlRule['RULE START DATE'] ||
                null,

            ruleExpiryDate:
                amlRule.ruleExpiryDate ||
                amlRule.rule_expiry_date ||
                amlRule['RULE EXPIRY DATE'] ||
                null,

            ruleCreationDate:
                amlRule.ruleCreationDate ||
                amlRule.rule_creation_date ||
                amlRule['RULE CREATION DATE'] ||
                null,

            ruleCreator:
                amlRule.ruleCreator ||
                amlRule.rule_creator ||
                amlRule['RULE CREATOR'] ||
                null,

            ruleUpdateDate:
                amlRule.ruleUpdateDate ||
                amlRule.rule_update_date ||
                amlRule['RULE UPDATE DATE'] ||
                null,

            ruleUpdator:
                amlRule.ruleUpdator ||
                amlRule.rule_updator ||
                amlRule['RULE UPDATOR'] ||
                null,

            ruleMessage:
                amlRule.ruleMessage ||
                amlRule.rule_message ||
                amlRule['RULE MESSAGE'] ||
                null,

            ruleQueryId:
                amlRule.ruleQueryId ||
                amlRule.rule_query_id ||
                amlRule['RULE QUERY ID'] ||
                null,

            ruleSqlQuery:
                amlRule.ruleSqlQuery ||
                amlRule.rule_sql_query ||
                amlRule['RULE SQL QUERY'] ||
                null,

            ruleQueryCreationDate:
                amlRule.ruleQueryCreationDate ||
                amlRule.rule_query_creation_date ||
                amlRule['RULE QUERY CREATION DATE'] ||
                null,

            ruleQueryCreatedBy:
                amlRule.ruleQueryCreatedBy ||
                amlRule.rule_query_created_by ||
                amlRule['RULE QUERY CREATED BY'] ||
                null,

            ruleApplicationQueryId:
                amlRule.ruleApplicationQueryId ||
                amlRule.rule_application_query_id ||
                amlRule['RULE APPLCIATION QUERY ID'] ||
                amlRule['RULE APPLICATION QUERY ID'] ||
                null,

            ruleQueryUpdateDate:
                amlRule.ruleQueryUpdateDate ||
                amlRule.rule_query_update_date ||
                amlRule['RULE QUERY UPDATE DATE'] ||
                null,

            ruleQueryUpdateBy:
                amlRule.ruleQueryUpdateBy ||
                amlRule.rule_query_update_by ||
                amlRule['RULE QUERY UPDATE BY'] ||
                null,

            sourceSystem: 'POSTGRESQL_VIEW',
            sourceView: 'blockchain.valoores_aml_rules',
            sourcePayloadHash,

            rawSourceRecord: amlRule,

            blockchainStatus: 'CONFIRMED',
            createdAt: existingRecord ? existingRecord.createdAt : now,
            updatedAt: now,
            createdTxId: existingRecord ? existingRecord.createdTxId : txId,
            updatedTxId: txId
        };

        await ctx.stub.putState(key, Buffer.from(JSON.stringify(record)));

        return this._successResponse(
            existingRecord
                ? 'AML rule updated on blockchain successfully'
                : 'AML rule created on blockchain successfully',
            {
                key,
                ruleId: record.ruleId,
                blockchainTxId: txId,
                sourcePayloadHash,
                record
            }
        );
    }

    async GetAmlRule(ctx, ruleId) {
        this._required(ruleId, 'ruleId');

        const key = this._amlRuleKey(ruleId);
        const data = await ctx.stub.getState(key);

        if (!data || data.length === 0) {
            throw new Error(`AML rule not found on blockchain: ${ruleId}`);
        }

        return data.toString();
    }

    async AmlRuleExists(ctx, ruleId) {
        this._required(ruleId, 'ruleId');

        const key = this._amlRuleKey(ruleId);
        const data = await ctx.stub.getState(key);

        return data && data.length > 0;
    }

    async QueryAmlRulesByStatus(ctx, ruleStatus) {
        this._required(ruleStatus, 'ruleStatus');

        const query = {
            selector: {
                docType: 'AML_RULE',
                ruleStatus: String(ruleStatus)
            }
        };

        const results = await this._queryLedgerWithKeys(ctx, query);

        return JSON.stringify(results);
    }

    async GetAllAmlRules(ctx) {
        const query = {
            selector: {
                docType: 'AML_RULE'
            }
        };

        const results = await this._queryLedgerWithKeys(ctx, query);

        return JSON.stringify(results);
    }

    async GetAmlRuleHistory(ctx, ruleId) {
        this._required(ruleId, 'ruleId');

        const key = this._amlRuleKey(ruleId);
        const iterator = await ctx.stub.getHistoryForKey(key);

        const results = [];

        while (true) {
            const item = await iterator.next();

            if (item.value) {
                let record = null;

                if (item.value.value && item.value.value.length > 0) {
                    try {
                        record = JSON.parse(item.value.value.toString('utf8'));
                    } catch {
                        record = item.value.value.toString('utf8');
                    }
                }

                results.push({
                    txId: item.value.txId,
                    timestamp: item.value.timestamp,
                    isDelete: item.value.isDelete,
                    record
                });
            }

            if (item.done) {
                await iterator.close();
                break;
            }
        }

        return JSON.stringify(results);
    }

    _amlRuleKey(ruleId) {
        return `AML_RULE_${ruleId}`;
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
        if (
            value === undefined ||
            value === null ||
            String(value).trim() === ''
        ) {
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
            throw new Error(
                `${label} is not active. Current status: ${wallet.status}`
            );
        }
    }

    _generateWalletAddress(customerId, organizationId, txId) {
        const rawValue = `${customerId}|${organizationId}|${txId}`;
        const hash = crypto.createHash('sha256').update(rawValue).digest('hex');

        return `WALLET_${hash.substring(0, 40).toUpperCase()}`;
    }

    _calculateRiskStatus(amount) {
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

        let seconds;

        if (
            timestamp.seconds &&
            typeof timestamp.seconds.toNumber === 'function'
        ) {
            seconds = timestamp.seconds.toNumber();
        } else if (timestamp.seconds && timestamp.seconds.low !== undefined) {
            seconds = timestamp.seconds.low;
        } else {
            seconds = Number(timestamp.seconds || 0);
        }

        const milliseconds =
            seconds * 1000 + Math.floor(timestamp.nanos / 1000000);

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
                docType: 'wallet',
                customerId
            },
            use_index: [
                'indexWalletByCustomerIdDoc',
                'indexWalletByCustomerId'
            ],
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

        try {
            while (true) {
                const result = await iterator.next();

                if (result.value && result.value.value.toString()) {
                    const record = JSON.parse(
                        result.value.value.toString('utf8')
                    );

                    results.push(record);
                }

                if (result.done) {
                    break;
                }
            }
        } finally {
            await iterator.close();
        }

        return results;
    }

    async _queryLedgerWithKeys(ctx, query) {
        const iterator = await ctx.stub.getQueryResult(JSON.stringify(query));
        const results = [];

        try {
            while (true) {
                const result = await iterator.next();

                if (result.value && result.value.value.toString()) {
                    const record = JSON.parse(
                        result.value.value.toString('utf8')
                    );

                    results.push({
                        key: result.value.key,
                        record
                    });
                }

                if (result.done) {
                    break;
                }
            }
        } finally {
            await iterator.close();
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

    async GetHistoryForKey(ctx, key) {
        if (!key || String(key).trim() === '') {
            throw new Error('Fabric history key is required');
        }

        const iterator = await ctx.stub.getHistoryForKey(String(key).trim());
        const results = [];

        try {
            while (true) {
                const response = await iterator.next();

                if (response.value) {
                    const historyItem = {
                        txId: response.value.txId,
                        timestamp: response.value.timestamp,
                        isDelete: response.value.isDelete,
                        value: null
                    };

                    if (
                        response.value.value &&
                        response.value.value.length > 0
                    ) {
                        const rawValue = response.value.value.toString('utf8');

                        try {
                            historyItem.value = JSON.parse(rawValue);
                        } catch (error) {
                            historyItem.value = rawValue;
                        }
                    }

                    results.push(historyItem);
                }

                if (response.done) {
                    break;
                }
            }
        } finally {
            await iterator.close();
        }

        return JSON.stringify(results);
    }



  /* ===== VALOORES AML RULE COMPOSITE KEY OVERRIDES START ===== */

  _amlRuleCompositeKey(ruleId, ruleQueryId) {
    const cleanRuleId = String(ruleId || '').trim();
    const cleanRuleQueryId = String(ruleQueryId || '0').trim();

    if (!cleanRuleId) {
      throw new Error('RULE ID is required');
    }

    return `AML_RULE_${cleanRuleId}_${cleanRuleQueryId || '0'}`;
  }

  _amlRuleLegacyKey(ruleId) {
    const cleanRuleId = String(ruleId || '').trim();

    if (!cleanRuleId) {
      throw new Error('RULE ID is required');
    }

    return `AML_RULE_${cleanRuleId}`;
  }

  _getAmlRuleIdFromPayload(payload) {
    return String(
      payload.ruleId ||
      payload.rule_id ||
      payload['RULE ID'] ||
      ''
    ).trim();
  }

  _getAmlRuleQueryIdFromPayload(payload) {
    return String(
      payload.ruleQueryId ||
      payload.rule_query_id ||
      payload['RULE QUERY ID'] ||
      '0'
    ).trim();
  }

  _amlRulePayloadHash(payload) {
    const crypto = require('crypto');
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
  }


  _getFabricTxTimestampIso(ctx) {
    const ts = ctx.stub.getTxTimestamp();
    const seconds = Number(ts.seconds.low || ts.seconds);
    const nanos = Number(ts.nanos || 0);
    return new Date((seconds * 1000) + Math.floor(nanos / 1000000)).toISOString();
  }

  async SaveAmlRule(ctx, amlRuleJson) {
    if (!amlRuleJson) {
      throw new Error('AML rule payload is required');
    }

    let sourcePayload;

    try {
      sourcePayload = typeof amlRuleJson === 'string'
        ? JSON.parse(amlRuleJson)
        : amlRuleJson;
    } catch (error) {
      throw new Error(`Invalid AML rule JSON payload: ${error.message}`);
    }

    const ruleId = this._getAmlRuleIdFromPayload(sourcePayload);
    const ruleQueryId = this._getAmlRuleQueryIdFromPayload(sourcePayload);

    if (!ruleId) {
      throw new Error('RULE ID is required');
    }

    const key = this._amlRuleCompositeKey(ruleId, ruleQueryId);
    const existingBytes = await ctx.stub.getState(key);
    const now = this._getFabricTxTimestampIso(ctx);
    const txId = ctx.stub.getTxID();

    let existingRecord = null;

    if (existingBytes && existingBytes.length > 0) {
      existingRecord = JSON.parse(existingBytes.toString());
    }

    const record = {
      docType: 'AML_RULE',
      ledgerReference: key,
      ruleId,
      ruleQueryId,

      ruleDesc: sourcePayload.ruleDesc || sourcePayload['RULE DESC'] || null,
      ruleStatus: String(sourcePayload.ruleStatus || sourcePayload['RULE STATUS'] || ''),
      ruleStartDate: sourcePayload.ruleStartDate || sourcePayload['RULE START DATE'] || null,
      ruleExpiryDate: sourcePayload.ruleExpiryDate || sourcePayload['RULE EXPIRY DATE'] || null,
      ruleCreationDate: sourcePayload.ruleCreationDate || sourcePayload['RULE CREATION DATE'] || null,
      ruleCreator: String(sourcePayload.ruleCreator || sourcePayload['RULE CREATOR'] || ''),
      ruleUpdateDate: sourcePayload.ruleUpdateDate || sourcePayload['RULE UPDATE DATE'] || null,
      ruleUpdator: String(sourcePayload.ruleUpdator || sourcePayload['RULE UPDATOR'] || ''),
      ruleMessage: sourcePayload.ruleMessage || sourcePayload['RULE MESSAGE'] || null,
      ruleSqlQuery: sourcePayload.ruleSqlQuery || sourcePayload['RULE SQL QUERY'] || null,
      ruleQueryCreationDate: sourcePayload.ruleQueryCreationDate || sourcePayload['RULE QUERY CREATION DATE'] || null,
      ruleQueryCreatedBy: String(sourcePayload.ruleQueryCreatedBy || sourcePayload['RULE QUERY CREATED BY'] || ''),
      ruleApplicationQueryId: String(sourcePayload.ruleApplicationQueryId || sourcePayload['RULE APPLCIATION QUERY ID'] || ''),
      ruleQueryUpdateDate: sourcePayload.ruleQueryUpdateDate || sourcePayload['RULE QUERY UPDATE DATE'] || null,
      ruleQueryUpdateBy: String(sourcePayload.ruleQueryUpdateBy || sourcePayload['RULE QUERY UPDATE BY'] || ''),

      sourceSystem: 'POSTGRESQL_VIEW',
      sourceView: 'blockchain.valoores_aml_rules',
      sourcePayloadHash: this._amlRulePayloadHash(sourcePayload),
      rawSourceRecord: sourcePayload,

      blockchainStatus: 'CONFIRMED',
      createdAt: existingRecord?.createdAt || now,
      updatedAt: now,
      createdTxId: existingRecord?.createdTxId || txId,
      updatedTxId: txId
    };

    await ctx.stub.putState(key, Buffer.from(JSON.stringify(record)));

    return JSON.stringify({
      success: true,
      message: existingRecord
        ? 'AML rule updated on blockchain successfully'
        : 'AML rule created on blockchain successfully',
      data: {
        key,
        ruleId,
        ruleQueryId,
        blockchainTxId: txId,
        sourcePayloadHash: record.sourcePayloadHash,
        record
      }
    });
  }

  async GetAmlRule(ctx, ruleId, ruleQueryId) {
    if (!ruleId) {
      throw new Error('RULE ID is required');
    }

    if (ruleQueryId !== undefined && ruleQueryId !== null && String(ruleQueryId).trim() !== '') {
      const key = this._amlRuleCompositeKey(ruleId, ruleQueryId);
      const bytes = await ctx.stub.getState(key);

      if (!bytes || bytes.length === 0) {
        throw new Error(`AML rule not found on blockchain: ${ruleId}/${ruleQueryId}`);
      }

      return bytes.toString();
    }

    const selector = {
      selector: {
        docType: 'AML_RULE',
        ruleId: String(ruleId).trim()
      }
    };

    const iterator = await ctx.stub.getQueryResult(JSON.stringify(selector));
    const records = [];

    while (true) {
      const result = await iterator.next();

      if (result.value && result.value.value) {
        records.push(JSON.parse(result.value.value.toString('utf8')));
      }

      if (result.done) {
        await iterator.close();
        break;
      }
    }

    if (records.length > 0) {
      return JSON.stringify(records.length === 1 ? records[0] : records);
    }

    const legacyKey = this._amlRuleLegacyKey(ruleId);
    const legacyBytes = await ctx.stub.getState(legacyKey);

    if (!legacyBytes || legacyBytes.length === 0) {
      throw new Error(`AML rule not found on blockchain: ${ruleId}`);
    }

    return legacyBytes.toString();
  }

  async AmlRuleExists(ctx, ruleId, ruleQueryId) {
    if (!ruleId) {
      throw new Error('RULE ID is required');
    }

    const key = ruleQueryId
      ? this._amlRuleCompositeKey(ruleId, ruleQueryId)
      : this._amlRuleLegacyKey(ruleId);

    const bytes = await ctx.stub.getState(key);
    return Boolean(bytes && bytes.length > 0);
  }

  async QueryAmlRulesByStatus(ctx, ruleStatus) {
    const selector = {
      selector: {
        docType: 'AML_RULE',
        ruleStatus: String(ruleStatus || '')
      }
    };

    const iterator = await ctx.stub.getQueryResult(JSON.stringify(selector));
    const records = [];

    while (true) {
      const result = await iterator.next();

      if (result.value && result.value.value) {
        records.push({
          key: result.value.key,
          record: JSON.parse(result.value.value.toString('utf8'))
        });
      }

      if (result.done) {
        await iterator.close();
        break;
      }
    }

    return JSON.stringify(records);
  }

  async GetAllAmlRules(ctx) {
    const iterator = await ctx.stub.getStateByRange('AML_RULE_', 'AML_RULE_~');
    const records = [];

    while (true) {
      const result = await iterator.next();

      if (result.value && result.value.value) {
        const record = JSON.parse(result.value.value.toString('utf8'));

        if (record.docType === 'AML_RULE') {
          records.push({
            key: result.value.key,
            record
          });
        }
      }

      if (result.done) {
        await iterator.close();
        break;
      }
    }

    return JSON.stringify(records);
  }

  async GetAmlRuleHistory(ctx, ruleId, ruleQueryId) {
    if (!ruleId) {
      throw new Error('RULE ID is required');
    }

    const key = ruleQueryId
      ? this._amlRuleCompositeKey(ruleId, ruleQueryId)
      : this._amlRuleLegacyKey(ruleId);

    const iterator = await ctx.stub.getHistoryForKey(key);
    const history = [];

    while (true) {
      const result = await iterator.next();

      if (result.value) {
        let value = null;

        if (result.value.value && result.value.value.length > 0) {
          value = JSON.parse(result.value.value.toString('utf8'));
        }

        history.push({
          txId: result.value.txId,
          timestamp: result.value.timestamp,
          isDelete: result.value.isDelete,
          value
        });
      }

      if (result.done) {
        await iterator.close();
        break;
      }
    }

    return JSON.stringify(history);
  }

  /* ===== VALOORES AML RULE COMPOSITE KEY OVERRIDES END ===== */



    /**
     * SaveBlockchainProof
     *
     * Stores proof only on-chain.
     * PostgreSQL remains source of truth.
     * No sensitive source payload is allowed.
     */
    async SaveBlockchainProof(
        ctx,
        blockchainKey,
        recordType,
        sourceRecordId,
        stableHash,
        actionType,
        postgresHistoryId,
        submittedBy,
        metadataJson
    ) {
        if (!blockchainKey || !recordType || !sourceRecordId || !stableHash || !actionType) {
            throw new Error('Missing required blockchain proof fields');
        }

        const normalizedRecordType = String(recordType).trim().toUpperCase();
        const normalizedActionType = String(actionType).trim().toUpperCase();

        if (!['CREATE', 'UPDATE'].includes(normalizedActionType)) {
            throw new Error('Invalid actionType. Expected CREATE or UPDATE');
        }

        const existingProofBytes = await ctx.stub.getState(blockchainKey);

        if (existingProofBytes && existingProofBytes.length > 0) {
            throw new Error(`Blockchain proof already exists for key: ${blockchainKey}`);
        }

        let metadata = {};

        if (metadataJson) {
            try {
                metadata = JSON.parse(metadataJson);
            } catch (error) {
                throw new Error(`Invalid metadata JSON: ${error.message}`);
            }
        }

        const sensitiveKeys = [
            'password',
            'token',
            'secret',
            'authorization',
            'personal_entity',
            'photo',
            'customer_full_data',
            'raw_payload',
            'raw_record',
            'aml_full_data',
            'transaction_full_data'
        ];

        const metadataText = JSON.stringify(metadata).toLowerCase();

        for (const sensitiveKey of sensitiveKeys) {
            if (metadataText.includes(sensitiveKey)) {
                throw new Error(`Sensitive metadata is not allowed on blockchain: ${sensitiveKey}`);
            }
        }

        const txTimestamp = ctx.stub.getTxTimestamp();
        const seconds = txTimestamp.seconds.low || txTimestamp.seconds;
        const nanos = txTimestamp.nanos || 0;
        const txDate = new Date((Number(seconds) * 1000) + Math.floor(Number(nanos) / 1000000));

        const proof = {
            docType: 'BLOCKCHAIN_PROOF',
            blockchainKey,
            recordType: normalizedRecordType,
            sourceRecordId: String(sourceRecordId),
            stableHash: String(stableHash),
            hashAlgorithm: 'SHA-256',
            actionType: normalizedActionType,
            postgresHistoryId: String(postgresHistoryId || ''),
            submittedBy: String(submittedBy || 'postgres-blockchain-proof-sync-service'),
            metadata,
            txId: ctx.stub.getTxID(),
            createdAt: txDate.toISOString()
        };

        await ctx.stub.putState(blockchainKey, Buffer.from(JSON.stringify(proof)));

        const recordTypeIndexKey = ctx.stub.createCompositeKey(
            'proof~recordType~sourceRecordId',
            [normalizedRecordType, String(sourceRecordId), blockchainKey]
        );

        await ctx.stub.putState(recordTypeIndexKey, Buffer.from('\u0000'));

        return JSON.stringify(proof);
    }

    /**
     * GetBlockchainProof
     *
     * Returns one proof by blockchain key.
     */
    async GetBlockchainProof(ctx, blockchainKey) {
        if (!blockchainKey) {
            throw new Error('blockchainKey is required');
        }

        const proofBytes = await ctx.stub.getState(blockchainKey);

        if (!proofBytes || proofBytes.length === 0) {
            throw new Error(`Blockchain proof not found for key: ${blockchainKey}`);
        }

        return proofBytes.toString();
    }

    /**
     * VerifyBlockchainProof
     *
     * Compares the submitted hash with the stored on-chain hash.
     */
    async VerifyBlockchainProof(ctx, blockchainKey, stableHash) {
        if (!blockchainKey || !stableHash) {
            throw new Error('blockchainKey and stableHash are required');
        }

        const proofBytes = await ctx.stub.getState(blockchainKey);

        if (!proofBytes || proofBytes.length === 0) {
            throw new Error(`Blockchain proof not found for key: ${blockchainKey}`);
        }

        const proof = JSON.parse(proofBytes.toString());
        const verified = proof.stableHash === String(stableHash);

        return JSON.stringify({
            blockchainKey,
            recordType: proof.recordType,
            sourceRecordId: proof.sourceRecordId,
            storedHash: proof.stableHash,
            submittedHash: String(stableHash),
            verified,
            status: verified ? 'VERIFIED' : 'MISMATCHED',
            txId: proof.txId,
            createdAt: proof.createdAt
        });
    }

    /**
     * QueryBlockchainProofsByRecordType
     *
     * Queries proof records by record type using composite key index.
     */
    async QueryBlockchainProofsByRecordType(ctx, recordType) {
        if (!recordType) {
            throw new Error('recordType is required');
        }

        const normalizedRecordType = String(recordType).trim().toUpperCase();

        const iterator = await ctx.stub.getStateByPartialCompositeKey(
            'proof~recordType~sourceRecordId',
            [normalizedRecordType]
        );

        const results = [];

        while (true) {
            const response = await iterator.next();

            if (response.value && response.value.key) {
                const attributes = ctx.stub.splitCompositeKey(response.value.key).attributes;
                const blockchainKey = attributes[2];

                const proofBytes = await ctx.stub.getState(blockchainKey);

                if (proofBytes && proofBytes.length > 0) {
                    results.push(JSON.parse(proofBytes.toString()));
                }
            }

            if (response.done) {
                await iterator.close();
                break;
            }
        }

        return JSON.stringify(results);
    }

    /**
     * GetBlockchainProofHistory
     *
     * Returns Fabric history for the blockchain proof key.
     */
    async GetBlockchainProofHistory(ctx, blockchainKey) {
        if (!blockchainKey) {
            throw new Error('blockchainKey is required');
        }

        const iterator = await ctx.stub.getHistoryForKey(blockchainKey);
        const results = [];

        while (true) {
            const response = await iterator.next();

            if (response.value) {
                const item = {
                    txId: response.value.txId,
                    timestamp: response.value.timestamp,
                    isDelete: response.value.isDelete,
                    value: response.value.value && response.value.value.toString()
                        ? JSON.parse(response.value.value.toString())
                        : null
                };

                results.push(item);
            }

            if (response.done) {
                await iterator.close();
                break;
            }
        }

        return JSON.stringify(results);
    }


    /* ===== PHASE 10 BLOCKCHAIN PROOF FUNCTIONS START ===== */

    /**
     * SubmitProof
     *
     * Stores only Phase 10 proof data on-chain.
     * No source payload, no PII, no raw record, and no metadata are accepted.
     *
     * Expected JSON payload:
     * {
     *   "blockchainKey": "...",
     *   "moduleName": "...",
     *   "sourceRecordId": "...",
     *   "recordHash": "...",
     *   "hashVersion": "...",
     *   "actionType": "...",
     *   "sourceSystem": "...",
     *   "approvedBy": "..."
     * }
     */
    async SubmitProof(ctx, proofPayloadJson) {
        const payload = this._parsePhase10ProofPayload(proofPayloadJson);
        const proof = this._buildPhase10Proof(ctx, payload);

        const existingProofBytes = await ctx.stub.getState(proof.blockchainKey);

        if (existingProofBytes && existingProofBytes.length > 0) {
            throw new Error(`Proof already exists for blockchainKey: ${proof.blockchainKey}`);
        }

        await ctx.stub.putState(
            proof.blockchainKey,
            Buffer.from(JSON.stringify(proof))
        );

        const moduleIndexKey = ctx.stub.createCompositeKey(
            'proof~moduleName~blockchainKey',
            [proof.moduleName, proof.blockchainKey]
        );

        const recordIndexKey = ctx.stub.createCompositeKey(
            'proof~sourceRecordId~blockchainKey',
            [proof.sourceRecordId, proof.blockchainKey]
        );

        await ctx.stub.putState(moduleIndexKey, Buffer.from('\u0000'));
        await ctx.stub.putState(recordIndexKey, Buffer.from('\u0000'));

        return JSON.stringify(proof);
    }

    /**
     * GetProof
     *
     * Returns one Phase 10 proof by blockchain key.
     */
    async GetProof(ctx, blockchainKey) {
        const normalizedKey = this._normalizePhase10ProofString(
            blockchainKey,
            'blockchainKey'
        );

        const proof = await this._getPhase10ProofByKey(ctx, normalizedKey);

        return JSON.stringify(proof);
    }

    /**
     * VerifyProof
     *
     * Compares the submitted record hash against the stored on-chain record hash.
     */
    async VerifyProof(ctx, blockchainKey, recordHash) {
        const normalizedKey = this._normalizePhase10ProofString(
            blockchainKey,
            'blockchainKey'
        );

        const normalizedHash = this._normalizePhase10RecordHash(recordHash);
        const proof = await this._getPhase10ProofByKey(ctx, normalizedKey);
        const verified = proof.recordHash === normalizedHash;

        return JSON.stringify({
            blockchainKey: proof.blockchainKey,
            moduleName: proof.moduleName,
            sourceRecordId: proof.sourceRecordId,
            storedHash: proof.recordHash,
            submittedHash: normalizedHash,
            hashVersion: proof.hashVersion,
            verified,
            status: verified ? 'VERIFIED' : 'MISMATCHED',
            timestamp: proof.timestamp
        });
    }

    /**
     * QueryProofsByModule
     *
     * Returns Phase 10 proofs for one module name.
     */
    async QueryProofsByModule(ctx, moduleName) {
        const normalizedModuleName = this._normalizePhase10ProofString(
            moduleName,
            'moduleName'
        ).toUpperCase();

        const results = await this._queryPhase10ProofsByCompositeIndex(
            ctx,
            'proof~moduleName~blockchainKey',
            [normalizedModuleName]
        );

        return JSON.stringify(results);
    }

    /**
     * QueryProofsByRecordId
     *
     * Returns Phase 10 proofs for one source record ID.
     */
    async QueryProofsByRecordId(ctx, sourceRecordId) {
        const normalizedSourceRecordId = this._normalizePhase10ProofString(
            sourceRecordId,
            'sourceRecordId'
        );

        const results = await this._queryPhase10ProofsByCompositeIndex(
            ctx,
            'proof~sourceRecordId~blockchainKey',
            [normalizedSourceRecordId]
        );

        return JSON.stringify(results);
    }


    /**
     * SaveAuditEventProof
     *
     * Stores only audit event proof metadata and hashes on-chain.
     * Raw old/new rows, PII, changed field values, and business payloads
     * are intentionally rejected.
     */
    async SaveAuditEventProof(ctx, auditEventProofJson) {
        const payload = this._parseAuditProofJsonObject(
            auditEventProofJson,
            'auditEventProofJson'
        );

        this._assertAllowedAuditEventProofFields(payload);

        const auditId = this._normalizeAuditProofString(
            payload.auditId || payload.audit_id || payload.auditEventId || payload.audit_event_id,
            'auditId'
        );

        const auditEventHash = this._normalizeAuditProofString(
            payload.auditEventHash || payload.audit_event_hash,
            'auditEventHash'
        );

        const blockchainKey = this._normalizeOptionalAuditProofString(
            payload.blockchainKey || payload.blockchain_key,
            'blockchainKey',
            this._auditEventProofKey(auditId)
        );

        const primaryStateKey = this._auditEventProofKey(blockchainKey);
        const auditIdStateKey = this._auditEventProofKey(auditId);

        const existingPrimaryProofBytes = await ctx.stub.getState(primaryStateKey);

        if (existingPrimaryProofBytes && existingPrimaryProofBytes.length > 0) {
            throw new Error(`Audit event proof already exists for key: ${primaryStateKey}`);
        }

        if (auditIdStateKey !== primaryStateKey) {
            const existingAuditIdProofBytes = await ctx.stub.getState(auditIdStateKey);

            if (existingAuditIdProofBytes && existingAuditIdProofBytes.length > 0) {
                throw new Error(`Audit event proof already exists for key: ${auditIdStateKey}`);
            }
        }

        const proof = this._compactAuditProofObject({
            docType: 'AUDIT_EVENT_PROOF',
            blockchainKey,
            auditId,
            auditEventHash,
            oldRowHash: this._normalizeOptionalAuditProofString(payload.oldRowHash || payload.old_row_hash, 'oldRowHash'),
            newRowHash: this._normalizeOptionalAuditProofString(payload.newRowHash || payload.new_row_hash, 'newRowHash'),
            schemaHash: this._normalizeOptionalAuditProofString(payload.schemaHash || payload.schema_hash, 'schemaHash'),
            tableHash: this._normalizeOptionalAuditProofString(payload.tableHash || payload.table_hash, 'tableHash'),
            primaryKeyHash: this._normalizeOptionalAuditProofString(payload.primaryKeyHash || payload.primary_key_hash, 'primaryKeyHash'),
            changedFieldsHash: this._normalizeOptionalAuditProofString(payload.changedFieldsHash || payload.changed_fields_hash, 'changedFieldsHash'),
            actorHash: this._normalizeOptionalAuditProofString(payload.actorHash || payload.actor_hash, 'actorHash'),
            clientIpHash: this._normalizeOptionalAuditProofString(payload.clientIpHash || payload.client_ip_hash, 'clientIpHash'),
            clientHostnameHash: this._normalizeOptionalAuditProofString(payload.clientHostnameHash || payload.client_hostname_hash, 'clientHostnameHash'),
            requestIdHash: this._normalizeOptionalAuditProofString(payload.requestIdHash || payload.request_id_hash, 'requestIdHash'),
            operationType: this._normalizeOptionalAuditProofString(payload.operationType || payload.operation_type, 'operationType'),
            hashAlgorithm: this._normalizeOptionalAuditProofString(payload.hashAlgorithm || payload.hash_algorithm, 'hashAlgorithm', 'SHA-256'),
            hashVersion: this._normalizeOptionalAuditProofString(payload.hashVersion || payload.hash_version, 'hashVersion', 'v1'),
            proofVersion: this._normalizeOptionalAuditProofString(payload.proofVersion || payload.proof_version, 'proofVersion', 'phase-28-audit-event-proof-v1'),
            sourceSystem: this._normalizeOptionalAuditProofString(payload.sourceSystem || payload.source_system, 'sourceSystem', 'postgresql-data-change-audit'),
            generatedAt: this._normalizeOptionalAuditProofString(payload.generatedAt || payload.generated_at, 'generatedAt'),
            submittedBy: this._normalizeOptionalAuditProofString(payload.submittedBy || payload.submitted_by, 'submittedBy', 'audit-blockchain-outbox-worker'),
            txId: ctx.stub.getTxID(),
            createdAt: this._getAuditProofTimestamp(ctx)
        });

        const proofBuffer = Buffer.from(JSON.stringify(proof));

        await ctx.stub.putState(primaryStateKey, proofBuffer);

        if (auditIdStateKey !== primaryStateKey) {
            await ctx.stub.putState(auditIdStateKey, proofBuffer);
        }

        await ctx.stub.putState(
            ctx.stub.createCompositeKey('auditEventProof~auditId', [auditId]),
            Buffer.from('\u0000')
        );

        await ctx.stub.putState(
            ctx.stub.createCompositeKey('auditEventProof~auditEventHash~auditId', [auditEventHash, auditId]),
            Buffer.from('\u0000')
        );

        return JSON.stringify(proof);
    }

    async GetAuditEventProof(ctx, auditIdOrBlockchainKey) {
        const key = this._auditEventProofKey(auditIdOrBlockchainKey);
        const proofBytes = await ctx.stub.getState(key);

        if (!proofBytes || proofBytes.length === 0) {
            throw new Error(`Audit event proof not found for key: ${key}`);
        }

        return proofBytes.toString();
    }

    async VerifyAuditEventProof(ctx, auditIdOrBlockchainKey, auditEventHash) {
        const key = this._auditEventProofKey(auditIdOrBlockchainKey);
        const expectedHash = this._normalizeAuditProofString(auditEventHash, 'auditEventHash');
        const proofBytes = await ctx.stub.getState(key);

        if (!proofBytes || proofBytes.length === 0) {
            return JSON.stringify({
                status: 'NOT_FOUND',
                verified: false,
                blockchainKey: key,
                message: 'Audit event proof not found'
            });
        }

        const proof = JSON.parse(proofBytes.toString());
        const verified = proof.auditEventHash === expectedHash;

        return JSON.stringify({
            status: verified ? 'VERIFIED' : 'MISMATCH',
            verified,
            blockchainKey: key,
            auditId: proof.auditId,
            storedHash: proof.auditEventHash,
            suppliedHash: expectedHash,
            txId: proof.txId,
            createdAt: proof.createdAt
        });
    }

    async QueryAuditEventProofs(ctx, filterJson = '{}') {
        const filters = filterJson && String(filterJson).trim() !== ''
            ? this._parseAuditProofJsonObject(filterJson, 'filterJson')
            : {};

        const auditIdFilter = filters.auditId || filters.audit_id
            ? this._normalizeAuditProofString(filters.auditId || filters.audit_id, 'auditId')
            : null;

        const hashFilter = filters.auditEventHash || filters.audit_event_hash
            ? this._normalizeAuditProofString(filters.auditEventHash || filters.audit_event_hash, 'auditEventHash')
            : null;

        const limit = this._normalizeAuditProofLimit(filters.limit, 100);
        const results = [];

        const iterator = await ctx.stub.getStateByPartialCompositeKey(
            'auditEventProof~auditId',
            auditIdFilter ? [auditIdFilter] : []
        );

        try {
            while (true) {
                const response = await iterator.next();

                if (response.value && response.value.key) {
                    const composite = ctx.stub.splitCompositeKey(response.value.key);
                    const auditId = composite.attributes[0];
                    const proofKey = this._auditEventProofKey(auditId);
                    const proofBytes = await ctx.stub.getState(proofKey);

                    if (proofBytes && proofBytes.length > 0) {
                        const proof = JSON.parse(proofBytes.toString());

                        if (!hashFilter || proof.auditEventHash === hashFilter) {
                            results.push(proof);
                        }
                    }
                }

                if (response.done || results.length >= limit) {
                    break;
                }
            }
        } finally {
            if (iterator && typeof iterator.close === 'function') {
                await iterator.close();
            }
        }

        return JSON.stringify(results);
    }

    async SaveAuditBatchProof(ctx, auditBatchProofJson) {
        const payload = this._parseAuditProofJsonObject(
            auditBatchProofJson,
            'auditBatchProofJson'
        );

        this._assertAllowedAuditBatchProofFields(payload);

        const batchId = this._normalizeAuditProofString(
            payload.batchId || payload.batch_id,
            'batchId'
        );

        const batchHash = this._normalizeAuditProofString(
            payload.batchHash || payload.batch_hash,
            'batchHash'
        );

        const blockchainKey = this._normalizeOptionalAuditProofString(
            payload.blockchainKey || payload.blockchain_key,
            'blockchainKey',
            this._auditBatchProofKey(batchId)
        );

        const existingProofBytes = await ctx.stub.getState(blockchainKey);

        if (existingProofBytes && existingProofBytes.length > 0) {
            throw new Error(`Audit batch proof already exists for key: ${blockchainKey}`);
        }

        const proof = this._compactAuditProofObject({
            docType: 'AUDIT_BATCH_PROOF',
            blockchainKey,
            batchId,
            batchHash,
            merkleRootHash: this._normalizeOptionalAuditProofString(payload.merkleRootHash || payload.merkle_root_hash, 'merkleRootHash'),
            auditEventCount: this._normalizeOptionalAuditProofInteger(payload.auditEventCount || payload.audit_event_count, 'auditEventCount'),
            firstAuditId: this._normalizeOptionalAuditProofString(payload.firstAuditId || payload.first_audit_id, 'firstAuditId'),
            lastAuditId: this._normalizeOptionalAuditProofString(payload.lastAuditId || payload.last_audit_id, 'lastAuditId'),
            hashAlgorithm: this._normalizeOptionalAuditProofString(payload.hashAlgorithm || payload.hash_algorithm, 'hashAlgorithm', 'SHA-256'),
            hashVersion: this._normalizeOptionalAuditProofString(payload.hashVersion || payload.hash_version, 'hashVersion', 'v1'),
            proofVersion: this._normalizeOptionalAuditProofString(payload.proofVersion || payload.proof_version, 'proofVersion', 'phase-28-audit-batch-proof-v1'),
            sourceSystem: this._normalizeOptionalAuditProofString(payload.sourceSystem || payload.source_system, 'sourceSystem', 'postgresql-data-change-audit'),
            generatedAt: this._normalizeOptionalAuditProofString(payload.generatedAt || payload.generated_at, 'generatedAt'),
            submittedBy: this._normalizeOptionalAuditProofString(payload.submittedBy || payload.submitted_by, 'submittedBy', 'audit-blockchain-outbox-worker'),
            txId: ctx.stub.getTxID(),
            createdAt: this._getAuditProofTimestamp(ctx)
        });

        await ctx.stub.putState(blockchainKey, Buffer.from(JSON.stringify(proof)));

        await ctx.stub.putState(
            ctx.stub.createCompositeKey('auditBatchProof~batchId', [batchId]),
            Buffer.from('\u0000')
        );

        return JSON.stringify(proof);
    }

    async GetAuditBatchProof(ctx, batchIdOrBlockchainKey) {
        const key = this._auditBatchProofKey(batchIdOrBlockchainKey);
        const proofBytes = await ctx.stub.getState(key);

        if (!proofBytes || proofBytes.length === 0) {
            throw new Error(`Audit batch proof not found for key: ${key}`);
        }

        return proofBytes.toString();
    }

    async VerifyAuditBatchProof(ctx, batchIdOrBlockchainKey, batchHash) {
        const key = this._auditBatchProofKey(batchIdOrBlockchainKey);
        const expectedHash = this._normalizeAuditProofString(batchHash, 'batchHash');
        const proofBytes = await ctx.stub.getState(key);

        if (!proofBytes || proofBytes.length === 0) {
            return JSON.stringify({
                status: 'NOT_FOUND',
                verified: false,
                blockchainKey: key,
                message: 'Audit batch proof not found'
            });
        }

        const proof = JSON.parse(proofBytes.toString());
        const verified = proof.batchHash === expectedHash;

        return JSON.stringify({
            status: verified ? 'VERIFIED' : 'MISMATCH',
            verified,
            blockchainKey: key,
            batchId: proof.batchId,
            storedHash: proof.batchHash,
            suppliedHash: expectedHash,
            txId: proof.txId,
            createdAt: proof.createdAt
        });
    }

    _auditEventProofKey(auditIdOrBlockchainKey) {
        const value = this._normalizeAuditProofString(auditIdOrBlockchainKey, 'auditIdOrBlockchainKey');

        return value.startsWith('audit_event_proof:')
            ? value
            : `audit_event_proof:${value}`;
    }

    _auditBatchProofKey(batchIdOrBlockchainKey) {
        const value = this._normalizeAuditProofString(batchIdOrBlockchainKey, 'batchIdOrBlockchainKey');

        return value.startsWith('audit_batch_proof:')
            ? value
            : `audit_batch_proof:${value}`;
    }

    _parseAuditProofJsonObject(jsonText, fieldName) {
        if (!jsonText || String(jsonText).trim() === '') {
            throw new Error(`${fieldName} is required`);
        }

        let payload;

        try {
            payload = JSON.parse(jsonText);
        } catch (error) {
            throw new Error(`Invalid ${fieldName}: ${error.message}`);
        }

        if (!payload || Array.isArray(payload) || typeof payload !== 'object') {
            throw new Error(`${fieldName} must be a JSON object`);
        }

        return payload;
    }

    _assertAllowedAuditEventProofFields(payload) {
        const allowedFields = new Set([
            'auditId', 'audit_id', 'auditEventId', 'audit_event_id',
            'blockchainKey', 'blockchain_key',
            'auditEventHash', 'audit_event_hash',
            'oldRowHash', 'old_row_hash',
            'newRowHash', 'new_row_hash',
            'schemaHash', 'schema_hash',
            'tableHash', 'table_hash',
            'primaryKeyHash', 'primary_key_hash',
            'changedFieldsHash', 'changed_fields_hash',
            'actorHash', 'actor_hash',
            'clientIpHash', 'client_ip_hash',
            'clientHostnameHash', 'client_hostname_hash',
            'requestIdHash', 'request_id_hash',
            'operationType', 'operation_type',
            'hashAlgorithm', 'hash_algorithm',
            'hashVersion', 'hash_version',
            'proofVersion', 'proof_version',
            'sourceSystem', 'source_system',
            'generatedAt', 'generated_at',
            'submittedBy', 'submitted_by'
        ]);

        this._assertAuditProofAllowedFields(payload, allowedFields, 'auditEventProofJson');
    }

    _assertAllowedAuditBatchProofFields(payload) {
        const allowedFields = new Set([
            'batchId', 'batch_id',
            'blockchainKey', 'blockchain_key',
            'batchHash', 'batch_hash',
            'merkleRootHash', 'merkle_root_hash',
            'auditEventCount', 'audit_event_count',
            'firstAuditId', 'first_audit_id',
            'lastAuditId', 'last_audit_id',
            'hashAlgorithm', 'hash_algorithm',
            'hashVersion', 'hash_version',
            'proofVersion', 'proof_version',
            'sourceSystem', 'source_system',
            'generatedAt', 'generated_at',
            'submittedBy', 'submitted_by'
        ]);

        this._assertAuditProofAllowedFields(payload, allowedFields, 'auditBatchProofJson');
    }

    _assertAuditProofAllowedFields(payload, allowedFields, payloadName) {
        for (const field of Object.keys(payload)) {
            if (!allowedFields.has(field)) {
                throw new Error(
                    `Field not allowed in ${payloadName}: ${field}. ` +
                    'Only hashes and non-sensitive proof metadata may be stored on-chain.'
                );
            }

            const value = payload[field];

            if (value && typeof value === 'object') {
                throw new Error(
                    `Nested object not allowed in ${payloadName}: ${field}. ` +
                    'Raw row data, PII, and business payloads must stay off-chain.'
                );
            }
        }
    }

    _normalizeAuditProofString(value, fieldName, maxLength = 512) {
        if (value === undefined || value === null) {
            throw new Error(`${fieldName} is required`);
        }

        const normalized = String(value)
            .replace(/[\u0000-\u001F\u007F]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        if (!normalized) {
            throw new Error(`${fieldName} is required`);
        }

        if (normalized.length > maxLength) {
            throw new Error(`${fieldName} exceeds maximum length ${maxLength}`);
        }

        return normalized;
    }

    _normalizeOptionalAuditProofString(value, fieldName, fallback = undefined) {
        if (value === undefined || value === null || String(value).trim() === '') {
            return fallback;
        }

        return this._normalizeAuditProofString(value, fieldName);
    }

    _normalizeOptionalAuditProofInteger(value, fieldName) {
        if (value === undefined || value === null || String(value).trim() === '') {
            return undefined;
        }

        const numberValue = Number(value);

        if (!Number.isInteger(numberValue) || numberValue < 0) {
            throw new Error(`${fieldName} must be a non-negative integer`);
        }

        return numberValue;
    }

    _normalizeAuditProofLimit(value, fallback) {
        if (value === undefined || value === null || String(value).trim() === '') {
            return fallback;
        }

        const numberValue = Number(value);

        if (!Number.isInteger(numberValue) || numberValue < 1 || numberValue > 1000) {
            throw new Error('limit must be an integer between 1 and 1000');
        }

        return numberValue;
    }

    _compactAuditProofObject(value) {
        return Object.fromEntries(
            Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
        );
    }

    _getAuditProofTimestamp(ctx) {
        try {
            const timestamp = ctx.stub.getTxTimestamp();

            if (!timestamp) {
                return new Date(0).toISOString();
            }

            const seconds = timestamp.seconds && typeof timestamp.seconds === 'object'
                ? Number(timestamp.seconds.low || timestamp.seconds.toNumber?.() || 0)
                : Number(timestamp.seconds || 0);

            const nanos = Number(timestamp.nanos || 0);

            return new Date(seconds * 1000 + Math.floor(nanos / 1000000)).toISOString();
        } catch (error) {
            return new Date(0).toISOString();
        }
    }


    _parsePhase10ProofPayload(proofPayloadJson) {
        if (!proofPayloadJson || String(proofPayloadJson).trim() === '') {
            throw new Error('proofPayloadJson is required');
        }

        let payload;

        try {
            payload = JSON.parse(proofPayloadJson);
        } catch (error) {
            throw new Error(`Invalid proofPayloadJson: ${error.message}`);
        }

        if (!payload || Array.isArray(payload) || typeof payload !== 'object') {
            throw new Error('proofPayloadJson must be a JSON object');
        }

        return payload;
    }

    _buildPhase10Proof(ctx, payload) {
        const allowedFields = [
            'blockchainKey',
            'moduleName',
            'sourceRecordId',
            'recordHash',
            'hashVersion',
            'actionType',
            'sourceSystem',
            'approvedBy'
        ];

        const receivedFields = Object.keys(payload);

        for (const field of receivedFields) {
            if (!allowedFields.includes(field)) {
                throw new Error(`Invalid proof field not allowed on blockchain: ${field}`);
            }
        }

        const blockchainKey = this._normalizePhase10ProofString(
            payload.blockchainKey,
            'blockchainKey'
        );

        const moduleName = this._normalizePhase10ProofString(
            payload.moduleName,
            'moduleName'
        ).toUpperCase();

        const sourceRecordId = this._normalizePhase10ProofString(
            payload.sourceRecordId,
            'sourceRecordId'
        );

        const recordHash = this._normalizePhase10RecordHash(payload.recordHash);

        const hashVersion = this._normalizePhase10ProofString(
            payload.hashVersion,
            'hashVersion'
        );

        const actionType = this._normalizePhase10ActionType(payload.actionType);

        const sourceSystem = this._normalizePhase10ProofString(
            payload.sourceSystem,
            'sourceSystem'
        ).toUpperCase();

        const approvedBy = this._normalizePhase10ProofString(
            payload.approvedBy,
            'approvedBy'
        );

        this._assertPhase10SafeValue(blockchainKey, 'blockchainKey');
        this._assertPhase10SafeValue(moduleName, 'moduleName');
        this._assertPhase10SafeValue(sourceRecordId, 'sourceRecordId');
        this._assertPhase10SafeValue(hashVersion, 'hashVersion');
        this._assertPhase10SafeValue(sourceSystem, 'sourceSystem');
        this._assertPhase10SafeValue(approvedBy, 'approvedBy');

        return {
            blockchainKey,
            moduleName,
            sourceRecordId,
            recordHash,
            hashVersion,
            actionType,
            sourceSystem,
            approvedBy,
            timestamp: this._getPhase10TxTimestamp(ctx)
        };
    }

    _normalizePhase10ProofString(value, fieldName) {
        if (value === undefined || value === null) {
            throw new Error(`${fieldName} is required`);
        }

        const normalizedValue = String(value).trim();

        if (normalizedValue === '') {
            throw new Error(`${fieldName} cannot be empty`);
        }

        if (normalizedValue.length > 256) {
            throw new Error(`${fieldName} cannot exceed 256 characters`);
        }

        return normalizedValue;
    }

    _normalizePhase10RecordHash(recordHash) {
        const normalizedHash = this._normalizePhase10ProofString(
            recordHash,
            'recordHash'
        ).toLowerCase();

        if (!/^[a-f0-9]{64}$/.test(normalizedHash)) {
            throw new Error('recordHash must be a SHA-256 hex string with 64 characters');
        }

        return normalizedHash;
    }

    _normalizePhase10ActionType(actionType) {
        const normalizedActionType = this._normalizePhase10ProofString(
            actionType,
            'actionType'
        ).toUpperCase();

        const allowedActionTypes = [
            'CREATE',
            'UPDATE',
            'DELETE',
            'SUBMIT',
            'APPROVE',
            'REJECT',
            'SYNC',
            'VERIFY'
        ];

        if (!allowedActionTypes.includes(normalizedActionType)) {
            throw new Error(
                `Invalid actionType. Expected one of: ${allowedActionTypes.join(', ')}`
            );
        }

        return normalizedActionType;
    }

    _assertPhase10SafeValue(value, fieldName) {
        const normalizedValue = String(value).toLowerCase();

        const forbiddenPatterns = [
            'password',
            'token',
            'secret',
            'authorization',
            'bearer',
            'private_key',
            'raw_payload',
            'raw_record',
            'full_data',
            'photo',
            'image',
            'base64',
            'national_id_number',
            'passport_number',
            'mobile_number',
            'email_address'
        ];

        for (const pattern of forbiddenPatterns) {
            if (normalizedValue.includes(pattern)) {
                throw new Error(`Sensitive value is not allowed in ${fieldName}`);
            }
        }
    }

    async _getPhase10ProofByKey(ctx, blockchainKey) {
        const proofBytes = await ctx.stub.getState(blockchainKey);

        if (!proofBytes || proofBytes.length === 0) {
            throw new Error(`Proof not found for blockchainKey: ${blockchainKey}`);
        }

        return JSON.parse(proofBytes.toString());
    }

    async _queryPhase10ProofsByCompositeIndex(ctx, indexName, attributes) {
        const iterator = await ctx.stub.getStateByPartialCompositeKey(
            indexName,
            attributes
        );

        const results = [];

        try {
            while (true) {
                const response = await iterator.next();

                if (response.value && response.value.key) {
                    const compositeKeyParts = ctx.stub.splitCompositeKey(
                        response.value.key
                    );

                    const blockchainKey =
                        compositeKeyParts.attributes[
                            compositeKeyParts.attributes.length - 1
                        ];

                    const proofBytes = await ctx.stub.getState(blockchainKey);

                    if (proofBytes && proofBytes.length > 0) {
                        results.push(JSON.parse(proofBytes.toString()));
                    }
                }

                if (response.done) {
                    break;
                }
            }
        } finally {
            await iterator.close();
        }

        return results;
    }

    _getPhase10TxTimestamp(ctx) {
        const timestamp = ctx.stub.getTxTimestamp();
        let seconds = 0;

        if (
            timestamp &&
            timestamp.seconds &&
            typeof timestamp.seconds.low !== 'undefined'
        ) {
            seconds = Number(timestamp.seconds.low);
        } else if (timestamp && timestamp.seconds) {
            seconds = Number(timestamp.seconds);
        }

        const nanos = timestamp && timestamp.nanos ? Number(timestamp.nanos) : 0;
        const milliseconds = seconds * 1000 + Math.floor(nanos / 1000000);

        return new Date(milliseconds).toISOString();
    }

    /* ===== PHASE 10 BLOCKCHAIN PROOF FUNCTIONS END ===== */

/* ===== VALOORES FULL KYC VERSIONING V1 START ===== */

    _fullKycParseObject(value, fieldName) {
        if (value === undefined || value === null || String(value).trim() === '') {
            throw new Error(`${fieldName} is required`);
        }

        let parsedValue;

        try {
            parsedValue = typeof value === 'string'
                ? JSON.parse(value)
                : value;
        } catch (error) {
            throw new Error(`Invalid ${fieldName}: ${error.message}`);
        }

        if (
            !parsedValue ||
            Array.isArray(parsedValue) ||
            typeof parsedValue !== 'object'
        ) {
            throw new Error(`${fieldName} must be a JSON object`);
        }

        return this._fullKycClone(parsedValue);
    }

    _fullKycClone(value) {
        if (value === undefined) {
            return undefined;
        }

        return JSON.parse(JSON.stringify(value));
    }

    _fullKycNormalizeResidentId(value) {
        const normalizedValue = String(value || '').trim();

        if (!normalizedValue) {
            throw new Error('residentId is required');
        }

        return normalizedValue.startsWith('VALOORES-')
            ? normalizedValue
            : `VALOORES-${normalizedValue}`;
    }

    _fullKycResolveResidentId(payload) {
        const explicitResidentId = String(
            payload.residentId ||
            payload.resident_id ||
            ''
        ).trim();

        if (explicitResidentId) {
            return this._fullKycNormalizeResidentId(explicitResidentId);
        }

        const customerId = String(
            payload.customerId ||
            payload.customer_id ||
            payload.formData?.CUSTOMER_ID ||
            ''
        ).trim();

        if (!customerId) {
            throw new Error(
                'residentId, customerId, or customer_id is required'
            );
        }

        return this._fullKycNormalizeResidentId(customerId);
    }

    _fullKycCustomerId(payload, residentId) {
        return String(
            payload.customerId ||
            payload.customer_id ||
            payload.formData?.CUSTOMER_ID ||
            String(residentId).replace(/^VALOORES-/, '')
        ).trim();
    }

    _fullKycSessionId(payload) {
        return String(
            payload.sessionId ||
            payload.session_id ||
            payload.formData?.SESSION_ID ||
            ''
        ).trim();
    }

    _fullKycCurrentKey(residentId) {
        return `KYC_${residentId}`;
    }

    _fullKycLegacyCurrentKey(residentId) {
        return `RESIDENT_${residentId}`;
    }

    _fullKycLatestVersionKey(residentId) {
        return `KYC_LATEST_${residentId}`;
    }

    _fullKycVersionKey(residentId, versionNumber) {
        const versionText = String(versionNumber).padStart(12, '0');

        return `KYC_VERSION_${residentId}_${versionText}`;
    }

    _fullKycVersionRange(residentId) {
        const startKey = `KYC_VERSION_${residentId}_`;

        return {
            startKey,
            endKey: `${startKey}\uffff`
        };
    }

    _fullKycCanonicalize(value) {
        if (Array.isArray(value)) {
            return value.map((item) => this._fullKycCanonicalize(item));
        }

        if (
            value !== null &&
            typeof value === 'object'
        ) {
            return Object.keys(value)
                .sort()
                .reduce((result, key) => {
                    result[key] = this._fullKycCanonicalize(value[key]);
                    return result;
                }, {});
        }

        return value;
    }

    _fullKycPayloadHash(payload) {
        const canonicalPayload = this._fullKycCanonicalize(payload);

        return crypto
            .createHash('sha256')
            .update(JSON.stringify(canonicalPayload), 'utf8')
            .digest('hex');
    }

    _fullKycDeepMerge(baseValue, patchValue) {
        if (
            patchValue === null ||
            Array.isArray(patchValue) ||
            typeof patchValue !== 'object'
        ) {
            return this._fullKycClone(patchValue);
        }

        const result = (
            baseValue !== null &&
            !Array.isArray(baseValue) &&
            typeof baseValue === 'object'
        )
            ? this._fullKycClone(baseValue)
            : {};

        for (const [key, value] of Object.entries(patchValue)) {
            result[key] = this._fullKycDeepMerge(result[key], value);
        }

        return result;
    }

    _fullKycCollectChangedFields(oldValue, newValue, prefix = '') {
        const oldIsObject = (
            oldValue !== null &&
            !Array.isArray(oldValue) &&
            typeof oldValue === 'object'
        );

        const newIsObject = (
            newValue !== null &&
            !Array.isArray(newValue) &&
            typeof newValue === 'object'
        );

        if (oldIsObject && newIsObject) {
            const keys = Array.from(
                new Set([
                    ...Object.keys(oldValue),
                    ...Object.keys(newValue)
                ])
            ).sort();

            const changes = [];

            for (const key of keys) {
                const path = prefix ? `${prefix}.${key}` : key;

                changes.push(
                    ...this._fullKycCollectChangedFields(
                        oldValue[key],
                        newValue[key],
                        path
                    )
                );
            }

            return changes;
        }

        const oldCanonical = JSON.stringify(
            this._fullKycCanonicalize(oldValue)
        );

        const newCanonical = JSON.stringify(
            this._fullKycCanonicalize(newValue)
        );

        return oldCanonical === newCanonical
            ? []
            : [prefix || '$'];
    }

    _fullKycValueAtPath(payload, path) {
        if (path === '$') {
            return payload;
        }

        return String(path)
            .split('.')
            .reduce((value, key) => {
                if (value === undefined || value === null) {
                    return undefined;
                }

                return value[key];
            }, payload);
    }

    _fullKycReservedPatchFields() {
        return new Set([
            'docType',
            'ledgerKey',
            'latestVersionKey',
            'versionKey',
            'versionNumber',
            'versionOperation',
            'previousVersionNumber',
            'previousVersionKey',
            'previousTransactionId',
            'versionPayloadHash',
            'versionSchema',
            'versionCreatedAt',
            'versionCreatedTxId',
            'versionCreatedByMsp',
            'versionChangedFields',
            'versionChangeCount',
            'fabricTransactionId',
            'isDeleted',
            'deletionReason',
            'deletedAt',
            'deletedTxId'
        ]);
    }

    _fullKycSanitizePatch(patch) {
        const result = this._fullKycClone(patch);
        const reservedFields = this._fullKycReservedPatchFields();

        for (const field of reservedFields) {
            delete result[field];
        }

        return result;
    }

    _fullKycLegacyPayload(currentRecord) {
        const payload = this._fullKycClone(currentRecord);
        const reservedFields = this._fullKycReservedPatchFields();

        for (const field of reservedFields) {
            delete payload[field];
        }

        return payload;
    }

    _fullKycApplyCompatibilityFields(payload, residentId) {
        const result = this._fullKycClone(payload);
        const formData = (
            result.formData &&
            !Array.isArray(result.formData) &&
            typeof result.formData === 'object'
        )
            ? result.formData
            : {};

        const fieldMappings = {
            firstName: 'FIRST_NAME',
            fatherName: 'FATHER_NAME',
            motherName: 'MOTHER_NAME',
            lastName: 'LAST_NAME',
            fullName: 'CUSTOMER_NAME',
            dateOfBirth: 'DATE_OF_BIRTH',
            gender: 'GENDER',
            nationality: 'MAIN_NATIONALITY_ID',
            branchCode: 'BRANCH',
            customerType: 'PARTY_TYPE_CODE',
            kycStatus: 'STATUS_NAME'
        };

        for (const [targetField, sourceField] of Object.entries(fieldMappings)) {
            if (
                result[targetField] === undefined ||
                result[targetField] === null ||
                result[targetField] === ''
            ) {
                if (formData[sourceField] !== undefined) {
                    result[targetField] = formData[sourceField];
                }
            }
        }

        result.residentId = residentId;

        if (!result.customerId) {
            result.customerId = this._fullKycCustomerId(result, residentId);
        }

        if (!result.sessionId) {
            result.sessionId = this._fullKycSessionId(result);
        }

        if (!result.kycStatus) {
            result.kycStatus = formData.STATUS_CODE || 'Draft';
        }

        if (!result.riskCategory) {
            result.riskCategory = 'Low Risk';
        }

        if (!result.walletCurrency) {
            result.walletCurrency = 'LBP';
        }

        if (!result.walletStatus) {
            result.walletStatus = 'Not Created';
        }

        return result;
    }

    async _fullKycReadCurrent(ctx, residentId) {
        const currentKey = this._fullKycCurrentKey(residentId);
        let bytes = await ctx.stub.getState(currentKey);

        if (bytes && bytes.length > 0) {
            return {
                key: currentKey,
                record: JSON.parse(bytes.toString('utf8'))
            };
        }

        const legacyKey = this._fullKycLegacyCurrentKey(residentId);
        bytes = await ctx.stub.getState(legacyKey);

        if (bytes && bytes.length > 0) {
            return {
                key: legacyKey,
                record: JSON.parse(bytes.toString('utf8'))
            };
        }

        return null;
    }

    async _fullKycReadLatestVersion(ctx, residentId) {
        const bytes = await ctx.stub.getState(
            this._fullKycLatestVersionKey(residentId)
        );

        if (!bytes || bytes.length === 0) {
            return null;
        }

        return JSON.parse(bytes.toString('utf8'));
    }

    async _fullKycReadVersion(ctx, residentId, versionNumber) {
        const normalizedVersion = Number(versionNumber);

        if (
            !Number.isSafeInteger(normalizedVersion) ||
            normalizedVersion < 1
        ) {
            throw new Error('versionNumber must be a positive integer');
        }

        const versionKey = this._fullKycVersionKey(
            residentId,
            normalizedVersion
        );

        const bytes = await ctx.stub.getState(versionKey);

        if (!bytes || bytes.length === 0) {
            throw new Error(
                `KYC version ${normalizedVersion} not found for ${residentId}`
            );
        }

        return JSON.parse(bytes.toString('utf8'));
    }

    async _fullKycWriteVersion(
        ctx,
        {
            residentId,
            payload,
            operation,
            previousVersion = null,
            changedFields = [],
            changeReason = null,
            deletionReason = null,
            writeCurrent = true,
            existingCurrent = null
        }
    ) {
        const versionNumber = previousVersion
            ? Number(previousVersion.versionNumber) + 1
            : 1;

        const currentKey = this._fullKycCurrentKey(residentId);
        const latestVersionKey = this._fullKycLatestVersionKey(residentId);
        const versionKey = this._fullKycVersionKey(
            residentId,
            versionNumber
        );

        const existingVersionBytes = await ctx.stub.getState(versionKey);

        if (existingVersionBytes && existingVersionBytes.length > 0) {
            throw new Error(
                `KYC version already exists: ${residentId}/${versionNumber}`
            );
        }

        const txId = ctx.stub.getTxID();
        const timestamp = this._customerCrudTimestamp(ctx);
        const submittedByMsp = (
            ctx.clientIdentity &&
            typeof ctx.clientIdentity.getMSPID === 'function'
        )
            ? ctx.clientIdentity.getMSPID()
            : null;

        const completePayload = this._fullKycClone(payload);
        const customerId = this._fullKycCustomerId(
            completePayload,
            residentId
        );
        const sessionId = this._fullKycSessionId(completePayload);
        const versionPayloadHash = this._fullKycPayloadHash(
            completePayload
        );

        const versionRecord = {
            docType: 'KYC_FULL_VERSION',
            versionSchema: 'VALOORES_KYC_FULL_VERSION_V1',
            residentId,
            customerId,
            sessionId,
            ledgerKey: currentKey,
            latestVersionKey,
            versionKey,
            versionNumber,
            versionOperation: operation,
            previousVersionNumber: previousVersion
                ? Number(previousVersion.versionNumber)
                : null,
            previousVersionKey: previousVersion
                ? previousVersion.versionKey
                : null,
            previousTransactionId: previousVersion
                ? previousVersion.fabricTransactionId
                : null,
            versionPayloadHash,
            versionChangedFields: Array.from(
                new Set(changedFields)
            ).sort(),
            versionChangeCount: Array.from(
                new Set(changedFields)
            ).length,
            changeReason: changeReason || null,
            deletionReason: deletionReason || null,
            isDeleted: operation === 'DELETE',
            createdByMsp: submittedByMsp,
            fabricTransactionId: txId,
            createdAt: timestamp,
            payload: completePayload
        };

        const compatiblePayload = this._fullKycApplyCompatibilityFields(
            completePayload,
            residentId
        );

        const currentRecord = {
            ...compatiblePayload,
            docType: 'resident',
            residentId,
            customerId,
            sessionId,
            ledgerKey: currentKey,
            latestVersionKey,
            versionKey,
            versionNumber,
            versionOperation: operation,
            previousVersionNumber:
                versionRecord.previousVersionNumber,
            previousVersionKey:
                versionRecord.previousVersionKey,
            previousTransactionId:
                versionRecord.previousTransactionId,
            versionPayloadHash,
            versionSchema:
                versionRecord.versionSchema,
            versionCreatedAt: timestamp,
            versionCreatedTxId: txId,
            versionCreatedByMsp: submittedByMsp,
            versionChangedFields:
                versionRecord.versionChangedFields,
            versionChangeCount:
                versionRecord.versionChangeCount,
            isDeleted: operation === 'DELETE',
            deletionReason: deletionReason || null,
            createdAt:
                existingCurrent?.createdAt ||
                compatiblePayload.createdAt ||
                timestamp,
            updatedAt: timestamp,
            createdTxId:
                existingCurrent?.createdTxId ||
                existingCurrent?.creationTxId ||
                txId,
            updatedTxId: txId,
            fabricTransactionId: txId
        };

        const versionBuffer = Buffer.from(
            JSON.stringify(versionRecord)
        );

        await ctx.stub.putState(versionKey, versionBuffer);
        await ctx.stub.putState(latestVersionKey, versionBuffer);

        if (writeCurrent) {
            await ctx.stub.putState(
                currentKey,
                Buffer.from(JSON.stringify(currentRecord))
            );
        }

        return {
            versionRecord,
            currentRecord
        };
    }

    async _fullKycEnsureBaseline(ctx, residentId, currentRecord) {
        const latestVersion = await this._fullKycReadLatestVersion(
            ctx,
            residentId
        );

        if (latestVersion) {
            return latestVersion;
        }

        const versionOneKey = this._fullKycVersionKey(residentId, 1);
        const versionOneBytes = await ctx.stub.getState(versionOneKey);

        if (versionOneBytes && versionOneBytes.length > 0) {
            const versionOne = JSON.parse(
                versionOneBytes.toString('utf8')
            );

            await ctx.stub.putState(
                this._fullKycLatestVersionKey(residentId),
                versionOneBytes
            );

            return versionOne;
        }

        const legacyPayload = this._fullKycLegacyPayload(currentRecord);

        const baselineResult = await this._fullKycWriteVersion(
            ctx,
            {
                residentId,
                payload: legacyPayload,
                operation: 'MIGRATE_BASELINE',
                previousVersion: null,
                changedFields: ['*'],
                changeReason:
                    'Automatic baseline created for a pre-versioning resident',
                writeCurrent: true,
                existingCurrent: currentRecord
            }
        );

        return baselineResult.versionRecord;
    }

    /**
     * Creates Version 1 and stores the complete submitted KYC payload.
     */
    async CreateResident(ctx, residentJson) {
        const payload = this._fullKycParseObject(
            residentJson,
            'residentJson'
        );

        const residentId = this._fullKycResolveResidentId(payload);
        const currentResult = await this._fullKycReadCurrent(
            ctx,
            residentId
        );

        if (currentResult) {
            throw new Error(
                `Resident already exists on blockchain: ${residentId}`
            );
        }

        const historicalLatest = await this._fullKycReadLatestVersion(
            ctx,
            residentId
        );

        if (historicalLatest) {
            throw new Error(
                `Resident version history already exists: ${residentId}`
            );
        }

        const result = await this._fullKycWriteVersion(
            ctx,
            {
                residentId,
                payload,
                operation: 'CREATE',
                previousVersion: null,
                changedFields: ['*'],
                changeReason:
                    payload.changeReason ||
                    payload.change_reason ||
                    null,
                writeCurrent: true,
                existingCurrent: null
            }
        );

        return JSON.stringify({
            success: true,
            operation: 'CREATE',
            residentId,
            ledgerKey: result.currentRecord.ledgerKey,
            versionNumber:
                result.versionRecord.versionNumber,
            versionKey:
                result.versionRecord.versionKey,
            versionPayloadHash:
                result.versionRecord.versionPayloadHash,
            fabricTransactionId:
                result.versionRecord.fabricTransactionId,
            resident: result.currentRecord
        });
    }

    /**
     * Returns the current active customer record.
     */
    async GetResident(ctx, residentId) {
        const normalizedResidentId = this._fullKycNormalizeResidentId(
            residentId
        );

        const currentResult = await this._fullKycReadCurrent(
            ctx,
            normalizedResidentId
        );

        if (!currentResult) {
            throw new Error(
                `Resident not found on blockchain: ${normalizedResidentId}`
            );
        }

        return JSON.stringify(currentResult.record);
    }

    /**
     * Returns the latest version, including a DELETE tombstone version.
     */
    async GetLatestResidentVersion(ctx, residentId) {
        const normalizedResidentId = this._fullKycNormalizeResidentId(
            residentId
        );

        const latestVersion = await this._fullKycReadLatestVersion(
            ctx,
            normalizedResidentId
        );

        if (latestVersion) {
            return JSON.stringify(latestVersion);
        }

        const currentResult = await this._fullKycReadCurrent(
            ctx,
            normalizedResidentId
        );

        if (!currentResult) {
            throw new Error(
                `Resident not found on blockchain: ${normalizedResidentId}`
            );
        }

        return JSON.stringify({
            docType: 'KYC_LEGACY_CURRENT',
            residentId: normalizedResidentId,
            versionNumber: null,
            payload: currentResult.record
        });
    }

    /**
     * Returns one immutable full-payload KYC version.
     */
    async GetResidentVersion(
        ctx,
        residentId,
        versionNumber
    ) {
        const normalizedResidentId = this._fullKycNormalizeResidentId(
            residentId
        );

        const version = await this._fullKycReadVersion(
            ctx,
            normalizedResidentId,
            versionNumber
        );

        return JSON.stringify(version);
    }

    /**
     * Returns paginated immutable versions for one customer.
     */
    async GetResidentVersions(
        ctx,
        residentId,
        pageSize = '100',
        bookmark = ''
    ) {
        const normalizedResidentId = this._fullKycNormalizeResidentId(
            residentId
        );

        const parsedPageSize = Number.parseInt(
            String(pageSize || '100'),
            10
        );

        const normalizedPageSize = Number.isFinite(parsedPageSize)
            ? Math.min(Math.max(parsedPageSize, 1), 1000)
            : 100;

        const { startKey, endKey } = this._fullKycVersionRange(
            normalizedResidentId
        );

        const queryResult = await ctx.stub.getStateByRangeWithPagination(
            startKey,
            endKey,
            normalizedPageSize,
            String(bookmark || '')
        );

        const versions = [];
        const iterator = queryResult.iterator;

        try {
            while (true) {
                const item = await iterator.next();

                if (
                    item.value &&
                    item.value.value &&
                    item.value.value.length > 0
                ) {
                    versions.push(
                        JSON.parse(
                            item.value.value.toString('utf8')
                        )
                    );
                }

                if (item.done) {
                    break;
                }
            }
        } finally {
            await iterator.close();
        }

        versions.sort(
            (first, second) =>
                Number(first.versionNumber) -
                Number(second.versionNumber)
        );

        const metadata = queryResult.metadata || {};

        return JSON.stringify({
            source: 'FABRIC_BLOCKCHAIN',
            residentId: normalizedResidentId,
            versions,
            pagination: {
                pageSize: normalizedPageSize,
                fetchedRecordsCount: Number(
                    metadata.fetchedRecordsCount ||
                    versions.length
                ),
                bookmark: String(metadata.bookmark || '')
            }
        });
    }

    /**
     * Compares any two immutable KYC versions field by field.
     */
    async CompareResidentVersions(
        ctx,
        residentId,
        oldVersionNumber,
        newVersionNumber
    ) {
        const normalizedResidentId = this._fullKycNormalizeResidentId(
            residentId
        );

        const oldVersion = await this._fullKycReadVersion(
            ctx,
            normalizedResidentId,
            oldVersionNumber
        );

        const newVersion = await this._fullKycReadVersion(
            ctx,
            normalizedResidentId,
            newVersionNumber
        );

        const changedFields = this._fullKycCollectChangedFields(
            oldVersion.payload,
            newVersion.payload
        );

        const changes = changedFields.map((field) => ({
            field,
            oldValue: this._fullKycValueAtPath(
                oldVersion.payload,
                field
            ),
            newValue: this._fullKycValueAtPath(
                newVersion.payload,
                field
            )
        }));

        return JSON.stringify({
            source: 'FABRIC_BLOCKCHAIN',
            residentId: normalizedResidentId,
            oldVersionNumber: Number(oldVersion.versionNumber),
            newVersionNumber: Number(newVersion.versionNumber),
            oldVersionHash: oldVersion.versionPayloadHash,
            newVersionHash: newVersion.versionPayloadHash,
            changeCount: changes.length,
            changes
        });
    }

    /**
     * Deep-merges the submitted patch with the previous complete payload,
     * then creates a new immutable version.
     */
    async UpdateResident(ctx, residentJson) {
        const patch = this._fullKycParseObject(
            residentJson,
            'residentJson'
        );

        const residentId = this._fullKycResolveResidentId(patch);
        const currentResult = await this._fullKycReadCurrent(
            ctx,
            residentId
        );

        if (!currentResult) {
            throw new Error(
                `Resident not found on blockchain: ${residentId}`
            );
        }

        const latestVersion = await this._fullKycEnsureBaseline(
            ctx,
            residentId,
            currentResult.record
        );

        const previousPayload = latestVersion.payload
            ? this._fullKycClone(latestVersion.payload)
            : this._fullKycLegacyPayload(currentResult.record);

        const sanitizedPatch = this._fullKycSanitizePatch(patch);
        const updatedPayload = this._fullKycDeepMerge(
            previousPayload,
            sanitizedPatch
        );

        const changedFields = this._fullKycCollectChangedFields(
            previousPayload,
            updatedPayload
        );

        if (changedFields.length === 0) {
            throw new Error(
                `No resident fields changed: ${residentId}`
            );
        }

        const result = await this._fullKycWriteVersion(
            ctx,
            {
                residentId,
                payload: updatedPayload,
                operation: 'UPDATE',
                previousVersion: latestVersion,
                changedFields,
                changeReason:
                    patch.changeReason ||
                    patch.change_reason ||
                    null,
                writeCurrent: true,
                existingCurrent: currentResult.record
            }
        );

        if (currentResult.key !== result.currentRecord.ledgerKey) {
            await ctx.stub.deleteState(currentResult.key);
        }

        return JSON.stringify({
            success: true,
            operation: 'UPDATE',
            residentId,
            ledgerKey: result.currentRecord.ledgerKey,
            versionNumber:
                result.versionRecord.versionNumber,
            versionKey:
                result.versionRecord.versionKey,
            previousVersionNumber:
                result.versionRecord.previousVersionNumber,
            changedFields:
                result.versionRecord.versionChangedFields,
            changeCount:
                result.versionRecord.versionChangeCount,
            versionPayloadHash:
                result.versionRecord.versionPayloadHash,
            fabricTransactionId:
                result.versionRecord.fabricTransactionId,
            updatedAt:
                result.currentRecord.updatedAt,
            resident: result.currentRecord
        });
    }

    /**
     * Creates an immutable DELETE version containing the complete final
     * customer payload, then removes only the current-state key.
     */
    async DeleteResident(
        ctx,
        residentId,
        deletionReason
    ) {
        const normalizedResidentId = this._fullKycNormalizeResidentId(
            residentId
        );

        const normalizedReason = String(
            deletionReason || ''
        ).trim();

        if (normalizedReason.length < 5) {
            throw new Error(
                'A deletion reason of at least 5 characters is required.'
            );
        }

        const currentResult = await this._fullKycReadCurrent(
            ctx,
            normalizedResidentId
        );

        if (!currentResult) {
            throw new Error(
                `Resident not found on blockchain: ${normalizedResidentId}`
            );
        }

        const latestVersion = await this._fullKycEnsureBaseline(
            ctx,
            normalizedResidentId,
            currentResult.record
        );

        const completePayload = latestVersion.payload
            ? this._fullKycClone(latestVersion.payload)
            : this._fullKycLegacyPayload(currentResult.record);

        const result = await this._fullKycWriteVersion(
            ctx,
            {
                residentId: normalizedResidentId,
                payload: completePayload,
                operation: 'DELETE',
                previousVersion: latestVersion,
                changedFields: [],
                changeReason: normalizedReason,
                deletionReason: normalizedReason,
                writeCurrent: false,
                existingCurrent: currentResult.record
            }
        );

        await ctx.stub.deleteState(currentResult.key);

        const canonicalCurrentKey = this._fullKycCurrentKey(
            normalizedResidentId
        );

        if (currentResult.key !== canonicalCurrentKey) {
            await ctx.stub.deleteState(canonicalCurrentKey);
        }

        return JSON.stringify({
            success: true,
            operation: 'DELETE',
            residentId: normalizedResidentId,
            ledgerKey: canonicalCurrentKey,
            versionNumber:
                result.versionRecord.versionNumber,
            versionKey:
                result.versionRecord.versionKey,
            previousVersionNumber:
                result.versionRecord.previousVersionNumber,
            deletionReason: normalizedReason,
            versionPayloadHash:
                result.versionRecord.versionPayloadHash,
            deletedAt:
                result.versionRecord.createdAt,
            deletedTxId:
                result.versionRecord.fabricTransactionId,
            finalPayload:
                result.versionRecord.payload
        });
    }

    /**
     * Creates the wallet and records the wallet change as a new full KYC
     * version in the same Fabric transaction.
     */
    async CreateResidentWallet(
        ctx,
        residentId,
        walletCurrency,
        walletAddress
    ) {
        const normalizedResidentId = this._fullKycNormalizeResidentId(
            residentId
        );

        const currentResult = await this._fullKycReadCurrent(
            ctx,
            normalizedResidentId
        );

        if (!currentResult) {
            throw new Error(
                `Resident not found on blockchain: ${normalizedResidentId}`
            );
        }

        const txId = ctx.stub.getTxID();
        const timestamp = this._customerCrudTimestamp(ctx);
        const officialWalletAddress = (
            walletAddress &&
            String(walletAddress).trim() !== ''
        )
            ? String(walletAddress).trim()
            : `WALLET-${normalizedResidentId}-${txId.substring(0, 16)}`;

        const walletKey = `RESIDENT_WALLET_${normalizedResidentId}`;
        const wallet = {
            docType: 'residentWallet',
            residentId: normalizedResidentId,
            walletAddress: officialWalletAddress,
            walletCurrency: walletCurrency || 'LBP',
            walletStatus: 'Created',
            blockchainStatus: 'Committed',
            createdAt: timestamp,
            updatedAt: timestamp,
            createdTxId: txId,
            updatedTxId: txId
        };

        await ctx.stub.putState(
            walletKey,
            Buffer.from(JSON.stringify(wallet))
        );

        const updateResult = JSON.parse(
            await this.UpdateResident(
                ctx,
                JSON.stringify({
                    residentId: normalizedResidentId,
                    walletAddress: officialWalletAddress,
                    walletCurrency: wallet.walletCurrency,
                    walletStatus: wallet.walletStatus,
                    blockchainStatus: wallet.blockchainStatus,
                    changeReason: 'Resident wallet created'
                })
            )
        );

        return JSON.stringify({
            ...wallet,
            residentVersionNumber: updateResult.versionNumber,
            residentVersionKey: updateResult.versionKey
        });
    }

    /**
     * Changes KYC status and risk category through the versioned update path.
     */
    async SubmitResidentKYC(ctx, residentId, riskCategory) {
        const normalizedResidentId = this._fullKycNormalizeResidentId(
            residentId
        );

        const updateResult = JSON.parse(
            await this.UpdateResident(
                ctx,
                JSON.stringify({
                    residentId: normalizedResidentId,
                    kycStatus: 'Submitted',
                    riskCategory: riskCategory || 'Low Risk',
                    changeReason: 'Resident KYC submitted'
                })
            )
        );

        return JSON.stringify(updateResult.resident);
    }

    /* ===== VALOORES FULL KYC VERSIONING V1 END ===== */

}

module.exports = KycWalletContract;