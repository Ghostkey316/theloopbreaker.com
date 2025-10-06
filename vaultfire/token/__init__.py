"""Token protocol utilities for Vaultfire."""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
from datetime import timedelta
from typing import Any, Dict, Iterable, Mapping, Sequence, Tuple


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


@dataclass(slots=True, frozen=True)
class TokenAmount:
    """Representation of a token-denominated quantity."""

    amount: int
    denomination: str

    def export(self) -> Dict[str, object]:
        return {
            "amount": self.amount,
            "denomination": self.denomination,
        }


@dataclass(slots=True, frozen=True)
class TokenDefinition:
    """Core token metadata for the Vaultfire governance token."""

    name: str
    symbol: str
    standard: str
    chain_targets: Tuple[str, ...]
    supply_cap: int
    emissions_curve: str

    def export(self) -> Dict[str, object]:
        return {
            "name": self.name,
            "symbol": self.symbol,
            "standard": self.standard,
            "chain_targets": list(self.chain_targets),
            "supply_cap": self.supply_cap,
            "emissions_curve": self.emissions_curve,
        }


@dataclass(slots=True, frozen=True)
class GovernanceParameters:
    """Governance configuration derived from the token specification."""

    quorum_fraction: float
    voting_delay: timedelta
    proposal_threshold: TokenAmount

    def export(self) -> Dict[str, object]:
        delay_seconds = int(self.voting_delay.total_seconds())
        percentage = round(self.quorum_fraction * 100, 6)
        iso_8601 = _timedelta_to_iso8601(self.voting_delay)
        return {
            "quorum": {
                "fraction": self.quorum_fraction,
                "percentage": percentage,
            },
            "voting_delay": {
                "seconds": delay_seconds,
                "human_readable": _format_timedelta(self.voting_delay),
                "iso_8601": iso_8601,
            },
            "proposal_threshold": self.proposal_threshold.export(),
        }


@dataclass(slots=True, frozen=True)
class EthicsGuardrails:
    """Ethics guardrails attached to the governance token."""

    proof_of_purpose_required: bool
    public_audit_interval_days: int

    def export(self) -> Dict[str, object]:
        return {
            "proof_of_purpose_required": self.proof_of_purpose_required,
            "public_audit_interval_days": self.public_audit_interval_days,
        }


@dataclass(slots=True, frozen=True)
class VaultfireGovernanceTokenSpec:
    """Complete specification for the Vaultfire governance token."""

    token: TokenDefinition
    governance: GovernanceParameters
    ethics: EthicsGuardrails

    def to_manifest(self) -> Dict[str, object]:
        manifest = {
            "token": self.token.export(),
            "governance": self.governance.export(),
            "ethics": self.ethics.export(),
        }
        manifest["checksum"] = _compute_checksum(manifest)
        return manifest


def _require_mapping(value: object, *, field_name: str) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise TypeError(f"{field_name} must be a mapping")
    return value  # type: ignore[return-value]


def _require_non_empty_string(value: object, *, field_name: str) -> str:
    if not isinstance(value, str):
        raise TypeError(f"{field_name} must be a string")
    stripped = value.strip()
    if not stripped:
        raise ValueError(f"{field_name} must be a non-empty string")
    return stripped


def _normalise_chain_targets(chain_targets: Sequence[str]) -> Tuple[str, ...]:
    if not isinstance(chain_targets, Sequence) or isinstance(chain_targets, (str, bytes)):
        raise TypeError("chain_targets must be a sequence of strings")
    ordered_unique: dict[str, None] = {}
    for index, target in enumerate(chain_targets):
        if not isinstance(target, str):
            raise TypeError(f"chain_targets[{index}] must be a string")
        normalised = target.strip()
        if not normalised:
            raise ValueError(f"chain_targets[{index}] must be non-empty")
        ordered_unique.setdefault(normalised, None)
    if not ordered_unique:
        raise ValueError("At least one chain target must be provided")
    return tuple(ordered_unique.keys())


