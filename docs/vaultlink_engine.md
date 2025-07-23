# Vaultlink AI Companion

Vaultlink provides a modular AI companion that evolves with each user. The engine activates only after the user has been onboarded to Vaultfire and stores progress in encrypted memory slots.

## Features
- **Behavioral growth** – a time weighted algorithm increases XP based on interaction frequency, milestones and sentiment.
- **Unique identity** – each companion is seeded with a random value so no two evolve the same way.
- **Encrypted memory** – personal memories are stored using the lightweight XOR encryption from `health_sync_engine`.
- **Emotion tracking** – interactions feed into the `reflection_layer` to adapt responses by tone.
- **Cross-domain support** – companions can track topics like crypto, fitness and entertainment.
- **Plugin ready** – the engine exposes simple hooks for partner frontends.

## API
- `onboard_companion(user_id, key)` – initialize state for a user.
- `record_interaction(user_id, text, domain, behavior, milestone, key)` – store an interaction and update level.
- `fetch_state(user_id, key)` – return decrypted state including memory slots.

**Disclaimer**
- Vaultlink uses basic XOR encryption and should not store highly sensitive data.
