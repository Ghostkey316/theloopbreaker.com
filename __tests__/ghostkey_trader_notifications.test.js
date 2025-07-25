const { execFileSync } = require('child_process');

test('ghostkey_trader_notifications python tests', () => {
  const output = execFileSync('python3', ['-m', 'unittest', 'partner_plugins.tests.test_ghostkey_trader_notifications'], { encoding: 'utf8' });
  expect(output.trim()).toMatch(/OK/);
});
