# Vaultfire Claim Map (Normative)

This map links Vaultfire’s **normative claims** to:
- **Mechanisms** (code + configuration)
- **Tests** (what enforces the claim in CI)
- **Operational evidence** (events/logs you can observe in production)

If a claim is not mapped here, it is **not a guaranteed property** of the system.

See also: `docs/CLAIMS_AND_LIMITS.md`

---

## VF-NOKYC-001 — Wallet-only / No KYC
**Claim:** Vaultfire is designed to operate using wallet addresses and cryptographic proofs; it does not require government ID or KYC.

**Mechanisms:**
- Mission constraints: `docs/MISSION.md`, `docs/security/POLICY_GUARDRAILS.md`
- Repo guardrails (banned KYC/surveillance SDKs): `tools/lint_guardrails.js`

**Tests / CI:**
- `npm run lint:guardrails` (pre-commit + CI)

**Operational evidence:**
- Policy + deployment review evidence: `docs/security/PRODUCTION_DEFAULTS.md`

---

## VF-PRIV-001 — Privileged powers are enumerated
**Claim:** Privileged/owner-only actions are explicitly documented and auditable.

**Mechanisms:**
- Autogen privileged surface: `docs/security/PRIVILEGED_SURFACE_AUTOGEN.md`
- Human-readable privileged functions: `docs/security/PRIVILEGED_FUNCTIONS.md`

**Tests / CI:**
- `npm run gen:privileged-surface`
- `npm run lint:privileged-surface`

**Operational evidence:**
- Git diff of surface autogen artifacts across releases.

---

## VF-DEL-001 — Deletion is “stop future writes + off-chain redaction”; on-chain immutable
**Claim:** “Delete my data” means: deletion request → modules stop writing new user-associated data; off-chain systems delete/redact; on-chain history is immutable.

**Mechanisms:**
- `contracts/PrivacyGuarantees.sol`
- Canonical policy: `docs/CLAIMS_AND_LIMITS.md`

**Tests / CI:**
- Contract/unit tests: `telemetry/__tests__/` (privacy-related tests) and general suite `npm test`

**Operational evidence:**
- On-chain events: see `docs/security/EVENTS_SURFACE_AUTOGEN.md` for deletion request event names + emit sites.

---

## VF-PII-001 — No freeform PII strings written on-chain (privacy floor)
**Claim:** Avoid storing user-provided freeform strings on public ledgers for evidence/consent.

**Mechanisms:**
- `contracts/AntiSurveillance.sol` (evidence hashes)
- `contracts/PrivacyGuarantees.sol` (purpose hashes)

**Tests / CI:**
- `npm test`

**Operational evidence:**
- Event signatures show hashes, not strings: `docs/security/EVENTS_SURFACE_AUTOGEN.md`

---

## VF-RES-001 — Telemetry residency guard default-deny (no silent bypass)
**Claim:** Telemetry endpoints must satisfy residency policy; “mobile mode” does not bypass residency unless explicitly configured.

**Mechanisms:**
- `telemetry/residencyGuard.js`

**Tests / CI:**
- `telemetry/__tests__/mobile-mode-behavior.test.js`
- `telemetry/__tests__/residencyGuard.test.js`
- `npm test`

**Operational evidence:**
- Telemetry routing logs (without stable identifiers) and explicit config review.

---

## VF-GOV-001 — Governance boundaries are explicit
**Claim:** Governance and privileged powers are clearly documented; mission-critical constraints are distinguished from configurable parameters.

**Mechanisms:**
- `docs/GOVERNANCE_MODEL.md`
- `docs/security/PRIVILEGED_FUNCTIONS.md`
- `docs/security/PRIVILEGED_SURFACE_AUTOGEN.md`

**Tests / CI:**
- `npm run gen:privileged-surface`
- `npm run lint:privileged-surface`

**Operational evidence:**
- Versioned privileged surface artifacts and governance logs.

---

## VF-OBS-001 — No stable fingerprinting in telemetry by default
**Claim:** Telemetry is designed to avoid stable cross-session fingerprints.

**Mechanisms:**
- `telemetry/nodeTelemetry.js`
- `telemetry/residencyGuard.js`

**Tests / CI:**
- `telemetry/__tests__/nodeTelemetry.test.js`
- `npm test`

**Operational evidence:**
- Inspect emitted telemetry payload schema in `telemetry` module (and downstream sink configs).
