const fs = require('fs');
const path = require('path');

const COVERAGE_DIR = path.join(__dirname, '..', 'coverage');
const SUMMARY_PATH = path.join(COVERAGE_DIR, 'coverage-summary.json');
const BADGE_DIR = path.join(__dirname, '..', 'docs', 'badges');
const BADGE_PATH = path.join(BADGE_DIR, 'trust-badge.svg');

function ensureDirectory(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function selectBadgeColor(coverage) {
  if (coverage >= 90) {
    return '#0f9d58';
  }
  if (coverage >= 80) {
    return '#f4b400';
  }
  return '#db4437';
}

function formatCoverage(value) {
  return Number.parseFloat(value).toFixed(1).replace(/\.0$/, '');
}

function createBadgeSvg(coverage) {
  const displayValue = formatCoverage(coverage);
  const color = selectBadgeColor(coverage);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="220" height="32" role="img" aria-label="Vaultfire trust coverage: ${displayValue}%">
  <title>Vaultfire trust coverage: ${displayValue}%</title>
  <g shape-rendering="crispEdges">
    <rect width="140" height="32" fill="#1f2937" />
    <rect x="140" width="80" height="32" fill="${color}" />
  </g>
  <g fill="#fff" text-anchor="middle" font-family="'Verdana', sans-serif" font-size="14">
    <text x="70" y="21">trust coverage</text>
    <text x="180" y="21">${displayValue}%</text>
  </g>
</svg>`;
}

function readCoverage() {
  if (!fs.existsSync(SUMMARY_PATH)) {
    return null;
  }
  try {
    const summary = JSON.parse(fs.readFileSync(SUMMARY_PATH, 'utf8'));
    return summary?.total?.statements?.pct ?? summary?.total?.lines?.pct ?? null;
  } catch (error) {
    console.warn('Unable to parse coverage summary for trust badge:', error.message);
    return null;
  }
}

function writeBadge(coverage) {
  ensureDirectory(BADGE_DIR);
  fs.writeFileSync(BADGE_PATH, createBadgeSvg(coverage));
}

function main() {
  const coverage = readCoverage();
  if (coverage === null || Number.isNaN(coverage)) {
    console.warn('Skipping trust badge generation: coverage summary missing');
    return;
  }
  writeBadge(coverage);
  const relativePath = path.relative(process.cwd(), BADGE_PATH);
  console.log(`Generated trust coverage badge at ${relativePath}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  main,
  readCoverage,
  writeBadge,
  createBadgeSvg,
};
