"""Token protocol utilities for Vaultfire."""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
from typing import Dict, Iterable, Mapping, Tuple


@dataclass(slots=True, frozen=True)
class FireTokenProtocol:
    """Structured representation of a Fire token protocol blueprint."""

    name: str
    symbol: str
    governance_control: str
    unlock_conditions: Tuple[str, ...]
    supply_model: str
    reward_weighting: Dict[str, str]
    checksum: str

    def export(self) -> Dict[str, object]:
        """Export the protocol metadata as a serialisable dictionary."""

        return {
            "name": self.name,
            "symbol": self.symbol,
            "governance_control": self.governance_control,
            "unlock_conditions": list(self.unlock_conditions),
            "supply_model": self.supply_model,
            "reward_weighting": dict(self.reward_weighting),
            "checksum": self.checksum,
        }


def _normalise_unlock_conditions(unlock_conditions: Iterable[str]) -> Tuple[str, ...]:
    ordered_unique = dict.fromkeys(cond.strip() for cond in unlock_conditions if cond and cond.strip())
    if not ordered_unique:
        raise ValueError("At least one unlock condition must be provided")
    return tuple(ordered_unique)


def _normalise_reward_weighting(reward_weighting: Mapping[str, str]) -> Dict[str, str]:
    if not reward_weighting:
        raise ValueError("reward_weighting must contain at least one entry")

    cleaned: Dict[str, str] = {}
    for cohort, weight in reward_weighting.items():
        cohort_key = str(cohort).strip()
        weight_value = str(weight).strip()
        if not cohort_key:
            raise ValueError("Reward cohort names cannot be empty")
        if not weight_value:
            raise ValueError("Reward weights cannot be empty")
        cleaned[cohort_key] = weight_value
    return cleaned


def _compute_checksum(payload: Mapping[str, object]) -> str:
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def prepare_fire_token_protocol(
    *,
    name: str,
    symbol: str,
    governance_control: str,
    unlock_conditions: Iterable[str],
    supply_model: str,
    reward_weighting: Mapping[str, str],
) -> FireTokenProtocol:
    """Create a structured Fire token protocol configuration.

    Parameters
    ----------
    name:
        Human-readable protocol name. Must be a non-empty string.
    symbol:
        Short symbol for the token. Must be a non-empty string.
    governance_control:
        Name of the entity managing the token governance.
    unlock_conditions:
        Iterable of unlock conditions. Duplicates and empty values are removed
        while preserving the original order.
    supply_model:
        Description of the supply model used for the token.
    reward_weighting:
        Mapping of cohort names to their weighting descriptions.

    Returns
    -------
    FireTokenProtocol
        Normalised protocol configuration with a deterministic checksum.
    """

    for field_name, field_value in {
        "name": name,
        "symbol": symbol,
        "governance_control": governance_control,
        "supply_model": supply_model,
    }.items():
        if not isinstance(field_value, str) or not field_value.strip():
            raise ValueError(f"{field_name} must be a non-empty string")

    normalised_conditions = _normalise_unlock_conditions(unlock_conditions)
    normalised_reward_weighting = _normalise_reward_weighting(reward_weighting)

    payload = {
        "name": name.strip(),
        "symbol": symbol.strip(),
        "governance_control": governance_control.strip(),
        "unlock_conditions": list(normalised_conditions),
        "supply_model": supply_model.strip(),
        "reward_weighting": normalised_reward_weighting,
    }
    checksum = _compute_checksum(payload)

    return FireTokenProtocol(
        name=payload["name"],
        symbol=payload["symbol"],
        governance_control=payload["governance_control"],
        unlock_conditions=normalised_conditions,
        supply_model=payload["supply_model"],
        reward_weighting=normalised_reward_weighting,
        checksum=checksum,
    )


__all__ = ["FireTokenProtocol", "prepare_fire_token_protocol"]
