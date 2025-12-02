"""Vaultfire Loop Engine v1.0 primitives."""

from __future__ import annotations

import json
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Iterable, Mapping, MutableMapping, Sequence

from vaultfire.identity.layer import IdentityAnchor
from vaultfire.memory.modules.vault_memory_sync import VaultMemorySync
from vaultfire.memory.modules.memory_thread import MemoryEvent, TimePulseSync
from vaultfire.validation import ValidationReport, ValidatorCore

ValidationLayer = ValidatorCore


@dataclass(frozen=True)
class LoopSnapshot:
    """Snapshot representing a loop pulse and validation output."""

    persona_tag: str
    timestamp: datetime
    report: ValidationReport
    memory_event: MemoryEvent
    next_drip_epoch: datetime
    active: bool
    amplifier_multiplier: float = 1.0
    pop_score: float = 0.0


@dataclass(frozen=True)
class AmplifierState:
    """Represents the detected echo amplification tier."""

    multiplier: float
    tier: str
    synchronized: bool
    coherence_ratio: float


@dataclass(frozen=True)
class DripSchedule:
    """Scheduled drip details emitted by the router."""

    persona_tag: str
    projected_yield_rate: float
    next_epoch: datetime
    amplifier: AmplifierState
    alignment_source: Mapping[str, str]
    log_path: Path | None


class LoopPulseTracker:
    """Initiate time-based yield cycles tied to validation snapshots."""

    def __init__(
        self,
        *,
        validation_layer: ValidationLayer | None = None,
        epoch_span: timedelta | int = timedelta(minutes=15),
        activation_threshold: float = 0.7,
        time_source: callable | None = None,
        memory_sync: VaultMemorySync | None = None,
    ) -> None:
        if isinstance(epoch_span, int):
            epoch_span = timedelta(seconds=epoch_span)
        if epoch_span.total_seconds() <= 0:
            raise ValueError("epoch_span must be positive")
        self.validation_layer = validation_layer or ValidatorCore()
        self.epoch_span = epoch_span
        self.activation_threshold = activation_threshold
        self._history: list[LoopSnapshot] = []
        self._time_source = time_source or datetime.utcnow
        self.memory_sync = memory_sync

    @property
    def history(self) -> Sequence[LoopSnapshot]:
        return tuple(self._history)

    def pulse(
        self,
        persona_tag: str,
        *,
        anchor: IdentityAnchor,
        memory_event: MemoryEvent,
        ethics_vector: Mapping[str, float] | None = None,
        zk_identity_hash: str | None = None,
        continuity_hash: str | None = None,
    ) -> LoopSnapshot:
        timestamp = self._time_source()
        report = self.validation_layer.validate(
            persona_tag,
            anchor=anchor,
            memory_event=memory_event,
            ethics_vector=ethics_vector,
            zk_identity_hash=zk_identity_hash,
            continuity_hash=continuity_hash,
        )
        active = (
            report.validator_score >= self.activation_threshold
            and report.ethics_state == "aligned"
            and not report.drift_detected
        )
        snapshot = LoopSnapshot(
            persona_tag=persona_tag,
            timestamp=timestamp,
            report=report,
            memory_event=memory_event,
            next_drip_epoch=timestamp + self.epoch_span,
            active=active,
        )
        self._history.append(snapshot)
        if self.memory_sync:
            self.memory_sync.observe_pulse(snapshot)
        return snapshot


