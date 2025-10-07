from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
import uuid
from typing import Dict, Iterable, Mapping, MutableMapping, Optional, Sequence

from vaultfire.braider import Threadlinker
from vaultfire.context_matrix import BeliefAnchor
from vaultfire.mission import MissionLedger
from vaultfire.protocol.ghostkey_ai import GhostkeyAINetwork
from vaultfire.quantum.hashmirror import QuantumHashMirror
from vaultfire.yield_config import RetroYieldConfig

__all__ = [
    "VaultSnapshot",
    "ActionRecord",
    "RetroReward",
    "ScheduledDrop",
    "DropResult",
    "YieldAnchor",
    "BehaviorVault",
    "LoopScanner",
    "TokenDropper",
]


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class VaultSnapshot:
    """Immutable view of a behavior profile after registration."""

    wallet: str
    loyalty_streak: int
    ghostkey_confirmed: bool
    behavior_multiplier: float
    unlock_path: str
    ledger_reference: str
    recorded_at: datetime
    ghostkey_confirmations: int


@dataclass(frozen=True)
class ActionRecord:
    """Retained details about a belief action bound to RetroYield."""

    wallet: str
    action: str
    identity_tag: str
    ledger_reference: str
    recorded_at: datetime
    loyalty_streak: int
    ghostkey_confirmed: bool
    behavior_multiplier: float
    unlock_path: str
    weight: float


@dataclass(frozen=True)
class RetroReward:
    """Aggregated retro reward assigned to a wallet within an epoch."""

    wallet: str
    epoch_index: int
    amount: float
    actions: Sequence[str]
    loyalty_streak: int
    multiplier: float
    ghostkey_confirmed: bool
    ledger_references: Sequence[str]
    unlock_path: str


@dataclass
class ScheduledDrop:
    """Internal representation of a scheduled yield drop."""

    stream_id: str
    wallet: str
    amount: float
    unlock_at: datetime
    epoch_index: int
    multiplier: float
    actions: Sequence[str]
    metadata: Mapping[str, object]
    test_mode: bool = False
    paused: bool = False
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    ledger_reference: str | None = None


@dataclass(frozen=True)
class DropResult:
    """Outcome of a disbursed RetroYield drop."""

    stream_id: str
    wallet: str
    amount: float
    released_at: datetime
    ledger_reference: str | None
    metadata: Mapping[str, object]
    test_mode: bool


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _coerce_wallet(wallet: str) -> str:
    value = str(wallet).strip()
    if not value:
        raise ValueError("wallet identifier cannot be empty")
    return value


def _coerce_datetime(value: datetime | None) -> datetime:
    if value is None:
        return _utcnow()
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
    raise TypeError("expected datetime or None")


def _parse_datetime(value: str | datetime | None) -> datetime:
    if value is None:
        return _utcnow()
    if isinstance(value, datetime):
        return _coerce_datetime(value)
    try:
        return datetime.fromisoformat(str(value)).astimezone(timezone.utc)
    except ValueError as exc:  # pragma: no cover - defensive
        raise ValueError(f"invalid timestamp: {value}") from exc


# ---------------------------------------------------------------------------
# Behavior Vault
# ---------------------------------------------------------------------------


@dataclass
class _BehaviorProfile:
    wallet: str
    loyalty_streak: int = 0
    behavior_multiplier: float = 1.0
    ghostkey_confirmed: bool = False
    unlock_path: str = ""
    last_action_at: datetime | None = None
    ledger_reference: str | None = None
    ghostkey_confirmations: int = 0


