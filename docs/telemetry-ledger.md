# Multi-Tier Telemetry Ledger

The telemetry ledger separates partner-facing observability from internal ethics
reviews and an immutable audit chain. Every ledger entry is stamped with a UUID,
timestamp and SHA-256 hash linking the previous entry, forming an append-only
trail.

## Channels

- **Partner** – Operational events suitable for partner dashboards. Includes
  activation milestones, reward lookups and live signal snapshots.
- **Ethics** – Restricted channel for the internal review team. Captures
  sensitive actions (auth refresh, breach analysis) without exposing them to
  partners.
- **Audit** – Append-only log that combines all events with a cryptographic
  chain. Stored in `logs/telemetry/audit.log` and validated by ensuring each
  entry references the previous hash.

`services/telemetryLedger.js` manages the files, ensures directories exist and
computes the running hash chain. Helper `readChannel(channel)` returns the raw
entries for inspection or test assertions.

## Example Usage

```js
const ledger = new MultiTierTelemetryLedger();
ledger.record('identity.anchor.linked', { walletId: '0xabc', partnerUserId: 'demo' }, {
  tags: ['identity'],
  visibility: { partner: true, ethics: true, audit: true },
});
```

Production deployments should point `trustSync.telemetry.baseDir` to a persistent
volume so the audit history survives restarts.
