#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { ESLint } = require('eslint');

async function run() {
  const eslint = new ESLint({
    errorOnUnmatchedPattern: false,
    overrideConfigFile: path.join(__dirname, '..', 'eslint.config.cjs'),
  });

  const results = await eslint.lintFiles([
    '**/*.{js,jsx,ts,tsx}',
    '!coverage/**',
    '!**/coverage/**',
  ]);
  const filteredResults = results.filter(result => !result.filePath.includes(`${path.sep}coverage${path.sep}`));
  const stylishFormatter = await eslint.loadFormatter('stylish');
  const stylishOutput = stylishFormatter.format(filteredResults);

  if (stylishOutput.trim()) {
    console.log(stylishOutput);
  } else {
    console.log('✅ No syntax issues detected across JS/TS sources.');
  }

  const jsonFormatter = await eslint.loadFormatter('json');
  const jsonOutput = jsonFormatter.format(filteredResults);
  const logsDir = path.join(process.cwd(), 'logs');
  fs.mkdirSync(logsDir, { recursive: true });
  fs.writeFileSync(path.join(logsDir, 'eslint-syntax.json'), jsonOutput);

  const hasFailures = filteredResults.some(result => result.errorCount > 0 || result.warningCount > 0);
  if (hasFailures) {
    process.exitCode = 1;
  }
}

run().catch(error => {
  console.error('Syntax verification failed to execute:', error);
  process.exit(1);
});
