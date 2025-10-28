import { SymbioticForge } from '../index';

describe('SymbioticForge JS SDK', () => {
  it('attests intent and returns a tx hash', async () => {
    const forge = new SymbioticForge('0x59c6995e998f97a5a0044966f094538b2928fbc9d8890f18d23e3f8cf2b5f1c1');
    const tx = await forge.attestMoralLoop({ alpha_power: 0.7, theta_intent: 'align' });
    expect(typeof tx).toBe('string');
    expect(tx.startsWith('0x')).toBe(true);
  });

  it('runs pilot sim and emits summary', async () => {
    const forge = new SymbioticForge('0x59c6995e998f97a5a0044966f094538b2928fbc9d8890f18d23e3f8cf2b5f1c1');
    const result = await forge.runPilotSim('loyalty');
    expect(result.pilot).toBe('loyalty');
    expect(Array.isArray(result.runs)).toBe(true);
    expect(result.runs.length).toBeGreaterThan(0);
  });
});
