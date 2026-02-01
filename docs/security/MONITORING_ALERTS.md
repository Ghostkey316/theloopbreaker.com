# Monitoring & Alerts (Vaultfire)

Vaultfire principle: **containment first, attribution later**.

This doc lists the minimum monitoring signals that make Vaultfire safer *without* surveillance.

---

## What we monitor (privacy-preserving)

We monitor **contract events and system health**, not user behavior.

- Contract-level events (public chain data)
- Infrastructure health (uptime, error rates)
- Allowlisted system actions (deployments, config changes)

We do **not** require:
- KYC
- device fingerprinting
- behavioral tracking

---

## Critical alerts (page someone)

### Privilege / governance
- Ownership transfer started / accepted
- Any `onlyOwner` configuration changed
- Mission enforcement enabled/disabled
- Mission enforcement address updated

### Fund movement / payouts
- Distribution requested
- Distribution executed
- Any payout over a threshold
- Repeated failed payouts (receiver reverting)

### Oracle integrity
- Oracle registered / suspended / slashed
- Consensus round disputed
- Consensus window expired frequently

### Safety mode
- Contract paused/unpaused (where applicable)
- Emergency actions executed

---

## Warning alerts (investigate)

- Abnormally high rate of challenges/verifications
- Rapid growth of stored arrays (indexer performance risk)
- Unusual clustering of oracle submissions
- Increasing dispute rate

---

## Operational notes

- Alerts should include:
  - contract address
  - function/event name
  - tx hash
  - block number
  - human-readable summary
- Store logs in an append-only location; redact secrets.

---

## Related docs

- `docs/INCIDENT_TRIAGE_CHECKLIST.md`
- `docs/security/PRIVILEGED_FUNCTIONS.md`
- `docs/security/DEPLOYMENT_PROFILES.md`
