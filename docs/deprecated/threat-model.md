# Vaultfire Threat Model

Vaultfire is an alpha-stage protocol. This document captures the highest-impact risks so contributors can prioritise mitigation work. Pair these notes with [`SECURITY.md`](../SECURITY.md) and [`docs/telemetry-schema.md`](./telemetry-schema.md) when planning upgrades.

## Auth / Identity Layer
- **Assets:** Wallet private keys (never stored), ENS lookups, session attestations, consent state.
- **Threats:** Phishing or replay of signed payloads, compromised session stores, forged ENS metadata, weak wallet normalisation.
- **Mitigations:** Wallet payloads validated server-side, consent writes require explicit opt-in, normalized wallets reduce casing bugs, tests cover replay rejection.
- **Open Items:** Harden rate limiting around login endpoints, add automated alerts for repeated failed logins, and integrate hardware-signing proofs before production rollout.

## Ethics / Guardrails
- **Assets:** Baseline values (humanity over greed, freedom over control, human/AI parity, privacy by default), partner override policies, guardrail logs.
- **Threats:** Partners attempting to disable base ethics, malformed policies skipping automation limits, log tampering that hides decisions.
- **Mitigations:** `middleware/ethicsGuard.js` merges partner policies with a non-removable baseline, logs enforced core values, and clamps automation thresholds to the strictest values. New tests (`__tests__/ethicsGuard.test.js`) enforce this behaviour.
- **Open Items:** Extend guard checks to additional services (CLI, Python scripts) and sign the log stream for tamper evidence.

## Telemetry
- **Assets:** Opt-in ledger, Sentry event stream, fallback JSONL logs.
- **Threats:** Leakage of PII or secrets through telemetry context, excessive retention, unauthorised event emission.
- **Mitigations:** Runtime schema in `telemetry/nodeTelemetry.js` blocks unknown events, strips forbidden keys, and enforces retention guidelines. Telemetry is opt-in and respects residency checks.
- **Open Items:** Automate deletion workflows for Sentry, add anonymisation tests for fallback logs, and document per-region data processors.

## Governance
- **Assets:** `governance-ledger.json`, stewardship runbooks, escalation scripts.
- **Threats:** Single maintainer compromise, ledger tampering, unclear escalation authority during incidents.
- **Mitigations:** Ledger changes require code review, `npm run audit:gov` surfaces diffs, and the roadmap towards multi-sig is documented in `governance.md`.
- **Open Items:** Recruit secondary reviewers, publish signed digests of ledger snapshots, and prototype signer registry tooling.

## CLI & Tooling
- **Assets:** Partner configuration generators, deployment scripts, secret loading helpers.
- **Threats:** Accidental exposure of environment variables, outdated dependencies, insufficient validation on partner inputs.
- **Mitigations:** README and `.gitignore` warn against committing secrets, CLI defaults to sandbox values, and tests cover access-layer enforcement.
- **Open Items:** Add interactive prompts that verify secret sources, audit dependency tree for CLI binaries, and add smoke tests for new schema versions.

## Dashboard / UI
- **Assets:** Frontend bundles, consent prompts, belief visualisations.
- **Threats:** Rendering unverified partner data, leaking PII through telemetry, clickjacking without CSP.
- **Mitigations:** Dashboard uses fixture data for pilots, telemetry requires explicit consent, and Helmet middleware enforces modern headers.
- **Open Items:** Add CSP definitions to the dev server, integrate component-level permission checks, and document UI regression testing expectations.

## General
- **Assets:** Documentation, simulation data, alignment manifests.
- **Threats:** Overstating readiness, stale simulation data misconstrued as production metrics, lack of visibility into threat model changes.
- **Mitigations:** README now marks the project as alpha, component maturity matrix sets expectations, and this threat model serves as a living document.
- **Open Items:** Schedule periodic threat model reviews and align them with quarterly governance reports.
