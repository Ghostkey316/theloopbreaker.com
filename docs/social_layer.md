# Social Layer

This module helps contributors connect through small squads and shared spaces. Members can submit ideas, vote on them, exchange quick signals and track friendly competitions like seasonal sim racing.

## Usage
```python
from engine.social_layer import create_squad, submit_idea, vote_idea
create_squad("alpha", "alice")
idea = submit_idea("alpha", "alice", "Start a sim racing season")
vote_idea(idea["id"], "bob")
```

## Disclaimers
- Data is written under `logs/social/` and may be cleared at any time.
- Squad and competition records have no on-chain guarantees.
