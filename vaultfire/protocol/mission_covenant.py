"""Mission covenant ledger unique to Vaultfire's ethics-first protocol."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from hashlib import sha256
from typing import Dict, Iterable, Mapping, MutableMapping, Tuple

from .constants import MISSION_STATEMENT, ORIGIN_NODE_ID
from .mission_anchor import MissionAnchorRecord


@dataclass(frozen=True)
class MissionCovenant:
    """Immutable covenant proof binding partner actions to Vaultfire's mission."""

    covenant_id: str
    partner_id: str
    mission: str
    purpose: str
    commitments: Tuple[str, ...]
    metadata: Mapping[str, object]
    minted_at: datetime
    mission_lineage: str
    anchor_signature: str
    previous_unstoppable: str
    unstoppable_hash: str

    def export(self) -> Dict[str, object]:
        """Return a JSON-serialisable payload for downstream verifiers."""

        return {
            "covenant_id": self.covenant_id,
            "partner_id": self.partner_id,
            "mission": self.mission,
            "purpose": self.purpose,
            "commitments": list(self.commitments),
            "metadata": dict(self.metadata),
            "minted_at": self.minted_at.replace(tzinfo=timezone.utc).isoformat(),
            "mission_lineage": self.mission_lineage,
            "anchor_signature": self.anchor_signature,
            "previous_unstoppable": self.previous_unstoppable,
            "unstoppable_hash": self.unstoppable_hash,
        }