class BehaviorVault:
    """Track loyalty streaks, multipliers and Ghostkey confirmations."""

    def __init__(
        self,
        *,
        config: RetroYieldConfig | None = None,
        ledger: MissionLedger | None = None,
        ghostkey_network: GhostkeyAINetwork | None = None,
    ) -> None:
        self._config = config or RetroYieldConfig()
        self._ledger = ledger or MissionLedger.default(component="vaultfire.retroyield")
        self._ghostkey = ghostkey_network
        self._profiles: MutableMapping[str, _BehaviorProfile] = {}
        self._rehydrate()

    # ------------------------------------------------------------------
    # Internal state
    # ------------------------------------------------------------------
    def _rehydrate(self) -> None:
        for record in self._ledger.iter(category="retroyield.behavior"):
            payload = record.payload
            wallet = payload.get("wallet")
            if not wallet:
                continue
            profile = self._profiles.setdefault(str(wallet), _BehaviorProfile(wallet=str(wallet)))
            profile.loyalty_streak = int(payload.get("loyalty_streak", profile.loyalty_streak))
            profile.behavior_multiplier = float(
                payload.get("behavior_multiplier", profile.behavior_multiplier)
            )
            profile.ghostkey_confirmed = bool(payload.get("ghostkey_confirmed", profile.ghostkey_confirmed))
            profile.unlock_path = str(payload.get("unlock_path", profile.unlock_path))
            profile.last_action_at = _parse_datetime(payload.get("timestamp"))
            profile.ledger_reference = record.record_id
            profile.ghostkey_confirmations = int(payload.get("ghostkey_confirmations", 0))

    def _ghostkey_status(self, wallet: str) -> bool:
        if self._ghostkey is None:
            return False
        node = self._ghostkey.get_node(wallet)
        return node is not None and node.status != "decommissioned"

    def _profile(self, wallet: str) -> _BehaviorProfile:
        return self._profiles.setdefault(wallet, _BehaviorProfile(wallet=wallet))

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def register_activity(
        self,
        wallet: str,
        *,
        timestamp: datetime | None = None,
        tags: Iterable[str] | None = None,
        ghostkey_confirmed: bool | None = None,
    ) -> VaultSnapshot:
        """Register a loyalty action and return the updated snapshot."""

        wallet = _coerce_wallet(wallet)
        moment = _coerce_datetime(timestamp)
        profile = self._profile(wallet)
        streak = self._config.update_streak(profile.last_action_at, moment, profile.loyalty_streak)
        ghost_confirmed = ghostkey_confirmed
        if ghost_confirmed is None:
            ghost_confirmed = self._ghostkey_status(wallet)
        multiplier = self._config.behavior_multiplier(streak)
        unlock_path = self._config.base_unlock_path(wallet, streak)
        confirmations = profile.ghostkey_confirmations
        if ghost_confirmed and not profile.ghostkey_confirmed:
            confirmations += 1
        payload: Dict[str, object] = {
            "wallet": wallet,
            "timestamp": moment.isoformat(),
            "loyalty_streak": streak,
            "ghostkey_confirmed": ghost_confirmed,
            "behavior_multiplier": multiplier,
            "unlock_path": unlock_path,
            "ghostkey_confirmations": confirmations,
            "tags": list(str(tag) for tag in (tags or ())),
        }
        metadata = self._ledger.metadata_template(
            partner_id=wallet,
            narrative="RetroYield behavior update",
            tags=("retroyield", "behavior"),
            extra={"loyalty_streak": streak},
        )
        record = self._ledger.append("retroyield.behavior", payload, metadata)
        profile.loyalty_streak = streak
        profile.behavior_multiplier = multiplier
        profile.ghostkey_confirmed = ghost_confirmed
        profile.unlock_path = unlock_path
        profile.last_action_at = moment
        profile.ledger_reference = record.record_id
        profile.ghostkey_confirmations = confirmations
        snapshot = VaultSnapshot(
            wallet=wallet,
            loyalty_streak=streak,
            ghostkey_confirmed=ghost_confirmed,
            behavior_multiplier=multiplier,
            unlock_path=unlock_path,
            ledger_reference=record.record_id,
            recorded_at=moment,
            ghostkey_confirmations=confirmations,
        )
        return snapshot

    def snapshot(self, wallet: str) -> VaultSnapshot:
        wallet = _coerce_wallet(wallet)
        profile = self._profiles.get(wallet)
        if not profile or profile.ledger_reference is None:
            raise KeyError("wallet not registered in behavior vault")
        return VaultSnapshot(
            wallet=wallet,
            loyalty_streak=profile.loyalty_streak,
            ghostkey_confirmed=profile.ghostkey_confirmed,
            behavior_multiplier=profile.behavior_multiplier,
            unlock_path=profile.unlock_path,
            ledger_reference=profile.ledger_reference or "",
            recorded_at=profile.last_action_at or _utcnow(),
            ghostkey_confirmations=profile.ghostkey_confirmations,
        )

    def try_snapshot(self, wallet: str) -> VaultSnapshot | None:
        wallet = _coerce_wallet(wallet)
        try:
            return self.snapshot(wallet)
        except KeyError:
            return None

    def apply_multiplier(self, wallet: str, amount: float) -> float:
        snapshot = self.snapshot(wallet)
        return round(amount * snapshot.behavior_multiplier, 6)

    def all_wallets(self) -> Sequence[str]:
        return tuple(sorted(self._profiles))


