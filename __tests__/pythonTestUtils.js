'use strict';

const { spawnSync } = require('child_process');

function findPythonExecutable() {
  const candidates = ['python3', 'python'];
  for (const candidate of candidates) {
    try {
      const result = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
      const output = `${result.stdout || ''}${result.stderr || ''}`;
      if (result.status === 0 && /Python\s+\d+/i.test(output)) {
        return candidate;
      }
    } catch (error) {
      // ignore
    }
  }
  return null;
}

function runPythonTest(args, { suiteName = 'python tests', allowMissing = true } = {}) {
  const python = findPythonExecutable();
  if (!python) {
    const message = `[${suiteName}] Skipping: python not found in PATH (tried python3, python).`;
    if (allowMissing) {
      // eslint-disable-next-line no-console
      console.warn(message);
      return { skipped: true, output: message, status: 0 };
    }
    throw new Error(message);
  }

  const result = spawnSync(python, args, { encoding: 'utf8' });
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
  return { skipped: false, output, status: result.status };
}

module.exports = {
  findPythonExecutable,
  runPythonTest,
};
