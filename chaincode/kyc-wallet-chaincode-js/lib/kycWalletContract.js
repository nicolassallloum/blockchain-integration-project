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

    async CreateResident(ctx, residentJson) {
        const resident = JSON.parse(residentJson);

        if (!resident.residentId) {
            throw new Error('residentId is required');
        }

        const key = `RESIDENT_${resident.residentId}`;
        const exists = await ctx.stub.getState(key);

        if (exists && exists.length > 0) {
            throw new Error(`Resident already exists on blockchain: ${resident.residentId}`);
        }

        const blockchainResident = {
            docType: 'resident',
            residentId: resident.residentId,
            firstName: resident.firstName,
            fatherName: resident.fatherName,
            motherName: resident.motherName,
            lastName: resident.lastName,
            fullName: resident.fullName,
            arabicFullName: resident.arabicFullName,
            dateOfBirth: resident.dateOfBirth,
            gender: resident.gender,
            nationality: resident.nationality,

            nationalIdNumber: resident.nationalIdNumber,
            passportNumber: resident.passportNumber || '',
            residencyPermitNumber: resident.residencyPermitNumber || '',
            taxNumber: resident.taxNumber || '',

            mobileNumber: resident.mobileNumber || '',
            email: resident.email || '',
            governorate: resident.governorate || '',
            district: resident.district || '',
            municipality: resident.municipality || '',
            address: resident.address || '',

            employmentStatus: resident.employmentStatus || '',
            occupation: resident.occupation || '',
            monthlyIncome: resident.monthlyIncome || 0,

            kycStatus: resident.kycStatus || 'Draft',
            riskCategory: resident.riskCategory || 'Low Risk',

            walletAddress: resident.walletAddress || '',
            walletCurrency: resident.walletCurrency || 'LBP',
            walletStatus: resident.walletStatus || 'Not Created',

            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await ctx.stub.putState(key, Buffer.from(JSON.stringify(blockchainResident)));

        return JSON.stringify(blockchainResident);
    }

    async GetResident(ctx, residentId) {
        const key = `RESIDENT_${residentId}`;
        const data = await ctx.stub.getState(key);

        if (!data || data.length === 0) {
            throw new Error(`Resident not found on blockchain: ${residentId}`);
        }

        return data.toString();
    }

    async CreateResidentWallet(ctx, residentId, walletCurrency, walletAddress) {
        const residentKey = `RESIDENT_${residentId}`;
        const residentBytes = await ctx.stub.getState(residentKey);

        if (!residentBytes || residentBytes.length === 0) {
            throw new Error(`Resident not found on blockchain: ${residentId}`);
        }

        const resident = JSON.parse(residentBytes.toString());

        const officialWalletAddress =
        walletAddress && walletAddress.trim() !== ''
            ? walletAddress.trim()
            : `WALLET-${residentId}-${Date.now()}`;
        const walletKey = `RESIDENT_WALLET_${residentId}`;

        const wallet = {
            docType: 'residentWallet',
            residentId,
            walletAddress,
            walletCurrency: walletCurrency || 'LBP',
            walletStatus: 'Created',
            blockchainStatus: 'Committed',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        resident.walletAddress = walletAddress;
        resident.walletCurrency = wallet.walletCurrency;
        resident.walletStatus = 'Created';
        resident.updatedAt = new Date().toISOString();

        await ctx.stub.putState(walletKey, Buffer.from(JSON.stringify(wallet)));
        await ctx.stub.putState(residentKey, Buffer.from(JSON.stringify(resident)));

        return JSON.stringify(wallet);
    }

    async GetResidentWallet(ctx, residentId) {
        const walletKey = `RESIDENT_WALLET_${residentId}`;
        const data = await ctx.stub.getState(walletKey);

        if (!data || data.length === 0) {
            throw new Error(`Resident wallet not found on blockchain: ${residentId}`);
        }

        return data.toString();
    }

    async SubmitResidentKYC(ctx, residentId, riskCategory) {
        const key = `RESIDENT_${residentId}`;
        const data = await ctx.stub.getState(key);

        if (!data || data.length === 0) {
            throw new Error(`Resident not found on blockchain: ${residentId}`);
        }

        const resident = JSON.parse(data.toString());

        resident.kycStatus = 'Submitted';
        resident.riskCategory = riskCategory || resident.riskCategory || 'Low Risk';
        resident.updatedAt = new Date().toISOString();

        await ctx.stub.putState(key, Buffer.from(JSON.stringify(resident)));

        return JSON.stringify(resident);
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
}

module.exports = KycWalletContract;