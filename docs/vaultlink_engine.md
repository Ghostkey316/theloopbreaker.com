# Vaultlink AI Companion

Vaultlink provides a modular AI companion that evolves with each user. The engine activates only after the user has been onboarded to Vaultfire and stores progress in encrypted memory slots. The "Ascension Mode" upgrade introduces persistent identity traits and deeper memory history.

## Features
- **Behavioral growth** – a time weighted algorithm increases XP based on interaction frequency, milestones and sentiment.
- **Mythic identity** – each companion is seeded with a soulprint influencing voice style and moral compass.
- **Encrypted memory** – personal memories are stored using the lightweight XOR encryption from `health_sync_engine` with a long-term history log.
- **Emotion tracking** – interactions feed into the `reflection_layer` to adapt responses by tone.
- **Synced evolution tree** – new levels unlock coaching and philosophical domains.
- **Legacy transfer** – states can be cloned for a different user.
- **Plugin ready** – the engine exposes simple hooks for partner frontends.

## API
- `onboard_companion(user_id, key)` – initialize state for a user.
- `record_interaction(user_id, text, domain, behavior, milestone, key)` – store an interaction and update level.
- `fetch_state(user_id, key)` – return decrypted state including memory slots.
- `transfer_companion_state(from_user, to_user, from_key, to_key)` – clone state for legacy handoff.

**Disclaimer**
- Vaultlink uses basic XOR encryption and should not store highly sensitive data.
- Vaultlink Ascension Mode is experimental and may produce unexpected results.
