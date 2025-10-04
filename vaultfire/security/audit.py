"""Audit helpers for SecureStore fallback validation."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

_REPO_ROOT = Path(__file__).resolve().parents[2]
_AUDIT_LOG_PATH = _REPO_ROOT / "secure_upload" / "securestore_fallback_audit.jsonl"

_VALID_ENVIRONMENTS = {"staging", "production", "sandbox"}


def _fallback_available() -> bool:
    securestore_path = _REPO_ROOT / "SecureStore.py"
    vaultfire_impl = _REPO_ROOT / "vaultfire_securestore.py"
    return securestore_path.exists() and vaultfire_impl.exists()


def validate_securestore_fallback(*, environment: str, wallet: str) -> Dict[str, Any]:
    """Run a lightweight SecureStore fallback validation."""

    if environment not in _VALID_ENVIRONMENTS:
        raise ValueError(
            f"environment must be one of {sorted(_VALID_ENVIRONMENTS)}, got '{environment}'"
        )
    if not wallet or not wallet.strip():
        raise ValueError("wallet must be provided")

    audit_event = {
        "environment": environment,
        "wallet": wallet.strip(),
        "fallback_available": _fallback_available(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": "passed",
        "checks": {
            "module_present": (_REPO_ROOT / "SecureStore.py").exists(),
            "fallback_present": (_REPO_ROOT / "vaultfire_securestore.py").exists(),
            "secure_upload_dir": (_REPO_ROOT / "secure_upload").exists(),
        },
    }

    if not audit_event["fallback_available"]:
        audit_event["status"] = "failed"

    _AUDIT_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _AUDIT_LOG_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(audit_event) + "\n")

    return audit_event


__all__ = ["validate_securestore_fallback"]
