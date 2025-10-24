"""Utilities for introspecting x402 ledger activity."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import json
from typing import Any, Iterable, Mapping, Sequence

from .x402_gateway import X402Gateway, get_default_gateway


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    records: list[dict[str, Any]] = []
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            records.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return records


def _normalise_timestamp(value: float | int | None) -> str:
    if value is None:
        return datetime.now(timezone.utc).isoformat()
    return datetime.fromtimestamp(float(value), tz=timezone.utc).isoformat()


def _categorise_action(endpoint: str | None, event: str | None) -> str:
    if event == "webhook":
        return "Passive"
    if not endpoint:
        return "Codex"
    if endpoint.startswith("cli."):
        return "CLI"
    if endpoint.startswith("yield."):
        return "Passive"
    if endpoint.startswith("codex."):
        return "Codex"
    return "Passive"


def load_dashboard_entries(
    *,
    limit: int | None = None,
    gateway: X402Gateway | None = None,
) -> list[dict[str, Any]]:
    """Return ledger entries formatted for dashboard consumption."""

    gateway = gateway or get_default_gateway()
    raw_entries = _read_jsonl(gateway.ledger_path)
    processed: list[dict[str, Any]] = []
    for entry in raw_entries:
        endpoint = entry.get("endpoint")
        currency = entry.get("currency")
        amount = entry.get("amount")
        metadata = entry.get("metadata", {})
        tx_hash = metadata.get("tx_hash") or metadata.get("transaction_hash")
        status = entry.get("status") or metadata.get("status") or "recorded"
        processed.append(
            {
                "timestamp": _normalise_timestamp(entry.get("timestamp")),
                "action_type": _categorise_action(endpoint, entry.get("event")),
                "endpoint": endpoint or entry.get("event_type"),
                "token_payout": None
                if amount is None or currency is None
                else {
                    "amount": amount,
                    "currency": currency,
                },
                "status": status,
                "tx_hash": tx_hash or metadata.get("tx_status"),
                "metadata": metadata,
            }
        )
    processed.sort(key=lambda item: item["timestamp"], reverse=True)
    if limit is not None:
        processed = processed[:limit]
    return processed


def count_total_events(*, gateway: X402Gateway | None = None) -> int:
    gateway = gateway or get_default_gateway()
    return len(_read_jsonl(gateway.ledger_path))


def aggregate_totals(entries: Sequence[Mapping[str, Any]]) -> dict[str, float]:
    totals: dict[str, float] = {}
    for entry in entries:
        payout = entry.get("token_payout") if isinstance(entry, Mapping) else None
        if isinstance(payout, Mapping):
            amount = payout.get("amount")
            currency = payout.get("currency")
            if isinstance(amount, (int, float)) and isinstance(currency, str):
                totals[currency] = round(totals.get(currency, 0.0) + float(amount), 12)
    return totals


def export_dashboard(
    entries: Iterable[Mapping[str, Any]],
    destination: Path,
    *,
    format: str = "vaultledger",
) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if format == "json":
        with destination.open("w", encoding="utf-8") as fp:
            json.dump(list(entries), fp, indent=2)
        return destination

    with destination.open("w", encoding="utf-8") as fp:
        fp.write("# Vaultfire x402 Earnings Ledger\n")
        for record in entries:
            fp.write(json.dumps(record, separators=(",", ":")))
            fp.write("\n")
    return destination


__all__ = [
    "load_dashboard_entries",
    "export_dashboard",
    "aggregate_totals",
    "count_total_events",
]
