"""CLI for emitting onchain-ready Drift Layer feeds."""

from __future__ import annotations

import argparse
import json
from dataclasses import asdict
from pathlib import Path
from typing import Dict, Mapping

from drift_sync import DriftSync
from echo_capture import EchoCapture
from loop_bridge import LoopBridge


def farcaster_export(user: str, score: float) -> Mapping[str, object]:
    """Build Farcaster-ready payload for decentralized identity mapping."""

    return {
        "user": user,
        "score": score,
        "channel": "vaultfire-drift",
        "nft_ready": True,
    }


def nft_export(user: str, signature: str) -> Mapping[str, str]:
    """Return NFT metadata for Drift Layer attestations."""

    return {
        "user": user,
        "signature": signature,
        "standard": "drift-echo-erc",
    }


def format_onchain_stream(
    *,
    drift_scores: Mapping[str, float],
    echo_trends: Mapping[str, object],
    reflection_loops: Mapping[str, object],
) -> Dict[str, object]:
    """Combine Drift, Echo, and Reflection data into a stream payload."""

    return {
        "drift_scores": drift_scores,
        "echo_trends": echo_trends,
        "reflection_loops": reflection_loops,
        "farcaster_exports": {user: farcaster_export(user, score) for user, score in drift_scores.items()},
        "nft_exports": {user: nft_export(user, f"sig-{score}") for user, score in drift_scores.items()},
    }


def main() -> None:
    """Entry point for Drift Feed CLI."""

    parser = argparse.ArgumentParser(description="Emit Drift Layer feeds for onchain use")
    parser.add_argument("user", help="User identifier")
    parser.add_argument("score", type=float, help="Current Drift Score")
    parser.add_argument("--echo", dest="echo", action="append", help="Echo trend details", default=[])
    parser.add_argument("--reflection", dest="reflection", action="append", help="Reflection loop notes", default=[])
    parser.add_argument(
        "--output",
        default="drift_feed.json",
        help="Where to write the Farcaster/NFT ready payload",
    )
    args = parser.parse_args()

    drift_sync = DriftSync()
    drift_sync.record_prompt(args.user, belief=args.score / 316, sentiment=0.5)
    drift_scores = {args.user: drift_sync.drift_score(args.user)}

    echo_capture = EchoCapture()
    for idx, echo in enumerate(args.echo):
        prompt_id = f"p-{idx}"
        echo_capture.log_prompt(prompt_id, echo, sentiment=0.0)
        echo_capture.capture_echo(prompt_id, echo, replay_sentiment=0.0)
    echo_trends = {"echoes": [asdict(record) for record in echo_capture.echo_feed()]}

    loop_bridge = LoopBridge("mirror-feed")
    reflection_payload = {
        "notes": args.reflection or ["loop-initialized"],
        "bridge": loop_bridge.relay_to_mirror({"user": args.user, "score": drift_scores[args.user]}).fingerprint,
    }
    stream = format_onchain_stream(
        drift_scores=drift_scores,
        echo_trends=echo_trends,
        reflection_loops=reflection_payload,
    )

    output_path = Path(args.output)
    output_path.write_text(json.dumps(stream, indent=2))
    print(json.dumps({"feed": str(output_path), "user": args.user, "score": drift_scores[args.user]}, indent=2))


if __name__ == "__main__":
    main()
