"""Routing utilities to export Vaultfire validator artifacts."""

from __future__ import annotations

import base64
import json
from typing import Mapping, Sequence

from vaultfire.validation.core import ValidationReport, EpochLockTracer


class ValidatorExportRouter:
    """Export validation snapshots, belief summaries, and zk logs."""

    def __init__(self, *, tracer: EpochLockTracer | None = None) -> None:
        self.tracer = tracer or EpochLockTracer()

    def export_vaultproof(self, report: ValidationReport) -> Mapping[str, object]:
        payload = {
            "persona": report.persona_tag,
            "validator_score": report.validator_score,
            "zk_consistent": report.zk_consistent,
            "continuity_hash": report.continuity_hash,
        }
        encoded = base64.b64encode(json.dumps(payload, sort_keys=True).encode()).decode()
        snapshot = {"format": ".vaultproof", "payload": payload, "encoded": encoded}
        self.tracer.snapshot({"persona": report.persona_tag, "score": report.validator_score})
        return snapshot

    def export_belief_summary(self, report: ValidationReport) -> Mapping[str, object]:
        return {
            "persona": report.persona_tag,
            "belief_hash": report.belief_hash,
            "drift_detected": report.drift_detected,
            "ethics_state": report.ethics_state,
        }

    def export_zk_log(self, reports: Sequence[ValidationReport]) -> Mapping[str, object]:
        zk_logs = [
            {"persona": report.persona_tag, "zk_consistent": report.zk_consistent, "continuity": report.continuity_hash}
            for report in reports
        ]
        encoded = base64.b64encode(json.dumps(zk_logs, sort_keys=True).encode()).decode()
        return {"format": "zk-log", "entries": zk_logs, "encoded": encoded}


__all__ = ["ValidatorExportRouter"]
