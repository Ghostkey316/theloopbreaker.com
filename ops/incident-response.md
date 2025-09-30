# Vaultfire Incident Response Playbook

## Roles
- **Incident Commander (IC)** — Coordinates response, maintains timeline, approves recovery steps.
- **Comms Lead** — Handles partner/internal updates, ensures regulatory notifications when required.
- **Responder** — Applies fixes, gathers forensic data, triages impacted services.
- **Liaison** — Interfaces with partner security teams, escalates blockers to leadership.

## Triggers
- 🚨 Critical alerts from SecurityPostureManager (invalid handshakes, repeated signature failures)
- 🚨 Unusual load detected in `ops/load-test-results.md` when compared against baseline
- 🚨 Unauthorized access attempts flagged by telemetry sinks or SIEM integrations

## Response Flow
1. **Triage**
   - Acknowledge alert within 5 minutes.
   - Assign IC, Responder, and Comms Lead in incident channel.
   - Capture current hashes of `vaultfire_security.json` and relevant configs.
2. **Containment**
   - Rotate `VAULTFIRE_ACCESS_SECRET` and response signing secrets if compromise suspected.
   - Disable partner API keys linked to suspicious sessions.
   - Route traffic to read-only failover if handshake verifier is degraded.
3. **Eradication & Recovery**
   - Patch vulnerabilities, redeploy via `ops/deploy-prod.sh`.
   - Execute database integrity checks and replay queued webhooks.
   - Monitor handshake and rotation admin endpoints for normalization.
4. **Post-Incident**
   - Publish timeline + remediation summary to internal drive.
   - Update `HARDENING_FIXES.md` checklist if new items identified.
   - Schedule follow-up load and security posture tests.

## Rollback Steps
- Restore previous container tag using `docker run -d $REGISTRY_URL/$APP_NAME:<last-known-good>`.
- Re-apply prior `vaultfire_security.json` snapshot.
- Revoke temporary credentials and delete ad-hoc debugging resources.
