const { runPythonTest } = require('./pythonTestUtils');

test('ghostkey_ai_trader python tests', () => {
  const result = runPythonTest(['-m', 'unittest', 'partner_plugins.tests.test_ghostkey_ai_trader'], { suiteName: 'ghostkey_ai_trader' });
  if (result.skipped) {
    expect(result.skipped).toBe(true);
    return;
  }
  expect(result.output).toMatch(/OK/);
});
