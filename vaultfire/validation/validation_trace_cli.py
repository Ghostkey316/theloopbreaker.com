"""CLI tracer for Vaultfire Validator state."""

from __future__ import annotations

import json
from typing import Mapping

from vaultfire.validation.core import BeliefProofEngine, ValidatorCore, ValidationReport


class ValidationTraceCLI:
    """Render validator state for observability and debugging."""

    def __init__(
        self,
        *,
        validator: ValidatorCore | None = None,
        belief_engine: BeliefProofEngine | None = None,
    ) -> None:
        self.validator = validator or ValidatorCore()
        self.belief_engine = belief_engine or BeliefProofEngine()

    def trace(
        self,
        persona_tag: str,
        *,
        anchor,
        memory_event,
        zk_identity_hash: str | None = None,
        ethics_vector: Mapping[str, float] | None = None,
    ) -> str:
        report = self.validator.validate(
            persona_tag,
            anchor=anchor,
            memory_event=memory_event,
            zk_identity_hash=zk_identity_hash,
            ethics_vector=ethics_vector,
        )
        payload = self._serialize_report(report)
        return json.dumps(payload, sort_keys=True)

    def _serialize_report(self, report: ValidationReport) -> Mapping[str, object]:
        return {
            "persona": report.persona_tag,
            "validator_score": report.validator_score,
            "zk_consistent": report.zk_consistent,
            "soulprint_match": report.soulprint_match,
            "continuity_verified": report.continuity_verified,
            "belief_hash": report.belief_hash,
            "drift_detected": report.drift_detected,
            "ethics_state": report.ethics_state,
        }

    def summary(self, report: ValidationReport) -> Mapping[str, object]:
        summary = self._serialize_report(report)
        summary["continuity_hash"] = report.continuity_hash
        return summary


__all__ = ["ValidationTraceCLI"]
