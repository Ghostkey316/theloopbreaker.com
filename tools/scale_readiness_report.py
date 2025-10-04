#!/usr/bin/env python3
"""Compile a production-readiness snapshot for the Purposeful Scale stack."""
from __future__ import annotations

import argparse
import importlib
import json
from collections import Counter
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path
from statistics import mean
from typing import Any, Dict, Iterable, List, Mapping, MutableMapping, Optional, Sequence

from utils.json_io import load_json


@lru_cache()
def _purposeful_scale():
    return importlib.import_module("engine.purposeful_scale")


def _attestation_dir() -> Path:
    return _purposeful_scale().BASE_DIR / "attestations"


MAX_STALENESS = timedelta(hours=6)


def _normalize_tags(values: Iterable[Any]) -> List[str]:
    tags: List[str] = []
    seen = set()
    for value in values or []:
        if isinstance(value, str):
            text = value.strip().lower()
        else:
            text = str(value).strip().lower()
        if not text:
            continue
        if text.startswith("#"):
            text = text[1:]
        if text and text not in seen:
            tags.append(text)
            seen.add(text)
    return tags


def _safe_float(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _parse_timestamp(value: Any) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc)
    if isinstance(value, str):
        candidate = value.strip()
        if not candidate:
            return None
        candidate = candidate.replace("Z", "+00:00")
        try:
            parsed = datetime.fromisoformat(candidate)
        except ValueError:
            return None
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    return None


def _format_timestamp(value: Optional[datetime]) -> Optional[str]:
    if value is None:
        return None
    return value.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _belief_summary(values: Sequence[float]) -> Dict[str, float]:
    if not values:
        return {"avg": 0.0, "min": 0.0, "max": 0.0}
    return {
        "avg": round(mean(values), 4),
        "min": round(min(values), 4),
        "max": round(max(values), 4),
    }


def _attestation_snapshot() -> Dict[str, Any]:
    info: Dict[str, Any] = {"count": 0}
    attestation_dir = _attestation_dir()
    if not attestation_dir.exists():
        return info

    files = sorted(attestation_dir.glob("*_attestation.json"))
    info["count"] = len(files)
    if not files:
        return info

    latest = max(files, key=lambda path: path.stat().st_mtime)
    info["latest_file"] = latest.name
    try:
        data = json.loads(latest.read_text())
    except (OSError, json.JSONDecodeError):
        info["latest_status"] = "unreadable"
        return info

    info["latest_status"] = "ok"
    info["latest_attestation_hash"] = data.get("attestation_hash")
    info["latest_generated_at"] = data.get("generated_at")
    info["latest_user_id"] = data.get("user_id")
    return info


def _thread_metrics(entries: Sequence[Mapping[str, Any]], thread: str) -> Dict[str, Any]:
    normalized = thread.lower()
    relevant: List[Mapping[str, Any]] = []
    for entry in entries:
        tags = entry.get("mission_tags", [])
        if normalized in tags:
            relevant.append(entry)

    approvals = [entry for entry in relevant if entry.get("approved")]
    denials = [entry for entry in relevant if not entry.get("approved")]
    belief_values = [_safe_float(entry.get("belief_density")) for entry in relevant if entry.get("belief_density") is not None]

    last_approved: Optional[datetime] = None
    if approvals:
        last_approved = max((_parse_timestamp(entry.get("timestamp")) for entry in approvals), default=None)

    return {
        "thread": normalized,
        "total": len(relevant),
        "approved": len(approvals),
        "denied": len(denials),
        "belief_density": _belief_summary(belief_values),
        "last_approved": _format_timestamp(last_approved),
    }


def _sanitize_entry(entry: Mapping[str, Any]) -> Dict[str, Any]:
    timestamp = _format_timestamp(_parse_timestamp(entry.get("timestamp")))
    tags = _normalize_tags(entry.get("mission_tags", []))
    return {
        "timestamp": timestamp,
        "user_id": entry.get("user_id"),
        "operation": entry.get("operation"),
        "mission": entry.get("mission"),
        "mission_tags": tags,
        "approved": bool(entry.get("approved")),
        "belief_density": _safe_float(entry.get("belief_density")),
        "alignment": _safe_float(entry.get("alignment")),
        "reason": entry.get("reason"),
    }


