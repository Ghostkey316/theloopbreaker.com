"""Vaultdrip Router v1.0.

Routes PoP upgrade events into drip reward logic with belief metadata.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Mapping, MutableMapping

from vaultfire.pop_engine import PoPEngine, PoPScoreResult, PoPUpgradeEvent

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class RoutedDrip:
    """Structured payload emitted when a drip is routed."""

    validator_id: str
    tier: int
    status: str
    metadata: Mapping[str, object]
    release: Mapping[str, object] | None
    bonus_flagged: bool
    reason: str | None = None

    def asdict(self) -> MutableMapping[str, object]:
        payload: MutableMapping[str, object] = {
            "validator_id": self.validator_id,
            "tier": self.tier,
            "status": self.status,
            "metadata": dict(self.metadata),
            "release": dict(self.release or {}),
            "bonus_flagged": self.bonus_flagged,
        }
        if self.reason:
            payload["reason"] = self.reason
        return payload


class VaultdripRouter:
    """Listen for PoP upgrades and coordinate drip releases."""

    def __init__(
        self,
        *,
        loyalty_threshold: int = 3,
        codex_registry_path: Path | None = None,
    ) -> None:
        self.loyalty_threshold = max(1, loyalty_threshold)
        self.flagged_validators: set[str] = set()
        self.routed_events: list[RoutedDrip] = []
        self._codex_registry_path = codex_registry_path or Path(
            "codex/VAULTFIRE_CLI_LEDGER.jsonl"
        )
        # Metrics tracking
        self.metrics = {
            "routes_attempted": 0,
            "routes_succeeded": 0,
            "routes_rejected": 0,
            "routes_ineligible": 0,
            "bonuses_flagged": 0,
        }
        self._register_with_codex_registry()

    def attach_to(self, engine: PoPEngine) -> None:
        """Attach the router to a PoP engine using a listener callback."""

        engine.register_upgrade_listener(self._on_upgrade)

    def _on_upgrade(
        self, event: PoPUpgradeEvent, result: PoPScoreResult
    ) -> None:  # pragma: no cover - passthrough thin wrapper
        self.route_reward(result)

    def _register_with_codex_registry(self) -> None:
        registry_path = self._codex_registry_path
        try:
            registry_path.parent.mkdir(parents=True, exist_ok=True)
            entry = {
                "event": "vaultdrip-router-init",
                "timestamp": datetime.utcnow().isoformat(),
                "component": "VaultdripRouter",
                "version": "1.0",
            }
            with registry_path.open("a", encoding="utf-8") as handle:
                handle.write(json.dumps(entry, sort_keys=True) + "\n")
        except OSError:
            # Codex registry is optional; failure to write should not block routing.
            return

    def route_reward(self, score_result: PoPScoreResult) -> RoutedDrip:
        """Route a PoP upgrade event into drip and bonus flows."""

        self.metrics["routes_attempted"] += 1
        metadata = self._build_metadata(score_result)

        if self._is_spoofed(score_result):
            self.metrics["routes_rejected"] += 1
            logger.warning(
                f"Rejected spoofed upgrade for validator {score_result.validator_id} "
                f"(tier: {score_result.tier})"
            )
            routed = RoutedDrip(
                validator_id=score_result.validator_id,
                tier=score_result.tier,
                status="rejected",
                metadata=metadata,
                release=None,
                bonus_flagged=False,
                reason="spoofed-event",
            )
            self.routed_events.append(routed)
            return routed

        if not self._is_eligible(score_result):
            self.metrics["routes_ineligible"] += 1
            routed = RoutedDrip(
                validator_id=score_result.validator_id,
                tier=score_result.tier,
                status="ineligible",
                metadata=metadata,
                release=None,
                bonus_flagged=False,
                reason="no-upgrade",
            )
            self.routed_events.append(routed)
            return routed

        release = self._release_drip(score_result, metadata)
        bonus_flagged = self._flag_high_loyalty(score_result)
        if bonus_flagged:
            self.metrics["bonuses_flagged"] += 1

        self.metrics["routes_succeeded"] += 1
        logger.info(
            f"Routed reward for validator {score_result.validator_id}: "
            f"tier {score_result.tier}, amount {release['amount']}, bonus={bonus_flagged}"
        )
        routed = RoutedDrip(
            validator_id=score_result.validator_id,
            tier=score_result.tier,
            status="routed",
            metadata=metadata,
            release=release,
            bonus_flagged=bonus_flagged,
            reason=None,
        )
        self.routed_events.append(routed)
        return routed

    def _is_spoofed(self, score_result: PoPScoreResult) -> bool:
        event = score_result.upgrade_event
        if event is None:
            return False
        return event.validator_id != score_result.validator_id or event.new_tier != score_result.tier

    def _is_eligible(self, score_result: PoPScoreResult) -> bool:
        return score_result.upgrade_event is not None and score_result.tier > 0

    def _build_metadata(self, score_result: PoPScoreResult) -> Mapping[str, object]:
        loyalty_index = round(min(1.0, (score_result.tier + 1) / 4), 3)
        return {
            "belief_score": round(score_result.score, 3),
            "validator_loyalty_index": loyalty_index,
            "timestamp": score_result.timestamp.isoformat(),
            "vaultloop_hash": score_result.vaultloop_hash,
        }

    def _release_drip(
        self, score_result: PoPScoreResult, metadata: Mapping[str, object]
    ) -> Mapping[str, object]:
        amount = self._projected_yield(score_result.tier)
        release = {
            "stream": "passive",
            "tier": score_result.tier,
            "amount": amount,
            "metadata": dict(metadata),
        }
        return release

    def _projected_yield(self, tier: int) -> float:
        table = {0: 0.0, 1: 1.0, 2: 1.5, 3: 2.5}
        return table.get(tier, max(table.values()))

    def _flag_high_loyalty(self, score_result: PoPScoreResult) -> bool:
        if score_result.tier >= self.loyalty_threshold:
            self.flagged_validators.add(score_result.validator_id)
            return True
        return False


__all__ = ["VaultdripRouter", "RoutedDrip"]
