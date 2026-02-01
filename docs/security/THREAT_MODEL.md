# Threat Model (Vaultfire)

This document describes the **current** threat model for this repository.

Goal: make it easy for auditors, integrators, and contributors to reason about what Vaultfire **protects**, what it **assumes**, and what remains **residual risk**.

> Vaultfire principle: **Morals over Metrics** — if something is centralized today, we say so.

---

## 1) Scope & assets

### In-scope modules (non-exhaustive)
- Bond contracts (e.g., `AIPartnershipBondsV2`, `AIAccountabilityBondsV2`)
- Yield pool accounting (`BaseYieldPoolBond`)
- Mission compliance registry + gating (`MissionEnforcement`)
- Oracle / consensus components (`MultiOracleConsensus`, attestors/verifiers)

### Assets to protect
- User funds (stakes, distributions)
- Yield pool balances / reserve accounting
- Treasury addresses and their correctness (e.g., `humanTreasury`)
- Mission compliance state (what is allowed to pay out)
- Oracle integrity (inputs used for distribution decisions)
- Admin/governance keys (owner role)

---

## 2) Actors

- Humans (participants / recipients)
- AI agents and AI companies (participants / submitters)
- Community verifiers and challengers
- Oracle operators
- Contract owner / governance (admin authority)
- External dependencies (reward streams, ZK verifiers/attestors, off-chain oracle processes)

---

## 3) Trust assumptions

### A) Governance / owner key integrity
Assume the owner/governance key is not compromised and is operated with discipline.

**Mitigations (recommended):** multisig ownership, timelocks for sensitive changes, documented runbooks.

### B) Treasury receivers
Assume treasury recipients are correct and capable of receiving ETH (may still revert).

### C) Oracle correctness
Assume oracle operators + dispute processes are resistant to manipulation and collusion, within economic bounds.

### D) External verifier contracts
Assume external verifier/attestor contracts behave as specified.

---

## 4) Threats (by category)

### Fund theft / misdirection
- Reentrancy on value transfer
- Treasury address swap attacks
- Unsafe external calls

### DoS / griefing
- Storage bloat (unbounded array growth)
- Gas-heavy paths in state-changing functions
- Distribution timelock abuse (spam requests)

### Oracle manipulation
- Collusion, bribery
- Sybil oracle registration (mitigated by caps + stake)
- Dispute resolution failures

### Governance abuse
- Arbitrary censorship or compliance flips
- Improper mission certification/adjudication

### Data integrity
- Fake verifications
- Spam challenges
- Bogus metrics submissions

---

## 5) Key invariants

- Timelock is enforced before distributions.
- Distribution baselines are monotonic (`lastDistributedValue` should not allow double-paying appreciation).
- Yield pool accounting never goes negative.
- Mission enforcement gating, when enabled, blocks payouts unless compliant.

---

## 6) Attack surface review

### State-changing functions
Group by caller type:
- participants-only
- ai-company-only
- owner-only
- public/community

### External call sites
- ETH transfers (`call{value: ...}`)
- Calls into external contracts (reward streams, verifiers)

---

## 7) Mitigations present

- `nonReentrant` on value-moving flows
- Checks-Effects-Interactions ordering
- Timelocks for distributions
- Input validation
- Oracle caps / stake requirements
- Cached counters to avoid unbounded loops in scoring

---

## 8) Residual risks / open risks

- Storage growth from verifications/challenges/distributions (by design)
- View functions that scan large state without pagination
- Batch-style functions that can be gas-griefed with huge calldata

---

## 9) Operational recommendations

- Monitor events + alert on unusual patterns
- Use multisig for treasuries and ownership
- Keep a published incident runbook
- Define explicit criteria for enabling mission gating in production

---

## 10) Appendix

- Privileged functions checklist
- Dependency address checklist
- Event list
