# Partner Deployment Guide

This guide outlines how partners can deploy Vaultfire modules.

## Installation
1. Clone the repository.
2. Install Python dependencies with `pip install -r requirements.txt`.
3. Install Node dependencies with `npm install`.
4. Run `git config core.hooksPath .githooks` to enable hooks.

## Integration Points
- Onboarding API at `onboarding_api.py`.
- Companion API from `final_modules/companion_api.py`.
- Fitness and Music layers under `docs/fitness_layer.md` and `docs/music_layer.md`.
- Plugin framework via `partner_plugins/`.

## Environment Presets
Create `.env.staging` and `.env.production` files to avoid leaking secrets. Recommended keys:

```bash
VAULTFIRE_STORAGE_PROVIDER=postgres
VAULTFIRE_DATABASE_URL=postgres://user:pass@db:5432/vaultfire
VAULTFIRE_ALLOWED_ORIGINS=https://partners.staging.example.com
VAULTFIRE_ALLOWED_DOMAINS=partners.staging.example.com
VAULTFIRE_SANDBOX_MODE=sandbox # set to production when audited
VAULTFIRE_ALLOW_LEGACY_HANDSHAKE=false # enforce secret-based signatures in production
VAULTFIRE_VERIFICATION_SECRETS=[{"id":"2024-q3","value":"vaultfire-rotation-q3"}]
SUPABASE_URL=https://xyzcompany.supabase.co
SUPABASE_SERVICE_ROLE_KEY=env://supabase-service-role
```

Use `npm run dashboard:build` and `npm run start:api` against the selected `.env` file via `dotenv -e .env.staging -- npm run start:api`.

**Production tip:** keep `VAULTFIRE_ALLOW_LEGACY_HANDSHAKE=false` so only current or grace-period secrets are honoured. Enable the toggle temporarily for regression testing only.

## Scaling Pathways
- **Managed Postgres**: Set `VAULTFIRE_STORAGE_PROVIDER=postgres` to enable pooling via `pg.Pool`. Deploy read replicas per region.
- **Supabase**: Configure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for serverless PostgREST access. Enable row-level security policies to restrict partner data.
- **Horizontal API Scaling**: The Express API is stateless; front it with a load balancer and share JWT secrets via secret manager.
- **Multi-Region**: Run partnerSync instances near traffic, pointing each to a regional database replica. Telemetry exports remain append-only, so S3-style replication is sufficient for logs.

## Monitoring
- Subscribe to the `/vaultfire/observability` endpoint or websocket channel for real-time override and validator alerts.
- Export weekly audit trails via `/telemetry/audit/export?format=csv` and archive them in your compliance vault.

## Example Use Case
A sports brand installs Vaultfire and uses the Fitness Layer to
reward weekly workouts while the Companion API provides motivational
messages. Onboarding connects user wallets and the plugin framework
tracks campaign rewards.
