const { BeliefSyncEngine } = require('../belief_sync_engine');
test('belief sync emits events and captures origin fingerprint', async () => {
  const a = new BeliefSyncEngine('session-a', '0xabc', { autoArchive: false });
  const b = new BeliefSyncEngine('session-a', '0xdef', { autoArchive: false });
  let received = null;
  b.on('sync', (event) => {
    received = event;
  });
  const result = await a.syncChoice('fork-1', 'YES', { originEns: 'belief.eth' });

  expect(received).not.toBeNull();
  expect(received.choice).toBe('YES');
  expect(received.origin).toMatchObject({ ens: 'belief.eth', wallet: '0xabc' });
  expect(received.origin.fingerprint).toHaveLength(64);
  expect(result.origin.fingerprint).toBe(received.origin.fingerprint);

  const events = await a.storage.getRecentEvents(5);
  const localRecord = events.find((entry) => entry.nodeId === 'session:session-a');
  expect(localRecord).toBeDefined();
  expect(localRecord.payload.origin.ens).toBe('belief.eth');
});
// *** End of File
