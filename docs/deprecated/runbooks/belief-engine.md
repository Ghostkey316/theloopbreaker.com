<!--
NON-NORMATIVE DOCUMENT

This file is historical/legacy/audit material and may contain aspirational language.
The canonical, current claims & limits are in: docs/CLAIMS_AND_LIMITS.md
-->

# Belief Engine Runbook

## Setup Checklist
- Verify `logs/partner_relays/` and `partner_port/external_nodes.json` are writable for relay bookkeeping.
- Configure relay keys and partner endpoints prior to registering external nodes.
- Ensure crypto libraries are available (Node.js 18+) for payload signing and encryption.
- Run belief engine unit tests with `node scripts/run-test-suite.js` before enabling new partner relays.

## Integration Risk Factors
- Missing partner relay directories will prevent fallback logging during outages.
- Unauthorised wallet fingerprints can leak into belief syncs if node registration is not validated.
- Large retry queues may accumulate if outbound endpoints reject payloads or throttle requests.

## Recovery Steps
- Inspect `logs/partner_relays/*.jsonl` for buffered payloads and relay them after restoring connectivity.
- Clear or amend `partner_port/external_nodes.json` to remove stale endpoints before re-registering nodes.
- Execute `signalRelay.retry({ now })` (via `BeliefSyncEngine.processRetryQueue`) with a controlled timestamp to drain queued deliveries and honour circuit breaker cooldowns.