class BeliefEchoAmplifier:
    """Detect synchronized belief across nodes and apply multiplier logic."""

    def __init__(
        self,
        *,
        sync_window: int = 6,
        baseline: float = 1.0,
        boost_per_sync: float = 0.35,
        max_multiplier: float = 3.2,
    ) -> None:
        if sync_window <= 0:
            raise ValueError("sync_window must be positive")
        self.sync_window = sync_window
        self.baseline = baseline
        self.boost_per_sync = boost_per_sync
        self.max_multiplier = max_multiplier
        self._recent_hashes: list[str] = []

    def _tier(self, multiplier: float) -> str:
        if multiplier >= 2.5:
            return "prime"
        if multiplier >= 1.75:
            return "resonant"
        if multiplier >= 1.25:
            return "sync"
        return "idle"

    def apply(
        self,
        belief_hash: str,
        peers: Iterable[str] | None = None,
        *,
        validator_score: float = 0.0,
    ) -> AmplifierState:
        peers = list(peers or [])
        self._recent_hashes.append(belief_hash)
        self._recent_hashes = self._recent_hashes[-self.sync_window :]
        pool = peers + self._recent_hashes
        counts = Counter(pool)
        dominant_hash, dominant_count = counts.most_common(1)[0]
        coherence_ratio = dominant_count / max(len(pool), 1)
        synchronized = dominant_hash == belief_hash and dominant_count > 1
        multiplier = self.baseline + (coherence_ratio * self.boost_per_sync) + (validator_score * 0.5)
        multiplier = max(self.baseline, min(self.max_multiplier, round(multiplier, 3)))
        return AmplifierState(
            multiplier=multiplier,
            tier=self._tier(multiplier),
            synchronized=synchronized,
            coherence_ratio=round(coherence_ratio, 3),
        )


class PoPScoreModule:
    """Proof-of-Persistence scoring for aligned echo behavior."""

    def __init__(self, *, streak_bonus: float = 0.08, decay: float = 0.12) -> None:
        self.streak_bonus = streak_bonus
        self.decay = decay
        self._streaks: MutableMapping[str, float] = {}

    def _update_streak(self, persona_tag: str, active: bool) -> float:
        existing = self._streaks.get(persona_tag, 0.0)
        if active:
            updated = existing + self.streak_bonus
        else:
            updated = max(0.0, existing - self.decay)
        self._streaks[persona_tag] = round(updated, 4)
        return self._streaks[persona_tag]

    def score(
        self,
        snapshot: LoopSnapshot,
        amplifier: AmplifierState,
        *,
        active_echo: bool,
    ) -> float:
        streak = self._update_streak(snapshot.persona_tag, snapshot.active)
        base = snapshot.report.validator_score + (snapshot.report.ethics_alignment * 0.25)
        echo_bonus = amplifier.multiplier - 1 if active_echo else 0.0
        score = max(0.0, min(3.5, round(base + streak + echo_bonus, 3)))
        return score


class VaultfireDripRouter:
    """Schedule microdrops based on loop eligibility and validator score."""

    def __init__(
        self,
        *,
        test_mode: bool = True,
        base_rate: float = 0.316,
        log_dir: Path | str = "yield_reports",
        memory_sync: VaultMemorySync | None = None,
    ) -> None:
        self.test_mode = test_mode
        self.base_rate = base_rate
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self.memory_sync = memory_sync

    def _log_loopdrop(self, data: Mapping[str, object]) -> tuple[Path, Mapping[str, object]]:
        filename = f"{data['persona_tag']}-{int(datetime.utcnow().timestamp())}.loopdrop"
        path = self.log_dir / filename
        path.write_text(json.dumps(data, sort_keys=True, default=str))
        return path, data

    def schedule(
        self,
        snapshot: LoopSnapshot,
        amplifier: AmplifierState,
        pop_score: float,
        *,
        echo_history: Sequence[LoopSnapshot] | None = None,
    ) -> DripSchedule:
        aligned = snapshot.report.zk_consistent and not snapshot.report.drift_detected
        aligned = aligned and snapshot.report.ethics_state == "aligned"
        if not self.test_mode or not aligned:
            projected_rate = 0.0
        else:
            projected_rate = max(
                0.0,
                round(self.base_rate * snapshot.report.validator_score * amplifier.multiplier * (1 + pop_score / 10), 4),
            )
        alignment_source = {
            "soulprint": snapshot.memory_event.soulprint.hash,
            "belief_hash": snapshot.report.belief_hash,
        }
        loopdrop_payload = {
            "format": ".loopdrop",
            "persona_tag": snapshot.persona_tag,
            "projected_yield_rate": projected_rate,
            "amplifier_boost": amplifier.multiplier,
            "amplifier_tier": amplifier.tier,
            "alignment_source": alignment_source,
            "next_drip_epoch": snapshot.next_drip_epoch.isoformat(),
            "pop_score": pop_score,
        }
        log_path, loopdrop_payload = self._log_loopdrop(loopdrop_payload)
        schedule = DripSchedule(
            persona_tag=snapshot.persona_tag,
            projected_yield_rate=projected_rate,
            next_epoch=snapshot.next_drip_epoch,
            amplifier=amplifier,
            alignment_source=alignment_source,
            log_path=log_path,
        )

        if self.memory_sync:
            self.memory_sync.sync(
                snapshot,
                amplifier,
                pop_score,
                schedule,
                loopdrop_payload=loopdrop_payload,
                echo_history=echo_history or self.memory_sync.echo_history(snapshot.persona_tag),
            )

        return schedule


