<!--
NON-NORMATIVE DOCUMENT

This file is historical/legacy/audit material and may contain aspirational language.
The canonical, current claims & limits are in: docs/CLAIMS_AND_LIMITS.md
-->

# Earning Module

This component rewards contributors for meaningful engagement and completed work.
Each action multiplies a base reward by the contributor's on-chain reputation.
Wallet addresses are resolved through ENS or Coinbase IDs before payouts.

Example usage:
```python
from engine.earning_module import reward_engagement
reward_engagement("alice", "alice.eth", score=2.5)
```

**Disclaimers**
- Rewards are recorded locally in `logs/earning_log.json` and may be purged.
- On-chain scores come from a stable oracle and may be inaccurate.
