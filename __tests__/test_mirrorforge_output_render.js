const { execFileSync } = require('child_process');

test('mirrorforge 3d output python tests', () => {
  const output = execFileSync('python3', ['-m', 'unittest', 'partner_plugins.tests.test_3d_prompt_parser'], { encoding: 'utf8' });
  expect(output.trim()).toMatch(/OK/);
});
