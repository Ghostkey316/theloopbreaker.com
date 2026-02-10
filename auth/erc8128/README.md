# ERC-8128 (Signed HTTP Requests with Ethereum)

This folder contains Vaultfire's server-side verifier + Express middleware for **ERC-8128**.

Policy (Vaultfire v1):
- Accept **Request-Bound + Non-Replayable** signatures only.
- Require `keyid`, `created`, `expires`, `nonce`.
- Require covered components: `@authority`, `@method`, `@path`, plus `@query` if present, plus `content-digest` if body present.
- Verify EOAs via ERC-191 (`personal_sign` / `signMessage`).
- Verify SCAs via ERC-1271 on the chain specified by `keyid`.

See `docs/ERC8128_HTTP_AUTH.md` for the full acceptance rules.
