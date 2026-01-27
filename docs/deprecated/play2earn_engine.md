# Vaultfire Play2Earn Engine

The Play2Earn module links external game accounts with Vaultfire and rewards contributors for verified play sessions.

## Key Features

- **Account linking** – Players can connect Steam, Xbox, PlayStation, mobile and Web3 game handles using `connect_game_account`.
- **Session tracking** – `record_session` securely logs play time, achievements, team members and game type.
- **Dynamic rewards** – Session logs convert to Vault Points and automatic token drops. Loyalty multipliers boost payouts and NFTs are minted at major milestones.
- **Belief missions** – Games can submit belief-aligned text via `belief_mission` to issue additional loyalty rewards.
- **Leaderboards** – `leaderboard` returns top players based on gaming points. Squad totals are also supported through existing squad APIs.
- **Developer SDK** – `VaultfireGameSDK` exposes helper methods like `connect_account`, `record_play` and `leaderboard` for easy integration.

The engine integrates with existing identity, token and AI layers without altering the current architecture.

