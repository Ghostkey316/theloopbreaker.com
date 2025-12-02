"""Sensation Layer modules for biometric resonance and haptic sync."""

from __future__ import annotations

import hashlib
import json
import statistics
from dataclasses import dataclass
from typing import Mapping, MutableMapping, Sequence

from drift_sync import DriftMetrics, DriftSync
from vaultfire.soul import GhostSealProtocol, SoulPrintCore


@dataclass(frozen=True)
class ResonanceSnapshot:
    """Immutable representation of a biometric resonance capture."""

    hash: str
    resonance: Mapping[str, float]
    sensation_score: float
    emotional_delta: Mapping[str, float]


class SenseWeaveCore:
    """Capture biometrics, normalize, and emit resonance scores."""

    def __init__(
        self,
        *,
        baseline_heart_rate: float = 72.0,
        baseline_gsr: float = 0.5,
        baseline_voice_tremor: float = 0.1,
    ) -> None:
        self.baseline = {
            "heart_rate": max(1e-3, float(baseline_heart_rate)),
            "galvanic_skin_response": max(1e-3, float(baseline_gsr)),
            "voice_tremor": max(1e-3, float(baseline_voice_tremor)),
        }

    def _normalize_biometrics(
        self,
        *,
        heart_rate: float,
        galvanic_skin_response: float,
        voice_tremor: float,
    ) -> Mapping[str, float]:
        normalized = {
            "heart_rate": round(max(0.0, float(heart_rate)) / self.baseline["heart_rate"], 3),
            "galvanic_skin_response": round(
                max(0.0, float(galvanic_skin_response)) / self.baseline["galvanic_skin_response"],
                3,
            ),
            "voice_tremor": round(max(0.0, float(voice_tremor)) / self.baseline["voice_tremor"], 3),
        }
        return normalized

    def _normalize_emotional_delta(self, emotional_delta: Mapping[str, float] | None) -> Mapping[str, float]:
        if not emotional_delta:
            return {}
        normalized: MutableMapping[str, float] = {}
        for key, value in emotional_delta.items():
            try:
                normalized[str(key)] = round(float(value), 4)
            except (TypeError, ValueError):
                continue
        return dict(normalized)

    def _hash_resonance(self, resonance: Mapping[str, float], emotional_delta: Mapping[str, float]) -> str:
        payload = json.dumps(
            {"resonance": resonance, "emotional_delta": emotional_delta},
            sort_keys=True,
            separators=(",", ":"),
        ).encode()
        return hashlib.sha256(payload).hexdigest()

    def _sensation_score(self, resonance: Mapping[str, float], emotional_delta: Mapping[str, float]) -> float:
        anchors = list(resonance.values()) + [abs(value) for value in emotional_delta.values()]
        if not anchors:
            return 0.0
        coherence = statistics.mean(anchors)
        volatility = statistics.pstdev(anchors) if len(anchors) > 1 else 0.0
        weighted = max(0.0, min(1.0, coherence * (1.0 - min(0.5, volatility))))
        return round(316.0 * weighted, 2)

    def capture(
        self,
        *,
        heart_rate: float,
        galvanic_skin_response: float,
        voice_tremor: float,
        emotional_delta: Mapping[str, float] | None = None,
    ) -> ResonanceSnapshot:
        """Capture biometrics and return a resonance snapshot."""

        normalized = self._normalize_biometrics(
            heart_rate=heart_rate,
            galvanic_skin_response=galvanic_skin_response,
            voice_tremor=voice_tremor,
        )
        delta = self._normalize_emotional_delta(emotional_delta)
        hashed = self._hash_resonance(normalized, delta)
        score = self._sensation_score(normalized, delta)
        return ResonanceSnapshot(
            hash=hashed,
            resonance=normalized,
            sensation_score=score,
            emotional_delta=delta,
        )


