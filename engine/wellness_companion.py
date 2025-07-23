"""Wellness Companion module linking journaling and mood tracking with the Vaultlink AI."""
from __future__ import annotations

from typing import List

from .soul_journal import add_entry
from .wellness_oracle import record_checkin, _last_mood
from .reflection_layer import emotion_trend, update_emotional_state
from .vaultlink import record_interaction


def log_journal_entry(user_id: str, text: str, key: str) -> str:
    """Add a journal entry and sync with the companion."""
    soulprint = add_entry(user_id, text)
    update_emotional_state(user_id, text, key)
    record_interaction(user_id, text, "journal", 1.0, False, key)
    return soulprint


def mood_checkin(user_id: str, mood: int, note: str = "", key: str | None = None) -> None:
    """Record a mood check-in and optional note."""
    record_checkin(user_id, mood, note)
    if key and note:
        update_emotional_state(user_id, note, key)
        record_interaction(user_id, f"mood:{mood}", "wellness", 0.5, False, key)


def reflection_prompt(user_id: str, key: str) -> str:
    """Return a reflection prompt based on recent emotions."""
    trend = emotion_trend(user_id, key)
    if not trend:
        return "What stands out about your recent experiences?"
    emotion = max(trend, key=trend.get)
    prompts = {
        "joy": "What moments of joy can you build on?",
        "fear": "Which fears are holding you back right now?",
        "doubt": "Where are you feeling uncertain and how might you find clarity?",
        "confidence": "How can your confidence uplift others around you?",
    }
    return prompts.get(emotion, "What stands out about your recent experiences?")


def coping_suggestions(user_id: str, key: str) -> List[str]:
    """Return simple coping suggestions based on mood and emotion."""
    suggestions: List[str] = []
    last_mood = _last_mood(user_id)
    trend = emotion_trend(user_id, key)
    if last_mood is not None and last_mood <= 2:
        suggestions.append("Take a short break and practice deep breathing.")
    if trend.get("fear", 0) > 0.3:
        suggestions.append("Consider writing down your worries and talking with a friend.")
    if trend.get("doubt", 0) > 0.3:
        suggestions.append("List recent accomplishments to counter self-doubt.")
    if not suggestions:
        suggestions.append("Keep checking in with yourself and celebrate small wins.")
    return suggestions


def evolve_companion(user_id: str) -> str:
    """Evolve AI companion logic with Morals-First safeguards."""
    trend = emotion_trend(user_id, "vaultkey")
    if trend.get("joy", 0) > 0.5:
        stage = "guide"
    else:
        stage = "ally"
    record_interaction(user_id, stage, "evolve", 1.0, False, "vaultkey")
    return stage


__all__ = [
    "log_journal_entry",
    "mood_checkin",
    "reflection_prompt",
    "coping_suggestions",
    "evolve_companion",
]
