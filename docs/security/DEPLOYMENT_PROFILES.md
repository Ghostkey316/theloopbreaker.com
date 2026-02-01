# Deployment Profiles (Vaultfire)

Vaultfire values:
- **Morals over Metrics**
- **Privacy over Surveillance**
- **Freedom over Control**

This doc turns those values into **operational defaults**.

The goal is to make the *safe path easy* and the *dystopia path expensive*.

---

## The idea

Vaultfire can be deployed in stages without pretending everything is fully decentralized on day 1.

Each profile defines:
- who holds privileged power (and how)
- what enforcement is enabled
- what monitoring is required
- what changes require a timelock

---

## Profile 0 — Local / Dev (fast iteration)

**Use when:** hacking, demos, local forks.

- Owner: EOA acceptable
- Mission enforcement gating: typically **OFF**
- Timelocks: optional
- Monitoring: minimal

**Rules:**
- never reuse dev keys on public networks
- never treat dev profile as “secure enough” for real value

---

## Profile 1 — Pilot (real users, limited value)

**Use when:** early real-world pilots with controlled risk.

### Ownership
- Owner MUST be a **multisig**
  - recommended: 2/3 or 3/5

### Mission enforcement
- Mission enforcement gating: **ON for new deployments** once module(s) are certified compliant.
- If gating is OFF temporarily, publish the reason + timeline to turn it ON.

### Timelocks
- Sensitive changes must be timelocked (24–72h recommended):
  - updating `MissionEnforcement` address
  - enabling/disabling mission enforcement
  - changing treasury recipient addresses
  - oracle registration / parameter changes
  - yield pool withdrawal thresholds

### Monitoring (required)
- Alerts on:
  - ownership transfer initiated / accepted
  - `MissionEnforcementUpdated` / `MissionEnforcementEnabled`
  - distribution requested / distributed
  - oracle registrations + dispute resolutions
  - unusually large payouts or repeated payout attempts

### Incident response
- Keep `docs/INCIDENT_TRIAGE_CHECKLIST.md` as the runbook.
- Emergency pause is allowed, but must be logged publicly.

---

## Profile 2 — Production (public, serious value)

**Use when:** open participation and/or meaningful capital.

### Ownership
- Owner: multisig + explicit signers policy
- Prefer a timelock controller as the only owner, with multisig as proposer/executor.

### Mission enforcement
- Mission enforcement gating: **ON** for all distribution paths.
- Mission certification/adjudication:
  - documented criteria
  - public evidence references
  - clear appeal path

### Oracles
- Require a documented onboarding process for oracles.
- Prefer multiple independent operators.
- Define explicit “oracle failure mode” behavior (pause, degrade, or fallback).

### Monitoring + transparency
- Publish monitored event list.
- Publish a public dashboard (even minimal) for:
  - mission compliance state
  - recent distributions
  - oracle health (active count, disputes)

### Safety rails
- Bounded batch functions should be the default in production orchestrations.
- Treat any privileged change as a security event.

---

## Profile 3 — High Assurance (enterprise / critical infrastructure)

**Use when:** governments, critical systems, or very high stakes.

- Enforced gateway policies (deny-by-default) for offchain components
- OS/container sandboxing for agent tooling
- Attested execution (optional)
- Independent audits + continuous bug bounty

---

## Minimal “production-ready” checklist

- [ ] Multisig owner configured
- [ ] Timelock policy documented + active
- [ ] Mission enforcement enabled for distributions
- [ ] Monitoring alerts configured
- [ ] Incident runbook prepared and tested
- [ ] Public statement of trust assumptions + threat model

---

## Related docs

- `docs/TRUST_ASSUMPTIONS.md`
- `docs/security/THREAT_MODEL.md`
- `docs/security/PRIVILEGED_FUNCTIONS.md`
- `docs/INCIDENT_TRIAGE_CHECKLIST.md`
- `docs/TRUST_STACK_MATURITY_MODEL.md`
