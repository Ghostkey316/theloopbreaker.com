# Security Posture (Vaultfire)

This file is a fast, honest snapshot of Vaultfire’s security posture.

Vaultfire values:
- **Morals over Metrics**
- **Privacy over Surveillance**
- **Freedom over Control**

Security is part of those values: trust must be **auditable**, **revocable**, and **hard to subvert**.

---

## How to report security issues

See `SECURITY.md`.

---

## What “trust standard” means here

Being the trust standard is not just “code passes tests.” It means:
- threat model is explicit
- trust assumptions are explicit
- privileged power is explicit
- deployments have safe defaults
- drift into KYC/surveillance is blocked by policy + tooling

---

## Repo guardrails (anti-dystopia enforcement)

- Policy: `docs/security/POLICY_GUARDRAILS.md`
- CI checks:
  - `npm run lint:guardrails` (JS/TS import guardrails)
  - `npm run lint:values` (Solidity identifier guardrails)

These exist to prevent subtle drift toward:
- KYC gating
- surveillance tooling
- coercive “social credit” patterns

---

## Threat model & trust boundaries

- `docs/security/THREAT_MODEL.md`
- `docs/TRUST_ASSUMPTIONS.md`

---

## Privilege & governance

- `docs/security/PRIVILEGED_FUNCTIONS.md`
- `docs/security/DEPLOYMENT_PROFILES.md`
- `docs/security/PRODUCTION_DEFAULTS.md`

**Core stance:** emergency powers are acceptable when narrow + transparent; anything that can redirect funds or weaken enforcement should be timelocked.

---

## Testing & analysis

Automated:
- Hardhat tests (`npx hardhat test`)
- Slither static analysis (CI)

Recommended for production readiness:
- external smart contract audit
- bug bounty program
- formal verification for core accounting/invariants (where feasible)

---

## Monitoring (privacy-preserving)

- `docs/security/MONITORING_ALERTS.md`

We monitor protocol integrity via public events and system health — not user behavior.

---

## What is NOT promised

- “Fully decentralized” by default in all deployments
- perfect oracle truth (oracles are a security surface)

Vaultfire prefers honesty: we document the trust base and provide a path to shrink it.
