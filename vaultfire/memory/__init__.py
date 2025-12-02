"""Vaultfire Memory Layer v1.0 primitives."""

from importlib import import_module

from vaultfire.memory.modules.memory_thread import MemoryThreadCore, TimeAnchor, TimePulseSync
from vaultfire.memory.modules.recall_loop import EmotionTraceRouter, RecallLoopModule
from vaultfire.memory.cli.mind_trace import MindTraceCLI

__all__ = [
    "EmotionTraceRouter",
    "MemoryThreadCore",
    "MindTraceCLI",
    "RecallLoopModule",
    "TimeAnchor",
    "TimePulseSync",
    "VaultLoopSnapshot",
    "VaultMemorySync",
    "VaultproofVerifier",
    "VerificationResult",
    "LoopMemoryCLI",
]


def __getattr__(name):
    if name in {"VaultLoopSnapshot", "VaultMemorySync"}:
        module = import_module("vaultfire.memory.modules.vault_memory_sync")
        return getattr(module, name)
    if name in {"VaultproofVerifier", "VerificationResult"}:
        module = import_module("vaultfire.memory.modules.vaultproof_verifier")
        return getattr(module, name)
    if name == "LoopMemoryCLI":
        module = import_module("vaultfire.memory.cli.loop_memory_cli")
        return module.LoopMemoryCLI
    raise AttributeError(f"module {__name__} has no attribute {name}")
