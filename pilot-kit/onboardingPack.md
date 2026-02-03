<!--
NON-NORMATIVE DOCUMENT

This file is historical/legacy/audit material and may contain aspirational language.
The canonical, current claims & limits are in: docs/CLAIMS_AND_LIMITS.md
-->

# Vaultfire Pilot Onboarding Pack

Mission-aligned partners can use this pack to boot their sandbox pilots while
retaining full visibility into telemetry, rewards, and live migration paths.

## 1. Consent-Based Telemetry Logging

- Each wallet activation must capture an explicit consent flag. The default
  adapter configuration treats consent as **opt-in** and records the timestamp,
  wallet alias, and consent channel inside `telemetry/adapters/verticalAdapters`.
- Telemetry exports roll into `telemetry/telemetry_baseline.json` so partners can
  prove adoption momentum without revealing user-level data.
- When a participant revokes consent, remove their fingerprint from
  `sandbox_wallet_registry` and flush pending events before the next export run.

## 2. Reward Simulation Interface

- Use `ghostyield_simulator.GhostYieldSimulator` to model early-stage loyalty
  flows denominated in **$GHOSTYIELD**. The simulator keeps projections in the
  low seven-figure range so finance teams can test payout bands before launch.
- Adapter ingests automatically populate the reward preview section with belief
  multiplier and loyalty signal context. Partners should review the projected
  value alongside their internal ROI thresholds each sprint.
- Audit the multiplier carryover using `engine.ghostscore_handoff()` whenever a
  wallet transitions from sandbox to production.

## 3. Live-Agnostic Data Bridge

- Vertical adapters ship with a `dataBridge` block that lists sandbox endpoints
  and flags the data stream as live-agnostic. Partners can mirror these routes to
  their staging clusters without touching production infrastructure.
- The `attestation_engine()` exports signed proofs in `/proofs/` so compliance
  reviewers can cross-check pilot metrics before toggling live traffic.
- Final readiness is declared by loading `vaultfire_3yr_protocol.yml`, which
  pulls in technical readiness checks, pilot validators, and audit trail
  integration to green-light enterprise deployments.

