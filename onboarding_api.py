# Reference: ethics/core.mdx
import json
from pathlib import Path
from flask import Flask, request, jsonify
from simulate_partner_activation import simulate_activation, ALIGNMENT_PHRASE
from engine.ens_sync_status import read_sync_status
from engine.case_studies import submit_case_study, list_case_studies

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


@app.post("/biofeedback")
def ingest_biofeedback():
    """Record biofeedback metrics from a provider."""
    data = request.get_json(silent=True) or {}
    identifier = data.get("identifier")
    provider = data.get("provider")
    metrics = data.get("metrics")
    if not identifier or not provider or not isinstance(metrics, dict):
        return jsonify({"error": "identifier, provider and metrics required"}), 400
    from engine.biofeedback import record_biofeedback
    record_biofeedback(identifier, provider, metrics)
    return jsonify({"message": "biofeedback recorded"}), 201


@app.post("/wellness/sleep")
def log_sleep():
    """Record nightly sleep hours."""
    data = request.get_json(silent=True) or {}
    identifier = data.get("identifier")
    hours = float(data.get("hours", 0))
    if not identifier or hours <= 0:
        return jsonify({"error": "identifier and hours required"}), 400
    from engine.wellness_oracle import record_sleep
    record_sleep(identifier, hours)
    return jsonify({"message": "sleep logged"}), 201


@app.post("/wellness/hydration")
def log_hydration():
    """Record hydration amount in liters."""
    data = request.get_json(silent=True) or {}
    identifier = data.get("identifier")
    amount = float(data.get("amount", 0))
    if not identifier or amount <= 0:
        return jsonify({"error": "identifier and amount required"}), 400
    from engine.wellness_oracle import record_hydration
    record_hydration(identifier, amount)
    return jsonify({"message": "hydration logged"}), 201


@app.post("/wellness/check-in")
def mental_check_in():
    """Record a mental wellness check-in."""
    data = request.get_json(silent=True) or {}
    identifier = data.get("identifier")
    mood = int(data.get("mood", 0))
    note = data.get("note", "")
    if not identifier:
        return jsonify({"error": "identifier required"}), 400
    from engine.wellness_oracle import record_checkin
    record_checkin(identifier, mood, note)
    return jsonify({"message": "check-in recorded"}), 201


@app.get("/wellness/oracle/<identifier>")
def wellness_oracle(identifier):
    """Return wellness guidance for ``identifier``."""
    from engine.wellness_oracle import wellness_guidance
    guidance = wellness_guidance(identifier)
    return jsonify({"guidance": guidance})


@app.get("/wellness/quest/<identifier>")
def wellness_quest(identifier):
    """Generate a behavior-linked health quest."""
    from engine.wellness_oracle import generate_health_quest
    quest = generate_health_quest(identifier)
    return jsonify({"quest": quest})


@app.post("/case-study")
def submit_case_study_route():
    """Store an anonymized natural treatment case study."""
    data = request.get_json(silent=True) or {}
    condition = data.get("condition")
    treatment = data.get("treatment")
    notes = data.get("notes", "")
    pseudonym = data.get("pseudonym")
    if not condition or not treatment:
        return jsonify({"error": "condition and treatment required"}), 400
    entry = submit_case_study(condition, treatment, notes, pseudonym)
    return jsonify(entry), 201


@app.get("/case-studies")
def list_case_studies_route():
    """Return stored case studies."""
    condition = request.args.get("condition")
    entries = list_case_studies(condition)
    return jsonify({"entries": entries})


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


@app.get("/health/recommendations/<identifier>")
def health_recommendations(identifier):
    """Return real-time health suggestions for ``identifier``."""
    from engine.health_node import recommendations
    recs = recommendations(identifier)
    return jsonify({"recommendations": recs})


@app.post("/arcade/event")
def record_arcade_event():
    """Log gameplay outcomes and update loyalty."""
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")
    game_id = data.get("game_id")
    outcome = data.get("outcome", {})
    achievements = data.get("achievements") or []
    loyalty = float(data.get("loyalty", 0))
    if not user_id or not game_id:
        return jsonify({"error": "user_id and game_id required"}), 400
    from engine.game_logger import log_outcome
    entry = log_outcome(user_id, game_id, outcome, achievements, loyalty)
    return jsonify(entry), 201



@app.get("/ens_sync_status")
def ens_sync_status_route():
    """Return last Vaultfire sync audit entry for an ENS name."""
    ens_name = request.args.get("ens", "")
    if not ens_name:
        return jsonify({"error": "ens parameter required"}), 400
    info = read_sync_status(ens_name)
    return jsonify(info or {})


@app.get("/status")
def status():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(debug=True)
