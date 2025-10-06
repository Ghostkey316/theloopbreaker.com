import json

from ghostkey_cli import build_parser


def test_cli_end_to_end_stack(tmp_path, capsys) -> None:
    actions_path = tmp_path / "actions.json"
    actions_path.write_text(
        json.dumps(
            [
                {"type": "support", "weight": 2.0, "note": "ally"},
                {"type": "sacrifice", "weight": 1.5, "note": "guard"},
            ]
        )
    )

    history_path = tmp_path / "history.json"
    history_path.write_text(
        json.dumps(
            [
                {"intent": "Protect the network", "confidence": 0.92, "tags": ["guardian"]},
                {"intent": "Expand outreach", "confidence": 0.87, "tags": ["ally"]},
            ]
        )
    )

    signals_path = tmp_path / "signals.json"
    signals_path.write_text(
        json.dumps(
            [
                {"signal": 0.74, "channel": "dream", "intent": "uplift"},
                {"signal": 0.62, "channel": "echo", "intent": "guard"},
            ]
        )
    )

    parser = build_parser()

    args = parser.parse_args(
        [
            "dreamcatcher",
            "--actions",
            str(actions_path),
            "--history",
            str(history_path),
            "--signals",
            str(signals_path),
            "--listen",
        ]
    )
    args.func(args)
    dream_output = json.loads(capsys.readouterr().out)
    assert dream_output["captured"] == 2
    assert dream_output["metadata"]["requirements"]["export_format"] == "JSON"

    args = parser.parse_args(
        [
            "parallax",
            "--actions",
            str(actions_path),
            "--history",
            str(history_path),
            "--run-dual",
            "--path",
            json.dumps({"label": "uplift", "ethic": "support", "confidence": 0.91, "impact": 1.25}),
            "--path",
            json.dumps({"label": "hold", "ethic": "selfish", "confidence": 0.35, "impact": 0.3}),
        ]
    )
    args.func(args)
    parallax_output = json.loads(capsys.readouterr().out)
    assert parallax_output["selected"]["label"] == "uplift"
    assert parallax_output["metadata"]["requirements"]["resilient_inputs"] is True

    args = parser.parse_args(
        [
            "intentionmap",
            "--history",
            str(history_path),
            "--generate",
            "--intent",
            "Align ecosystems",
            "--tag",
            "mission",
        ]
    )
    args.func(args)
    intention_output = json.loads(capsys.readouterr().out)
    assert intention_output["checkpoint"]["metadata"]["requirements"]["ghostkey_tags"][0] == "Ghostkey-316"

    args = parser.parse_args(
        [
            "preview",
            "--actions",
            str(actions_path),
            "--history",
            str(history_path),
            "--stack",
        ]
    )
    args.func(args)
    preview_output = json.loads(capsys.readouterr().out)
    assert preview_output["stack"]["engines"]["dreamcatcher"]["module"] == "TemporalDreamcatcherEngine"

    args = parser.parse_args(
        [
            "signalpulse",
            "--actions",
            str(actions_path),
            "--history",
            str(history_path),
            "--signals",
            str(signals_path),
            "--trace-drift",
            "--window",
            "2",
        ]
    )
    args.func(args)
    signal_output = json.loads(capsys.readouterr().out)
    assert signal_output["metadata"]["requirements"]["CLI_scriptable"] is True
    assert len(signal_output["captures"]) <= 2
