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

## Persistence adapters

`MultiTierTelemetryLedger` now loads a pluggable persistence adapter so the
flat-file audit log can be mirrored into durable backends. The adapter is
configured via `trustSync.telemetry.persistence` and supports:

- `type: 'postgres'` – writes each entry to a relational table using `pg`.
  Provide `connection` options or a custom `clientFactory` when running inside
  existing pools. Partitioning is deferred until the reward stream ledger lands
  on-chain. <!-- TODO(vaultfire-rewards-migration): revisit retention policies -->
- `type: 'supabase'` – uses a service role key to upsert telemetry into a
  Supabase project. Ideal for partners that already enforce Supabase row-level
  policies. <!-- TODO(partner-rbac-migration): document signed row policies -->
- `type: 'json'` (default) – continues writing newline-delimited JSON when no
  external config is supplied.

If no adapter is configured or initialisation fails the ledger automatically
falls back to file-based logging, ensuring telemetry never drops.

### Configuration examples

```json
{
  "trustSync": {
    "telemetry": {
      "baseDir": "./logs/telemetry",
      "persistence": {
        "type": "postgres",
        "connection": {
          "connectionString": "postgres://vaultfire:secret@localhost:5432/telemetry"
        },
        "tableName": "vaultfire_telemetry"
      }
    }
  }
}
```

```json
{
  "trustSync": {
    "telemetry": {
      "persistence": {
        "type": "supabase",
        "url": "https://org.supabase.co",
        "serviceRoleKey": "supabase-service-role"
      }
    }
  }
}
```

### Partner spike safeguards

For partner launches expected to trigger telemetry spikes, enable database
adapters and configure auto-scaling policies before cutting over production
traffic. Governance automation will treat `rewards.stream.preview` events as
signals for upcoming payout migrations, so coordinators should monitor both the
database adapter metrics and the JSON audit chain for anomalies.
