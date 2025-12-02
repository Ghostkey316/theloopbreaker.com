"""Memory Echo capture and replay tracing for Vaultfire Drift Layer."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Mapping

import reflect_prompt


@dataclass(slots=True)
class PromptRecord:
    """Prompt metadata tracked for echo tracing."""

    prompt_id: str
    text: str
    sentiment: float


@dataclass(slots=True)
class EchoRecord:
    """Captured echo of a previous prompt with sentiment delta."""

    phrase: str
    origin_prompt: str
    sentiment_shift: float
    replay_count: int = 1
    imprint_density: float = 0.0


class EchoCapture:
    """Capture prompt echoes, memory replays, and protocol imprint density."""

    def __init__(self) -> None:
        self._prompts: Dict[str, PromptRecord] = {}
        self._echoes: Dict[str, EchoRecord] = {}

    def log_prompt(self, prompt_id: str, text: str, sentiment: float) -> PromptRecord:
        """Store an origin prompt for later echo tracing."""

        record = PromptRecord(prompt_id=prompt_id, text=text, sentiment=sentiment)
        self._prompts[prompt_id] = record
        return record

    def capture_echo(
        self, prompt_id: str, phrase: str, replay_sentiment: float
    ) -> EchoRecord:
        """Capture an echoed phrase and compute its sentiment shift."""

        if prompt_id not in self._prompts:
            raise KeyError(f"Unknown prompt id {prompt_id}")
        origin = self._prompts[prompt_id]
        shift = replay_sentiment - origin.sentiment
        record = self._echoes.get(phrase)
        if record:
            record.replay_count += 1
            record.sentiment_shift = (record.sentiment_shift + shift) / 2
        else:
            record = EchoRecord(
                phrase=phrase,
                origin_prompt=prompt_id,
                sentiment_shift=shift,
            )
            self._echoes[phrase] = record
        record.imprint_density = self._imprint_density()
        return record

    def echo_feed(self) -> List[EchoRecord]:
        """Return all captured echoes."""

        return list(self._echoes.values())

    def imprint_map(self) -> Mapping[str, float]:
        """Return mapping of phrase to imprint density."""

        return {record.phrase: record.imprint_density for record in self._echoes.values()}

    def sync_to_mirror(self, output_path: Path) -> Path:
        """Sync echo data to MirrorLayer via reflect_prompt feed."""

        prompts = [record.text for record in self._prompts.values()]
        score = reflect_prompt.calculate_mirror_score(prompts)
        trend = reflect_prompt.growth_trends([], score)
        payload = {"echoes": [asdict(record) for record in self.echo_feed()], "imprint_density": self.imprint_map()}
        mirror_ready = json.dumps(payload, indent=2)
        return reflect_prompt.export_feed(score, trend, [mirror_ready], output_path)

    def _imprint_density(self) -> float:
        total = sum(record.replay_count for record in self._echoes.values()) or 1
        return round(min(1.0, total / 25), 4)


__all__: Iterable[str] = ["EchoCapture", "EchoRecord", "PromptRecord"]
