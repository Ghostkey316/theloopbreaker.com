"""SoulPrint Core for generating encrypted identity hashes and metadata."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Mapping, MutableMapping, Sequence

IDENTITY_HANDLE = "bpow20.cb.id"
IDENTITY_ENS = "ghostkey316.eth"


@dataclass(frozen=True)
class SoulPrint:
    """Representation of the generated SoulPrint."""

    hash: str
    metadata: Mapping[str, object]
    factors: Mapping[str, object]


class SoulPrintCore:
    """Generate unique SoulPrint hashes and attach ENS/NFT metadata."""

    def __init__(
        self,
        *,
        identity_handle: str = IDENTITY_HANDLE,
        identity_ens: str = IDENTITY_ENS,
    ) -> None:
        self.identity_handle = identity_handle
        self.identity_ens = identity_ens
        self._last_hash: str | None = None

    def _normalize_sequence(self, values: Sequence[object]) -> tuple[str, ...]:
        return tuple(str(value).strip() for value in values if str(value).strip())

    def _normalize_mapping(self, values: Mapping[str, object]) -> Mapping[str, float]:
        normalized: MutableMapping[str, float] = {}
        for key, value in values.items():
            try:
                normalized[str(key)] = float(value)
            except (TypeError, ValueError):
                continue
        return dict(normalized)

    def _encode_hash(self, factors: Mapping[str, object]) -> str:
        payload = json.dumps(factors, sort_keys=True, separators=(",", ":")).encode()
        return hashlib.sha256(payload).hexdigest()

    def generate(
        self,
        *,
        prompt_cadence: Sequence[object],
        mirror_echoes: Sequence[str],
        drift_patterns: Mapping[str, object],
        belief_deltas: Mapping[str, object],
        emotional_profile: Mapping[str, float] | None = None,
    ) -> SoulPrint:
        """Return a SoulPrint hash with attached metadata payload."""

        cadence = self._normalize_sequence(prompt_cadence)
        echoes = self._normalize_sequence(mirror_echoes)
        drift = self._normalize_mapping(drift_patterns)
        belief = self._normalize_mapping(belief_deltas)
        factors: Mapping[str, object] = {
            "cadence": cadence,
            "echoes": echoes,
            "drift": drift,
            "belief": belief,
        }
        hashed = self._encode_hash(factors)
        obfuscated_profile = None
        if emotional_profile:
            encoded_profile = json.dumps(
                self._normalize_mapping(emotional_profile),
                sort_keys=True,
                separators=(",", ":"),
            )
            obfuscated_profile = hashlib.sha1(encoded_profile.encode()).hexdigest()
        streak_integrity = round(
            min(1.0, (len(cadence) + len(echoes)) / max(len(cadence) + len(echoes), 1)),
            3,
        )
        signature_persistence = 1.0 if self._last_hash == hashed else 0.72
        metadata = {
            "ens": self.identity_ens,
            "wallet": self.identity_handle,
            "nft_binding": {
                "token_uri": f"ens://{self.identity_ens}/soul",
                "soulprint": hashed,
            },
            "emotional_profile": {
                "obfuscated": obfuscated_profile,
                "visible_axes": list((emotional_profile or {}).keys()),
            },
            "streak_integrity": streak_integrity,
            "signature_persistence": signature_persistence,
            "mirror_echo_count": len(echoes),
        }
        self._last_hash = hashed
        return SoulPrint(hash=hashed, metadata=metadata, factors=factors)


__all__ = ["SoulPrint", "SoulPrintCore"]
