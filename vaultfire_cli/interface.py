"""Thin interface for invoking the Vaultfire CLI from scripts."""

from __future__ import annotations

from typing import Sequence

from .main import main


class VaultfireCLI:
    """Convenience wrapper exposed to orchestration scripts."""

    @staticmethod
    def launch(argv: Sequence[str] | None = None) -> int:
        """Launch the Vaultfire CLI with *argv* and return the exit code."""

        return main(argv)


__all__ = ["VaultfireCLI"]
