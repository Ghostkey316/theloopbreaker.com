# Vaultfire Partner Integration SLA

This Service Level Agreement (SLA) outlines Vaultfire’s commitments for partner integrations and the responsibilities required to maintain a resilient, ethics-first collaboration.

## Scope

This SLA applies to all production integrations leveraging Vaultfire’s activation, rewards, and belief mirroring services. Sandbox environments are excluded from uptime calculations but follow the same escalation pathways.

## Availability Commitments

- **Uptime Guarantee:** 99.9% monthly availability across core partner endpoints (`/vaultfire/activate`, `/vaultfire/rewards`, `/vaultfire/mirror`).
- **Maintenance Windows:** Scheduled maintenance announced 72 hours in advance via the partner portal and status page.
- **Credits:** If uptime falls below 99.9%, partners receive service credits proportional to downtime on their next billing cycle.

## Performance Targets

- **Response Time Goal:** Median latency under 300 ms for activation and rewards endpoints during standard load.
- **Degradation Handling:** If latency exceeds targets for more than 10 minutes, Vaultfire will broadcast mitigation steps and interim guidance.
- **Partner Responsibilities:** Partners should implement exponential backoff and respect published rate limits to maintain fair resource distribution.

## Incident Response & Escalation

1. **Detection:** Automated monitoring triggers incident response when SLA thresholds degrade.
2. **Initial Notification:** Partners receive alerts via email, webhook, and the status page within 15 minutes of detection.
3. **Severity Classification:**
   - *Sev-1:* Full outage or data integrity breach.
   - *Sev-2:* Partial outage, degraded performance, or alignment warnings.
   - *Sev-3:* Minor disruptions without customer impact.
4. **Response Times:**
   - Sev-1: Dedicated responder within 15 minutes, hourly updates until resolution.
   - Sev-2: Response within 1 hour, updates every 2 hours.
   - Sev-3: Response within 4 hours, daily updates.
5. **Escalation Path:** Partner escalation can be triggered via the partner portal, paging on-call leads, or contacting `partners@vaultfire.network`. Executive bridges available on request for Sev-1 incidents.

## Ethics Fallback Clause

Vaultfire prioritizes alignment with the ethics-first framework. If a partner integration violates belief integrity, user consent parameters, or the Moral Memory Fork Agreement:

- Vaultfire reserves the right to suspend or throttle the integration immediately.
- A remediation plan will be jointly developed, requiring evidence of restored ethical alignment before reactivation.
- During suspension, data access is limited to retrieval of remediation evidence only.

## Support Coverage

- **Standard Support:** 24/5 coverage (Monday–Friday) with 4-hour initial response for non-urgent tickets.
- **Critical Support:** 24/7 coverage for Sev-1 and Sev-2 incidents through the partner portal paging workflow.
- **Channels:**
  - Partner portal ticketing system.
  - Dedicated Slack or Matrix bridge for aligned partners.
  - Email: `partners@vaultfire.network`.
- **Knowledge Updates:** Release notes and migration advisories published bi-weekly.

## Versioning & Change Management

- Vaultfire adheres to semantic versioning for API and schema updates.
- Backwards-incompatible changes require 60-day advance notice and parallel version support.
- Partners must validate integrations in staging within 30 days of a release candidate announcement.
- Sunset timelines are published on the status page and partner roadmap hub.

## Review & Amendments

This SLA is reviewed quarterly. Updates will be communicated via the partner portal and require written acknowledgement from partners to ensure continued alignment.
