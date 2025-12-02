"""Modular Vaultfire core runtime with mission ledger integration."""

from __future__ import annotations

import json
import logging
import os
import sqlite3
import threading
import time
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Iterable, Mapping, MutableMapping, Optional

from engine.proof_of_loyalty import record_belief_action
from vaultfire.mission import LedgerMetadata, MissionLedger
from vaultfire.core.cli import GhostkeyCLI
from vaultfire.modules import (
    ConscienceMirrorVerificationLayer,
    EnhancementConfirmComposer,
    LoopSingularityDetectorEngine,
    MythCompressionMode,
    QuantumDriftSynchronizer,
    TemporalBehavioralCompressionEngine,
    VaultfireMythosEngine,
    VaultfireProtocolStack,
)
from vaultfire.core.mirror_engine import MirrorEngine, MirrorRecord
from vaultfire.core.mirror_state import MirrorState, MirrorStateEntry

logger = logging.getLogger("vaultfire.core")

CONFIG_PATH_ENV = "VAULTFIRE_CONFIG_PATH"
DEFAULT_CONFIG_PATH = Path("vaultfire_config.json")
MISSION_CATEGORY_AUDIT = "core.audit"
MISSION_CATEGORY_PURPOSE = "core.purpose"


@dataclass(frozen=True)
class CoreConfig:
    """Configuration container for enterprise-grade Vaultfire behavior."""

    purpose_map_path: Path
    use_database: bool
    database_url: Optional[str]
    max_purpose_records: int
    notify_channel: str
    environment: str
    strict_notifier: bool
    audit_enabled: bool
    audit_log_path: Path
    lock_timeout: float

    @staticmethod
    def from_payload(payload: MutableMapping[str, Any]) -> "CoreConfig":
        purpose_path = Path(
            payload.get("purpose_map_path")
            or os.getenv("VAULTFIRE_PURPOSE_PATH", "purpose_map.json")
        )
        use_database = _coerce_bool(
            payload.get("use_database", os.getenv("VAULTFIRE_USE_DATABASE"))
        )
        database_url = payload.get("database_url") or os.getenv("VAULTFIRE_DATABASE_URL")
        max_records = int(
            payload.get(
                "max_purpose_records",
                os.getenv("VAULTFIRE_MAX_PURPOSE_RECORDS", "2000"),
            )
        )
        notify_channel = str(
            payload.get(
                "notify_channel",
                os.getenv("VAULTFIRE_NOTIFY_CHANNEL", "ghostkey_trader"),
            )
        )
        environment = str(
            payload.get(
                "environment", os.getenv("VAULTFIRE_ENVIRONMENT", "production")
            )
        )
        strict_notifier = _coerce_bool(
            payload.get(
                "strict_notifier", os.getenv("VAULTFIRE_STRICT_NOTIFIER", "true")
            )
        )
        audit_enabled = _coerce_bool(
            payload.get("audit_enabled", os.getenv("VAULTFIRE_AUDIT_ENABLED", "true"))
        )
        audit_log_path = Path(
            payload.get(
                "audit_log_path",
                os.getenv(
                    "VAULTFIRE_AUDIT_PATH",
                    Path("logs") / "vaultfire_enterprise_notifications.jsonl",
                ),
            )
        )
        lock_timeout = float(
            payload.get("lock_timeout", os.getenv("VAULTFIRE_LOCK_TIMEOUT", "10"))
        )
        return CoreConfig(
            purpose_map_path=purpose_path,
            use_database=bool(use_database),
            database_url=str(database_url) if database_url else None,
            max_purpose_records=max(1, int(max_records)),
            notify_channel=notify_channel,
            environment=environment,
            strict_notifier=bool(strict_notifier),
            audit_enabled=bool(audit_enabled),
            audit_log_path=Path(audit_log_path),
            lock_timeout=max(0.5, float(lock_timeout)),
        )


def _coerce_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return False


@lru_cache(maxsize=1)
def load_core_config() -> CoreConfig:
    config_path = os.getenv(CONFIG_PATH_ENV)
    path = Path(config_path) if config_path else DEFAULT_CONFIG_PATH
    payload: Dict[str, Any] = {}
    if path.exists():
        try:
            payload = json.loads(path.read_text())
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.warning("Failed to load config %s: %s", path, exc)
    return CoreConfig.from_payload(payload)


load_vaultfire_config = load_core_config


