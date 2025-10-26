#!/usr/bin/env python3
"""Governance Spine CLI for visualising Vaultfire decisions."""

import argparse
import json
from pathlib import Path
from typing import Dict, List

COUNCIL_LOG = Path("governance/council_logs_enterprise.json")
TIMELINE_MAP = Path("governance/governance_timeline_map.json")
ATTESTATION_DIR = Path("attestations/governance")


def load_json(path: Path) -> Dict[str, object]:
    return json.loads(path.read_text(encoding="utf-8"))


def render_council_summary(council_entries: List[Dict[str, object]]) -> str:
    lines = ["Council Composition:"]
    for entry in council_entries:
        lines.append(
            f" - {entry['member_id']} (weight={entry['vote_weight']}, role={entry['role']})"
        )
    return "\n".join(lines)


def render_timeline(timeline: List[Dict[str, object]]) -> str:
    lines = ["Governance Timeline:"]
    for item in timeline:
        lines.append(
            f" - {item['timestamp']}: {item['event']} (proposal {item['proposal_id']})"
        )
    return "\n".join(lines)


def collect_vote_weights(attestations: List[Dict[str, object]]) -> Dict[str, float]:
    weights: Dict[str, float] = {}
    for record in attestations:
        for signer in record.get("signers", []):
            weights[signer["member"]] = weights.get(signer["member"], 0.0) + signer.get("weight", 0.0)
    return weights


def load_attestations(directory: Path) -> List[Dict[str, object]]:
    records: List[Dict[str, object]] = []
    for path in sorted(directory.glob("*.json")):
        records.append(load_json(path))
    return records


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--render", action="store_true", help="Print council and timeline summary")
    parser.add_argument("--show-weights", action="store_true", help="Display accumulated vote weights")
    args = parser.parse_args()

    council_data = load_json(COUNCIL_LOG)
    timeline_data = load_json(TIMELINE_MAP)
    attestations = load_attestations(ATTESTATION_DIR)

    if args.render:
        print(render_council_summary(council_data["council"]))
        print()
        print(render_timeline(timeline_data["timeline"]))

    if args.show_weights:
        weights = collect_vote_weights(attestations)
        print("\nVote Weight Totals:")
        for member, weight in weights.items():
            print(f" - {member}: {weight:.2f}")


if __name__ == "__main__":
    main()
