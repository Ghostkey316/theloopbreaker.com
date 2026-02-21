/**
 * Tests for the Vaultfire Agent Configuration
 */

import { CONTRACTS, METRIC_IDS, loadConfig, DEMO_MODE, isDemoActive } from './config';

describe('CONTRACTS', () => {
  it('should have all required contract addresses', () => {
    expect(CONTRACTS.ERC8004IdentityRegistry).toBe('0x63a3d64DfA31509DE763f6939BF586dc4C06d1D5');
    expect(CONTRACTS.AIPartnershipBondsV2).toBe('0x5cd7143B2c3F05C401F7684C21F781cA40bE9BB1');
    expect(CONTRACTS.AIAccountabilityBondsV2).toBe('0xDfc66395A4742b5168712a04942C90B99394aEEb');
    expect(CONTRACTS.FlourishingMetricsOracle).toBe('0x4FAf741d6AcA2cBD8F72e469974C4AB0EB587aC1');
    expect(CONTRACTS.ERC8004ReputationRegistry).toBe('0x544B575431ECD927bA83E85008446fA1e100204a');
    expect(CONTRACTS.ERC8004ValidationRegistry).toBe('0x501fE0f960c1e061C4d295Af241f9F1512775556');
    expect(CONTRACTS.BeliefAttestationVerifier).toBe('0x10180c8430cfD61d27F1d7a548Cff0C4D143bFEF');
    expect(CONTRACTS.PrivacyGuarantees).toBe('0xBdB6c89f5cb86f4d44F7E01d9393b29D83e3DB55');
    expect(CONTRACTS.MissionEnforcement).toBe('0x38165D2D7a8584985CCa5640f4b32b1f3347CC83');
    expect(CONTRACTS.AntiSurveillance).toBe('0x6B60DeFDb2dB8E24d02283a536d5d1A3B178B96C');
    expect(CONTRACTS.MultisigGovernance).toBe('0xea0A6750642AA294658dC9f1eDf36b95D21e7B22');
    expect(CONTRACTS.VaultfireERC8004Adapter).toBe('0x5470d8189849675C043fFA7fc451e5F2f4e5532c');
    expect(CONTRACTS.ProductionBeliefAttestationVerifier).toBe('0xB87ddBDce29caEdDC34805890ab1b4cc6C0E2C5B');
    // Verify all 13 contracts are present
    expect(Object.keys(CONTRACTS)).toHaveLength(13);
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

  it('should include demo mode fields defaulting to off', () => {
    process.env.AGENT_PRIVATE_KEY = '0x' + 'e'.repeat(64);
    delete process.env.DEMO_MODE;
    delete process.env.VAULTFIRE_CHAIN;

    const config = loadConfig();
    expect(config.demoMode).toBe(false);
    expect(config.demoCycles).toBe(0);
  });

  it('should activate demo mode only on avalancheFuji', () => {
    process.env.AGENT_PRIVATE_KEY = '0x' + 'f'.repeat(64);
    process.env.DEMO_MODE = 'true';
    process.env.VAULTFIRE_CHAIN = 'avalancheFuji';

    const config = loadConfig();
    expect(config.demoMode).toBe(true);
    expect(config.demoCycles).toBe(1);
    expect(config.taskIntervalSeconds).toBe(10);
  });

  it('should not activate demo mode on base even if DEMO_MODE=true', () => {
    process.env.AGENT_PRIVATE_KEY = '0x' + 'a'.repeat(64);
    process.env.DEMO_MODE = 'true';
    process.env.VAULTFIRE_CHAIN = 'base';

    const config = loadConfig();
    expect(config.demoMode).toBe(false);
    expect(config.demoCycles).toBe(0);
    expect(config.taskIntervalSeconds).toBe(300);
  });
});

describe('isDemoActive', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return false when DEMO_MODE is not set', () => {
    delete process.env.DEMO_MODE;
    delete process.env.VAULTFIRE_CHAIN;
    expect(isDemoActive()).toBe(false);
  });

  it('should return true when DEMO_MODE=true and chain is avalancheFuji', () => {
    process.env.DEMO_MODE = 'true';
    process.env.VAULTFIRE_CHAIN = 'avalancheFuji';
    expect(isDemoActive()).toBe(true);
  });

  it('should return false when DEMO_MODE=true but chain is base', () => {
    process.env.DEMO_MODE = 'true';
    process.env.VAULTFIRE_CHAIN = 'base';
    expect(isDemoActive()).toBe(false);
  });
});
