const fs = require('fs');
const os = require('os');
const path = require('path');
const { ManifestFailover } = require('../services/manifestFailover');

describe('ManifestFailover', () => {
  test('falls back when manifest missing and recovers once available', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfire-manifest-'));
    const manifestPath = path.join(tmpDir, 'manifest.json');
    const telemetry = { record: jest.fn() };
    const defaults = {
      name: 'Vaultfire Protocol',
      semanticVersion: '0.0.0',
      releaseDate: null,
      ethicsTags: ['default-ethics'],
      scopeTags: ['default-scope'],
    };

    const failover = new ManifestFailover({
      manifestPath,
      defaults,
      telemetry,
      watch: false,
    });

    const initial = failover.snapshot();
    expect(initial.status).toBe('fallback');
    expect(initial.error).toBe('manifest_missing');
    expect(telemetry.record).toHaveBeenCalledWith(
      'manifest.failover.activated',
      expect.objectContaining({ manifestPath, reason: 'manifest_missing' }),
      expect.objectContaining({ tags: ['manifest'] })
    );

    telemetry.record.mockClear();

    const manifestBody = {
      semanticVersion: '2.5.1',
      ethicsTags: ['ethics-anchor', 'safeguard'],
      scopeTags: ['enterprise'],
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifestBody));

    const recovered = failover.refresh();
    expect(recovered.status).toBe('ok');
    expect(recovered.semanticVersion).toBe('2.5.1');
    expect(recovered.ethicsTags).toContain('ethics-anchor');

    expect(telemetry.record).toHaveBeenCalledWith(
      'manifest.failover.recovered',
      expect.objectContaining({ manifestPath, semanticVersion: '2.5.1' }),
      expect.objectContaining({ tags: ['manifest'] })
    );

    failover.close();
  });
});
