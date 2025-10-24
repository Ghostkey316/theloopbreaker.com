# Vaultfire Recovery Playbook

This guide documents the manual recovery procedure used by the Vaultfire
Protocol Reinforcement v3 rollout. Operators should use these steps when
automated recovery (`vaultfire --recover`) is not available or when
additional validation is required by an auditor.

## Prerequisites

- Ensure the latest disaster recovery snapshot exists under
  `backups/last_snapshot.json`.
- Confirm that the backup directories under `backups/daily/` are intact
  and the most recent copies of the codex memory, ledger, and companion
  configuration files are present.
- Verify file permissions allow Vaultfire services to overwrite their
  runtime logs (`logs/`).

## Recovery Steps

1. **Isolate the node** – take the impacted Vaultfire instance out of
   rotation so that new ledger writes are paused.
2. **Load the snapshot** – inspect `backups/last_snapshot.json` to
   identify the backup artifacts for `codex_memory`, `ledger_logs`, and
   `companion_settings`.
3. **Copy artifacts** – manually copy each backup file from the snapshot
   into the corresponding runtime location under `logs/`.
4. **Resynchronise codex memory** – execute the playbook entry
   `resync_codex_memory` to rebuild in-memory indices and confirm the
   restored files are readable.
5. **Re-enable monitoring** – restart `system_watchdog.py` and confirm
   that integrity checks succeed and daily backup rotation resumes.
6. **Return to service** – once the ledger and codex memory show fresh
   events, return the node to production traffic.

Document the recovery event in the mission ledger under the
`fhe-audit` component to preserve a durable trail for partner auditors.
