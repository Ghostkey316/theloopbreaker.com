"""Pilot mode sandbox utilities for isolated simulations."""

from __future__ import annotations

import hashlib
import json
import statistics
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, Iterable, List, Mapping, MutableMapping, Optional

from . import storage
from .privacy import PilotPrivacyLedger

__all__ = ["SandboxResult", "YieldSandbox"]


@dataclass
class SandboxResult:
    """Result of an isolated yield simulation."""

    session_id: str
    partner_tag: str
    wallet_fingerprint: str
    strategy_id: str
    sample_size: int
    projected_apr: float
    confidence_interval: float
    engagement_score: float
    generated_at: datetime
    metadata: MutableMapping[str, object]

    def export(self) -> Dict[str, object]:
        return {
            "session_id": self.session_id,
            "partner_tag": self.partner_tag,
            "wallet_fingerprint": self.wallet_fingerprint,
            "strategy_id": self.strategy_id,
            "sample_size": self.sample_size,
            "projected_apr": round(self.projected_apr, 5),
            "confidence_interval": round(self.confidence_interval, 5),
            "engagement_score": round(self.engagement_score, 5),
            "generated_at": self.generated_at.isoformat(),
            "metadata": dict(self.metadata),
        }


class YieldSandbox:
    """Creates isolated simulations and logs pilot activity."""

    def __init__(
        self,
        *,
        yield_log_path=None,
        behavior_log_path=None,
        secret_salt: str | None = None,
        ledger: Optional[PilotPrivacyLedger] = None,
    ) -> None:
        self._yield_log_path = yield_log_path or storage.YIELD_LOG_PATH
        self._behavior_log_path = behavior_log_path or storage.BEHAVIOR_LOG_PATH
        self._secret_salt = secret_salt or uuid.uuid4().hex
        self._ledger = ledger
        self._simulate_real_load = False
        self._load_multiplier = 1.0
        self._load_profile: MutableMapping[str, object] = {}

    def attach_ledger(self, ledger: PilotPrivacyLedger) -> None:
        self._ledger = ledger

    def set_real_load_simulation(
        self,
        enabled: bool,
        *,
        load_multiplier: float = 1.0,
        profile: Optional[Mapping[str, object]] = None,
    ) -> None:
        self._simulate_real_load = bool(enabled)
        self._load_multiplier = max(load_multiplier, 0.1)
        self._load_profile = dict(profile or {})

    def _fingerprint_wallet(self, wallet_id: str) -> str:
        if not wallet_id or not wallet_id.strip():
            raise ValueError("wallet_id must be provided")
        digest = hashlib.sha256(f"{wallet_id.lower()}::{self._secret_salt}".encode("utf-8")).hexdigest()
        return digest[:16]

    def _record(self, path, payload: Mapping[str, object]) -> None:
        storage.append_jsonl(path, payload)

    def simulate_yield(
        self,
        *,
        partner_tag: str,
        session_id: str,
        wallet_id: str,
        strategy_id: str,
        sample_size: int = 100,
        telemetry_flags: Optional[Mapping[str, object]] = None,
    ) -> SandboxResult:
        if sample_size <= 0:
            raise ValueError("sample_size must be positive")
        wallet_fingerprint = self._fingerprint_wallet(wallet_id)
        applied_sample_size = sample_size
        if self._simulate_real_load:
            applied_sample_size = max(1, int(sample_size * self._load_multiplier))
        seed_material = (
            f"{partner_tag}:{session_id}:{strategy_id}:{wallet_fingerprint}:{applied_sample_size}"
        )
        digest = hashlib.sha256(seed_material.encode("utf-8")).digest()
        apr = (int.from_bytes(digest[:2], "big") % 5000) / 100  # up to 50% APR in sandbox
        deviation = (int.from_bytes(digest[2:4], "big") % 250) / 100  # +/- 2.5 spread
        engagement_baseline = statistics.fmean([(value % 100) / 100 for value in digest[:8]])
        engagement_score = min(1.0, max(0.0, engagement_baseline))
        result = SandboxResult(
            session_id=session_id,
            partner_tag=partner_tag,
            wallet_fingerprint=wallet_fingerprint,
            strategy_id=strategy_id,
            sample_size=applied_sample_size,
            projected_apr=apr,
            confidence_interval=deviation,
            engagement_score=engagement_score,
            generated_at=datetime.now(timezone.utc),
            metadata=dict(telemetry_flags or {}),
        )
        payload = result.export()
        if self._ledger is None:
            self._record(self._yield_log_path, payload)
        else:
            metadata = dict(payload.get("metadata", {}))
            metadata.update(
                {
                    "load_simulation_enabled": self._simulate_real_load,
                    "load_multiplier": self._load_multiplier,
                }
            )
            if self._load_profile:
                metadata["load_profile"] = dict(self._load_profile)
            self._ledger.record_reference(
                partner_tag=partner_tag,
                reference_type="yield",
                payload=payload,
                metadata=metadata,
            )
        return result

    def log_behavior(
        self,
        *,
        partner_tag: str,
        session_id: str,
        wallet_id: str,
        event_type: str,
        payload: Mapping[str, object],
    ) -> None:
        if not event_type or not event_type.strip():
            raise ValueError("event_type must be provided")
        record = {
            "event_type": event_type.strip(),
            "partner_tag": partner_tag,
            "session_id": session_id,
            "wallet_fingerprint": self._fingerprint_wallet(wallet_id),
            "payload": dict(payload),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        if self._ledger is None:
            self._record(self._behavior_log_path, record)
        else:
            metadata = {"event_type": record["event_type"]}
            if self._simulate_real_load:
                metadata["load_simulation_enabled"] = True
            self._ledger.record_reference(
                partner_tag=partner_tag,
                reference_type="behavior",
                payload=record,
                metadata=metadata,
            )

    def summarize_behavior(self, *, limit: int = 10) -> Iterable[Dict[str, object]]:
        if limit <= 0:
            raise ValueError("limit must be positive")
        path = self._behavior_log_path
        if not path.exists():
            return []
        lines = path.read_text(encoding="utf-8").splitlines()[-limit:]
        summary: List[Dict[str, object]] = []
        for line in lines:
            try:
                summary.append(json.loads(line))
            except json.JSONDecodeError:
                continue
        return summary
