# Attestation Schema (Provenance + Scope)

Vaultfire stance: provenance is not a vibe—it's **verifiable accountability**.

A signature alone answers *who signed*, not *what they reviewed*.

This schema makes attestations 2D:
1) **Identity** (signer)
2) **Scope** (what was actually reviewed/tested)

---

## 1) Data model (signed JSON)

```json
{
  "schema": "vaultfire.attestation.v1",
  "artifact": {
    "type": "skill|contract|package|repo",
    "name": "example-skill",
    "version": "1.2.3",
    "hash": "sha256:..."
  },
  "manifest": {
    "schema": "vaultfire.capabilities.v1",
    "summary": {
      "filesystem": "read ./docs/**; write ./memory/**",
      "network": "egress allow api.example.com",
      "secrets": "deny *",
      "tools": "allow web_fetch, web_search"
    },
    "enforcementPoint": "orchestrator|runtime|os_sandbox|external_proxy|none"
  },
  "review": {
    "scopeTags": ["egress", "secrets", "filesystem", "auth", "prompting", "reentrancy", "access-control"],
    "methods": ["manual-review", "tests-run", "static-analysis"],
    "notes": "Short plain-language summary of what was checked and what was not.",
    "limitations": "Explicitly list anything not reviewed."
  },
  "signer": {
    "name": "optional display name",
    "pubkey": "ed25519:...",
    "contact": "optional"
  },
  "timestamp": "2026-01-31T00:00:00Z",
  "signature": "base64(signature_over_canonical_json)"
}
```

---

## 2) Scope tags (recommended)

Use tags so attestations can be compared:
- `egress` (outbound network)
- `secrets` (secret access paths)
- `filesystem` (read/write surfaces)
- `auth` (credential handling)
- `prompting` (prompt injection / data exfil via model)
- `access-control`
- `reentrancy`
- `economics`

---

## 3) Where to publish attestations

Two pragmatic paths:
- **Off-chain signed JSON feed** (fast, cheap, easy to adopt)
- **On-chain anchoring** (publish the hash for immutability)

Vaultfire preference: start off-chain, optionally anchor hashes for dispute resolution.

---

## 4) Mission lock

Attestations must not become a panopticon:
- no PII required
- no KYC
- no behavioral tracking

Proof should establish *capability constraints*, not identity control.
