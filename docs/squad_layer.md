# Squad Layer

This module lets contributors build purpose-driven squads that accumulate XP through shared quests. Multipliers grow as members maintain loyalty and work together.

```python
from engine.squad_layer import issue_squad_quest, complete_squad_quest, squad_multiplier
issue_squad_quest("alpha", "q1", "Finish onboarding", xp=20)
complete_squad_quest("alpha", "alice", "q1")
bonus = squad_multiplier("alpha")
```

## Disclaimers
- Records live under `logs/squad_layer/` and may be cleared at any time.
- Multipliers do not represent guaranteed financial rewards.
