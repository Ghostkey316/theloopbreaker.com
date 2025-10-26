"""Blueprint that exposes x402 webhook and dashboard endpoints."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping

import json

from flask import Blueprint, Flask, jsonify, request

from .x402_dashboard import aggregate_totals, count_total_events, load_dashboard_entries
from .x402_gateway import X402Gateway, get_default_gateway

_STATE_PATH = Path("logs/x402_airdrop_state.json")


def _load_state() -> dict[str, Any]:
    if _STATE_PATH.exists():
        try:
            return json.loads(_STATE_PATH.read_text())
        except Exception:
            return {}
    return {}


def _store_state(state: Mapping[str, Any]) -> None:
    _STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _STATE_PATH.open("w", encoding="utf-8") as fp:
        json.dump(dict(state), fp, indent=2)


def _maybe_trigger_airdrop(gateway: X402Gateway, loyalty_score: float) -> Mapping[str, Any] | None:
    if loyalty_score <= 0.85:
        return None
    total_events = count_total_events(gateway=gateway)
    if total_events <= 50:
        return None

    state = _load_state()
    now = datetime.now(timezone.utc)
    iso_calendar = now.isocalendar()
    current_key = f"{iso_calendar.year}-W{iso_calendar.week}"
    if state.get("last_drop_key") == current_key:
        return None

    entry = gateway.record_external_event(
        event_type="airdrop",
        status="scheduled",
        metadata={
            "drop": "Vaultfire Relic",
            "reward": ["PoP coin", "NFT", "ASM"],
            "triggered_at": now.isoformat(),
            "reason": "weekly_loyalty_bonus",
        },
        signature="codex::airdrop",
    )
    state["last_drop_key"] = current_key
    state["last_drop_timestamp"] = now.isoformat()
    _store_state(state)
    return entry


def x402EventListener(app: Flask | None = None) -> Blueprint:
    """Return a Flask blueprint with x402 webhook + dashboard routes."""

    blueprint = Blueprint("x402_listener", __name__)
    gateway = get_default_gateway()

    @blueprint.route("/vaultfire/x402-webhook", methods=["GET", "POST"])
    def handle_webhook() -> Any:
        if request.method == "GET":
            return jsonify(
                {
                    "status": "listening",
                    "identity": gateway.identity_handle,
                    "ledger": str(gateway.ledger_path),
                    "ghostkey_mode": gateway.ghostkey_mode,
                    "anonymity_required": True,
                }
            )

        payload = request.get_json(silent=True) or {}
        event_type = payload.get("type") or payload.get("event_type") or request.args.get("type") or "payment"
        status = payload.get("status") or payload.get("payment_status") or "received"
        amount = payload.get("amount")
        amount_value: float | None
        try:
            amount_value = float(amount) if amount is not None else None
        except (TypeError, ValueError):
            amount_value = None
        currency = payload.get("currency")
        wallet_address = payload.get("wallet_address") or payload.get("wallet")
        belief_signal = payload.get("belief_signal") if isinstance(payload.get("belief_signal"), dict) else None
        signature = payload.get("signature") or payload.get("codex_signature")
        wallet_type = payload.get("wallet_type")
        trigger_phrase = payload.get("trigger_phrase") or payload.get("command")
        if not wallet_address:
            wallet_address = gateway.identity_handle
            if signature is None:
                signature = "codex::listener"
        metadata = {
            "tx_hash": payload.get("tx_hash") or payload.get("transaction_hash"),
            "loyalty_score": payload.get("loyalty_score"),
            "authorized_by": payload.get("authorized_by"),
            "relay": payload.get("relay"),
            "trigger_phrase": trigger_phrase,
        }
        try:
            entry = gateway.record_external_event(
                event_type=event_type,
                status=status,
                amount=amount_value,
                currency=currency,
                metadata=metadata,
                wallet_address=wallet_address,
                belief_signal=belief_signal,
                signature=signature,
                wallet_type=wallet_type,
            )
        except PermissionError as exc:
            return jsonify({"status": "rejected", "reason": str(exc)}), 403

        loyalty_score = float(payload.get("loyalty_score", 0.0) or 0.0)
        airdrop = _maybe_trigger_airdrop(gateway, loyalty_score)
        response: dict[str, Any] = {"status": "ok", "entry": entry}
        if airdrop is not None:
            response["airdrop"] = airdrop
        return jsonify(response)

    @blueprint.route("/vaultfire/x402-dashboard", methods=["GET"])
    def dashboard() -> Any:
        limit_param = request.args.get("limit")
        try:
            limit = int(limit_param) if limit_param is not None else 50
        except (TypeError, ValueError):
            limit = 50
        entries = load_dashboard_entries(limit=limit, gateway=gateway)
        totals = aggregate_totals(entries)
        return jsonify({
            "events": entries,
            "totals": totals,
            "count": count_total_events(gateway=gateway),
        })

    if app is not None:
        app.register_blueprint(blueprint)
    return blueprint


__all__ = ["x402EventListener"]
