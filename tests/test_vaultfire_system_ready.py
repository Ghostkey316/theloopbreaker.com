from pathlib import Path

from vaultfire_system_ready import _audit_credentials


def test_audit_credentials_flags_placeholder(tmp_path: Path) -> None:
    config = tmp_path / "telemetry.yaml"
    config.write_text("password: change-me\n")

    issues, summary = _audit_credentials([config])

    assert issues == [
        f"placeholder credential in {config}:{1} (password)"
    ]
    assert summary[config.name]["status"] == "placeholder"
    assert summary[config.name]["flagged"] == ["password@1"]


def test_audit_credentials_accepts_configured_values(tmp_path: Path) -> None:
    config = tmp_path / "reward-streams.yaml"
    config.write_text(
        "serviceRoleKey: vaultfire-service-role-v1\npassword: vaultfire-telemetry-ops-bridge\n"
    )

    issues, summary = _audit_credentials([config])

    assert not issues
    assert summary[config.name]["status"] == "ok"
    assert summary[config.name]["flagged"] == []
    assert set(summary[config.name]["sensitive_keys"]) == {"password", "serviceRoleKey"}
