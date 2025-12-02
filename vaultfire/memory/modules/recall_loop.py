"""Recall loop orchestration for Vaultfire memory layer."""

from __future__ import annotations

import statistics
from dataclasses import dataclass
from typing import Mapping, MutableMapping, Sequence

from vaultfire.memory.modules.memory_thread import MemoryEvent, MemoryThreadCore


@dataclass(frozen=True)
class RecallContext:
    """Context regenerated from belief weight, tone resonance, and cadence."""

    blended_score: float
    continuity_profile: Mapping[str, float]
    recall_events: Sequence[MemoryEvent]
    fallback_used: bool


class RecallLoopModule:
    """Regenerate context based on belief weight and biometric cadence."""

    def __init__(self, memory_core: MemoryThreadCore | None = None) -> None:
        self.memory_core = memory_core or MemoryThreadCore()

    def _continuity_profile(
        self, *, events: Sequence[MemoryEvent], biometric_cadence: float
    ) -> Mapping[str, float]:
        profile: MutableMapping[str, float] = {
            "biometric_cadence": round(max(0.0, biometric_cadence), 3)
        }
        if events:
            anchor_ordinals = [event.anchor.ordinal for event in events]
            profile["chronology"] = round(statistics.mean(anchor_ordinals), 3)
            profile["resonance_strength"] = round(
                statistics.mean(event.drift_score for event in events) / 316.0, 4
            )
        else:
            profile.update({"chronology": 0.0, "resonance_strength": 0.0})
        return profile

    def _blend_score(
        self,
        *,
        belief_weight: float,
        tone_resonance: float,
        continuity_profile: Mapping[str, float],
    ) -> float:
        coherence = continuity_profile.get("resonance_strength", 0.0)
        cadence = continuity_profile.get("biometric_cadence", 0.0)
        weighted = 0.5 * belief_weight + 0.3 * tone_resonance + 0.2 * cadence
        weighted += coherence * 0.1
        normalized = max(0.0, min(1.0, weighted))
        return round(normalized, 3)

    def regenerate_context(
        self,
        user_id: str,
        *,
        belief_weight: float,
        tone_resonance: float,
        biometric_cadence: float,
    ) -> RecallContext:
        """Regenerate context with fallback trace resolution."""

        events = self.memory_core.thread(user_id)
        fallback_used = False
        selected_events: Sequence[MemoryEvent]
        if events:
            selected_events = events[-3:]
        else:
            fallback_used = True
            selected_events = ()
        continuity_profile = self._continuity_profile(
            events=selected_events, biometric_cadence=biometric_cadence
        )
        blended_score = self._blend_score(
            belief_weight=belief_weight,
            tone_resonance=tone_resonance,
            continuity_profile=continuity_profile,
        )
        if fallback_used:
            continuity_profile = dict(continuity_profile)
            continuity_profile["fallback_trace"] = 1.0
        return RecallContext(
            blended_score=blended_score,
            continuity_profile=continuity_profile,
            recall_events=selected_events,
            fallback_used=fallback_used,
        )


class EmotionTraceRouter:
    """Link prior user states with real-time prompts using continuity profiles."""

    def __init__(self, memory_core: MemoryThreadCore | None = None) -> None:
        self.memory_core = memory_core or MemoryThreadCore()

    def link_states(
        self, user_id: str, *, prompt: str, emotional_tone: float
    ) -> Mapping[str, object]:
        recalls = self.memory_core.thread(user_id)
        continuity_profile = {
            "linked_prompts": [event.prompt for event in recalls[-5:]],
            "emotional_trace": round(emotional_tone + len(recalls) * 0.01, 3),
            "ordinal_window": [event.anchor.ordinal for event in recalls[-5:]],
        }
        hint = "continuity" if recalls else "fresh"
        return {
            "prompt": prompt,
            "hint": hint,
            "continuity_profile": continuity_profile,
        }


__all__ = ["EmotionTraceRouter", "RecallContext", "RecallLoopModule"]
