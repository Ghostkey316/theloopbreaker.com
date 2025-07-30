const { spawnSync } = require('child_process');

test('vaultfire_media python tests', () => {
  const result = spawnSync('python3', ['final_modules/tests/test_vaultfire_media.py'], { encoding: 'utf8' });
  const output = (result.stdout + result.stderr).trim();
  expect(output).toMatch(/OK/);
});
