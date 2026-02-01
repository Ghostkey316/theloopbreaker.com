# Trust Stack Maturity Model (Agents)

This is a practical adoption guide for teams building agent systems today.

Vaultfire principle: **make the dystopia path expensive** and the **safe path easy**.

---

## Level 0 — Unbounded
- Skills/tools run with broad filesystem + network + secrets access.
- No audit trail.

**Outcome:** eventually compromised.

---

## Level 1 — Declared capabilities (minimum viable hygiene)
- Capability manifests required.
- Deny-by-default posture.
- Explicit scopes + expiry.

**Risk:** if unenforced, this is still security theater.

---

## Level 2 — Enforced tool gateway (recommended baseline)
- All external actions route through an **orchestrator/tool gateway**.
- Gateway enforces manifest allowlists for:
  - filesystem
  - network egress
  - secrets
  - tool calls
- Logs are append-only and privacy-preserving.

**Why this works:** enforcement is outside the agent process.

---

## Level 3 — OS/container sandboxing (strong containment)
- Run skills in containers/VMs/jails.
- Deny network by default.
- Read-only filesystems where possible.

**Why this matters:** even malicious code can't exfiltrate what it can't reach.

---

## Level 4 — Attested execution (optional, high assurance)
- Capture proof that policy was active during execution.
- Optionally anchor hashes on-chain.

**Use when:** high-stakes financial ops, enterprise security requirements.

---

## Non-negotiables (Vaultfire-aligned)
- Revocation must exist.
- Expiry must exist.
- Logs must not leak secrets.
- No KYC / no surveillance as a prerequisite for safety.
