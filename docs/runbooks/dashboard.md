# Dashboard Runbook

## Setup Checklist
- Install front-end dependencies (`npm install`) and start Vite with `npm run dashboard:dev` for local validation.
- Populate `.env` or environment variables with `VITE_VAULTFIRE_API` pointing to the Partner Sync API base URL.
- Confirm Socket.IO ports (default 4050) are accessible through any local firewalls or proxies.
- Run `npm test` or `node scripts/run-test-suite.js` to validate service integrations before onboarding partners.

## Integration Risk Factors
- Mismatched API base URLs or missing TLS certificates can prevent status cards from loading.
- Excess metadata responses from `/status` may exceed viewport budgets and degrade rendering if clamping is disabled.
- Browser wallet connections require HTTPS contexts; insecure origins will block credential sharing.

## Recovery Steps
- Rebuild the dashboard (`npm run dashboard:build`) after updating environment variables to ensure values are embedded.
- Clear cached Socket.IO connections via browser dev tools when troubleshooting stale realtime subscriptions.
- Enable dashboard safe mode by setting `VITE_VAULTFIRE_API` to a staging endpoint while investigating production outages.
