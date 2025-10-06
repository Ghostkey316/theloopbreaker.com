"""Tests for :mod:`vaultfire.protocols` contributor pass helpers."""

from __future__ import annotations

import json
import hashlib
from pathlib import Path

import pytest

from vaultfire.protocols import activate_contributor_pass


def test_activate_contributor_pass_logs_payload(tmp_path: Path) -> None:
    log_path = tmp_path / "activations.jsonl"
    payload = activate_contributor_pass(
        id="Ghostkey-316",
        wallet="bpow20.cb.id",
        roles=["Architect", "Signal Anchor", "NS3 Moral Layer"],
        access_level="Contributor v2",
        unlocks=["Priority Threads", "System Feedback Portals", "Ethics Integration Hub"],
        log_path=log_path,
    )

    assert payload["id"] == "Ghostkey-316"
    assert payload["wallet"] == "bpow20.cb.id"
    assert payload["roles"] == ["Architect", "Signal Anchor", "NS3 Moral Layer"]
    assert payload["unlocks"] == [
        "Priority Threads",
        "System Feedback Portals",
        "Ethics Integration Hub",
    ]
    assert payload["access_level"] == "Contributor v2"
    assert payload["status"] == "active"
    assert payload["protocol"] == "vaultfire.contributor_pass"
    assert payload["version"] == 1
    assert len(payload["activation_id"]) == 32

    checksum_source = {
        "id": payload["id"],
        "wallet": payload["wallet"],
        "access_level": payload["access_level"],
        "roles": tuple(payload["roles"]),
        "unlocks": tuple(payload["unlocks"]),
        "activation_id": payload["activation_id"],
        "activated_at": payload["activated_at"],
    }
    expected_checksum = hashlib.sha256(
        json.dumps(checksum_source, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    assert payload["checksum"] == expected_checksum

    assert log_path.exists()
    logged_payloads = [json.loads(line) for line in log_path.read_text().splitlines() if line]
    assert logged_payloads == [payload]


@pytest.mark.parametrize(
    "field, value, error",
    [
        ("id", "", ValueError),
        ("wallet", "   ", ValueError),
        ("roles", [], ValueError),
        ("roles", [""], ValueError),
        ("access_level", "", ValueError),
        ("unlocks", [], ValueError),
        ("unlocks", ["   "], ValueError),
    ],
)
def test_activate_contributor_pass_validates_inputs(field: str, value, error, tmp_path: Path) -> None:
    kwargs = dict(
        id="Ghostkey-316",
        wallet="bpow20.cb.id",
        roles=["Architect"],
        access_level="Contributor v2",
        unlocks=["Priority Threads"],
        log_path=tmp_path / "log.jsonl",
    )
    kwargs[field] = value
    with pytest.raises(error):
        activate_contributor_pass(**kwargs)
