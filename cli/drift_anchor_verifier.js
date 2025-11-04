#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const {
  loadDataset,
  buildDriftAnchorReport,
  DEFAULT_DATASET,
} = require('../vaultfire/drift_anchor');

const OUTPUT_PATH = path.resolve(
  __dirname,
  '..',
  'vaultfire',
  'verification',
  'canonical',
  'drift_anchor_scan.json',
);

function resolveDatasetPath() {
  const custom = process.env.VAULTFIRE_DRIFT_DATASET;
  if (custom) {
    return path.resolve(custom);
  }
  return DEFAULT_DATASET;
}

function formatScore(score) {
  return score.toFixed(3).padStart(7, ' ');
}

function renderReport(report) {
  console.log(chalk.cyan('\n🔍 Vaultfire Drift Anchor Scan'));
  console.log(chalk.gray('Generated at:'), report.summary.generatedAt);
  console.log(
    chalk.gray(
      `Profiles scanned: ${report.summary.totalUsers} | Ghost pulses: ${report.summary.ghostPulses} | Legacy builders: ${report.summary.legacyBuilders}`,
    ),
  );

  console.log('\n');
  console.log(chalk.bold('User / Wallet'.padEnd(28)), 'Anchor', 'Drift (hrs)', 'Flags');
  console.log('-'.repeat(70));

  report.results.forEach((entry) => {
    const identifier = entry.userId || entry.wallet || entry.identifierHash;
    const flags = [];
    if (entry.ghostPulse) flags.push('ghost-pulse');
    if (entry.legacyBuilder) flags.push('legacy-bonus');

    const line = [
      identifier.padEnd(28),
      formatScore(entry.anchorScore),
      entry.driftTimeHours.toFixed(2).padStart(10, ' '),
      flags.join(', '),
    ];

    if (entry.legacyBuilder) {
      console.log(chalk.magenta(line.join(' ')));
    } else if (entry.ghostPulse) {
      console.log(chalk.yellow(line.join(' ')));
    } else {
      console.log(line.join(' '));
    }
  });

  console.log('\n');
}

function exportReport(report) {
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2));
  console.log(chalk.green(`Report exported to ${OUTPUT_PATH}`));
}

function main() {
  try {
    const datasetPath = resolveDatasetPath();
    const data = loadDataset(datasetPath);
    const report = buildDriftAnchorReport(data);
    exportReport(report);
    renderReport(report);
  } catch (error) {
    console.error(chalk.red('Drift Anchor scan failed:'), error.message);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = { main, renderReport, exportReport, resolveDatasetPath, formatScore };
