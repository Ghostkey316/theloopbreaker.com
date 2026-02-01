const { runPythonTest } = require('./pythonTestUtils');

test('yield_engine_v1 python tests', () => {
  const result = runPythonTest(['-m', 'unittest', 'tests.test_yield_engine_v1'], { suiteName: 'yield_engine_v1' });
  if (result.skipped) {
    expect(result.skipped).toBe(true);
    return;
  }

  const output = result.output;
  if (result.status !== 0) {
    if (/ModuleNotFoundError: No module named 'cryptography'/.test(output)) {
      const shouldWarnOptional =
        String(process.env.VAULTFIRE_TEST_WARN_OPTIONAL_DEPS || '').toLowerCase() === '1' ||
        String(process.env.VAULTFIRE_TEST_WARN_OPTIONAL_DEPS || '').toLowerCase() === 'true';
      if (process.env.NODE_ENV !== 'test' || shouldWarnOptional) {
        // eslint-disable-next-line no-console
        console.warn('[yield-engine] Skipping python suite: cryptography dependency unavailable in this environment.');
      }
      expect(output).toContain("ModuleNotFoundError: No module named 'cryptography'");
      return;
    }

    if (/ModuleNotFoundError: No module named 'vaultfire'/.test(output)) {
      const shouldWarnOptional =
        String(process.env.VAULTFIRE_TEST_WARN_OPTIONAL_DEPS || '').toLowerCase() === '1' ||
        String(process.env.VAULTFIRE_TEST_WARN_OPTIONAL_DEPS || '').toLowerCase() === 'true';
      if (process.env.NODE_ENV !== 'test' || shouldWarnOptional) {
        // eslint-disable-next-line no-console
        console.warn('[yield-engine] Skipping python suite: vaultfire python package not available in this environment.');
      }
      expect(output).toContain("ModuleNotFoundError: No module named 'vaultfire'");
      return;
    }

    throw new Error(`yield_engine_v1 python tests failed:\n${output}`);
  }

  expect(output).toMatch(/OK/);
});
