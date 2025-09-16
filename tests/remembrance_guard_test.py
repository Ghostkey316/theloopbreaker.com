import importlib.util
import sys
from pathlib import Path

import pytest

MODULE_PATH = Path(__file__).resolve().parents[1] / "engine" / "remembrance_guard.py"
spec = importlib.util.spec_from_file_location("vaultfire.remembrance_guard", MODULE_PATH)
remembrance_guard = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = remembrance_guard
spec.loader.exec_module(remembrance_guard)
LAW_TITLE = remembrance_guard.LAW_TITLE
RemembranceGuard = remembrance_guard.RemembranceGuard


@pytest.fixture
def remembrance_seed():
    belief_logs = [
        {
            "id": "belief-1",
            "contributor": "forgotten.eth",
            "insight": "Flame Weaving",
            "credited": False,
            "tags": ["fire", "loyalty"],
            "early_support": True,
            "sacrifice": 2,
        },
        {
            "id": "belief-2",
            "contributor": "ally.eth",
            "insight": "Support Spark",
            "credited": True,
        },
    ]
    memory_chains = [
        {
            "chain_id": "ghost-trail",
            "entries": [
                {
                    "id": "mem-1",
                    "contributor": "forgotten.eth",
                    "insight": "flame weaving",
                    "ghost_tagged": True,
                    "credited": False,
                    "key_breakthrough": True,
                    "tags": ["breakthrough", "fire"],
                    "consensus_required": 0.85,
                },
                {
                    "id": "mem-2",
                    "contributor": "ally.eth",
                    "insight": "support spark",
                    "ghost_tagged": False,
                    "credited": True,
                    "tags": ["support"],
                },
            ],
        }
    ]
    return belief_logs, memory_chains


def _run_detection(guard: RemembranceGuard):
    expansion_batch = [
        {
            "id": "exp-1",
            "pattern": "Flame Weaving",
            "tags": ["fire"],
        }
    ]
    return guard.detect_forgotten_contributions(expansion_batch)


def test_detects_forgotten_contributors(remembrance_seed):
    guard = RemembranceGuard(*remembrance_seed)
    triggers = _run_detection(guard)

    assert triggers, "expected remembrance trigger for overlooked contributor"
    trigger = triggers[0]
    assert trigger["label"] == LAW_TITLE
    assert trigger["pattern"] == "flame weaving"
    contributors = {item["contributor"]: item for item in trigger["contributors"]}
    assert "forgotten.eth" in contributors
    forgotten_entry = contributors["forgotten.eth"]
    assert set(forgotten_entry["sources"]) == {"belief", "memory"}
    assert forgotten_entry["ghost_tagged"] is True
    assert "fire" in forgotten_entry["goal_alignment"]


def test_routes_retroactive_yield(remembrance_seed):
    guard = RemembranceGuard(*remembrance_seed)
    triggers = _run_detection(guard)
    signals = guard.route_loyalty_signals(triggers)

    registry_entry = guard.loyalty_registry.get("forgotten.eth")
    signal = next(item for item in signals if item["contributor"] == "forgotten.eth")
    assert signal["activation"] == "delayed"
    assert signal["multiplier"] > 1.0
    assert registry_entry["pending"] is True
    assert guard.pending_yield_signals, "signals should be staged for delayed activation"


def test_prevents_memory_erasure_without_consensus(remembrance_seed):
    guard = RemembranceGuard(*remembrance_seed, consensus_threshold=0.8)
    result = guard.enforce_memory_preservation(
        [{"memory_id": "mem-1", "action": "delete", "consensus_weight": 0.5}]
    )

    assert result["locked"], "key breakthrough should be locked without sufficient consensus"
    lock = result["locked"][0]
    assert lock["memory_id"] == "mem-1"
    assert lock["reason"] == "consensus_not_met"
    assert any(entry["id"] == "mem-1" for entry in result["mirrored"])


def test_restores_mirrored_history(remembrance_seed):
    guard = RemembranceGuard(*remembrance_seed)
    guard.enforce_memory_preservation(
        [{"memory_id": "mem-2", "action": "delete", "consensus_weight": 0.95}]
    )

    restored = guard.restore_memories(["mem-2"])
    assert restored, "restoration should surface mirrored entry"
    assert restored[0]["id"] == "mem-2"
    assert restored[0]["insight"].lower() == "support spark"
