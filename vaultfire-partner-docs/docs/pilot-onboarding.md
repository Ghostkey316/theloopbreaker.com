# Pilot Mode Onboarding Guide

Welcome to Vaultfire pilot mode. This playbook ensures new partners can deploy
securely with hardened delivery pipelines and aligned governance.

## Step 1 – Technical Readiness
1. **Confirm signed callbacks**: register your webhook URL and signing secret.
   Vaultfire verifies every delivery using HMAC headers and exposes replay-safe
   timestamps.
2. **Queue observer**: monitor the delivery queue endpoint or configure the
   automation triggers from `governance/automation_triggers.py` to raise alerts
   if backlog exceeds 60 seconds.
3. **Telemetry sink selection**: choose a storage target (local JSON, S3, or
   Firehose) and configure it through `services/telemetryLedger` sinks so your
   compliance archive is continuously mirrored.

## Step 2 – Governance Alignment
1. Review the [Public Ethics Guardrails](../../ethics/public_guardrails.md) and
   publish them within your internal wiki.
2. Map your own policies to the [Governance Decision Mapping](../../governance/compliance-mapping.md)
   table so compliance teams can trace every change request.
3. Set up escalation contacts for delivery resilience, scaling pathways, and
   security controls. These map directly to telemetry recommendations in the
   scaling playbook.

## Step 3 – Pilot Launch Checklist
- **Webhook delivery**: Run end-to-end tests confirming retries, signed
  callbacks, and queue processing succeed.
- **Scaling rehearsal**: Execute the scaling playbook against your current
  metrics to identify "watch" or "at-risk" indicators.
- **Governance automation**: Schedule a dry run of the automation triggers and
  verify alerts flow to the steward roster and compliance inboxes.

Once the above steps are complete, coordinate with the Vaultfire team to enable
production mode access. The onboarding checklist doubles as your partner
readiness evidence for HIPAA, SOC 2, and GDPR reviews.
