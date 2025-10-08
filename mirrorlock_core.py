"""Mirrorlock protocol core orchestrator for behavior cloaking."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import hashlib
import json
import secrets
from typing import Dict, Iterable, List, MutableMapping, Sequence

from consent_plus import ConsentPlusMode
from deception_net import ShadowFrostDeceptionLayer
from mirrorbridge import MirrorBridge, MirrorBridgeEvent
from shadowbridge import ShadowBridge
from timing_cloak import CloakedTrigger, TimingCloak


@dataclass(frozen=True)
class BehaviorEvent:
    """Represents an observed behavioral signal."""

    module: str
    action: str
    timestamp: datetime
    payload_signature: str
    metadata: Dict[str, str]


@dataclass(frozen=True)
class BehaviorToken:
    """An anonymized token mirroring behavior across stealth layers."""

    token_id: str
    module: str
    action: str
    behavior_fingerprint: str
    override_route: str
    shadow_route: str
    issued_at: datetime
    shadow_delay: float
    mirrors: Sequence[MirrorBridgeEvent]


@dataclass(frozen=True)
class MirrorlockLedgerEntry:
    """Immutable ledger entry for Mirrorlock consent events."""

    index: int
    preset: str
    event_hash: str
    timestamp: datetime


class MirrorConsentEngine:
    """Manages Mirrorlock consent presets and ledger integration."""

    _PRESETS: Dict[str, Dict[str, float]] = {
        "passive": {"jitter_floor": 0.25, "jitter_ceiling": 0.9},
        "aggressive": {"jitter_floor": 0.5, "jitter_ceiling": 2.5},
        "off-grid": {"jitter_floor": 1.2, "jitter_ceiling": 4.8},
    }

    def __init__(
        self,
        *,
        consent_plus: ConsentPlusMode | None = None,
        default_preset: str = "passive",
    ) -> None:
        if default_preset not in self._PRESETS:
            raise KeyError(f"unknown MirrorConsent preset '{default_preset}'")
        self._consent_plus = consent_plus or ConsentPlusMode()
        self._active_preset = default_preset
        self._ledger: List[MirrorlockLedgerEntry] = []
        self._last_digest = "0" * 64

    @property
    def active_preset(self) -> str:
        """Return the currently active preset."""

        return self._active_preset

    @property
    def ledger(self) -> Sequence[MirrorlockLedgerEntry]:
        """Return a tamper-evident ledger snapshot."""

        return tuple(self._ledger)

    def preset_window(self) -> Dict[str, Dict[str, float]]:
        """Expose configured preset windows for downstream modules."""

        return dict(self._PRESETS)

    def set_preset(self, preset: str) -> None:
        """Activate a consent preset and synchronize with Consent+."""

        if preset not in self._PRESETS:
            raise KeyError(f"unknown MirrorConsent preset '{preset}'")
        if preset == self._active_preset:
            return
        self._active_preset = preset
        if preset == "aggressive":
            self._consent_plus.emit_revocation_beacon(
                "mirrorlock", reason="aggressive-shadow"
            )
        elif preset == "off-grid":
            self._consent_plus.trigger_kill_switch(
                "mirrorlock", route_hint="ghostkey316.eth/off-grid"
            )

    def _chain_digest(self, payload: str) -> str:
        digest = hashlib.sha3_256(f"{self._last_digest}:{payload}".encode("utf-8")).hexdigest()
        self._last_digest = digest
        return digest

    def record_event(self, event: BehaviorEvent, token: BehaviorToken) -> MirrorlockLedgerEntry:
        """Log a Mirrorlock event in a tamper-evident format."""

        payload = json.dumps(
            {
                "preset": self._active_preset,
                "signature": event.payload_signature,
                "fingerprint": token.behavior_fingerprint,
                "override": token.override_route,
            },
            sort_keys=True,
            separators=(",", ":"),
        )
        digest = self._chain_digest(payload)
        entry = MirrorlockLedgerEntry(
            index=len(self._ledger) + 1,
            preset=self._active_preset,
            event_hash=digest,
            timestamp=datetime.utcnow(),
        )
        self._ledger.append(entry)
        return entry

    def dashboard_snapshot(self) -> Dict[str, str]:
        """Return a consent-aware dashboard snapshot."""

        snapshot = self._consent_plus.dashboard_snapshot()
        augmented = {
            **snapshot,
            "mirrorlock_preset": self._active_preset,
            "mirrorlock_events": str(len(self._ledger)),
        }
        return augmented


class MirrorlockCore:
    """Coordinates Mirrorlock behavioral shadowing and consent management."""

    def __init__(
        self,
        *,
        override_identity: str = "Ghostkey-316",
        base_identity: str = "bpow20.cb.id",
        consent_engine: MirrorConsentEngine | None = None,
        deception_layer: ShadowFrostDeceptionLayer | None = None,
        shadow_bridge: ShadowBridge | None = None,
        mirror_bridge: MirrorBridge | None = None,
        timing_cloak: TimingCloak | None = None,
    ) -> None:
        self.override_identity = override_identity
        self.base_identity = base_identity
        self.consent_engine = consent_engine or MirrorConsentEngine()
        self.deception_layer = deception_layer or ShadowFrostDeceptionLayer(
            override_identity=override_identity
        )
        self.shadow_bridge = shadow_bridge or ShadowBridge()
        self.mirror_bridge = mirror_bridge or MirrorBridge(base_identity=base_identity)
        self.timing_cloak = timing_cloak or TimingCloak()
        self._events: List[BehaviorEvent] = []
        self._tokens: List[BehaviorToken] = []

    @property
    def events(self) -> Sequence[BehaviorEvent]:
        """Return the observed behavior events."""

        return tuple(self._events)

    @property
    def tokens(self) -> Sequence[BehaviorToken]:
        """Return issued behavior tokens."""

        return tuple(self._tokens)

    def observe(
        self,
        module: str,
        action: str,
        *,
        metadata: MutableMapping[str, object] | None = None,
    ) -> BehaviorToken:
        """Observe module activity and issue a mirrored behavior token."""

        sanitized = self._scrub_metadata(metadata or {})
        payload_signature = self._hash_payload(module, action, sanitized)
        event = BehaviorEvent(
            module=module,
            action=action,
            timestamp=datetime.utcnow(),
            payload_signature=payload_signature,
            metadata=sanitized,
        )
        self._events.append(event)
        token = self._issue_token(event)
        self._tokens.append(token)
        self.consent_engine.record_event(event, token)
        return token

    def observe_batch(
        self,
        observations: Iterable[tuple[str, str, MutableMapping[str, object] | None]],
    ) -> Sequence[BehaviorToken]:
        """Observe a batch of module events."""

        issued: List[BehaviorToken] = []
        for module, action, metadata in observations:
            issued.append(self.observe(module, action, metadata=metadata))
        return issued

    def _scrub_metadata(self, metadata: MutableMapping[str, object]) -> Dict[str, str]:
        sanitized: Dict[str, str] = {}
        for key, value in metadata.items():
            text = json.dumps(value, sort_keys=True) if isinstance(value, (dict, list)) else str(value)
            sanitized[key] = text[:128]
        return sanitized

    def _hash_payload(self, module: str, action: str, metadata: Dict[str, str]) -> str:
        canonical = json.dumps(
            {"module": module, "action": action, "metadata": metadata},
            sort_keys=True,
            separators=(",", ":"),
        )
        return hashlib.sha3_256(canonical.encode("utf-8")).hexdigest()

    def _timing_shadow(self, signature: str) -> float:
        triggers: Sequence[CloakedTrigger] = self.timing_cloak.disperse([signature])
        if not triggers:
            return 0.0
        return triggers[0].delay_seconds

    def _issue_token(self, event: BehaviorEvent) -> BehaviorToken:
        entropy = secrets.token_hex(8)
        fingerprint = hashlib.sha3_256(
            f"{event.payload_signature}:{entropy}".encode("utf-8")
        ).hexdigest()
        token_id = f"mlk_{fingerprint[:26]}"
        handshake = self.deception_layer.negotiate_quantum_fallback(event.module)
        shadow_route = self.shadow_bridge.route_override(self.base_identity)
        shadow_delay = self._timing_shadow(event.payload_signature)
        mirrors = self.mirror_bridge.mirror_token(token_id)
        return BehaviorToken(
            token_id=token_id,
            module=event.module,
            action=event.action,
            behavior_fingerprint=fingerprint,
            override_route=handshake.override_route,
            shadow_route=shadow_route,
            issued_at=datetime.utcnow(),
            shadow_delay=shadow_delay,
            mirrors=tuple(mirrors),
        )

    def ledger_snapshot(self) -> Sequence[MirrorlockLedgerEntry]:
        """Expose the consent ledger snapshot."""

        return self.consent_engine.ledger

    def dashboard_snapshot(self) -> Dict[str, str]:
        """Expose dashboard information for CLI overlays."""

        return self.consent_engine.dashboard_snapshot()