class VaultfireLoopEngine:
    """Top-level orchestrator for Vaultfire loop flow."""

    def __init__(
        self,
        *,
        tracker: LoopPulseTracker | None = None,
        amplifier: BeliefEchoAmplifier | None = None,
        pop_module: PoPScoreModule | None = None,
        drip_router: VaultfireDripRouter | None = None,
        time_pulse: TimePulseSync | None = None,
        memory_sync: VaultMemorySync | None = None,
    ) -> None:
        self.memory_sync = memory_sync or VaultMemorySync()
        self.tracker = tracker or LoopPulseTracker(memory_sync=self.memory_sync)
        if self.tracker.memory_sync is None:
            self.tracker.memory_sync = self.memory_sync
        self.amplifier = amplifier or BeliefEchoAmplifier()
        self.pop_module = pop_module or PoPScoreModule()
        self.drip_router = drip_router or VaultfireDripRouter(memory_sync=self.memory_sync)
        if self.drip_router.memory_sync is None:
            self.drip_router.memory_sync = self.memory_sync
        self.time_pulse = time_pulse or TimePulseSync()
        self._states: MutableMapping[str, tuple[LoopSnapshot, AmplifierState, float, DripSchedule]] = {}

    def process(
        self,
        persona_tag: str,
        *,
        anchor: IdentityAnchor,
        memory_event: MemoryEvent,
        peer_hashes: Iterable[str] | None = None,
        ethics_vector: Mapping[str, float] | None = None,
        zk_identity_hash: str | None = None,
        continuity_hash: str | None = None,
    ) -> DripSchedule:
        snapshot = self.tracker.pulse(
            persona_tag,
            anchor=anchor,
            memory_event=memory_event,
            ethics_vector=ethics_vector,
            zk_identity_hash=zk_identity_hash,
            continuity_hash=continuity_hash,
        )
        amplifier = self.amplifier.apply(
            snapshot.report.belief_hash,
            peer_hashes,
            validator_score=snapshot.report.validator_score,
        )
        pop_score = self.pop_module.score(snapshot, amplifier, active_echo=amplifier.synchronized)
        enriched_snapshot = LoopSnapshot(
            persona_tag=snapshot.persona_tag,
            timestamp=snapshot.timestamp,
            report=snapshot.report,
            memory_event=snapshot.memory_event,
            next_drip_epoch=snapshot.next_drip_epoch,
            active=snapshot.active,
            amplifier_multiplier=amplifier.multiplier,
            pop_score=pop_score,
        )
        schedule = self.drip_router.schedule(enriched_snapshot, amplifier, pop_score)
        self._states[persona_tag] = (enriched_snapshot, amplifier, pop_score, schedule)
        return schedule

    def status(self, persona_tag: str) -> tuple[LoopSnapshot, AmplifierState, float, DripSchedule] | None:
        return self._states.get(persona_tag)


__all__ = [
    "AmplifierState",
    "BeliefEchoAmplifier",
    "DripSchedule",
    "LoopPulseTracker",
    "LoopSnapshot",
    "PoPScoreModule",
    "VaultfireDripRouter",
    "VaultfireLoopEngine",
]
