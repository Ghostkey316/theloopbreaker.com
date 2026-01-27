# Change Management Playbook

## Versioning Policy
Vaultfire follows **Semantic Versioning (SemVer)** across all partner-facing packages. MAJOR updates indicate breaking API shifts, MINOR releases deliver backward-compatible features, and PATCH versions capture bug fixes or documentation clarifications.

## Breaking Change Example & Backward Compatibility Strategy
- **Scenario:** Deprecating the legacy belief sync webhook in favor of signed gRPC streams.
- **Strategy:**
  - Introduce the gRPC stream alongside the existing webhook in a MINOR release.
  - Mark the webhook as deprecated with telemetry-backed usage tracking.
  - Provide an adapter in `partner_modules/` to bridge webhook payloads into the new stream until partners migrate.
  - Remove the webhook in the next MAJOR release only after confirming partner readiness and delivering migration toolkits.

## Long-Term Support (LTS) Branching
- Tag each partner-facing module with an `lts/<major-version>` branch that receives security and hotfix backports for 12 months following a MAJOR release.
- Maintain compatibility tests that run nightly against all active LTS branches to confirm upgrades do not regress partner commitments.

## Partner Communication Flow
- Publish every breaking change notice in the `#change-log` Discord channel **and** via the partner mailing list.
- Deliver communication at least **7 days before** rollout, including migration guides, contact points, and rollback procedures.
- Provide real-time status updates during the rollout window and confirm completion with post-change validation results.
