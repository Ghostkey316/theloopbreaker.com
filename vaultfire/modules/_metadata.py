"""Shared metadata helpers for Vaultfire modules."""

from __future__ import annotations

REQUIRED_TAGS: tuple[str, ...] = (
    "First-of-its-Kind",
    "Ghostkey-316 Certified",
    "Vaultfire-Compliant",
    "Ethic-Led Stack",
    "Trust-Weighted Engine",
    "Morals-First Chain Ready",
    "Soul-Compatible Protocols",
)


def build_metadata(module: str, *, identity: dict[str, object]) -> dict[str, object]:
    """Return a metadata payload embedding the required Ghostkey tags."""

    payload = dict(identity)
    return {
        "module": module,
        "first_of_its_kind": True,
        "identity": payload,
        "tags": REQUIRED_TAGS,
    }


__all__ = ["REQUIRED_TAGS", "build_metadata"]