# ---------------------------------------------------------------------------
# Yield Anchor
# ---------------------------------------------------------------------------


class YieldAnchor:
    """Bind belief actions to payout chains and Mirrorframe tags."""

    def __init__(
        self,
        *,
        behavior_vault: BehaviorVault,
        config: RetroYieldConfig | None = None,
        ledger: MissionLedger | None = None,
        hash_mirror: QuantumHashMirror | None = None,
        threadlinker: Threadlinker | None = None,
    ) -> None:
        self._behavior_vault = behavior_vault
        self._config = config or RetroYieldConfig()
        self._ledger = ledger or MissionLedger.default(component="vaultfire.retroyield")
        self._hash_mirror = hash_mirror or QuantumHashMirror()
        self._threadlinker = threadlinker or Threadlinker(
            anchor=BeliefAnchor(log="retro-yield"),
            span="retro",
        )

    @property
    def hash_mirror(self) -> QuantumHashMirror:
        return self._hash_mirror

    def record_action(
        self,
        wallet: str,
        action: str,
        *,
        tags: Iterable[str] | None = None,
        weight: float = 1.0,
        timestamp: datetime | None = None,
        ghostkey_confirmed: bool | None = None,
        metadata: Mapping[str, object] | None = None,
    ) -> ActionRecord:
        """Record a belief action and return the ledger-backed record."""

        wallet = _coerce_wallet(wallet)
        moment = _coerce_datetime(timestamp)
        snapshot = self._behavior_vault.register_activity(
            wallet,
            timestamp=moment,
            tags=tags,
            ghostkey_confirmed=ghostkey_confirmed,
        )
        thread_payload = self._threadlinker.stitch(
            statement=action,
            weight=weight,
            tags=tags,
            context={
                "wallet": wallet,
                "loyalty_streak": snapshot.loyalty_streak,
                "unlock_path": snapshot.unlock_path,
            },
        )
        identity_tag = self._hash_mirror.imprint(
            wallet,
            interaction_id=thread_payload["entry"]["logged_at"],
            branch=f"epoch-{self._config.epoch_for(moment).index}",
            payload={
                "action": action,
                "loyalty_streak": snapshot.loyalty_streak,
                "multiplier": snapshot.behavior_multiplier,
            },
        )
        payload: Dict[str, object] = {
            "wallet": wallet,
            "action": action,
            "weight": float(weight),
            "tags": list(str(tag) for tag in (tags or ())),
            "thread": thread_payload,
            "identity_tag": identity_tag,
            "timestamp": moment.isoformat(),
            "loyalty_streak": snapshot.loyalty_streak,
            "ghostkey_confirmed": snapshot.ghostkey_confirmed,
            "behavior_multiplier": snapshot.behavior_multiplier,
            "unlock_path": snapshot.unlock_path,
            "base_amount": self._config.base_reward,
            "behavior_ledger_reference": snapshot.ledger_reference,
        }
        if metadata:
            payload["metadata"] = dict(metadata)
        ledger_metadata = self._ledger.metadata_template(
            partner_id=wallet,
            narrative=f"Bind action {action}",
            tags=("retroyield", "action"),
            extra={"ghostkey_confirmations": snapshot.ghostkey_confirmations},
        )
        record = self._ledger.append("retroyield.action", payload, ledger_metadata)
        return ActionRecord(
            wallet=wallet,
            action=action,
            identity_tag=identity_tag,
            ledger_reference=record.record_id,
            recorded_at=moment,
            loyalty_streak=snapshot.loyalty_streak,
            ghostkey_confirmed=snapshot.ghostkey_confirmed,
            behavior_multiplier=snapshot.behavior_multiplier,
            unlock_path=snapshot.unlock_path,
            weight=float(weight),
        )


# ---------------------------------------------------------------------------
# Loop Scanner
# ---------------------------------------------------------------------------


