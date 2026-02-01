# Production Defaults (Vaultfire)

Vaultfire values:
- **Morals over Metrics**
- **Privacy over Surveillance**
- **Freedom over Control**

This is the one-page “how to not screw this up” for real deployments.

---

## 1) Ownership & governance (minimum)

- Owner MUST be a **multisig**.
  - recommended: 2/3 for small teams, 3/5 for larger.
- Use a **timelock** for any change that can:
  - redirect funds
  - weaken enforcement
  - change oracle integrity

**Rule of thumb:** emergency pause can be immediate; everything else is delayed.

---

## 2) Mission enforcement (do not ship without a plan)

- For serious value, mission enforcement gating should be **ON** for distribution paths.
- Publish:
  - what “mission compliant” means operationally
  - who adjudicates
  - what evidence is required
  - the appeal path

If mission gating is OFF (temporarily): publish the timeline and criteria to turn it ON.

---

## 3) Oracles (treat as a security surface)

- Require independent operators (avoid single-domain control).
- Define onboarding criteria and removal criteria.
- Monitor disputes and expirations.

**Bad oracle data can make correct code pay incorrectly.**

---

## 4) Safety rails

- Prefer bounded batch entrypoints in production orchestrations when available.
- Use pagination getters when reading unbounded arrays.

---

## 5) Monitoring (privacy-preserving)

- Monitor events + infrastructure health (no KYC, no tracking).
- Alerts must fire on:
  - privilege changes
  - mission enforcement toggles
  - treasury/address changes
  - distributions
  - oracle disputes/slashes

See: `docs/security/MONITORING_ALERTS.md`

---

## 6) Incident posture

- Have a published runbook.
- Run at least one “pause + rotate + recover” tabletop exercise.

See: `docs/INCIDENT_TRIAGE_CHECKLIST.md`

---

## 7) Public credibility checklist

To be *the standard*, do these:
- [ ] external security review / audit
- [ ] public bug bounty
- [ ] published threat model + trust assumptions
- [ ] minimal privileged surface + documented controls

---

## Related docs

- `docs/security/DEPLOYMENT_PROFILES.md`
- `docs/security/PRIVILEGED_FUNCTIONS.md`
- `docs/security/THREAT_MODEL.md`
- `docs/TRUST_ASSUMPTIONS.md`
