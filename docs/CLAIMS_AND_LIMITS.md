# Vaultfire Claims & Limits (Normative)

This document is the **canonical** source for what Vaultfire **does** and **does not** claim.

If any other doc conflicts with this one, treat that doc as **historical / aspirational / non‑normative**.

## Core claims (what we stand behind)

### 1) No KYC / No government ID (Wallet-only)
- Vaultfire is designed to operate using **wallet addresses** (and cryptographic proofs), not government identity.
- We treat collecting government IDs or KYC payloads as **out of scope** and a mission violation.

### 2) Anti-surveillance stance (Mission)
Vaultfire is built around *verification over surveillance*.
- We do not position telemetry/logging as a business model.
- We avoid collecting stable identifiers and behavioral profiles.

**Limit:** Privacy-by-design is not magic. A misconfigured deployment, third-party tooling, or operator error can still leak data. We therefore:
- minimize collection by default
- restrict telemetry endpoints (residency guard)
- document privileged powers and deployment profiles

### 3) Privacy guarantees (precise meaning)
Vaultfire privacy claims mean:
- **Data minimization:** collect the minimum needed for functionality.
- **Consent:** tracked per purpose (typically as a **purpose hash**).
- **No freeform PII on-chain:** avoid writing user-provided strings to public ledgers.

**Limit (On-chain immutability):** Public blockchains are **immutable**. If any data is written on-chain, it cannot be erased.

### 4) “Right to be forgotten” (precise meaning)
When Vaultfire docs say “delete my data” / “right to be forgotten”, the enforceable meaning is:
- a user can submit a **deletion request**
- modules should **stop writing new user-associated data**
- off-chain systems under Vaultfire control should **delete/redact** within policy

**Limit:** previously published on-chain data cannot be deleted.

### 5) Cryptographic guarantees (ZK and verification)
Vaultfire aspires to “verify without revealing” using cryptography (ZK, signatures, hashes).

**Limit:** Not every module in this repository is necessarily backed by a full ZK pipeline at all times. Where ZK is not implemented end-to-end, we describe the system as **privacy-preserving by design** (not “mathematically impossible to leak”).

### 6) Governance / immutability
- Some principles are intended to be **mission-critical and immutable**.
- Other configuration parameters may change through transparent governance.

**Limit:** “Immutable” should not be used as a blanket claim for the entire system.

---

## Language rules (for all Vaultfire docs)

Use these wording constraints to keep the project trustworthy:
- Avoid absolute claims like **“guaranteed”**, **“can’t”**, **“impossible”** unless it is *formally and technically true*.
- Prefer: **“designed to”**, **“intended to”**, **“enforced by”**, **“under the following assumptions”**.
- When discussing deletion, always include: **“on-chain history is immutable”**.

---

## Cross-references
- Mission: `docs/MISSION.md`
- Trust assumptions: `docs/TRUST_ASSUMPTIONS.md`
- Threat model: `docs/security/THREAT_MODEL.md`
- Policy guardrails: `docs/security/POLICY_GUARDRAILS.md`
- Privileged functions: `docs/security/PRIVILEGED_FUNCTIONS.md`
