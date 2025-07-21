# Reference: ethics/core.mdx
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
LEDGER_PATH = BASE_DIR / "logs" / "token_ledger.json"
DASHBOARD_PATH = BASE_DIR / "dashboards" / "partner_earnings.json"


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


def _aggregate(entries):
    totals = {}
    for entry in entries:
        wallet = entry.get("wallet")
        token = entry.get("token")
        amount = entry.get("amount", 0)
        ts = entry.get("timestamp")
        if not wallet or not token:
            continue
        info = totals.setdefault(wallet, {"totals": {}, "last_payment": ts})
        info["totals"][token] = info["totals"].get(token, 0) + amount
        if ts and (info["last_payment"] is None or ts > info["last_payment"]):
            info["last_payment"] = ts
    return [{"wallet": w, **data} for w, data in totals.items()]


def generate_dashboard():
    ledger = _load_json(LEDGER_PATH, [])
    dashboard = _aggregate(ledger)
    _write_json(DASHBOARD_PATH, dashboard)
    return dashboard


if __name__ == "__main__":
    data = generate_dashboard()
    print(json.dumps(data, indent=2))

