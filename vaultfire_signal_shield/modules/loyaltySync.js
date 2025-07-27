const fs = require('fs');
const path = require('path');

const LEDGER = path.join(__dirname, '..', 'loyalty_ledger.csv');

exports.update = function update(posts) {
  const allies = posts.filter(p => /support/i.test(p.text || ''));
  if (!allies.length) return;
  const lines = allies.map(a => `${Date.now()},${a.user}`);
  fs.appendFileSync(LEDGER, lines.join('\n') + '\n');
};
