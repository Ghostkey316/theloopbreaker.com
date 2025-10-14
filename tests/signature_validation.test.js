const { Wallet } = require('ethers');
const {
  validateCovenantSignatureChain,
  SignatureChainError,
  __testing: { serialisePayload },
} = require('../vaultfire/onboarding/signature_validation');

describe('validateCovenantSignatureChain', () => {
  const now = Date.now();
  const rootIssuedAt = new Date(now - 60_000).toISOString();
  const rootExpiresAt = new Date(now + 3_600_000).toISOString();
  const partnerIssuedAt = new Date(now - 30_000).toISOString();
  const partnerExpiresAt = new Date(now + 3_600_000).toISOString();

  async function buildChain({ domain = 'ally.alpha', trustedRootSignature = 'foundation::root' } = {}) {
    const rootWallet = Wallet.createRandom();
    const partnerWallet = Wallet.createRandom();

    const rootPayload = {
      domain,
      partnerId: 'foundation',
      covenantId: `${domain}::covenant::1`,
      previousSignature: trustedRootSignature,
      issuedAt: rootIssuedAt,
      expiresAt: rootExpiresAt,
    };
    const rootSignature = await rootWallet.signMessage(serialisePayload(rootPayload));

    const partnerPayload = {
      domain,
      partnerId: `${domain}.partner`,
      covenantId: `${domain}::covenant::1`,
      previousSignature: rootSignature,
      issuedAt: partnerIssuedAt,
      expiresAt: partnerExpiresAt,
    };
    const partnerSignature = await partnerWallet.signMessage(serialisePayload(partnerPayload));

    const chain = [
      {
        partnerId: rootPayload.partnerId,
        domain,
        covenantId: rootPayload.covenantId,
        issuedAt: rootPayload.issuedAt,
        expiresAt: rootPayload.expiresAt,
        signer: rootWallet.address,
        payload: rootPayload,
        signature: rootSignature,
      },
      {
        partnerId: partnerPayload.partnerId,
        domain,
        covenantId: partnerPayload.covenantId,
        issuedAt: partnerPayload.issuedAt,
        expiresAt: partnerPayload.expiresAt,
        signer: partnerWallet.address,
        payload: partnerPayload,
        signature: partnerSignature,
      },
    ];

    return { chain, trustedRootSignature, domain };
  }

  test('validates a partner-issued covenant signature chain', async () => {
    const { chain, trustedRootSignature, domain } = await buildChain();
    const summary = await validateCovenantSignatureChain(chain, {
      expectedDomain: domain,
      trustedRootSignature,
      clock: () => now,
      toleranceMs: 5_000,
    });

    expect(summary).toMatchObject({
      domain,
      partners: ['foundation', `${domain}.partner`],
      chainLength: 2,
      covenantId: `${domain}::covenant::1`,
      trustedRootSignature,
    });
    expect(summary.issuedAt).toBe(new Date(rootIssuedAt).toISOString());
    expect(summary.expiresAt).toBe(new Date(partnerExpiresAt).toISOString());
  });

  test('rejects domain mismatches within the chain', async () => {
    const { chain, trustedRootSignature } = await buildChain({ domain: 'ally.alpha' });
    chain[1].domain = 'evil.example';

    await expect(
      validateCovenantSignatureChain(chain, {
        expectedDomain: 'ally.alpha',
        trustedRootSignature,
        clock: () => now,
      }),
    ).rejects.toMatchObject({ code: 'chain.domain-mismatch' });
  });

  test('rejects broken previous signature links', async () => {
    const { chain, trustedRootSignature, domain } = await buildChain();
    chain[1].payload.previousSignature = 'tampered';

    await expect(
      validateCovenantSignatureChain(chain, {
        expectedDomain: domain,
        trustedRootSignature,
        clock: () => now,
      }),
    ).rejects.toMatchObject({ code: 'chain.link-mismatch' });
  });

  test('rejects signature mismatches when payload is altered', async () => {
    const { chain, trustedRootSignature, domain } = await buildChain();
    chain[1].payload.mutation = 'unauthorised';

    await expect(
      validateCovenantSignatureChain(chain, {
        expectedDomain: domain,
        trustedRootSignature,
        clock: () => now,
      }),
    ).rejects.toBeInstanceOf(SignatureChainError);
  });
});
