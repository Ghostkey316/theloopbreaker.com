"""Signal shielding primitives for Vaultfire defenses."""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Mapping, MutableMapping, Sequence, Tuple

__all__ = ["ShieldLayer", "SignalJammer", "MirrorCloak", "TracerSnare"]


def _timestamp() -> str:
    """Return an ISO-8601 timestamp in UTC."""

    return datetime.now(timezone.utc).isoformat()


@dataclass
class ShieldLayer:
    """Serializable description of an active shielding layer."""

    module: str
    status: str
    mode: str
    whitelist: Sequence[str] = field(default_factory=tuple)
    config: MutableMapping[str, object] = field(default_factory=dict)
    engaged_at: str = field(init=False)

    def __post_init__(self) -> None:
        self.module = str(self.module)
        self.status = str(self.status)
        self.mode = str(self.mode)
        self.whitelist = _sanitize_whitelist(self.whitelist)
        self.config = dict(self.config)
        self.engaged_at = _timestamp()

    def to_payload(self) -> Mapping[str, object]:
        payload: MutableMapping[str, object] = {
            "module": self.module,
            "status": self.status,
            "mode": self.mode,
            "engaged_at": self.engaged_at,
            "config": dict(self.config),
        }
        if self.whitelist:
            payload["whitelist"] = tuple(self.whitelist)
        return payload


def _sanitize_whitelist(values: Iterable[str] | None) -> Tuple[str, ...]:
    unique: MutableMapping[str, None] = {}
    if values is None:
        return ()
    for value in values:
        value = str(value).strip()
        if not value:
            continue
        unique.setdefault(value, None)
    return tuple(unique.keys())


class _BaseShieldModule:
    """Common helpers for the shielding primitives."""

    module_name: str = "shield"
    default_mode: str = "adaptive"
    default_status: str = "engaged"

    @classmethod
    def _build_layer(
        cls,
        *,
        status: str | None = None,
        mode: str | None = None,
        whitelist: Iterable[str] | None = None,
        **config: object,
    ) -> ShieldLayer:
        return ShieldLayer(
            module=cls.module_name,
            status=status or cls.default_status,
            mode=mode or cls.default_mode,
            whitelist=_sanitize_whitelist(whitelist),
            config={key: value for key, value in config.items()},
        )


class SignalJammer(_BaseShieldModule):
    """Adaptive jammer that dampens hostile signal bursts."""

    module_name = "signal-jammer"

    @classmethod
    def deploy(
        cls,
        *,
        mode: str = "adaptive",
        whitelist: Iterable[str] | None = ("internal",),
        dampening: float = 0.82,
        coverage: str = "network",
    ) -> ShieldLayer:
        return cls._build_layer(
            status="engaged",
            mode=mode or cls.default_mode,
            whitelist=whitelist,
            dampening=float(dampening),
            coverage=str(coverage),
        )


class MirrorCloak(_BaseShieldModule):
    """Cloaks active profiles by mirroring sandbox identities."""

    module_name = "mirror-cloak"

    @classmethod
    def mirror_profile(
        cls,
        profile: str,
        *,
        spectrum: str = "sandbox",
        refraction: float = 0.67,
    ) -> ShieldLayer:
        return cls._build_layer(
            status="mirroring",
            mode="profile",
            whitelist=(),
            profile=str(profile),
            spectrum=str(spectrum),
            refraction=float(refraction),
        )


class TracerSnare(_BaseShieldModule):
    """Tracks intrusion attempts and blocks hostile sources."""

    module_name = "tracer-snare"

    @classmethod
    def track_and_block(
        cls,
        *,
        sensitivity: float = 0.75,
        trace_window: int = 12,
        auto_block: bool = True,
    ) -> ShieldLayer:
        return cls._build_layer(
            status="tracking",
            mode="trace",
            whitelist=(),
            sensitivity=float(sensitivity),
            trace_window=int(trace_window),
            auto_block=bool(auto_block),
        )

