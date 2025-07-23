# Life XP Module

This component rewards growth behavior such as finishing lessons, passing tests and exploring new ideas. Each action grants **Life XP** scaled by the user's learning multiplier from the Ethical Growth Engine. XP events are also sent to the Vaultlink AI companion so memory evolves alongside the user's progress.

Example usage:
```python
from engine.life_xp_module import reward_lesson
reward_lesson("alice", "intro-101", "secret-key")
```

**Disclaimers**
- Logs are stored in `logs/life_xp.json` and may be reset.
- Companions require onboarding before XP can be recorded.
