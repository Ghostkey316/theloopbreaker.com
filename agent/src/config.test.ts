/**
 * Tests for the Vaultfire Agent Configuration
 */

import { CONTRACTS, METRIC_IDS, loadConfig } from './config';

describe('CONTRACTS', () => {
  it('should have all required contract addresses', () => {
    expect(CONTRACTS.ERC8004IdentityRegistry).toBe('0x206265EAbDE04E15ebeb6E27Cad64D9BfDB470DD');
    expect(CONTRACTS.AIPartnershipBondsV2).toBe('0xd167A4F5eb428766Fc14C074e9f0C979c5CB4855');
    expect(CONTRACTS.AIAccountabilityBondsV2).toBe('0x956a99C8f50bAc8b8b69dA934AEaBFEaCF41B140');
    expect(CONTRACTS.FlourishingMetricsOracle).toBe('0xb751abb1158908114662b254567b8135C460932C');
    expect(CONTRACTS.ERC8004ReputationRegistry).toBe('0x1043A9fBeAEDD401735c46Aa17B4a2FA1193B06C');
    expect(CONTRACTS.ERC8004ValidationRegistry).toBe('0x50E4609991691D5104016c4a2F6D2875234d4B06');
  });

  it('should have valid Ethereum addresses (checksummed)', () => {
    for (const [name, address] of Object.entries(CONTRACTS)) {
      expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    }
  });
});

describe('METRIC_IDS', () => {
  it('should have all expected metric identifiers', () => {
    expect(METRIC_IDS.PROTOCOL_HEALTH).toBe('protocol_health');
    expect(METRIC_IDS.AGENT_UPTIME).toBe('agent_uptime');
    expect(METRIC_IDS.BOND_QUALITY).toBe('bond_quality');
    expect(METRIC_IDS.TASK_COMPLETION).toBe('task_completion');
    expect(METRIC_IDS.PARTNERSHIP_FLOURISHING).toBe('partnership_flourishing');
  });
});

describe('loadConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should throw if AGENT_PRIVATE_KEY is missing', () => {
    delete process.env.AGENT_PRIVATE_KEY;
    expect(() => loadConfig()).toThrow('Missing required environment variable: AGENT_PRIVATE_KEY');
  });

  it('should load config with required env vars', () => {
    process.env.AGENT_PRIVATE_KEY = '0x' + 'a'.repeat(64);
    const config = loadConfig();

    expect(config.privateKey).toBe('0x' + 'a'.repeat(64));
    expect(config.chainId).toBe(8453);
    expect(config.dryRun).toBe(true);
    expect(config.taskIntervalSeconds).toBe(300);
    expect(config.logLevel).toBe('info');
    expect(config.maxRetries).toBe(3);
  });

  it('should use environment overrides', () => {
    process.env.AGENT_PRIVATE_KEY = '0x' + 'b'.repeat(64);
    process.env.BASE_RPC_URL = 'https://custom-rpc.example.com';
    process.env.DRY_RUN = 'false';
    process.env.TASK_INTERVAL_SECONDS = '60';
    process.env.LOG_LEVEL = 'debug';

    const config = loadConfig();

    expect(config.rpcUrl).toBe('https://custom-rpc.example.com');
    expect(config.dryRun).toBe(false);
    expect(config.taskIntervalSeconds).toBe(60);
    expect(config.logLevel).toBe('debug');
  });

  it('should handle boolean env var edge cases', () => {
    process.env.AGENT_PRIVATE_KEY = '0x' + 'c'.repeat(64);

    process.env.DRY_RUN = '1';
    expect(loadConfig().dryRun).toBe(true);

    process.env.DRY_RUN = 'TRUE';
    expect(loadConfig().dryRun).toBe(true);

    process.env.DRY_RUN = 'false';
    expect(loadConfig().dryRun).toBe(false);

    process.env.DRY_RUN = '0';
    expect(loadConfig().dryRun).toBe(false);
  });

  it('should handle invalid integer env vars gracefully', () => {
    process.env.AGENT_PRIVATE_KEY = '0x' + 'd'.repeat(64);
    process.env.TASK_INTERVAL_SECONDS = 'not-a-number';

    const config = loadConfig();
    expect(config.taskIntervalSeconds).toBe(300); // Falls back to default
  });
});
