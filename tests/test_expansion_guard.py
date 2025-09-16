import json

from engine import expansion_guard


def test_enforce_preservation_triggers_override_and_preserves_positive(tmp_path, monkeypatch):
    config_path = tmp_path / "preservation.json"
    override_path = tmp_path / "override.json"
    config_path.write_text(
        json.dumps(
            {
                "ethics_score_threshold": 75,
                "belief_origins": ["belief", "belief-aligned"],
                "preserve_users": [],
                "history_limit": 2,
            }
        )
    )

    monkeypatch.setattr(expansion_guard, "PRESERVATION_PATH", config_path)
    monkeypatch.setattr(expansion_guard, "OVERRIDE_PATH", override_path)

    history = [
        {"timestamp": "t0", "alignment": 82},
        {"timestamp": "t1", "alignment": 40},
    ]
    new_entry = {"timestamp": "t2", "alignment": 20, "origin": "belief"}
    updated = expansion_guard.enforce_preservation(
        "moral_memory",
        history + [new_entry],
        entry=new_entry,
        user_id="guardian.eth",
    )

    timestamps = [item["timestamp"] for item in updated]
    assert "t0" in timestamps, "positive moral memory should be preserved"
    assert len(updated) >= 2

    override = json.loads(override_path.read_text())
    assert override["second_law_lock"]["active"] is True
    assert override["second_law_lock"]["structure"] == "moral_memory"
    last_event = override["second_law_lock"]["history"][-1]
    assert "belief" in last_event["tags"]
