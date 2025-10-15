from __future__ import annotations

import importlib
import sys
from pathlib import Path

import pytest


def load_module(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    repo_root = Path(__file__).resolve().parents[1]
    src_path = repo_root / "src"
    if str(src_path) not in sys.path:
        sys.path.insert(0, str(src_path))
    monkeypatch.setenv("VAULTFIRE_MIRROR_DIR", str(tmp_path))
    from mirror_log import ensure_log_environment  # noqa: F401 - ensure module import

    import mirror_log

    importlib.reload(mirror_log)

    import vaultfire_memory_mirror

    importlib.reload(vaultfire_memory_mirror)
    return vaultfire_memory_mirror


def test_register_promotes_top_priority(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    module = load_module(tmp_path, monkeypatch)

    entry = module.register_memory(
        memory_id="ghostkey-anchor",
        content="Ghostkey-316 loyalty charter",
        tags=["Vaultfire", "Ghostkey-316"],
        source="unit-test",
        alignment_score=9.5,
        engagement_delta=3,
        emotional_impact="ethics",
    )

    assert entry.top_priority is True
    assert entry.relevance_score > 10
    assert entry.reference_frequency == 1

    top = module.list_top_of_mind()
    assert len(top) == 1
    assert top[0].memory_id == "ghostkey-anchor"


def test_restore_flushed_records(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    module = load_module(tmp_path, monkeypatch)

    payload = [
        {
            "memory_id": "restored",
            "content": "Recovered Vaultfire note",
            "tags": ["Vaultfire", "Sweata Vest"],
            "alignment_score": 7.0,
            "engagement_volume": 2,
            "emotional_impact": "courage",
        },
        {
            "memory_id": "discarded",
            "content": "Unrelated entry",
            "tags": ["ambient"],
        },
    ]

    restored = module.restore_flushed_memories(payload)
    assert [entry.memory_id for entry in restored] == ["restored"]

    top = module.list_top_of_mind()
    assert any(entry.memory_id == "restored" for entry in top)


def test_ethics_override_requires_consent(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    module = load_module(tmp_path, monkeypatch)

    module.register_memory(
        memory_id="ethics-core",
        content="Ethics-first contribution",
        tags=["Vaultfire", "ethics"],
        alignment_score=8.0,
    )

    assert module.flush_memory("ethics-core") is False
    assert module.flush_memory("ethics-core", replacement_alignment=7.0) is False
    assert module.flush_memory("ethics-core", replacement_alignment=9.0) is True
