const { runPythonTest } = require('./pythonTestUtils');

test('ghostkey_trader_notifications python tests', () => {
  const result = runPythonTest(['-m', 'unittest', 'partner_plugins.tests.test_ghostkey_trader_notifications'], { suiteName: 'ghostkey_trader_notifications' });
  if (result.skipped) {
    expect(result.skipped).toBe(true);
    return;
  }
  expect(result.output).toMatch(/OK/);
});
