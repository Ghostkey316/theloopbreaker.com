const { spawnSync } = require('child_process');

test('partner module access layer python tests', () => {
  const result = spawnSync('python3', ['-m', 'unittest', 'partner_plugins.tests.test_partner_module_access_layer'], { encoding: 'utf8' });
  const output = (result.stdout + result.stderr).trim();
  expect(output).toMatch(/OK/);
});
