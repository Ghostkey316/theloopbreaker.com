from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List


def enable_partner_module_access_layer(base_dir: Path | None = None) -> Dict[str, Any]:
    """Enable partner module access layer with transparency logging."""
    base_dir = base_dir or Path(__file__).resolve().parent
    cfg_path = base_dir / "vaultfire-core" / "vaultfire_config.json"
    modules_path = base_dir / "partner_modules" / "edge_opt_in.json"
    log_path = base_dir / "dashboards" / "partner_opt_in_log.json"

    partner_modules: List[Dict[str, Any]] = [
        {"name": "Vaultfire Edge Trading AI", "access": "optional"},
        {"name": "Real-Time Signal API", "access": "optional"},
        {"name": "Private Partner Dashboard", "access": "optional"},
        {"name": "Vaultfire Analytics Pro", "access": "optional"},
        {"name": "Token Routing Toolkit", "access": "optional"},
    ]

    for module in partner_modules:
        module["trust_tag"] = "Edge Mode: Declared"
        module["requires_signed_disclosure"] = True

    cfg: Dict[str, Any] = {}
    if cfg_path.exists():
        try:
            with open(cfg_path) as f:
                cfg = json.load(f)
        except json.JSONDecodeError:
            cfg = {}
    cfg["partner_module_access_layer"] = True
    cfg_path.parent.mkdir(parents=True, exist_ok=True)
    with open(cfg_path, "w") as f:
        json.dump(cfg, f, indent=2)

    modules_path.parent.mkdir(parents=True, exist_ok=True)
    with open(modules_path, "w") as f:
        json.dump(partner_modules, f, indent=2)

    log: List[Dict[str, Any]] = []
    if log_path.exists():
        try:
            with open(log_path) as f:
                log = json.load(f)
        except json.JSONDecodeError:
            log = []
    entry = {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "modules": [m["name"] for m in partner_modules],
    }
    log.append(entry)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with open(log_path, "w") as f:
        json.dump(log, f, indent=2)

    return {"config": cfg, "modules": partner_modules, "log_entry": entry}


if __name__ == "__main__":
    result = enable_partner_module_access_layer()
    print(json.dumps(result, indent=2))
