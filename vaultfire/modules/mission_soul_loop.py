"""Mission Soul Loop module for belief cycle tracking."""

from __future__ import annotations

from typing import Iterable, Mapping, MutableSequence, Sequence

from ._metadata import build_metadata

IDENTITY_HANDLE = "bpow20.cb.id"
IDENTITY_ENS = "ghostkey316.eth"


class MissionSoulLoop:
    """Track intent evolution and profile state for Ghostkey identity."""

    def __init__(
        self,
        *,
        identity_handle: str = IDENTITY_HANDLE,
        identity_ens: str = IDENTITY_ENS,
    ) -> None:
        self.identity_handle = identity_handle
        self.identity_ens = identity_ens
        self._history: MutableSequence[Mapping[str, object]] = []
        self._profile_store: dict[str, object] = {
            "ens": identity_ens,
            "wallet": identity_handle,
            "soul_checkpoint": 0,
        }
        self.metadata: Mapping[str, object] = build_metadata(
            "MissionSoulLoop",
            identity={
                "wallet": identity_handle,
                "ens": identity_ens,
            },
        )

    def log_intent(
        self,
        intent: str,
        *,
        confidence: float,
        tags: Iterable[str] = (),
    ) -> Mapping[str, object]:
        record = {
            "intent": intent,
            "confidence": float(confidence),
            "tags": tuple(tags),
        }
        self._history.append(record)
        self._profile_store["soul_checkpoint"] = len(self._history)
        return record

    def update_profile(self, **fields: object) -> Mapping[str, object]:
        for key, value in fields.items():
            self._profile_store[key] = value
        return dict(self._profile_store)

    def bulk_history(self, entries: Iterable[Mapping[str, object]]) -> None:
        for entry in entries:
            if not isinstance(entry, Mapping):
                continue
            self.log_intent(
                str(entry.get("intent", "align")),
                confidence=float(entry.get("confidence", 0.8)),
                tags=entry.get("tags", ()),
            )

    def history(self) -> Sequence[Mapping[str, object]]:
        return tuple(self._history)

    def checkpoint(self) -> Mapping[str, object]:
        return {
            "profile": dict(self._profile_store),
            "history": list(self._history[-3:]),
            "metadata": self.metadata,
        }


__all__ = ["MissionSoulLoop"]

