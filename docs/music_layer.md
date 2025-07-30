# Music Layer

This module connects streaming services like Spotify, Apple Music, SoundCloud and Audius to build a user's music identity. Top tracks help map genre preferences which feed into AI‑curated playlists and community sync features.

## Usage
```python
from engine.music_layer import connect_service, pull_top_tracks, build_music_identity, ai_curated_playlist
connect_service("alice", "spotify", "token")
tracks = pull_top_tracks("alice", "spotify")
identity = build_music_identity("alice", tracks)
playlist = ai_curated_playlist("alice")
```

## Disclaimers
- Use at your own risk; uptime or results are not guaranteed.
- Ambient data is logged only with opt-in consent.
- Nothing here constitutes legal, medical, or financial advice.
- API tokens are stored as hashes and do not grant direct access to third‑party services.
- Memory tracks use lightweight XOR encryption and are not suited for sensitive data.
- AI playlists are suggestions only and may not reflect professional curation.

## Ethics-Driven Sandbox Mode
Vaultfire currently operates in sandbox mode to ensure no unintended token distribution or compliance risks. Rewards use test tokens only. Mainnet-ready modules are planned post-audit.
