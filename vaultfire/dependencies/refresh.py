"""Regenerate Vaultfire service integration artifacts."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Mapping

from vaultfire.mission import MissionLedger

__all__ = ["regenerate_service_artifacts", "render_service_map", "render_sla"]

SERVICE_MAP_PATH = Path(__file__).resolve().parent / "service_map.json"

_SERVICE_MAP_TEMPLATE: Dict[str, str] = {
    "NS3": "active",
    "Zora": "integrated",
    "x402": "secured",
    "TimeFlare": "emitting=false (planned)",
    "Coinbase": "gateway: x402",
}

_SLA_BODY = """# Vaultfire Protocol SLA

## Core Commitments
- Uptime target: 99.9%
- Passive payout latency: < 2 min (standard), < 10 sec (Ghostkey priority)
- Backup cadence: daily @ 04:00 UTC
- Disaster recovery SLA: < 5 min with `vaultfire --recover`
- Integration visibility: service_map reference (`vaultfire/dependencies/service_map.json`)

## Stewardship Notes
- Generated automatically as part of Vaultfire Reinforcement v3.1.
- Service health checks reference the integration map and planned partner states.
- Daily backups record Codex-aligned checksums for ledger parity.

Vaultfire Protocol SLA | Reinforced v3.1 | Maintainer: Ghostkey-316
"""


def render_service_map() -> Dict[str, str]:
    """Return the canonical service map payload."""

    return dict(_SERVICE_MAP_TEMPLATE)


def render_sla(service_map: Mapping[str, str], *, generated_at: str) -> str:
    """Render the SLA document, embedding the current ``service_map`` state."""

    map_snapshot = "\n".join(f"- {service}: {status}" for service, status in sorted(service_map.items()))
    return f"{_SLA_BODY}\n\n### Service Map Snapshot ({generated_at})\n{map_snapshot}\n"


def _append_codex_event(path: Path, payload: Mapping[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        json.dump(dict(payload), handle, separators=(",", ":"))
        handle.write("\n")


def regenerate_service_artifacts(
    *,
    service_map_path: Path | None = None,
    sla_path: Path | None = None,
    codex_path: Path | None = None,
    mission_ledger: MissionLedger | None = None,
    timestamp: str | None = None,
) -> Mapping[str, Any]:
    """Rewrite the service map and SLA, logging the refresh to the ledger."""

    generated_at = timestamp or datetime.now(timezone.utc).isoformat()
    service_map = render_service_map()
    target_map = (service_map_path or SERVICE_MAP_PATH).expanduser()
    target_map.parent.mkdir(parents=True, exist_ok=True)
    target_map.write_text(json.dumps(service_map, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    sla_target = (sla_path or Path("vaultfire/docs/SLA.md")).expanduser()
    sla_target.parent.mkdir(parents=True, exist_ok=True)
    sla_target.write_text(render_sla(service_map, generated_at=generated_at), encoding="utf-8")

    ledger = mission_ledger or MissionLedger.default(component="SLA_revision_log")
    record = ledger.append(
        "sla_revision",
        {"service_map": service_map, "generated_at": generated_at},
        metadata={"tags": ("sla", "auto-refresh"), "extra": {"path": str(sla_target)}},
    )

    codex_target = (codex_path or Path("codex/VAULTFIRE_CLI_LEDGER.jsonl")).expanduser()
    _append_codex_event(
        codex_target,
        {
            "timestamp": generated_at,
            "event": "sla_revision",
            "record_id": record.record_id,
            "component": ledger._component if hasattr(ledger, "_component") else "SLA_revision_log",
            "path": str(sla_target),
        },
    )

    return {
        "service_map_path": str(target_map),
        "sla_path": str(sla_target),
        "generated_at": generated_at,
        "record_id": record.record_id,
    }
