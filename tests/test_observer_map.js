const fs = require('fs');
const assert = require('assert');

function testHtml() {
  const html = fs.readFileSync('observer_hub.html', 'utf8');
  assert(html.includes('Global Belief Map'));
  assert(html.includes('tr.high'));
}

try {
  testHtml();
  console.log('OK');
} catch (err) {
  console.error('FAIL', err);
  process.exit(1);
}
