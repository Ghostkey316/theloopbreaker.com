<!--
NON-NORMATIVE DOCUMENT

This file is historical/legacy/audit material and may contain aspirational language.
The canonical, current claims & limits are in: docs/CLAIMS_AND_LIMITS.md
-->

# Live Rollout Readiness Blueprint

Vaultfire now maintains a living blueprint for partners who want proof points beyond the simulated pilots. Every control in this plan is mapped to verifiable artifacts so that partners can validate production readiness before scaling traffic or revenue.

## 1. Phased Launch Timeline

| Phase | Objectives | Verifiable Evidence |
| --- | --- | --- |
| **Control Burn-In** (Week 0) | Deploy the minimal validator set to the shared staging cluster, replay the latest simulation with anonymised telemetry, and verify belief-score parity within ±2%. | `logs/live-readiness/control-burn-in.json` replay summary, `attestations/guardian/live-ready.json` guardian signature pack. |
| **Limited Wallet Rollout** (Week 1) | Enable 25 allowlisted wallets, enforce multisig governance, and route telemetry into the SecureStore mirror for out-of-band validation. | `secure_upload/live-wallet-rollout.csv` wallet confirmation ledger, `/status/reference-deployments.md` entry appended with "Live Beta" tag. |
| **Audit-Gated Expansion** (Week 2) | Run third-party penetration test, confirm telemetry sinks through audit webhooks, and publish risk exceptions. | `/docs/audits/live-beta-penetration.md` report, `telemetry/live-sink-attestations.jsonl` webhook receipts, `SECURITY.md` exceptions table update. |
| **Revenue-On Toggle** (Week 3) | Flip `vaultfire.partnerReady = true`, enable loyalty payouts, and sign off on compliance review. | `deployment/live/profiles/revenue-on.yaml` diff, `/status/metrics.md` revenue indicator, `compliance/review-logs/live-beta/approval.md` consent record. |

## 2. Telemetry Safeguards

1. **SecureStore mirroring** — live telemetry is dual-written to `secure_upload/live/` so that partners can export encrypted streams without touching production S3 buckets.
2. **Sink verification hooks** — the `telemetry/sinks/live-*.json` manifests define each downstream consumer, required checksum, and the expected response signature hash. A dedicated `npm run telemetry:verify` command hashes a test payload against each sink and fails the run if the checksum or signature changes.
3. **Consent monitoring** — wallet consent deltas are streamed to `logs/consent-monitor.jsonl`, making opt-out events visible within 60 seconds. The monitoring script raises PagerDuty alerts if any consent backlog exceeds 5 minutes.

## 3. Complexity Management

- **Launch playbooks** — each service now links back to its runbook via `/docs/runbooks/<service>.md` so engineers can perform deterministic cutovers. New partners inherit a templated `docs/partner-playbooks/<partner>.md` outline.
- **Golden environment checks** — `scripts/check-golden-env.sh` captures the canonical Node, Python, and CLI versions. CI blocks merges when the diff deviates from the golden snapshot.
- **Automation tags** — Terraform, Helm, and CLI manifests share the `automationTag` field. When combined with `deployment/sample-suite/`, partners can disable advanced flows by removing a single tag from their manifest diff.

## 4. Evidence Locker

Every artifact referenced above is captured in the `logs/live-readiness/` and `attestations/` directories. The `scripts/collect-live-evidence.py` helper consolidates them into a single compressed bundle for partner audits, logging the digest in `immutable_log.jsonl`.

Partners can request on-demand walkthroughs of each stage. The Guardian Council signs the readiness pack once all four phases and telemetry checks pass, unlocking the live production switch.
