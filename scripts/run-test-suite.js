#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const coverageDir = path.join(rootDir, 'coverage');
const coverageThreshold = 80;

const modules = [
  { name: 'cli', testDir: path.join('cli', '__tests__') },
  { name: 'dashboard', testDir: path.join('dashboard', '__tests__') },
  { name: 'governance', testDir: path.join('governance', '__tests__') },
  { name: 'telemetry', testDir: path.join('telemetry', '__tests__') },
  { name: 'belief-engine', testDir: path.join('belief-engine', '__tests__') },
  { name: 'vaultfire-core', testDir: path.join('vaultfire_core', '__tests__') },
];

function ensureCoverageDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readCoverageSummary(moduleName) {
  const summaryPath = path.join(coverageDir, moduleName, 'coverage-summary.json');
  if (!fs.existsSync(summaryPath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(summaryPath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`Unable to parse coverage summary for ${moduleName}: ${error.message}`);
    return null;
  }
}

function runModuleTests(moduleName, testDir) {
  console.log(`\n▶ Running ${moduleName} tests...`);
  ensureCoverageDir(path.join(coverageDir, moduleName));
  const result = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    [
      'jest',
      testDir,
      '--runInBand',
      '--coverage',
      `--coverageDirectory=${path.join('coverage', moduleName)}`,
    ],
    {
      cwd: rootDir,
      stdio: 'inherit',
      env: { ...process.env },
    }
  );

  if (result.error) {
    throw result.error;
  }

  return result.status;
}

function main() {
  ensureCoverageDir(coverageDir);
  const coverageGaps = [];
  let exitStatus = 0;

  for (const moduleInfo of modules) {
    const status = runModuleTests(moduleInfo.name, moduleInfo.testDir);
    if (status !== 0) {
      exitStatus = status;
    }

    const summary = readCoverageSummary(moduleInfo.name);
    if (summary) {
      const statements = summary.total?.statements?.pct ?? 0;
      if (statements < coverageThreshold) {
        coverageGaps.push({ module: moduleInfo.name, statements });
      }
    } else {
      coverageGaps.push({ module: moduleInfo.name, statements: 0 });
    }
  }

  if (coverageGaps.length) {
    console.warn('\n⚠️ Coverage gaps detected (< 80% statements):');
    for (const gap of coverageGaps) {
      console.warn(` - ${gap.module}: ${gap.statements.toFixed(2)}%`);
    }
    if (exitStatus === 0) {
      exitStatus = 1;
    }
  } else {
    console.log('\n✅ All modules meet coverage thresholds.');
  }

  process.exit(exitStatus);
}

main();