class EchoBridgeIntegration:
    """Sync sensation scores with DriftSync and SoulPrintCore."""

    def __init__(
        self,
        *,
        drift_sync: DriftSync | None = None,
        soul_core: SoulPrintCore | None = None,
    ) -> None:
        self.drift_sync = drift_sync or DriftSync()
        self.soul_core = soul_core or SoulPrintCore()

    def _mirror_echoes(self, snapshot: ResonanceSnapshot, prompt_anchor: str | None) -> Sequence[str]:
        echoes = [f"{key}:{value}" for key, value in snapshot.resonance.items()]
        if prompt_anchor:
            echoes.append(f"anchor:{prompt_anchor}")
        return tuple(echoes)

    def _prompt_weight(self, snapshot: ResonanceSnapshot) -> float:
        resonance_strength = statistics.mean(snapshot.resonance.values()) if snapshot.resonance else 0.0
        weighted = 0.6 * resonance_strength + 0.4 * (snapshot.sensation_score / 316.0)
        return round(min(1.0, max(0.0, weighted)), 3)

    def sync(
        self,
        user_id: str,
        snapshot: ResonanceSnapshot,
        *,
        prompt_anchor: str | None = None,
    ) -> Mapping[str, object]:
        """Send resonance data to DriftSync and SoulPrintCore."""

        sentiment_anchor = statistics.mean(snapshot.resonance.values()) if snapshot.resonance else 0.0
        drift_metrics = self.drift_sync.record_prompt(
            user_id,
            belief=snapshot.sensation_score / 316.0,
            sentiment=sentiment_anchor,
        )
        prompt_cadence = drift_metrics.prompt_cadence or [0.0]
        soulprint = self.soul_core.generate(
            prompt_cadence=prompt_cadence,
            mirror_echoes=self._mirror_echoes(snapshot, prompt_anchor),
            drift_patterns={
                "drift_score": drift_metrics.drift_score,
                "belief_streak": drift_metrics.belief_streak,
            },
            belief_deltas={"sensation": snapshot.sensation_score / 316.0},
            emotional_profile=snapshot.resonance,
        )
        prompt_weight = self._prompt_weight(snapshot)
        bonding_response = round(prompt_weight * drift_metrics.emotional_consistency, 3)
        return {
            "sensation_score": snapshot.sensation_score,
            "drift_metrics": drift_metrics,
            "soulprint": soulprint,
            "anchors": {
                "sentiment": sentiment_anchor,
                "prompt_weight": prompt_weight,
            },
            "bonding_response": bonding_response,
        }


class HapticSyncModule:
    """Simulate tactile responses and haptic prompt feedback."""

    def __init__(self, *, hardware_available: bool = False) -> None:
        self.hardware_available = hardware_available
        self.log: list[Mapping[str, object]] = []

    def _build_waveform(self, warmth: float, pulse: float, tremor: float) -> Mapping[str, object]:
        intensity = round(max(0.0, min(1.0, (warmth + pulse + tremor) / 3)), 3)
        pattern = [round(warmth * 0.5, 3), round(pulse * 0.75, 3), round(tremor, 3)]
        return {"intensity": intensity, "pattern": pattern, "steps": len(pattern)}

    def emit(
        self,
        *,
        warmth: float,
        pulse: float,
        tremor: float,
        anchor: str | None = None,
    ) -> Mapping[str, object]:
        """Send or simulate a tactile response."""

        waveform = self._build_waveform(warmth, pulse, tremor)
        status = "dispatched" if self.hardware_available else "simulated"
        effect = {
            "waveform": waveform,
            "anchor": anchor or "",  # maintain anchor chain for future XR use
            "hardware": self.hardware_available,
        }
        entry = {"status": status, "effect": effect}
        self.log.append(entry)
        if not self.hardware_available:
            entry["fallback"] = {
                "heat": round(waveform["intensity"] * 0.42, 3),
                "pulse_hint": waveform["pattern"],
            }
        return entry


class SensePulseCLI:
    """Export onchain-ready sensation snapshots with GhostSeal encryption."""

    def __init__(
        self,
        *,
        ghostseal: GhostSealProtocol | None = None,
        ens: str = "ghostkey316.eth",
    ) -> None:
        self.ghostseal = ghostseal or GhostSealProtocol()
        self.ens = ens

    def _trait_metadata(self, resonance: Mapping[str, float]) -> list[Mapping[str, object]]:
        traits = []
        for key, value in resonance.items():
            traits.append({
                "trait_type": f"{key}_sensitivity",
                "value": round(value, 3),
            })
        sensitivity_index = round(sum(resonance.values()) / max(len(resonance), 1), 3)
        traits.append({"trait_type": "sensitivity_index", "value": sensitivity_index})
        return traits

    def export_snapshot(
        self,
        *,
        user_id: str,
        snapshot: ResonanceSnapshot,
        soulprint_hash: str,
        stealth: bool = True,
    ) -> Mapping[str, object]:
        """Package sensation data for chain and encrypt emotional payloads."""

        metadata = {
            "ens": self.ens,
            "nft_traits": self._trait_metadata(snapshot.resonance),
            "sensation_score": snapshot.sensation_score,
        }
        payload = {
            "user": user_id,
            "resonance": {
                "hash": snapshot.hash,
                "emotional_delta": snapshot.emotional_delta,
            },
            "soulprint_hash": soulprint_hash,
            "metadata": metadata,
        }
        sealed = self.ghostseal.export_bundle(payload, stealth=stealth)
        return {"snapshot": payload, "sealed": sealed}


__all__ = [
    "EchoBridgeIntegration",
    "HapticSyncModule",
    "ResonanceSnapshot",
    "SensePulseCLI",
    "SenseWeaveCore",
]
