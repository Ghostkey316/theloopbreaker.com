const fs = require('fs');
const os = require('os');
const path = require('path');
const fetch = require('node-fetch');

const { initConfig, loadConfig, testConnection, pushBeliefs } = require('../cli/actions');

jest.mock('node-fetch');

describe('vaultfire CLI actions', () => {
  let cwd;
  let tempDir;

  beforeEach(() => {
    cwd = process.cwd();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfire-cli-'));
    process.chdir(tempDir);
    fetch.mockReset();
  });

  afterEach(() => {
    process.chdir(cwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('initializes partner config scaffolding', () => {
    const result = initConfig();
    expect(fs.existsSync(result.path)).toBe(true);
    const config = loadConfig();
    expect(config.partnerId).toBe('demo-partner');
    expect(config.scopes).toContain('belief:sync');
  });

  it('tests connectivity against the health endpoint', async () => {
    fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: 'ok' }) });
    initConfig();
    const outcome = await testConnection();
    expect(outcome.ok).toBe(true);
    expect(fetch).toHaveBeenCalledWith('http://localhost:4002/health');
  });

  it('pushes beliefs to the mirror endpoint', async () => {
    fetch.mockResolvedValueOnce({ ok: true, status: 202, json: async () => ({ status: 'mirroring' }) });
    initConfig();
    const result = await pushBeliefs({ token: 'demo-token' });
    expect(result.status).toBe(202);
    expect(fetch).toHaveBeenLastCalledWith('http://localhost:4002/vaultfire/mirror', expect.any(Object));
  });
});
