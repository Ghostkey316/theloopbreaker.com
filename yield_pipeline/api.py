"""FastAPI application exposing yield insights."""

from __future__ import annotations

import json
from collections import deque
from datetime import datetime, timezone
from hashlib import sha256
from typing import Deque, Dict, List, Optional, Tuple

from fastapi import Depends, FastAPI, HTTPException, Request
from contextlib import asynccontextmanager

from .config import settings
from .converter import case_studies_to_yield_insights, convert_pilot_logs, load_case_studies

RequestLog = Deque[datetime]
_rate_log: Dict[str, RequestLog] = {}


def _hash_ip(value: str) -> str:
    return sha256(value.encode("utf-8")).hexdigest()


def _log_audit(entry: dict) -> None:
    path = settings.attestations_path
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        with path.open("r", encoding="utf-8") as handle:
            try:
                data = json.load(handle)
            except json.JSONDecodeError:
                data = []
    else:
        data = []
    data.append(entry)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2)


def rate_limiter(request: Request) -> None:
    ip = request.client.host if request.client else "unknown"
    now = datetime.now(timezone.utc)
    log = _rate_log.setdefault(ip, deque())
    while log and (now - log[0]).total_seconds() > 60:
        log.popleft()
    if len(log) >= settings.rate_limit_per_minute:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    log.append(now)


def authenticate(request: Request) -> None:
    if settings.api_key:
        provided = request.headers.get("X-API-Key")
        if provided != settings.api_key:
            raise HTTPException(status_code=401, detail="Invalid API key")


def _ensure_timezone(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def parse_date_range(date_range: Optional[str]) -> Tuple[Optional[datetime], Optional[datetime]]:
    if not date_range:
        return None, None
    try:
        start_raw, end_raw = [part.strip() for part in date_range.split(",", 1)]
        start = _ensure_timezone(datetime.fromisoformat(start_raw))
        end = _ensure_timezone(datetime.fromisoformat(end_raw))
        return start, end
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid date_range format") from exc


def filter_case_studies(
    studies: List[dict],
    segment_id: Optional[str],
    date_range: Tuple[Optional[datetime], Optional[datetime]],
) -> List[dict]:
    start, end = date_range
    filtered = []
    for study in studies:
        if segment_id and segment_id != study["belief_segment"]:
            continue
        timestamp = _ensure_timezone(datetime.fromisoformat(study["timestamp"]))
        if start and timestamp < start:
            continue
        if end and timestamp > end:
            continue
        filtered.append(study)
    return filtered


@asynccontextmanager
async def _lifespan(_: FastAPI):
    convert_pilot_logs()
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="Vaultfire Yield Insights",
        version="1.0.0",
        description="Ethical, scalable and transparent yield case studies pipeline.",
        lifespan=_lifespan,
    )

    @app.get("/api/yield-insights", dependencies=[Depends(rate_limiter), Depends(authenticate)])
    async def get_yield_insights(
        request: Request,
        segment_id: Optional[str] = None,
        date_range: Optional[str] = None,
    ) -> List[dict]:
        convert_pilot_logs()
        case_studies = load_case_studies()
        insights = case_studies_to_yield_insights(case_studies)
        filtered = filter_case_studies(insights, segment_id, parse_date_range(date_range))
        audit_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "client_hash": _hash_ip(request.client.host if request.client else "unknown"),
            "segment": segment_id,
            "results": len(filtered),
        }
        _log_audit(audit_entry)
        return filtered

    return app


app = create_app()
