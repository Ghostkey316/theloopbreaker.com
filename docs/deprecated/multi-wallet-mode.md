<!--
NON-NORMATIVE DOCUMENT

This file is historical/legacy/audit material and may contain aspirational language.
The canonical, current claims & limits are in: docs/CLAIMS_AND_LIMITS.md
-->

# Multi-Wallet Mode

Vaultfire Core now supports multi-party wallet alignment so consortium operators can coordinate without sacrificing the legacy single-wallet defaults. This guide covers configuration, behaviour, and governance expectations.

## Configuring Wallet Lists
- **Environment variable:** set `WALLET_WHITELIST=wallet1,wallet2,...` before launching Vaultfire services.
- **.env file:** add `WALLET_WHITELIST=wallet1,wallet2,...` to the root `.env` file when environment exports are not available.
- Wallet entries are treated case-insensitively and automatically include the legacy `bpow20.cb.id` value unless explicitly removed.

## Single vs Multi-Entity Operations
- Without overrides, Vaultfire remains in single-wallet mode and authorises only `bpow20.cb.id`.
- When multiple wallets are configured, `activateCore()` reports the active whitelist and downstream modules must include an authorised wallet when invoking protected flows.
- The CLI, dashboard, and governance modules consume the same whitelist to maintain deterministic onboarding experiences.

## Governance Behaviour
- `injectVaultfire` and `syncToASM` now validate the caller wallet against the whitelist before executing.
- Telemetry and audit logs include the wallet whitelist to help stewards trace multi-actor decisions.
- Governance stewards should communicate whitelist changes through standard approval workflows to maintain lineage tracking.

## Backward Compatibility
- Single-wallet mode remains the default, ensuring existing partners do not need to change configuration.
- Run `node scripts/run-test-suite.js` after updating wallet lists to confirm module coverage remains above operational thresholds.
