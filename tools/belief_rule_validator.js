#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'logs', 'telemetry', 'data']);
const SCANNED_EXTENSIONS = new Set(['.js', '.ts', '.tsx', '.jsx']);
const SKIP_FILES = new Set([
  path.join('utils', 'identityGuards.js'),
  path.join('services', 'identityStore.js'),
  path.join('tests', 'integrity.test.js'),
  path.join('tools', 'lint_guardrails.js'),
  path.join('tools', 'belief_rule_validator.js'),
]);
const SCAN_PATHS = [
  'partnerSync.js',
  'cli',
  'services',
  'dashboard',
  'src',
  'utils',
  'mirror',
  'hooks',
  'auth',
  'tools',
  'vaultfire_core.js',
];

const BANNED_DEPENDENCY_PATTERNS = [
  /auth0/i,
  /firebase/i,
  /cognito/i,
  /passport(?!\s*\.md)/i,
  /worldcoin/i,
  /didkit/i,
  /selfid/i,
  /decentralized-identity/i,
  /identity\.js/i,
  /kyc/i,
];

const BANNED_CONTENT_PATTERNS = [
  /did:/i,
  /self[-\s]?sovereign\s+identity/i,
  /decentralized\s+identity/i,
  /digital\s+identity\s+framework/i,
  /digital\s+identity\s+provider/i,
  /\bssi\b/i,
  /oauth\b/i,
  /openid/i,
  /firebase\s*auth/i,
  /auth0/i,
  /cognito/i,
  /worldcoin/i,
  /onfido/i,
  /passbase/i,
  /trulioo/i,
  /veriff/i,
];

function loadPackageJson() {
  const pkgPath = path.join(ROOT, 'package.json');
  const raw = fs.readFileSync(pkgPath, 'utf8');
  return JSON.parse(raw);
}

function scanDependencies() {
  const pkg = loadPackageJson();
  const combined = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const issues = [];
  for (const [name] of Object.entries(combined)) {
    for (const pattern of BANNED_DEPENDENCY_PATTERNS) {
      if (pattern.test(name)) {
        issues.push({
          type: 'dependency',
          message: `Dependency '${name}' violates belief-aligned identity guardrails.`,
        });
        break;
      }
    }
  }
  return issues;
}

function shouldSkipFile(relativePath) {
  if (SKIP_FILES.has(relativePath)) {
    return true;
  }
  return false;
}

function walk(dir, callback) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(ROOT, fullPath);
    if (entry.isDirectory()) {
      walk(fullPath, callback);
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (!SCANNED_EXTENSIONS.has(ext)) {
        continue;
      }
      if (shouldSkipFile(relativePath)) {
        continue;
      }
      callback(fullPath, relativePath);
    }
  }
}

function scanContent() {
  const issues = [];
  for (const target of SCAN_PATHS) {
    const resolved = path.join(ROOT, target);
    if (!fs.existsSync(resolved)) {
      continue;
    }
    const stats = fs.statSync(resolved);
    if (stats.isDirectory()) {
      walk(resolved, (fullPath, relativePath) => {
        const content = fs.readFileSync(fullPath, 'utf8');
        for (const pattern of BANNED_CONTENT_PATTERNS) {
          if (pattern.test(content)) {
            issues.push({
              type: 'content',
              file: relativePath,
              message: `Detected disallowed identity pattern '${pattern}' in ${relativePath}.`,
            });
            break;
          }
        }
      });
    } else if (stats.isFile()) {
      const relativePath = path.relative(ROOT, resolved);
      if (shouldSkipFile(relativePath)) {
        continue;
      }
      const ext = path.extname(resolved).toLowerCase();
      if (!SCANNED_EXTENSIONS.has(ext)) {
        continue;
      }
      const content = fs.readFileSync(resolved, 'utf8');
      for (const pattern of BANNED_CONTENT_PATTERNS) {
        if (pattern.test(content)) {
          issues.push({
            type: 'content',
            file: relativePath,
            message: `Detected disallowed identity pattern '${pattern}' in ${relativePath}.`,
          });
          break;
        }
      }
    }
  }
  return issues;
}

(function main() {
  const dependencyIssues = scanDependencies();
  const contentIssues = scanContent();
  const issues = [...dependencyIssues, ...contentIssues];

  if (issues.length) {
    // eslint-disable-next-line no-console
    console.warn('⚠️  Digital identity or centralized auth references detected:');
    for (const issue of issues) {
      // eslint-disable-next-line no-console
      console.warn(`- ${issue.message}`);
    }
    process.exitCode = 1;
    return;
  }

  // eslint-disable-next-line no-console
  console.log('✅ Belief-Aligned: No digital ID detected. Wallet-native only.');
})();