class LoopScanner:
    """Audit historical activity to assign retro rewards."""

    def __init__(
        self,
        *,
        behavior_vault: BehaviorVault,
        config: RetroYieldConfig | None = None,
        ledger: MissionLedger | None = None,
        hash_mirror: QuantumHashMirror | None = None,
    ) -> None:
        self._behavior_vault = behavior_vault
        self._config = config or RetroYieldConfig()
        self._ledger = ledger or MissionLedger.default(component="vaultfire.retroyield")
        self._hash_mirror = hash_mirror or QuantumHashMirror()

    def scan(
        self,
        *,
        wallet: str | None = None,
        since: datetime | None = None,
        limit: int | None = None,
    ) -> Sequence[RetroReward]:
        """Return retro rewards for the provided filters."""

        since_dt = _coerce_datetime(since) if since else None
        aggregated: Dict[tuple[str, int], Dict[str, object]] = {}
        processed = 0
        for record in self._ledger.iter(category="retroyield.action"):
            payload = record.payload
            record_wallet = str(payload.get("wallet", "")).strip()
            if not record_wallet:
                continue
            if wallet and record_wallet.lower() != wallet.lower():
                continue
            recorded_at = _parse_datetime(payload.get("timestamp"))
            if since_dt and recorded_at < since_dt:
                continue
            if limit is not None and processed >= limit:
                break
            identity_tag = str(payload.get("identity_tag", ""))
            if not identity_tag or not self._hash_mirror.verify(identity_tag, record_wallet):
                continue
            epoch = self._config.epoch_for(recorded_at)
            key = (record_wallet, epoch.index)
            bucket = aggregated.setdefault(
                key,
                {
                    "wallet": record_wallet,
                    "epoch": epoch,
                    "amount": 0.0,
                    "actions": [],
                    "loyalty_streak": 0,
                    "multiplier": 1.0,
                    "ghostkey_confirmed": False,
                    "ledger_references": [],
                    "unlock_path": str(payload.get("unlock_path", "")),
                },
            )
            amount = self._config.scale_reward(
                loyalty_streak=int(payload.get("loyalty_streak", 0)),
                behavior_multiplier=float(payload.get("behavior_multiplier", 1.0)),
                ghostkey_confirmed=bool(payload.get("ghostkey_confirmed", False)),
                issued_at=recorded_at,
                weight=float(payload.get("weight", 1.0)),
            )
            bucket["amount"] = round(bucket["amount"] + amount, 6)
            bucket["actions"].append(str(payload.get("action")))
            bucket["loyalty_streak"] = max(
                bucket["loyalty_streak"], int(payload.get("loyalty_streak", 0))
            )
            bucket["multiplier"] = float(payload.get("behavior_multiplier", 1.0))
            bucket["ghostkey_confirmed"] = bucket["ghostkey_confirmed"] or bool(
                payload.get("ghostkey_confirmed", False)
            )
            bucket["ledger_references"].append(record.record_id)
            if not bucket["unlock_path"]:
                bucket["unlock_path"] = str(payload.get("unlock_path", ""))
            processed += 1
        rewards: list[RetroReward] = []
        for (_, epoch_index), bucket in sorted(aggregated.items(), key=lambda item: (item[0][0], item[0][1])):
            rewards.append(
                RetroReward(
                    wallet=bucket["wallet"],
                    epoch_index=epoch_index,
                    amount=round(bucket["amount"], 6),
                    actions=tuple(bucket["actions"]),
                    loyalty_streak=int(bucket["loyalty_streak"]),
                    multiplier=float(bucket["multiplier"]),
                    ghostkey_confirmed=bool(bucket["ghostkey_confirmed"]),
                    ledger_references=tuple(bucket["ledger_references"]),
                    unlock_path=str(bucket["unlock_path"]),
                )
            )
        return tuple(rewards)


# ---------------------------------------------------------------------------
# Token Dropper
# ---------------------------------------------------------------------------


