"""Guardian Trace utilities for monitoring identity spoofing attempts."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, MutableMapping, Sequence

_REPO_ROOT = Path(__file__).resolve().parents[2]
_STATUS_DIR = _REPO_ROOT / "status"
_ACTIVITY_LOG_PATH = _STATUS_DIR / "guardian_trace_activity.jsonl"
_CLONE_LOG_PATH = _STATUS_DIR / "guardian_clone_attempts.jsonl"
_LOCK_PATH = _STATUS_DIR / "guardian_lock_state.json"


def _now() -> datetime:
    """Return the current UTC time."""

    return datetime.now(timezone.utc)


def _normalise_timestamp(value: Any) -> datetime:
    """Coerce ``value`` into a timezone-aware ``datetime``."""

    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(float(value), tz=timezone.utc)
    if isinstance(value, str):
        candidate = value.strip()
        if not candidate:
            return _now()
        try:
            # Replace trailing "Z" to support common ISO-8601 inputs.
            return datetime.fromisoformat(candidate.replace("Z", "+00:00"))
        except ValueError:
            return _now()
    return _now()


def _ensure_mapping(value: Any) -> MutableMapping[str, Any]:
    if isinstance(value, MutableMapping):
        return value
    if isinstance(value, Mapping):
        return dict(value)
    return {}


@dataclass(frozen=True)
class FingerprintActivity:
    """Snapshot of a single fingerprint observation."""

    agent_id: str
    wallet: str
    fingerprint_hash: str
    signature_hash: str
    timestamp: datetime
    metadata: MutableMapping[str, Any] = field(default_factory=dict)

    @classmethod
    def from_payload(cls, payload: Mapping[str, Any]) -> "FingerprintActivity" | None:
        agent_id = str(payload.get("agent_id", "")).strip()
        wallet = str(payload.get("wallet", "")).strip()
        fingerprint_hash = str(payload.get("fingerprint_hash", payload.get("fingerprint", ""))).strip()
        signature_hash = str(payload.get("signature_hash", payload.get("signature", ""))).strip()
        timestamp = _normalise_timestamp(payload.get("timestamp"))

        if not agent_id:
            return None

        metadata = _ensure_mapping(payload.get("metadata", {}))
        return cls(
            agent_id=agent_id,
            wallet=wallet,
            fingerprint_hash=fingerprint_hash,
            signature_hash=signature_hash,
            timestamp=timestamp,
            metadata=metadata,
        )

    def to_json(self) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "agent_id": self.agent_id,
            "wallet": self.wallet,
            "fingerprint_hash": self.fingerprint_hash,
            "signature_hash": self.signature_hash,
            "timestamp": self.timestamp.isoformat().replace("+00:00", "Z"),
        }
        if self.metadata:
            payload["metadata"] = dict(self.metadata)
        return payload


def _read_jsonl(path: Path) -> List[Mapping[str, Any]]:
    records: List[Mapping[str, Any]] = []
    if not path.exists():
        return records
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(data, Mapping):
                records.append(data)
    return records


def track_fingerprint_activity(source: str | Path | None = None) -> List[FingerprintActivity]:
    """Load fingerprint activity observations from disk."""

    path = Path(source) if source else _ACTIVITY_LOG_PATH
    records = _read_jsonl(path)
    activities: List[FingerprintActivity] = []
    for record in records:
        activity = FingerprintActivity.from_payload(record)
        if activity:
            activities.append(activity)
    activities.sort(key=lambda item: item.timestamp)
    return activities


def _wallet_conflicts(activity_log: Iterable[FingerprintActivity], agent_id: str, wallet: str) -> List[FingerprintActivity]:
    conflicts: List[FingerprintActivity] = []
    for entry in activity_log:
        if entry.wallet == wallet and entry.agent_id != agent_id:
            conflicts.append(entry)
    return conflicts


def validate_behavior_signature(
    agent_id: str,
    wallet: str,
    activity_log: Sequence[FingerprintActivity] | None = None,
) -> bool:
    """Ensure the (agent_id, wallet) pair is unique within the observed activity."""

    if not agent_id or not wallet:
        raise ValueError("agent_id and wallet must be provided")

    log = list(activity_log) if activity_log is not None else track_fingerprint_activity()
    if not log:
        return True

    conflicts = _wallet_conflicts(log, agent_id, wallet)
    if conflicts:
        return False

    signatures = {}
    for entry in log:
        signatures.setdefault(entry.signature_hash, set()).add(entry.agent_id)
    for signature, owners in signatures.items():
        if signature and agent_id in owners and len(owners) > 1:
            return False

    return True


def alert_identity_anomalies(
    activity_log: Sequence[FingerprintActivity], agent_id: str
) -> List[str]:
    """Return human-readable descriptions of anomalous identity activity."""

    anomalies: List[str] = []
    agent_entries = [entry for entry in activity_log if entry.agent_id == agent_id]
    if not agent_entries:
        anomalies.append(f"No activity recorded for {agent_id}")
        return anomalies

    wallets = {entry.wallet for entry in agent_entries if entry.wallet}
    if len(wallets) > 1:
        anomalies.append(f"Multiple wallets observed for {agent_id}: {sorted(wallets)}")

    for wallet in wallets:
        conflicts = _wallet_conflicts(activity_log, agent_id, wallet)
        if conflicts:
            conflicting_agents = sorted({entry.agent_id for entry in conflicts})
            anomalies.append(
                f"Wallet {wallet} is also used by agents: {', '.join(conflicting_agents)}"
            )

    fingerprints: Dict[str, set[str]] = {}
    for entry in activity_log:
        if entry.fingerprint_hash:
            fingerprints.setdefault(entry.fingerprint_hash, set()).add(entry.agent_id)
    for fingerprint, owners in fingerprints.items():
        if agent_id in owners and len(owners) > 1:
            clones = sorted(owners - {agent_id})
            anomalies.append(
                f"Fingerprint {fingerprint} shared with agents: {', '.join(clones)}"
            )

    return anomalies


def log_clone_attempts(
    agent_id: str,
    activity_log: Sequence[FingerprintActivity],
    *,
    anomalies: Sequence[str] | None = None,
    destination: str | Path | None = None,
) -> None:
    """Persist a record of detected clone attempts to disk."""

    if anomalies is None:
        anomalies = alert_identity_anomalies(activity_log, agent_id)
    if not anomalies:
        return

    path = Path(destination) if destination else _CLONE_LOG_PATH
    path.parent.mkdir(parents=True, exist_ok=True)

    sample = [entry.to_json() for entry in activity_log[-5:]]
    payload = {
        "agent_id": agent_id,
        "timestamp": _now().isoformat().replace("+00:00", "Z"),
        "anomalies": list(anomalies),
        "activity_sample": sample,
    }

    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload) + "\n")


def auto_lock_unique_signal_origin(
    agent_id: str, *, destination: str | Path | None = None
) -> Dict[str, Any]:
    """Record a lock file indicating the agent signal origin is isolated."""

    path = Path(destination) if destination else _LOCK_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "agent_id": agent_id,
        "locked": True,
        "locked_at": _now().isoformat().replace("+00:00", "Z"),
    }
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
    return payload


__all__ = [
    "FingerprintActivity",
    "track_fingerprint_activity",
    "validate_behavior_signature",
    "alert_identity_anomalies",
    "log_clone_attempts",
    "auto_lock_unique_signal_origin",
]