def _parse_positive_int(value: object, *, field_name: str) -> int:
    if isinstance(value, bool):
        raise TypeError(f"{field_name} must be an integer")
    if isinstance(value, int):
        if value <= 0:
            raise ValueError(f"{field_name} must be positive")
        return value
    if isinstance(value, str):
        cleaned = value.strip().replace("_", "").replace(",", "")
        if not cleaned:
            raise ValueError(f"{field_name} must not be empty")
        try:
            parsed = int(cleaned)
        except ValueError as exc:
            raise ValueError(f"{field_name} must be an integer value") from exc
        if parsed <= 0:
            raise ValueError(f"{field_name} must be positive")
        return parsed
    raise TypeError(f"{field_name} must be an integer")


def _parse_percentage(value: object, *, field_name: str) -> float:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        numeric = float(value)
    elif isinstance(value, str):
        cleaned = value.strip()
        if cleaned.endswith("%"):
            cleaned = cleaned[:-1]
        cleaned = cleaned.replace("_", "").replace(",", "")
        if not cleaned:
            raise ValueError(f"{field_name} must not be empty")
        try:
            numeric = float(cleaned)
        except ValueError as exc:
            raise ValueError(f"{field_name} must be a numeric percentage") from exc
    else:
        raise TypeError(f"{field_name} must be numeric or a percentage string")

    if numeric > 1:
        numeric /= 100
    if numeric <= 0 or numeric > 1:
        raise ValueError(f"{field_name} must be between 0 and 100 percent")
    return round(numeric, 6)


def _parse_proposal_threshold(value: object, *, token_symbol: str) -> TokenAmount:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        amount = int(value)
        denomination = token_symbol
    elif isinstance(value, str):
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("proposal_threshold must not be empty")
        parts = cleaned.split()
        numeric_part = parts[0].replace("_", "").replace(",", "")
        try:
            amount = int(numeric_part)
        except ValueError as exc:
            raise ValueError("proposal_threshold must start with an integer value") from exc
        denomination = token_symbol
        if len(parts) > 1:
            provided_symbol = parts[1].strip()
            if provided_symbol and provided_symbol != token_symbol:
                raise ValueError("proposal_threshold denomination must match the token symbol")
    else:
        raise TypeError("proposal_threshold must be numeric or a formatted string")

    if amount <= 0:
        raise ValueError("proposal_threshold must be greater than zero")
    return TokenAmount(amount=amount, denomination=token_symbol)


def _parse_voting_delay(value: object, *, field_name: str) -> timedelta:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        seconds = float(value)
        if seconds <= 0:
            raise ValueError(f"{field_name} must be greater than zero seconds")
        return timedelta(seconds=seconds)
    if isinstance(value, str):
        cleaned = value.strip().lower()
        if not cleaned:
            raise ValueError(f"{field_name} must not be empty")
        parts = cleaned.split()
        if len(parts) != 2:
            raise ValueError(f"{field_name} must be in the format '<value> <unit>'")
        magnitude_raw, unit_raw = parts
        magnitude_raw = magnitude_raw.replace("_", "")
        try:
            magnitude = float(magnitude_raw)
        except ValueError as exc:
            raise ValueError(f"{field_name} magnitude must be numeric") from exc
        if magnitude <= 0:
            raise ValueError(f"{field_name} magnitude must be greater than zero")
        unit = unit_raw.rstrip("s")
        unit_seconds = {
            "second": 1,
            "minute": 60,
            "hour": 60 * 60,
            "day": 60 * 60 * 24,
        }.get(unit)
        if unit_seconds is None:
            raise ValueError(f"Unsupported unit for {field_name}: {unit_raw}")
        total_seconds = magnitude * unit_seconds
        return timedelta(seconds=total_seconds)
    raise TypeError(f"{field_name} must be numeric seconds or a human readable duration string")


