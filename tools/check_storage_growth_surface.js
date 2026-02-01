#!/usr/bin/env node
/*
  Ensures docs/security/STORAGE_GROWTH_SURFACE_AUTOGEN.md is up-to-date.

  Fails if regeneration changes the file.
*/

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = process.cwd();
const OUT_PATH = path.join(ROOT, 'docs', 'security', 'STORAGE_GROWTH_SURFACE_AUTOGEN.md');

(function main() {
  const before = fs.existsSync(OUT_PATH) ? fs.readFileSync(OUT_PATH, 'utf8') : '';
  execFileSync('node', [path.join('tools', 'generate_storage_growth_surface.js')], { stdio: 'inherit' });
  const after = fs.existsSync(OUT_PATH) ? fs.readFileSync(OUT_PATH, 'utf8') : '';

  if (before !== after) {
    console.error('Storage growth surface doc is out of date.');
    console.error('Run: npm run gen:storage-growth');
    process.exitCode = 1;
  }
})();
