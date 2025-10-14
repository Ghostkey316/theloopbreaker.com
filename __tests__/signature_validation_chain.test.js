'use strict';

const crypto = require('crypto');
const { Wallet } = require('ethers');

const {
  validateCovenantSignatureChain,
  __testing,
} = require('../vaultfire/onboarding/signature_validation');

async function signPayload(wallet, payload) {
  const serialised = __testing.serialisePayload(payload);
  const signature = await wallet.signMessage(serialised);
  return { signature, serialised };
}

function computeMirror(previous, serialised, signature) {
  return crypto.createHash('sha256').update(`${previous || ''}::${serialised || ''}::${signature || ''}`).digest('hex');
}

describe('validateCovenantSignatureChain with partner keys', () => {
  it('validates chain with partner-issued keys and mirror hashes', async () => {
    const now = Date.now();
    const walletA = new Wallet('0x59c6995e998f97a5a0044966f09453856a87c24f976f4f3f0f37563b60d20d5b');
    const walletB = new Wallet('0x8b3a350cf5c34c9194ca3a9d8b53bbf276d4f3f57a5401397dbe8f8b0d0c53b1');
    const partnerKeys = [
      { partnerId: 'partner-a.example', address: walletA.address.toLowerCase() },
      { partnerId: 'partner-b.example', address: walletB.address.toLowerCase() },
    ];

    const entry1Payload = {
      domain: 'partner-a.example',
      partnerId: 'partner-a.example',
      previousSignature: '',
      issuedAt: now - 1_000,
      expiresAt: now + 60_000,
    };
    const signed1 = await signPayload(walletA, entry1Payload);
    const seedHash = crypto.createHash('sha256').update('').digest('hex');
    const mirror1 = computeMirror(seedHash, signed1.serialised, signed1.signature);

    const entry2Payload = {
      domain: 'partner-b.example',
      partnerId: 'partner-b.example',
      previousSignature: signed1.signature,
      issuedAt: now - 500,
      expiresAt: now + 120_000,
    };
    const signed2 = await signPayload(walletB, entry2Payload);
    const mirror2 = computeMirror(mirror1, signed2.serialised, signed2.signature);

    const chain = [
      {
        domain: 'partner-a.example',
        partnerId: 'partner-a.example',
        signer: walletA.address,
        signature: signed1.signature,
        issuedAt: entry1Payload.issuedAt,
        expiresAt: entry1Payload.expiresAt,
        mirrorHash: mirror1,
        payload: entry1Payload,
      },
      {
        domain: 'partner-b.example',
        partnerId: 'partner-b.example',
        signer: walletB.address,
        signature: signed2.signature,
        issuedAt: entry2Payload.issuedAt,
        expiresAt: entry2Payload.expiresAt,
        mirrorHash: mirror2,
        payload: entry2Payload,
      },
    ];

    const result = await validateCovenantSignatureChain(chain, {
      partnerKeys,
      expectedDomain: 'example',
      trustedRootSignature: '',
      requirePartnerKey: true,
      requireHashMirroring: true,
    });

    expect(result.partners).toEqual(['partner-a.example', 'partner-b.example']);
    expect(result.mirrorTrail).toHaveLength(2);
    expect(result.mirrorHash).toBe(mirror2);
  });

  it('throws when partner key is missing', async () => {
    const now = Date.now();
    const wallet = new Wallet('0x1c0e7e5cf72d23b7123327762f7f4bea7f2a7bc01db57ee97dc0b1819b735856');

    const payload = {
      domain: 'partner-c.example',
      partnerId: 'partner-c.example',
      previousSignature: '',
      issuedAt: now - 1_000,
      expiresAt: now + 60_000,
    };
    const signed = await signPayload(wallet, payload);
    const chain = [
      {
        domain: 'partner-c.example',
        partnerId: 'partner-c.example',
        signer: wallet.address,
        signature: signed.signature,
        mirrorHash: computeMirror('', signed.serialised, signed.signature),
        issuedAt: payload.issuedAt,
        expiresAt: payload.expiresAt,
        payload,
      },
    ];

    await expect(
      validateCovenantSignatureChain(chain, { partnerKeys: [], expectedDomain: 'example', requirePartnerKey: true }),
    ).rejects.toThrow(/trusted covenant key missing/i);
  });
});
