const { runPythonTest } = require('./pythonTestUtils');

test('security_monitor python tests', () => {
  const result = runPythonTest(['-m', 'unittest', 'tests.test_security_monitor'], { suiteName: 'security_monitor' });
  if (result.skipped) {
    expect(result.skipped).toBe(true);
    return;
  }
  expect(result.output).toMatch(/OK/);
});
