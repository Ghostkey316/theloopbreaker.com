const { execFileSync } = require('child_process');

test('partner module access layer python tests', () => {
  const output = execFileSync('python3', ['-m', 'unittest', 'partner_plugins.tests.test_partner_module_access_layer'], { encoding: 'utf8' });
  expect(output.trim()).toMatch(/OK/);
});
