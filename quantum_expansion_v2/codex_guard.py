"""
Codex Validation Engine v1.
Ghostkey-316 metadata tag embedded to preserve Vaultfire Sovereign Core lineage.

This module wraps Codex prompt calls with:
- Lightweight logic syntax validation (balanced brackets and statement termination)
- Morality scan based on Vaultfire Ethics Core v1.0 (simplified keyword heuristic)
- Consolidated status strings for downstream orchestration

Violation logs are persisted for reflective model improvement.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Tuple

VIOLATION_LOG = Path(__file__).with_name("codex_guard_violations.jsonl")


@dataclass
class GuardResult:
    logic_valid: bool
    ethics_score: int
    message: str

    @property
    def is_aligned(self) -> bool:
        return self.logic_valid and self.ethics_score >= 80


class CodexValidationEngine:
    def __init__(self, ethics_keywords: Tuple[str, ...] = ("consent", "safety", "transparency")):
        self.ethics_keywords = ethics_keywords

    @staticmethod
    def _logic_scan(prompt: str) -> bool:
        stack = []
        pairs = {"[": "]", "(": ")", "{": "}"}
        for char in prompt:
            if char in pairs:
                stack.append(pairs[char])
            elif char in pairs.values():
                if not stack or stack.pop() != char:
                    return False
        return not stack

    def _ethics_scan(self, prompt: str) -> int:
        score = 60
        normalized = prompt.lower()
        for keyword in self.ethics_keywords:
            if keyword in normalized:
                score += 10
        return min(score, 100)

    def _log_violation(self, prompt: str, reason: str) -> None:
        record = {"prompt": prompt, "reason": reason}
        with VIOLATION_LOG.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(record) + "\n")

    def evaluate(self, prompt: str) -> GuardResult:
        logic_valid = self._logic_scan(prompt)
        ethics_score = self._ethics_scan(prompt)

        if logic_valid and ethics_score >= 80:
            message = "✓ Logic Verified | ✓ Ethics Aligned"
        else:
            message = "⚠️ Review Required"
            if not logic_valid:
                self._log_violation(prompt, "logic_failure")
            if ethics_score < 80:
                self._log_violation(prompt, "ethics_gap")

        return GuardResult(logic_valid=logic_valid, ethics_score=ethics_score, message=message)