def _format_timedelta(value: timedelta) -> str:
    total_seconds = int(value.total_seconds())
    if total_seconds % (24 * 3600) == 0:
        days = total_seconds // (24 * 3600)
        unit = "day" if days == 1 else "days"
        return f"{days} {unit}"
    if total_seconds % 3600 == 0:
        hours = total_seconds // 3600
        unit = "hour" if hours == 1 else "hours"
        return f"{hours} {unit}"
    if total_seconds % 60 == 0:
        minutes = total_seconds // 60
        unit = "minute" if minutes == 1 else "minutes"
        return f"{minutes} {unit}"
    return f"{total_seconds} seconds"


def _timedelta_to_iso8601(value: timedelta) -> str:
    total_seconds = int(value.total_seconds())
    if total_seconds % (24 * 3600) == 0:
        days = total_seconds // (24 * 3600)
        return f"P{days}D"
    if total_seconds % 3600 == 0:
        hours = total_seconds // 3600
        return f"PT{hours}H"
    if total_seconds % 60 == 0:
        minutes = total_seconds // 60
        return f"PT{minutes}M"
    return f"PT{total_seconds}S"


def build_governance_token_spec(spec: Mapping[str, Any]) -> VaultfireGovernanceTokenSpec:
    """Construct a governance token specification from a raw mapping."""

    _require_mapping(spec, field_name="spec")
    token_section = _require_mapping(spec.get("token"), field_name="token")
    governance_section = _require_mapping(spec.get("governance"), field_name="governance")
    ethics_section = _require_mapping(spec.get("ethics"), field_name="ethics")

    token_name = _require_non_empty_string(token_section.get("name"), field_name="token.name")
    token_symbol = _require_non_empty_string(token_section.get("symbol"), field_name="token.symbol")
    token_standard = _require_non_empty_string(token_section.get("standard"), field_name="token.standard")
    chain_targets = _normalise_chain_targets(token_section.get("chain_targets", ()))
    supply_cap = _parse_positive_int(token_section.get("supply_cap"), field_name="token.supply_cap")
    emissions_curve = _require_non_empty_string(
        token_section.get("emissions_curve"), field_name="token.emissions_curve"
    )

    token_definition = TokenDefinition(
        name=token_name,
        symbol=token_symbol,
        standard=token_standard,
        chain_targets=chain_targets,
        supply_cap=supply_cap,
        emissions_curve=emissions_curve,
    )

    quorum_fraction = _parse_percentage(governance_section.get("quorum"), field_name="governance.quorum")
    voting_delay = _parse_voting_delay(governance_section.get("voting_delay"), field_name="governance.voting_delay")
    proposal_threshold = _parse_proposal_threshold(
        governance_section.get("proposal_threshold"), token_symbol=token_symbol
    )

    governance_parameters = GovernanceParameters(
        quorum_fraction=quorum_fraction,
        voting_delay=voting_delay,
        proposal_threshold=proposal_threshold,
    )

    proof_of_purpose = ethics_section.get("proof_of_purpose_required")
    if not isinstance(proof_of_purpose, bool):
        raise TypeError("ethics.proof_of_purpose_required must be a boolean")
    audit_interval = _parse_positive_int(
        ethics_section.get("public_audit_interval_days"), field_name="ethics.public_audit_interval_days"
    )

    ethics_guardrails = EthicsGuardrails(
        proof_of_purpose_required=proof_of_purpose,
        public_audit_interval_days=audit_interval,
    )

    return VaultfireGovernanceTokenSpec(
        token=token_definition,
        governance=governance_parameters,
        ethics=ethics_guardrails,
    )


__all__ = [
    "FireTokenProtocol",
    "prepare_fire_token_protocol",
    "TokenAmount",
    "TokenDefinition",
    "GovernanceParameters",
    "EthicsGuardrails",
    "VaultfireGovernanceTokenSpec",
    "build_governance_token_spec",
]
