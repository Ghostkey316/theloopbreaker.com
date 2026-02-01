#!/usr/bin/env node
/*
  Vaultfire Values Guardrails

  Goal: prevent accidental drift into KYC/surveillance control paths.

  This is intentionally conservative:
  - scans Solidity only
  - ignores deprecated contracts (historical artifacts)
  - matches high-signal identifiers (to avoid flagging docs/comments like "no KYC")
*/

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'artifacts', 'cache', 'coverage',
]);

// We ignore deprecated Solidity because it may contain legacy examples.
const IGNORED_PATH_SUBSTRINGS = [
  `${path.sep}contracts${path.sep}deprecated${path.sep}`,
  `${path.sep}docs${path.sep}deprecated${path.sep}`,
];

const SCANNED_EXTENSIONS = new Set(['.sol']);

const BANNED_IDENTIFIERS = [
  // KYC / identity gating (high-signal identifiers)
  'setKycRequired',
  'kycRequired',
  'requireKyc',
  'trustedID',
  'setTrustedID',
  'allowlistedIdentity',
  'identityAllowlist',

  // Common vendor identifiers (avoid hard dependencies on surveillance ecosystems)
  'worldcoin',
  'clearview',
];

function shouldIgnore(fullPath) {
  for (const sub of IGNORED_PATH_SUBSTRINGS) {
    if (fullPath.includes(sub)) return true;
  }
  return false;
}

function walk(dir, files) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (shouldIgnore(fullPath)) continue;

    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }

    const ext = path.extname(entry.name);
    if (!SCANNED_EXTENSIONS.has(ext)) continue;
    files.push(fullPath);
  }
}

function findViolations(content, fileRel) {
  const violations = [];
  for (const id of BANNED_IDENTIFIERS) {
    // word-ish boundary: catch identifiers in code, but avoid matching inside larger words too often
    const re = new RegExp(`(^|[^A-Za-z0-9_])${id}([^A-Za-z0-9_]|$)`, 'g');
    let match;
    while ((match = re.exec(content)) !== null) {
      const idx = match.index;
      const before = content.slice(0, idx);
      const line = before.split(/\r?\n/).length;
      violations.push({ file: fileRel, line, identifier: id });
    }
  }
  return violations;
}

(function main() {
  const files = [];
  walk(ROOT, files);

  const violations = [];
  for (const file of files) {
    const fileRel = path.relative(ROOT, file);
    const content = fs.readFileSync(file, 'utf8');
    violations.push(...findViolations(content, fileRel));
  }

  if (violations.length) {
    console.error('Vaultfire values guardrail violation detected (banned identifier found):');
    for (const v of violations) {
      console.error(`- ${v.file}:${v.line} → ${v.identifier}`);
    }
    console.error('\nIf this is intentional, it likely belongs in docs (threat modeling), not in contract code.');
    process.exitCode = 1;
  }
})();
