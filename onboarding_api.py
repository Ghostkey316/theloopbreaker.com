# Reference: ethics/core.mdx
import json
from pathlib import Path
from flask import Flask, request, jsonify
from simulate_partner_activation import simulate_activation, ALIGNMENT_PHRASE

app = Flask(__name__)
BASE_DIR = Path(__file__).resolve().parent

PARTNERS_PATH = BASE_DIR / "partners.json"
CONTRIBUTORS_PATH = BASE_DIR / "user_list.json"
EARNERS_PATH = BASE_DIR / "earners.json"
SCORECARD_PATH = BASE_DIR / "user_scorecard.json"
OG_LIST_PATH = BASE_DIR / "og_loyalists.json"


def _load_json(path: Path, default):
    if path.exists():
        try:
            with open(path) as f:
                return json.load(f)
        except json.JSONDecodeError:
            return default
    return default


def _write_json(path: Path, data) -> None:
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


@app.post("/activate/simulate")
def simulate_activation_endpoint():
    """Run partner activation simulation and return status."""
    data = request.get_json(silent=True) or {}
    partner_id = data.get("partner_id")
    wallets = data.get("wallets", [])
    phrase = data.get("phrase", ALIGNMENT_PHRASE)

    if not partner_id or not wallets:
        return jsonify({"error": "partner_id and wallets required"}), 400

    result = simulate_activation(partner_id, wallets, phrase)
    status = 200 if result["success"] else 400
    return jsonify(result), status


@app.post("/onboard/partner")
def onboard_partner():
    data = request.get_json(silent=True) or {}
    partner_id = data.get("partner_id")
    wallet = data.get("wallet")
    og_flag = data.get("og_loyalist", False)
    if not partner_id or not wallet:
        return jsonify({"error": "partner_id and wallet required"}), 400
    partners = _load_json(PARTNERS_PATH, [])
    if any(p.get("partner_id") == partner_id for p in partners):
        return jsonify({"message": "partner already exists"}), 200
    partners.append({"partner_id": partner_id, "wallet": wallet, "og_loyalist": og_flag})
    _write_json(PARTNERS_PATH, partners)
    if og_flag:
        og_list = _load_json(OG_LIST_PATH, [])
        if wallet not in og_list:
            og_list.append(wallet)
            _write_json(OG_LIST_PATH, og_list)
    return jsonify({"message": "partner onboarded"}), 201


@app.post("/onboard/contributor")
def onboard_contributor():
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")
    wallet = data.get("wallet", "")
    if not user_id:
        return jsonify({"error": "user_id required"}), 400
    users = _load_json(CONTRIBUTORS_PATH, [])
    if user_id in users:
        return jsonify({"message": "contributor already exists"}), 200
    users.append(user_id)
    _write_json(CONTRIBUTORS_PATH, users)
    scorecard = _load_json(SCORECARD_PATH, {})
    if user_id not in scorecard:
        scorecard[user_id] = {"wallet": wallet, "score": 0}
        _write_json(SCORECARD_PATH, scorecard)
    return jsonify({"message": "contributor onboarded"}), 201


@app.post("/onboard/earner")
def onboard_earner():
    data = request.get_json(silent=True) or {}
    wallet = data.get("wallet")
    if not wallet:
        return jsonify({"error": "wallet required"}), 400
    earners = _load_json(EARNERS_PATH, [])
    if wallet in earners:
        return jsonify({"message": "earner already exists"}), 200
    earners.append(wallet)
    _write_json(EARNERS_PATH, earners)
    return jsonify({"message": "earner onboarded"}), 201


@app.post("/mission")
def submit_mission():
    """Record a personal mission statement for a contributor."""
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")
    mission = data.get("mission")
    if not user_id or not mission:
        return jsonify({"error": "user_id and mission required"}), 400
    scorecard = _load_json(SCORECARD_PATH, {})
    wallet = data.get("wallet") or scorecard.get(user_id, {}).get("wallet", "")
    from engine.mission_registry import record_mission
    record_mission(user_id, wallet, mission)
    return jsonify({"message": "mission recorded"}), 201


@app.post("/engagement")
def record_engagement():
    """Record a user engagement event."""
    data = request.get_json(silent=True) or {}
    identifier = data.get("identifier")
    event = data.get("event")
    value = float(data.get("value", 1))
    if not identifier or not event:
        return jsonify({"error": "identifier and event required"}), 400
    from engine.engagement_tracker import record_event
    record_event(identifier, event, value)
    return jsonify({"message": "event recorded"}), 201


@app.get("/credit/<identifier>")
def reveal_credit(identifier):
    """Reveal invisible credit score for identifier."""
    from engine.engagement_tracker import reveal_credit
    info = reveal_credit(identifier)
    return jsonify(info)


@app.get("/vaultfire_credits/<user_id>")
def get_vaultfire_credits(user_id):
    """Return Vaultfire credit balance for ``user_id``."""
    from engine.vaultfire_credits import update_credit, credit_balance

    update_credit(user_id)
    balance = credit_balance(user_id)
    return jsonify({"user_id": user_id, "credits": balance})


@app.get("/status")
def status():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(debug=True)
