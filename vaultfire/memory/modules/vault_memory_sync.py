"""Loop Memory Sync v1.0 utilities."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Mapping, MutableMapping, Sequence, TYPE_CHECKING

from vaultfire.validation.router import ValidatorExportRouter

if TYPE_CHECKING:  # pragma: no cover
    from vaultfire.loop.engine import AmplifierState, DripSchedule, LoopSnapshot


@dataclass(frozen=True)
class VaultLoopSnapshot:
    """Merged loop insight captured for recall."""

    epoch: str
    soulprint: str
    belief_score: float
    amplifier_tier: str
    amplifier_boost: float
    pop_score: float
    drip_yield: float
    echo_history: Sequence[Mapping[str, object]]
    validator_id: str

    def export(self) -> Mapping[str, object]:
        payload = asdict(self)
        payload["format"] = ".vaultloop"
        return payload


class VaultMemorySync:
    """Persist loop drops, validator proofs, and merged snapshots by SoulPrint."""

    def __init__(
        self,
        *,
        snapshot_dir: str | Path = "memory_snapshots/loop_sync",
        validator_export: ValidatorExportRouter | None = None,
    ) -> None:
        self.snapshot_dir = Path(snapshot_dir)
        self.snapshot_dir.mkdir(parents=True, exist_ok=True)
        self.validator_export = validator_export or ValidatorExportRouter()
        self._pulse_cache: MutableMapping[str, list["LoopSnapshot"]] = {}

    def observe_pulse(self, snapshot: "LoopSnapshot") -> None:
        """Cache loop echoes for downstream merged snapshots."""

        history = self._pulse_cache.setdefault(snapshot.persona_tag, [])
        history.append(snapshot)
        self._pulse_cache[snapshot.persona_tag] = history[-6:]

    def echo_history(self, persona_tag: str, *, limit: int = 5) -> Sequence["LoopSnapshot"]:
        history = self._pulse_cache.get(persona_tag, [])
        return tuple(history[-limit:])

    def _epoch_key(self, epoch: datetime) -> str:
        return epoch.strftime("%Y%m%d%H%M%S")

    def _echo_payload(self, snapshots: Sequence["LoopSnapshot"]) -> list[Mapping[str, object]]:
        payloads: list[Mapping[str, object]] = []
        for snapshot in snapshots:
            payloads.append(
                {
                    "timestamp": snapshot.timestamp.isoformat(),
                    "belief_hash": snapshot.report.belief_hash,
                    "validator_score": snapshot.report.validator_score,
                    "pop_score": getattr(snapshot, "pop_score", 0.0),
                    "amplifier_multiplier": getattr(snapshot, "amplifier_multiplier", 1.0),
                }
            )
        return payloads

    def _snapshot_path(self, soulprint: str, epoch: str) -> Path:
        target_dir = self.snapshot_dir / soulprint
        target_dir.mkdir(parents=True, exist_ok=True)
        return target_dir / f"{epoch}.json"

    def _vaultloop_snapshot(
        self,
        snapshot: "LoopSnapshot",
        amplifier: "AmplifierState",
        pop_score: float,
        schedule: "DripSchedule",
        echo_history: Sequence["LoopSnapshot"],
    ) -> VaultLoopSnapshot:
        return VaultLoopSnapshot(
            epoch=self._epoch_key(schedule.next_epoch),
            soulprint=snapshot.memory_event.soulprint.hash,
            belief_score=snapshot.report.validator_score,
            amplifier_tier=amplifier.tier,
            amplifier_boost=amplifier.multiplier,
            pop_score=pop_score,
            drip_yield=schedule.projected_yield_rate,
            echo_history=self._echo_payload(echo_history),
            validator_id=snapshot.report.continuity_hash,
        )

    def sync(
        self,
        snapshot: "LoopSnapshot",
        amplifier: "AmplifierState",
        pop_score: float,
        schedule: "DripSchedule",
        *,
        loopdrop_payload: Mapping[str, Any] | None = None,
        echo_history: Sequence["LoopSnapshot"] | None = None,
    ) -> Mapping[str, object]:
        epoch_key = self._epoch_key(schedule.next_epoch)
        vaultproof = self.validator_export.export_vaultproof(snapshot.report)
        loopdrop = loopdrop_payload or {
            "format": ".loopdrop",
            "persona_tag": snapshot.persona_tag,
            "projected_yield_rate": schedule.projected_yield_rate,
            "amplifier_boost": amplifier.multiplier,
            "amplifier_tier": amplifier.tier,
            "alignment_source": {
                "soulprint": snapshot.memory_event.soulprint.hash,
                "belief_hash": snapshot.report.belief_hash,
            },
            "next_drip_epoch": schedule.next_epoch.isoformat(),
            "pop_score": pop_score,
        }
        vaultloop = self._vaultloop_snapshot(
            snapshot,
            amplifier,
            pop_score,
            schedule,
            echo_history=echo_history or self.echo_history(snapshot.persona_tag),
        )
        payload = {
            "soulprint": snapshot.memory_event.soulprint.hash,
            "epoch": epoch_key,
            "validator_id": snapshot.report.continuity_hash,
            "loopdrop": loopdrop,
            "vaultproof": vaultproof,
            "vaultloop": vaultloop.export(),
        }
        path = self._snapshot_path(snapshot.memory_event.soulprint.hash, epoch_key)
        path.write_text(json.dumps(payload, indent=2, default=str))
        return payload

    def recall(
        self,
        soulprint: str | None = None,
        *,
        epoch: str | None = None,
        pop_tier: str | None = None,
        amplifier_boost: float | None = None,
        validator_id: str | None = None,
    ) -> list[Mapping[str, object]]:
        if soulprint:
            base_dir = self.snapshot_dir / soulprint
            if not base_dir.exists():
                return []
            paths = sorted(base_dir.glob("*.json"))
        else:
            paths = sorted(self.snapshot_dir.glob("**/*.json"))
        results: list[Mapping[str, object]] = []
        for path in paths:
            try:
                data = json.loads(path.read_text())
            except json.JSONDecodeError:
                continue
            if epoch and data.get("epoch") != epoch:
                continue
            vaultloop = data.get("vaultloop", {})
            amp = vaultloop.get("amplifier_boost") or vaultloop.get("amplifier", {}).get("multiplier")
            if pop_tier and vaultloop.get("amplifier_tier") != pop_tier:
                continue
            if amplifier_boost is not None:
                try:
                    if float(amp) < float(amplifier_boost):
                        continue
                except (TypeError, ValueError):
                    continue
            if validator_id and data.get("validator_id") != validator_id:
                continue
            results.append(data)
        return results


__all__ = ["VaultLoopSnapshot", "VaultMemorySync"]
