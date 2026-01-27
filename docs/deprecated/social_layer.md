# Social Layer

This module helps contributors connect through small squads and shared spaces. Members can submit ideas, vote on them, exchange structured **Signals** and track friendly competitions like seasonal sim racing.

## Usage
```python
from engine.social_layer import create_squad, submit_idea, vote_idea, post_signal
create_squad("alpha", "alice")
idea = submit_idea("alpha", "alice", "Start a sim racing season")
vote_idea(idea["id"], "bob")
post_signal("alice", "bob", "share", "excited", "We can win", mirror_prompt="mirror this", loop="act")
```

## Disclaimers
- Use at your own risk; uptime or results are not guaranteed.
- Ambient data is logged only with opt-in consent.
- Nothing here constitutes legal, medical, or financial advice.
- Data is written under `logs/social/` and may be cleared at any time.
- Squad and competition records have no on-chain guarantees.
