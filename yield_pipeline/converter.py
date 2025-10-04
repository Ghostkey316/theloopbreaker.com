"""Pilot log conversion into public case studies."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable, List

from .config import settings
from .models import CaseStudy, PilotLog, anonymize_belief_segment, classify_yield


def _load_pilot_log(path: Path) -> PilotLog:
    with path.open("r", encoding="utf-8") as handle:
        raw = json.load(handle)
    return PilotLog.model_validate(raw)


def _to_case_study(pilot_log: PilotLog) -> CaseStudy:
    belief_segment = anonymize_belief_segment(pilot_log.belief_id)
    yield_classification = classify_yield(pilot_log.belief_id, pilot_log.ghostscore_delta)
    return CaseStudy(
        timestamp=pilot_log.timestamp,
        belief_segment=belief_segment,
        yield_classification=yield_classification,
        ghostscore_roi=round(pilot_log.ghostscore_delta, 2),
        trigger_summary=pilot_log.trigger_event,
        mission_hash=pilot_log.hashed_mission_id,
    )


def convert_pilot_logs(source: Path | None = None, destination: Path | None = None) -> List[CaseStudy]:
    """Convert pilot logs into anonymised case studies."""

    source_dir = Path(source or settings.mission_logs_dir)
    destination_dir = Path(destination or settings.case_study_dir)
    destination_dir.mkdir(parents=True, exist_ok=True)

    case_studies: List[CaseStudy] = []
    for path in sorted(source_dir.glob("*.json")):
        pilot_log = _load_pilot_log(path)
        case_study = _to_case_study(pilot_log)
        case_studies.append(case_study)
        output_path = destination_dir / f"{case_study.mission_hash}.json"
        with output_path.open("w", encoding="utf-8") as handle:
            json.dump(case_study.model_dump(mode="json"), handle, indent=2)
    return case_studies


def load_case_studies(directory: Path | None = None) -> List[CaseStudy]:
    """Load previously generated case studies."""

    case_dir = Path(directory or settings.case_study_dir)
    studies: List[CaseStudy] = []
    for path in sorted(case_dir.glob("*.json")):
        with path.open("r", encoding="utf-8") as handle:
            raw = json.load(handle)
        studies.append(CaseStudy.model_validate(raw))
    return studies


def case_studies_to_yield_insights(case_studies: Iterable[CaseStudy]) -> List[dict]:
    """Translate case studies into a payload suitable for the public API."""

    insights = []
    for study in case_studies:
        insights.append(
            {
                "mission_id": study.mission_hash,
                "belief_segment": study.belief_segment,
                "yield_type": study.yield_classification,
                "ghostscore_delta": study.ghostscore_roi,
                "timestamp": study.timestamp.isoformat(),
            }
        )
    return insights
