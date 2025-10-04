"""Configuration for the Vaultfire yield pipeline."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

from pydantic import BaseModel, ConfigDict


class Settings(BaseModel):
    """Paths and runtime configuration for the pipeline."""

    mission_logs_dir: Path = Path("missions/pilot_logs")
    case_study_dir: Path = Path("public/case_studies")
    yield_reports_dir: Path = Path("yield_reports")
    attestations_path: Path = Path("attestations/yield-api-activity.json")
    api_key: Optional[str] = None
    rate_limit_per_minute: int = 30

    model_config = ConfigDict(arbitrary_types_allowed=True)


settings = Settings(api_key=os.getenv("YIELD_API_KEY"))
