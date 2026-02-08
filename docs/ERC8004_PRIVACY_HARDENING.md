# ERC-8004 Privacy Hardening Notes (Vaultfire)

Vaultfire implements ERC-8004-style registries for agent identity, reputation, and validation.

Because public chains are immutable, **freeform strings are a privacy footgun**. This repo keeps legacy
string-based functions for compatibility, but provides privacy-hardened alternatives.

## Reputation
- `ERC8004ReputationRegistry.submitFeedback(...)` (legacy) stores `category` + `feedbackURI` as strings.
- `ERC8004ReputationRegistry.submitFeedbackHashed(...)` (preferred) stores:
  - `categoryHash = keccak256(category)`
  - `feedbackURIHash = keccak256(feedbackURI)`

## Validation
- `ERC8004ValidationRegistry.submitValidation(...)` stores proof bytes but does **not** enforce on-chain verification.
- `ERC8004ValidationRegistry.submitValidationZK(...)` (preferred) enforces verification via `zkVerifier.verifyProof(...)`.

## Policy
See `docs/PRIVACY_STRING_POLICY.md`.
