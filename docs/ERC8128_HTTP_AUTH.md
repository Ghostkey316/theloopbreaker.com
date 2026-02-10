# ERC-8128 HTTP Authentication (Vaultfire)

Vaultfire integrates **ERC-8128: Signed HTTP Requests with Ethereum** as an *optional* authentication method for HTTP APIs.

## Status

- **Mode:** opt-in / additive (runs side-by-side with existing Bearer JWT auth)
- **Acceptance policy (v1):** **Request-Bound + Non-Replayable ONLY**
- **Supported chains (v1):**
  - Ethereum mainnet (1)
  - Base mainnet (8453)
  - Sepolia (11155111)
  - Base Sepolia (84532)

## Why

ERC-8128 allows Vaultfire partners/agents/services to authenticate **each request** using an Ethereum identity, without server-issued bearer secrets.

This aligns with:
- wallet-only identity (no KYC)
- verification over surveillance
- agent-to-agent and service-to-service interoperability

## Required headers

Clients MUST attach RFC 9421 headers:
- `Signature-Input`
- `Signature`

Vaultfire will look for a signature label (recommended: `eth`).

## Vaultfire acceptance rules (v1)

A request is accepted only if the signature is:

### 1) Request-Bound
The signature MUST cover:
- `@authority`
- `@method`
- `@path`
- `@query` **if the request has a query string**
- `content-digest` **if the request has a body**

### 2) Non-Replayable
The signature MUST include:
- `nonce`

Vaultfire enforces uniqueness of `(keyid, nonce)` for the full accepted validity window.

### 3) Required parameters
Vaultfire requires:
- `keyid` of the form `erc8128:<chain-id>:<address>`
- `created` (unix seconds)
- `expires` (unix seconds, > created)

### 4) Time policy
Vaultfire enforces:
- clock skew tolerance: **±60 seconds**
- maximum validity window: **60 seconds**

(These values are configurable; keep them tight in production.)

### 5) Ethereum signature verification
- EOAs: verified using ERC-191 semantics (personal_sign / signMessage over the RFC 9421 signature base).
- SCAs: verified using ERC-1271 on the chain specified by `keyid`.

## Replay protection storage

Nonce enforcement MUST be atomic.

Vaultfire supports:
- In-memory store (development only)
- Redis store (recommended for production)

## Logging policy

Do not log the raw `Signature` header or full `Signature-Input` values in production logs.
They can become replay artifacts in systems that accept replayable modes.

## Migration

Vaultfire will run JWT and ERC-8128 side-by-side. Endpoints can be configured to accept:
- JWT only
- ERC-8128 only
- either JWT or ERC-8128 (recommended during transition)

## References
- ERC-8128 draft: https://eip.tools/eip/8128
- RFC 9421: https://www.rfc-editor.org/rfc/rfc9421
