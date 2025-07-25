const { execFileSync } = require('child_process');

test('ghostkey_ai_trader python tests', () => {
  const output = execFileSync('python3', ['-m', 'unittest', 'partner_plugins.tests.test_ghostkey_ai_trader'], { encoding: 'utf8' });
  expect(output.trim()).toMatch(/OK/);
});
