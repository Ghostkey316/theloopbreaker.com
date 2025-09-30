# Vaultfire Runtime Requirements

## Node.js
- Recommended: **Node.js 18.18.0 LTS** or newer
- Minimum: Node.js 16 with OpenSSL 1.1.1+, though certain cryptographic features may degrade

## Storage / Database Adapters
- **SQLite** (default) — requires optional `sqlite3` peer dependency when persistent storage is enabled
- **Postgres** — enable with `storageOptions.adapter = 'postgres'`; requires `pg` peer dependency
- **Supabase** — enable with `storageOptions.adapter = 'supabase'`; requires `@supabase/supabase-js` peer dependency
- **Browser LocalForage** — requires `localforage` peer dependency for offline/front-end extensions

## Environment Compatibility
- Server-side: Linux x86_64 or ARM64 with Docker 23+ recommended
- Desktop partners: Chrome/Edge/Safari latest releases for dashboard interactions
- Mobile partners: Progressive web app tested on iOS Safari and Android Chrome

## Security Controls
- `VAULTFIRE_ACCESS_SECRET` — JWT signing secret for access tokens
- `VAULTFIRE_RESPONSE_SIGNING_SECRET` — HMAC key for response signing (fallbacks to handshake rotation secret)
- `VAULTFIRE_HANDSHAKE_API_KEY(S)` — comma-delimited list of API keys for handshake discovery

## Verification Checklist
- Run `node tools/preflight-check.js` before deploying to ensure required peer dependencies and runtime assumptions are met
- Ensure TLS termination with mutual verification when exposing `/vaultfire/handshake` and `/vaultfire/admin/rotation-status`
