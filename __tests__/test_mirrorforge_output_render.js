const { spawnSync } = require('child_process');

test('mirrorforge 3d output python tests', () => {
  const result = spawnSync('python3', ['-m', 'unittest', 'partner_plugins.tests.test_3d_prompt_parser'], { encoding: 'utf8' });
  const output = (result.stdout + result.stderr).trim();
  expect(output).toMatch(/OK/);
});
