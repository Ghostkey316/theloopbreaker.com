# Vaultfire Governance Model (Normative)

Vaultfire’s credibility as trust infrastructure depends on **clear governance boundaries**.

This document defines:
- what is **mission-critical and immutable**
- what is **configurable**
- what constitutes **privileged power**

See also:
- `docs/CLAIMS_AND_LIMITS.md`
- `docs/CLAIM_MAP.md`
- `docs/security/PRIVILEGED_FUNCTIONS.md`
- `docs/security/PRIVILEGED_SURFACE_AUTOGEN.md`

---

## Governance goals
1. **Morals over metrics**: changes must not create surveillance or KYC pressure.
2. **Auditability**: privileged actions are enumerable and reviewable.
3. **Reversibility where possible**: prefer mechanisms that can be paused/rolled back off-chain.
4. **Immutability where necessary**: mission-critical constraints should not be alterable by convenience governance.

---

## Mission-critical (intended immutable constraints)
These are the principles Vaultfire treats as non-negotiable:
- No KYC / no government digital ID requirement (wallet-only)
- No surveillance business model; no behavioral profiling
- Human agency preserved (no coercive lock-in)

**Note:** Some of these are enforced by code; some are enforced by repo policy + deployment profiles. Claims must be described precisely per `docs/CLAIMS_AND_LIMITS.md`.

---

## Configurable (allowed to evolve via transparent governance)
Examples of parameters that may evolve:
- telemetry endpoints (subject to residency + privacy profile)
- operational thresholds / rate limits
- partner integration defaults

Constraints:
- changes must be documented (release notes)
- must not expand data collection beyond the privacy profile without explicit opt-in + documentation

---

## Privileged powers
Privileged powers are any actions that can:
- move funds
- change enforcement policy
- pause critical operations
- alter routing for telemetry or trust sync

Canonical enumeration:
- `docs/security/PRIVILEGED_SURFACE_AUTOGEN.md`

---

## Governance threat model (high level)

### Threats
- key compromise / signer coercion
- governance capture (bribery, cartel formation)
- emergency powers abused or expanded
- silent policy drift via “small config changes”

### Mitigations
- multisig + rotation + minimum signer diversity
- timelocks where feasible
- explicit surface documentation + CI enforcement
- incident response playbooks and post-incident integrity evidence

---

## Change process (minimum bar)
1. Describe change with a claim impact analysis (which claims does it touch?)
2. Update `docs/CLAIM_MAP.md` if claims/mechanisms/tests change
3. Ensure CI green (`npm test`, surfaces, guardrails, claim-map)
4. Ship with clear notes in the relevant docs
