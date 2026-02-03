# Vaultfire Production Privacy Profile (Normative)

This document describes **deployable privacy defaults**.

If a deployment deviates from this profile, it must be explicitly documented as a different profile and may not be described as “privacy-first by default.”

See: `docs/CLAIMS_AND_LIMITS.md` and `docs/CLAIM_MAP.md`

---

## Goals
- Enable operational observability **without surveillance**.
- Avoid stable identifiers, device fingerprinting, and user profiling.
- Keep telemetry region-resident when required by policy.

## Default rules

### 1) Data minimization
Collect only what is required to:
- keep the system reliable
- detect failures
- support incident response

Avoid collecting:
- raw content
- freeform text that could include PII
- stable identifiers (wallet ids, device ids) unless strictly required

### 2) Prohibited telemetry fields (production)
The following should **never** be emitted in production telemetry payloads:
- wallet addresses or wallet ids
- email, phone, government id, biometrics
- device fingerprints or persistent device identifiers
- full IP addresses (prefer coarse region inference if needed)

### 3) Residency guard: default-deny
Telemetry endpoints must pass residency checks. Mobile mode must not silently bypass residency.

Implementation reference:
- `telemetry/residencyGuard.js`
- tests in `telemetry/__tests__/`

### 4) Third-party error tooling
If using third-party error tooling (e.g., Sentry):
- do not include wallet IDs or other stable identifiers in scope/tags/user contexts
- redact request bodies by default
- treat stack traces as potentially sensitive when they include inputs

### 5) Logging
- prefer structured logs
- redact secrets/keys
- keep logs local by default; ship only what is necessary

---

## Profiles

### Dev
- may log more, but never include secrets or KYC payloads

### Pilot
- limited telemetry, explicit consent where applicable

### Production (default)
- this profile

---

## Verification
- `npm test` telemetry tests must pass
- residency guard tests must pass
- claim map must remain consistent: `npm run lint:claim-map`