def compile_scale_snapshot(
    history_limit: int = 50,
    mission_threads: Sequence[str] | None = None,
) -> Dict[str, Any]:
    """Return aggregated readiness information for scale operations."""

    module = _purposeful_scale()

    log: Sequence[Mapping[str, Any]] = load_json(module.SCALE_LOG_PATH, [])
    sorted_log = sorted(
        log,
        key=lambda entry: _parse_timestamp(entry.get("timestamp")) or datetime.min.replace(tzinfo=timezone.utc),
    )
    if history_limit and history_limit > 0:
        sorted_log = sorted_log[-history_limit:]

    sanitized = [_sanitize_entry(entry) for entry in sorted_log]

    total = len(sanitized)
    approvals = [entry for entry in sanitized if entry["approved"]]
    approval_rate = round(len(approvals) / total, 3) if total else 0.0
    belief_values = [entry["belief_density"] for entry in sanitized if entry["belief_density"]]

    reasons = Counter(
        entry["reason"] for entry in sanitized if entry["reason"] and not entry["approved"]
    )

    threads: set[str] = set()
    for entry in sanitized:
        for tag in entry.get("mission_tags", []):
            threads.add(tag)

    focus = set(tag.lower() for tag in mission_threads) if mission_threads else set()
    if not focus:
        focus = set(tag.lower() for tag in module.RECOGNIZED_MISSION_THREADS)
        focus.update(threads)

    thread_summaries = [_thread_metrics(sanitized, thread) for thread in sorted(focus)]

    last_activity: Optional[datetime] = None
    if sanitized:
        last_activity = max((_parse_timestamp(entry["timestamp"]) for entry in sanitized), default=None)

    readiness_notes: List[str] = []
    scale_ready = bool(approvals)

    if not total:
        readiness_notes.append("no scale history available")
        scale_ready = False

    if approval_rate < 0.6:
        readiness_notes.append("approval rate below 60% threshold")
        scale_ready = False

    for summary in thread_summaries:
        if summary["approved"] == 0:
            readiness_notes.append(f"missing approved coverage for thread '{summary['thread']}'")
            scale_ready = False

    if last_activity is not None:
        now = datetime.now(timezone.utc)
        if now - last_activity > MAX_STALENESS:
            readiness_notes.append("last approved scale event is stale (>6h)")
            scale_ready = False

    profiles = load_json(module.PURPOSE_PROFILES_PATH, {})
    profile_count = len(profiles) if isinstance(profiles, MutableMapping) else 0

    attestation = _attestation_snapshot()

    report = {
        "generated_at": _format_timestamp(datetime.now(timezone.utc)),
        "history_window": history_limit,
        "entries": total,
        "approval_rate": approval_rate,
        "belief_density": _belief_summary(belief_values),
        "denial_reasons": dict(reasons.most_common()),
        "mission_threads": thread_summaries,
        "scale_ready": scale_ready,
        "readiness_notes": readiness_notes,
        "profile_count": profile_count,
        "last_activity": _format_timestamp(last_activity),
        "attestations": attestation,
        "recent_decisions": sanitized[-5:],
    }
    return report


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Vaultfire scale readiness report")
    parser.add_argument(
        "--history",
        type=int,
        default=50,
        help="number of recent scale decisions to include (default: 50)",
    )
    parser.add_argument(
        "--mission-thread",
        action="append",
        dest="mission_threads",
        help="limit readiness coverage checks to specific mission threads",
    )
    parser.add_argument(
        "--pretty",
        action="store_true",
        help="pretty-print JSON output",
    )
    args = parser.parse_args(argv)

    report = compile_scale_snapshot(args.history, args.mission_threads)
    dump_kwargs = {"indent": 2, "sort_keys": True} if args.pretty else {}
    print(json.dumps(report, **dump_kwargs))
    return 0


if __name__ == "__main__":  # pragma: no cover - CLI entry point
    raise SystemExit(main())
