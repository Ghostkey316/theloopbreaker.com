const fs = require('fs');
const assert = require('assert');
const { detectSignals } = require('../signal_compass');

fs.writeFileSync('memory_log.json', JSON.stringify([
  { ghost_id: 'g1', session_id: 's1', action: 'speak', details: { text: 'trust conviction' }, timestamp: 0 }
]));

const data = detectSignals();
assert(Array.isArray(data) && data[0].ghost_id === 'g1');
assert(fs.existsSync('signal_compass.json'));
console.log('OK');
