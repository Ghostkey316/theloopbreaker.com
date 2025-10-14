'use strict';

const { FHEAdapter } = require('../vaultfire/encryption/fhe_adapter');

describe('FHEAdapter production integration', () => {
  let logger;

  beforeEach(() => {
    logger = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
  });

  it('uses provided TFHE module when available', async () => {
    const tfheModule = {
      keygen: jest.fn().mockResolvedValue({ publicKey: 'pk', secretKey: 'sk' }),
      encrypt: jest.fn().mockResolvedValue('ciphertext'),
      decrypt: jest.fn().mockResolvedValue(42),
      add: jest.fn(),
      multiply: jest.fn(),
    };
    const adapter = new FHEAdapter({ mode: 'tfhe', tfheModule, logger });
    expect(adapter.isSimulation).toBe(false);
    await adapter.keygen();
    expect(tfheModule.keygen).toHaveBeenCalled();
    await adapter.encrypt(10, {});
    expect(tfheModule.encrypt).toHaveBeenCalled();
  });

  it('falls back to simulation when production backend cannot be initialised', () => {
    const invalidModule = {
      encrypt: jest.fn(),
      // missing decrypt triggers validation failure
    };
    const adapter = new FHEAdapter({ mode: 'auto', tfheModule: invalidModule, logger });
    expect(adapter.isSimulation).toBe(true);
    const state = adapter.getMigrationState();
    expect(state.event).toBe('fallback');
    expect(state.reason).toBe('module-unavailable');
  });

  it('records migration event when switching to simulation explicitly', () => {
    const adapter = new FHEAdapter({ mode: 'simulation', logger });
    const state = adapter.getMigrationState();
    expect(state.event).toBe('fallback');
    expect(state.reason).toBe('explicit-simulation');
  });
});