@dataclass
class MissionCovenantLedger:
    """Vaultfire-only covenant chain that keeps the mission unforgeable."""

    canonical_mission: str = MISSION_STATEMENT
    origin_node: str = ORIGIN_NODE_ID
    _anchors: MutableMapping[str, MissionAnchorRecord] = field(default_factory=dict, init=False, repr=False)
    _covenants: MutableMapping[str, MissionCovenant] = field(default_factory=dict, init=False, repr=False)
    _partner_counts: MutableMapping[str, int] = field(default_factory=dict, init=False, repr=False)
    _last_unstoppable: str = field(default="", init=False, repr=False)

    def register_anchor(self, record: MissionAnchorRecord) -> None:
        """Register an approved mission anchor before issuing covenants."""

        mission_text = record.mission.strip()
        if mission_text != self.canonical_mission:
            raise ValueError("mission anchor does not match the canonical mission")
        self._anchors[record.partner_id] = record

    def issue_covenant(
        self,
        partner_id: str,
        *,
        purpose: str,
        commitments: Iterable[str] | None = None,
        metadata: Mapping[str, object] | None = None,
        mission_override: str | None = None,
    ) -> MissionCovenant:
        """Mint a covenant proof that threads anchor lineage through an unstoppable hash."""

        anchor = self._resolve_anchor(partner_id)
        mission_text = self._resolve_mission(anchor, mission_override)
        normalised_commitments = self._normalise_commitments(commitments)
        covenant_id = self._next_covenant_id(partner_id)
        mission_lineage = self._build_mission_lineage(anchor)
        metadata_payload = self._prepare_metadata(metadata)
        unstoppable_hash = self._build_unstoppable_hash(
            covenant_id,
            partner_id,
            mission_text,
            purpose,
            normalised_commitments,
            metadata_payload,
            mission_lineage,
            anchor.signature,
        )
        covenant = MissionCovenant(
            covenant_id=covenant_id,
            partner_id=partner_id,
            mission=mission_text,
            purpose=purpose,
            commitments=normalised_commitments,
            metadata=metadata_payload,
            minted_at=datetime.now(timezone.utc),
            mission_lineage=mission_lineage,
            anchor_signature=anchor.signature,
            previous_unstoppable=self._last_unstoppable,
            unstoppable_hash=unstoppable_hash,
        )
        self._covenants[covenant_id] = covenant
        self._last_unstoppable = unstoppable_hash
        return covenant

    def verify_covenant(self, covenant: MissionCovenant | str) -> bool:
        """Verify a covenant's unstoppable hash and mission lineage."""

        record = self._resolve_covenant(covenant)
        anchor = self._anchors.get(record.partner_id)
        if anchor is None:
            return False
        recalculated = self._build_unstoppable_hash(
            record.covenant_id,
            record.partner_id,
            record.mission,
            record.purpose,
            record.commitments,
            record.metadata,
            record.mission_lineage,
            record.anchor_signature,
            previous=record.previous_unstoppable,
        )
        return recalculated == record.unstoppable_hash and record.mission == self.canonical_mission

    def list_covenants(self) -> Tuple[MissionCovenant, ...]:
        """Return all covenants in issuance order."""

        return tuple(self._covenants[key] for key in sorted(self._covenants.keys()))

    @property
    def foundation_digest(self) -> str:
        """Return the latest unstoppable hash anchoring the covenant chain."""

        return self._last_unstoppable

    def _resolve_anchor(self, partner_id: str) -> MissionAnchorRecord:
        anchor = self._anchors.get(partner_id)
        if anchor is None:
            raise ValueError(f"no mission anchor registered for partner {partner_id}")
        return anchor

    def _resolve_covenant(self, covenant: MissionCovenant | str) -> MissionCovenant:
        if isinstance(covenant, MissionCovenant):
            return covenant
        record = self._covenants.get(covenant)
        if record is None:
            raise ValueError(f"unknown covenant id {covenant}")
        return record

    def _resolve_mission(
        self,
        anchor: MissionAnchorRecord,
        mission_override: str | None,
    ) -> str:
        mission_text = mission_override.strip() if isinstance(mission_override, str) else anchor.mission.strip()
        if mission_text != self.canonical_mission:
            raise ValueError("covenant mission must match the canonical mission")
        return mission_text

    def _normalise_commitments(self, commitments: Iterable[str] | None) -> Tuple[str, ...]:
        if commitments is None:
            return tuple()
        unique = []
        seen = set()
        for item in commitments:
            if not isinstance(item, str):
                continue
            value = item.strip()
            if not value or value in seen:
                continue
            seen.add(value)
            unique.append(value)
        return tuple(sorted(unique))

    def _prepare_metadata(self, metadata: Mapping[str, object] | None) -> Dict[str, object]:
        if metadata is None:
            return {}
        result: Dict[str, object] = {}
        for key, value in metadata.items():
            if not isinstance(key, str):
                continue
            result[key] = value
        return result

    def _next_covenant_id(self, partner_id: str) -> str:
        count = self._partner_counts.get(partner_id, 0) + 1
        self._partner_counts[partner_id] = count
        return f"{partner_id}::covenant::{count}"

    def _build_mission_lineage(self, anchor: MissionAnchorRecord) -> str:
        payload = {
            "mission": anchor.mission,
            "origin_node": self.origin_node,
            "anchor_signature": anchor.signature,
        }
        encoded = json.dumps(payload, sort_keys=True).encode("utf-8")
        return sha256(encoded).hexdigest()

    def _build_unstoppable_hash(
        self,
        covenant_id: str,
        partner_id: str,
        mission: str,
        purpose: str,
        commitments: Tuple[str, ...],
        metadata: Mapping[str, object],
        mission_lineage: str,
        anchor_signature: str,
        *,
        previous: str | None = None,
    ) -> str:
        payload = {
            "covenant_id": covenant_id,
            "partner_id": partner_id,
            "mission": mission,
            "purpose": purpose,
            "commitments": commitments,
            "metadata": metadata,
            "mission_lineage": mission_lineage,
            "anchor_signature": anchor_signature,
            "previous_unstoppable": self._last_unstoppable if previous is None else previous,
        }
        encoded = json.dumps(payload, sort_keys=True, default=str).encode("utf-8")
        return sha256(encoded).hexdigest()


__all__ = ["MissionCovenant", "MissionCovenantLedger"]
