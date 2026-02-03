<!--
NON-NORMATIVE DOCUMENT

This file is historical/legacy/audit material and may contain aspirational language.
The canonical, current claims & limits are in: docs/CLAIMS_AND_LIMITS.md
-->

# Wellness Companion

This module links journaling and mood tracking with the Vaultlink AI companion. It stores journal entries, records mood check-ins and provides reflection prompts along with simple coping suggestions.

## Usage
```python
from engine.wellness_companion import log_journal_entry, mood_checkin, reflection_prompt, coping_suggestions
log_journal_entry("alice", "Today I felt hopeful.", "secret-key")
```

## Disclaimers
- Use at your own risk; uptime or results are not guaranteed.
- Ambient data is logged only with opt-in consent.
- Nothing here constitutes legal, medical, or financial advice.
- This module does not replace professional mental health care.
- Journal data is stored locally and should not include sensitive personal details.
