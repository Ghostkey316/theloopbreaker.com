from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
import hashlib
import math
from typing import Any, Callable, Iterable, List, Mapping, Optional

Callback = Callable[[Mapping[str, Any]], None]


@dataclass
class MirrorRecord:
    """Captured mirror interaction for prompt-response symmetry."""

    session_id: str
    prompt: str
    response: str
    symmetry: float
    emotion: str
    mirror_score: int
    token_id: Optional[str]
    ens_identity: str
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_payload(self) -> Mapping[str, Any]:
        return {
            "session_id": self.session_id,
            "prompt": self.prompt,
            "response": self.response,
            "symmetry": self.symmetry,
            "emotion": self.emotion,
            "mirror_score": self.mirror_score,
            "token_id": self.token_id,
            "ens_identity": self.ens_identity,
            "timestamp": self.timestamp.isoformat(),
        }


class MirrorEngine:
    """Track prompt-response symmetry and emotional context for Vaultfire."""

    def __init__(
        self,
        ens_identity: str = "ghostkey316.eth",
        token_id: Optional[str] = None,
        openai_callback: Optional[Callback] = None,
        grok_callback: Optional[Callback] = None,
    ) -> None:
        self.ens_identity = ens_identity
        self.token_id = token_id
        self._openai_callback = openai_callback
        self._grok_callback = grok_callback
        self._records: List[MirrorRecord] = []

    @staticmethod
    def _symmetry_score(prompt: str, response: str) -> float:
        prompt_tokens = set(prompt.lower().split())
        response_tokens = set(response.lower().split())
        if not prompt_tokens or not response_tokens:
            return 0.0
        overlap = len(prompt_tokens & response_tokens)
        balance = overlap / max(len(prompt_tokens), len(response_tokens))
        length_alignment = (
            min(len(prompt), len(response)) / max(len(prompt), len(response))
            if max(len(prompt), len(response))
            else 0
        )
        return round((balance + length_alignment) / 2, 3)

    @staticmethod
    def _emotion_signature(text: str) -> str:
        positive = {"align", "win", "yes", "secure", "safe", "love", "clear", "trust"}
        negative = {"fear", "no", "doubt", "risk", "alert", "warn", "threat"}
        text_l = text.lower()
        pos_hits = sum(1 for token in positive if token in text_l)
        neg_hits = sum(1 for token in negative if token in text_l)
        if pos_hits == neg_hits == 0:
            return "neutral"
        if pos_hits >= neg_hits:
            return "optimistic"
        return "cautious"

    def _mirror_score(self, symmetry: float, emotion: str) -> int:
        emotion_weight = {"optimistic": 24, "neutral": 16, "cautious": 12}
        weighted = symmetry * 200 + emotion_weight.get(emotion, 10)
        bounded = max(0, min(316, int(math.ceil(weighted))))
        return bounded

    def _dispatch_callbacks(self, payload: Mapping[str, Any]) -> None:
        obfuscated = self._obfuscate_payload(payload)
        for callback in (self._openai_callback, self._grok_callback):
            if callback:
                callback(obfuscated)

    @staticmethod
    def _obfuscate_payload(payload: Mapping[str, Any]) -> Mapping[str, Any]:
        masked_prompt = hashlib.sha256(str(payload.get("prompt", "")).encode()).hexdigest()
        masked_response = hashlib.sha256(str(payload.get("response", "")).encode()).hexdigest()
        return {
            **payload,
            "prompt": masked_prompt,
            "response": masked_response,
            "timestamp": payload.get("timestamp"),
        }

    def record_interaction(
        self,
        session_id: str,
        prompt: str,
        response: str,
        tone_hint: Optional[str] = None,
        token_id: Optional[str] = None,
    ) -> MirrorRecord:
        symmetry = self._symmetry_score(prompt, response)
        emotion = tone_hint or self._emotion_signature(f"{prompt} {response}")
        mirror_score = self._mirror_score(symmetry, emotion)
        if token_id:
            self.token_id = token_id
        record = MirrorRecord(
            session_id=session_id,
            prompt=prompt,
            response=response,
            symmetry=symmetry,
            emotion=emotion,
            mirror_score=mirror_score,
            token_id=self.token_id,
            ens_identity=self.ens_identity,
        )
        self._records.append(record)
        self._dispatch_callbacks(record.to_payload())
        return record

    def obfuscated_replay(self, session_id: str) -> Iterable[Mapping[str, Any]]:
        for record in self._records:
            if record.session_id == session_id:
                yield self._obfuscate_payload(record.to_payload())

    def meta_state(self) -> Mapping[str, Any]:
        latest = self._records[-1] if self._records else None
        return {
            "ens_identity": self.ens_identity,
            "token_id": self.token_id,
            "last_mirror_score": latest.mirror_score if latest else None,
            "emotional_vector": latest.emotion if latest else None,
            "total_reflections": len(self._records),
        }

    @property
    def records(self) -> List[MirrorRecord]:
        return list(self._records)


__all__ = ["MirrorEngine", "MirrorRecord"]
