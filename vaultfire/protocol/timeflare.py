"""Protocol Unique: TimeFlare trigger and ledger helpers."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Callable, Iterator, List, MutableSequence, Sequence, TYPE_CHECKING

if TYPE_CHECKING:  # pragma: no cover - imported for typing only
    from .moral_fork import TimelineFork

MODULE_TAG = "Protocol Unique"


class TimeFlare:
    """Simple real-time trigger dispatcher backed by a ledger file."""

    LEDGER_ENV = "VAULTFIRE_TIMEFLARE_LEDGER_PATH"

    def __init__(self, *, ledger_path: str | os.PathLike[str] | None = None) -> None:
        self._ledger_path = Path(ledger_path) if ledger_path is not None else self.default_path()
        self._subscribers: MutableSequence[Callable[["TimelineFork"], None]] = []

    def register(self, callback: Callable[["TimelineFork"], None]) -> None:
        """Register a callback that will be invoked on each trigger."""

        if callback not in self._subscribers:
            self._subscribers.append(callback)

    def unregister(self, callback: Callable[["TimelineFork"], None]) -> None:
        """Remove a previously registered callback."""

        if callback in self._subscribers:
            self._subscribers.remove(callback)

    def emit(self, fork: "TimelineFork") -> None:
        """Persist the fork record and notify subscribers."""

        ledger = self._load()
        ledger.append(fork.to_payload())
        self._write(ledger)
        for callback in list(self._subscribers):
            callback(fork)

    def load(self) -> List[dict]:
        """Load the stored ledger entries."""

        return self._load()

    def iter_triggers(self) -> Iterator[dict]:
        """Iterate over stored triggers in chronological order."""

        yield from self._load()

    def _load(self) -> List[dict]:
        if not self._ledger_path.exists():
            return []
        try:
            data = json.loads(self._ledger_path.read_text())
        except json.JSONDecodeError:
            return []
        if isinstance(data, list):
            return list(data)
        return []

    def _write(self, ledger: Sequence[dict]) -> None:
        self._ledger_path.parent.mkdir(parents=True, exist_ok=True)
        self._ledger_path.write_text(json.dumps(list(ledger), indent=2) + "\n")

    @classmethod
    def default_path(cls) -> Path:
        """Return the default ledger path."""

        custom = os.getenv(cls.LEDGER_ENV)
        if custom:
            return Path(custom)
        return Path("status") / "timeflare_triggers.json"

    def __iter__(self) -> Iterator[dict]:
        return self.iter_triggers()
