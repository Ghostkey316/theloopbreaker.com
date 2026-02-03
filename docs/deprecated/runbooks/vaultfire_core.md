<!--
NON-NORMATIVE DOCUMENT

This file is historical/legacy/audit material and may contain aspirational language.
The canonical, current claims & limits are in: docs/CLAIMS_AND_LIMITS.md
-->

# Vaultfire Core Runbook

## Setup Checklist
- Confirm `ghostkey_manifesto.md` is present before activating core services.
- Populate `WALLET_WHITELIST` in the environment or `.env` for multi-wallet governance alignment.
- Review `docs/multi-wallet-mode.md` to ensure operations understand wallet override behaviour.
- Execute `node scripts/run-test-suite.js` to validate activation, injection, and ASM sync pathways.

## Integration Risk Factors
- Missing manifest files block activation entirely, halting downstream onboarding flows.
- Unauthorised wallets invoking `injectVaultfire` will now be rejected to protect multi-party governance.
- Stale `.env` wallet lists can desynchronise CLI expectations and multi-sig validations.

## Recovery Steps
- Restore the manifesto from source control and rerun activation to re-seal ethics guarantees.
- Update `WALLET_WHITELIST` and restart affected services to propagate new authorised wallets.
- Use `syncToASM` in test mode with authorised wallets to confirm alignment before re-opening operations.
