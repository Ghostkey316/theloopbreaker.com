# ERC-8128 Client Notes (Vaultfire)

Vaultfire accepts **Request-Bound + Non-Replayable** ERC-8128 signatures.

Minimum covered components:
- `@authority`
- `@method`
- `@path`
- `@query` (if present)
- `content-digest` (if body present)

Required signature params:
- `keyid="erc8128:<chain-id>:<address>"`
- `created`
- `expires`
- `nonce`

Vaultfire currently enforces a tight max validity window (60s) and a small clock skew tolerance (60s).

Note: Vaultfire requires `content-digest` to match a **sha-256** digest computed over the raw HTTP body bytes.
