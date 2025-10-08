"""BeliefForge behavioural sync utilities."""

from __future__ import annotations

from dataclasses import dataclass
from statistics import mean
import hashlib
import logging
from typing import List, Mapping, MutableSequence

from cloak_pulse import CloakPulse


LOGGER = logging.getLogger("vaultfire.BeliefForge")


@dataclass
class BeliefSignal:
    """Represents a forged belief signal."""

    context: str
    confidence: float
    doubt: float
    trust: float
    entropy_signature: str
    moral_fingerprint: List[str]


class BeliefForge:
    """Link belief shifts to entropy shaping for the Vaultfire ethics core."""

    def __init__(
        self,
        *,
        cloak_pulse: CloakPulse | None = None,
        wallet_signature: str = "bpow20.cb.id",
        logger: logging.Logger | None = None,
    ) -> None:
        self._pulse = cloak_pulse or CloakPulse(lineage="BeliefForge")
        self._wallet_signature = wallet_signature
        self._logger = logger or LOGGER
        self._history: MutableSequence[BeliefSignal] = []

    def _moral_tags(self, confidence: float, doubt: float, trust: float) -> List[str]:
        tags: List[str] = []
        if confidence >= trust:
            tags.append("steadfast")
        if doubt > 0.4:
            tags.append("reflective")
        if trust > 0.7:
            tags.append("guardian")
        if not tags:
            tags.append("neutral")
        return tags

    def forge_signal(
        self,
        *,
        confidence: float,
        doubt: float,
        trust: float,
        context: str = "belief",
    ) -> Mapping[str, object]:
        """Return a forged belief signal with entropy enriched fingerprints."""

        frame = self._pulse.emit(context=context)
        entropy_signature = self._pulse.blend_signatures(
            [frame.signature, confidence, doubt, trust], context=self._wallet_signature
        )
        moral_fingerprint = self._moral_tags(confidence, doubt, trust)
        signal = BeliefSignal(
            context=context,
            confidence=float(confidence),
            doubt=float(doubt),
            trust=float(trust),
            entropy_signature=entropy_signature,
            moral_fingerprint=moral_fingerprint,
        )
        self._history.append(signal)
        self._logger.info(
            "Belief signal forged",
            extra={
                "context": context,
                "moral_fingerprint": moral_fingerprint,
                "wallet_signature": self._wallet_signature,
            },
        )
        return {
            "context": context,
            "confidence": signal.confidence,
            "doubt": signal.doubt,
            "trust": signal.trust,
            "entropy_signature": entropy_signature,
            "moral_fingerprint": list(moral_fingerprint),
            "heartbeat": frame.heartbeat,
        }

    def sync_ethics_engine(self) -> Mapping[str, object]:
        """Return a summary suitable for the Vaultfire ethics core."""

        if not self._history:
            return {
                "signals_processed": 0,
                "lineage_signature": self._lineage_signature(0.0),
                "averages": {"confidence": 0.0, "doubt": 0.0, "trust": 0.0},
            }
        confidence_values = [signal.confidence for signal in self._history]
        doubt_values = [signal.doubt for signal in self._history]
        trust_values = [signal.trust for signal in self._history]
        lineage_signature = self._lineage_signature(mean(confidence_values))
        return {
            "signals_processed": len(self._history),
            "lineage_signature": lineage_signature,
            "averages": {
                "confidence": mean(confidence_values),
                "doubt": mean(doubt_values),
                "trust": mean(trust_values),
            },
        }

    def audit_trail(self) -> Mapping[str, object]:
        """Return captured belief signals for audits."""

        return {
            "wallet_signature": self._wallet_signature,
            "signals": [
                {
                    "context": signal.context,
                    "confidence": signal.confidence,
                    "doubt": signal.doubt,
                    "trust": signal.trust,
                    "entropy_signature": signal.entropy_signature,
                    "moral_fingerprint": list(signal.moral_fingerprint),
                }
                for signal in self._history
            ],
        }

    def _lineage_signature(self, anchor: float) -> str:
        payload = f"{self._wallet_signature}:{anchor:.6f}".encode("utf-8")
        digest = hashlib.sha3_256(payload).hexdigest()
        return f"ghostkey316:{digest[:20]}"


__all__ = ["BeliefForge", "BeliefSignal"]

