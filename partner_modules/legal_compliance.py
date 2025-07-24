from __future__ import annotations

"""Legal and compliance utilities for partners."""

import json
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
COMPLIANCE_CFG = BASE_DIR / "vaultfire-core" / "partner_compliance.json"
CONTRACTS_DIR = BASE_DIR / "contracts"

REGION_MAP = {
    "EU": "GDPR",
    "CA": "CCPA",
    "GS": "Vaultfire GlobalSafe",
}


# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------


def view_contract(name: str) -> str:
    """Return contents of contract ``name`` for partner review."""
    path = CONTRACTS_DIR / name
    if not path.exists():
        raise FileNotFoundError(name)
    return path.read_text()


TERMS_TMPL = (
    "Vaultfire Terms of Service for {partner_id}\n"
    "Region Mode: {region}\n"
    "Use of the protocol requires opt-in consent and compliance with"
    " all Vaultfire ethics checks."
)

PRIVACY_TMPL = (
    "Vaultfire Privacy Policy for {partner_id}\n"
    "Region Mode: {region}\n"
    "Data is stored only as needed for protocol operation and may be"
    " removed on request."
)


def generate_terms(partner_id: str) -> str:
    cfg = _load_json(COMPLIANCE_CFG, {}).get(partner_id, {})
    region = REGION_MAP.get(cfg.get("region", "GS"), "Vaultfire GlobalSafe")
    return TERMS_TMPL.format(partner_id=partner_id, region=region)


def generate_privacy_policy(partner_id: str) -> str:
    cfg = _load_json(COMPLIANCE_CFG, {}).get(partner_id, {})
    region = REGION_MAP.get(cfg.get("region", "GS"), "Vaultfire GlobalSafe")
    return PRIVACY_TMPL.format(partner_id=partner_id, region=region)


def set_region(partner_id: str, region: str) -> None:
    """Store compliance region for ``partner_id``."""
    if region not in REGION_MAP:
        raise ValueError("invalid region")
    cfg = _load_json(COMPLIANCE_CFG, {})
    cfg[partner_id] = {"region": region, "timestamp": datetime.utcnow().isoformat()}
    _write_json(COMPLIANCE_CFG, cfg)


def region_mode(partner_id: str) -> str:
    cfg = _load_json(COMPLIANCE_CFG, {}).get(partner_id, {})
    return REGION_MAP.get(cfg.get("region", "GS"), "Vaultfire GlobalSafe")


def content_allowed(partner_id: str, region: str) -> bool:
    """Return ``True`` if ``region`` is allowed for ``partner_id``."""
    cfg_region = _load_json(COMPLIANCE_CFG, {}).get(partner_id, {}).get("region", "GS")
    return cfg_region == region or cfg_region == "GS"
