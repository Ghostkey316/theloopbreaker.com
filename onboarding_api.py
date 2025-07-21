import json
from pathlib import Path
from flask import Flask, request, jsonify

app = Flask(__name__)
BASE_DIR = Path(__file__).resolve().parent

PARTNERS_PATH = BASE_DIR / "partners.json"
CONTRIBUTORS_PATH = BASE_DIR / "user_list.json"
EARNERS_PATH = BASE_DIR / "earners.json"
SCORECARD_PATH = BASE_DIR / "user_scorecard.json"


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


@app.post("/onboard/partner")
def onboard_partner():
    data = request.get_json(silent=True) or {}
    partner_id = data.get("partner_id")
    wallet = data.get("wallet")
    if not partner_id or not wallet:
        return jsonify({"error": "partner_id and wallet required"}), 400
    partners = _load_json(PARTNERS_PATH, [])
    if any(p.get("partner_id") == partner_id for p in partners):
        return jsonify({"message": "partner already exists"}), 200
    partners.append({"partner_id": partner_id, "wallet": wallet})
    _write_json(PARTNERS_PATH, partners)
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


@app.get("/status")
def status():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(debug=True)
