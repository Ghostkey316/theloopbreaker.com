const { execFileSync } = require('child_process');

test('vaultfire_media python tests', () => {
  const output = execFileSync('python3', ['final_modules/tests/test_vaultfire_media.py'], { encoding: 'utf8' });
  expect(output.trim()).toMatch(/OK/);
});
