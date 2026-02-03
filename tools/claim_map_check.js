#!/usr/bin/env node
/*
  Ensures the normative claim map stays anchored to real code/tests.

  Rules (simple on purpose):
  - docs/CLAIM_MAP.md must exist.
  - Each claim section header must look like: "## VF-... — ..."
  - Every bullet/line that references a repo path like `foo/bar.js` must point to an existing file.

  This is not a linter for prose; it's a drift preventer.
*/

const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();
const claimMapPath = path.join(repoRoot, 'docs', 'CLAIM_MAP.md');

function fail(msg) {
  console.error(`claim-map-check: ${msg}`);
  process.exitCode = 1;
}

function fileExists(rel) {
  const abs = path.join(repoRoot, rel);
  return fs.existsSync(abs) && fs.statSync(abs).isFile();
}

function main() {
  if (!fs.existsSync(claimMapPath)) {
    fail('Missing docs/CLAIM_MAP.md');
    return;
  }

  const text = fs.readFileSync(claimMapPath, 'utf8');

  const headerRe = /^##\s+(VF-[A-Z0-9-]+)\s+—\s+(.+)$/gm;
  const headers = [];
  let m;
  while ((m = headerRe.exec(text)) !== null) {
    headers.push({ id: m[1], title: m[2], index: m.index });
  }

  if (!headers.length) {
    fail('No claim headers found. Expected lines like: "## VF-XXXX-001 — Title"');
  }

  // Find repo-path references inside backticks.
  const pathRe = /`([A-Za-z0-9_.-]+\/[A-Za-z0-9_./-]+)`/g;
  const missing = new Set();
  while ((m = pathRe.exec(text)) !== null) {
    const rel = m[1];
    // Skip obvious non-paths
    if (rel.startsWith('http://') || rel.startsWith('https://')) continue;
    // Some docs refer to directories; we only validate files.
    const abs = path.join(repoRoot, rel);
    if (!fs.existsSync(abs)) {
      missing.add(rel);
      continue;
    }
    const st = fs.statSync(abs);
    if (st.isDirectory()) {
      // Allow dirs if explicitly referenced, but prefer file references.
      continue;
    }
  }

  if (missing.size) {
    for (const rel of Array.from(missing).sort()) {
      fail(`Broken path reference in docs/CLAIM_MAP.md: ${rel}`);
    }
  }

  if (!process.exitCode) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          claims: headers.map((h) => h.id),
          count: headers.length,
        },
        null,
        2
      )
    );
  }
}

main();
