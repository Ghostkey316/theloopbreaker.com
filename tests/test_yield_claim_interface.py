from __future__ import annotations

import json
from datetime import datetime, timezone

from ghostkey_cli import build_parser
from vaultfire.protocol.moral_fork import TimelineFork
from vaultfire.protocol.signal_echo import SignalEchoEngine
from vaultfire.protocol.timeflare import TimeFlare


def test_yieldclaim_cli_generates_allocations(tmp_path, capsys) -> None:
    signal_engine = SignalEchoEngine()
    signal_engine.record_frame(
        "interaction-1",
        emotion="focus",
        ethic="aligned",
        intensity=0.82,
        tags=("ally", "ethic"),
    )
    signal_engine.record_frame(
        "interaction-1",
        emotion="joy",
        ethic="support",
        intensity=0.74,
        tags=("ally",),
    )
    echo_path = signal_engine.save(tmp_path / "echo.json")

    ledger_path = tmp_path / "ledger.json"
    timeflare = TimeFlare(ledger_path=ledger_path)
    timeflare.emit(
        TimelineFork(
            fork_id="fork-002",
            interaction_id="interaction-1",
            branch="monitor",
            priority="medium",
            ethic_score=0.68,
            signal_weight=0.61,
            alignment_bias=0.3,
            alignment_history=("aligned",),
            created_at=datetime.now(timezone.utc),
        )
    )

    parser = build_parser()
    args = parser.parse_args(
        [
            "yieldclaim",
            "--interaction",
            "interaction-1",
            "--wallet",
            "0xabc:1.05",
            "--wallet",
            "0xdef",
            "--ledger",
            str(ledger_path),
            "--echo-index",
            str(echo_path),
            "--mirror-seed",
            "cli-test",
            "--base",
            "175",
        ]
    )
    args.func(args)

    captured = json.loads(capsys.readouterr().out)
    assert captured["record_id"].startswith("GiftMatrixRecord")
    assert captured["interaction_id"] == "interaction-1"
    assert captured["metadata"]["timeline_branch"] == "monitor"
    assert len(captured["allocations"]) == 2
    assert captured["allocations"][0]["identity_tag"].startswith("QHM-")
