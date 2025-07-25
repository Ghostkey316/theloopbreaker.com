# SparkStarter Initiation Layer – v1.5 Companion Class

This module extends the Vaultlink companion with a proactive AI‑ping behavior layer. Messages are generated during key engagement windows and can provide reminders, motivational stats or quick fact drops from protocol memory.

## Modes
- **Silent Mode** – AI listens only.
- **Check-In Mode** – minimal interaction.
- **Companion Mode** – full active support.

Pings mirror the user's tone and timing preferences and pull in context from the loyalty engine, belief score and milestone logs.

### v1.5 Highlights
- Dynamic emotional sync engine adapts messages based on recent mood tags.
- Belief-based fact drops once per day with optional swagger.
- Soft prompt trail provides light check-ins without pressure.
- Pin mode keeps a personal focus of the day visible.
- Whisper backlog catcher resurfaces missed milestones.
- Passive sync confirmation ensures the right mode is active.

## Usage
```python
from engine.sparkstarter_layer import (
    set_mode,
    set_preferences,
    set_focus,
    next_ping,
)
set_mode("alice", "companion")
set_preferences("alice", "friendly", 2)
set_focus("alice", "Meditation streak")
entry = next_ping("alice", "Keep moving forward!", "secret-key")
```

## Disclaimers
- SparkStarter is not a medical or therapeutic system.
- Ping data is stored locally and may be cleared at any time.
