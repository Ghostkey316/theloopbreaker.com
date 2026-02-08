# Vaultfire: On-chain String Policy (Privacy Hardening)

This document clarifies how Vaultfire treats **on-chain strings**.

## Why this exists
Public blockchains are immutable. Any freeform text stored on-chain can become a privacy leak.

Vaultfire is **privacy-first**, but privacy is only real when the *data model* makes leakage hard.

## Policy (recommended)

### 1) Prefer hashes + URIs
- On-chain: store **hashes** (`bytes32`) and/or **URIs** (pointing to off-chain documents).
- Off-chain: store the human-readable text, with redaction + retention policy.

### 2) Never store PII in on-chain strings
If a contract has a `string` field, it MUST be treated as:
- a non-PII descriptor (short, generic), OR
- a URI to a document that can be redacted off-chain

### 3) Provide hashed alternatives
Where a module needs human notes, relationship labels, or evidence:
- add `...Hashed` functions/structs/events that store `keccak256(text)` only

### 4) Truthfulness requirement
When docs say “privacy guarantees,” they must include:
- on-chain history is immutable
- deployments can leak data if misconfigured

## Current status
- `AIPartnershipBondsV2` now includes `submitPartnershipMetricsHashed` and `submitHumanVerificationHashed`.
- Legacy string-based functions remain for backward compatibility, but partners should use hashed variants.
