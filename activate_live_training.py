"""Enable live training mode in the Vaultfire configuration."""
from __future__ import annotations

import json
from pathlib import Path

CFG_PATH = Path(__file__).resolve().parent / "vaultfire-core" / "vaultfire_config.json"


def activate() -> dict:
    data = {}
    if CFG_PATH.exists():
        try:
            with open(CFG_PATH) as f:
                data = json.load(f)
        except json.JSONDecodeError:
            data = {}
    data["live_training_mode"] = True
    with open(CFG_PATH, "w") as f:
        json.dump(data, f, indent=2)
    return data


if __name__ == "__main__":
    result = activate()
    print(json.dumps({"live_training_mode": result.get("live_training_mode")}, indent=2))
