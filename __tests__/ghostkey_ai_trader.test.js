const { spawnSync } = require('child_process');

test('ghostkey_ai_trader python tests', () => {
  const result = spawnSync('python3', ['-m', 'unittest', 'partner_plugins.tests.test_ghostkey_ai_trader'], { encoding: 'utf8' });
  const output = (result.stdout + result.stderr).trim();
  expect(output).toMatch(/OK/);
});
