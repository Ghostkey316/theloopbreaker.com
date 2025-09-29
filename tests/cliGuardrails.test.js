const fs = require('fs');
const path = require('path');

jest.mock('node-fetch', () => require('jest-fetch-mock'));
const fetch = require('node-fetch');

const { pushBeliefs } = require('../cli/actions');

describe('CLI wallet guardrails', () => {
  const tempDir = path.join(__dirname, 'tmp-cli');

  beforeEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.mkdirSync(tempDir, { recursive: true });
    fetch.resetMocks();
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function writeConfig({ walletAddress = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', ensAlias = 'cli.eth' } = {}) {
    const configPath = path.join(tempDir, 'config.json');
    const beliefPath = path.join(tempDir, 'beliefs.json');
    const config = {
      partnerId: 'cli-partner',
      baseUrl: 'http://localhost:4002',
      role: 'partner',
      walletAddress,
      ensAlias,
      scopes: ['belief:sync'],
      beliefFeedPath: beliefPath,
      identityPolicy: {
        useWalletAsIdentity: true,
        rejectExternalID: true,
        pseudonymousMode: 'always',
        telemetryMode: 'wallet-anonymous',
      },
      createdAt: new Date().toISOString(),
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return configPath;
  }

  function mockFetch(ok = true) {
    fetch.mockResolvedValue({
      ok,
      status: ok ? 200 : 400,
      json: async () => ({ ok }),
    });
  }

  it('forces wallet identity and ENS alias into belief payloads', async () => {
    const configPath = writeConfig({ walletAddress: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', ensAlias: 'CLI.ETH' });
    mockFetch();

    await pushBeliefs({ configPath, token: 'token' });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [, options] = fetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.walletId).toBe('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(body.ensAlias).toBe('cli.eth');
  });

  it('allows wallet overrides per session', async () => {
    const configPath = writeConfig({ walletAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', ensAlias: null });
    mockFetch();

    await pushBeliefs({
      configPath,
      wallet: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      ens: 'Override.ETH',
      token: 'token',
    });

    const [, options] = fetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.walletId).toBe('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    expect(body.ensAlias).toBe('override.eth');
  });
});
