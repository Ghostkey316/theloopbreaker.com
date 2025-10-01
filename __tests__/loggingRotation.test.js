const DailyRotateFile = require('winston-daily-rotate-file');
const { createVaultfireLogger } = require('../services/logging');

describe('vaultfire logging', () => {
  it('configures daily rotation with 30 day retention', () => {
    const logger = createVaultfireLogger('test-suite');
    const rotateTransports = logger.transports.filter((transport) => transport instanceof DailyRotateFile);
    expect(rotateTransports.length).toBeGreaterThanOrEqual(2);
    rotateTransports.forEach((transport) => {
      expect(transport.options.maxFiles || transport.maxFiles).toBe('30d');
    });
  });

  it('includes a cloud forward transport for durability', () => {
    const logger = createVaultfireLogger('cloud-suite');
    const hasCloud = logger.transports.some((transport) => transport.constructor.name === 'CloudTransport');
    expect(hasCloud).toBe(true);
  });
});