class PurposeStore:
    """Enterprise-ready storage for purpose synchronization."""

    def __init__(self, config: CoreConfig):
        self.config = config
        self._thread_lock = threading.Lock()
        self._db_path: Optional[Path] = None
        if config.use_database and config.database_url:
            self._db_path = _resolve_sqlite_path(config.database_url)
            if self._db_path is None:
                logger.warning(
                    "Unsupported database_url for purpose store: %s", config.database_url
                )
            else:
                self._initialise_database()

    def record(self, record: Mapping[str, Any]) -> Dict[str, Any]:
        if self._db_path:
            return self._record_sqlite(record)
        return self._record_file(record)

    def fetch_recent(self, limit: int = 50) -> Iterable[Dict[str, Any]]:
        limit = max(1, int(limit))
        if self._db_path:
            return self._fetch_recent_sqlite(limit)
        return self._fetch_recent_file(limit)

    # ------------------------------------------------------------------
    # SQLite persistence
    # ------------------------------------------------------------------
    def _initialise_database(self) -> None:
        assert self._db_path is not None
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(self._db_path) as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS purpose_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    domain TEXT NOT NULL,
                    trait TEXT NOT NULL,
                    role TEXT NOT NULL,
                    timestamp TEXT NOT NULL
                )
                """
            )
            connection.commit()

    def _record_sqlite(self, record: Mapping[str, Any]) -> Dict[str, Any]:
        assert self._db_path is not None
        with self._thread_lock, sqlite3.connect(self._db_path) as connection:
            connection.execute(
                "INSERT INTO purpose_records(domain, trait, role, timestamp) VALUES(?, ?, ?, ?)",
                (
                    record["domain"],
                    record["trait"],
                    record["role"],
                    record["timestamp"],
                ),
            )
            connection.execute(
                """
                DELETE FROM purpose_records
                WHERE id NOT IN (
                    SELECT id FROM purpose_records
                    ORDER BY id DESC
                    LIMIT ?
                )
                """,
                (self.config.max_purpose_records,),
            )
            connection.commit()
        return dict(record)

    # ------------------------------------------------------------------
    # File-based persistence
    # ------------------------------------------------------------------
    def _record_file(self, record: Mapping[str, Any]) -> Dict[str, Any]:
        path = self.config.purpose_map_path
        lock_path = path.with_suffix(".lock")
        with _file_lock(lock_path, self.config.lock_timeout):
            if path.exists():
                try:
                    data = json.loads(path.read_text())
                except Exception:
                    data = {}
            else:
                data = {}
            records = data.setdefault("records", [])
            records.append(dict(record))
            data["records"] = records[-self.config.max_purpose_records :]
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(data, indent=2))
        return dict(record)

    def _fetch_recent_sqlite(self, limit: int) -> Iterable[Dict[str, Any]]:
        assert self._db_path is not None
        with sqlite3.connect(self._db_path) as connection:
            rows = connection.execute(
                """
                SELECT domain, trait, role, timestamp
                FROM purpose_records
                ORDER BY id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [
            {
                "domain": domain,
                "trait": trait,
                "role": role,
                "timestamp": timestamp,
            }
            for domain, trait, role, timestamp in rows
        ]

    def _fetch_recent_file(self, limit: int) -> Iterable[Dict[str, Any]]:
        path = self.config.purpose_map_path
        try:
            data = json.loads(path.read_text())
        except Exception:
            return []
        records = data.get("records", [])
        return list(reversed(records[-limit:]))


def _resolve_sqlite_path(database_url: str) -> Optional[Path]:
    prefix = "sqlite:///"
    if database_url.startswith(prefix):
        return Path(database_url[len(prefix) :]).expanduser()
    return None


@contextmanager
def _file_lock(lock_path: Path, timeout: float) -> Iterable[None]:
    start = time.monotonic()
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    fd: Optional[int] = None
    try:
        while True:
            try:
                fd = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
                os.write(fd, str(os.getpid()).encode())
                break
            except FileExistsError:
                if time.monotonic() - start >= timeout:
                    raise TimeoutError(f"Timeout acquiring lock for {lock_path}")
                time.sleep(0.05)
        yield
    finally:
        if fd is not None:
            os.close(fd)
        try:
            os.unlink(lock_path)
        except FileNotFoundError:
            pass


@lru_cache(maxsize=1)
def get_purpose_store() -> PurposeStore:
    return PurposeStore(load_core_config())


def get_recent_purpose_records(limit: int = 50) -> Iterable[Dict[str, Any]]:
    return get_purpose_store().fetch_recent(limit)


