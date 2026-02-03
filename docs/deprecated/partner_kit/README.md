<!--
NON-NORMATIVE DOCUMENT

This file is historical/legacy/audit material and may contain aspirational language.
The canonical, current claims & limits are in: docs/CLAIMS_AND_LIMITS.md
-->

# Vaultfire Partner Kit

This kit bundles audit evidence, governance documentation, ROI calculators, and case studies for enterprise procurement teams.

> **Case Study Notice:** Only the Ghostkey-316 wallet pilot has run live so far. All other case studies and deployment metrics in this kit are sandbox simulations derived from Ghostkey-316 telemetry until new validators are verified in production.

## Contents
1. **Attestation Packet**
   - Request templates: `docs/attestations/attestation_requests.md`
   - Signed evidence: `docs/attestations/signed/` (populate with latest PDFs + JSON hashes)
   - Badge: ![Telemetry Verified](../badges/telemetry-verified.svg)
2. **Governance Overview**
   - Summary: `governance.md`
   - DAO continuity: `governance/dao_pathway.md`
   - Multisig template: `governance/multisig_template.yaml`
   - Badge: ![Governance Ready](../badges/governance-ready.svg)
3. **Metrics & ROI**
   - Dashboard data: `dashboards/adoption_mission_dashboard.json`
   - ROI model: `docs/loyalty_engine_roi_model.md`
   - Calculator: `docs/partner_kit/roi_calculator.json`
   - Badge: ![ROI Proven](../badges/roi-proven.svg)
4. **Case Studies**
   - Portfolio: `docs/vaultfire_pilot_bundle/case_studies.md`
   - PDF exports: `docs/vaultfire_pilot_bundle/case_study_one_pagers/`

## Usage Instructions
- Duplicate this folder for each partner engagement and append partner name to maintain audit trail.
- Update `roi_calculator.json` with partner-specific inputs; share via secure portal.
- Embed badges in presentation decks (`/frontend/pages/attestations.html`, `/frontend/pages/metrics.html`).
- Publish summary to Notion using Markdown blocks for portability.

## PDF Export
```
pandoc docs/partner_kit/README.md -o docs/partner_kit/partner_kit_overview.pdf
```

## Contact
- trust@vaultfire.network
- governance@vaultfire.network
- partners@vaultfire.network
