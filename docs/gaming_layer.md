# Vaultfire Gaming Layer

The gaming layer provides reusable helpers so developers can launch multiplayer games that plug into the Vaultfire reward system.

## Features

- **Game sessions** – create, join and end multiplayer rounds using `engine.gaming_layer`.
- **Reward hooks** – finished sessions can trigger token rewards via Vaultfire partner hooks.
- **Avatar sync** – players can store an avatar URL which games may display.
- **On-chain inventory** – record blockchain items per player and fetch them later.
- **ENS overlays** – map a player ID to an ENS name for consistent identity display.

The `vaultfire_gaming` package exposes a small SDK with a `VaultfireGameSDK` class for easy integration.
