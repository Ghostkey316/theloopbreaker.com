#!/usr/bin/env node
/*
  Ensures docs/security/PRIVILEGED_SURFACE_AUTOGEN.md is up-to-date.

  Fails CI if generation output differs from committed file.
*/

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = process.cwd();
const OUT_PATH = path.join(ROOT, 'docs', 'security', 'PRIVILEGED_SURFACE_AUTOGEN.md');

function runGeneratorToTemp() {
  const tmpDir = path.join(ROOT, '.vaultfire_tmp');
  fs.mkdirSync(tmpDir, { recursive: true });

  const tmpOut = path.join(tmpDir, 'PRIVILEGED_SURFACE_AUTOGEN.md');

  // Run generator, then copy output to tmpOut.
  execFileSync('node', [path.join('tools', 'generate_privileged_surface.js')], { stdio: 'inherit' });
  const generated = fs.readFileSync(OUT_PATH, 'utf8');
  fs.writeFileSync(tmpOut, generated, 'utf8');

  return { tmpOut, generated };
}

(function main() {
  const existing = fs.existsSync(OUT_PATH) ? fs.readFileSync(OUT_PATH, 'utf8') : '';
  const { generated } = runGeneratorToTemp();

  if (existing !== generated) {
    console.error('Privileged surface doc is out of date.');
    console.error('Run: npm run gen:privileged-surface');
    process.exitCode = 1;
  }
})();
