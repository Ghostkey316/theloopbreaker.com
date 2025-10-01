
import importlib
import json
import os
import sys
from pathlib import Path


MODULES = (
    "mirror_log",
    "memory_graph",
    "moral_alignment",
    "vaultfire.rewards",
)


def _reload_modules(tmp_path):
    os.environ["VAULTFIRE_MIRROR_DIR"] = str(tmp_path / "mirror_assets")
    src_path = Path.cwd() / "src"
    sys.path.insert(0, str(src_path))
    for module_name in MODULES:
        if module_name in sys.modules:
            del sys.modules[module_name]
    mirror_log = importlib.import_module("mirror_log")
    memory_graph = importlib.import_module("memory_graph")
    moral_alignment = importlib.import_module("moral_alignment")
    rewards = importlib.import_module("vaultfire.rewards")
    return mirror_log, memory_graph, moral_alignment, rewards


def test_reflection_pipeline_creates_artifacts(tmp_path):
    mirror_log, memory_graph, moral_alignment, rewards = _reload_modules(tmp_path)

    entry = (
        "I feel grateful and hopeful about our community progress while"
        " courageously repairing missteps."
    )
    timestamp = "2024-01-01T00:00:00Z"

    alignment = moral_alignment.evaluate_entry(entry)
    node = memory_graph.update_graph(
        entry,
        timestamp=timestamp,
        alignment_score=alignment["normalized"],
    )
    mirror_log.log_sample(
        entry,
        timestamp,
        tags=node["themes"],
        alignment_score=alignment["normalized"],
    )
    event = rewards.calculate(
        entry,
        alignment=alignment,
        graph_node=node,
        timestamp=timestamp,
    )

    second_entry = (
        "Today I feel courageous supporting our community and repairing harm"
        " with hopeful intent."
    )
    second_timestamp = "2024-01-02T00:00:00Z"
    second_alignment = moral_alignment.evaluate_entry(second_entry)
    second_node = memory_graph.update_graph(
        second_entry,
        timestamp=second_timestamp,
        alignment_score=second_alignment["normalized"],
    )
    mirror_log.log_sample(
        second_entry,
        second_timestamp,
        tags=second_node["themes"],
        alignment_score=second_alignment["normalized"],
    )
    rewards.calculate(
        second_entry,
        alignment=second_alignment,
        graph_node=second_node,
        timestamp=second_timestamp,
    )

    log_path = mirror_log.log_file_path()
    log_text = log_path.read_text(encoding="utf-8")
    assert "2024-01-01T00:00:00Z" in log_text
    assert "2024-01-02T00:00:00Z" in log_text
    assert "Alignment score" in log_text

    graph_data = json.loads(mirror_log.memory_graph_path().read_text(encoding="utf-8"))
    assert len(graph_data["nodes"]) == 2
    assert graph_data["nodes"][1]["id"] == second_node["id"]
    assert graph_data["edges"]
    assert graph_data["edges"][-1]["target"] == second_node["id"]

    stream_lines = mirror_log.reward_stream_path().read_text(encoding="utf-8").strip().splitlines()
    assert len(stream_lines) == 2
    recorded_event = json.loads(stream_lines[-1])
    assert recorded_event["calculated_amount"]
    assert recorded_event["dominant_emotion"] == second_node["dominant_emotion"]

    partners = Path("vaultfire_rewards.json")
    if partners.exists():
        assert recorded_event["partners"]  # ensure routing uses config when available
