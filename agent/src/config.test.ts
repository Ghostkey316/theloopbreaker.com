/**
 * Tests for the Vaultfire Agent Configuration
 */

import { CONTRACTS, METRIC_IDS, loadConfig, DEMO_MODE, isDemoActive } from './config';

describe('CONTRACTS', () => {
  it('should have all required contract addresses', () => {
    expect(CONTRACTS.ERC8004IdentityRegistry).toBe('0x35978DB675576598F0781dA2133E94cdCf4858bC');
    expect(CONTRACTS.AIPartnershipBondsV2).toBe('0xC574CF2a09B0B470933f0c6a3ef422e3fb25b4b4');
    expect(CONTRACTS.AIAccountabilityBondsV2).toBe('0xf92baef9523BC264144F80F9c31D5c5C017c6Da8');
    expect(CONTRACTS.FlourishingMetricsOracle).toBe('0x83dd216449B3F0574E39043ECFE275946fa492e9');
    expect(CONTRACTS.ERC8004ReputationRegistry).toBe('0xdB54B8925664816187646174bdBb6Ac658A55a5F');
    expect(CONTRACTS.ERC8004ValidationRegistry).toBe('0x54e00081978eE2C8d9Ada8e9975B0Bb543D06A55');
    expect(CONTRACTS.BeliefAttestationVerifier).toBe('0xD9bF6D92a1D9ee44a48c38481c046a819CBdf2ba');
    expect(CONTRACTS.PrivacyGuarantees).toBe('0x227e27e7776d3ee14128BC66216354495E113B19');
    expect(CONTRACTS.MissionEnforcement).toBe('0x8568F4020FCD55915dB3695558dD6D2532599e56');
    expect(CONTRACTS.AntiSurveillance).toBe('0x722E37A7D6f27896C688336AaaFb0dDA80D25E57');
    expect(CONTRACTS.MultisigGovernance).toBe('0x8B8Ba34F8AAB800F0Ba8391fb1388c6EFb911F92');
    expect(CONTRACTS.VaultfireERC8004Adapter).toBe('0xef3A944f4d7bb376699C83A29d7Cb42C90D9B6F0');
    expect(CONTRACTS.ProductionBeliefAttestationVerifier).toBe('0xa5CEC47B48999EB398707838E3A18dd20A1ae272');
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
