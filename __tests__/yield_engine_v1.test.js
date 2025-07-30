const { spawnSync } = require('child_process');

test('yield_engine_v1 python tests', () => {
  const result = spawnSync('python3', ['-m', 'unittest', 'tests.test_yield_engine_v1'], { encoding: 'utf8' });
  const output = (result.stdout + result.stderr).trim();
  expect(output).toMatch(/OK/);
});
