"""Simple role-based access control module for Vaultfire."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Dict

RBAC_PATH = Path("rbac_roles.json")

DEFAULT_ROLES: Dict[str, str] = {}

PERMISSIONS = {
    "freeze_refunds": {"Admin", "Operator"},
    "unfreeze_refunds": {"Admin", "Operator"},
    "view_logs": {"Admin", "Operator", "Read-Only"},
}

OVERRIDE_ENV = "VAULTFIRE_OVERRIDE_KEY"


def load_roles() -> Dict[str, str]:
    if RBAC_PATH.exists():
        try:
            with open(RBAC_PATH) as f:
                data = json.load(f)
                if isinstance(data, dict):
                    return data
        except json.JSONDecodeError:
            pass
    return DEFAULT_ROLES.copy()


def save_roles(mapping: Dict[str, str]) -> None:
    with open(RBAC_PATH, "w") as f:
        json.dump(mapping, f, indent=2)


def set_role(user_id: str, role: str) -> None:
    roles = load_roles()
    roles[user_id] = role
    save_roles(roles)


def get_role(user_id: str) -> str:
    return load_roles().get(user_id, "Read-Only")


def has_permission(user_id: str, action: str, override_key: str | None = None) -> bool:
    if override_key and override_key == os.getenv(OVERRIDE_ENV):
        return True
    role = get_role(user_id)
    allowed = PERMISSIONS.get(action, set())
    return role in allowed

__all__ = [
    "load_roles",
    "save_roles",
    "set_role",
    "get_role",
    "has_permission",
]
