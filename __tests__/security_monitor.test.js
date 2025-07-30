const { spawnSync } = require('child_process');

test('security_monitor python tests', () => {
  const result = spawnSync('python3', ['-m', 'unittest', 'tests.test_security_monitor'], { encoding: 'utf8' });
  const output = (result.stdout + result.stderr).trim();
  expect(output).toMatch(/OK/);
});
