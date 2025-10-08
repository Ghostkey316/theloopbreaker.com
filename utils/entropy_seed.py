"""Deterministic entropy utilities shared by Vaultfire cloaking layers."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import hashlib
import secrets
from typing import Iterable, List, Sequence, Tuple


@dataclass(frozen=True)
class EntropySnapshot:
    """Represents a generated entropy pulse."""

    heartbeat: int
    entropy_hex: str
    timestamp: datetime
    vector: Tuple[float, ...]
    signature: str


class EntropySeed:
    """Deterministic entropy derivation helper.

    The generator can be seeded for repeatable results which keeps the
    reproducibility required by the telemetry driven unit tests. When used with
    the debug flag the generated entropy snapshots are retained to offer a
    lightweight audit trail aligned with Vaultfire's transparency clauses.
    """

    def __init__(self, base_seed: str | None = None, *, debug: bool = False) -> None:
        self._base_seed = base_seed or secrets.token_hex(16)
        self._counter = 0
        self._debug = debug
        self._history: List[EntropySnapshot] = []

    @property
    def base_seed(self) -> str:
        """Return the base seed used by the entropy generator."""

        return self._base_seed

    @property
    def debug(self) -> bool:
        """Return whether debug capture is active."""

        return self._debug

    def set_debug(self, enabled: bool) -> None:
        """Toggle debug capture."""

        self._debug = enabled
        if not enabled:
            self._history.clear()

    def pulse(self, *, context: str = "", width: int = 4) -> EntropySnapshot:
        """Generate a new entropy snapshot."""

        if width <= 0:
            raise ValueError("width must be positive")
        self._counter += 1
        timestamp = datetime.utcnow()
        payload = f"{self._base_seed}:{self._counter}:{context}".encode("utf-8")
        digest = hashlib.sha3_256(payload).hexdigest()
        vector = self._normalise_vector(digest, width)
        signature_payload = f"{digest}:{timestamp.isoformat()}".encode("utf-8")
        signature = hashlib.sha3_512(signature_payload).hexdigest()
        snapshot = EntropySnapshot(
            heartbeat=self._counter,
            entropy_hex=digest[:32],
            timestamp=timestamp,
            vector=vector,
            signature=signature,
        )
        if self._debug:
            self._history.append(snapshot)
        return snapshot

    def derive_signature(self, signatures: Iterable[str], *, context: str = "") -> str:
        """Blend a collection of signatures into a deterministic digest."""

        parts = [self._base_seed, context]
        for value in signatures:
            parts.append(str(value))
        payload = ":".join(parts).encode("utf-8")
        return hashlib.sha3_256(payload).hexdigest()

    def audit_trail(self) -> Sequence[EntropySnapshot]:
        """Return captured entropy snapshots when debug mode is active."""

        return tuple(self._history)

    def _normalise_vector(self, digest: str, width: int) -> Tuple[float, ...]:
        raw: List[float] = []
        for index in range(width):
            payload = f"{digest}:{index}".encode("utf-8")
            block = hashlib.sha3_256(payload).digest()
            value = int.from_bytes(block[:8], "big") / float(1 << 64)
            raw.append(value)
        total = sum(raw)
        # Avoid division by zero when random bytes return zeros.
        if total == 0:
            total = float(width)
            raw = [1.0] * width
        normalised = tuple(value / total for value in raw)
        return normalised


__all__ = ["EntropySeed", "EntropySnapshot"]
