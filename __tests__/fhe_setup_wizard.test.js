'use strict';

jest.mock('../vaultfire/audits/validate_encryption_proofs', () => ({
  validateEncryptionProofs: jest.fn().mockResolvedValue({ checksum: 'abc', successes: 10, failures: 0 }),
}));

const { validateEncryptionProofs } = require('../vaultfire/audits/validate_encryption_proofs');
const { FHESetupWizard, parseWizardArgs } = require('../vaultfire/cli/fhe_setup_wizard');

describe('FHESetupWizard', () => {
  let adapter;

  beforeEach(() => {
    adapter = {
      backendId: 'vaultfire.sim',
      switchBackend: jest.fn().mockResolvedValue(null),
      keygen: jest.fn().mockResolvedValue({ publicKey: 'pk', secretKey: 'sk' }),
      getMigrationState: () => ({ event: 'activated', vendor: 'simulation' }),
    };
    validateEncryptionProofs.mockClear();
  });

  it('produces a plan in non-interactive mode', async () => {
    const wizard = new FHESetupWizard({
      adapterFactory: () => adapter,
      stdin: { isTTY: false },
      stdout: { write: jest.fn() },
      logger: console,
    });

    const plan = await wizard.run({ interactive: false, diagnostics: true, mode: 'simulation', network: 'devnet' });
    expect(plan.mode).toBe('simulation');
    expect(plan.network).toBe('devnet');
    expect(plan.keyMaterial.publicKey).toBe('pk');
    expect(validateEncryptionProofs).toHaveBeenCalled();
    expect(Array.isArray(plan.nextSteps)).toBe(true);
  });

  it('parses CLI arguments', () => {
    const options = parseWizardArgs(['--mode', 'tfhe', '--network=testnet', '--non-interactive', '--diagnostics']);
    expect(options.mode).toBe('tfhe');
    expect(options.network).toBe('testnet');
    expect(options.interactive).toBe(false);
    expect(options.diagnostics).toBe(true);
  });
});
