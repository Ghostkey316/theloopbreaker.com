import json
from pathlib import Path

import pytest

from vaultfire_codex import FinalizeProtocolResult, MirrorTriggerResult, finalize_protocol, mirror_trigger


@pytest.fixture(autouse=True)
def _isolate_logs(tmp_path, monkeypatch):
    monkeypatch.setenv("VAULTFIRE_CODEX_LOG_DIR", str(tmp_path))
    return tmp_path


def _read_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


def test_finalize_protocol_records_event(tmp_path):
    result = finalize_protocol(
        ethics_framework="Ghostkey Ethics v2.0",
        contributor_id="Ghostkey-316",
        ens="ghostkey316.eth",
        main_wallet="bpow20.cb.id",
        modules=["Vaultfire22Core", "UltraShadow", "Vaultfire22Core"],
        gui_hooks=True,
        partner_plugin_support=True,
        relay_ready=True,
        zkmirror_sync=True,
        secure_cli_export=True,
        retro_reward_trace=True,
        telemetry_opt_in=True,
        fallback_audit_route="VaultfirePrivacyNet",
        mirror_activation_window="global",
        moral_fingerprint_mode="ON",
        runtime_validation=True,
        loyalty_proof_snapshot="live",
        codex_signature="Vaultfire 🔥 v1.0 — Architect locked",
    )

    assert isinstance(result, FinalizeProtocolResult)
    assert result.modules == ("Vaultfire22Core", "UltraShadow")
    assert result.options["ethics_framework"] == "Ghostkey Ethics v2.0"

    log_path = tmp_path / "codex_finalization_log.jsonl"
    payloads = _read_jsonl(log_path)
    assert len(payloads) == 1
    payload = payloads[0]
    assert payload["event"] == "finalize_protocol"
    assert payload["checksum"] == result.checksum
    assert payload["modules"] == ["Vaultfire22Core", "UltraShadow"]


def test_finalize_protocol_simplified_interface(tmp_path):
    result = finalize_protocol(
        session_id="ghostkey316.eth",
        origin_wallet="bpow20.cb.id",
        trigger_reason="Vaultfire Codex v1.0 finalization and public activation",
        notify_on_success=["OpenAI", "NS3", "AssembleAI", "Worldcoin", "OpenAI"],
    )

    assert isinstance(result, FinalizeProtocolResult)
    assert result.contributor_id == "ghostkey316.eth"
    assert result.modules == ("protocol.finalized",)
    assert result.options["mode"] == "simplified"
    assert result.options["notify_on_success"] == (
        "AssembleAI",
        "NS3",
        "OpenAI",
        "Worldcoin",
    )

    log_path = tmp_path / "codex_finalization_log.jsonl"
    payloads = _read_jsonl(log_path)
    assert len(payloads) == 1
    payload = payloads[0]
    assert payload["event"] == "finalize_protocol"
    assert payload["modules"] == ["protocol.finalized"]
    assert payload["options"]["trigger_reason"] == "Vaultfire Codex v1.0 finalization and public activation"


def test_mirror_trigger_records_notifications(tmp_path):
    result = mirror_trigger(
        fork_ready=True,
        beliefnet_activation=True,
        dao_init_signal=True,
        contributor_file_visibility="Ghostkey-316: live + immutable",
        vaultfire_cli_mode="scaling + deploy + fade + cloak",
        ens_record_update="ghostkey316.eth",
        relay_index="vaultfire.io/relays/ghostkey316",
        zk_proof_mode="GhostMirrorSafe v1.2",
        notify_on_success=["OpenAI", "NS3", "OpenAI", "Worldcoin"],
    )

    assert isinstance(result, MirrorTriggerResult)
    assert result.notifications == ("NS3", "OpenAI", "Worldcoin")

    log_path = tmp_path / "codex_mirror_trigger_log.jsonl"
    payloads = _read_jsonl(log_path)
    assert len(payloads) == 1
    payload = payloads[0]
    assert payload["event"] == "mirror_trigger"
    assert payload["checksum"] == result.checksum
    assert payload["notifications"] == ["NS3", "OpenAI", "Worldcoin"]


def test_mirror_trigger_simplified_interface(tmp_path):
    result = mirror_trigger(
        mirror_type="global_sync",
        source="VaultfireCodex-v1.0",
        payload={
            "auth": "Ghostkey316",
            "integrity": "✅",
            "codex_state": "finalized",
            "version": "v1.0",
            "wallet": "bpow20.cb.id",
            "ENS": "ghostkey316.eth",
            "yield_request": True,
            "public_display_ready": True,
        },
    )

    assert isinstance(result, MirrorTriggerResult)
    assert result.vaultfire_cli_mode == "global_sync"
    assert result.ens_record_update == "ghostkey316.eth"
    assert result.notifications == ()
    assert result.options["mode"] == "simplified"
    assert result.options["payload"]["version"] == "v1.0"

    log_path = tmp_path / "codex_mirror_trigger_log.jsonl"
    payloads = _read_jsonl(log_path)
    assert len(payloads) == 1
    payload = payloads[0]
    assert payload["event"] == "mirror_trigger"
    assert payload["vaultfire_cli_mode"] == "global_sync"
    assert payload["options"]["payload"]["codex_state"] == "finalized"


def test_finalize_protocol_requires_modules_sequence():
    with pytest.raises(TypeError):
        finalize_protocol(
            ethics_framework="Ghostkey Ethics v2.0",
            contributor_id="Ghostkey-316",
            ens="ghostkey316.eth",
            main_wallet="bpow20.cb.id",
            modules="Vaultfire22Core",
            gui_hooks=True,
            partner_plugin_support=True,
            relay_ready=True,
            zkmirror_sync=True,
            secure_cli_export=True,
            retro_reward_trace=True,
            telemetry_opt_in=True,
            fallback_audit_route="VaultfirePrivacyNet",
            mirror_activation_window="global",
            moral_fingerprint_mode="ON",
            runtime_validation=True,
            loyalty_proof_snapshot="live",
            codex_signature="Vaultfire 🔥 v1.0 — Architect locked",
        )
