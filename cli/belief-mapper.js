#!/usr/bin/env node

const chalk = require('chalk');
const { interpreterModule, signalCompass } = require('../auth/expressExample');

function renderTable(rows) {
  const widths = rows[0].map((_, index) => Math.max(...rows.map((row) => String(row[index]).length)));
  return rows
    .map((row) =>
      row
        .map((cell, index) => String(cell).padEnd(widths[index]))
        .join('  ')
    )
    .join('\n');
}

function parseArgs(rawArgs) {
  const args = rawArgs.slice();
  const options = { map: false, term: null };
  while (args.length) {
    const token = args.shift();
    if (token === '--map' || token === '-m') {
      options.map = true;
    } else if (token === '--term' || token === '-t') {
      options.term = args.shift() || null;
    } else if (token === '--help' || token === '-h') {
      options.help = true;
    }
  }
  return options;
}

function main() {
  const argv = parseArgs(process.argv.slice(2));
  if (argv.help) {
    console.log('Usage: belief-mapper [--term <value>] [--map]');
    return;
  }

  if (argv.term) {
    const translated = interpreterModule.translateTerm(argv.term);
    console.log(renderTable([
      ['Belief Term', 'Enterprise Tag'],
      [argv.term, translated],
    ]));
    return;
  }

  const baselineRows = [
    ['Belief Term', 'Enterprise Tag'],
    ['soul-linkers', interpreterModule.translateTerm('soul-linkers')],
    ['multipliers', interpreterModule.translateTerm('multipliers')],
    ['belief-score', interpreterModule.translateTerm('belief-score')],
  ];
  console.log(chalk.cyan.bold('Vaultfire Interpreter Module — Enterprise Mapping'));
  console.log(renderTable(baselineRows));

  if (argv.map) {
    const trustMap = signalCompass.trustMap();
    const narrative = interpreterModule.explainTrustMap(trustMap);
    console.log('\n' + chalk.green('Deployment Mode:'), `${trustMap.mode.toUpperCase()} (${trustMap.indicator.label})`);
    console.log('\n' + chalk.yellow('Active Belief Signals')); 
    const rows = [['Wallet', 'Weight', 'Confidence', 'Enterprise Intent']];
    narrative.nodes.slice(0, 10).forEach((node) => {
      rows.push([
        node.walletId,
        node.weight.toFixed(3),
        node.confidence?.toFixed ? node.confidence.toFixed(2) : node.confidence,
        node.enterpriseIntent,
      ]);
    });
    console.log(renderTable(rows));
  }
}

if (require.main === module) {
  main();
}

module.exports = { renderTable };
