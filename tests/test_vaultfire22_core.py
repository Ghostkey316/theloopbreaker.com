from __future__ import annotations

from vaultfire.modules import Vaultfire22Core


def test_vaultfire22_core_deploy_generates_mirrored_payload() -> None:
    core = Vaultfire22Core("bpow20.cb.id")
    payload = core.deploy()

    mirror_sync = payload["mirror_sync"]
    origin = mirror_sync["origin"]
    mirrored = mirror_sync["mirror"]

    assert origin["entropy_hex"][::-1] == mirrored["entropy_hex"]
    assert origin["signature"][::-1] == mirrored["signature"]
    assert origin["lineage"] != mirrored["lineage"]

    assert payload["entropy_id"] == origin["entropy_hex"]
    assert payload["ghost_signature"].startswith("ghostkey:bpow20.cb.id")
    assert payload["storyfield"].startswith("loop_")
    assert payload["fade_trace"]
    assert "bpow20.cb.id" in payload["grid_status"]
