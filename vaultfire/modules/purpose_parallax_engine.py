"""Purpose Parallax Engine for dual-path moral resolution."""

from __future__ import annotations

from typing import Iterable, Mapping, MutableSequence

from vaultfire.modules.conscious_state_engine import ConsciousStateEngine
from vaultfire.modules.mission_soul_loop import MissionSoulLoop
from vaultfire.modules.predictive_yield_fabric import PredictiveYieldFabric

from ._metadata import build_metadata


class PurposeParallaxEngine:
    """Evaluate parallel moral paths and surface aligned outcomes."""

    def __init__(
        self,
        *,
        conscious: ConsciousStateEngine | None = None,
        mission: MissionSoulLoop | None = None,
        predictive: PredictiveYieldFabric | None = None,
        identity_handle: str = "bpow20.cb.id",
        identity_ens: str = "ghostkey316.eth",
    ) -> None:
        self.conscious = conscious or ConsciousStateEngine(
            identity_handle=identity_handle,
            identity_ens=identity_ens,
        )
        self.mission = mission or MissionSoulLoop(
            identity_handle=identity_handle,
            identity_ens=identity_ens,
        )
        self.predictive = predictive or PredictiveYieldFabric(
            identity_handle=identity_handle,
            identity_ens=identity_ens,
        )
        self.metadata: Mapping[str, object] = build_metadata(
            "PurposeParallaxEngine",
            identity={"wallet": identity_handle, "ens": identity_ens},
        )
        self._history: MutableSequence[Mapping[str, object]] = []

    def run_dual(
        self,
        intent: str,
        paths: Iterable[Mapping[str, object]],
    ) -> Mapping[str, object]:
        """Evaluate the provided moral paths and select the aligned option."""

        analyses: list[Mapping[str, object]] = []
        for index, path in enumerate(paths, start=1):
            ethic = str(path.get("ethic", "aligned")).lower()
            confidence = float(path.get("confidence", 0.8))
            impact = float(path.get("impact", 1.0))
            label = path.get("label", f"path-{index}")
            action = {
                "ethic": ethic,
                "weight": impact,
                "note": label,
                "intent": intent,
            }
            record = self.conscious.record_action(action)
            forecast = self.predictive.forecast(confidence, max(impact, 0.1) * 100.0)
            alignment_score = round((record.belief_delta + confidence) / 2.0, 4)
            analyses.append(
                {
                    "label": label,
                    "ethic": ethic,
                    "confidence": confidence,
                    "impact": impact,
                    "alignment": alignment_score,
                    "forecast": forecast["composite_yield"],
                }
            )
        if analyses:
            analyses.sort(key=lambda item: item["alignment"], reverse=True)
            selected = analyses[0]
            self.mission.log_intent(intent, confidence=selected["confidence"], tags=("parallax",))
        else:
            selected = None
        payload = {
            "intent": intent,
            "paths": analyses,
            "selected": selected,
            "metadata": self.metadata,
        }
        self._history.append(payload)
        return payload

    def alignment_preview(self, *, tags: Iterable[str] = ()) -> Mapping[str, object]:
        checkpoint = self.mission.checkpoint()
        return {
            "profile": checkpoint["profile"],
            "history": checkpoint["history"],
            "tags": list(tags),
            "metadata": self.metadata,
        }

    def history(self) -> list[Mapping[str, object]]:
        return list(self._history)


__all__ = ["PurposeParallaxEngine"]

