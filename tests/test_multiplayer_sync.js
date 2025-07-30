const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { BeliefSyncEngine } = require('../belief_sync_engine');
const { createIframe } = require('../web_mirror_viewer');

function resetLog() {
  const p = path.join(__dirname, '..', 'fork_log.json');
  fs.writeFileSync(p, '[]');

function testSync() {
  resetLog();
  const a = new BeliefSyncEngine('s1', 'g1');
  const b = new BeliefSyncEngine('s1', 'g2');
  let received = null;
  b.on('sync', e => { received = e; });
  a.syncChoice('fork1', 'A');
  assert(received && received.choice === 'A');
  const log = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fork_log.json')));
  assert(log.length === 1);

function testViewerConfig() {
  const cfgPath = path.join(__dirname, '..', 'embed_config.json');
  const cfg = { width: 500, height: 300, visual_shell: true };
  fs.writeFileSync(cfgPath, JSON.stringify(cfg));
  const html = createIframe('https://example.com');
  assert(html.includes('?visual_shell=1'));
  assert(html.includes('width="500"'));
  fs.writeFileSync(cfgPath, JSON.stringify({ width: 640, height: 480 }));

}
test('test_multiplayer_sync', () => {
  testSync();
  testViewerConfig();
});
