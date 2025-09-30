'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const schema = require('../../schemas/vaultfirerc.schema.json');
const { buildConfig, runCli } = require('../pilot-launcher');

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

describe('pilot-launcher', () => {
  it('generates schema-compliant config for each supported partner type', () => {
    ['light-consumer', 'analytics', 'infra-integrator'].forEach((partnerType) => {
      const config = buildConfig(partnerType);
      expect(validate(config)).toBe(true);
      expect(config.partnerType).toBe(partnerType);
      expect(config.modules['belief-sync'].enabled).toBe(true);
    });
  });

  it('writes configuration files through the CLI', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pilot-launcher-'));
    const outputPath = path.join(tmpDir, '.vaultfirerc.json');
    runCli(['node', 'pilot-launcher', 'light-consumer', '--output', outputPath]);
    const stored = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    expect(stored.partnerType).toBe('light-consumer');
    expect(validate(stored)).toBe(true);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('throws for unknown partner types', () => {
    expect(() => buildConfig('mystery')).toThrow(/Unknown partner type/);
  });
});
