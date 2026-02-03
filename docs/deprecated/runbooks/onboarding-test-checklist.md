<!--
NON-NORMATIVE DOCUMENT

This file is historical/legacy/audit material and may contain aspirational language.
The canonical, current claims & limits are in: docs/CLAIMS_AND_LIMITS.md
-->

# Onboarding Test Checklist

Use this checklist to validate Vaultfire operations before onboarding new partners.

1. **Install dependencies:** `npm install`
2. **Run module coverage suite:** `node scripts/run-test-suite.js`
3. **Review module runbooks:**
   - [CLI](./cli.md)
   - [Dashboard](./dashboard.md)
   - [Governance](./governance.md)
   - [Telemetry](./telemetry.md)
   - [Belief Engine](./belief-engine.md)
   - [Vaultfire Core](./vaultfire_core.md)
4. **Validate multi-wallet mode:** confirm `WALLET_WHITELIST` reflects authorised wallets per [multi-wallet guide](../multi-wallet-mode.md).
5. **Capture artefacts:** archive coverage reports (`coverage/`) and latest `logs/test-report.json` for the operational record.
