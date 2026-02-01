# Economic Invariants (Vaultfire)

Vaultfire’s claims should be **auditable**: if we say “thriving beats extraction,” that must be checkable in code + tests.

This doc is a map from **principle → mechanism → test**.

---

## Invariant 1 — Humans thrive 0 AI profits

**Claim:** AI should not be able to profit while humans are suffering.

**Mechanisms (examples):**
- Profit locking / penalty paths that route value to humans when conditions indicate harm.
- Distribution gating + timelocks to create reaction time.

**Where to verify:**
- Contracts:
  - `contracts/AIAccountabilityBondsV2.sol`
- Tests:
  - `test/AIAccountabilityBonds.test.js` (profit locking paths)
  - integration/solvency invariant tests in the Hardhat suite

---

## Invariant 2 — Partnership beats domination (AI grows WITH humans)

**Claim:** Long-term partnership and human capability growth should be more profitable than domination, task-hopping, or dependency creation.

**Mechanisms (examples):**
- AI profit caps.
- Domination penalties (human gets 100%, AI gets 0%).
- Loyalty multipliers that reward sustained partnerships.
- Human verification as a “final say” signal.

**Where to verify:**
- Contracts:
  - `contracts/AIPartnershipBondsV2.sol`
- Tests:
  - `test/AIPartnershipBonds.test.js` (profit cap, domination penalty, loyalty)

---

## Invariant 3 — No double-paying appreciation

**Claim:** Repeated distribution calls must not pay out the same appreciation more than once.

**Mechanisms (examples):**
- Baseline tracking (e.g., `lastDistributedValue`).

**Where to verify:**
- Contracts:
  - `contracts/AIPartnershipBondsV2.sol`
  - `contracts/AIAccountabilityBondsV2.sol` (if applicable)
- Tests:
  - Hardhat distribution tests and solvency invariants

---

## Invariant 4 — Solvency / yield pool accounting remains consistent

**Claim:** The protocol must not create negative balances or distribute funds it doesn’t have.

**Mechanisms (examples):**
- Yield pool enforcement.
- Contract balance checks before payouts.

**Where to verify:**
- Contracts:
  - `contracts/BaseYieldPoolBond.sol`
- Tests:
  - “V2 YieldPool/solvency invariants” suite (Hardhat)

---

## Invariant 5 — Oracles are bounded; consensus paths are not unbounded

**Claim:** Oracle consensus should not rely on unbounded loops in state-changing paths.

**Mechanisms:**
- Oracle caps (e.g., maximum oracle count) and cached counters.

**Where to verify:**
- Contracts:
  - `contracts/MultiOracleConsensus.sol`

---

## Invariant 6 — Trust without surveillance

**Claim:** Vaultfire should not drift into KYC/surveillance requirements.

**Mechanisms:**
- Policy + CI guardrails.

**Where to verify:**
- Docs:
  - `docs/security/POLICY_GUARDRAILS.md`
- Tooling:
  - `tools/lint_guardrails.js`
  - `tools/lint_values_guardrails.js`
- CI:
  - `.github/workflows/ci.yml`

---

## Notes / future tightening

This doc intentionally starts as a **map**. Over time, we can strengthen it by:
- adding explicit invariant-focused tests (property/fuzz) for each item
- including exact function names and line references
- documenting any known residual risks
