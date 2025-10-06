"""Reward routing heuristics for Humanity Mirror reflections."""

from __future__ import annotations

import json
from datetime import datetime, timezone
import math
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence

import sys

_REPO_ROOT = Path(__file__).resolve().parents[2]
_SRC_DIR = _REPO_ROOT / "src"
if _SRC_DIR.exists() and str(_SRC_DIR) not in sys.path:
    sys.path.insert(0, str(_SRC_DIR))

from mirror_log import reward_stream_path
from vaultfire.security.fhe import FHECipherSuite

_IMMUTABLE_LOG = _REPO_ROOT / "immutable_log.jsonl"
_TELEMETRY_CHAIN = _REPO_ROOT / "telemetry" / "telemetry_chain.jsonl"
_RETRO_YIELD_LEDGER = _REPO_ROOT / "retro_yield.json"
_LOYALTY_TIERS_PATH = _REPO_ROOT / "loyalty_tiers.json"
_USER_SCORECARD_PATH = _REPO_ROOT / "user_scorecard.json"
_GHOSTSCORES_PATH = _REPO_ROOT / "ghostscores.json"
_REWARDS_LOG_PATH = _REPO_ROOT / "rewards_log.json"

BASE_REWARD = 10.0
ALIGNMENT_WEIGHT = 0.6
LENGTH_WEIGHT = 0.4

EMOTION_MULTIPLIERS: Mapping[str, float] = {
    "joy": 1.15,
    "hope": 1.1,
    "care": 1.08,
    "courage": 1.12,
    "repair": 1.05,
    "ethics": 1.2,
    "fear": 0.85,
}


