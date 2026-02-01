# Trust Assumptions (Current)

Vaultfire is **trust infrastructure**, so we should be explicit about what is *trusted today* vs what is *cryptographically enforced*.

This document is intentionally blunt: it describes the current trust assumptions in this repo so that auditors, integrators, and users can reason about risk.

> Vaultfire principle: **Morals over Metrics**. If something is centralized today, we say so.

---

## TL;DR

- Many safety properties are enforced by code (reentrancy guards, timelocks, caps), but some operations remain **admin/governance-controlled** in the current implementation.
- “Mission Enforcement” can be **optionally** enabled on bond distribution paths (default-off) so deployments can start permissive and progressively lock down.
- If you deploy these contracts to a public network, you must treat the **owner/governance key** as a critical security component.

---

## On-chain trust assumptions

### 1) Owner / governance authority exists (today)
Several modules include `onlyOwner` controls. This is not hidden.

Common owner powers include:
- pausing/unpausing in emergencies
- changing treasury addresses / administrative configuration
- certifying/adjudicating mission compliance state
- (in some modules) resolving disputes/challenges

**Implication:** security is bounded by the integrity and operational discipline of the owner/governance key.

**Mitigations (recommended):**
- use a multisig for ownership
- add a timelock for sensitive parameter changes
- publish a runbook + incident procedure

### 2) Mission Enforcement is a governance-anchored registry + optional gate
`contracts/MissionEnforcement.sol` supports:
- community reporting (non-binding; records evidence)
- governance adjudication/certification (binding state)

Bond contracts may optionally gate `requestDistribution()` / `distributeBond()` on MissionEnforcement compliance.

**Default:** mission gating is off, so development/test flows and early deployments are not blocked.

**When enabled:** distributions are blocked unless the module is certified compliant with the required principles.

### 3) Timelocks provide “reaction time,” not full decentralization
Many bonds require an explicit `requestDistribution()` and a delay window before `distributeBond()`.

**Implication:** timelocks help humans and monitoring systems react, but they do not remove the need for secure governance and monitoring.

---

## Off-chain trust assumptions

### 1) Oracles and real-world metrics
Any real-world metric system ultimately depends on:
- oracle integrity
- dispute processes
- economic incentives (staking/slashing)

**Implication:** if inputs are wrong, outputs can still be wrong even if contracts are bug-free.

### 2) CI/test green != mainnet secure
CI being green means:
- the test suite passed in a controlled environment
- invariants were checked as written

It does not guarantee:
- perfect oracle data
- correct governance procedures
- absence of novel economic attacks

---

## Threat model highlights (non-exhaustive)

- Key compromise of owner/governance
- Griefing/DoS via unbounded storage growth (arrays)
- Oracle manipulation / bribery / coordinated false reporting
- Economic edge cases (extreme inputs, fee/MEV dynamics)

---

## Where to look next

- `docs/ANTI_PANOPTICON_INVARIANTS.md` — mission lock at the values level
- `docs/INCIDENT_TRIAGE_CHECKLIST.md` — 60-second response playbook
- `docs/TRUST_STACK_MATURITY_MODEL.md` — how to move from “declared” → “enforced” → “attested"
