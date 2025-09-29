#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const BANNED_PATTERNS = [
  { regex: /require\(['"]([^'"]*(biometric|face[-_]?(scan|print)|iris|fingerprint|retina|palm)[^'"]*)['"]\)/gi, reason: 'Biometric surveillance libraries are banned' },
  { regex: /from\s+['"]([^'"]*(biometric|kyc|aml|surveillance)[^'"]*)['"]/gi, reason: 'Identity surveillance imports are not allowed' },
  { regex: /require\(['"]([^'"]*\b(kyc|aml|worldcoin|clearview|verifyme)\b[^'"]*)['"]\)/gi, reason: 'KYC and surveillance SDKs are forbidden' },
];

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build']);
const SCANNED_EXTENSIONS = new Set(['.js', '.ts', '.tsx', '.jsx']);

function walk(dir, results) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, results);
    } else {
      const ext = path.extname(entry.name);
      if (!SCANNED_EXTENSIONS.has(ext)) continue;
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const pattern of BANNED_PATTERNS) {
        pattern.regex.lastIndex = 0;
        let match;
        while ((match = pattern.regex.exec(content)) !== null) {
          const moduleName = match[1] || '';
          const normalized = moduleName.toLowerCase();
          if (normalized.includes('originfingerprint') || normalized.includes('identitystore') || normalized.includes('yamljs')) {
            continue;
          }
          results.push({ file: path.relative(ROOT, fullPath), reason: `${pattern.reason}: ${moduleName}` });
        }
      }
    }
  }
}

(function main() {
  const violations = [];
  walk(ROOT, violations);
  if (violations.length) {
    console.error('Vaultfire ethics guardrail violation detected:');
    for (const violation of violations) {
      console.error(`- ${violation.file}: ${violation.reason}`);
    }
    process.exitCode = 1;
  }
})();
