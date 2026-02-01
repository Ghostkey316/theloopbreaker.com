#!/usr/bin/env node
/*
  Ensures docs/security/EXTERNAL_CALLS_SURFACE_AUTOGEN.md is up-to-date.

  Fails if regeneration changes the file.
*/

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = process.cwd();
const OUT_PATH = path.join(ROOT, 'docs', 'security', 'EXTERNAL_CALLS_SURFACE_AUTOGEN.md');

(function main() {
  const normalize = (s) => String(s || '').replace(/\r\n/g, '\n');
  const before = fs.existsSync(OUT_PATH) ? fs.readFileSync(OUT_PATH, 'utf8') : '';
  execFileSync('node', [path.join('tools', 'generate_external_calls_surface.js')], { stdio: 'inherit' });
  const after = fs.existsSync(OUT_PATH) ? fs.readFileSync(OUT_PATH, 'utf8') : '';

  if (normalize(before) !== normalize(after)) {
    console.error('External calls surface doc is out of date.');
    console.error('Run: npm run gen:external-calls');
    process.exitCode = 1;
  }
})();
