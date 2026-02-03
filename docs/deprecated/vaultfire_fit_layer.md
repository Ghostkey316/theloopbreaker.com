<!--
NON-NORMATIVE DOCUMENT

This file is historical/legacy/audit material and may contain aspirational language.
The canonical, current claims & limits are in: docs/CLAIMS_AND_LIMITS.md
-->

# Vaultfire FIT Layer

The FIT layer connects biometric workout tracking with Vaultfire's reward and purpose engines.

## AI Coach logic
- `record_workout()` stores routine metrics and mirrors progress back to the Purpose Engine.
- `coach_feedback()` returns short suggestions based on recent activity.

## Fitness Milestone Minter
When a routine reaches 5, 10 or 25 logged sessions, a progress NFT is automatically minted using `inventory_storage.add_item()`.

## Fit-for-reward
If a workout entry is marked as verified the user receives one VAULT token via `token_ops.send_token()`.

## VaultWear stub
`sync_wearable()` is reserved for future wearable device integration.

