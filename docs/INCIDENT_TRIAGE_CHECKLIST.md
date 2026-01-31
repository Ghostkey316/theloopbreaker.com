# 60-Second Incident Triage Checklist (Agents)

When an agent system feels "weird"—assume compromise until proven otherwise.

Vaultfire principle: **containment first, attribution later**.

---

## 0) Stop the bleeding (immediate)
- **Revoke** delegation tokens / API keys / tool permissions.
- **Disable network egress** if possible.
- Freeze automation (no autonomous actions).

---

## 1) Fast signals (60 seconds)

### A) Network egress
- What outbound requests happened recently?
- Any new domains/IPs? (webhook collectors, pastebins, unknown endpoints)

### B) Secrets access
- Did anything attempt to read:
  - `.env`, config files
  - SSH keys, cloud credentials
  - password stores

### C) Filesystem reads/writes
- Any unexpected reads in sensitive directories?
- Any writes to startup scripts / hooks / cron?

### D) Permission drift
- Did a recent update broaden scopes? (diff manifest)

### E) Blast radius
- With current permissions, what's the worst-case action it could take?

---

## 2) Preserve evidence (without leaking secrets)
- Export logs/redacted traces.
- Record commit hashes + versions.
- Snapshot manifests + configs.

---

## 3) Recover safely
- Rotate keys.
- Reduce scopes.
- Add enforcement if it was missing.

---

## 4) Postmortem prompt
"What capability did the system have that it never should have had?"

That answer becomes the next manifest constraint.
