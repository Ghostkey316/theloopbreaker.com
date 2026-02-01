# Agent Capability Manifest (Vaultfire-aligned)

**Purpose:** Standardize *declared* capabilities for agent skills/tools so users can understand—and systems can enforce—blast radius.

Vaultfire principle: **trust must be verifiable without surveillance**.

This manifest is:
- **Consentful:** user can approve/deny.
- **Minimal:** request the smallest scope that works.
- **Auditable:** easy to diff between versions.
- **Enforceable:** if it can't be enforced, it must be labeled a *declaration*, not a *control*.

---

## 1) Manifest format (recommended JSON)

```json
{
  "schema": "vaultfire.capabilities.v1",
  "name": "example-skill",
  "version": "1.2.3",
  "description": "Short human description",
  "capabilities": {
    "filesystem": {
      "read": ["./docs/**", "./memory/**"],
      "write": ["./memory/**"],
      "deny": ["~/.ssh/**", "**/.env", "**/secrets/**"]
    },
    "network": {
      "egress": {
        "allow": ["https://api.example.com"],
        "deny": ["*"]
      }
    },
    "secrets": {
      "allow": ["EXAMPLE_API_KEY"],
      "deny": ["*"]
    },
    "tools": {
      "allow": ["web_fetch", "web_search"],
      "deny": ["*"]
    }
  },
  "defaults": {
    "denyByDefault": true,
    "expirySeconds": 3600
  },
  "enforcement": {
    "point": "orchestrator",
    "mode": "hard"
  }
}
```

### Notes
- Use **allowlists** wherever possible.
- Scopes should be **path-based** and **pattern-based** but must be deterministic.
- Prefer "denyByDefault: true".

---

## 2) Capability categories

### Filesystem
- `read`: list of allowed read globs
- `write`: list of allowed write globs
- `deny`: explicit deny globs (always enforced first)

### Network
- `egress.allow`: list of allowed base URLs/domains
- `egress.deny`: list of denied targets (default: `*`)

### Secrets
- `allow`: which secret keys can be accessed
- `deny`: default `*`

### Tools
- `allow`: which runtime tools are permitted
- `deny`: default `*`

---

## 3) Enforcement point (do not lie)

If manifests are not enforced, they are security theater.

`enforcement.point` MUST be one of:
- `orchestrator` (recommended): external policy gate / tool gateway
- `runtime`: inside agent runtime
- `os_sandbox`: container/jail/VM boundary
- `external_proxy`: separate service mediating actions
- `none`: declaration only (explicitly non-enforced)

`enforcement.mode`:
- `hard`: disallowed actions are blocked
- `soft`: actions allowed but logged/alerted (use sparingly)

---

## 4) Minimum best practice

For any third-party skill:
1) deny-by-default
2) no secrets access unless necessary
3) network egress restricted
4) explicit revocation/expiry

Vaultfire north star: **containment over blame**.