def _load_partner_config(config_path: Path) -> Dict[str, dict]:
    if not config_path.exists():
        return {}
    try:
        return json.loads(config_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def _load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return default


def _load_json_lines(path: Path) -> List[dict]:
    if not path.exists():
        return []
    entries: List[dict] = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return entries


def _parse_timestamp(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    candidate = value.strip()
    if candidate.endswith("+00:00Z"):
        candidate = candidate[:-1]
    if candidate.endswith("Z"):
        candidate = candidate[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(candidate)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed


def _entry_wallets(entry: Mapping[str, Any]) -> Sequence[str]:
    wallets: List[str] = []
    data = entry.get("data") if isinstance(entry, Mapping) else None
    if isinstance(entry, Mapping):
        for key in ("wallet", "wallet_id", "walletId"):
            value = entry.get(key)
            if isinstance(value, str):
                wallets.append(value)
    if isinstance(data, Mapping):
        for key in ("wallet", "wallet_id", "walletId"):
            value = data.get(key)
            if isinstance(value, str):
                wallets.append(value)
        proof = data.get("proof")
        if isinstance(proof, Mapping):
            proof_wallet = proof.get("wallet")
            if isinstance(proof_wallet, str):
                wallets.append(proof_wallet)
    return wallets


def _resolve_identity(wallet: str) -> Optional[str]:
    identities: List[str] = []
    for entry in _load_json_lines(_IMMUTABLE_LOG):
        if wallet not in _entry_wallets(entry):
            continue
        data = entry.get("data") if isinstance(entry, Mapping) else None
        candidate: Optional[str] = None
        if isinstance(data, Mapping):
            identity_value = data.get("identity") or data.get("wallet_identity")
            if isinstance(identity_value, str):
                candidate = identity_value
        if candidate is None and isinstance(entry, Mapping):
            raw_identity = entry.get("identity")
            if isinstance(raw_identity, str):
                candidate = raw_identity
        if candidate:
            identities.append(candidate)
    if not identities:
        return None
    for candidate in identities:
        if candidate.lower().endswith(".eth"):
            return candidate
    return identities[0]


def _normalize_identity_tag(tag: str) -> str:
    return "".join(ch for ch in tag.lower() if ch.isalnum())


def _latest_activity_timestamp(wallet: str) -> Optional[datetime]:
    timestamps: List[datetime] = []
    for entry in _load_json_lines(_IMMUTABLE_LOG):
        if wallet in _entry_wallets(entry):
            ts = _parse_timestamp(entry.get("timestamp"))
            if ts:
                timestamps.append(ts)
    for entry in _load_json_lines(_TELEMETRY_CHAIN):
        if wallet in _entry_wallets(entry):
            ts = _parse_timestamp(entry.get("timestamp"))
            if ts:
                timestamps.append(ts)
    rewards_log = _load_json(_REWARDS_LOG_PATH, [])
    if isinstance(rewards_log, list):
        for record in rewards_log:
            if not isinstance(record, Mapping):
                continue
            if record.get("wallet") == wallet:
                ts = _parse_timestamp(record.get("timestamp"))
                if ts:
                    timestamps.append(ts)
    retro_log = _load_json(_RETRO_YIELD_LEDGER, [])
    if isinstance(retro_log, list):
        for record in retro_log:
            if not isinstance(record, Mapping):
                continue
            if record.get("wallet") == wallet:
                ts = _parse_timestamp(
                    record.get("timestamp")
                    or record.get("credited_at")
                    or record.get("recorded_at")
                )
                if ts:
                    timestamps.append(ts)
    if not timestamps:
        return None
    return max(timestamps)


def _retro_summary(wallet: str, start_date: Optional[datetime] = None) -> Dict[str, Any]:
    if start_date is None:
        origin = fetch_first_sync_date(wallet=wallet)
    else:
        origin = start_date
    latest_activity = _latest_activity_timestamp(wallet) or origin
    if latest_activity < origin:
        latest_activity = origin

    identity = _resolve_identity(wallet)
    identity_normalized = _normalize_identity_tag(identity or wallet)

    loyalty_tiers = _load_json(_LOYALTY_TIERS_PATH, {})
    loyalty_multiplier = 1.0
    if isinstance(loyalty_tiers, Mapping) and identity:
        tier_info = loyalty_tiers.get(identity)
        if isinstance(tier_info, Mapping):
            multiplier_value = tier_info.get("multiplier")
            if isinstance(multiplier_value, (int, float)):
                loyalty_multiplier = float(multiplier_value)

    scorecard = _load_json(_USER_SCORECARD_PATH, {})
    loyalty_points = 0.0
    if isinstance(scorecard, Mapping):
        entry = scorecard.get(identity_normalized)
        if isinstance(entry, Mapping):
            loyalty_value = entry.get("loyalty")
            if isinstance(loyalty_value, (int, float)):
                loyalty_points = float(loyalty_value)

    ghostscores = _load_json(_GHOSTSCORES_PATH, {})
    behavior_multiplier = 0.75
    if isinstance(ghostscores, Mapping):
        ghost_entry = ghostscores.get(identity if identity else "")
        if isinstance(ghost_entry, Mapping):
            raw_score = ghost_entry.get("score")
            if isinstance(raw_score, (int, float)):
                behavior_multiplier = max(0.5, round(float(raw_score) / 100.0, 4))

    loyalty_bonus = 1.0 + loyalty_points / 1000.0
    weekly_yield = round(BASE_REWARD * loyalty_multiplier * behavior_multiplier * loyalty_bonus, 2)

    delta_days = max((latest_activity - origin).days, 0)
    weeks = max(1, math.ceil(delta_days / 7)) if delta_days else 1

    projected_total = round(weekly_yield * weeks, 2)
    existing = 0.0
    retro_history = _load_json(_RETRO_YIELD_LEDGER, [])
    if isinstance(retro_history, list):
        for record in retro_history:
            if not isinstance(record, Mapping):
                continue
            if record.get("wallet") != wallet:
                continue
            credited = record.get("credited")
            if isinstance(credited, (int, float)):
                existing += float(credited)
                continue
            amount = record.get("amount")
            if isinstance(amount, (int, float)):
                existing += float(amount)
                continue
            legacy_yield = record.get("yield")
            if isinstance(legacy_yield, (int, float)):
                existing += float(legacy_yield)

    outstanding = max(0.0, round(projected_total - existing, 2))

    return {
        "wallet": wallet,
        "identity": identity,
        "identity_normalized": identity_normalized,
        "start_date": origin,
        "end_date": latest_activity,
        "weeks": weeks,
        "weekly_yield": weekly_yield,
        "projected_total": projected_total,
        "existing_total": round(existing, 2),
        "outstanding": outstanding,
        "loyalty_multiplier": loyalty_multiplier,
        "loyalty_points": loyalty_points,
        "behavior_multiplier": behavior_multiplier,
    }


def fetch_first_sync_date(*, wallet: str) -> datetime:
    entries = _load_json_lines(_IMMUTABLE_LOG)
    timestamps: List[datetime] = []
    for entry in entries:
        if wallet not in _entry_wallets(entry):
            continue
        ts = _parse_timestamp(entry.get("timestamp"))
        if ts:
            timestamps.append(ts)
    if not timestamps:
        raise FileNotFoundError(f"No sync history found for wallet {wallet}")
    return min(timestamps)


def verify_continuous_loyalty(*, wallet: str, ghostkey: str) -> Dict[str, Any]:
    origin = fetch_first_sync_date(wallet=wallet)
    latest = _latest_activity_timestamp(wallet)
    if latest is None or latest < origin:
        raise RuntimeError("Latest activity predates initial sync; loyalty cannot be verified")

    identity = _resolve_identity(wallet)
    normalized = _normalize_identity_tag(ghostkey)

    scorecard = _load_json(_USER_SCORECARD_PATH, {})
    loyalty_points = None
    if isinstance(scorecard, Mapping):
        entry = scorecard.get(normalized)
        if isinstance(entry, Mapping):
            loyalty_value = entry.get("loyalty")
            if isinstance(loyalty_value, (int, float)):
                loyalty_points = float(loyalty_value)

    loyalty_tiers = _load_json(_LOYALTY_TIERS_PATH, {})
    loyalty_multiplier = None
    if isinstance(loyalty_tiers, Mapping) and identity:
        tier_entry = loyalty_tiers.get(identity)
        if isinstance(tier_entry, Mapping):
            mult_value = tier_entry.get("multiplier")
            if isinstance(mult_value, (int, float)):
                loyalty_multiplier = float(mult_value)

    if loyalty_points is None or loyalty_multiplier is None:
        raise RuntimeError("Loyalty credentials missing for identity verification")

    return {
        "wallet": wallet,
        "ghostkey": ghostkey,
        "identity": identity,
        "loyalty_points": loyalty_points,
        "loyalty_multiplier": loyalty_multiplier,
        "start_date": origin.isoformat(),
        "latest_activity": latest.isoformat(),
        "verified": True,
    }


def calculate_total_backpay(*, start_date: datetime, wallet: str) -> float:
    summary = _retro_summary(wallet, start_date)
    return summary["outstanding"]


def distribute_retro_rewards(*, wallet: str, amount: float, start_date: Optional[datetime] = None) -> Dict[str, Any]:
    summary = _retro_summary(wallet, start_date)
    credited_amount = round(float(amount), 2)
    timestamp = datetime.now(timezone.utc).isoformat()

    entry = {
        "wallet": wallet,
        "identity": summary["identity"],
        "start_date": summary["start_date"].isoformat(),
        "end_date": summary["end_date"].isoformat(),
        "weeks": summary["weeks"],
        "weekly_yield": summary["weekly_yield"],
        "projected_total": summary["projected_total"],
        "existing_total": summary["existing_total"],
        "credited": credited_amount,
        "yield": credited_amount,
        "loyalty_multiplier": summary["loyalty_multiplier"],
        "loyalty_points": summary["loyalty_points"],
        "behavior_multiplier": summary["behavior_multiplier"],
        "timestamp": timestamp,
        "status": "credited" if credited_amount > 0 else "up_to_date",
    }

    history = _load_json(_RETRO_YIELD_LEDGER, [])
    if not isinstance(history, list):
        history = []
    history.append(entry)
    _RETRO_YIELD_LEDGER.write_text(json.dumps(history, indent=2))
    return entry


def unlock_retroactive_yield(*, wallet: str, ghostkey: str) -> Dict[str, Any]:
    origin = fetch_first_sync_date(wallet=wallet)
    verification = verify_continuous_loyalty(wallet=wallet, ghostkey=ghostkey)
    outstanding = calculate_total_backpay(start_date=origin, wallet=wallet)
    distribution = distribute_retro_rewards(wallet=wallet, amount=outstanding, start_date=origin)
    return {
        "wallet": wallet,
        "ghostkey": ghostkey,
        "start_date": origin.isoformat(),
        "owed": outstanding,
        "verification": verification,
        "distribution": distribution,
    }


def _alignment_multiplier(normalized_score: Optional[float]) -> float:
    if normalized_score is None:
        return 1.0
    centered = (normalized_score - 50.0) / 50.0
    multiplier = 1.0 + centered * ALIGNMENT_WEIGHT
    return max(0.4, round(multiplier, 4))


def _length_multiplier(entry: str) -> float:
    words = entry.split()
    if not words:
        return 1.0
    factor = min(len(words) / 120.0, 1.0)
    multiplier = 1.0 + factor * LENGTH_WEIGHT
    return round(multiplier, 4)


def _emotion_multiplier(dominant_emotion: Optional[str]) -> float:
    if not dominant_emotion:
        return 1.0
    return EMOTION_MULTIPLIERS.get(dominant_emotion, 1.0)


def _build_distribution(partners: Mapping[str, dict], total_amount: float) -> List[dict]:
    if not partners:
        return []
    share = total_amount / len(partners)
    return [
        {
            "partner": partner,
            "wallet": details.get("wallet"),
            "amount": round(share, 2),
            "reward_flow_routing": details.get("reward_flow_routing", "UNKNOWN"),
        }
        for partner, details in sorted(partners.items())
    ]


def calculate(
    entry: str,
    *,
    alignment: Optional[Mapping[str, object]] = None,
    graph_node: Optional[Mapping[str, object]] = None,
    timestamp: Optional[str] = None,
    cipher_suite: FHECipherSuite | None = None,
    private_metadata: Mapping[str, Any] | None = None,
    zero_knowledge_context: Optional[str] = None,
) -> Dict[str, object]:
    """Compute a reflection reward event and persist it to the reward stream."""

    partners = _load_partner_config(Path("vaultfire_rewards.json"))
    normalized_score = None
    matched_keywords: Iterable[str] = ()
    if alignment:
        normalized_score = alignment.get("normalized")  # type: ignore[assignment]
        matched_keywords = alignment.get("keywords", ())  # type: ignore[assignment]

    dominant_emotion = None
    themes: Iterable[str] = ()
    if graph_node:
        dominant_emotion = graph_node.get("dominant_emotion")
        themes = graph_node.get("themes", ())

    alignment_mult = _alignment_multiplier(
        float(normalized_score) if normalized_score is not None else None
    )
    length_mult = _length_multiplier(entry)
    emotion_mult = _emotion_multiplier(dominant_emotion if isinstance(dominant_emotion, str) else None)

    total_multiplier = round(alignment_mult * length_mult * emotion_mult, 4)
    calculated_amount = round(BASE_REWARD * total_multiplier, 2)

    event_timestamp = timestamp or datetime.now(timezone.utc).isoformat()

    event: Dict[str, Any] = {
        "timestamp": event_timestamp,
        "base_amount": BASE_REWARD,
        "total_multiplier": total_multiplier,
        "calculated_amount": calculated_amount,
        "alignment_score": normalized_score,
        "alignment_keywords": list(matched_keywords),
        "dominant_emotion": dominant_emotion,
        "themes": list(themes),
        "partners": _build_distribution(partners, calculated_amount),
    }

    stream_file = reward_stream_path()
    with stream_file.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event) + "\n")

    print(
        "\U0001F48E Reward stream update:"
        f" {calculated_amount:.2f} units routed across {len(event['partners']) or 'no'} partners"
        f" (multiplier {total_multiplier})."
    )

    if cipher_suite:
        sensitive_payload = {
            "calculated_amount": calculated_amount,
            "partners": event["partners"],
            "alignment_score": normalized_score,
            **dict(private_metadata or {}),
        }
        ciphertext = cipher_suite.encrypt_record(
            sensitive_payload,
            sensitive_fields=sensitive_payload.keys(),
        )
        event["fhe"] = {
            "ciphertext": ciphertext.serialize(),
            "commitment": cipher_suite.generate_zero_knowledge_commitment(
                ciphertext, context=zero_knowledge_context or "rewards.yield"
            ),
            "moral_tag": cipher_suite.moral_tag,
        }

    return event


def calculate_private_yield(
    entry: str,
    *,
    alignment: Optional[Mapping[str, object]] = None,
    graph_node: Optional[Mapping[str, object]] = None,
    timestamp: Optional[str] = None,
    cipher_suite: FHECipherSuite,
    private_metadata: Mapping[str, Any] | None = None,
    zero_knowledge_context: Optional[str] = None,
) -> Dict[str, object]:
    """Convenience wrapper that enforces encrypted yield output."""

    return calculate(
        entry,
        alignment=alignment,
        graph_node=graph_node,
        timestamp=timestamp,
        cipher_suite=cipher_suite,
        private_metadata=private_metadata,
        zero_knowledge_context=zero_knowledge_context,
    )


__all__ = [
    "calculate",
    "calculate_private_yield",
    "fetch_first_sync_date",
    "verify_continuous_loyalty",
    "calculate_total_backpay",
    "distribute_retro_rewards",
    "unlock_retroactive_yield",
]
