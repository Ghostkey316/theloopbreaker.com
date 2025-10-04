"""Command line entry point for the Vaultfire yield pipeline."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from yield_pipeline import convert_pilot_logs, settings


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert pilot logs to public case studies")
    parser.add_argument(
        "--source",
        type=Path,
        default=settings.mission_logs_dir,
        help="Directory containing pilot log JSON files",
    )
    parser.add_argument(
        "--destination",
        type=Path,
        default=settings.case_study_dir,
        help="Directory where case study JSON files will be written",
    )
    args = parser.parse_args()

    case_studies = convert_pilot_logs(args.source, args.destination)
    print(json.dumps([study.model_dump(mode="json") for study in case_studies], indent=2))


if __name__ == "__main__":
    main()
