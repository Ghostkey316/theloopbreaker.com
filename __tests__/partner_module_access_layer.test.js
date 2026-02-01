const { runPythonTest } = require('./pythonTestUtils');

test('partner module access layer python tests', () => {
  const result = runPythonTest(['-m', 'unittest', 'partner_plugins.tests.test_partner_module_access_layer'], { suiteName: 'partner_module_access_layer' });
  if (result.skipped) {
    expect(result.skipped).toBe(true);
    return;
  }
  expect(result.output).toMatch(/OK/);
});
