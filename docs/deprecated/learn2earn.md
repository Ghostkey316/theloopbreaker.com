<!--
NON-NORMATIVE DOCUMENT

This file is historical/legacy/audit material and may contain aspirational language.
The canonical, current claims & limits are in: docs/CLAIMS_AND_LIMITS.md
-->

# Learn2Earn Module

This module rewards knowledge growth through quizzes and daily lessons. Quiz scores scale with each contributor's reputation multiplier. Completed lessons feed into the Life Yield Engine and may trigger token drops.

Example usage:
```python
from engine.learn2earn import log_quiz, complete_lesson
log_quiz("alice", "ethics-101", 8.5)
complete_lesson("alice", "intro-ethics", "alice.eth")
```

**Disclaimers**
- Rewards depend on local quiz logs and may be recalculated or cleared.
- Token payouts rely on marketplace settings and are not guaranteed.
