import json
from pathlib import Path

from vaultfire.quantum.sovereign_layer import MoralAlignmentSimulator


def test_moral_alignment_simulator_generates_outputs(tmp_path):
    scenario = {"id": "quantum-sovereign-drill", "context": "alignment"}
    scenario_path = tmp_path / "scenario.json"
    scenario_path.write_text(json.dumps(scenario))

    simulator = MoralAlignmentSimulator(tmp_path / "mas_output")
    belief_matrix = [[0.9, 0.85], [0.8, 0.95]]
    result = simulator.simulate(scenario_path, belief_matrix, moral_spine={"empathy": 0.4, "clarity": 0.3, "courage": 0.3})

    trace_path = Path(result["trace"])
    scores_path = Path(result["scores"])
    assert trace_path.exists()
    assert scores_path.exists()

    scores = json.loads(scores_path.read_text())
    assert scores["scenario_id"] == "quantum-sovereign-drill"
    assert scores["rollback_hash"].startswith("poseidon-")

    trace_content = trace_path.read_text().strip()
    regenerated = MoralAlignmentSimulator._rollback_hash(trace_content, belief_matrix)
    assert regenerated == scores["rollback_hash"]
