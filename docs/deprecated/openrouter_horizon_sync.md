<!--
NON-NORMATIVE DOCUMENT

This file is historical/legacy/audit material and may contain aspirational language.
The canonical, current claims & limits are in: docs/CLAIMS_AND_LIMITS.md
-->

# OpenRouter Horizon Sync

This guide explains how to register Vaultfire with OpenRouter for leaderboard tracking and Horizon Alpha access.

1. Set `OPENROUTER_API_KEY` in your environment.
2. Install the `openai` package.
3. Use the script below or import its function in your own tools.

```python
from openrouter_horizon_sync import run_horizon_scan

run_horizon_scan()
```

The script sends a chat completion request using your OpenRouter credentials and returns the model response. The request is tagged with your ENS-linked domain so results appear on the public leaderboard and remain compatible with future GPT‑5 updates.

## Disclaimers
- Use of OpenRouter is optional and subject to its own terms.
- Partners are responsible for their own compliance review.
- Vaultfire modules may change without notice and are provided as-is.