class TokenDropper:
    """Handle scheduled yield disbursements."""

    TEST_BACKOFF = timedelta(minutes=15)

    def __init__(
        self,
        *,
        config: RetroYieldConfig | None = None,
        ledger: MissionLedger | None = None,
        hash_mirror: QuantumHashMirror | None = None,
    ) -> None:
        self._config = config or RetroYieldConfig()
        self._ledger = ledger or MissionLedger.default(component="vaultfire.retroyield")
        self._hash_mirror = hash_mirror or QuantumHashMirror()
        self._scheduled: MutableMapping[str, ScheduledDrop] = {}
        self._rehydrate()

    # ------------------------------------------------------------------
    # Rehydration
    # ------------------------------------------------------------------
    def _rehydrate(self) -> None:
        scheduled: MutableMapping[str, ScheduledDrop] = {}
        for record in self._ledger.iter(category="retroyield.drop.scheduled"):
            payload = record.payload
            stream_id = str(payload.get("stream_id", ""))
            if not stream_id:
                continue
            drop = ScheduledDrop(
                stream_id=stream_id,
                wallet=str(payload.get("wallet", "")),
                amount=float(payload.get("amount", 0.0)),
                unlock_at=_parse_datetime(payload.get("unlock_at")),
                epoch_index=int(payload.get("epoch_index", 0)),
                multiplier=float(payload.get("multiplier", 1.0)),
                actions=tuple(payload.get("actions", ())),
                metadata=dict(payload.get("metadata", {})),
                test_mode=bool(payload.get("test_mode", False)),
                ledger_reference=record.record_id,
            )
            scheduled[stream_id] = drop
        for record in self._ledger.iter(category="retroyield.drop.override"):
            payload = record.payload
            stream_id = str(payload.get("stream_id", ""))
            drop = scheduled.get(stream_id)
            if not drop:
                continue
            if payload.get("unlock_at"):
                drop.unlock_at = _parse_datetime(payload.get("unlock_at"))
            if payload.get("amount") is not None:
                drop.amount = float(payload.get("amount"))
        for record in self._ledger.iter(category="retroyield.drop.paused"):
            payload = record.payload
            stream_id = str(payload.get("stream_id", ""))
            if stream_id in scheduled:
                scheduled[stream_id].paused = True
        for record in self._ledger.iter(category="retroyield.drop.resumed"):
            payload = record.payload
            stream_id = str(payload.get("stream_id", ""))
            if stream_id in scheduled:
                scheduled[stream_id].paused = False
        for record in self._ledger.iter(category="retroyield.drop.executed"):
            payload = record.payload
            stream_id = str(payload.get("stream_id", ""))
            scheduled.pop(stream_id, None)
        self._scheduled = scheduled

    # ------------------------------------------------------------------
    # Scheduling helpers
    # ------------------------------------------------------------------
    def schedule(
        self,
        wallet: str,
        amount: float,
        *,
        unlock_at: datetime,
        epoch_index: int,
        actions: Sequence[str] | None = None,
        metadata: Mapping[str, object] | None = None,
        multiplier: float | None = None,
        test_mode: bool = False,
    ) -> ScheduledDrop:
        wallet = _coerce_wallet(wallet)
        unlock_at = _coerce_datetime(unlock_at)
        stream_id = f"retro::{uuid.uuid4()}"
        payload = {
            "stream_id": stream_id,
            "wallet": wallet,
            "amount": float(amount),
            "unlock_at": unlock_at.isoformat(),
            "epoch_index": int(epoch_index),
            "actions": list(actions or ()),
            "metadata": dict(metadata or {}),
            "multiplier": float(multiplier if multiplier is not None else 1.0),
            "test_mode": bool(test_mode),
        }
        ledger_metadata = self._ledger.metadata_template(
            partner_id=wallet,
            narrative="Schedule RetroYield drop",
            tags=("retroyield", "drop", "scheduled"),
            extra={"epoch_index": int(epoch_index)},
        )
        record = self._ledger.append("retroyield.drop.scheduled", payload, ledger_metadata)
        drop = ScheduledDrop(
            stream_id=stream_id,
            wallet=wallet,
            amount=float(amount),
            unlock_at=unlock_at,
            epoch_index=int(epoch_index),
            multiplier=float(multiplier if multiplier is not None else 1.0),
            actions=tuple(actions or ()),
            metadata=dict(metadata or {}),
            test_mode=test_mode,
            ledger_reference=record.record_id,
        )
        self._scheduled[stream_id] = drop
        return drop

    def queue_rewards(
        self,
        rewards: Iterable[RetroReward],
        *,
        unlock_after: timedelta = timedelta(hours=1),
        test_mode: bool = False,
    ) -> Sequence[ScheduledDrop]:
        unlock_after = unlock_after if unlock_after > timedelta(0) else timedelta(minutes=1)
        scheduled: list[ScheduledDrop] = []
        now = _utcnow()
        for reward in rewards:
            drop = self.schedule(
                reward.wallet,
                reward.amount,
                unlock_at=now + unlock_after,
                epoch_index=reward.epoch_index,
                actions=reward.actions,
                metadata={"unlock_path": reward.unlock_path},
                multiplier=reward.multiplier,
                test_mode=test_mode,
            )
            scheduled.append(drop)
        return tuple(scheduled)

    # ------------------------------------------------------------------
    # Control plane
    # ------------------------------------------------------------------
    def pause(self, stream_id: str, *, reason: str | None = None) -> None:
        drop = self._scheduled.get(stream_id)
        if not drop:
            raise KeyError("stream not scheduled")
        if drop.paused:
            return
        payload = {"stream_id": stream_id, "reason": reason or "manual"}
        metadata = self._ledger.metadata_template(
            partner_id=drop.wallet,
            narrative="Pause RetroYield drop",
            tags=("retroyield", "drop", "paused"),
        )
        self._ledger.append("retroyield.drop.paused", payload, metadata)
        drop.paused = True

    def resume(self, stream_id: str) -> None:
        drop = self._scheduled.get(stream_id)
        if not drop:
            raise KeyError("stream not scheduled")
        if not drop.paused:
            return
        payload = {"stream_id": stream_id}
        metadata = self._ledger.metadata_template(
            partner_id=drop.wallet,
            narrative="Resume RetroYield drop",
            tags=("retroyield", "drop", "resumed"),
        )
        self._ledger.append("retroyield.drop.resumed", payload, metadata)
        drop.paused = False

    def override(
        self,
        stream_id: str,
        *,
        unlock_at: datetime | None = None,
        amount: float | None = None,
    ) -> None:
        drop = self._scheduled.get(stream_id)
        if not drop:
            raise KeyError("stream not scheduled")
        payload: Dict[str, object] = {"stream_id": stream_id}
        if unlock_at is not None:
            new_time = _coerce_datetime(unlock_at)
            drop.unlock_at = new_time
            payload["unlock_at"] = new_time.isoformat()
        if amount is not None:
            drop.amount = float(amount)
            payload["amount"] = float(amount)
        metadata = self._ledger.metadata_template(
            partner_id=drop.wallet,
            narrative="Override RetroYield drop",
            tags=("retroyield", "drop", "override"),
        )
        self._ledger.append("retroyield.drop.override", payload, metadata)

    def simulate_unlock(self, stream_id: str, *, at: datetime | None = None) -> DropResult:
        drop = self._scheduled.get(stream_id)
        if not drop:
            raise KeyError("stream not scheduled")
        moment = _coerce_datetime(at)
        return DropResult(
            stream_id=stream_id,
            wallet=drop.wallet,
            amount=drop.amount,
            released_at=moment,
            ledger_reference=drop.ledger_reference,
            metadata={"actions": list(drop.actions), **dict(drop.metadata), "mode": "simulation"},
            test_mode=drop.test_mode,
        )

    def process_due(self, *, now: datetime | None = None) -> Sequence[DropResult]:
        moment = _coerce_datetime(now)
        results: list[DropResult] = []
        for stream_id, drop in list(self._scheduled.items()):
            if drop.paused or drop.unlock_at > moment:
                continue
            payload = {
                "stream_id": stream_id,
                "wallet": drop.wallet,
                "amount": drop.amount,
                "released_at": moment.isoformat(),
                "actions": list(drop.actions),
                "metadata": dict(drop.metadata),
                "multiplier": drop.multiplier,
            }
            metadata = self._ledger.metadata_template(
                partner_id=drop.wallet,
                narrative="Execute RetroYield drop",
                tags=("retroyield", "drop", "executed"),
            )
            ledger_reference: str | None = None
            if not drop.test_mode:
                record = self._ledger.append("retroyield.drop.executed", payload, metadata)
                ledger_reference = record.record_id
                self._scheduled.pop(stream_id, None)
            else:
                drop.unlock_at = moment + self.TEST_BACKOFF
            results.append(
                DropResult(
                    stream_id=stream_id,
                    wallet=drop.wallet,
                    amount=drop.amount,
                    released_at=moment,
                    ledger_reference=ledger_reference,
                    metadata=payload["metadata"],
                    test_mode=drop.test_mode,
                )
            )
            if not drop.test_mode:
                continue
        return tuple(results)

    @property
    def pending(self) -> Sequence[ScheduledDrop]:
        return tuple(self._scheduled.values())
