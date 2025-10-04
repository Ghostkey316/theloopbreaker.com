#!/usr/bin/env python3
"""Bundle live readiness evidence into a single archive for partner audits."""

import argparse
import hashlib
import json
import os
import tarfile
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_ARTIFACTS = [
    Path("logs/live-readiness"),
    Path("attestations/guardian/live-ready.json"),
    Path("telemetry/live-sink-attestations.jsonl"),
    Path("secure_upload/live-wallet-rollout.csv"),
    Path("deployment/live/profiles/revenue-on.yaml"),
    Path("status/reference-deployments.md"),
    Path("compliance/review-logs/live-beta/approval.md"),
]

IMMUTABLE_LOG = Path("immutable_log.jsonl")


def discover(paths):
    existing = []
    missing = []
    for entry in paths:
        path = Path(entry)
        if path.exists():
            existing.append(path)
        else:
            missing.append(path)
    return existing, missing


def make_bundle(output_path: Path, artifacts):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with tarfile.open(output_path, "w:gz") as bundle:
        for artifact in artifacts:
            bundle.add(artifact, arcname=str(artifact))
    with output_path.open("rb") as handle:
        digest = hashlib.sha256(handle.read()).hexdigest()
    return digest


def append_log(output_path: Path, digest: str, included, missing):
    if not IMMUTABLE_LOG.exists():
        IMMUTABLE_LOG.touch()
    record = {
        "event": "live-evidence-bundle",
        "bundle": str(output_path),
        "sha256": digest,
        "included": [str(path) for path in included],
        "missing": [str(path) for path in missing],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    with IMMUTABLE_LOG.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record) + os.linesep)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        default="logs/live-readiness/live-evidence-bundle.tar.gz",
        help="Path for the generated archive.",
    )
    parser.add_argument(
        "paths",
        nargs="*",
        default=[str(path) for path in DEFAULT_ARTIFACTS],
        help="Specific files or directories to include. Defaults to the live readiness set.",
    )
    args = parser.parse_args()

    requested_paths = [Path(p) for p in args.paths]
    existing, missing = discover(requested_paths)

    if not existing:
        raise SystemExit("No evidence artifacts were found. Nothing to archive.")

    output_path = Path(args.output)
    digest = make_bundle(output_path, existing)
    append_log(output_path, digest, existing, missing)

    print(f"Created {output_path} with SHA-256 {digest}.")
    if missing:
        print("Missing artifacts:")
        for path in missing:
            print(f" - {path}")


if __name__ == "__main__":
    main()
