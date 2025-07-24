"""Vaultfire AI Companion API (v1.0).

This Flask app exposes a small API surface for partners to interact
with the Vaultlink AI companion. It ties into the Ghostkey identity and
BeliefSync modules via the existing ``vaultlink`` engine.
"""
from __future__ import annotations

import json
from pathlib import Path
from flask import Flask, request, jsonify

from engine.vaultlink import (
    onboard_companion,
    record_interaction,
    fetch_state,
    transfer_companion_state,
)
from engine.identity_resolver import resolve_identity
from partner_modules.verifiability_console import record_audit_log

app = Flask(__name__)
BASE_DIR = Path(__file__).resolve().parent
LOG_PATH = BASE_DIR / "companion_api_log.json"


def _load_json(path: Path, default):
    if path.exists():
        try:
            with open(path) as f:
                return json.load(f)
        except json.JSONDecodeError:
            return default
    return default


def _write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


@app.post("/companion/onboard")
def companion_onboard():
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")
    key = data.get("key")
    wallet = data.get("wallet", "")
    if not user_id or not key:
        return jsonify({"error": "user_id and key required"}), 400
    try:
        state = onboard_companion(user_id, key)
    except Exception as e:  # pragma: no cover - runtime check
        return jsonify({"error": str(e)}), 400
    if wallet:
        resolved = resolve_identity(wallet)
    else:
        resolved = None
    entry = {"event": "onboard", "user": user_id, "wallet": resolved}
    record_audit_log(entry)
    log = _load_json(LOG_PATH, [])
    log.append(entry)
    _write_json(LOG_PATH, log)
    return jsonify(state), 201


@app.post("/companion/guide")
def companion_guide():
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")
    key = data.get("key")
    text = data.get("text", "")
    domain = data.get("domain", "general")
    if not user_id or not key:
        return jsonify({"error": "user_id and key required"}), 400
    result = record_interaction(user_id, text, domain, 1.0, False, key)
    record_audit_log({"event": "guide", "user": user_id, "domain": domain})
    return jsonify(result)


@app.get("/companion/state/<user_id>")
def companion_state(user_id):
    key = request.args.get("key")
    if not key:
        return jsonify({"error": "key required"}), 400
    try:
        state = fetch_state(user_id, key)
    except Exception as e:  # pragma: no cover - runtime check
        return jsonify({"error": str(e)}), 400
    return jsonify(state)


@app.post("/companion/transfer")
def companion_transfer():
    data = request.get_json(silent=True) or {}
    from_user = data.get("from_user")
    to_user = data.get("to_user")
    from_key = data.get("from_key")
    to_key = data.get("to_key")
    if not (from_user and to_user and from_key and to_key):
        return jsonify({"error": "from_user, to_user, from_key, to_key required"}), 400
    try:
        result = transfer_companion_state(from_user, to_user, from_key, to_key)
    except Exception as e:  # pragma: no cover - runtime check
        return jsonify({"error": str(e)}), 400
    record_audit_log({"event": "transfer", "from": from_user, "to": to_user})
    return jsonify(result)


__all__ = [
    "app",
]
