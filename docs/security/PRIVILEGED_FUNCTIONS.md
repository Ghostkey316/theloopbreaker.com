# Privileged Functions (Vaultfire)

Vaultfire values: **Morals over Metrics**, **Privacy over Surveillance**, **Freedom over Control**.

This document makes privilege explicit. If something can be abused, we say so.

---

## Why this exists

Top-tier trust infrastructure is not “trustless” — it is **minimally-trusting, explicitly-scoped, and operationally disciplined**.

If you deploy this repo:
- treat privileged keys as part of the security boundary
- prefer **multisig** ownership
- use **timelocks** for sensitive changes
- have an incident runbook

---

## Core principles for privilege

1) **Emergency powers are OK** (pause/containment) if they are narrow, transparent, and revocable.
2) **Configuration powers must be time-delayed** if they can redirect funds or change enforcement.
3) **Mission gating should move from optional → enforced over time** as the ecosystem matures.

---

## Primary privileged roles

### Contract owner / governance
Typical capabilities across modules:
- set/rotate key addresses (treasuries, enforcement registries)
- enable/disable optional enforcement
- register oracles / adjust oracle parameters
- resolve disputes (where applicable)
- withdraw excess yield pool (subject to minimum reserves)

**Recommendation:** owner should be a multisig; route sensitive actions through a timelock.

---

## High-impact privileged actions to protect with timelocks

These actions are high-impact because they can change enforcement or redirect value flows.

- Updating `MissionEnforcement` address
- Enabling/disabling mission enforcement
- Updating any treasury recipient address (e.g., human treasury)
- Oracle registration / oracle parameter changes
- Yield pool withdrawals and minimum reserve changes

---

## Suggested production defaults

- Owner = multisig (2/3 or 3/5)
- Timelock delay:
  - 24–72 hours for configuration changes
  - immediate for emergency pause (but time-delayed unpause if desired)
- Monitoring:
  - alerts on privileged events
  - alerts on distribution requests and large distributions

---

## Related docs

- `docs/TRUST_ASSUMPTIONS.md`
- `docs/security/THREAT_MODEL.md`
- `docs/INCIDENT_TRIAGE_CHECKLIST.md`
- `docs/TRUST_STACK_MATURITY_MODEL.md`
