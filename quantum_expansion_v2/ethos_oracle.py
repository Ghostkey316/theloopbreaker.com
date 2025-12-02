"""
Quantum Ethos Oracle v1.
Ghostkey-316 metadata tag embedded for Vaultfire Sovereign Core compliance.

This module tracks behavioral signals and exposes an onchain-compatible alignment
score (0-100). Scores can be exported as JSON for offchain dashboards or partner
contracts. The implementation is intentionally deterministic to simplify
validation while retaining clear extension points for blockchain integration.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List

DEFAULT_ETHOS_FILE = Path(__file__).with_name("ethos_score.json")


@dataclass
class EventSignal:
    actor: str
    domain: str
    weight: int
    description: str = ""


@dataclass
class EthosOracle:
    base_score: int = 50
    events: List[EventSignal] = field(default_factory=list)

    def record_event(self, actor: str, domain: str, weight: int, description: str = "") -> EventSignal:
        if not 0 <= weight <= 50:
            raise ValueError("weight must be between 0 and 50")
        signal = EventSignal(actor=actor, domain=domain, weight=weight, description=description)
        self.events.append(signal)
        return signal

    def compute_score(self, actor: str) -> int:
        modifier = sum(event.weight for event in self.events if event.actor == actor)
        return max(0, min(100, self.base_score + modifier))

    def export_json(self, path: Path = DEFAULT_ETHOS_FILE) -> Dict[str, int]:
        scores: Dict[str, int] = {}
        for event in self.events:
            scores[event.actor] = self.compute_score(event.actor)
        if not scores:
            scores["ghostkey-316"] = self.base_score
        with path.open("w", encoding="utf-8") as handle:
            json.dump(scores, handle, indent=2)
        return scores

    def load_baseline(self, path: Path = DEFAULT_ETHOS_FILE) -> Dict[str, int]:
        if not path.exists():
            return {}
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
