# Vaultlink AI Companion

Vaultlink provides a modular AI companion that evolves with each user. The engine activates only after the user has been onboarded to Vaultfire and stores progress in encrypted memory slots. The "Ascension Mode" upgrade introduces persistent identity traits and deeper memory history.

## Features
- **Behavioral growth** – a time weighted algorithm increases XP based on interaction frequency, milestones and sentiment.
- **Mythic identity** – each companion is seeded with a soulprint influencing voice style and moral compass.
- **Encrypted memory** – personal memories are stored using the AES-GCM encryption from `health_sync_engine` with a long-term history log and file-locking safeguards.
- **Emotion tracking** – interactions feed into the `reflection_layer` to adapt responses by tone.
- **Synced evolution tree** – new levels unlock coaching and philosophical domains.
- **Legacy transfer** – states can be cloned for a different user.
- **Plugin ready** – the engine exposes simple hooks for partner frontends.
- **Ethical Growth Engine** – moral alignment and belief scores gate all intelligence upgrades.
- **Moral Mirror System** – each session is logged for user review before growth is applied.

## API
- `onboard_companion(user_id, key)` – initialize state for a user.
- `record_interaction(user_id, text, domain, behavior, milestone, key)` – store an interaction and update level.
- `fetch_state(user_id, key)` – return decrypted state including memory slots.
- `transfer_companion_state(from_user, to_user, from_key, to_key)` – clone state for legacy handoff.

### Ethical Growth Engine
Vaultlink will only ascend to higher levels when the user's alignment score and
belief level satisfy the Ghostkey Ethics Framework. Learning multipliers are
weighted by loyalty and trust metrics while harmful behavior stalls progress.
All session text is stored in a moral mirror log for human feedback. Advanced
logic tiers require an override file signed by the founding architects.

**Disclaimer**
- Vaultlink now uses AES-GCM with authenticated metadata but sensitive data should still be stored with user consent and appropriate key management.
- Vaultlink Ascension Mode is stable and may produce unexpected results.
