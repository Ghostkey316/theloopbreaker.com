import asyncio
import json
from pathlib import Path

import pytest

from codex.enterprise_sync_validator import EnterpriseCodexValidator
from integration.cross_chain import CrossChainSyncScenario
from telemetry.enterprise_telemetry import TelemetryPipeline


def test_telemetry_pipeline_generates_dashboard(tmp_path: Path) -> None:
    pipeline = TelemetryPipeline(tmp_path)

    async def fake_fetch() -> dict:
        return {"block_number": 1, "transactions": [1, 2, 3, 4], "gas_used": 1_000_000}

    pipeline._fetch_block_payload = fake_fetch  # type: ignore[assignment]
    dashboard = asyncio.run(
        pipeline.stream(iterations=3, interval_seconds=0, synthetic_population=12)
    )
    assert dashboard.session_replays == 3
    data = json.loads((tmp_path / "enterprise_dashboard.json").read_text(encoding="utf-8"))
    assert data["identity_tag"] == "ghostkey-316"
    first_line = (tmp_path / "enterprise_session.jsonl").read_text(encoding="utf-8").splitlines()[0]
    assert json.loads(first_line)["identity_tag"] == "ghostkey-316"


def test_cross_chain_scenario(tmp_path: Path) -> None:
    scenario = CrossChainSyncScenario(output_dir=tmp_path)
    result = scenario.run()
    assert result.status == "SYNCED"
    assert (tmp_path / "cross_chain_sync.json").exists()


def test_enterprise_codex_validator(tmp_path: Path) -> None:
    manifest = {
        "contributor_identity": {
            "ens": "ghostkey316.eth",
            "wallet": "bpow20.cb.id"
        }
    }
    (tmp_path / "codex_manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    (tmp_path / "onboarding").mkdir()
    (tmp_path / "onboarding/enterprise_partner_template.md").write_text("template", encoding="utf-8")
    (tmp_path / "belief-engine").mkdir()
    (tmp_path / "loyalty_engine.py").write_text("", encoding="utf-8")
    (tmp_path / "ghostkey_cli.py").write_text("", encoding="utf-8")
    (tmp_path / "vaultfire_cli").mkdir()
    artifacts = tmp_path / "integration/artifacts"
    artifacts.mkdir(parents=True)
    artifacts.joinpath("cross_chain_sync.json").write_text(
        json.dumps({"status": "SYNCED"}), encoding="utf-8"
    )
    validator = EnterpriseCodexValidator(repo_root=tmp_path)
    results = validator.run()
    assert all(result.passed for result in results)
