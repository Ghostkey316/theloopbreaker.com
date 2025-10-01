# Trust Sync External Validation

The Trust Sync phase anchors wallet identities to belief telemetry and exposes both
local and remote verification paths so partners can audit the full trail.

## Local Telemetry Ledger
- Trust Sync stores anchor verification attempts in the local telemetry ledger for
  fast operator review.
- Each anchor is annotated with decision metadata (accepted, rejected, deferred)
  and correlated with the originating wallet session.
- Local log retention is capped at 30 days and replicated to the internal
  observability cluster during nightly syncs.

## Remote RPC Verification
- Configure `trustSync.verification.remote.telemetryEndpoint` to expose a signed
  telemetry feed for wallets under review.
- The CLI fetches remote entries, validates the signature digest, and compares the
  hashes against the local audit trail. Mismatches are reported as warnings.
- Remote attestors can return `{ entries, signature, signer, timestamp }` where the
  signature is the SHA-256 digest of sorted entry hashes. The CLI recomputes the
  digest to guarantee integrity.
- Set `allowFallback: false` if remote validation must be enforced; otherwise the
  CLI will warn and continue when the remote endpoint is unavailable.

## CLI Usage
Run `vaultfire trust-sync --wallet <address> [--history]` to produce a readiness
report. The output now includes:

- Local maturity metrics and digest of the on-disk telemetry entries.
- Remote telemetry status (`verified`, `mismatch`, `fallback`, or `skipped`).
- Warning messages when signatures mismatch, entries are missing, or remote
  services are unreachable.

## Operational Tips
- Keep the remote telemetry endpoint behind partner authentication; the CLI sends
  the configured bearer token from `telemetryApiKey` when present.
- Automate daily comparisons of the local digest and remote signature to catch
  drift early.
- Partners can replay the fallback ledger by re-posting entries that landed in
  `logs/telemetry/remote-fallback.jsonl` during outages.
