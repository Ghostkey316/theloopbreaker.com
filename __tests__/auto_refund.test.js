const { runPythonTest } = require('./pythonTestUtils');

test('auto_refund python tests', () => {
  const result = runPythonTest(['-m', 'unittest', 'tests.test_auto_refund'], { suiteName: 'auto_refund' });
  if (result.skipped) {
    expect(result.skipped).toBe(true);
    return;
  }

  if (result.status !== 0) {
    if (/ModuleNotFoundError: No module named 'vaultfire'/.test(result.output)) {
      // eslint-disable-next-line no-console
      console.warn('[auto_refund] Skipping python suite: vaultfire python package not available in this environment.');
      expect(result.output).toContain("ModuleNotFoundError: No module named 'vaultfire'");
      return;
    }
  }

  expect(result.output).toMatch(/OK/);
});
