const path = require('path');

const {
  loadPartnerVerifierConfig,
  listPartnerVerifierConfigs,
  clearPartnerVerifierCache,
} = require('../vaultfire/verification/hooks/partner_verifier_loader');

describe('partner verifier loader', () => {
  const originalEnvRoot = process.env.VAULTFIRE_PARTNER_VERIFIER_ROOT;

  beforeEach(() => {
    clearPartnerVerifierCache();
    delete process.env.VAULTFIRE_PARTNER_VERIFIER_ROOT;
  });

  afterAll(() => {
    clearPartnerVerifierCache();
    if (originalEnvRoot) {
      process.env.VAULTFIRE_PARTNER_VERIFIER_ROOT = originalEnvRoot;
    } else {
      delete process.env.VAULTFIRE_PARTNER_VERIFIER_ROOT;
    }
  });

  it('loads canonical config from filesystem when available', () => {
    const record = loadPartnerVerifierConfig('ghostkey316.eth', { allowFallback: false });
    expect(record.canonical).toBe(true);
    expect(record.source).toBe(path.resolve(__dirname, '..', 'vaultfire', 'verification', 'canonical', 'ghostkey316.eth.json'));
    expect(record.metadata.sourceType).toBe('filesystem');
    expect(record.config).toBeTruthy();
    expect(record.config.partnerId).toBe('ghostkey316.eth');
    expect(record.config.verification.requiredChecks).toHaveLength(3);
    expect(typeof record.checksum).toBe('string');
    expect(record.checksum).toHaveLength(64);
  });

  it('falls back to embedded canonical config when filesystem entry is absent', () => {
    const record = loadPartnerVerifierConfig('atlantech', { allowFallback: true, includeDefaults: false, searchPaths: [] });
    expect(record.canonical).toBe(true);
    expect(record.source).toBe('embedded');
    expect(record.metadata.sourceType).toBe('embedded');
    expect(record.config).toBeTruthy();
    expect(record.config.partnerId).toBe('atlantech');
  });

  it('applies overrides and transforms before building the record', () => {
    const record = loadPartnerVerifierConfig('sandbox_partner', {
      overrides: { verification: { cadence: 'daily' } },
      transform: (config) => ({ ...config, status: 'review' }),
    });
    expect(record.config.status).toBe('review');
    expect(record.config.verification.cadence).toBe('daily');
    expect(record.metadata.overridesApplied).toBe(true);
  });

  it('aggregates available configs across filesystem and embedded fallbacks', () => {
    const output = listPartnerVerifierConfigs();
    const ids = output.map((entry) => entry.partnerId);
    expect(ids).toEqual([...new Set(ids)]);
    expect(ids).toEqual(expect.arrayContaining(['ghostkey316.eth', 'atlantech', 'sandbox_partner']));
  });
});
