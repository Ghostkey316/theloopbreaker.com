const { enhanceProtocol } = require('../core/enhancer');
const { quantumLayer, regenStewardship, digitalTwin, privacyBudget } = require('../modules');
const { biometricAnchor, missionLock } = require('../trust');

describe('Frontier protocol upgrade', () => {
  const identity = 'ghostkey316.eth';

  test('combines upgrades into a reinforced mission lock', () => {
    const result = enhanceProtocol({
      identity,
      upgrades: [
        biometricAnchor.attach(identity),
        quantumLayer.enable(),
        regenStewardship.deploy(identity),
        digitalTwin.simulateWith(identity),
        privacyBudget.optimize(),
      ],
      enforce: missionLock.harden(),
    });

    expect(result.identity).toBe(identity);
    expect(result.status).toBe('protocol-enhanced');
    expect(result.modules).toHaveLength(5);
    expect(result.modules.map((entry) => entry.module)).toEqual(
      expect.arrayContaining([
        'biometric-anchor',
        'quantum-layer',
        'regenerative-stewardship',
        'digital-twin',
        'privacy-budget',
      ]),
    );
    expect(result.enforcement.status).toBe('reinforced');
    expect(result.enforcement.integrityLevel).toBe('frontier-grade');
  });
});
