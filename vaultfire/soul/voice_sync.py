"""VoiceSync module for tone and language fingerprinting."""

from __future__ import annotations

from collections import Counter
from typing import Mapping, MutableMapping, Sequence

INCLUSIVE_MARKERS = {"we", "us", "together", "ally"}
SELF_MARKERS = {"i", "me", "solo", "alone"}


class VoiceSyncModule:
    """Capture language style, tone, and emotional spectrum."""

    def __init__(self) -> None:
        self._fingerprint: Mapping[str, object] = {}
        self._history: list[str] = []

    def capture(self, prompt_history: Sequence[str]) -> Mapping[str, object]:
        prompts = [str(entry).strip() for entry in prompt_history if str(entry).strip()]
        tokens: list[str] = []
        exclamations = 0
        for prompt in prompts:
            tokens.extend(prompt.lower().split())
            exclamations += prompt.count("!")
        counts = Counter(tokens)
        style_markers = tuple(word for word, _ in counts.most_common(4))
        inclusive = sum(1 for word in tokens if word in INCLUSIVE_MARKERS)
        self_referential = sum(1 for word in tokens if word in SELF_MARKERS)
        bonding_trend = inclusive / max(inclusive + self_referential, 1)
        tone = {
            "energy": min(1.0, exclamations / max(len(prompts), 1) + 0.15),
            "steadiness": max(0.0, 1.0 - (exclamations * 0.05)),
        }
        emotional_spectrum = {
            "warmth": min(1.0, counts.get("trust", 0) * 0.2 + bonding_trend),
            "intensity": min(1.0, counts.get("signal", 0) * 0.1 + tone["energy"]),
        }
        fingerprint: MutableMapping[str, object] = {
            "style_markers": style_markers,
            "tone": tone,
            "emotional_spectrum": emotional_spectrum,
            "history_sample": tuple(prompts[-3:]),
            "bonding_trend": round(bonding_trend, 3),
        }
        self._fingerprint = dict(fingerprint)
        self._history.extend(prompts)
        return dict(fingerprint)

    def tone_adaptive_prompt(self, base_prompt: str) -> str:
        """Return a prompt that resonates with the captured tone signature."""

        if not base_prompt:
            raise ValueError("base prompt cannot be empty")
        if not self._fingerprint:
            return f"{base_prompt} [resonance: neutral]"
        tone = self._fingerprint.get("tone", {})
        spectrum = self._fingerprint.get("emotional_spectrum", {})
        return (
            f"{base_prompt} [resonance: energy={tone.get('energy', 0):.2f}; "
            f"warmth={spectrum.get('warmth', 0):.2f}]"
        )

    def snapshot(self) -> Mapping[str, object]:
        return dict(self._fingerprint)

    def bonding_score(self) -> float:
        if not self._fingerprint:
            return 0.0
        return float(self._fingerprint.get("bonding_trend", 0.0))


__all__ = ["VoiceSyncModule"]
