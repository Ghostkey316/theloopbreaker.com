<!--
NON-NORMATIVE DOCUMENT

This file is historical/legacy/audit material and may contain aspirational language.
The canonical, current claims & limits are in: docs/CLAIMS_AND_LIMITS.md
-->

# Signal Compass Protocol

The Signal Compass synthesises live belief payloads into a real-time stream used
by the partner dashboard and automation hooks.

## Data Pipeline

1. Incoming payloads (`/vaultfire/mirror`, `/link-identity`) call
   `signalCompass.recordPayload` with wallet, partner user id, belief score,
   intents and ethics signals.
2. Each payload is captured in the Multi-Tier Telemetry Ledger.
3. The compass emits an update event which is broadcast to every connected
   Socket.IO client and persisted for time-series analysis.

## API Surface

`GET /signal-compass/state`
: Returns the full snapshot – recent payloads, rolling belief score series,
  aggregated intent counts and ethics trigger history.

Socket channel `signal-compass:update`
: Receives incremental updates without polling. The Vite dashboard subscribes
  via `subscribeToSignalCompass` and paints the live lists.

## Dashboard Widgets

- **Incoming Belief Payloads** – Shows the latest wallets and belief scores.
- **Intent Frequency** – Tallies behavioural intents observed within the
  retention window.
- **Ethics Triggers** – Highlights any ethics guard activations in real time.

Configure retention with `trustSync.signalCompass.retentionLimit` in
`vaultfirerc.json`.
