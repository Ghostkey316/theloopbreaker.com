#!/usr/bin/env node
/**
 * SonarQube coverage stub to surface consolidated metrics without remote calls.
 */

const { readFileSync } = require('fs');
const path = require('path');

function loadCoverageSummary() {
  const summaryPath = path.join(__dirname, '..', 'coverage', 'coverage-summary.json');
  try {
    const raw = readFileSync(summaryPath, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    return { message: 'Coverage summary not available. Run npm test first.' };
  }
}

function main() {
  const summary = loadCoverageSummary();
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ sonarStub: true, summary }, null, 2));
}

if (require.main === module) {
  main();
}
