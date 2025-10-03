"""Telemetry plumbing for the live pilot environment."""
from __future__ import annotations

import json
import logging
import threading
from datetime import datetime
from hashlib import sha256
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any, Dict, Iterable

LOG_DIR = Path(__file__).resolve().parents[1] / "logs"
TRACE_LOG_PATH = LOG_DIR / "live_pilot_traces.log"
SUMMARY_PATH = LOG_DIR / "pilot_live_metrics.json"
CI_CD_AUDIT_LOG = LOG_DIR / "cicd_audit.log"


class TelemetryManager:
    """Collects request traces, audit hooks, and usage metrics."""

    def __init__(self) -> None:
        self._logger = logging.getLogger("vaultfire.live_pilot")
        self._logger.setLevel(logging.INFO)
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        handler = RotatingFileHandler(TRACE_LOG_PATH, maxBytes=2_000_000, backupCount=5)
        handler.setFormatter(
            logging.Formatter("%(asctime)sZ %(levelname)s %(message)s", datefmt="%Y-%m-%dT%H:%M:%S")
        )
        self._logger.addHandler(handler)
        self._lock = threading.Lock()
        self._event_totals: Dict[str, int] = {}
        self._recent_traces: list[str] = []
        self._export_interval = 60 * 60 * 24
        self._export_thread: threading.Thread | None = None
        self._stop_event = threading.Event()
        self._write_cicd_boot_record()

    def _write_cicd_boot_record(self) -> None:
        payload = {
            "event": "live_pilot_boot",
            "timestamp": datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
            "hash": self.generate_trace_id({"event": "live_pilot_boot"}),
        }
        with CI_CD_AUDIT_LOG.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(payload) + "\n")

    def configure_interval(self, seconds: int) -> None:
        self._export_interval = max(seconds, 60)

    def generate_trace_id(self, payload: Dict[str, Any]) -> str:
        serialized = json.dumps(payload, sort_keys=True)
        return sha256(serialized.encode("utf-8")).hexdigest()

    def record_event(self, event_type: str, data: Dict[str, Any]) -> str:
        timestamp = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
        trace_payload = {"event_type": event_type, "timestamp": timestamp, **data}
        trace_id = self.generate_trace_id(trace_payload)
        trace_payload["trace_id"] = trace_id
        with self._lock:
            self._event_totals[event_type] = self._event_totals.get(event_type, 0) + 1
            self._recent_traces.append(trace_id)
            self._recent_traces = self._recent_traces[-100:]
        self._logger.info(json.dumps(trace_payload, sort_keys=True))
        return trace_id

    def export_summary(self) -> Dict[str, Any]:
        with self._lock:
            payload = {
                "last_exported_at": datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
                "event_totals": dict(self._event_totals),
                "recent_traces": list(self._recent_traces),
                "ci_cd_audit_hook": "enabled",
            }
        SUMMARY_PATH.parent.mkdir(parents=True, exist_ok=True)
        with SUMMARY_PATH.open("w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2)
            handle.write("\n")
        return payload

    def _run_exporter(self) -> None:
        while not self._stop_event.wait(self._export_interval):
            self.export_summary()

    def start_background_exporter(self, *, interval_seconds: int | None = None) -> None:
        if interval_seconds:
            self.configure_interval(interval_seconds)
        if self._export_thread and self._export_thread.is_alive():
            return
        self._stop_event.clear()
        self._export_thread = threading.Thread(target=self._run_exporter, name="telemetry-exporter", daemon=True)
        self._export_thread.start()

    def shutdown(self) -> None:
        self._stop_event.set()
        if self._export_thread:
            self._export_thread.join(timeout=5)
        self.export_summary()

    def flush_recent(self) -> Iterable[str]:
        with self._lock:
            return list(self._recent_traces)


def _initialise_ci_cd_header() -> None:
    header = {
        "event": "ci_cd_audit_header",
        "timestamp": datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
        "hash": sha256(b"ci_cd_audit_header").hexdigest(),
    }
    CI_CD_AUDIT_LOG.parent.mkdir(parents=True, exist_ok=True)
    if not CI_CD_AUDIT_LOG.exists():
        with CI_CD_AUDIT_LOG.open("w", encoding="utf-8") as handle:
            handle.write(json.dumps(header) + "\n")


_initialise_ci_cd_header()
telemetry_manager = TelemetryManager()

__all__ = ["TelemetryManager", "telemetry_manager", "TRACE_LOG_PATH", "SUMMARY_PATH", "CI_CD_AUDIT_LOG"]
