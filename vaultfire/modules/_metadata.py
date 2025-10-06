"""Shared metadata helpers for Vaultfire modules."""

from __future__ import annotations

REQUIRED_TAGS: tuple[str, ...] = (
    "Ghostkey-316",
    "Trust-Certified",
    "No Ego Override",
    "Morals-First",
)

METADATA_REQUIREMENTS: dict[str, object] = {
    "ghostkey_tags": list(REQUIRED_TAGS),
    "export_format": "JSON",
    "resilient_inputs": True,
    "CLI_scriptable": True,
}


def build_metadata(module: str, *, identity: dict[str, object]) -> dict[str, object]:
    """Return a metadata payload embedding the required Ghostkey tags."""

    payload = dict(identity)
    return {
        "module": module,
        "first_of_its_kind": True,
        "identity": payload,
        "tags": REQUIRED_TAGS,
        "requirements": METADATA_REQUIREMENTS,
    }


__all__ = ["REQUIRED_TAGS", "METADATA_REQUIREMENTS", "build_metadata"]

