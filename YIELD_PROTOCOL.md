# Vaultfire Yield Protocol

The yield system rewards contributors based on loyalty and verified behavior.
The core formula is:

```
multiplier = base * loyalty * behavior_score
yield = (#trigger_events * multiplier) * APR
```

Where:
- `base` is 1.0 unless boosts are configured.
- `loyalty` comes from wallet reputation and XP.
- `behavior_score` reflects recent positive actions.
- `APR` is dynamic and adjusts via `apr_multiplier`.

Example:
A contributor with loyalty 1.2 and behavior score 1.1 who
triggers 5 events with APR 0.05 earns:
`5 * (1.0 * 1.2 * 1.1) * 0.05 = 0.33` tokens.

Fairness is enforced through audit logs and anti‑exploit checks
in `yield_engine_v1.py`.
