const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

describe('hardhat sandbox module guards', () => {
  const originalEnv = { ...process.env };
  const sandboxRoot = path.join(__dirname, '..', '.vaultfire_tmp');

  const createParentModule = (pkgName) => {
    const targetDir = path.join(process.cwd(), 'node_modules', pkgName);
    const filename = path.join(targetDir, 'sandbox-entry.js');
    const parentModule = new Module(filename, module);
    parentModule.filename = filename;
    parentModule.paths = Module._nodeModulePaths(targetDir);
    return parentModule;
  };

  const resetEnv = () => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    for (const [key, value] of Object.entries(originalEnv)) {
      process.env[key] = value;
    }
  };

  beforeEach(() => {
    jest.resetModules();
    resetEnv();
    fs.rmSync(sandboxRoot, { recursive: true, force: true });
  });

  afterEach(() => {
    resetEnv();
    fs.rmSync(sandboxRoot, { recursive: true, force: true });
  });

  test('redirects solc tmp directories into the sandbox', () => {
    const { applyHardhatSandbox } = require('../infra/hardhat-sandbox');
    const sandbox = applyHardhatSandbox();
    const tmpModule = Module._load('tmp', createParentModule('solc'), false);

    const extractPath = (result) => (typeof result === 'string' ? result : result && result.name);
    const defaultDir = extractPath(tmpModule.dirSync());
    expect(defaultDir).toBeTruthy();
    const acceptedRoots = [sandbox.tmpDir, os.tmpdir()].filter(Boolean);
    expect(acceptedRoots.some((root) => defaultDir.startsWith(root))).toBe(true);
    expect(fs.statSync(defaultDir).isDirectory()).toBe(true);

    const maliciousInvocation = () => tmpModule.dirSync({ dir: '/tmp/evil', unsafeCleanup: true });

    if (tmpModule.__vaultfireGuarded) {
      const sanitizedDir = extractPath(maliciousInvocation());
      expect(sanitizedDir.startsWith(sandbox.tmpDir)).toBe(true);
      expect(fs.statSync(sanitizedDir).isDirectory()).toBe(true);
      fs.rmSync(sanitizedDir, { recursive: true, force: true });
    } else {
      try {
        maliciousInvocation();
        throw new Error('expected tmp to reject unsafe dir override');
      } catch (error) {
        expect(error.message).toMatch(/dir option must be relative|ENOENT/);
      }
    }

    fs.rmSync(defaultDir, { recursive: true, force: true });
  });

  test('stubs hardhat scoped sentry client without affecting global usage', () => {
    const { applyHardhatSandbox } = require('../infra/hardhat-sandbox');
    applyHardhatSandbox();

    const stub = Module._load('@sentry/node', createParentModule('hardhat'), false);
    expect(stub.__vaultfireSandboxStub).toBe(true);
    expect(typeof stub.init).toBe('function');
    expect(typeof stub.captureException).toBe('function');

    const real = require('@sentry/node');
    expect(real.__vaultfireSandboxStub).toBeUndefined();
  });
});
