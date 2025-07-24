from __future__ import annotations

"""DevKit generator and SDK asset helpers."""

import json
from pathlib import Path
try:
    from flask import Flask
except Exception:  # pragma: no cover - optional dependency
    Flask = None  # type: ignore

BASE_DIR = Path(__file__).resolve().parents[1]
DOCS_PATH = BASE_DIR / "docs" / "openapi.json"
SDK_DIR = BASE_DIR / "partner_modules" / "sdk"


def generate_openapi(app: Flask) -> dict:
    """Generate a minimal OpenAPI spec from Flask routes."""
    if Flask is None:
        raise RuntimeError("Flask not available")
    spec = {"openapi": "3.0.0", "info": {"title": "Vaultfire API", "version": "1.0"}, "paths": {}}
    for rule in app.url_map.iter_rules():
        if rule.endpoint == "static":
            continue
        methods = [m for m in rule.methods if m in {"GET", "POST", "PUT", "DELETE"}]
        if not methods:
            continue
        spec["paths"][rule.rule] = {m.lower(): {"summary": rule.endpoint} for m in methods}
    DOCS_PATH.write_text(json.dumps(spec, indent=2))
    return spec


def sdk_stub_paths() -> dict:
    """Return filesystem paths for generated SDK stubs."""
    return {
        "javascript": SDK_DIR / "js" / "vaultfire.js",
        "python": SDK_DIR / "python" / "vaultfire.py",
        "solidity": SDK_DIR / "solidity" / "VaultfireInterface.sol",
        "mini_app": SDK_DIR / "mini_app" / "app.js",
    }