def _mission_ledger() -> MissionLedger:
    return MissionLedger.default(component="vaultfire-core")


def _emit_ledger_event(category: str, payload: Mapping[str, Any], metadata: LedgerMetadata | Mapping[str, Any] | None = None) -> None:
    try:
        _mission_ledger().append(category, payload, metadata)
    except Exception as exc:  # pragma: no cover - ledger failures should never break runtime
        logger.warning("Failed to append mission ledger entry for %s: %s", category, exc)


@lru_cache(maxsize=1)
def _resolve_notifier():
    try:
        from ghostkey_trader_notifications import notify_event
    except Exception as exc:  # pragma: no cover - optional dependency
        logger.debug("Ghostkey notifier unavailable: %s", exc)
        return None
    return notify_event


def _write_audit_envelope(config: CoreConfig, envelope: Mapping[str, Any]) -> None:
    if not config.audit_enabled:
        return
    config.audit_log_path.parent.mkdir(parents=True, exist_ok=True)
    with open(config.audit_log_path, "a", encoding="utf-8") as handle:
        handle.write(json.dumps(dict(envelope), sort_keys=True) + "\n")


def protocol_notify(event: str, payload: Mapping[str, Any]) -> None:
    config = load_core_config()
    envelope = {
        "event": event,
        "payload": dict(payload or {}),
        "environment": config.environment,
        "channel": config.notify_channel,
        "emitted_at": datetime.utcnow().isoformat(),
    }
    _write_audit_envelope(config, envelope)
    _emit_ledger_event(
        MISSION_CATEGORY_AUDIT,
        envelope,
        metadata={
            "narrative": f"Protocol event {event}",
            "region": config.environment,
            "tags": ("core", "audit"),
        },
    )
    notifier = _resolve_notifier()
    if notifier is None:
        if config.strict_notifier:
            logger.warning("Notifier unavailable for event: %s", event)
        return
    try:
        notifier(event, envelope)
    except Exception as exc:  # pragma: no cover - external service failure
        logger.warning("Notifier failed for event %s: %s", event, exc)
        if config.strict_notifier:
            raise


def sync_purpose(domain: str, trait: str, role: str) -> Dict[str, Any]:
    record = {
        "domain": domain,
        "trait": trait,
        "role": role,
        "timestamp": datetime.utcnow().isoformat(),
    }
    stored = get_purpose_store().record(record)
    metadata = {
        "narrative": f"Purpose sync for {domain}:{trait}",
        "region": load_core_config().environment,
        "tags": ("purpose", trait, role),
    }
    _emit_ledger_event(MISSION_CATEGORY_PURPOSE, stored, metadata)
    logger.debug("Synced purpose record", extra={"domain": domain, "trait": trait})
    return stored


def cli_belief(identity: str, wallet: str, text: str) -> Dict[str, Any]:
    result = record_belief_action(identity, wallet, text)
    purpose_record = sync_purpose("cli", "belief", "record")
    metadata = LedgerMetadata(
        partner_id=identity,
        narrative="CLI belief capture",
        diligence_artifacts=(f"wallet://{wallet}",),
        region=load_core_config().environment,
        tags=("belief", "cli"),
        extra={"purpose_record": purpose_record},
    )
    protocol_notify(
        "vaultfire.cli_belief.recorded",
        {
            "identity": identity,
            "wallet": wallet,
            "text": text,
            "purpose_record": purpose_record,
        },
    )
    _emit_ledger_event("core.belief", result, metadata)
    return result


def reset_vaultfire_state() -> None:
    load_core_config.cache_clear()
    get_purpose_store.cache_clear()
    _resolve_notifier.cache_clear()
    MissionLedger.reset_default_cache()


VaultfireConfig = CoreConfig

__all__ = [
    "CoreConfig",
    "PurposeStore",
    "VaultfireConfig",
    "GhostkeyCLI",
    "cli_belief",
    "get_purpose_store",
    "get_recent_purpose_records",
    "load_core_config",
    "load_vaultfire_config",
    "protocol_notify",
    "reset_vaultfire_state",
    "sync_purpose",
    "VaultfireProtocolStack",
    "EnhancementConfirmComposer",
    "MythCompressionMode",
    "TemporalBehavioralCompressionEngine",
    "ConscienceMirrorVerificationLayer",
    "LoopSingularityDetectorEngine",
    "QuantumDriftSynchronizer",
    "VaultfireMythosEngine",
    "MirrorEngine",
    "MirrorRecord",
    "MirrorState",
    "MirrorStateEntry",
]
