<!--
NON-NORMATIVE DOCUMENT

This file is historical/legacy/audit material and may contain aspirational language.
The canonical, current claims & limits are in: docs/CLAIMS_AND_LIMITS.md
-->

# Ghostkey Growth Protocol

The Growth Protocol sets expectations for sustainable expansion.

## Tenets
- **Loyalty over Hype** – reward consistent contributors before viral waves.
- **Measured Progress** – weekly drops adapt based on belief and loyalty data.
- **Open Participation** – partner onboarding via `partner_auto_onboard.py` remains opt-in.
- **Ethics Anchored** – growth never overrides the Ethics Framework v2.0.

Use the provided SDK endpoints to sync loyalty scores and integrate multiplier toggles within your applications.

### `calculateMultiplier()`

Vaultfire partners can call `calculateMultiplier(addressOrTelemetryId)` to obtain
the latest loyalty multiplier. The engine cross-references belief sync
telemetry IDs with registered wallets, applies the gas-efficient behaviour tier
mapping, and multiplies the result by the current on-chain multiplier from the
`GhostkeyLoyaltyLock` contract. The response includes the resolved address,
tier label, tier multiplier, on-chain multiplier, and ISO timestamp for the
last behavioural update so reward systems can audit every step in the chain.
