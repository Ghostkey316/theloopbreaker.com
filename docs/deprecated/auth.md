<!--
NON-NORMATIVE DOCUMENT

This file is historical/legacy/audit material and may contain aspirational language.
The canonical, current claims & limits are in: docs/CLAIMS_AND_LIMITS.md
-->

# Vaultfire Authentication Paths

Vaultfire partners default to wallet-based authentication. When a partner cannot complete a wallet challenge, a fallback path
can be enabled per partner through `partner-auth-config.json`.

## Supported Strategies
- `wallet` — ENS or CB.ID identifiers resolved through `wallet_auth.ts`.
- `email_otp` — Verified by `auth/altIdentity.ts` when a valid email address and one-time passcode are supplied. Sessions last 10
  minutes and do not grant on-chain authority.
- `oauth_google` — Accepts Google OAuth 2.0 ID tokens. Verification is handled via metadata checks and results in a sandboxed
  session scoped to the requesting partner.
- `oauth_github` — Accepts GitHub OAuth 2.0 access tokens. The session inherits repository read scopes only.

## Partner Configuration
Define each partner’s preferred strategy in `partner-auth-config.json`:

```json
{
  "partner_xyz": "wallet",
  "partner_beta": "email_otp",
  "partner_creators": "oauth_google"
}
```

Partners omitted from the mapping automatically fall back to `wallet`.

## Operational Notes
- Wallet checks always execute first. Fallback logic only runs when the wallet check throws and the partner has opted in to an
  alternative strategy.
- Fallback sessions are stored in an isolated in-memory layer so they can be revoked without touching wallet-based authority.
- On-chain actions continue to require a verified wallet signature even when a fallback session is active.
