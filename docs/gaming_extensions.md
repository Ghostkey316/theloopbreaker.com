# Gaming Extensions

These optional modules enhance the core gaming layer with livestream and AR features.

## Features
- **Twitch integration** – Link handles using `engine.twitch_layer.connect_twitch_account`. Streams recorded via `start_stream` allow belief challenges and tipping in Vault Points or tokens.
- **AR belief missions** – `engine.ar_missions` registers real-world markers and rewards users who scan them with the mobile camera.
- **Wager battles** – `engine.wager_engine` lets players create 1v1 or squad wagers. Winners earn Vault Points or tokens and badges.

## Disclaimers
- Use at your own risk; uptime or results are not guaranteed.
- Ambient data is logged only with opt-in consent.
- Nothing here constitutes legal, medical, or financial advice.
- Twitch detection is simulated with local JSON logs and does not connect to the official API.
- AR scanning uses placeholder markers with no security guarantees.

## Ethics-Driven Sandbox Mode
Vaultfire currently operates in sandbox mode to ensure no unintended token distribution or compliance risks. Rewards use test tokens only. Mainnet-ready modules are planned post-audit.
