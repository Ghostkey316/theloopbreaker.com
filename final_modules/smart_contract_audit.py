"""Smart Contract Audit Verifier.

Scans deployed contract sources and records simple audit information.
Results are stored in ``audit_report.json`` and integrated with the
Verifiability Console for partner viewing.
"""
from __future__ import annotations

import re
from pathlib import Path
from datetime import datetime

from partner_modules.verifiability_console import record_audit_log

from utils.json_io import write_json

BASE_DIR = Path(__file__).resolve().parents[1]
CONTRACTS_DIR = BASE_DIR / "contracts"
REPORT_PATH = BASE_DIR / "final_modules" / "audit_report.json"


FLAGS = ["review", "unsafe"]




def audit_contracts() -> dict:
    report = []
    for path in CONTRACTS_DIR.glob("*.sol"):
        text = path.read_text()
        issues = [f for f in FLAGS if re.search(f, text, re.IGNORECASE)]
        entry = {
            "contract": path.name,
            "issues": issues,
            "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
        record_audit_log({"contract": path.name, "issues": issues})
        report.append(entry)
    write_json(REPORT_PATH, report)
    return {"contracts": report}


__all__ = ["audit_contracts"]
