# Event Index (Vaultfire)

This file is a practical index of **events you should care about** when building dashboards, monitors, or indexers.

Goal: enable **trust without surveillance** — watch protocol integrity, not user behavior.

---

## AI Partnership Bonds (V2)

Contract: `contracts/AIPartnershipBondsV2.sol`

Key events:
- `BondCreated(bondId, human, aiAgent, partnershipType, stakeAmount, timestamp)`
- `PartnershipMetricsSubmitted(bondId, submitter, timestamp)`
- `HumanVerificationSubmitted(bondId, verifier, confirmsPartnership, confirmsGrowth, confirmsAutonomy, timestamp)`
- `DistributionRequested(bondId, requester, requestedAt, availableAt)`
- `BondDistributed(bondId, humanShare, aiShare, fundShare, reason, timestamp)`
- `AIDominationPenalty(bondId, reason, timestamp)`
- `PartnershipFundAccrued(bondId, amount, newTotal, timestamp)`
- `MissionEnforcementUpdated(previous, current)`
- `MissionEnforcementEnabled(enabled)`

---

## AI Accountability Bonds (V2)

Contract: `contracts/AIAccountabilityBondsV2.sol`

Key events (non-exhaustive):
- bond lifecycle + distributions
- oracle registrations and verification/challenge flows
- mission enforcement toggles

Notes:
- arrays (verifications/challenges/distributions) are unbounded by design; use pagination getters.

---

## Mission Enforcement

Contract: `contracts/MissionEnforcement.sol`

Key events:
- ownership transfer started / accepted
- module certification/adjudication events
- reporting events (non-binding signals)

---

## Multi-Oracle Consensus

Contract: `contracts/MultiOracleConsensus.sol`

Key events:
- oracle registered / stake changed / withdrawn
- consensus round started / finalized
- disputes created / resolved
- oracle slashed / suspended

---

## Belief Oracle + Attestation

Contract: `contracts/BeliefOracle.sol`

Key events:
- `ResonanceQueried(seeker, vowHash, resonance, multiplierApplied)`
- `ResonanceDriftSet(active, guardian)`
- `GuardianUpdated(previousGuardian, newGuardian)`

---

## Recommended monitors (summary)

- Privileged actions (ownership, mission enforcement toggles, treasury changes)
- Payouts / distributions
- Oracle disputes and slashes
- Pauses/unpauses

See: `docs/security/MONITORING_ALERTS.md`
