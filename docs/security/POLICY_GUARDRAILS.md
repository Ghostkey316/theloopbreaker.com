# Policy Guardrails (Vaultfire)

Vaultfire values are not marketing — they are the security model.

- **Morals over Metrics**
- **Privacy over Surveillance**
- **Freedom over Control**

This repository enforces a few *hard* “no-go” zones to prevent drift into dystopia.

---

## What is banned (non-negotiable)

### 1) KYC / identity gating as a requirement to participate
No “papers please”. No privileged allowlists masquerading as safety.

Banned patterns include (examples):
- `setKycRequired(...)`
- `kycRequired`
- `trustedID`
- `allowlistedIdentity`

### 2) Surveillance tooling as a prerequisite for trust
No behavioral harvesting, device fingerprinting, or biometric verification.

Banned patterns include (examples):
- biometric identity verification SDKs
- device fingerprinting requirements for participation

### 3) Social credit / coercive scoring
No punishment for dissent or conformity enforcement.

---

## What *is* allowed

- Privacy-preserving verification (ZK proofs, attestations)
- Consentful, revocable delegation
- Monitoring protocol integrity via public events (payouts, governance actions) — **not** user behavior tracking
- Optional “production profiles” that increase safety through **governance discipline** (multisig + timelocks), not surveillance

---

## Required documentation discipline

If you add or change anything privileged (owner/governance powers), you must update:
- `docs/security/PRIVILEGED_FUNCTIONS.md`

If you add new operational assumptions, update:
- `docs/TRUST_ASSUMPTIONS.md`
- `docs/security/THREAT_MODEL.md`

---

## CI guardrails

CI runs lightweight scans to catch obvious violations before they land.

- JS/TS guardrails: `npm run lint:guardrails`
- Solidity/value guardrails: `npm run lint:values`

These checks intentionally focus on **high-signal identifiers** (e.g., `setKycRequired`) to avoid false positives in documentation that discusses threats.
