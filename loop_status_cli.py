"""CLI to surface loop status and drip timing."""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Mapping


@dataclass
class LoopStatus:
    persona_tag: str
    projected_yield_rate: float
    amplifier_tier: str
    next_drip_epoch: datetime
    pop_score: float


class LoopStatusCLI:
    """Inspect the latest .loopdrop artifact for loop telemetry."""

    def __init__(self, *, log_dir: str | Path = "yield_reports") -> None:
        self.log_dir = Path(log_dir)

    def _load_log(self, path: Path) -> Mapping[str, object]:
        content = json.loads(path.read_text())
        return content

    def _latest_log(self, persona_tag: str | None = None) -> tuple[Path, Mapping[str, object]] | None:
        if not self.log_dir.exists():
            return None
        candidates = [path for path in self.log_dir.glob("*.loopdrop") if path.is_file()]
        if persona_tag:
            candidates = [path for path in candidates if f"{persona_tag}-" in path.name]
        if not candidates:
            return None
        latest = max(candidates, key=lambda path: path.stat().st_mtime)
        return latest, self._load_log(latest)

    def status(self, persona_tag: str | None = None) -> LoopStatus | None:
        latest = self._latest_log(persona_tag)
        if not latest:
            return None
        _, payload = latest
        return LoopStatus(
            persona_tag=str(payload["persona_tag"]),
            projected_yield_rate=float(payload["projected_yield_rate"]),
            amplifier_tier=str(payload.get("amplifier_tier", "unknown")),
            next_drip_epoch=datetime.fromisoformat(str(payload["next_drip_epoch"])),
            pop_score=float(payload.get("pop_score", 0.0)),
        )

    def render(self, persona_tag: str | None = None) -> str:
        status = self.status(persona_tag)
        if status is None:
            return "No loop activity recorded yet."
        return (
            f"Persona: {status.persona_tag}\n"
            f"Loop score (PoP): {status.pop_score:.3f}\n"
            f"Amplifier tier: {status.amplifier_tier}\n"
            f"Projected yield rate: {status.projected_yield_rate:.4f}\n"
            f"Next drip epoch: {status.next_drip_epoch.isoformat()}"
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Inspect Vaultfire loop status.")
    parser.add_argument("persona", nargs="?", default=None, help="Persona tag to inspect")
    parser.add_argument(
        "--log-dir",
        default="yield_reports",
        help="Directory containing .loopdrop artifacts",
    )
    args = parser.parse_args()
    cli = LoopStatusCLI(log_dir=args.log_dir)
    print(cli.render(args.persona))


if __name__ == "__main__":
    main()
