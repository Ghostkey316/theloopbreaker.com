import json
from pathlib import Path

from ghostkey_protocol_cli import run_cli


def test_intention_mapping_integration(tmp_path: Path) -> None:
    config = {
        "user_id": "ghostkey316",
        "actions": [
            {"ethic": "support", "weight": 2.0, "note": "ally"},
            {"ethic": "betrayal", "weight": 1.1, "note": "review"},
        ],
        "exports": {"core": 0.7, "ally": 0.3},
        "profile": {"role": "guardian"},
        "intents": [{"intent": "Expand Vaultfire outreach", "confidence": 0.91}],
        "trust_threshold": 0.55,
        "intent_override": "mission-drift",
        "ego_gate": {"impact": 1.4, "ego": 0.35},
        "recipients": ["0xabc:1.1", {"wallet": "0xdef", "belief_multiplier": 1.25}],
        "signals": [{"signal": 0.67, "channel": "dream", "intent": "uplift"}],
        "paths": [
            {"label": "uplift", "ethic": "support", "confidence": 0.9, "impact": 1.2},
            {"label": "pause", "ethic": "selfish", "confidence": 0.35, "impact": 0.3},
        ],
        "intent": "Align networks",
        "tags": ["mission", "guardian"],
        "signal": 0.72,
        "claim_id": "claim-ready",
    }
    path = tmp_path / "config.json"
    path.write_text(json.dumps(config))

    intention_output = json.loads(run_cli(["--json", str(path), "intentionmap", "--generate"]))
    assert intention_output["entry"]["intent"] == "Align networks"
    assert intention_output["checkpoint"]["profile"]["role"] == "guardian"

    timecheck = json.loads(run_cli(["--json", str(path), "timecheck"]))
    assert "First-of-its-Kind" in timecheck["metadata"]["tags"]

    soulpush = json.loads(run_cli(["--json", str(path), "soulpush"]))
    assert soulpush["record"]["payload"]["intent"] == "mission-drift"

    gift_preview = json.loads(run_cli(["--json", str(path), "giftmatrix"]))
    assert len(gift_preview["allocations"]) == 2
    assert gift_preview["metadata"]["identity"]["ens"] == "ghostkey316.eth"

    dream_summary = json.loads(run_cli(["--json", str(path), "dreamcatcher", "--listen"]))
    assert dream_summary["captured"] == 1

    parallax = json.loads(run_cli(["--json", str(path), "parallax", "--run-dual"]))
    assert parallax["selected"]["label"] == "uplift"

    alignment_preview = json.loads(run_cli(["--json", str(path), "preview", "--alignmentpath"]))
    assert alignment_preview["metadata"]["tags"][0] == "First-of-its-Kind"
    assert "mission" in alignment_preview["tags"]

    drift = json.loads(run_cli(["--json", str(path), "signalpulse", "--trace-drift"]))
    assert drift["metadata"]["identity"]["wallet"] == "bpow20.cb.id"
