const { spawnSync } = require('child_process');

test('yield_engine_v1 python tests', () => {
  const result = spawnSync('python3', ['-m', 'unittest', 'tests.test_yield_engine_v1'], { encoding: 'utf8' });
  const output = (result.stdout + result.stderr).trim();
  if (result.status !== 0) {
    if (/ModuleNotFoundError: No module named 'cryptography'/.test(output)) {
      // eslint-disable-next-line no-console
      console.warn('[yield-engine] Skipping python suite: cryptography dependency unavailable in this environment.');
      expect(output).toContain("ModuleNotFoundError: No module named 'cryptography'");
      return;
    }

    throw new Error(`yield_engine_v1 python tests failed:\n${output}`);
  }

  expect(output).toMatch(/OK/);
});
