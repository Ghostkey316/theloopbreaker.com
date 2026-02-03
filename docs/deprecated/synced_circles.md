<!--
NON-NORMATIVE DOCUMENT

This file is historical/legacy/audit material and may contain aspirational language.
The canonical, current claims & limits are in: docs/CLAIMS_AND_LIMITS.md
-->

# Synced Circles

This module builds private social groups based on encrypted profile metrics. Users opt in and provide a small profile describing their growth style, ethics alignment, health goals, or portfolio moves. The system decrypts these metrics with user-provided keys and automatically assigns members to circles with similar traits.

## Usage
```python
from engine.synced_circles import opt_in, opt_out, link_profile_data, curate_circles

opt_in("alice")
link_profile_data("alice", {"growth_style": "steady"}, "secret")
link_profile_data("bob", {"growth_style": "steady"}, "secret2")
curate_circles({"alice": "secret", "bob": "secret2"})
```

## Disclaimers
- Use at your own risk; uptime or results are not guaranteed.
- Ambient data is logged only with opt-in consent.
- Nothing here constitutes legal, medical, or financial advice.
- Circle membership data is stored under `logs/circles/` and may be cleared at any time.
- Encryption uses AES-GCM with per-user keys; safeguard recovery keys and rotate them if compromise is suspected.
- Circles are AI-generated suggestions and do not guarantee privacy or accuracy.
