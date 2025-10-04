"""Storage helpers for the Vaultfire pilot mode namespace."""

from __future__ import annotations

import json
from pathlib import Path
from threading import Lock
from typing import Any

__all__ = [
    "PILOT_MODE_ROOT",
    "PARTNER_REGISTRY_PATH",
    "PROTOCOL_KEYS_PATH",
    "SESSION_LOG_PATH",
    "YIELD_LOG_PATH",
    "BEHAVIOR_LOG_PATH",
    "FEEDBACK_LOG_PATH",
    "read_json",
    "write_json",
    "append_jsonl",
]

_REPO_ROOT = Path(__file__).resolve().parents[2]
PILOT_MODE_ROOT = _REPO_ROOT / "telemetry" / "pilot_mode"
PARTNER_REGISTRY_PATH = PILOT_MODE_ROOT / "partners.json"
PROTOCOL_KEYS_PATH = PILOT_MODE_ROOT / "protocol_keys.json"
SESSION_LOG_PATH = PILOT_MODE_ROOT / "sessions.jsonl"
YIELD_LOG_PATH = PILOT_MODE_ROOT / "yield_log.jsonl"
BEHAVIOR_LOG_PATH = PILOT_MODE_ROOT / "behavior_log.jsonl"
FEEDBACK_LOG_PATH = PILOT_MODE_ROOT / "feedback.jsonl"

_LOCK = Lock()


def _ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def read_json(path: Path, default: Any) -> Any:
    """Read JSON data from ``path`` returning ``default`` on failure."""

    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return default


def write_json(path: Path, payload: Any) -> None:
    """Atomically write ``payload`` as JSON to ``path``."""

    _ensure_parent(path)
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    with _LOCK:
        tmp_path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
        tmp_path.replace(path)


def append_jsonl(path: Path, payload: Any) -> None:
    """Append ``payload`` as a JSON line to ``path``."""

    _ensure_parent(path)
    with _LOCK:
        with path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(payload, sort_keys=True) + "\n")
