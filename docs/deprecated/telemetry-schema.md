# Vaultfire Telemetry Schema

Vaultfire collects only a narrow, pseudonymous set of telemetry events. Anything outside this schema must be rejected by senders and will be discarded by the runtime guard in [`telemetry/nodeTelemetry.js`](../telemetry/nodeTelemetry.js).

## Allowed Events

| Event | Purpose | Required Fields | Allowed Context Keys | Allowed Tags | Allowed Metadata Keys |
| --- | --- | --- | --- | --- | --- |
| `belief.vote.cast` | Record an opted-in wallet casting a belief vote. | `wallet` (pseudonymous address) | `component`, `severity`, `metadata`, `tags` | `network`, `scope`, `module`, `pilot`, `stage` | `resonanceBucket`, `pilotId`, `voteSource`, `clientVersion` |
| `dashboard.render` | Note a dashboard render to monitor performance under consent. | `wallet` | `component`, `metadata`, `tags` | `route`, `pilot`, `scope`, `environment` | `dashboardVersion`, `widgetCount` |
| `wallet.login.result` | Capture success/failure of a wallet login attempt. | `wallet`, `metadata.result` | `component`, `severity`, `metadata`, `tags` | `surface`, `pilot`, `method` | `result`, `failureCode`, `latencyMs` |
| `telemetry.opt_in` | Track when a wallet grants or revokes telemetry consent. | `wallet`, `metadata.status` | `metadata`, `tags` | `pilot`, `scope` | `status`, `surface` |

All other events are blocked by default. If a new event is needed, update this document and the schema in code in the same pull request.

## Forbidden Fields

Never include the following data in telemetry payloads or context:

- Real names (`full_name`, `first_name`, `last_name`, etc.)
- Email addresses or phone numbers
- Physical addresses or location coordinates beyond coarse regions
- Secrets, tokens, API keys, mnemonics, or seed phrases
- Raw signatures, JWTs, or bearer tokens
- Unredacted wallet private keys or session identifiers

The runtime guard strips any key whose name contains these fragments and drops metadata values longer than 512 characters.

## Payload Minimisation

- Wallet identifiers are normalised (lowercased) and stored only as pseudonymous user IDs inside Sentry.
- Event context is trimmed to the whitelisted keys above. Extra properties are ignored.
- Telemetry is disabled by default and requires explicit opt-in. Without consent, events are discarded client-side.

## Retention & Storage

- **Remote sinks (Sentry):** Retain for a maximum of 30 days. Configure project-level retention to enforce this window.
- **Local fallback (`logs/telemetry/remote-fallback.jsonl`):** Keep for a maximum of 7 days. Rotate or delete the file sooner if local regulations require.
- **Opt-in ledger (`~/.vaultfire/telemetry-consent.json`):** Retained until the wallet revokes consent or deletes the file.

To purge telemetry for a specific wallet:

1. Remove or redact entries from Sentry within the retention window.
2. Delete lines containing the wallet ID from any local fallback files.
3. Remove the wallet entry from the opt-in ledger so future events stop streaming.

## Fallback Behaviour

When remote delivery fails and the fallback writer is enabled, the payload is appended to `logs/telemetry/remote-fallback.jsonl` using the same schema described above. The file should contain only the sanitised context plus the event name and timestamp. Do not enable verbose debug logging in production without anonymisation.

## Change Control

- Update this document and the implementation together.
- Capture the change in the changelog or release notes for partner visibility.
- Perform a privacy review when introducing new fields or increasing retention.
