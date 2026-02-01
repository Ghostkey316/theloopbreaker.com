const { runPythonTest } = require('./pythonTestUtils');

test('vaultfire_media python tests', () => {
  const result = runPythonTest(['final_modules/tests/test_vaultfire_media.py'], { suiteName: 'vaultfire_media' });
  if (result.skipped) {
    expect(result.skipped).toBe(true);
    return;
  }
  expect(result.output).toMatch(/OK/);
});
