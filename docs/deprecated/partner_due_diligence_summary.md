<!--
NON-NORMATIVE DOCUMENT

This file is historical/legacy/audit material and may contain aspirational language.
The canonical, current claims & limits are in: docs/CLAIMS_AND_LIMITS.md
-->

# Vaultfire Protocol – Partner Due Diligence Notes

## Review Scope
- README overview, simulated pilot dossiers, and operational checklist.【F:README.md†L8-L117】
- Live rollout readiness blueprint and telemetry safeguards.【F:docs/live-rollout-readiness.md†L1-L30】
- Technical due diligence brief covering architecture and threat modelling.【F:docs/technical-due-diligence.md†L1-L33】
- Core service implementations for wallet whitelisting and secure storage flows.【F:vaultfire_core.js†L53-L146】【F:SecureStore.py†L39-L199】
- Security and telemetry policy detailing defense-in-depth and consent controls.【F:SECURITY.md†L3-L38】

## Strengths Observed
- **Structured partner lifecycle:** Clear phased rollout with evidence artefacts and automated readiness gating reduces launch ambiguity for new partners.【F:docs/live-rollout-readiness.md†L5-L30】
- **Operational transparency:** README consolidates simulated pilots, test automation, and readiness tooling so partner teams can verify posture before integration.【F:README.md†L11-L72】
- **Security-first defaults:** Defense-in-depth checklist (Helmet, CORS allow-lists, SSRF blocks) plus explicit telemetry consent demonstrates strong guardrails.【F:SECURITY.md†L3-L14】
- **Risk-aware architecture:** Threat model calls out attack surfaces and mitigations across belief syncing and wallet auth, complemented by hardened dependency baselines.【F:docs/technical-due-diligence.md†L9-L33】
- **Wallet integrity enforcement:** Core activation enforces manifest presence, whitelist normalization, and auth checks before permitting sync or injection, making unauthorized access unlikely.【F:vaultfire_core.js†L74-L146】
- **Telemetry stewardship:** SecureStore mobile fallback signs payloads, batches telemetry with jitter, and records dropped events, supporting auditability even on constrained devices.【F:SecureStore.py†L42-L194】

## Considerations & Open Questions
- **Simulated to live gap:** All pilots remain simulated with live activation scheduled later, so early adopters should factor additional validation cycles for production data paths.【F:README.md†L11-L21】
- **Governance load:** Wallet-based consent, multisig gating, and automation tags imply non-trivial onboarding for less crypto-native partners—worth packaging into managed services or concierge support.【F:README.md†L56-L117】【F:docs/live-rollout-readiness.md†L5-L30】
- **Operational complexity:** SecureStore telemetry queues, consent monitors, and readiness tooling create strong safeguards but introduce moving parts that demand mature DevOps ownership.【F:SecureStore.py†L42-L199】【F:README.md†L30-L41】

## Partnership Outlook
Vaultfire’s documentation depth, readiness automation, and security stance signal a protocol built with partner trust in mind. The remaining risk is execution on the first live cohorts, not architectural readiness. With a joint plan to navigate the simulated-to-live transition and ensure partners have support for the governance workflows, this protocol presents high potential for ethically aligned, wallet-native activations.
