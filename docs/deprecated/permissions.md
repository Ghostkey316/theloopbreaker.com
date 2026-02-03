<!--
NON-NORMATIVE DOCUMENT

This file is historical/legacy/audit material and may contain aspirational language.
The canonical, current claims & limits are in: docs/CLAIMS_AND_LIMITS.md
-->

# Permissions

Vaultfire uses a simple role-based access control (RBAC) model. Roles are
stored in `rbac_roles.json` and can be adjusted using the utilities in
`vaultfire.access.rbac`.

## Roles

- **Admin** – full control over protocol settings and refund overrides.
- **Operator** – may freeze or unfreeze refunds and view logs.
- **Read-Only** – can only view public audit data.

## Override Key

An environment variable `VAULTFIRE_OVERRIDE_KEY` acts as a root-level
backdoor. If a matching key is provided, permission checks are bypassed.
Use this only for break-glass scenarios.

## Example

```python
from vaultfire.access import rbac
rbac.set_role("alice", "Operator")

if rbac.has_permission("alice", "freeze_refunds"):
    freeze_refunds("alice")
```

Roles are persisted to disk for the demo environment but should be
managed in a secure database for production use.
