const { spawnSync } = require('child_process');

test('ghostkey_trader_notifications python tests', () => {
  const result = spawnSync('python3', ['-m', 'unittest', 'partner_plugins.tests.test_ghostkey_trader_notifications'], { encoding: 'utf8' });
  const output = (result.stdout + result.stderr).trim();
  expect(output).toMatch(/OK/);
});
