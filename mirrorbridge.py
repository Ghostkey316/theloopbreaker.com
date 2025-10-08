"""MirrorBridge identity mirroring utilities for the Mirrorlock protocol."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import hashlib
import secrets
from typing import Dict, Iterable, List, Sequence


_DEFAULT_NETWORKS: Sequence[str] = ("ethereum", "base", "zora", "worldcoin")


@dataclass(frozen=True)
class IdentityMapping:
    """Represents a synthetic identity for a given network."""

    network: str
    synthetic_identity: str
    fingerprint: str


@dataclass(frozen=True)
class MirrorBridgeEvent:
    """Record of a mirrored behavior token for a target network."""

    token: str
    network: str
    synthetic_identity: str
    route: str
    timestamp: datetime


class MirrorBridge:
    """Generate cross-chain identity mirrors for Ghostkey-316 overlays."""

    def __init__(
        self,
        *,
        base_identity: str = "bpow20.cb.id",
        networks: Sequence[str] | None = None,
    ) -> None:
        self.base_identity = base_identity
        self._networks: List[str] = list(networks or _DEFAULT_NETWORKS)
        self._identity_map: Dict[str, IdentityMapping] = {}
        self._seed = secrets.token_hex(16)
        self._build_identity_map()

    def _build_identity_map(self) -> None:
        self._identity_map.clear()
        for network in self._networks:
            digest = hashlib.sha3_256(
                f"{self.base_identity}:{network}:{self._seed}".encode("utf-8")
            ).hexdigest()
            synthetic = f"0x{digest[:40]}"
            mapping = IdentityMapping(
                network=network,
                synthetic_identity=synthetic,
                fingerprint=digest[40:],
            )
            self._identity_map[network] = mapping

    @property
    def networks(self) -> Sequence[str]:
        """Return the networks managed by MirrorBridge."""

        return tuple(self._networks)

    @property
    def identity_map(self) -> Dict[str, IdentityMapping]:
        """Expose the synthetic identity map."""

        return dict(self._identity_map)

    def refresh(self) -> None:
        """Regenerate synthetic identities with a new entropy seed."""

        self._seed = secrets.token_hex(16)
        self._build_identity_map()

    def mirror_token(self, token: str, *, include_networks: Iterable[str] | None = None) -> List[MirrorBridgeEvent]:
        """Mirror a behavior token across configured networks."""

        selected = list(include_networks or self._networks)
        events: List[MirrorBridgeEvent] = []
        issued_at = datetime.utcnow()
        for network in selected:
            mapping = self._identity_map.get(network)
            if not mapping:
                continue
            route_digest = hashlib.sha3_256(
                f"{token}:{mapping.synthetic_identity}:{issued_at.isoformat()}".encode(
                    "utf-8"
                )
            ).hexdigest()
            route = f"mirrorbridge://{network}/{route_digest[:24]}"
            events.append(
                MirrorBridgeEvent(
                    token=token,
                    network=network,
                    synthetic_identity=mapping.synthetic_identity,
                    route=route,
                    timestamp=issued_at,
                )
            )
        return events

    def resolve_network_route(self, network: str) -> str:
        """Return a deterministic override route for a network."""

        mapping = self._identity_map.get(network)
        if mapping is None:
            raise KeyError(f"network '{network}' is not managed by MirrorBridge")
        digest = hashlib.sha3_256(
            f"{mapping.synthetic_identity}:{network}:{self.base_identity}".encode("utf-8")
        ).hexdigest()
        return f"mirrorbridge://override/{network}/{digest[:18]}"
