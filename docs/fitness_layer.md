# FitSync Layer

Vaultfire FitSync v1.0 links Apple Health, Google Fit and wearable devices to the protocol. Workouts are validated using a simple "Proof of Sweat" check before awarding Vault Points. Providers can register custom validators so new devices plug in without modifying the core code.

```python
from engine.fit_sync import connect_provider, record_workout_sync
connect_provider("alice", "apple", "token")
record_workout_sync("alice", "apple", {"minutes": 30, "avg_hr": 120})
```

Team challenges allow groups to combine minutes toward a shared goal. When the goal is met, each member earns a small Vault reward.

## Disclaimers
- Fitness connectors are **Beta Module** — production version in development; API endpoints subject to change and do not use official APIs.
- Proof-of-sweat validation is basic and not cheat-proof.
- Rewards are test tokens with no monetary value.

## Ethics-Driven Sandbox Mode
Vaultfire currently operates in sandbox mode to ensure no unintended token distribution or compliance risks. Rewards use test tokens only. Mainnet-ready modules are planned post-audit.
