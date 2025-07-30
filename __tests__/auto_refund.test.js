const { spawnSync } = require('child_process');

test('auto_refund python tests', () => {
  const result = spawnSync('python3', ['-m', 'unittest', 'tests.test_auto_refund'], { encoding: 'utf8' });
  const output = (result.stdout + result.stderr).trim();
  expect(output).toMatch(/OK/);
});
