# Vaultfire Gaming Layer

The gaming layer provides reusable helpers so developers can launch multiplayer games that plug into the Vaultfire reward system.

## Features

- **Game sessions** – create, join and end multiplayer rounds using `engine.gaming_layer`.
- **Reward hooks** – finished sessions can trigger token rewards via Vaultfire partner hooks.
- **Avatar sync** – players can store an avatar URL which games may display.
- **Mirrored avatars** – contract events adjust stats, traits and questline.
- **On-chain inventory** – record blockchain items per player and fetch them later.
- **ENS overlays** – map a player ID to an ENS name for consistent identity display.
- **Replay records** – log player decisions and actions, hash them on-chain and
  tie the replay to their identity for future verification and awards.

The `vaultfire_gaming` package exposes a small SDK with a `VaultfireGameSDK` class for easy integration.

### Arcade Launcher

The `vaultfire_arcade` package builds on these helpers with an `ArcadeLauncher`
class. Registered minigames and puzzle modules can be launched from a simple
interface and will automatically log learning outcomes, achievements and loyalty
boosts back to the user's on-chain profile.

#### Guest Mode

`ArcadeLauncher` now accepts an optional `user_id`. When omitted, a guest
identifier is generated so visitors can play without connecting a wallet. All
game outcomes are cached locally under this guest ID. Once the player confirms
their identity through ENS or a partner protocol, calling
`overlay_ens(guest_id, "name.eth")` merges the cached progress into the final
profile.

### Modding Layer

The `vaultfire_modding` package lets community members design new game modules
based on selected belief systems. Modules register a belief theme and an array of
quest identifiers. A simple visual editor is provided under `frontend/pages/modding_editor.html`.
Created modules can be upvoted, and each upvote grants a small loyalty boost to
the voter via `engine.modding_layer.upvote_module`.
