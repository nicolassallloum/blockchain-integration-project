'use strict';

const assert = require('assert');
const KycWalletContract = require('../lib/kycWalletContract');

function makeIterator(items) {
    let index = 0;

    return {
        async next() {
            if (index < items.length) {
                return {
                    value: items[index++],
                    done: false
                };
            }

            return {
                value: null,
                done: true
            };
        },
        async close() {}
    };
}

function makeCtx() {
    const state = new Map();
    const history = new Map();

    const stub = {
        getTxID() {
            return `phase10-test-tx-${Date.now()}`;
        },

        getTxTimestamp() {
            return {
                seconds: { low: 1782979200 },
                nanos: 0
            };
        },

        async getState(key) {
            return state.has(key)
                ? Buffer.from(state.get(key))
                : Buffer.from('');
        },

        async putState(key, value) {
            const stringValue = value.toString();

            state.set(key, stringValue);

            if (!history.has(key)) {
                history.set(key, []);
            }

            history.get(key).push({
                txId: this.getTxID(),
                timestamp: this.getTxTimestamp(),
                isDelete: false,
                value: Buffer.from(stringValue)
            });
        },

        createCompositeKey(objectType, attributes) {
            return `${objectType}\u0000${attributes.join('\u0000')}`;
        },

        splitCompositeKey(compositeKey) {
            const parts = compositeKey.split('\u0000');

            return {
                objectType: parts[0],
                attributes: parts.slice(1)
            };
        },

        async getStateByPartialCompositeKey(objectType, attributes) {
            const prefix = `${objectType}\u0000${attributes.join('\u0000')}`;
            const matches = [];

            for (const key of state.keys()) {
                if (key.startsWith(prefix)) {
                    matches.push({
                        key,
                        value: Buffer.from(state.get(key))
                    });
                }
            }

            return makeIterator(matches);
        },

        async getHistoryForKey(key) {
            return makeIterator(history.get(key) || []);
        }
    };

    return { stub };
}

async function expectRejectsWith(fn, expectedText) {
    let rejected = false;

    try {
        await fn();
    } catch (error) {
        rejected = true;
        assert(
            error.message.includes(expectedText),
            `Expected error containing "${expectedText}", got "${error.message}"`
        );
    }

    assert(rejected, `Expected rejection containing "${expectedText}"`);
}

async function run() {
    const contract = new KycWalletContract();
    const ctx = makeCtx();

    const validPayload = {
        blockchainKey: 'PROOF_VALOORES_KYC_1001_V1',
        moduleName: 'KYC',
        sourceRecordId: '1001',
        recordHash: 'a'.repeat(64),
        hashVersion: 'v1',
        actionType: 'CREATE',
        sourceSystem: 'VALOORES',
        approvedBy: 'admin@nix'
    };

    const submitted = JSON.parse(
        await contract.SubmitProof(ctx, JSON.stringify(validPayload))
    );

    assert.deepStrictEqual(
        Object.keys(submitted).sort(),
        [
            'actionType',
            'approvedBy',
            'blockchainKey',
            'hashVersion',
            'moduleName',
            'recordHash',
            'sourceRecordId',
            'sourceSystem',
            'timestamp'
        ].sort()
    );

    assert.strictEqual(submitted.blockchainKey, validPayload.blockchainKey);
    assert.strictEqual(submitted.moduleName, 'KYC');
    assert.strictEqual(submitted.sourceRecordId, '1001');
    assert.strictEqual(submitted.recordHash, validPayload.recordHash);
    assert.strictEqual(submitted.hashVersion, 'v1');
    assert.strictEqual(submitted.actionType, 'CREATE');
    assert.strictEqual(submitted.sourceSystem, 'VALOORES');
    assert.strictEqual(submitted.approvedBy, 'admin@nix');

    const fetched = JSON.parse(
        await contract.GetProof(ctx, validPayload.blockchainKey)
    );

    assert.strictEqual(fetched.blockchainKey, validPayload.blockchainKey);
    assert.strictEqual(fetched.recordHash, validPayload.recordHash);

    const verified = JSON.parse(
        await contract.VerifyProof(
            ctx,
            validPayload.blockchainKey,
            validPayload.recordHash
        )
    );

    assert.strictEqual(verified.verified, true);
    assert.strictEqual(verified.status, 'VERIFIED');

    const mismatched = JSON.parse(
        await contract.VerifyProof(
            ctx,
            validPayload.blockchainKey,
            'b'.repeat(64)
        )
    );

    assert.strictEqual(mismatched.verified, false);
    assert.strictEqual(mismatched.status, 'MISMATCHED');

    const byModule = JSON.parse(await contract.QueryProofsByModule(ctx, 'kyc'));

    assert.strictEqual(byModule.length, 1);
    assert.strictEqual(byModule[0].blockchainKey, validPayload.blockchainKey);

    const byRecordId = JSON.parse(
        await contract.QueryProofsByRecordId(ctx, '1001')
    );

    assert.strictEqual(byRecordId.length, 1);
    assert.strictEqual(byRecordId[0].blockchainKey, validPayload.blockchainKey);

    const history = JSON.parse(
        await contract.GetHistoryForKey(ctx, validPayload.blockchainKey)
    );

    assert.strictEqual(history.length, 1);
    assert.strictEqual(history[0].value.blockchainKey, validPayload.blockchainKey);

    await expectRejectsWith(
        () => contract.SubmitProof(ctx, JSON.stringify(validPayload)),
        'already exists'
    );

    await expectRejectsWith(
        () => contract.SubmitProof(ctx, 'not-json'),
        'Invalid proofPayloadJson'
    );

    await expectRejectsWith(
        () => contract.SubmitProof(ctx, JSON.stringify({
            ...validPayload,
            blockchainKey: 'PROOF_MISSING_HASH',
            recordHash: ''
        })),
        'recordHash cannot be empty'
    );

    await expectRejectsWith(
        () => contract.SubmitProof(ctx, JSON.stringify({
            ...validPayload,
            blockchainKey: 'PROOF_BAD_HASH',
            recordHash: 'abc'
        })),
        'recordHash must be a SHA-256 hex string'
    );

    await expectRejectsWith(
        () => contract.SubmitProof(ctx, JSON.stringify({
            ...validPayload,
            blockchainKey: 'PROOF_EXTRA_FIELD',
            raw_payload: { secret: 'not allowed' }
        })),
        'Invalid proof field'
    );

    await expectRejectsWith(
        () => contract.SubmitProof(ctx, JSON.stringify({
            ...validPayload,
            blockchainKey: 'PROOF_SENSITIVE_VALUE',
            approvedBy: 'secret-token-owner'
        })),
        'Sensitive value is not allowed'
    );

    await expectRejectsWith(
        () => contract.VerifyProof(ctx, validPayload.blockchainKey, 'abc'),
        'recordHash must be a SHA-256 hex string'
    );

    console.log('PHASE 10 CHAINCODE TESTS PASSED');
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
