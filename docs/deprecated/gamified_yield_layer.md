<!--
NON-NORMATIVE DOCUMENT

This file is historical/legacy/audit material and may contain aspirational language.
The canonical, current claims & limits are in: docs/CLAIMS_AND_LIMITS.md
-->

# Gamified Yield Layer

This module introduces streak-based quests and XP rewards across four domains:
Health, Crypto, Growth and Gaming. Each completed quest grants XP. Every 100 XP
automatically converts into a vault point, which may trigger a yield boost via
the existing `mark_yield_boost` hook.

Quests refresh daily and scale by belief alignment. Higher alignment scores
unlock tier‑1 quests for bigger rewards. Streaks track consecutive days of
quest completion and include optional protection to avoid losing progress after
an occasional missed day.

Frontend components consume the `quest_card()` output to display Quest Cards,
Daily Tasks and Level Unlocks. XP and streak data are stored in
`logs/yield_quests.json`.

Cooldowns prevent repeating the same quest within 24 hours. When XP increases
a full level, `mark_yield_boost()` records the user for a potential yield
increase.

**Disclaimers**
- This gamified layer stores progress locally and does not guarantee any
  financial return.
