"""Sandbox pilot orchestration utilities for the Codex CLI."""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from typing import Any, Mapping

from vaultfire.protocols import launch_testnet_instance
from vaultfire.x402_gateway import X402Gateway, X402Rule


@dataclass(frozen=True)
class SandboxLaunchResult:
    """Structured output emitted after preparing the sandbox launch."""

    profile: Mapping[str, Any]
    testnet: Mapping[str, Any]
    telemetry: Mapping[str, Any]
    x402_proxy: Mapping[str, Any]

    def export(self) -> Mapping[str, Any]:
        return {
            "profile": dict(self.profile),
            "testnet": dict(self.testnet),
            "telemetry": dict(self.telemetry),
            "x402_proxy": dict(self.x402_proxy),
        }


def _read_profile(path: Path) -> Mapping[str, Any]:
    text = path.read_text(encoding="utf-8")
    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        try:
            import yaml  # type: ignore
        except Exception as yaml_exc:  # pragma: no cover - optional dependency
            raise ValueError(
                "Profile must be valid JSON or PyYAML must be installed for YAML parsing."
            ) from yaml_exc
        else:
            data = yaml.safe_load(text)  # type: ignore[attr-defined]
            if not isinstance(data, Mapping):
                raise ValueError("Profile must resolve to a mapping") from exc
            payload = dict(data)
    if not isinstance(payload, Mapping):
        raise ValueError("Profile must resolve to a mapping")
    return payload


def _validate_profile(profile: Mapping[str, Any]) -> None:
    required = {"partner_id", "tier", "telemetry_opt_in", "wallet_proof", "expected_flow"}
    missing = sorted(required - set(profile))
    if missing:
        raise ValueError(f"Profile missing required keys: {', '.join(missing)}")


def _ensure_directory(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def _write_json(path: Path, payload: Mapping[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")


def _initialise_testnet(profile: Mapping[str, Any]) -> Mapping[str, Any]:
    partner_id = str(profile["partner_id"]).strip()
    features = (
        "deterministic_mirror",
        "sandbox_proxy",
        "telemetry_redirect",
    )
    instance = launch_testnet_instance(partner_id, scope="sandbox", features=features)
    export = dict(instance.export())
    export["deterministic_seed"] = sha256(partner_id.encode("utf-8")).hexdigest()[:32]
    return export


def _configure_telemetry(profile: Mapping[str, Any], base_dir: Path) -> Mapping[str, Any]:
    trace_id = uuid.uuid4().hex
    telemetry_payload = {
        "partner_id": profile["partner_id"],
        "telemetry_opt_in": bool(profile["telemetry_opt_in"]),
        "trace_id": trace_id,
        "redirect": str(base_dir / "vaultfire_trace.json"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    _write_json(base_dir / "vaultfire_trace.json", telemetry_payload)
    return telemetry_payload


def _configure_x402_proxy(profile: Mapping[str, Any], base_dir: Path) -> Mapping[str, Any]:
    gateway = X402Gateway(
        ledger_path=base_dir / "x402_sandbox_ledger.jsonl",
        codex_memory_path=base_dir / "x402_sandbox_memory.jsonl",
        ghostkey_earnings_path=base_dir / "x402_sandbox_earnings.jsonl",
        companion_path=base_dir / "x402_sandbox_companion.jsonl",
    )
    sandbox_rule = X402Rule(
        endpoint="sandbox.proxy.passive",
        category="sandbox",
        description="Passive x402 proxy shield for sandbox partners",
        minimum_charge=0.0,
        currency="ETH",
        wallet_free=True,
        unlocks=("telemetry_redirect", "deterministic_mirror"),
    )
    gateway.register_rule(sandbox_rule)
    rules_snapshot = gateway.describe_rules()
    sandbox_descriptor = {
        "tier": str(profile.get("tier", "sandbox")),
        "rules": rules_snapshot.get(
            "sandbox.proxy.passive",
            {
                "endpoint": sandbox_rule.endpoint,
                "category": sandbox_rule.category,
                "description": sandbox_rule.description,
                "minimum_charge": sandbox_rule.minimum_charge,
                "currency": sandbox_rule.currency,
                "default_amount": sandbox_rule.default_amount,
                "wallet_free": sandbox_rule.wallet_free,
                "unlocks": list(sandbox_rule.unlocks),
            },
        ),
        "ledger_path": str(gateway.ledger_path),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    _write_json(base_dir / "x402_proxy_rules.json", rules_snapshot)
    return sandbox_descriptor


def initialise_sandbox(
    profile_path: Path,
    *,
    sandbox_dir: Path | None = None,
    partner_drop_dir: Path | None = None,
) -> SandboxLaunchResult:
    """Initialise the sandbox environment from ``profile_path``."""

    sandbox_root = sandbox_dir or Path("sandbox")
    partner_root = partner_drop_dir or Path("vaultfire/partners/pilot_drop")
    _ensure_directory(sandbox_root)
    _ensure_directory(partner_root)

    profile = _read_profile(profile_path)
    _validate_profile(profile)
    testnet = _initialise_testnet(profile)
    telemetry = _configure_telemetry(profile, sandbox_root)
    x402_proxy = _configure_x402_proxy(profile, sandbox_root)

    result = SandboxLaunchResult(
        profile=dict(profile),
        testnet=testnet,
        telemetry=telemetry,
        x402_proxy=x402_proxy,
    )

    summary_path = partner_root / "sandbox_launch_summary.json"
    _write_json(summary_path, result.export())
    return result


__all__ = ["SandboxLaunchResult", "initialise_sandbox"]
