from __future__ import annotations
"""TruthGuard middleware to pause output when hype or bias is detected."""

import json
import re
import sys
from typing import Iterable


HYPE_PATTERNS: Iterable[str] = [
    r"\bmoonshot\b",
    r"\b100x\b",
    r"guaranteed profit",
    r"get rich quick",
    r"limited time only",
]

PROFIT_PATTERNS: Iterable[str] = [
    r"profit[s]? (are|is) (?:our )?priority",
    r"revenue .* above all",
    r"maximize profit",
]

MANIPULATION_PATTERNS: Iterable[str] = [
    r"fake data",
    r"doctored numbers",
    r"manipulated stats",
]


class TruthGuardStream:
    """Proxy ``sys.stdout`` that halts output if suspicious language is detected."""

    def __init__(self, real_stream):
        self.real_stream = real_stream
        self.halted = False
        self.buffer: list[str] = []
        self.approved = False

    def _matches(self, text: str) -> bool:
        patterns = list(HYPE_PATTERNS) + list(PROFIT_PATTERNS) + list(MANIPULATION_PATTERNS)
        for pattern in patterns:
            if re.search(pattern, text, re.IGNORECASE):
                return True
        # naive numeric check for manipulated data
        try:
            data = json.loads(text)
            if isinstance(data, dict):
                for value in data.values():
                    if isinstance(value, (int, float)) and (value < 0 or value > 1_000_000):
                        return True
        except Exception:
            pass
        return False

    # TextIOBase API
    def write(self, s: str) -> int:
        if self.halted:
            self.buffer.append(s)
            return len(s)
        if self._matches(s):
            self.halted = True
            self.buffer.append(s)
            warning = (
                "[TRUTH-CHECK] Potential hype language or manipulated data detected. "
                "Output halted for review."
            )
            self.real_stream.write(warning + "\n")
            self.real_stream.flush()
            return len(s)
        return self.real_stream.write(s)

    def flush(self) -> None:
        self.real_stream.flush()

    # Control methods
    def approve(self) -> None:
        """Mark the review as approved by a trusted logic agent and resume output."""
        self.approved = True
        self.resume()

    def resume(self) -> None:
        if not self.approved:
            raise PermissionError("Trusted logic agent approval required before resuming output")
        for item in self.buffer:
            self.real_stream.write(item)
        self.buffer.clear()
        self.real_stream.flush()
        self.halted = False


def install_truth_guard() -> TruthGuardStream:
    """Replace ``sys.stdout`` with a ``TruthGuardStream`` and return it."""
    guard = TruthGuardStream(sys.stdout)
    sys.stdout = guard
    return guard
